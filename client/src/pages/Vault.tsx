import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getPosts, likePost, CREATOR_SLUG } from '../api';
import PostCard from '../components/PostCard';

const Vault = ({ config }: { config: any }) => {
  const [posts, setPosts] = useState<any[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const data = await getPosts(CREATOR_SLUG);
      setPosts(data.posts || []);
      setIsSubscribed(data.isSubscribed || false);
      setLoading(false);
    };
    load();
  }, []);

  const handleLike = async (id: number) => {
    await likePost(id);
    setPosts(prev => prev.map(p => p.id === id ? { ...p, likesCount: p.likesCount + 1 } : p));
  };

  const lockedCount = posts.filter(p => p.isLocked).length;

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
