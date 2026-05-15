import { useEffect, useState } from 'react';
import { SERVER_URL } from '../api';

interface Props {
  images: string[];
  interval?: number; // ms between auto-advance
  alt?: string;
}

const fullUrl = (p: string) => (p?.startsWith('http') ? p : `${SERVER_URL}${p}`);

const HeroSlider = ({ images, interval = 6000, alt = '' }: Props) => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setActive((i) => (i + 1) % images.length), interval);
    return () => clearInterval(id);
  }, [images.length, interval]);

  if (images.length === 0) {
    return <div className="v3-hero-image" style={{ background: '#e6d6c2' }} />;
  }

  return (
    <div className="v3-hero-slider">
      {images.map((img, i) => (
        <img
          key={img + i}
          src={fullUrl(img)}
          alt={alt}
          className={`v3-hero-slide ${i === active ? 'active' : ''}`}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}
      {images.length > 1 && (
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
      )}
    </div>
  );
};

export default HeroSlider;
