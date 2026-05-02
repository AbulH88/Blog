import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Navbar = ({ siteTitle }: { siteTitle: string }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`} style={{ position: 'fixed', width: '100%', top: 0, transition: 'all 0.3s', border: scrolled ? 'none' : 'bottom 1px solid rgba(255,255,255,0.1)', background: scrolled ? 'rgba(10,10,10,0.95)' : 'transparent' }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>
        <Link to="/" className="nav-logo"><strong>{siteTitle}</strong></Link>
        <div className="nav-links">
          <Link to="/gallery">Gallery</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/vip" style={{ color: '#fff', border: '1px solid #fff', padding: '5px 15px', marginLeft: '10px' }}>VIP Club 🔒</Link>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
