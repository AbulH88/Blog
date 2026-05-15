import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  SERVER_URL, CREATOR_SLUG,
  getCreatorInbox, getThreadWithFan, uploadImage,
} from '../api';

interface InboxRow {
  fanId: number;
  fan: { id: number; username: string; email?: string };
  content: string;
  mediaUrl?: string | null;
  isPPV?: boolean;
  ppvPrice?: string | number;
  isUnlocked?: boolean;
  sentAt: string;
  unread: number;
  subscriptionTier?: string;
  memberSince?: string;
  senderType?: 'fan' | 'creator';
}

interface ChatMessage {
  id: number;
  fanId: number;
  senderType: 'fan' | 'creator';
  content: string;
  mediaUrl?: string | null;
  isPPV?: boolean;
  ppvPrice?: string | number;
  isUnlocked?: boolean;
  sentAt: string;
}

const formatRelative = (iso: string) => {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString();
};

const truncate = (s: string, n = 40) => (s && s.length > n ? s.substring(0, n) + '…' : s || '');

const initials = (name: string) =>
  (name || '?').split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();

const mediaUrlAbs = (u?: string | null) => {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  return u.startsWith('/') ? `${SERVER_URL}${u}` : `${SERVER_URL}/${u}`;
};

const AdminMessages = ({ isDark }: { isDark: boolean }) => {
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [activeFanId, setActiveFanId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [input, setInput] = useState('');
  const [isPPV, setIsPPV] = useState(false);
  const [ppvPrice, setPpvPrice] = useState('4.99');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Socket connection
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;
    const s = io(SERVER_URL, { auth: { token } });
    socketRef.current = s;

    s.on('new_message', (msg: ChatMessage) => {
      // Update active thread if it matches
      setActiveFanId(curId => {
        if (curId === msg.fanId) {
          setMessages(prev => [...prev, msg]);
        }
        return curId;
      });
      // Bubble fan to top of inbox + bump unread when not active
      setInbox(prev => {
        const idx = prev.findIndex(r => r.fanId === msg.fanId);
        const isActive = activeFanIdRef.current === msg.fanId;
        if (idx < 0) {
          // Refetch to pick up new subscriber
          fetchInbox();
          return prev;
        }
        const updatedRow: InboxRow = {
          ...prev[idx],
          content: msg.content,
          mediaUrl: msg.mediaUrl,
          isPPV: msg.isPPV,
          ppvPrice: msg.ppvPrice,
          isUnlocked: msg.isUnlocked,
          sentAt: msg.sentAt,
          senderType: msg.senderType,
          unread:
            msg.senderType === 'fan' && !isActive
              ? (prev[idx].unread || 0) + 1
              : prev[idx].unread || 0,
        };
        const rest = prev.filter((_, i) => i !== idx);
        return [updatedRow, ...rest];
      });
    });

    return () => { s.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track activeFanId in ref for socket handler
  const activeFanIdRef = useRef<number | null>(null);
  useEffect(() => { activeFanIdRef.current = activeFanId; }, [activeFanId]);

  useEffect(() => { fetchInbox(); }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchInbox = async () => {
    try {
      const data = await getCreatorInbox(CREATOR_SLUG);
      setInbox(Array.isArray(data) ? data : []);
    } catch {}
  };

  const openThread = async (row: InboxRow) => {
    setActiveFanId(row.fanId);
    setLoadingThread(true);
    try {
      const msgs = await getThreadWithFan(CREATOR_SLUG, row.fanId);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch {
      setMessages([]);
    }
    setLoadingThread(false);
    // Clear unread badge locally
    setInbox(prev => prev.map(r => r.fanId === row.fanId ? { ...r, unread: 0 } : r));
  };

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const res = await uploadImage(file);
    setUploading(false);
    if (res.url) setMediaUrl(res.url);
    e.target.value = '';
  };

  const clearComposer = () => {
    setInput('');
    setMediaUrl(null);
    setIsPPV(false);
    setPpvPrice('4.99');
  };

  const canSend = () => {
    if (uploading) return false;
    if (isPPV) {
      // PPV requires media or content + price
      const priceOk = parseFloat(ppvPrice) > 0;
      return priceOk && (!!input.trim() || !!mediaUrl);
    }
    return !!input.trim() || !!mediaUrl;
  };

  const send = () => {
    if (!socketRef.current || activeFanId == null || !canSend()) return;
    const payload: any = {
      fanId: activeFanId,
      content: input.trim(),
      isPPV,
      mediaUrl,
    };
    if (isPPV) payload.ppvPrice = parseFloat(ppvPrice) || 0;
    socketRef.current.emit('creator_reply', payload);
    // Optimistic append
    setMessages(prev => [...prev, {
      id: Date.now(),
      fanId: activeFanId,
      senderType: 'creator',
      content: isPPV ? '' : input.trim(),
      mediaUrl,
      isPPV,
      ppvPrice: isPPV ? parseFloat(ppvPrice) || 0 : 0,
      isUnlocked: !isPPV,
      sentAt: new Date().toISOString(),
    }]);
    clearComposer();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // ── Theme tokens (v3 — cream/terracotta, ignores isDark) ─────
  const C = {
    bg:        '#FFF8F2',
    panelBg:   '#fff',
    border:    'var(--v3-line)',
    text:      'var(--v3-ink)',
    muted:     'var(--v3-ink-soft)',
    faint:     'var(--v3-muted)',
    rowHover:  'var(--v3-cream-deep)',
    rowActive: '#FBE3E0',
    inputBg:   '#FFFAF4',
    msgFan:    'var(--v3-cream-deep)',
  };
  void isDark;

  const active = inbox.find(r => r.fanId === activeFanId);

  return (
    <div className="av2-msg-layout" style={{ background: C.panelBg, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', height: 'calc(100vh - 150px)', minHeight: 480, display: 'flex' }}>
      {/* Left — inbox */}
      <aside className="av2-msg-list" style={{ width: 280, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', background: C.panelBg }}>
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: C.text }}>Subscribers</span>
          <button onClick={fetchInbox} title="Refresh"
            style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: '1rem' }}>↻</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {inbox.length === 0 ? (
            <p style={{ padding: '20px 16px', color: C.faint, fontSize: '0.82rem' }}>No subscriber conversations yet.</p>
          ) : inbox.map(row => {
            const isActive = row.fanId === activeFanId;
            const preview = row.isPPV ? '🔒 PPV message' : (row.content || (row.mediaUrl ? '📎 Media' : '…'));
            return (
              <div key={row.fanId} onClick={() => openThread(row)}
                style={{
                  padding: '12px 14px', cursor: 'pointer',
                  borderBottom: `1px solid ${C.border}`,
                  borderLeft: isActive ? '3px solid var(--v3-terracotta)' : '3px solid transparent',
                  background: isActive ? C.rowActive : 'transparent',
                  display: 'flex', gap: 10, alignItems: 'center',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget.style.background = C.rowHover); }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget.style.background = 'transparent'); }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--v3-terracotta)', color: '#fff', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.78rem', fontWeight: 700,
                }}>{initials(row.fan?.username || '?')}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.fan?.username || 'Fan'}
                    </span>
                    <span style={{ fontSize: '0.66rem', color: C.muted, flexShrink: 0 }}>{formatRelative(row.sentAt)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: '0.74rem', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                      {truncate(preview, 40)}
                    </span>
                    {row.unread > 0 && (
                      <span style={{
                        background: '#ef4444', color: '#fff', borderRadius: 10,
                        minWidth: 18, height: 18, padding: '0 5px',
                        fontSize: '0.62rem', fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>{row.unread > 99 ? '99+' : row.unread}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Right — thread */}
      <section className="av2-msg-thread" style={{ flex: 1, display: 'flex', flexDirection: 'column', background: C.panelBg, minWidth: 0 }}>
        {!active ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.faint, fontSize: '0.9rem' }}>
            Select a conversation
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', background: 'var(--v3-terracotta)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.82rem', fontWeight: 700,
              }}>{initials(active.fan?.username || '?')}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: C.text }}>{active.fan?.username}</span>
                  {active.subscriptionTier && (
                    <span style={{
                      background: active.subscriptionTier === 'premium' ? '#f59e0b' : 'var(--v3-terracotta)',
                      color: '#fff', borderRadius: 6, padding: '2px 8px',
                      fontSize: '0.66rem', fontWeight: 700, textTransform: 'capitalize', letterSpacing: 1,
                    }}>{active.subscriptionTier}</span>
                  )}
                </div>
                {active.memberSince && (
                  <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: C.muted }}>
                    Member since {new Date(active.memberSince).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 10, background: C.bg }}>
              {loadingThread ? (
                <p style={{ color: C.faint, fontSize: '0.85rem', textAlign: 'center', marginTop: 30 }}>Loading…</p>
              ) : messages.length === 0 ? (
                <p style={{ color: C.faint, fontSize: '0.85rem', textAlign: 'center', marginTop: 30 }}>No messages yet.</p>
              ) : messages.map(msg => {
                const mine = msg.senderType === 'creator';
                const locked = msg.isPPV && !msg.isUnlocked;
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '72%',
                      padding: locked ? 0 : (msg.mediaUrl ? 4 : '9px 13px'),
                      fontSize: '0.88rem', lineHeight: 1.45,
                      borderRadius: mine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      background: mine ? 'var(--v3-terracotta)' : C.msgFan,
                      color: mine ? '#fff' : C.text,
                      wordBreak: 'break-word', overflow: 'hidden',
                    }}>
                      {locked ? (
                        <div style={{
                          position: 'relative', minWidth: 180, minHeight: 100,
                          background: '#1a1a1a', borderRadius: 'inherit',
                          display: 'flex', flexDirection: 'column',
                          alignItems: 'center', justifyContent: 'center',
                          padding: '14px 18px', color: '#ccc',
                          backgroundImage: msg.mediaUrl ? `url("${mediaUrlAbs(msg.mediaUrl)}")` : 'none',
                          backgroundSize: 'cover', backgroundPosition: 'center',
                        }}>
                          {msg.mediaUrl && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(14px)' }} />}
                          <span style={{ position: 'relative', fontSize: '1.4rem' }}>🔒</span>
                          <span style={{ position: 'relative', fontSize: '0.75rem', marginTop: 4, opacity: 0.85 }}>
                            Locked · ${parseFloat(String(msg.ppvPrice || 0)).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <>
                          {msg.mediaUrl && (
                            msg.mediaUrl.match(/\.(mp4|mov|webm)$/i) ? (
                              <video src={mediaUrlAbs(msg.mediaUrl)} controls style={{ display: 'block', width: '100%', maxWidth: 280, borderRadius: 8 }} />
                            ) : (
                              <img src={mediaUrlAbs(msg.mediaUrl)} alt="" style={{ display: 'block', width: '100%', maxWidth: 280, borderRadius: 8 }} />
                            )
                          )}
                          {msg.content && (
                            <div style={{ padding: msg.mediaUrl ? '8px 10px 4px' : 0 }}>{msg.content}</div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Composer */}
            <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 14px', background: C.panelBg }}>
              {/* Zone 1 — preview strip */}
              {mediaUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ position: 'relative' }}>
                    {mediaUrl.match(/\.(mp4|mov|webm)$/i) ? (
                      <video src={mediaUrlAbs(mediaUrl)} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, background: '#000' }} />
                    ) : (
                      <img src={mediaUrlAbs(mediaUrl)} alt="" style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} />
                    )}
                    <button onClick={() => setMediaUrl(null)}
                      style={{
                        position: 'absolute', top: -6, right: -6, width: 20, height: 20,
                        borderRadius: '50%', background: '#000', color: '#fff', border: 'none',
                        cursor: 'pointer', fontSize: '0.7rem', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                      }}>✕</button>
                  </div>
                  <span style={{ fontSize: '0.74rem', color: C.muted }}>Attached</span>
                </div>
              )}

              {/* Zone 2 — toolbar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleAttach} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading}
                  style={{
                    background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
                    padding: '5px 10px', color: C.muted, cursor: uploading ? 'wait' : 'pointer',
                    fontSize: '0.76rem',
                  }}>{uploading ? '… uploading' : '📎 Attach'}</button>
                <button onClick={() => setIsPPV(p => !p)}
                  style={{
                    background: isPPV ? 'var(--v3-terracotta)' : 'none',
                    border: `1px solid ${isPPV ? 'var(--v3-terracotta)' : C.border}`,
                    borderRadius: 6, padding: '5px 10px', cursor: 'pointer',
                    color: isPPV ? '#fff' : C.muted, fontSize: '0.76rem', fontWeight: 600,
                  }}>🔒 PPV</button>
                {isPPV && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: '0.78rem', color: C.muted }}>$</span>
                    <input type="number" min="0.99" step="0.01" value={ppvPrice}
                      onChange={e => setPpvPrice(e.target.value)}
                      style={{
                        width: 70, padding: '5px 8px', border: `1px solid ${C.border}`,
                        borderRadius: 6, background: C.inputBg, color: C.text,
                        fontSize: '0.8rem', outline: 'none',
                      }} />
                  </div>
                )}
              </div>

              {/* Zone 3 — send row */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
                  placeholder={isPPV ? 'PPV caption (optional)…' : 'Message…'} rows={1}
                  style={{
                    flex: 1, padding: '10px 14px', resize: 'none',
                    border: `1px solid ${C.border}`, borderRadius: 18,
                    background: C.inputBg, color: C.text, fontSize: '0.88rem',
                    outline: 'none', lineHeight: 1.45, maxHeight: 120, fontFamily: 'inherit',
                  }} />
                <button onClick={send} disabled={!canSend()}
                  style={{
                    width: 38, height: 38, borderRadius: '50%', border: 'none',
                    background: canSend() ? 'var(--v3-terracotta)' : C.border,
                    color: '#fff', cursor: canSend() ? 'pointer' : 'not-allowed',
                    fontSize: '1rem', flexShrink: 0,
                  }}>↑</button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default AdminMessages;
