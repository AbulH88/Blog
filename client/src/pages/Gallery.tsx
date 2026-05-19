import { useEffect, useState } from 'react';
import { SERVER_URL } from '../api';

type Category = 'All' | 'Travel' | 'Fashion' | 'Lifestyle' | 'BTS';
const CATEGORIES: Category[] = ['All', 'Travel', 'Fashion', 'Lifestyle', 'BTS'];

const fullUrl = (p: string) => (p?.startsWith('http') ? p : `${SERVER_URL}${p}`);

const Gallery = ({ images }: { images: string[] }) => {
  const [active, setActive] = useState<Category>('All');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Categories aren't tagged in the backend yet — every chip filters to all photos.
  // (Wire per-photo categories from Admin later; this only changes the chip's visual state.)
  const visible = images;

  // Keyboard nav for the lightbox
  useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null);
      else if (e.key === 'ArrowLeft') setLightboxIdx((i) => (i === null ? null : Math.max(0, i - 1)));
      else if (e.key === 'ArrowRight') setLightboxIdx((i) => (i === null ? null : Math.min(visible.length - 1, i + 1)));
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [lightboxIdx, visible.length]);

  const next = () => setLightboxIdx((i) => (i === null ? null : Math.min(visible.length - 1, i + 1)));
  const prev = () => setLightboxIdx((i) => (i === null ? null : Math.max(0, i - 1)));

  return (
    <div className="v3-gallery">
      {/* Decorative leaves */}
      <svg className="v3-gallery-decor" style={{ right: -40, top: 60, width: 220 }} viewBox="0 0 200 240" fill="none" aria-hidden>
        <path d="M180 30 Q90 90 100 200 Q180 150 180 30 Z" fill="#FAF1E1" opacity="0.5" />
        <path d="M150 50 Q70 110 85 180" stroke="#B8924F" strokeWidth="1.2" fill="none" opacity="0.7" />
      </svg>
      <svg className="v3-gallery-decor" style={{ left: -30, bottom: 80, width: 200 }} viewBox="0 0 200 240" fill="none" aria-hidden>
        <path d="M30 30 Q120 90 110 220 Q30 160 30 30 Z" fill="#FAF1E1" opacity="0.4" />
      </svg>

      <div className="v3-gallery-inner">
        <header className="v3-gallery-head">
          <h1 className="v3-gallery-title">MY WORLD IN PICTURES</h1>

          <div className="v3-gallery-meta">
            <div className="v3-chip-row">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  className={`v3-chip ${active === cat ? 'active' : ''}`}
                  onClick={() => setActive(cat)}
                  type="button"
                >
                  {cat}
                </button>
              ))}
              <span className="v3-chip muted">· {visible.length} photos</span>
            </div>

            <span className="v3-gallery-count">{visible.length} photos</span>
          </div>
        </header>

        {visible.length === 0 ? (
          <div style={{
            marginTop: 60, textAlign: 'center',
            color: 'rgba(255, 248, 240, 0.85)',
          }}>
            <p style={{ fontSize: '2rem', margin: '0 0 6px', opacity: 0.7 }}>📷</p>
            <p style={{ fontStyle: 'italic', fontSize: '1rem', margin: 0 }}>
              No photos here yet — check back soon.
            </p>
          </div>
        ) : (
          <div className="v3-masonry">
            {visible.map((img, idx) => (
              <button
                key={idx}
                className="v3-masonry-item"
                onClick={() => setLightboxIdx(idx)}
                aria-label={`Open photo ${idx + 1}`}
                type="button"
              >
                <img src={fullUrl(img)} alt={`Gallery photo ${idx + 1}`} loading={idx < 6 ? 'eager' : 'lazy'} />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && visible[lightboxIdx] && (
        <div className="v3-lightbox-back" onClick={() => setLightboxIdx(null)}>
          <div className="v3-lightbox-card" onClick={(e) => e.stopPropagation()}>
            <div className="v3-lightbox-img-wrap">
              <button
                className="v3-lightbox-close"
                onClick={() => setLightboxIdx(null)}
                aria-label="Close"
              >×</button>
              <img src={fullUrl(visible[lightboxIdx])} alt={`Photo ${lightboxIdx + 1}`} />
            </div>

            <div className="v3-lightbox-footer">
              <button
                className="v3-lightbox-nav"
                onClick={prev}
                disabled={lightboxIdx === 0}
                aria-label="Previous photo"
              >‹</button>

              <div style={{ flex: 1, textAlign: 'center' }}>
                <div className="v3-lightbox-caption">Photo {lightboxIdx + 1} of {visible.length}</div>
                <div className="v3-lightbox-dots">
                  {visible.slice(0, Math.min(12, visible.length)).map((_, i) => (
                    <button
                      key={i}
                      className={`v3-lightbox-dot ${i === lightboxIdx % 12 ? 'active' : ''}`}
                      onClick={() => setLightboxIdx(i)}
                      aria-label={`Go to photo ${i + 1}`}
                    />
                  ))}
                </div>
              </div>

              <button
                className="v3-lightbox-nav"
                onClick={next}
                disabled={lightboxIdx >= visible.length - 1}
                aria-label="Next photo"
              >›</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Gallery;
