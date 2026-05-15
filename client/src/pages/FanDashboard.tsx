import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CREATOR_SLUG, SERVER_URL,
  getPosts, getPublicCollections, getChatHistory, getCreator,
} from '../api';
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

const FanDashboard = () => {
  const navigate = useNavigate();
  const fanUser = JSON.parse(localStorage.getItem('fanUser') || 'null');

  const [creator, setCreator] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('fanToken')) { navigate('/login'); return; }

    (async () => {
      const [c, p, b, m] = await Promise.all([
        getCreator().catch(() => null),
        getPosts(CREATOR_SLUG).catch(() => ({ posts: [] })),
        getPublicCollections(CREATOR_SLUG).catch(() => []),
        getChatHistory(CREATOR_SLUG).catch(() => []),
      ]);
      setCreator(c);
      setPosts(p?.posts || []);
      setBundles(Array.isArray(b) ? b : []);
      setMessages(Array.isArray(m) ? m : []);
      setLoading(false);
    })();
  }, [navigate]);

  if (loading) {
    return (
      <div className="v3-dash" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p style={{ color: 'var(--v3-ink-soft)' }}>Loading…</p>
      </div>
    );
  }

  // ── Derived data ───────────────────────────────────────────
  const firstName = (fanUser?.username || 'there').split(/\s+/)[0];
  const creatorName = creator?.siteTitle || 'Creator';
  const avatar = creator?.images?.hero || creator?.images?.heroSlider?.[0];
  const tagline = creator?.homeBio?.split('.')[0] || 'Curating a beautiful life, with you.';

  // Stats derived from existing data (no extra endpoints needed)
  const postsUnlocked = posts.filter(p => !p.isLocked).length;
  const bundlesOwned = bundles.filter(b => b.isUnlocked).length;
  const ppvReceived = messages.filter(m => m.senderType === 'creator' && m.isPPV).length;

  // Most recent creator message
  const latestCreatorMsg = [...messages].reverse().find(m => m.senderType === 'creator');

  // Locked bundles (not yet unlocked) for the horizontal row
  const lockedBundles = bundles.filter(b => !b.isUnlocked);
  const latestPosts = posts.slice(0, 6);

  return (
    <div className="v3-dash">
      {/* Header */}
      <div className="v3-dash-header">
        <div className="avatar">
          {avatar && <img src={fullUrl(avatar)} alt="" />}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1>Hi, {firstName}!</h1>
          <p className="creator-line">
            {creatorName}
            <span className="v3-verified">✓</span>
          </p>
          <p className="tagline">{tagline}</p>
        </div>
      </div>

      {/* Primary CTA — Message creator */}
      <Link to="/chat" className="v3-dash-cta">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
        <span>Message {creatorName} Directly</span>
      </Link>

      {/* Quick Stats */}
      <section className="v3-dash-section">
        <h3>Quick Stats</h3>
        <div className="v3-dash-stats">
          <div className="item">
            <span className="val">{postsUnlocked}</span>
            <span className="label">Posts<br/>Unlocked</span>
          </div>
          <div className="item">
            <span className="val">{bundlesOwned}</span>
            <span className="label">Bundles<br/>Owned</span>
          </div>
          <div className="item">
            <span className="val">{ppvReceived}</span>
            <span className="label">PPV Messages<br/>Received</span>
          </div>
        </div>
      </section>

      {/* Locked bundles */}
      {lockedBundles.length > 0 && (
        <section className="v3-dash-section">
          <h3>
            Locked Content Bundles
            <Link to="/vault" className="chevron" aria-label="See all">›</Link>
          </h3>
          <div className="v3-bundle-row">
            {lockedBundles.map(b => {
              const art = b.thumbs?.[0];
              return (
                <div key={b.id} className="v3-bundle-card">
                  <div className="lock">🔒</div>
                  <div className="art" style={{ backgroundImage: art ? `url("${fullUrl(art)}")` : undefined, filter: 'blur(4px) brightness(0.9)' }} />
                  <p className="title">{b.title}</p>
                  <p className="price">${parseFloat(b.price).toFixed(0)}</p>
                  <button onClick={() => navigate('/vault')}>Unlock Bundle</button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Latest content */}
      {latestPosts.length > 0 && (
        <section className="v3-dash-section">
          <h3>Latest Content</h3>
          <div className="v3-latest-grid">
            {latestPosts.map(p => {
              const thumb = p.mediaUrls?.[0];
              const locked = p.isLocked;
              const price = parseFloat(p.price || 0);
              return (
                <Link key={p.id} to="/vault" className={`v3-latest-tile ${locked ? 'locked' : ''}`}>
                  <div className="bg" style={{ background: thumb ? `url("${fullUrl(thumb)}") center/cover` : '#e8d5c4' }} />
                  {!locked && <span className="pill">FREE</span>}
                  <span className="heart">♡</span>
                  {locked && (
                    <>
                      <span className="lock-icon">🔒</span>
                      <button className="unlock" onClick={(e) => { e.preventDefault(); navigate('/vault'); }}>
                        <span className="amt">${price > 0 ? price.toFixed(0) : '?'}</span>
                        <span>Unlock</span>
                      </button>
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Recent message preview */}
      {latestCreatorMsg && (
        <Link to="/chat" className="v3-dash-msg" style={{ textDecoration: 'none' }}>
          <div className="avatar">
            {avatar && <img src={fullUrl(avatar)} alt="" />}
          </div>
          <div className="text">
            {latestCreatorMsg.isPPV
              ? '🔒 Sent you a PPV message — tap to view'
              : (latestCreatorMsg.content || '📎 Sent media')}
          </div>
          <span className="time">{fmtTime(latestCreatorMsg.sentAt)}</span>
        </Link>
      )}

      <MobileBottomNav />
    </div>
  );
};

export default FanDashboard;
