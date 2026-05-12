import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = ({ siteTitle }: { siteTitle: string }) => {
  const [scrolled, setScrolled] = useState(false);
  const [fanUser, setFanUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const u = localStorage.getItem('fanUser');
    if (u) setFanUser(JSON.parse(u));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('fanToken');
    localStorage.removeItem('fanUser');
    setFanUser(null);
    navigate('/');
  };

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`} style={{ position: 'fixed', width: '100%', top: 0, zIndex: 100, transition: 'all 0.3s', background: scrolled ? 'rgba(10,10,10,0.95)' : 'transparent' }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '100%' }}>
        <Link to="/" className="nav-logo"><strong>{siteTitle}</strong></Link>

        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link to="/gallery">Gallery</Link>
          <Link to="/vault">Vault</Link>
          <Link to="/blog">Blog</Link>

          {fanUser ? (
            <>
              <Link to="/chat" style={{ fontSize: '0.85rem', color: 'var(--primary)', border: '1px solid var(--primary)', padding: '5px 14px', borderRadius: 4 }}>
                Message
              </Link>
              <Link to="/dashboard" style={{ fontSize: '0.82rem', color: 'var(--secondary)' }}>
                {fanUser.username}
              </Link>
              <button onClick={handleLogout} style={{ background: 'none', border: '1px solid #333', borderRadius: 6, padding: '5px 12px', color: '#666', cursor: 'pointer', fontSize: '0.78rem' }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>Sign in</Link>
              <Link to="/vip" style={{ color: '#fff', border: '1px solid #fff', padding: '5px 15px', borderRadius: 4, marginLeft: 4, fontSize: '0.85rem' }}>
                Join 🔒
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
