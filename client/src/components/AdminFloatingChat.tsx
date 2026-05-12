import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SERVER_URL, CREATOR_SLUG, getCreatorInbox, getThreadWithFan, sendBlast } from '../api';

interface ChatWindow {
  fanId: number;
  fanName: string;
  messages: any[];
  minimized: boolean;
  input: string;
  isPPV: boolean;
  ppvPrice: string;
}

const AdminFloatingChat = ({ isDark }: { isDark: boolean }) => {
  const [panelOpen, setPanelOpen]   = useState(false);
  const [inbox, setInbox]           = useState<any[]>([]);
  const [windows, setWindows]       = useState<ChatWindow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [blastContent, setBlastContent] = useState('');
  const [blastPPV, setBlastPPV]     = useState(false);
  const [blastPrice, setBlastPrice] = useState('4.99');
  const [blastStatus, setBlastStatus] = useState('');
  const socketRef   = useRef<Socket | null>(null);
  const scrollRefs  = useRef<Map<number, HTMLDivElement>>(new Map());

  const bg     = isDark ? '#111'    : '#fff';
  const text   = isDark ? '#eee'    : '#111';
  const muted  = isDark ? '#555'    : '#999';
  const border = isDark ? '#222'    : '#e5e5e5';
  const msgFan = isDark ? '#1e1e1e' : '#f0f0f0';
  const inBg   = isDark ? '#0d0d0d' : '#f8f8f8';
  const shadow = isDark ? '0 8px 30px rgba(0,0,0,0.6)' : '0 8px 30px rgba(0,0,0,0.14)';

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;
    const s = io(SERVER_URL, { auth: { token } });
    socketRef.current = s;
    s.on('new_message', (msg: any) => {
      const fromId = msg.fromUserId ?? msg.userId;
      setWindows(prev => {
        const idx = prev.findIndex(w => w.fanId === fromId);
        if (idx < 0) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], messages: [...updated[idx].messages, msg] };
        return updated;
      });
      setUnreadCount(n => n + 1);
    });
    return () => s.disconnect();
  }, []);

  useEffect(() => { fetchInbox(); }, []);

  useEffect(() => {
    windows.forEach(w => {
      const el = scrollRefs.current.get(w.fanId);
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, [windows]);

  const fetchInbox = async () => {
    try {
      const data = await getCreatorInbox(CREATOR_SLUG);
      const list = Array.isArray(data) ? data : [];
      setInbox(list);
      setUnreadCount(list.reduce((s: number, i: any) => s + (i.unread || 0), 0));
    } catch {}
  };

  const openWindow = async (item: any) => {
    const fanId   = item.fan?.id ?? item.fanId;
    const fanName = item.fan?.username ?? 'Fan';
    setPanelOpen(false);
    const existing = windows.find(w => w.fanId === fanId);
    if (existing) {
      setWindows(prev => prev.map(w => w.fanId === fanId ? { ...w, minimized: false } : w));
      return;
    }
    if (windows.length >= 3) setWindows(prev => prev.slice(1));
    try {
      const msgs = await getThreadWithFan(CREATOR_SLUG, fanId);
      setWindows(prev => [...prev, {
        fanId, fanName,
        messages: Array.isArray(msgs) ? msgs : [],
        minimized: false, input: '', isPPV: false, ppvPrice: '4.99',
      }]);
    } catch {
      setWindows(prev => [...prev, {
        fanId, fanName, messages: [], minimized: false, input: '', isPPV: false, ppvPrice: '4.99',
      }]);
    }
    setInbox(prev => prev.map(i => (i.fan?.id ?? i.fanId) === fanId ? { ...i, unread: 0 } : i));
    setUnreadCount(prev => Math.max(0, prev - (item.unread || 0)));
  };

  const closeWindow = (fanId: number) => {
    setWindows(prev => prev.filter(w => w.fanId !== fanId));
    scrollRefs.current.delete(fanId);
  };

  const patchWindow = (fanId: number, patch: Partial<ChatWindow>) =>
    setWindows(prev => prev.map(w => w.fanId === fanId ? { ...w, ...patch } : w));

  const sendReply = (w: ChatWindow) => {
    if (!socketRef.current || (!w.input.trim() && !w.isPPV)) return;
    const payload: any = { fanId: w.fanId, content: w.input.trim(), isPPV: w.isPPV };
    if (w.isPPV) payload.ppvPrice = parseFloat(w.ppvPrice) || 4.99;
    socketRef.current.emit('creator_reply', payload);
    patchWindow(w.fanId, {
      input: '',
      messages: [...w.messages, {
        id: Date.now(), senderType: 'creator', content: w.input.trim(),
        isPPV: w.isPPV, ppvPrice: w.ppvPrice, isUnlocked: true,
      }],
    });
  };

  const handleBlast = async () => {
    if (!blastContent.trim() && !blastPPV) { setBlastStatus('Enter a message'); return; }
    setBlastStatus('Sending…');
    const res = await sendBlast(CREATOR_SLUG, blastContent, blastPPV, parseFloat(blastPrice) || 4.99);
    if (res.success) {
      setBlastStatus(`Sent to ${res.sent}`);
      setBlastContent('');
      setTimeout(() => setBlastStatus(''), 3000);
    } else {
      setBlastStatus(res.error || 'Failed');
    }
  };

  const FAB_SIZE  = 52;
  const WIN_WIDTH = 280;
  const WIN_HEIGHT = 380;
  const GAP       = 10;
  const EDGE      = 20;

  return (
    <>
      {/* Individual chat windows — stack left of FAB */}
      {windows.map((w, idx) => {
        const right = EDGE + FAB_SIZE + GAP + idx * (WIN_WIDTH + GAP);
        return (
          <div key={w.fanId} style={{
            position: 'fixed', bottom: EDGE, right,
            width: WIN_WIDTH, height: w.minimized ? 44 : WIN_HEIGHT,
            background: bg, borderRadius: 12, boxShadow: shadow,
            border: `1px solid ${border}`, zIndex: 999,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', transition: 'height 0.2s ease',
          }}>
            {/* Window header */}
            <div onClick={() => patchWindow(w.fanId, { minimized: !w.minimized })} style={{
              padding: '10px 12px', background: '#7c3aed', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0, userSelect: 'none',
            }}>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#fff' }}>{w.fanName}</span>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem' }}>
                  {w.minimized ? '▲' : '▼'}
                </span>
                <span onClick={e => { e.stopPropagation(); closeWindow(w.fanId); }}
                  style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', cursor: 'pointer', lineHeight: 1 }}>✕</span>
              </div>
            </div>

            {!w.minimized && (
              <>
                {/* Messages */}
                <div ref={el => { if (el) scrollRefs.current.set(w.fanId, el); }}
                  style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {w.messages.length === 0 ? (
                    <p style={{ color: muted, fontSize: '0.78rem', textAlign: 'center', marginTop: 24 }}>No messages yet.</p>
                  ) : w.messages.map((msg, i) => {
                    const mine = msg.senderType === 'creator';
                    return (
                      <div key={msg.id ?? i} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
                        <div style={{
                          maxWidth: '80%', padding: '6px 10px', fontSize: '0.8rem', lineHeight: 1.45,
                          borderRadius: mine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                          background: mine ? '#7c3aed' : msgFan, color: mine ? '#fff' : text,
                          wordBreak: 'break-word',
                        }}>
                          {msg.isPPV && !msg.isUnlocked
                            ? `🔒 PPV — $${parseFloat(msg.ppvPrice || '0').toFixed(2)}`
                            : msg.content}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Input */}
                <div style={{ padding: '8px 10px', borderTop: `1px solid ${border}`, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <button onClick={() => patchWindow(w.fanId, { isPPV: !w.isPPV })} style={{
                      background: w.isPPV ? '#7c3aed' : 'none',
                      border: `1px solid ${w.isPPV ? '#7c3aed' : border}`,
                      borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                      color: w.isPPV ? '#fff' : muted, fontSize: '0.7rem', fontWeight: 600,
                    }}>🔒 PPV</button>
                    {w.isPPV && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: '0.7rem', color: muted }}>$</span>
                        <input type="number" min="0.99" step="0.01" value={w.ppvPrice}
                          onChange={e => patchWindow(w.fanId, { ppvPrice: e.target.value })}
                          style={{
                            width: 55, padding: '3px 6px', border: `1px solid ${border}`,
                            borderRadius: 6, background: inBg, color: text, fontSize: '0.76rem', outline: 'none',
                          }} />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={w.input} onChange={e => patchWindow(w.fanId, { input: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') sendReply(w); }}
                      placeholder={w.isPPV ? 'PPV caption…' : 'Reply…'}
                      style={{
                        flex: 1, padding: '6px 10px', border: `1px solid ${border}`,
                        borderRadius: 16, background: inBg, color: text, fontSize: '0.8rem', outline: 'none',
                      }} />
                    <button onClick={() => sendReply(w)}
                      disabled={!w.input.trim() && !w.isPPV}
                      style={{
                        width: 30, height: 30, borderRadius: '50%', border: 'none', flexShrink: 0,
                        background: w.input.trim() || w.isPPV ? '#7c3aed' : border,
                        color: '#fff', cursor: 'pointer', fontSize: '0.85rem',
                      }}>↑</button>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Inbox panel */}
      {panelOpen && (
        <div style={{
          position: 'fixed', bottom: EDGE + FAB_SIZE + 10, right: EDGE,
          width: 300, maxHeight: 480,
          background: bg, borderRadius: 12, boxShadow: shadow,
          border: `1px solid ${border}`, zIndex: 1000,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '13px 16px', borderBottom: `1px solid ${border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: text }}>Messages</span>
            <button onClick={fetchInbox} style={{ background: 'none', border: 'none', color: muted, cursor: 'pointer', fontSize: '0.85rem' }}>↻</button>
          </div>

          {/* Mass DM */}
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${border}` }}>
            <p style={{ margin: '0 0 7px', fontSize: '0.68rem', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: muted }}>Mass DM</p>
            <textarea value={blastContent} onChange={e => setBlastContent(e.target.value)}
              placeholder="Message all subscribers…" rows={2}
              style={{
                width: '100%', resize: 'none', padding: '7px 10px',
                border: `1px solid ${border}`, borderRadius: 8, background: inBg,
                color: text, fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box',
              }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
              <button onClick={() => setBlastPPV(!blastPPV)} style={{
                background: blastPPV ? '#7c3aed' : 'none', border: `1px solid ${blastPPV ? '#7c3aed' : border}`,
                borderRadius: 6, padding: '3px 8px', cursor: 'pointer',
                color: blastPPV ? '#fff' : muted, fontSize: '0.7rem',
              }}>🔒 PPV</button>
              {blastPPV && (
                <input type="number" min="0.99" step="0.01" value={blastPrice}
                  onChange={e => setBlastPrice(e.target.value)}
                  style={{ width: 60, padding: '3px 6px', border: `1px solid ${border}`, borderRadius: 6, background: inBg, color: text, fontSize: '0.76rem', outline: 'none' }} />
              )}
              <button onClick={handleBlast} style={{
                marginLeft: 'auto', background: '#7c3aed', border: 'none', borderRadius: 6,
                padding: '5px 14px', color: '#fff', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 600,
              }}>Send</button>
            </div>
            {blastStatus && <p style={{ margin: '5px 0 0', fontSize: '0.72rem', color: blastStatus.includes('Sent') ? '#4ade80' : '#f87171' }}>{blastStatus}</p>}
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {inbox.length === 0 ? (
              <p style={{ padding: '14px 16px', color: muted, fontSize: '0.82rem' }}>No conversations yet.</p>
            ) : inbox.map(item => {
              const fanId = item.fan?.id ?? item.fanId;
              return (
                <div key={fanId} onClick={() => openWindow(item)}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: `1px solid ${border}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = isDark ? '#1a1a1a' : '#f5f5f5')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: text }}>
                      {item.fan?.username ?? 'Fan'}
                    </span>
                    {item.unread > 0 && (
                      <span style={{ background: '#7c3aed', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: '0.64rem', fontWeight: 700 }}>
                        {item.unread}
                      </span>
                    )}
                  </div>
                  <p style={{ margin: 0, fontSize: '0.74rem', color: muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.isPPV ? '🔒 PPV message' : (item.content || '…')}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* FAB button */}
      <button onClick={() => setPanelOpen(o => !o)}
        style={{
          position: 'fixed', bottom: EDGE, right: EDGE,
          width: FAB_SIZE, height: FAB_SIZE, borderRadius: '50%',
          background: '#7c3aed', border: 'none', cursor: 'pointer',
          boxShadow: '0 4px 18px rgba(124,58,237,0.45)', zIndex: 1001,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.25rem',
        }}>
        💬
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            background: '#ef4444', color: '#fff', borderRadius: '50%',
            width: 18, height: 18, fontSize: '0.62rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `2px solid ${bg}`,
          }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>
    </>
  );
};

export default AdminFloatingChat;
