import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CREATOR_SLUG, SERVER_URL,
  getPosts, getPublicCollections, getChatHistory, getCreator,
  getMyTransactions, getWallet,
} from '../api';
import MobileBottomNav from '../components/MobileBottomNav';
import FanSidebar from '../components/FanSidebar';
import WalletCard from '../components/WalletCard';

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
  const [transactions, setTransactions] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notifsOpen, setNotifsOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!notifsOpen) return;
    const close = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setNotifsOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [notifsOpen]);

  useEffect(() => {
    if (!localStorage.getItem('fanToken')) { navigate('/login'); return; }
    (async () => {
      const [c, p, b, m, t, w] = await Promise.all([
        getCreator().catch(() => null),
        getPosts(CREATOR_SLUG).catch(() => ({ posts: [] })),
        getPublicCollections(CREATOR_SLUG).catch(() => []),
        getChatHistory(CREATOR_SLUG).catch(() => []),
        getMyTransactions().catch(() => []),
        getWallet().catch(() => ({ balance: 0 })),
      ]);
      setCreator(c);
      setPosts(p?.posts || []);
      setBundles(Array.isArray(b) ? b : []);
      setMessages(Array.isArray(m) ? m : []);
      setTransactions(Array.isArray(t) ? t : []);
      setWalletBalance(Number(w?.balance || 0));
      setLoading(false);
    })();
  }, [navigate]);

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
  const avatar = creator?.chatAvatarUrl || creator?.images?.hero || creator?.images?.heroSlider?.[0] || creator?.logoUrl;
  const tagline = creator?.homeBio?.split('.')[0] || 'Welcome to my private space.';

  const postsUnlocked = posts.filter(p => !p.isLocked).length;
  const bundlesOwned = bundles.filter(b => b.isUnlocked).length;
  const ppvReceived = messages.filter(m => m.senderType === 'creator' && m.isPPV).length;
  const totalSpent = transactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0);

  const latestCreatorMsg = [...messages].reverse().find(m => m.senderType === 'creator');
  const lockedBundles = bundles.filter(b => !b.isUnlocked);
  const latestPosts = posts.slice(0, 6);

  // ── Purchase history rows (resolved against current state) ──
  const titleForTxn = (t: any) => {
    if (t.collectionId) {
      const b = bundles.find(x => x.id === t.collectionId);
      return b?.title || `Bundle #${t.collectionId}`;
    }
    if (t.postId) {
      const p = posts.find(x => x.id === t.postId);
      return p?.title || p?.caption?.slice(0, 40) || `Post #${t.postId}`;
    }
    if (t.messageId) return 'PPV message';
    if (t.type === 'tip') return 'Tip sent';
    return 'Unlock';
  };
  const typeLabel = (t: any) => {
    if (t.type === 'tip') return 'Tip';
    if (t.collectionId) return 'Bundle';
    if (t.messageId) return 'PPV';
    if (t.postId) return 'Post';
    return t.type || 'Purchase';
  };
  const purchaseRows = [...transactions]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 10)
    .map(t => ({
      id: t.id,
      date: t.createdAt,
      type: typeLabel(t),
      title: titleForTxn(t),
      amount: parseFloat(t.amount || 0),
    }));

  // ── Unread + notification count (proper, no `|| 1`) ──
  const unreadFromCreator = messages.filter(m => m.senderType === 'creator' && !m.isRead).length;

  // Notifications: unread creator messages (newest first), capped to 6
  const notifications = [...messages]
    .filter(m => m.senderType === 'creator')
    .sort((a, b) => new Date(b.sentAt || 0).getTime() - new Date(a.sentAt || 0).getTime())
    .slice(0, 6)
    .map(m => ({
      id: m.id,
      preview: m.isPPV ? '🔒 Sent you a PPV message' : (m.content || '📎 Sent media'),
      time: m.sentAt,
      unread: !m.isRead,
    }));

  // ── DESKTOP shell ──────────────────────────────────────────
  const DesktopShell = (
    <div className="v3-fan-shell">
      <FanSidebar creator={creator} />

      <main className="v3-fan-main">
        {/* Top bar */}
        <div className="v3-fan-top">
          <div>
            <h1>Hi, {firstName}! ✨</h1>
            <p className="sub">{tagline}</p>
          </div>
          <div className="right">
            <div ref={bellRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setNotifsOpen(o => !o)}
                className="bell"
                title="Notifications"
                style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: 0, fontFamily: 'inherit', color: 'inherit' }}>
                🔔
                {unreadFromCreator > 0 && <span className="dot">{unreadFromCreator}</span>}
              </button>
              {notifsOpen && (
                <div style={{
                  position: 'absolute', top: 36, right: 0, width: 320, zIndex: 100,
                  background: '#fff', borderRadius: 14, boxShadow: '0 10px 36px rgba(0,0,0,0.14)',
                  border: '1px solid var(--v3-rose-100)', overflow: 'hidden',
                }}>
                  <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--v3-rose-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <strong style={{ fontSize: '0.92rem' }}>Notifications</strong>
                    {unreadFromCreator > 0 && (
                      <span style={{ fontSize: '0.72rem', color: 'var(--v3-muted)' }}>
                        {unreadFromCreator} new
                      </span>
                    )}
                  </div>
                  <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <p style={{ padding: '20px 14px', textAlign: 'center', color: 'var(--v3-muted)', fontSize: '0.86rem', margin: 0 }}>
                        You're all caught up 🎉
                      </p>
                    ) : (
                      notifications.map(n => (
                        <Link key={n.id} to="/chat"
                          onClick={() => setNotifsOpen(false)}
                          style={{
                            display: 'flex', gap: 10, padding: '10px 14px',
                            textDecoration: 'none', color: 'inherit',
                            background: n.unread ? 'var(--v3-rose-50)' : 'transparent',
                            borderBottom: '1px solid var(--v3-rose-50)',
                          }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--v3-rose-100)' }}>
                            {avatar && <img src={fullUrl(avatar)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ margin: 0, fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', fontWeight: n.unread ? 600 : 400 }}>
                              {n.preview}
                            </p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: 'var(--v3-muted)' }}>
                              {fmtTime(n.time)} · {creatorName}
                            </p>
                          </div>
                          {n.unread && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--v3-terracotta)', marginTop: 6, flexShrink: 0 }} />}
                        </Link>
                      ))
                    )}
                  </div>
                  <Link to="/chat" onClick={() => setNotifsOpen(false)}
                    style={{ display: 'block', padding: '10px 14px', textAlign: 'center', fontSize: '0.84rem', fontWeight: 700, color: 'var(--v3-terracotta)', textDecoration: 'none', borderTop: '1px solid var(--v3-rose-100)', background: 'var(--v3-cream)' }}>
                    View all messages →
                  </Link>
                </div>
              )}
            </div>
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

        {/* Wallet */}
        <WalletCard
          balance={walletBalance}
          onDeposited={async () => {
            const w = await getWallet().catch(() => ({ balance: 0 }));
            setWalletBalance(Number(w?.balance || 0));
          }}
        />

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
            <span className="label">Collections Unlocked</span>
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

        {/* Purchase History */}
        <div className="v3-card" style={{ marginTop: 18 }}>
          <div className="v3-card-head">
            <h3>My Purchases</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--v3-muted)' }}>
              {purchaseRows.length > 0 ? `Last ${purchaseRows.length}` : ''}
            </span>
          </div>
          {purchaseRows.length === 0 ? (
            <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem', margin: '8px 0 0' }}>
              Nothing yet — your unlocks will show up here.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: 'var(--v3-muted)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: 1 }}>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Date</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Type</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600 }}>Item</th>
                    <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {purchaseRows.map(r => (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--v3-rose-100)' }}>
                      <td style={{ padding: '10px 6px', color: 'var(--v3-ink-soft)' }}>
                        {r.date ? new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '10px 6px' }}>
                        <span style={{ background: 'var(--v3-rose-100)', color: 'var(--v3-terracotta)', padding: '2px 8px', borderRadius: 12, fontSize: '0.74rem', fontWeight: 700 }}>
                          {r.type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 6px', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 280, whiteSpace: 'nowrap' }}>{r.title}</td>
                      <td style={{ padding: '10px 6px', textAlign: 'right', fontWeight: 700 }}>${r.amount.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Two-column body */}
        <div className="v3-fan-cols" style={{ marginTop: 18 }}>
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

        {/* Quick link to full account settings */}
        <Link to="/dashboard/settings" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px', marginTop: 18, borderRadius: 14,
          background: '#fff', border: '1px solid var(--v3-rose-100)',
          textDecoration: 'none', color: 'var(--v3-ink)',
        }}>
          <span style={{ fontSize: '1.4rem' }}>⚙️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Account & Settings</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--v3-muted)' }}>
              Profile, password, payment cards, subscriptions, transaction history
            </div>
          </div>
          <span style={{ color: 'var(--v3-muted)' }}>→</span>
        </Link>
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

      <WalletCard
        balance={walletBalance}
        onDeposited={async () => {
          const w = await getWallet().catch(() => ({ balance: 0 }));
          setWalletBalance(Number(w?.balance || 0));
        }}
      />

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
          <div className="item"><span className="val">{bundlesOwned}</span><span className="label">Collections<br/>Unlocked</span></div>
          <div className="item"><span className="val">{ppvReceived}</span><span className="label">PPV<br/>Messages</span></div>
          <div className="item"><span className="val">${totalSpent.toFixed(0)}</span><span className="label">Total<br/>Spent</span></div>
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
