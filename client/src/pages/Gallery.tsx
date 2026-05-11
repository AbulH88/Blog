import { SERVER_URL } from '../api';

const Gallery = ({ images }: { images: string[] }) => {
  const getFullUrl = (path: string) => path.startsWith('http') ? path : `${SERVER_URL}${path}`;

  return (
    <div style={{ padding: '40px 0' }}>
      <h1 className="section-title">Full Gallery</h1>
      <div className="gallery-grid">
        {images.length > 0 ? images.map((img, idx) => (
          <div key={idx} className="gallery-item">
            <img src={getFullUrl(img)} alt={`Gallery ${idx}`} loading="lazy" />
          </div>
        )) : (
          <>
            <div className="gallery-item"><img src="https://via.placeholder.com/300" alt="placeholder" loading="lazy" /></div>
            <div className="gallery-item"><img src="https://via.placeholder.com/300" alt="placeholder" loading="lazy" /></div>
            <div className="gallery-item"><img src="https://via.placeholder.com/300" alt="placeholder" loading="lazy" /></div>
          </>
        )}
      </div>
    </div>
  );
};

export default Gallery;
