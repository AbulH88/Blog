import { SERVER_URL } from '../api';

const fullUrl = (p: string) => (p?.startsWith('http') ? p : `${SERVER_URL}${p}`);

/**
 * Instagram-style feed grid.
 *
 * V1 (current): renders the creator's curated gallery in a 3×3 grid +
 *   a "Follow on Instagram" CTA below. Instagram killed unauthenticated
 *   iframe embeds in late-2024, so this avoids them entirely.
 *
 * V2 (future, after Option A — Basic Display API): swap `gallery` for
 *   real fetched IG posts. The UI shape stays identical.
 */
const InstagramFeed = ({
  gallery = [],
  instagramUrl = '',
  handle = '',
}: {
  gallery?: string[];
  instagramUrl?: string;
  handle?: string;
}) => {
  const tiles = gallery.slice(0, 9);
  const padding = Math.max(0, 9 - tiles.length);
  const displayHandle = handle || (instagramUrl?.split('/').filter(Boolean).pop() ?? '');

  return (
    <div className="v3-ig-feed">
      <h3 style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span>INSTAGRAM FEED</span>
        {displayHandle && (
          <a
            href={instagramUrl || `https://instagram.com/${displayHandle}`}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: 1,
              color: 'var(--v3-terracotta)',
              textDecoration: 'none',
              textTransform: 'none',
            }}
          >
            @{displayHandle} ↗
          </a>
        )}
      </h3>

      <div className="v3-ig-grid">
        {tiles.map((img, i) => (
          <a
            key={i}
            href={instagramUrl || `https://instagram.com/${displayHandle}`}
            target="_blank"
            rel="noreferrer"
            className="v3-ig-card"
            aria-label="View on Instagram"
          >
            <img src={fullUrl(img)} alt="" loading="lazy" />
          </a>
        ))}
        {[...Array(padding)].map((_, i) => (
          <div key={`pad-${i}`} className="v3-ig-card">
            <div style={{ aspectRatio: '1/1', background: '#f1e4d6' }} />
          </div>
        ))}
      </div>

      {(instagramUrl || displayHandle) && (
        <a
          href={instagramUrl || `https://instagram.com/${displayHandle}`}
          target="_blank"
          rel="noreferrer"
          className="v3-ig-follow"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-5.838 2.435-5.838 5.838s2.435 5.838 5.838 5.838 5.838-2.435 5.838-5.838-2.435-5.838-5.838-5.838zm0 9.674c-2.09 0-3.836-1.746-3.836-3.836s1.746-3.836 3.836-3.836 3.836 1.746 3.836 3.836-1.746 3.836-3.836 3.836zm5.838-10.499c.742 0 1.344.603 1.344 1.344s-.603 1.344-1.344 1.344-1.344-.603-1.344-1.344.603-1.344 1.344-1.344z" />
          </svg>
          <span>Follow on Instagram</span>
        </a>
      )}
    </div>
  );
};

export default InstagramFeed;
