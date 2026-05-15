import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getPosts, CREATOR_SLUG, SERVER_URL,
  getPublicCollections, unlockCollection,
  unlockPost,
} from '../api';
import MobileBottomNav from '../components/MobileBottomNav';
import JoinPremiumModal from '../components/JoinPremiumModal';

const fullUrl = (p: string) => (p?.startsWith('http') ? p : `${SERVER_URL}${p}`);

const Vault = ({ config }: { config: any }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [bundles, setBundles] = useState<any[]>([]);
  const [unlockingId, setUnlockingId] = useState<number | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const navigate = useNavigate();

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
    setUnlockingId(bundleId);
    const res = await unlockCollection(bundleId);
    setUnlockingId(null);
    if (res?.success) await refresh();
    else alert(res?.error || 'Unlock failed');
  };

  const handleUnlockPost = async (postId: number) => {
    if (!isLoggedIn) { setJoinOpen(true); return; }
    setUnlockingId(postId);
    const res = await unlockPost(postId);
    setUnlockingId(null);
    if (res?.success) await refresh();
    else alert(res?.error || 'Unlock failed');
  };

  const handle = (config?.links?.instagram?.split('/').filter(Boolean).pop()) || (config?.siteTitle?.toLowerCase() || 'cristina') + '_official';
  const avatar = config?.images?.hero || config?.images?.heroSlider?.[0];
  const tagline = config?.homeBio || 'Fashion | Travel | Lifestyle ✨ | Sharing my unfiltered life! Unseen content & more…';

  // Mixed feed: standalone posts only (bundled posts shown via bundle card)
  const standalone = posts.filter(p => !p.collectionId);

  return (
    <div className="v3-vault">
      {/* Header */}
      <div className="v3-vault-header">
        <div className="v3-vault-avatar">
          {avatar && <img src={fullUrl(avatar)} alt="" />}
        </div>
        <div style={{ minWidth: 0 }}>
          <h2 className="v3-vault-name">
            {(config?.siteTitle || 'CRISTINA').toUpperCase()}
            <span className="v3-verified" title="Verified">✓</span>
          </h2>
          <p className="v3-vault-handle">@{handle}</p>
          <p className="v3-vault-tagline">{tagline}</p>
        </div>
      </div>

      {/* Bundles strip */}
      {bundles.length > 0 && (
        <div className="v3-vault-card">
          <h2 className="v3-vault-h2" style={{ marginTop: 0 }}>BUNDLES</h2>
          <div className="v3-lock-grid">
            {bundles.slice(0, 6).map(b => {
              const unlocked = b.isUnlocked;
              const bg = b.thumbs?.[0];
              return (
                <div key={`b-${b.id}`}>
                  <div className={`v3-lock-tile ${unlocked ? 'unlocked' : ''}`}>
                    <div className="bg" style={{ backgroundImage: bg ? `url("${fullUrl(bg)}")` : 'none' }} />
                    {!unlocked && <div className="overlay" />}
                    {!unlocked
                      ? <><span className="icon">🔒</span><span className="label">LOCK</span></>
                      : <span className="icon" style={{ background: 'rgba(255,255,255,0.6)', padding: '2px 8px', borderRadius: 6, fontSize: '0.7rem', fontWeight: 700 }}>✓ Unlocked</span>}
                    <span className="type">📦 {b.postCount}</span>
                  </div>
                  <p className="v3-lock-tile-caption">
                    {b.title}<br/>
                    <span style={{ color: 'var(--v3-terracotta)', fontWeight: 700 }}>${parseFloat(b.price).toFixed(2)}</span>
                  </p>
                  {!unlocked && (
                    <button
                      disabled={unlockingId === b.id}
                      onClick={() => handleUnlockBundle(b.id)}
                      style={{
                        marginTop: 4, width: '100%',
                        padding: '6px 8px', borderRadius: 16,
                        border: 'none', cursor: 'pointer',
                        background: 'var(--v3-terracotta)', color: '#fff',
                        fontSize: '0.66rem', fontWeight: 700, letterSpacing: 0.6,
                        opacity: unlockingId === b.id ? 0.6 : 1,
                      }}>
                      {unlockingId === b.id ? 'Unlocking…' : 'Unlock'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Locked vault */}
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
          <div className="v3-lock-grid">
            {standalone.slice(0, 12).map(p => {
              const locked = !!p.isLocked;
              const thumb = p.mediaUrls?.[0];
              const isVideo = p.mediaType === 'video';
              const price = parseFloat(p.price || 0);
              return (
                <div key={p.id}>
                  <div className={`v3-lock-tile ${!locked ? 'unlocked' : ''}`}>
                    <div className="bg" style={{ backgroundImage: thumb ? `url("${fullUrl(thumb)}")` : 'none' }} />
                    {locked && <div className="overlay" />}
                    {locked && (
                      <>
                        <span className="icon">🔒</span>
                        <span className="label">LOCK</span>
                      </>
                    )}
                    <span className="type">
                      {locked ? (price > 0 ? `$${price.toFixed(2)}` : '🔒') : (isVideo ? '🎬 Video' : '📷 Free')}
                    </span>
                  </div>
                  <p className="v3-lock-tile-caption">{p.title || p.caption?.slice(0, 28) || 'Untitled'}</p>
                  {locked && price > 0 && (
                    <button
                      disabled={unlockingId === p.id}
                      onClick={() => handleUnlockPost(p.id)}
                      style={{
                        marginTop: 4, width: '100%',
                        padding: '6px 8px', borderRadius: 16,
                        border: 'none', cursor: 'pointer',
                        background: 'var(--v3-gold)', color: '#fff',
                        fontSize: '0.68rem', fontWeight: 700, letterSpacing: 0.6,
                        opacity: unlockingId === p.id ? 0.6 : 1,
                      }}>
                      {unlockingId === p.id ? 'Unlocking…' : `Unlock $${price.toFixed(2)}`}
                    </button>
                  )}
                </div>
              );
            })}
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
            <span>💬 MESSAGE {(config?.siteTitle || 'CRISTINA').toUpperCase()} DIRECTLY</span>
            <span>→</span>
          </Link>
        )}
      </div>

      {/* Quick actions */}
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

      <MobileBottomNav />

      <JoinPremiumModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        fanvueUrl={config?.fanvueUrl}
        creatorName={config?.siteTitle}
      />
    </div>
  );
};

export default Vault;
