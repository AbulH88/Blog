import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { getChatHistory, unlockMessage, SERVER_URL, CREATOR_SLUG } from '../api';
import MobileBottomNav from '../components/MobileBottomNav';

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

const Chat = ({ config }: { config: any }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const fanToken = typeof window !== 'undefined' ? localStorage.getItem('fanToken') : null;
  const fanUser = JSON.parse(localStorage.getItem('fanUser') || 'null');
  const avatar = config?.images?.hero || config?.images?.heroSlider?.[0];
  const creatorName = config?.siteTitle || 'CRISTINA';

  useEffect(() => {
    if (!fanToken) { navigate('/login'); return; }

    getChatHistory(CREATOR_SLUG).then((msgs) => {
      setMessages(Array.isArray(msgs) ? msgs : []);
      setLoading(false);
    });

    const socket = io(SERVER_URL, { auth: { token: fanToken } });
    socketRef.current = socket;
    socket.on('new_message', (msg) => setMessages((prev) => [...prev, msg]));
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
    socketRef.current.emit('fan_message', { creatorSlug: CREATOR_SLUG, content: input.trim() });
    setInput('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const handleUnlock = async (msgId: number) => {
    const res = await unlockMessage(msgId);
    if (res?.success) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isUnlocked: true, content: res.message.content } : m));
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('fanToken');
    localStorage.removeItem('fanUser');
    navigate('/');
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
        <p style={{ textAlign: 'center', color: 'var(--v3-ink-soft)', marginTop: 30, fontSize: '0.9rem' }}>
          Say hi to {creatorName} 👋
        </p>
      )}

      {messages.map((msg) => {
        const fromFan = msg.senderType === 'fan';
        const locked = msg.isPPV && !msg.isUnlocked;
        const mediaAbs = fullUrl(msg.mediaUrl);
        const isVideo = mediaAbs && /\.(mp4|mov|webm)$/i.test(mediaAbs);

        return (
          <div key={msg.id} className={`v3-msg-row ${fromFan ? 'fan' : 'creator'}`}>
            {!fromFan && (
              <div className="avatar-sm">{avatar && <img src={fullUrl(avatar)} alt="" />}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '78%' }}>
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
                      <p style={{ fontSize: '1.3rem', margin: '0 0 4px' }}>🔒</p>
                      <p style={{ fontSize: '0.85rem', fontWeight: 600, margin: 0 }}>Exclusive content</p>
                      <p style={{ fontSize: '0.78rem', margin: '0 0 10px', opacity: 0.9 }}>${parseFloat(msg.ppvPrice).toFixed(2)}</p>
                      <button onClick={() => handleUnlock(msg.id)}
                        style={{
                          background: '#fff', color: 'var(--v3-terracotta)',
                          border: 'none', borderRadius: 50, padding: '8px 16px',
                          fontWeight: 700, fontSize: '0.78rem',
                          cursor: 'pointer', letterSpacing: 0.5,
                        }}>
                        Unlock Now
                      </button>
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
              <span className="v3-msg-time">{fmtTime(msg.sentAt)}</span>
            </div>
          </div>
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
      <div className="v3-chat-avatar">
        {avatar && <img src={fullUrl(avatar)} alt="" />}
      </div>
      <div>
        <h2 className="v3-chat-title">
          {creatorName.toUpperCase()}
          <span className="v3-verified" style={{ marginLeft: 8, verticalAlign: 'middle' }}>✓</span>
        </h2>
        <p className="v3-chat-status">Online ✨ | Replies within a few hours.</p>
      </div>
    </div>
  );

  // ── DESKTOP shell ──────────────────────────────────────────
  const DesktopShell = (
    <div className="v3-chat-shell">
      <aside className="v3-fan-side">
        <div className="v3-fan-brand">
          {config?.logoUrl ? (
            <img src={fullUrl(config.logoUrl)} alt={creatorName} />
          ) : (
            <>{creatorName.toUpperCase()}<small>FAN ACCOUNT</small></>
          )}
        </div>

        <div className="v3-fan-profile">
          <div className="avatar">
            {avatar && <img src={fullUrl(avatar)} alt={creatorName} />}
          </div>
          <div className="handle">@{fanUser?.username || 'fan'}</div>
          <div className="role">Following</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <Link to="/dashboard" className="v3-fan-nav-btn">
            <span style={{ width: 20, textAlign: 'center' }}>🏠</span><span>Dashboard</span>
          </Link>
          <Link to="/vault" className="v3-fan-nav-btn">
            <span style={{ width: 20, textAlign: 'center' }}>💎</span><span>The Vault</span>
          </Link>
          <Link to="/chat"
            className={`v3-fan-nav-btn ${location.pathname === '/chat' ? 'active' : ''}`}>
            <span style={{ width: 20, textAlign: 'center' }}>💬</span><span>Messages</span>
          </Link>
          <Link to="/gallery" className="v3-fan-nav-btn">
            <span style={{ width: 20, textAlign: 'center' }}>🖼</span><span>Gallery</span>
          </Link>
          <Link to="/blog" className="v3-fan-nav-btn">
            <span style={{ width: 20, textAlign: 'center' }}>📓</span><span>Journal</span>
          </Link>
          <Link to="/about" className="v3-fan-nav-btn">
            <span style={{ width: 20, textAlign: 'center' }}>✨</span><span>About</span>
          </Link>
        </nav>

        <div className="v3-fan-side-footer">
          <Link to="/">View Site ↗</Link>
          <button onClick={handleSignOut}
            style={{ background: 'none', border: 'none', color: 'var(--v3-muted)' }}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="v3-chat-main">
        {renderHeader()}
        <h2 className="v3-chat-h2">CHAT WITH {creatorName.toUpperCase()}</h2>
        <div className="v3-chat-area" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
      <h2 className="v3-chat-h2">CHAT WITH {creatorName.toUpperCase()}</h2>
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
    </>
  );
};

export default Chat;
