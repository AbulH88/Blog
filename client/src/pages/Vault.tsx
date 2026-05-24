import { useEffect, useState, lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  getPosts, CREATOR_SLUG, SERVER_URL,
  getPublicCollections,
} from '../api';
import MobileBottomNav from '../components/MobileBottomNav';
import VaultTile from '../components/VaultTile';
import FanSidebar from '../components/FanSidebar';
import PayMethodPicker from '../components/PayMethodPicker';
import VerifyEmailGate from '../components/VerifyEmailGate';

// Lazy-load JoinPremiumModal so its signup pitch text + avatar never
// land in any chunk that loads on the marketing root domain. Same defense-
// in-depth pattern as Navbar — see the comment there.
const JoinPremiumModal = lazy(() => import('../components/JoinPremiumModal'));

const fullUrl = (p: string) => (p?.startsWith('http') ? p : `${SERVER_URL}${p}`);

const Vault = ({ config }: { config: any }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [joinOpen, setJoinOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<{
    type: 'post_unlock' | 'collection_unlock';
    id: number;
    amount: number;
    title: string;
  } | null>(null);
  const isLoggedIn = !!localStorage.getItem('fanToken');

  const refresh = async () => {
    const [postsData, bundleData] = await Promise.all([
      getPosts(CREATOR_SLUG),
      getPublicCollections(CREATOR_SLUG),
    ]);
    setPosts(postsData.posts || []);
    setBundles(Array.isArray(bundleData) ? bundleData : []);
  };

  useEffect(() => { refresh(); }, []);


  const handleUnlockBundle = async (bundleId: number) => {
    if (!isLoggedIn) { setJoinOpen(true); return; }
    const bundle = bundles.find(b => b.id === bundleId);
    if (!bundle) return;
    const disc = Math.min(90, Math.max(0, parseInt(bundle.discountPercent || 0, 10)));
    const amount = Number((parseFloat(bundle.price || 0) * (1 - disc / 100)).toFixed(2));
    setPayTarget({ type: 'collection_unlock', id: bundleId, amount, title: bundle.title || 'Bundle' });
  };

  const handleUnlockPost = async (postId: number) => {
    if (!isLoggedIn) { setJoinOpen(true); return; }
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const amount = parseFloat(post.price || 0);
    setPayTarget({ type: 'post_unlock', id: postId, amount, title: post.title || post.caption?.slice(0, 40) || 'Post' });
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
              unlocking={payTarget?.type === 'collection_unlock' && payTarget.id === b.id}
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
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--v3-ink-soft)' }}>
          <p style={{ fontSize: '2.4rem', margin: '0 0 8px', opacity: 0.55 }}>✨</p>
          <h3 style={{ fontFamily: 'var(--v3-heading)', fontSize: '1.3rem', color: 'var(--v3-ink)', margin: '0 0 6px' }}>
            The vault is being curated
          </h3>
          <p style={{ fontSize: '0.9rem', margin: 0, lineHeight: 1.5, maxWidth: 360, marginInline: 'auto' }}>
            New posts drop here regularly. In the meantime, say hi in the chat — that's usually where the good stuff starts.
          </p>
        </div>
      ) : (
        <div className="v3-lock-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {standalone.slice(0, 12).map(p => (
            <VaultTile
              key={p.id}
              variant="post"
              post={p}
              onUnlock={handleUnlockPost}
              unlocking={payTarget?.type === 'post_unlock' && payTarget.id === p.id}
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
      <FanSidebar creator={config} guestMode={!isLoggedIn} />

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
    <VerifyEmailGate
      title="open the Vault"
      subtitle="The Vault is exclusive content — verify your email so unlocks land on your account safely."
    >
      {MobileLayout}
      {DesktopShell}
      <Suspense fallback={null}>
        <JoinPremiumModal
          open={joinOpen}
          onClose={() => setJoinOpen(false)}
          fanvueUrl={config?.fanvueUrl}
          creatorName={creatorName}
          avatarUrl={config?.chatAvatarUrl || config?.images?.hero || config?.images?.heroSlider?.[0] || config?.logoUrl}
        />
      </Suspense>
      {payTarget && (
        <PayMethodPicker
          productType={payTarget.type}
          productId={payTarget.id}
          amount={payTarget.amount}
          title={payTarget.title}
          returnPath="/vault"
          onClose={() => setPayTarget(null)}
          onSuccess={async () => { setPayTarget(null); await refresh(); }}
        />
      )}
    </VerifyEmailGate>
  );
};

export default Vault;
