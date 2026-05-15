import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import JoinPremiumModal from './JoinPremiumModal';
import { SERVER_URL } from '../api';

const Navbar = ({
  siteTitle,
  instagramHandle,
  fanvueUrl,
  logoUrl,
}: {
  siteTitle: string;
  instagramHandle?: string;
  fanvueUrl?: string;
  logoUrl?: string;
}) => {
  const [fanUser, setFanUser] = useState<any>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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

  // Chrome visibility:
  // - /dashboard and /chat: hidden on all sizes — they each have their own
  //   shell (sidebar on desktop, immersive on mobile)
  // - /vault: hide chrome on mobile (immersive), show on desktop
  const isImmersiveMobile = location.pathname === '/vault';
  const isFullyHidden =
    location.pathname === '/dashboard' || location.pathname === '/chat';

  if (isFullyHidden) return null;

  const handle = instagramHandle || '@cristina_style';
  const logoSrc = logoUrl
    ? (logoUrl.startsWith('http') ? logoUrl : `${SERVER_URL}${logoUrl}`)
    : '';

  return (
    <div className={isImmersiveMobile ? 'v3-chrome v3-chrome--mobile-hidden' : 'v3-chrome'}>
      {/* Top terracotta brand bar */}
      <div className="v3-brand-bar">
        {siteTitle?.toUpperCase()} <span style={{ opacity: 0.7, margin: '0 6px' }}>|</span> {handle}
      </div>

      {/* Main nav */}
      <nav className="v3-nav">
        <Link to="/" className="v3-logo" style={{ display: 'inline-flex', alignItems: 'center' }}>
          {logoSrc ? (
            <img
              src={logoSrc}
              alt={siteTitle || 'CRISTINA'}
              style={{ height: 78, width: 'auto', display: 'block' }}
            />
          ) : (
            (siteTitle || 'CRISTINA').toUpperCase()
          )}
        </Link>

        <div className="v3-nav-links">
          <Link to="/">Home</Link>
          <Link to="/about">About</Link>
          {/* Shop — coming soon, hidden for now */}
          <Link to="/gallery">Gallery</Link>
          <Link to="/blog">Blog</Link>
        </div>

        <div className="v3-nav-right">
          <button className="v3-nav-search" aria-label="Search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>

          {fanUser ? (
            <>
              <Link to="/dashboard" className="v3-btn v3-btn-outline" style={{ fontSize: '0.72rem', padding: '10px 18px' }}>
                {fanUser.username}
              </Link>
              <button onClick={handleLogout} className="v3-btn v3-btn-primary" style={{ fontSize: '0.72rem' }}>
                Sign out
              </button>
            </>
          ) : (
            <button
              onClick={() => setJoinOpen(true)}
              className="v3-btn v3-btn-primary"
              type="button"
            >
              Get Premium Access
            </button>
          )}
        </div>
      </nav>

      <JoinPremiumModal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        fanvueUrl={fanvueUrl}
        creatorName={siteTitle}
      />
    </div>
  );
};

export default Navbar;
