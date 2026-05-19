import { useEffect, useRef, useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { getChatHistory, SERVER_URL, CREATOR_SLUG, getCreator } from '../api';
import MobileBottomNav from '../components/MobileBottomNav';
import TipModal from '../components/TipModal';
import FanSidebar from '../components/FanSidebar';
import PayMethodPicker from '../components/PayMethodPicker';

const fullUrl = (p?: string | null) => {
  if (!p) return '';
  if (p.startsWith('http')) return p;
  return p.startsWith('/') ? `${SERVER_URL}${p}` : `${SERVER_URL}/${p}`;
};

const fmtTime = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const fmtDateDivider = (iso?: string) => {
  if (!iso) return '';
  const d = new Date(iso);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return `Today at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  if (isYesterday) return `Yesterday at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

const Chat = ({ config }: { config: any }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [creatorId, setCreatorId] = useState<number | null>(null);
  const [tipOpen, setTipOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<{
    msgId: number;
    amount: number;
    title: string;
  } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string[]>([]);
  const navigate = useNavigate();

  const fanToken = typeof window !== 'undefined' ? localStorage.getItem('fanToken') : null;
  const avatar = config?.chatAvatarUrl || config?.images?.hero || config?.images?.heroSlider?.[0] || config?.logoUrl;
  const creatorName = config?.siteTitle || 'CRISTINA';

  useEffect(() => {
    if (!fanToken) { navigate('/login'); return; }

    getChatHistory(CREATOR_SLUG).then((msgs) => {
      setMessages(Array.isArray(msgs) ? msgs : []);
      setLoading(false);
      if (Array.isArray(msgs) && msgs.length > 0 && msgs[0].creatorId) {
        setCreatorId(msgs[0].creatorId);
      } else {
        getCreator().then((c: any) => { if (c?.id) setCreatorId(c.id); }).catch(() => {});
      }
    });

    const socket = io(SERVER_URL, { auth: { token: fanToken } });
    socketRef.current = socket;
    socket.on('new_message', (msg) => {
      if (msg.senderType === 'fan' && pendingRef.current.length > 0) {
        const tempId = pendingRef.current.shift();
        setMessages(prev => prev.map(m => m.id === tempId ? msg : m));
      } else {
        setMessages(prev => [...prev, msg]);
      }
    });
    socket.on('creator_typing', () => {
      setIsTyping(true);
      setTimeout(() => setIsTyping(false), 2000);
    });
    return () => { socket.disconnect(); };
  }, [fanToken, navigate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const send = () => {
    if (!input.trim() || !socketRef.current) return;
    const content = input.trim();
    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, senderType: 'fan', content, sentAt: new Date().toISOString(), isPPV: false, isUnlocked: true };
    pendingRef.current.push(tempId);
    setMessages(prev => [...prev, optimistic]);
    socketRef.current.emit('fan_message', { creatorSlug: CREATOR_SLUG, content });
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleUnlock = (msgId: number) => {
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;
    const amount = parseFloat(msg.ppvPrice || 0);
    const title = msg.collection?.title || (msg.collectionId ? 'Bundle' : 'PPV message');
    setPayTarget({ msgId, amount, title });
  };

  const onPaySuccess = async () => {
    if (!payTarget) return;
    // Refresh chat history so unlocked content shows up
    const fresh = await getChatHistory(CREATOR_SLUG);
    setMessages(Array.isArray(fresh) ? fresh : []);
    setPayTarget(null);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--v3-rose-grad)' }}>
        <p style={{ color: 'var(--v3-ink-soft)', letterSpacing: 2 }}>Loading…</p>
      </div>
    );
  }

  // ── Shared message rendering ───────────────────────────────
  const renderMessages = () => (
    <>
      {messages.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--v3-ink-soft)', marginTop: 40, padding: '0 20px' }}>
          <p style={{ fontSize: '2rem', margin: '0 0 6px' }}>💬</p>
          <h3 style={{ fontFamily: 'var(--v3-heading)', fontSize: '1.15rem', color: 'var(--v3-ink)', margin: '0 0 6px' }}>
            Start a conversation with {creatorName}
          </h3>
          <p style={{ fontSize: '0.86rem', margin: 0, lineHeight: 1.5 }}>
            Replies are personal — no bots, no scripts. Tell her what you're into.
          </p>
        </div>
      )}

      {messages.map((msg, idx) => {
        const fromFan = msg.senderType === 'fan';
        const locked = msg.isPPV && !msg.isUnlocked;
        const mediaAbs = fullUrl(msg.mediaUrl);
        const isVideo = mediaAbs && /\.(mp4|mov|webm)$/i.test(mediaAbs);
        const isBundle = !!msg.collectionId;
        const bundlePosts: any[] = (msg.collection?.posts || []) as any[];

        const prev = messages[idx - 1];
        const next = messages[idx + 1];
        const prevTime = prev?.sentAt ? new Date(prev.sentAt).getTime() : 0;
        const thisTime = msg.sentAt ? new Date(msg.sentAt).getTime() : 0;
        // Date divider when >60min gap or first message of the day
        const showDivider = !prev || (thisTime - prevTime) > 60 * 60 * 1000;
        // After a divider, treat as "new burst" — break grouping
        const sameAsPrev = !showDivider && prev && prev.senderType === msg.senderType;
        const sameAsNext = next && next.senderType === msg.senderType
          && (new Date(next.sentAt).getTime() - thisTime) <= 60 * 60 * 1000;
        const showAvatar = !fromFan && !sameAsNext;
        // Inline tiny timestamp only on the LAST message in a burst
        const showTime = !sameAsNext;

        return (
          <Fragment key={msg.id}>
            {showDivider && msg.sentAt && (
              <div className="v3-msg-divider">
                {fmtDateDivider(msg.sentAt)}
              </div>
            )}
          <div className={`v3-msg-row ${fromFan ? 'fan' : 'creator'} ${sameAsPrev ? 'group-tight' : ''}`}>
            {!fromFan && (
              showAvatar
                ? <div className="avatar-sm">{avatar && <img src={fullUrl(avatar)} alt="" />}</div>
                : <div className="avatar-sm spacer" aria-hidden="true" />
            )}
            <div className="v3-msg-col">
              <div className={`v3-bubble ${fromFan ? 'fan' : 'creator'}`}>
                {locked ? (
                  <div style={{
                    position: 'relative',
                    minWidth: 180, minHeight: 130,
                    borderRadius: 12, overflow: 'hidden',
                    background: '#bbb',
                    backgroundImage: mediaAbs ? `url("${mediaAbs}")` : 'none',
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: 14,
                  }}>
                    {mediaAbs && <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(14px)' }}/>}
                    <div style={{ position: 'relative', textAlign: 'center', color: '#fff' }}>
                      <p style={{ fontSize: '1.3rem', margin: '0 0 4px' }}>{isBundle ? '📦' : '🔒'}</p>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>
                        {isBundle ? (msg.collection?.title || 'Bundle') : 'Exclusive content'}
                      </p>
                      {isBundle && bundlePosts.length > 0 && (
                        <p style={{ fontSize: '0.72rem', margin: '2px 0 0', opacity: 0.8 }}>{bundlePosts.length} items</p>
                      )}
                      <p style={{ fontSize: '0.78rem', margin: '4px 0 10px', opacity: 0.9 }}>${parseFloat(msg.ppvPrice).toFixed(2)}</p>
                      <button onClick={() => handleUnlock(msg.id)}
                        style={{
                          background: '#fff', color: 'var(--v3-terracotta)',
                          border: 'none', borderRadius: 50, padding: '8px 16px',
                          fontWeight: 700, fontSize: '0.78rem',
                          cursor: 'pointer', letterSpacing: 0.5,
                        }}>
                        {isBundle ? 'Unlock Bundle' : 'Unlock Now'}
                      </button>
                    </div>
                  </div>
                ) : isBundle && bundlePosts.length > 0 ? (
                  <div>
                    {msg.content && <p style={{ margin: '0 0 8px' }}>{msg.content}</p>}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 6 }}>
                      {bundlePosts.map((p: any) => {
                        const url = fullUrl(p.imageUrl || p.videoUrl);
                        const video = url && /\.(mp4|mov|webm)$/i.test(url);
                        return (
                          <div key={p.id} style={{ borderRadius: 8, overflow: 'hidden', background: '#222', aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)' }}>
                            {!url ? (
                              <span style={{ fontSize: '1.5rem' }}>📷</span>
                            ) : video ? (
                              <video src={url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <>
                    {mediaAbs && (
                      isVideo
                        ? <video src={mediaAbs} controls style={{ width: '100%', borderRadius: 14, display: 'block', marginBottom: msg.content ? 8 : 0 }} />
                        : <img src={mediaAbs} alt="" style={{ width: '100%', borderRadius: 14, display: 'block', marginBottom: msg.content ? 8 : 0 }} />
                    )}
                    {msg.content}
                  </>
                )}
              </div>
              {showTime && <span className="v3-msg-time">{fmtTime(msg.sentAt)}</span>}
            </div>
          </div>
          </Fragment>
        );
      })}

      {isTyping && (
        <div className="v3-msg-row creator">
          <div className="avatar-sm">{avatar && <img src={fullUrl(avatar)} alt="" />}</div>
          <div className="v3-bubble creator" style={{ padding: '8px 14px' }}>
            <span style={{ letterSpacing: 3, fontSize: '1.2rem' }}>···</span>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </>
  );

  const renderComposer = () => (
    <div className="v3-composer">
      <button className="icon-btn" type="button" aria-label="Emoji">☺</button>
      <button className="icon-btn" type="button" aria-label="Attach">＋</button>
      <button className="icon-btn" type="button" aria-label="Tip"
        onClick={() => creatorId && setTipOpen(true)}
        disabled={!creatorId}
        title="Send a tip">💰</button>
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Type your message…"
      />
      <button className="send-btn" onClick={send} disabled={!input.trim()} aria-label="Send">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      </button>
    </div>
  );

  const renderHeader = () => (
    <div className="v3-chat-header">
      <div className="v3-chat-avatar" style={{ position: 'relative' }}>
        {avatar && <img src={fullUrl(avatar)} alt="" />}
        <span style={{
          position: 'absolute', bottom: 0, right: 0,
          width: 12, height: 12, borderRadius: '50%',
          background: '#3ec46d', border: '2px solid #fff',
        }} />
      </div>
      <div>
        <h2 className="v3-chat-title">
          {creatorName}
          <span className="v3-verified" style={{ marginLeft: 6, fontSize: '0.85rem', verticalAlign: 'middle' }}>✓</span>
        </h2>
        <p className="v3-chat-status">
          <span style={{ color: '#3ec46d', marginRight: 4 }}>●</span>
          Active now
        </p>
      </div>
    </div>
  );

  // ── DESKTOP shell ──────────────────────────────────────────
  const DesktopShell = (
    <div className="v3-chat-shell">
      <FanSidebar creator={config} />

      <main className="v3-chat-main">
        {renderHeader()}
        <div className="v3-chat-area">
          {renderMessages()}
        </div>
        {renderComposer()}
      </main>
    </div>
  );

  // ── MOBILE layout — preserved ──────────────────────────────
  const MobileLayout = (
    <div className="v3-mobile v3-chat-mobile">
      {renderHeader()}
      <div className="v3-chat-area">
        {renderMessages()}
      </div>
      {renderComposer()}
      <MobileBottomNav />
    </div>
  );

  return (
    <>
      {MobileLayout}
      {DesktopShell}
      {tipOpen && creatorId && (
        <TipModal
          creatorId={creatorId}
          creatorName={creatorName}
          onClose={() => setTipOpen(false)}
          onSuccess={(amt) => {
            // Drop a local-only system bubble so the fan sees confirmation
            setMessages(prev => [...prev, {
              id: `tip-${Date.now()}`,
              senderType: 'fan',
              content: `💰 Sent a $${amt} tip`,
              sentAt: new Date().toISOString(),
              isUnlocked: true,
            }]);
          }}
        />
      )}
      {payTarget && (
        <PayMethodPicker
          productType="ppv_message"
          productId={payTarget.msgId}
          amount={payTarget.amount}
          title={payTarget.title}
          returnPath="/chat"
          onClose={() => setPayTarget(null)}
          onSuccess={onPaySuccess}
        />
      )}
    </>
  );
};

export default Chat;
