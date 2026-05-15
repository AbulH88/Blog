import { useState, useEffect, useRef } from 'react';
import {
  SERVER_URL, CREATOR_SLUG,
  sendBlast, uploadImage, getCreatorAnalytics,
} from '../api';

const mediaUrlAbs = (u?: string | null) => {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  return u.startsWith('/') ? `${SERVER_URL}${u}` : `${SERVER_URL}/${u}`;
};

const AdminBroadcast = ({ isDark }: { isDark: boolean }) => {
  const [content, setContent] = useState('');
  const [isPPV, setIsPPV] = useState(false);
  const [ppvPrice, setPpvPrice] = useState('4.99');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);

  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    getCreatorAnalytics()
      .then(a => setSubscriberCount(a?.subscribers?.active ?? 0))
      .catch(() => setSubscriberCount(null));
  }, []);

  const handleAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const res = await uploadImage(file);
    setUploading(false);
    if (res.url) setMediaUrl(res.url);
    e.target.value = '';
  };

  const canSend = !sending && !uploading && (
    isPPV
      ? (!!content.trim() || !!mediaUrl) && parseFloat(ppvPrice) > 0
      : (!!content.trim() || !!mediaUrl)
  );

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setStatus(null);
    const res = await sendBlast(
      CREATOR_SLUG,
      content.trim(),
      isPPV,
      parseFloat(ppvPrice) || 0,
      mediaUrl,
    );
    setSending(false);
    if (res?.success) {
      setStatus({ kind: 'ok', text: `Sent to ${res.sent} subscriber${res.sent === 1 ? '' : 's'}` });
      setContent('');
      setMediaUrl(null);
      setIsPPV(false);
      setPpvPrice('4.99');
      setTimeout(() => setStatus(null), 5000);
    } else {
      setStatus({ kind: 'err', text: res?.error || 'Broadcast failed' });
    }
  };

  const C = {
    text:    'var(--v3-ink)',
    muted:   'var(--v3-ink-soft)',
    faint:   'var(--v3-muted)',
    border:  'var(--v3-line)',
    inputBg: '#FFFAF4',
  };
  void isDark;

  return (
    <div style={{ maxWidth: 640 }}>
      <div className="av2-card">
        <p className="av2-section-label">Broadcast to all subscribers</p>
        <p style={{ margin: '0 0 16px', fontSize: '0.82rem', color: C.muted }}>
          {subscriberCount === null
            ? 'Loading subscriber count…'
            : `${subscriberCount} active subscriber${subscriberCount === 1 ? '' : 's'} will receive this`}
        </p>

        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Write your message…"
          rows={5}
          className="av2-input"
          style={{ resize: 'vertical', marginBottom: 14, fontFamily: 'inherit' }}
        />

        {/* Media attach + preview */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleAttach} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{
              background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
              padding: '7px 14px', color: C.muted, cursor: uploading ? 'wait' : 'pointer',
              fontSize: '0.78rem',
            }}>{uploading ? '… uploading' : '📎 Attach media'}</button>

          {mediaUrl && (
            <div style={{ position: 'relative' }}>
              {mediaUrl.match(/\.(mp4|mov|webm)$/i) ? (
                <video src={mediaUrlAbs(mediaUrl)} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, background: '#000' }} />
              ) : (
                <img src={mediaUrlAbs(mediaUrl)} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />
              )}
              <button onClick={() => setMediaUrl(null)}
                style={{
                  position: 'absolute', top: -6, right: -6, width: 22, height: 22,
                  borderRadius: '50%', background: '#000', color: '#fff', border: 'none',
                  cursor: 'pointer', fontSize: '0.72rem',
                }}>✕</button>
            </div>
          )}
        </div>

        {/* PPV */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <button onClick={() => setIsPPV(p => !p)}
            style={{
              background: isPPV ? 'var(--v3-terracotta)' : 'none',
              border: `1px solid ${isPPV ? 'var(--v3-terracotta)' : C.border}`,
              borderRadius: 6, padding: '6px 14px', cursor: 'pointer',
              color: isPPV ? '#fff' : C.muted, fontSize: '0.78rem', fontWeight: 600,
            }}>🔒 PPV</button>
          {isPPV && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.82rem', color: C.muted }}>Unlock $</span>
              <input type="number" min="0.99" step="0.01" value={ppvPrice}
                onChange={e => setPpvPrice(e.target.value)}
                className="av2-input"
                style={{ width: 90, marginBottom: 0 }} />
            </div>
          )}
        </div>

        <button
          onClick={handleSend}
          disabled={!canSend}
          className="btn btn-primary"
          style={{
            width: '100%', padding: '14px',
            fontSize: '0.88rem', letterSpacing: 1,
            background: canSend ? 'var(--v3-terracotta)' : C.border,
            opacity: canSend ? 1 : 0.6, cursor: canSend ? 'pointer' : 'not-allowed',
          }}
        >
          {sending ? 'Sending…' : 'Send Broadcast'}
        </button>

        {status && (
          <p style={{
            margin: '14px 0 0', fontSize: '0.85rem', fontWeight: 600,
            color: status.kind === 'ok' ? '#4ade80' : '#f87171',
          }}>
            {status.text}
          </p>
        )}
      </div>

      {/* Recent broadcasts — deferred (TODO: backend endpoint /api/chat/:slug/blasts) */}
    </div>
  );
};

export default AdminBroadcast;
