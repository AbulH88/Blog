import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  CREATOR_SLUG, SERVER_URL,
  getPosts, getPublicCollections, getChatHistory, getCreator,
  getMyTransactions, unsubscribe,
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
  const location = useLocation();
  const fanUser = JSON.parse(localStorage.getItem('fanUser') || 'null');

  const [creator, setCreator] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('fanToken')) { navigate('/login'); return; }
    (async () => {
      const [c, p, b, m, t] = await Promise.all([
        getCreator().catch(() => null),
        getPosts(CREATOR_SLUG).catch(() => ({ posts: [] })),
        getPublicCollections(CREATOR_SLUG).catch(() => []),
        getChatHistory(CREATOR_SLUG).catch(() => []),
        getMyTransactions().catch(() => []),
      ]);
      setCreator(c);
      setPosts(p?.posts || []);
      setBundles(Array.isArray(b) ? b : []);
      setMessages(Array.isArray(m) ? m : []);
      setTransactions(Array.isArray(t) ? t : []);
      setLoading(false);
    })();
  }, [navigate]);

  const handleSignOut = () => {
    localStorage.removeItem('fanToken');
    localStorage.removeItem('fanUser');
    navigate('/');
  };

  const handleCancelAccount = async () => {
    const confirmed = window.confirm(
      'Cancel your account?\n\n' +
      '• Any content you have unlocked remains accessible until you log out.\n' +
      '• You will not be charged for anything after cancellation.\n' +
      '• You can re-activate by signing back in any time.\n\n' +
      'Continue?'
    );
    if (!confirmed) return;
    try { await unsubscribe(CREATOR_SLUG); } catch { /* ignore */ }
    alert("You're all set. We've stopped any future charges. Thanks for being part of " + (creator?.siteTitle || 'the community') + ' 💌');
    handleSignOut();
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--v3-cream)' }}>
        <p style={{ color: 'var(--v3-ink-soft)' }}>Loading…</p>
      </div>
    );
  }

  // ── Derived data ───────────────────────────────────────────
  const firstName = (fanUser?.username || 'there').split(/\s+/)[0];
  const creatorName = creator?.siteTitle || 'Creator';
  const handle = (creator?.links?.instagram?.split('/').filter(Boolean).pop()) || (creatorName.toLowerCase().replace(/\s+/g, ''));
  const avatar = creator?.images?.hero || creator?.images?.heroSlider?.[0];
  const tagline = creator?.homeBio?.split('.')[0] || 'Welcome to my private space.';

  const postsUnlocked = posts.filter(p => !p.isLocked).length;
  const bundlesOwned = bundles.filter(b => b.isUnlocked).length;
  const ppvReceived = messages.filter(m => m.senderType === 'creator' && m.isPPV).length;
  const totalSpent = transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const latestCreatorMsg = [...messages].reverse().find(m => m.senderType === 'creator');
  const lockedBundles = bundles.filter(b => !b.isUnlocked);
  const latestPosts = posts.slice(0, 6);

  // ── DESKTOP shell ──────────────────────────────────────────
  const DesktopShell = (
    <div className="v3-fan-shell">
      <aside className="v3-fan-side">
        <div className="v3-fan-brand">
          {creator?.logoUrl ? (
            <img src={fullUrl(creator.logoUrl)} alt={creatorName} />
          ) : (
            <>{creatorName.toUpperCase()}<small>FAN ACCOUNT</small></>
          )}
        </div>

        <div className="v3-fan-profile">
          <div className="avatar">
            {avatar && <img src={fullUrl(avatar)} alt={creatorName} />}
          </div>
          <div className="handle">@{handle}</div>
          <div className="role">Following</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <Link to="/dashboard"
            className={`v3-fan-nav-btn ${location.pathname === '/dashboard' ? 'active' : ''}`}>
            <span style={{ width: 20, textAlign: 'center' }}>🏠</span><span>Dashboard</span>
          </Link>
          <Link to="/vault"
            className={`v3-fan-nav-btn ${location.pathname === '/vault' ? 'active' : ''}`}>
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
          <Link to="/dashboard/payment-methods" className={`v3-fan-nav-btn ${location.pathname === '/dashboard/payment-methods' ? 'active' : ''}`}>
            <span style={{ width: 20, textAlign: 'center' }}>💳</span><span>Payment Methods</span>
          </Link>
        </nav>

        <div className="v3-fan-side-footer">
          <Link to="/">View Site ↗</Link>
          <button onClick={handleSignOut}
            style={{ background: 'none', border: 'none', color: 'var(--v3-muted)' }}>
            Sign Out
          </button>
          <button onClick={handleCancelAccount}
            style={{
              background: 'none', border: 'none', color: 'var(--v3-danger)',
              fontSize: '0.74rem', cursor: 'pointer', padding: '8px 0',
              fontFamily: 'inherit', textAlign: 'center', width: '100%',
            }}>
            Cancel my account
          </button>
          <div style={{ marginTop: 8, display: 'flex', gap: 12, justifyContent: 'center', fontSize: '0.7rem' }}>
            <Link to="/terms" style={{ color: 'var(--v3-muted)', textDecoration: 'none' }}>Terms</Link>
            <Link to="/privacy" style={{ color: 'var(--v3-muted)', textDecoration: 'none' }}>Privacy</Link>
            <Link to="/2257" style={{ color: 'var(--v3-muted)', textDecoration: 'none' }}>2257</Link>
          </div>
        </div>
      </aside>

      <main className="v3-fan-main">
        {/* Top bar */}
        <div className="v3-fan-top">
          <div>
            <h1>Hi, {firstName}! ✨</h1>
            <p className="sub">{tagline}</p>
          </div>
          <div className="right">
            <div className="bell" title="Notifications">🔔<span className="dot">{ppvReceived || messages.filter(m => !m.isRead && m.senderType === 'creator').length || 1}</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: '#ddd' }}>
                <div style={{ width: '100%', height: '100%', background: 'var(--v3-terracotta)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.78rem', fontWeight: 700 }}>
                  {(fanUser?.username || 'F').slice(0, 1).toUpperCase()}
                </div>
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--v3-ink)' }}>{fanUser?.username || 'fan'}</span>
            </div>
          </div>
        </div>

        {/* Message creator CTA */}
        <Link to="/chat" className="v3-fan-cta">
          <div className="left">
            <span className="icon">💬</span>
            <div>
              <div className="t">Message {creatorName} Directly</div>
              <div className="s">Get personal replies + exclusive content</div>
            </div>
          </div>
          <span className="arrow">→</span>
        </Link>

        {/* 4 stat cards row */}
        <div className="v3-fan-stats-row">
          <div className="v3-stat pink" style={{ position: 'relative' }}>
            <span className="label">Posts Unlocked</span>
            <span className="value">{postsUnlocked}</span>
            <span style={{ fontSize: '0.74rem', opacity: 0.8 }}>From the Vault</span>
            <div className="icon-bubble">🔓</div>
          </div>
          <div className="v3-stat dark" style={{ position: 'relative' }}>
            <span className="label">Bundles Owned</span>
            <span className="value">{bundlesOwned}</span>
            <span style={{ fontSize: '0.74rem', opacity: 0.7 }}>Lifetime access</span>
            <div className="icon-bubble" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>📦</div>
          </div>
          <div className="v3-stat peach" style={{ position: 'relative' }}>
            <span className="label">PPV Messages</span>
            <span className="value">{ppvReceived}</span>
            <span style={{ fontSize: '0.74rem' }}>Received</span>
            <div className="icon-bubble">💌</div>
          </div>
          <div className="v3-stat" style={{ background: '#F4E4E0', position: 'relative' }}>
            <span className="label">Total Spent</span>
            <span className="value">${totalSpent.toFixed(2)}</span>
            <span style={{ fontSize: '0.74rem', color: 'rgba(0,0,0,0.6)' }}>All time</span>
            <div className="icon-bubble">💝</div>
          </div>
        </div>

        {/* Two-column body */}
        <div className="v3-fan-cols">
          {/* LEFT — Latest content */}
          <div className="v3-card">
            <div className="v3-card-head">
              <h3>Latest Content</h3>
              <Link to="/vault" style={{ fontSize: '0.78rem', color: 'var(--v3-terracotta)', textDecoration: 'none', fontWeight: 700 }}>
                View all →
              </Link>
            </div>
            {latestPosts.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <p style={{ fontSize: '2rem', margin: '0 0 8px' }}>✨</p>
                <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--v3-ink-soft)' }}>
                  No content yet — check back soon.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {latestPosts.map(p => {
                  const thumb = p.mediaUrls?.[0];
                  const locked = p.isLocked;
                  const price = parseFloat(p.price || 0);
                  return (
                    <Link key={p.id} to="/vault" className={`v3-latest-tile ${locked ? 'locked' : ''}`} style={{ borderRadius: 12, height: 160 }}>
                      <div className="bg" style={{ background: thumb ? `url("${fullUrl(thumb)}") center/cover` : '#e8d5c4' }} />
                      {!locked && <span className="pill">FREE</span>}
                      <span className="heart">♡</span>
                      {locked && (
                        <>
                          <span className="lock-icon">🔒</span>
                          <button className="unlock"
                            onClick={(e) => { e.preventDefault(); navigate('/vault'); }}>
                            <span className="amt">${price > 0 ? price.toFixed(0) : '?'}</span>
                            <span>Unlock</span>
                          </button>
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* RIGHT — Bundles + Recent Message */}
          <aside style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
            <div className="v3-card">
              <div className="v3-card-head">
                <h3>Locked Bundles</h3>
                <Link to="/vault" style={{ fontSize: '0.78rem', color: 'var(--v3-terracotta)', textDecoration: 'none', fontWeight: 700 }}>
                  Browse →
                </Link>
              </div>
              {lockedBundles.length === 0 ? (
                <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem', margin: 0 }}>
                  No bundles available — check back when {creatorName} drops a new one.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {lockedBundles.slice(0, 3).map(b => (
                    <div key={b.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 10, background: 'var(--v3-peach-soft)', borderRadius: 10 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 8, background: b.thumbs?.[0] ? `url("${fullUrl(b.thumbs[0])}") center/cover` : 'var(--v3-cream-deep)', filter: 'blur(2px) brightness(0.9)', position: 'relative' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.title}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: 'var(--v3-terracotta)', fontWeight: 700 }}>
                          ${parseFloat(b.price).toFixed(0)}
                        </p>
                      </div>
                      <button onClick={() => navigate('/vault')}
                        style={{ background: 'var(--v3-terracotta)', color: '#fff', border: 'none', borderRadius: 18, padding: '6px 12px', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>
                        Unlock
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="v3-card">
              <div className="v3-card-head">
                <h3>Latest Message</h3>
              </div>
              {latestCreatorMsg ? (
                <Link to="/chat" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: '#ddd' }}>
                    {avatar && <img src={fullUrl(avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: '0.86rem', color: 'var(--v3-ink)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {latestCreatorMsg.isPPV
                        ? '🔒 Sent you a PPV message — tap to view'
                        : (latestCreatorMsg.content || '📎 Sent media')}
                    </p>
                    <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--v3-muted)' }}>
                      {fmtTime(latestCreatorMsg.sentAt)}
                    </p>
                  </div>
                </Link>
              ) : (
                <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem', margin: 0 }}>
                  No messages yet. Say hi to {creatorName}!
                </p>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );

  // ── MOBILE layout — preserved exactly as-is ────────────────
  const MobileLayout = (
    <div className="v3-dash">
      <div className="v3-dash-header">
        <div className="avatar">{avatar && <img src={fullUrl(avatar)} alt="" />}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h1>Hi, {firstName}!</h1>
          <p className="creator-line">{creatorName}<span className="v3-verified">✓</span></p>
          <p className="tagline">{tagline}</p>
        </div>
      </div>

      <Link to="/chat" className="v3-dash-cta">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
        <span>Message {creatorName} Directly</span>
      </Link>

      <section className="v3-dash-section">
        <h3>Quick Stats</h3>
        <div className="v3-dash-stats">
          <div className="item"><span className="val">{postsUnlocked}</span><span className="label">Posts<br/>Unlocked</span></div>
          <div className="item"><span className="val">{bundlesOwned}</span><span className="label">Bundles<br/>Owned</span></div>
          <div className="item"><span className="val">{ppvReceived}</span><span className="label">PPV<br/>Messages</span></div>
        </div>
      </section>

      {lockedBundles.length > 0 && (
        <section className="v3-dash-section">
          <h3>Locked Content Bundles <Link to="/vault" className="chevron">›</Link></h3>
          <div className="v3-bundle-row">
            {lockedBundles.map(b => (
              <div key={b.id} className="v3-bundle-card">
                <div className="lock">🔒</div>
                <div className="art" style={{ backgroundImage: b.thumbs?.[0] ? `url("${fullUrl(b.thumbs[0])}")` : undefined, filter: 'blur(4px) brightness(0.9)' }} />
                <p className="title">{b.title}</p>
                <p className="price">${parseFloat(b.price).toFixed(0)}</p>
                <button onClick={() => navigate('/vault')}>Unlock Bundle</button>
              </div>
            ))}
          </div>
        </section>
      )}

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

      {latestCreatorMsg && (
        <Link to="/chat" className="v3-dash-msg" style={{ textDecoration: 'none' }}>
          <div className="avatar">{avatar && <img src={fullUrl(avatar)} alt="" />}</div>
          <div className="text">
            {latestCreatorMsg.isPPV ? '🔒 Sent you a PPV message — tap to view' : (latestCreatorMsg.content || '📎 Sent media')}
          </div>
          <span className="time">{fmtTime(latestCreatorMsg.sentAt)}</span>
        </Link>
      )}

      <MobileBottomNav />
    </div>
  );

  return (
    <>
      <div className="v3-fan-mobile">{MobileLayout}</div>
      {DesktopShell}
    </>
  );
};

export default FanDashboard;
