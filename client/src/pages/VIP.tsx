import React from 'react';

const VIP = ({ config }: { config: any }) => {
  return (
    <div style={{ padding: '60px 0', textAlign: 'center' }}>
      <h1>Exclusive Access</h1>
      <p style={{ marginBottom: '40px' }}>Join my private community for uncut content, behind-the-scenes, and direct messaging.</p>
      
      <div className="gallery-grid" style={{ filter: 'blur(8px)', opacity: 0.5, pointerEvents: 'none', marginBottom: '40px' }}>
        <div className="gallery-item"><img src="https://via.placeholder.com/300" alt="locked" /></div>
        <div className="gallery-item"><img src="https://via.placeholder.com/300" alt="locked" /></div>
        <div className="gallery-item"><img src="https://via.placeholder.com/300" alt="locked" /></div>
      </div>

      <a href={config.links.fanvue} className="btn btn-primary" style={{ fontSize: '1.2rem', padding: '15px 40px' }}>
        Unlock Full Gallery Now 🔒
      </a>
      
      <p style={{ marginTop: '20px', fontSize: '0.8rem', color: '#666' }}>
        Redirecting to secure monetization platform.
      </p>
    </div>
  );
};

export default VIP;
