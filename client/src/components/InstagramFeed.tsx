import { useEffect, useState } from 'react';
import { getInstagramFeed, SERVER_URL } from '../api';

interface IGPost {
  url: string;
  shortcode: string;
  thumbnail: string;
  embedUrl: string;
}

const fullUrl = (p: string) => (p?.startsWith('http') ? p : `${SERVER_URL}${p}`);

const InstagramFeed = ({ slug, fallbackImages = [] }: { slug: string; fallbackImages?: string[] }) => {
  const [posts, setPosts] = useState<IGPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getInstagramFeed(slug)
      .then((data) => { if (!cancelled) setPosts(data?.posts || []); })
      .catch(() => { /* silent fall back */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  const showFallback = !loading && posts.length === 0 && fallbackImages.length > 0;

  return (
    <div className="v3-ig-feed">
      <h3>INSTAGRAM FEED</h3>
      <div className="v3-ig-grid">
        {loading && [...Array(9)].map((_, i) => (
          <div key={i} className="v3-ig-card">
            <div style={{ aspectRatio: '1/1', background: '#eee' }} />
          </div>
        ))}

        {!loading && posts.map((p) => (
          <a key={p.shortcode} href={p.url} target="_blank" rel="noreferrer" className="v3-ig-card">
            <img
              src={p.thumbnail}
              alt=""
              loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }}
            />
            <div className="meta">♡ ◯ ⤴ <span style={{ marginLeft: 'auto' }}>View</span></div>
          </a>
        ))}

        {showFallback && fallbackImages.slice(0, 9).map((img, i) => (
          <div key={i} className="v3-ig-card">
            <img src={fullUrl(img)} alt="" loading="lazy" />
            <div className="meta">♡ ◯ ⤴ <span style={{ marginLeft: 'auto' }}>—</span></div>
          </div>
        ))}

        {!loading && posts.length === 0 && fallbackImages.length === 0 && (
          [...Array(9)].map((_, i) => (
            <div key={i} className="v3-ig-card">
              <div style={{ aspectRatio: '1/1', background: '#f1e4d6' }} />
              <div className="meta">♡ ◯ ⤴ • —</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default InstagramFeed;
