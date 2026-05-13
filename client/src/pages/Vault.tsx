import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  getPosts, likePost, CREATOR_SLUG,
  getPublicCollections, unlockCollection, SERVER_URL,
} from '../api';
import PostCard from '../components/PostCard';

const Vault = ({ config }: { config: any }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bundles, setBundles] = useState<any[]>([]);
  const [unlockingId, setUnlockingId] = useState<number | null>(null);
  const navigate = useNavigate();

  const refresh = async () => {
    const [postsData, bundleData] = await Promise.all([
      getPosts(CREATOR_SLUG),
      getPublicCollections(CREATOR_SLUG),
    ]);
    setPosts(postsData.posts || []);
    setIsSubscribed(postsData.isSubscribed || false);
    setBundles(Array.isArray(bundleData) ? bundleData : []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const handleLike = async (id: number) => {
    await likePost(id);
    setPosts(prev => prev.map(p => p.id === id ? { ...p, likesCount: p.likesCount + 1 } : p));
  };

  const handleUnlockBundle = async (bundleId: number) => {
    if (!localStorage.getItem('fanToken')) { navigate('/login'); return; }
    setUnlockingId(bundleId);
    const res = await unlockCollection(bundleId);
    setUnlockingId(null);
    if (res?.success) {
      // Refresh both posts (gating changes) and bundles (isUnlocked flag)
      await refresh();
    } else {
      alert(res?.error || 'Unlock failed');
    }
  };

  const lockedCount = posts.filter(p => p.isLocked).length;
  const fullUrl = (p: string) => (p?.startsWith('http') ? p : `${SERVER_URL}${p}`);

  return (
    <div style={{ padding: '60px 0' }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '50px' }}>
        <h1 className="section-title">The Vault</h1>
        <p style={{ color: 'var(--secondary)', fontSize: '0.95rem', maxWidth: 480, margin: '0 auto' }}>
          {isSubscribed
            ? `You have full access. Enjoy ${posts.length} exclusive posts.`
            : `${posts.filter(p => !p.isPremium).length} free posts available. Subscribe to unlock ${lockedCount} exclusive posts.`}
        </p>

        {!isSubscribed && lockedCount > 0 && (
          <Link
            to="/vip"
            className="btn btn-primary"
            style={{ display: 'inline-block', marginTop: 20, padding: '12px 32px', fontSize: '0.9rem' }}
          >
            Unlock All Content — ${config?.subscriptionPrice}/mo
          </Link>
        )}
      </div>

      {/* Subscription banner for non-subscribers */}
      {!isSubscribed && lockedCount > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #1a1a1a, #111)',
          border: '1px solid #2a2a2a',
          borderRadius: 12,
          padding: '24px 28px',
          marginBottom: 40,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 16,
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>🔒 {lockedCount} posts locked</p>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--secondary)' }}>
              Subscribe to access the full Vault — exclusive photos, videos, and more.
            </p>
          </div>
          <Link to="/vip" className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
            Join — ${config?.subscriptionPrice}/mo
          </Link>
        </div>
      )}

      {/* Bundles */}
      {bundles.length > 0 && (
        <div style={{ marginBottom: 50 }}>
          <h2 style={{ fontSize: '1.4rem', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 18, color: 'var(--primary)' }}>
            Bundles
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
            {bundles.map(b => {
              const unlocked = b.isUnlocked || isSubscribed;
              const thumbs: string[] = b.thumbs || [];
              return (
                <div key={b.id} style={{
                  position: 'relative', background: '#111', borderRadius: 12,
                  overflow: 'hidden', border: '1px solid #1f1f1f',
                  display: 'flex', flexDirection: 'column',
                }}>
                  {/* Thumbnail mosaic */}
                  <div style={{ position: 'relative', aspectRatio: '4/3', background: '#0d0d0d' }}>
                    {thumbs.length > 0 ? (
                      <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                        {[0, 1, 2, 3].map(i => (
                          <div key={i} style={{ background: '#1a1a1a', overflow: 'hidden' }}>
                            {thumbs[i] && (
                              <img src={fullUrl(thumbs[i])} alt=""
                                style={{
                                  width: '100%', height: '100%', objectFit: 'cover',
                                  filter: unlocked ? 'none' : 'blur(18px)',
                                  transform: unlocked ? 'none' : 'scale(1.1)',
                                }} />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '2.2rem' }}>
                        📦
                      </div>
                    )}

                    {/* Lock overlay */}
                    {!unlocked && (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(180deg, rgba(0,0,0,0.3), rgba(0,0,0,0.75))',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center', gap: 14, padding: 18,
                      }}>
                        <span style={{ fontSize: '1.8rem' }}>🔒</span>
                        <button
                          disabled={unlockingId === b.id}
                          onClick={() => handleUnlockBundle(b.id)}
                          className="btn btn-primary"
                          style={{ padding: '10px 22px', fontSize: '0.82rem', letterSpacing: 1, opacity: unlockingId === b.id ? 0.6 : 1 }}>
                          {unlockingId === b.id ? 'Unlocking…' : `Unlock Bundle — $${parseFloat(b.price).toFixed(2)}`}
                        </button>
                      </div>
                    )}

                    {/* Unlocked badge */}
                    {unlocked && (
                      <span style={{
                        position: 'absolute', top: 10, right: 10,
                        background: '#4ade80', color: '#000',
                        padding: '3px 9px', borderRadius: 20,
                        fontSize: '0.62rem', letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700,
                      }}>
                        ✓ Unlocked
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>
                      {b.title}
                    </h4>
                    {b.description && (
                      <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--secondary)', lineHeight: 1.5,
                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {b.description}
                      </p>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 6, fontSize: '0.74rem', color: '#666' }}>
                      <span>{b.postCount} post{b.postCount === 1 ? '' : 's'}</span>
                      <span style={{ color: unlocked ? '#4ade80' : 'var(--primary)', fontWeight: 700 }}>
                        ${parseFloat(b.price).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Post grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--secondary)' }}>Loading…</div>
      ) : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <p style={{ fontSize: '1.5rem', marginBottom: 12 }}>✨</p>
          <p style={{ color: 'var(--secondary)' }}>No posts yet. Check back soon.</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {posts.map(post => (
            <PostCard key={post.id} post={post} onLike={handleLike} />
          ))}
        </div>
      )}
    </div>
  );
};

export default Vault;
