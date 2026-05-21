import { useEffect, useState } from 'react';
import { SERVER_URL } from '../api';

interface Props {
  /** Desktop / fallback images. images[i] always exists for slide i. */
  images: string[];
  /** Optional per-index mobile overrides. mobileImages[i] used on phones if set. */
  mobileImages?: string[];
  interval?: number; // ms between auto-advance
  alt?: string;
}

const fullUrl = (p: string) => (p?.startsWith('http') ? p : `${SERVER_URL}${p}`);

const HeroSlider = ({ images, mobileImages = [], interval = 6000, alt = '' }: Props) => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setActive((i) => (i + 1) % images.length), interval);
    return () => clearInterval(id);
  }, [images.length, interval]);

  if (images.length === 0) {
    return <div className="v3-hero-image" style={{ background: '#e6d6c2' }} />;
  }

  const prev = () => setActive((i) => (i - 1 + images.length) % images.length);
  const next = () => setActive((i) => (i + 1) % images.length);

  return (
    <div className="v3-hero-slider">
      {images.map((img, i) => {
        // Per-slide mobile override; falls back to desktop image when empty.
        // <picture> is a native browser pick — no JS, no flash of wrong image.
        const desktop = fullUrl(img);
        const mobile = mobileImages[i] ? fullUrl(mobileImages[i]) : desktop;
        return (
          <picture key={img + i}>
            <source media="(max-width: 768px)" srcSet={mobile} />
            <img
              src={desktop}
              alt={alt}
              className={`v3-hero-slide ${i === active ? 'active' : ''}`}
              loading={i === 0 ? 'eager' : 'lazy'}
            />
          </picture>
        );
      })}
      {images.length > 1 && (
        <>
          <button
            type="button"
            className="v3-hero-arrow v3-hero-arrow-prev"
            onClick={prev}
            aria-label="Previous slide"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            type="button"
            className="v3-hero-arrow v3-hero-arrow-next"
            onClick={next}
            aria-label="Next slide"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
          <div className="v3-hero-dots">
            {images.map((_, i) => (
              <button
                key={i}
                className={`v3-hero-dot ${i === active ? 'active' : ''}`}
                onClick={() => setActive(i)}
                aria-label={`Show slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default HeroSlider;
