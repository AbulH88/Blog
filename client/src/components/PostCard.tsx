import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SERVER_URL } from '../api';

interface Post {
  id: number;
  title: string;
  caption: string;
  mediaUrls: string[];
  mediaType: 'image' | 'video' | 'audio' | 'text';
  isPremium: boolean;
  isPinned: boolean;
  isLocked: boolean;
  likesCount: number;
  createdAt: string;
}

interface Props {
  post: Post;
  onLike: (id: number) => void;
}

const fullUrl = (p: string) => p.startsWith('http') ? p : `${SERVER_URL}${p}`;

const PostCard = ({ post, onLike }: Props) => {
  const [liked, setLiked] = useState(false);
  const navigate = useNavigate();
  const thumb = post.mediaUrls[0];
  const date = new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const handleLike = () => {
    if (!localStorage.getItem('fanToken')) { navigate('/login'); return; }
    if (liked) return;
    setLiked(true);
    onLike(post.id);
  };

  return (
    <div className="post-card" style={{ position: 'relative', background: '#111', borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

      {/* Media area */}
      <div style={{ position: 'relative', aspectRatio: '4/5', overflow: 'hidden', background: '#1a1a1a' }}>
        {thumb && post.mediaType === 'image' ? (
          <img
            src={fullUrl(thumb)}
            alt={post.title}
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: post.isLocked ? 'blur(18px)' : 'none', transform: post.isLocked ? 'scale(1.1)' : 'none', transition: 'filter 0.3s' }}
          />
        ) : thumb && post.mediaType === 'video' ? (
          <video src={fullUrl(thumb)} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: post.isLocked ? 'blur(18px)' : 'none' }} muted />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '2rem' }}>
            {post.isLocked ? '🔒' : '📝'}
          </div>
        )}

        {/* Badges */}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 }}>
          {post.isPinned && (
            <span style={{ background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)', padding: '3px 8px', borderRadius: 20, fontSize: '0.65rem', letterSpacing: 1, textTransform: 'uppercase', color: '#fff' }}>Pinned</span>
          )}
          {post.isPremium && (
            <span style={{ background: post.isLocked ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.15)', backdropFilter: 'blur(6px)', padding: '3px 8px', borderRadius: 20, fontSize: '0.65rem', letterSpacing: 1, textTransform: 'uppercase', color: '#fff' }}>
              {post.isLocked ? '🔒 Members Only' : '★ Exclusive'}
            </span>
          )}
        </div>

        {/* Lock overlay */}
        {post.isLocked && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <span style={{ fontSize: '2rem' }}>🔒</span>
            <button
              onClick={() => navigate('/vip')}
              className="btn btn-primary"
              style={{ padding: '10px 20px', fontSize: '0.8rem', letterSpacing: 1 }}
            >
              Subscribe to Unlock
            </button>
          </div>
        )}
      </div>

      {/* Info area */}
      <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {post.title && <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600 }}>{post.title}</h4>}
        {post.caption && (
          <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--secondary)', lineHeight: 1.5,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {post.caption}
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: 8 }}>
          <span style={{ fontSize: '0.72rem', color: '#555' }}>{date}</span>
          <button
            onClick={handleLike}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, color: liked ? '#f87171' : '#555', fontSize: '0.8rem', padding: 0 }}
          >
            {liked ? '♥' : '♡'} {post.likesCount + (liked ? 1 : 0)}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostCard;
