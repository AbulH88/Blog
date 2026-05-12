import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { getChatHistory, unlockMessage, SERVER_URL, CREATOR_SLUG } from '../api';

const Chat = ({ config }: { config: any }) => {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fanToken = localStorage.getItem('fanToken');

  useEffect(() => {
    if (!fanToken) { navigate('/login'); return; }

    // Load history
    getChatHistory(CREATOR_SLUG).then(msgs => {
      setMessages(Array.isArray(msgs) ? msgs : []);
      setLoading(false);
    });

    // Socket connection
    const socket = io(SERVER_URL, { auth: { token: fanToken } });
    socketRef.current = socket;

    socket.on('new_message', (msg) => {
      setMessages(prev => [...prev, msg]);
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

  const sendMessage = () => {
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.emit('fan_message', { creatorSlug: CREATOR_SLUG, content: input.trim() });
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleUnlock = async (msgId: number) => {
    const res = await unlockMessage(msgId);
    if (res.success) {
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, isUnlocked: true, content: res.message.content } : m));
    }
  };

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 70px)', paddingTop: 70 }}>

      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 14, background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(10px)' }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', overflow: 'hidden' }}>
          {config?.images?.hero
            ? <img src={`${SERVER_URL}${config.images.hero}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : '✦'}
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.95rem' }}>{config?.heroTitle}</p>
          <p style={{ margin: 0, fontSize: '0.72rem', color: '#4ade80' }}>● Online</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#555' }}>
            <p style={{ fontSize: '1.5rem', margin: '0 0 8px' }}>👋</p>
            <p style={{ fontSize: '0.85rem' }}>Say hi to {config?.heroTitle}!</p>
          </div>
        )}

        {messages.map((msg) => {
          const isFromFan = msg.senderType === 'fan';
          return (
            <div key={msg.id} style={{ display: 'flex', justifyContent: isFromFan ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '72%',
                padding: msg.isPPV && !msg.isUnlocked ? '14px 18px' : '10px 14px',
                borderRadius: isFromFan ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                background: isFromFan ? 'var(--primary)' : '#1a1a1a',
                color: isFromFan ? 'var(--bg)' : 'var(--primary)',
                fontSize: '0.9rem',
                lineHeight: 1.5,
              }}>
                {msg.isPPV && !msg.isUnlocked ? (
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ margin: '0 0 10px', fontSize: '1.3rem' }}>🔒</p>
                    <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#aaa' }}>
                      Pay ${parseFloat(msg.ppvPrice).toFixed(2)} to unlock this message
                    </p>
                    <button
                      onClick={() => handleUnlock(msg.id)}
                      className="btn btn-primary"
                      style={{ padding: '8px 20px', fontSize: '0.8rem' }}
                    >
                      Unlock — ${parseFloat(msg.ppvPrice).toFixed(2)}
                    </button>
                  </div>
                ) : (
                  <>{msg.content}</>
                )}
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{ padding: '10px 16px', background: '#1a1a1a', borderRadius: '18px 18px 18px 4px' }}>
              <span style={{ fontSize: '1.2rem', letterSpacing: 2 }}>···</span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #1a1a1a', display: 'flex', gap: 10, background: 'rgba(10,10,10,0.95)' }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message ${config?.heroTitle}…`}
          rows={1}
          style={{
            flex: 1, padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a',
            borderRadius: 20, color: '#fff', fontSize: '0.9rem', resize: 'none', outline: 'none',
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          style={{
            width: 42, height: 42, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: input.trim() ? 'var(--primary)' : '#1a1a1a',
            color: input.trim() ? 'var(--bg)' : '#555',
            fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, transition: 'background 0.2s',
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
};

export default Chat;
