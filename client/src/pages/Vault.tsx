import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  getPosts, CREATOR_SLUG, SERVER_URL,
  getPublicCollections, unlockCollection,
  unlockPost, getPaymentMethods, chargeSavedMethod,
  type SavedCard,
} from '../api';
import MobileBottomNav from '../components/MobileBottomNav';
import JoinPremiumModal from '../components/JoinPremiumModal';
import VaultTile from '../components/VaultTile';

const fullUrl = (p: string) => (p?.startsWith('http') ? p : `${SERVER_URL}${p}`);

const Vault = ({ config }: { config: any }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [unlockingId, setUnlockingId] = useState<number | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [defaultCard, setDefaultCard] = useState<SavedCard | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const isLoggedIn = !!localStorage.getItem('fanToken');
  const fanUser = JSON.parse(localStorage.getItem('fanUser') || 'null');

  const refresh = async () => {
    const [postsData, bundleData] = await Promise.all([
      getPosts(CREATOR_SLUG),
      getPublicCollections(CREATOR_SLUG),
    ]);
    setPosts(postsData.posts || []);
    setBundles(Array.isArray(bundleData) ? bundleData : []);
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    getPaymentMethods().then(r => {
      setDefaultCard((r.methods || []).find((m: SavedCard) => m.isDefault) || null);
    }).catch(() => {});
  }, [isLoggedIn]);

  const followCheckout = (res: { success?: boolean; error?: string; redirectUrl?: string; transactionId?: number }) => {
    if (res?.redirectUrl) {
      const ret = encodeURIComponent('/vault');
      window.location.href = `${res.redirectUrl}${res.redirectUrl.includes('?') ? '&' : '?'}return=${ret}&tx=${res.transactionId}`;
      return true;
    }
    return false;
  };

  const handleUnlockBundle = async (bundleId: number, provider: string = 'mock') => {
    if (!isLoggedIn) { setJoinOpen(true); return; }
    setUnlockingId(bundleId);
    // One-tap with saved default card when available
    const res = defaultCard
      ? await chargeSavedMethod(defaultCard.id, 'collection_unlock', bundleId)
      : await unlockCollection(bundleId, provider);
    setUnlockingId(null);
    if (followCheckout(res)) return;
    if (res?.success) await refresh();
    else alert(res?.error || 'Unlock failed');
  };

  const handleUnlockPost = async (postId: number, provider: string = 'mock') => {
    if (!isLoggedIn) { setJoinOpen(true); return; }
    setUnlockingId(postId);
    const res = defaultCard
      ? await chargeSavedMethod(defaultCard.id, 'post_unlock', postId)
      : await unlockPost(postId, provider);
    setUnlockingId(null);
    if (followCheckout(res)) return;
    if (res?.success) await refresh();
    else alert(res?.error || 'Unlock failed');
  };

  const handleSignOut = () => {
    localStorage.removeItem('fanToken');
    localStorage.removeItem('fanUser');
    navigate('/');
  };

  const handle = (config?.links?.instagram?.split('/').filter(Boolean).pop()) || (config?.siteTitle?.toLowerCase() || 'cristina') + '_official';
  const avatar = config?.images?.hero || config?.images?.heroSlider?.[0];
  const tagline = config?.homeBio || 'Fashion | Travel | Lifestyle ✨ | Sharing my unfiltered life! Unseen content & more…';
  const creatorName = config?.siteTitle || 'CRISTINA';

  // Mixed feed: standalone posts only (bundled posts shown via bundle card)
  const standalone = posts.filter(p => !p.collectionId);

  // ── Shared content rendering ───────────────────────────────
  const renderHeader = () => (
    <div className="v3-vault-header">
      <div className="v3-vault-avatar">
        {avatar && <img src={fullUrl(avatar)} alt="" />}
      </div>
      <div style={{ minWidth: 0 }}>
        <h2 className="v3-vault-name">
          {creatorName.toUpperCase()}
          <span className="v3-verified" title="Verified">✓</span>
        </h2>
        <p className="v3-vault-handle">@{handle}</p>
        <p className="v3-vault-tagline">{tagline}</p>
      </div>
    </div>
  );

  const renderBundlesSection = () => (
    bundles.length > 0 && (
      <div className="v3-vault-card">
        <h2 className="v3-vault-h2" style={{ marginTop: 0 }}>BUNDLES</h2>
        <div className="v3-lock-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {bundles.slice(0, 6).map(b => (
            <VaultTile
              key={`b-${b.id}`}
              variant="bundle"
              bundle={b}
              bundlePosts={b.posts || []}
              onUnlock={handleUnlockBundle}
              unlocking={unlockingId === b.id}
            />
          ))}
        </div>
      </div>
    )
  );

  const renderVaultSection = () => (
    <div className="v3-vault-card">
      <h1 className="v3-vault-h1">EXCLUSIVE IMAGE &amp; VIDEO VAULT</h1>
      <h2 className="v3-vault-h2">UNLOCK MY PRIVATE WORLD</h2>
      <p className="v3-vault-sub">
        Some content is free — others are unlock-anytime. Enjoy what speaks to you.
      </p>

      {standalone.length === 0 ? (
        <p style={{ textAlign: 'center', color: 'var(--v3-muted)', fontSize: '0.86rem', padding: '32px 0' }}>
          No content posted yet — check back soon ✨
        </p>
      ) : (
        <div className="v3-lock-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {standalone.slice(0, 12).map(p => (
            <VaultTile
              key={p.id}
              variant="post"
              post={p}
              onUnlock={handleUnlockPost}
              unlocking={unlockingId === p.id}
            />
          ))}
        </div>
      )}

      {!isLoggedIn && (
        <button className="v3-subscribe-cta" onClick={() => setJoinOpen(true)}>
          <span>GET PREMIUM ACCESS</span>
          <span>FREE ✨</span>
        </button>
      )}

      {isLoggedIn && (
        <Link to="/chat" className="v3-subscribe-cta" style={{ textDecoration: 'none' }}>
          <span>💬 MESSAGE {creatorName.toUpperCase()} DIRECTLY</span>
          <span>→</span>
        </Link>
      )}
    </div>
  );

  const renderQuickActions = () => (
    <div className="v3-vault-actions">
      {!isLoggedIn ? (
        <Link to="/login">Login</Link>
      ) : (
        <Link to="/dashboard">My Dashboard</Link>
      )}
      {config?.links?.instagram
        ? <a href={config.links.instagram} target="_blank" rel="noreferrer">Follow on Instagram</a>
        : <a href="#">Follow on Instagram</a>}
      <Link to="/about">About Me</Link>
    </div>
  );

  // ── DESKTOP shell ──────────────────────────────────────────
  const DesktopShell = (
    <div className="v3-vault-shell">
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
          <div className="handle">@{fanUser?.username || 'guest'}</div>
          <div className="role">{isLoggedIn ? 'Following' : 'Guest'}</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <Link to="/dashboard" className="v3-fan-nav-btn">
            <span style={{ width: 20, textAlign: 'center' }}>🏠</span><span>Dashboard</span>
          </Link>
          <Link to="/vault"
            className={`v3-fan-nav-btn ${location.pathname === '/vault' ? 'active' : ''}`}>
            <span style={{ width: 20, textAlign: 'center' }}>💎</span><span>The Vault</span>
          </Link>
          <Link to="/chat" className="v3-fan-nav-btn">
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
          {isLoggedIn ? (
            <button onClick={handleSignOut}
              style={{ background: 'none', border: 'none', color: 'var(--v3-muted)' }}>
              Sign Out
            </button>
          ) : (
            <Link to="/login">Sign In</Link>
          )}
        </div>
      </aside>

      <main className="v3-vault-main">
        {renderHeader()}
        {renderBundlesSection()}
        {renderVaultSection()}
        {renderQuickActions()}
      </main>
    </div>
  );

  // ── MOBILE layout — preserved ──────────────────────────────
  const MobileLayout = (
    <div className="v3-vault v3-vault-mobile">
      {renderHeader()}
      {renderBundlesSection()}
      {renderVaultSection()}
      {renderQuickActions()}
      <MobileBottomNav />
    </div>
  );

  return (
    <>
      {MobileLayout}
      {DesktopShell}
      <JoinPremiumModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        fanvueUrl={config?.fanvueUrl}
        creatorName={creatorName}
      />
    </>
  );
};

export default Vault;
