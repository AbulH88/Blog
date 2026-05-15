import { SERVER_URL } from '../api';

const fullUrl = (p?: string) => (!p ? '' : (p.startsWith('http') ? p : `${SERVER_URL}${p}`));

interface PostTileProps {
  variant: 'post';
  post: {
    id: number;
    title?: string;
    caption?: string;
    mediaUrls?: string[];
    mediaType?: string;
    isLocked?: boolean;
    price?: number | string;
    likesCount?: number;
  };
  onUnlock?: (id: number) => void;
  unlocking?: boolean;
  onView?: (id: number) => void;
}

interface BundleTileProps {
  variant: 'bundle';
  bundle: {
    id: number;
    title: string;
    description?: string;
    price: number | string;
    thumbs?: string[];
    postCount?: number;
    isUnlocked?: boolean;
  };
  bundlePosts?: { title?: string; caption?: string }[];
  onUnlock?: (id: number) => void;
  unlocking?: boolean;
}

type Props = PostTileProps | BundleTileProps;

const VaultTile = (props: Props) => {
  // ─── Bundle variant ────────────────────────────────────────
  if (props.variant === 'bundle') {
    const { bundle, bundlePosts = [], onUnlock, unlocking } = props;
    const tiles = (bundle.thumbs || []).slice(0, 4);
    const includesPreview = bundlePosts.slice(0, 4).map(p => p.title || (p.caption || 'Premium content').slice(0, 28));

    return (
      <div className="v3-vault-tile bundle">
        <div className="media">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="media-tile" style={{ backgroundImage: tiles[i] ? `url("${fullUrl(tiles[i])}")` : undefined }} />
          ))}
        </div>
        <div className="body">
          <p className="title">{bundle.title}</p>
          {includesPreview.length > 0 && (
            <ol className="includes" style={{ paddingLeft: 18, margin: 0 }}>
              {includesPreview.map((t, i) => <li key={i}>{t}</li>)}
            </ol>
          )}
          <p className="total">${parseFloat(String(bundle.price)).toFixed(0)} TOTAL VALUE</p>
          <div className="actions">
            {bundle.isUnlocked ? (
              <span style={{ color: '#1f6b32', fontWeight: 700, fontSize: '0.86rem' }}>✓ Unlocked</span>
            ) : (
              <button
                className="unlock-btn"
                onClick={() => onUnlock?.(bundle.id)}
                disabled={!!unlocking}>
                {unlocking ? 'Unlocking…' : 'Unlock Bundle'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ─── Post variant ──────────────────────────────────────────
  const { post, onUnlock, unlocking, onView } = props;
  const locked = !!post.isLocked;
  const price = parseFloat(String(post.price || 0));
  const isPaid = price > 0 || locked;
  const thumb = post.mediaUrls?.[0];
  const isVideo = post.mediaType === 'video';

  return (
    <div className="v3-vault-tile">
      <div className={`media ${locked ? 'locked' : ''}`}>
        {thumb ? (
          isVideo
            ? <video src={fullUrl(thumb)} muted playsInline />
            : <img src={fullUrl(thumb)} alt={post.title || ''} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'var(--v3-cream-deep)' }} />
        )}

        <span className={`tag ${isPaid ? 'paid' : 'free'}`}>
          {isPaid ? (price > 0 ? `PAID $${price.toFixed(0)}` : 'PAID') : 'FREE'}
        </span>
        <span className="heart">♡ {(post.likesCount ?? 0).toLocaleString()}</span>

        {locked && (
          <div className="media-overlay">
            <div className="lock-glyph">🔒</div>
            <span className="lock-label">LOCKED</span>
          </div>
        )}
      </div>

      <div className="body">
        <p className="title">{post.title || post.caption?.slice(0, 30) || 'Untitled'}</p>
        {post.caption && post.caption !== post.title && (
          <p className="caption" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {post.caption}
          </p>
        )}

        <div className="actions">
          {locked && price > 0 ? (
            <button className="unlock-btn"
              onClick={() => onUnlock?.(post.id)}
              disabled={!!unlocking}>
              {unlocking ? 'Unlocking…' : (<>🔒 Unlock ${price.toFixed(0)}</>)}
            </button>
          ) : (
            <button className="view-link" onClick={() => onView?.(post.id)}>
              View
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VaultTile;
