import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import JoinPremiumModal from './JoinPremiumModal';
import { SERVER_URL } from '../api';
import { isMembersDomain, crossDomainUrl } from '../lib/hostname';

const Navbar = ({
  siteTitle,
  instagramHandle,
  fanvueUrl,
  logoUrl,
  avatarUrl,
}: {
  siteTitle: string;
  instagramHandle?: string;
  fanvueUrl?: string;
  logoUrl?: string;
  avatarUrl?: string;
}) => {
  const [fanUser, setFanUser] = useState<any>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const u = localStorage.getItem('fanUser');
    if (u) setFanUser(JSON.parse(u));
  }, []);

  // Close mobile menu when route changes (e.g. user taps a nav link)
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Lock body scroll while the menu is open
  useEffect(() => {
    if (menuOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [menuOpen]);

  const handleLogout = () => {
    localStorage.removeItem('fanToken');
    localStorage.removeItem('fanUser');
    setFanUser(null);
    navigate('/');
  };

  // Chrome visibility: /admin, /dashboard, /chat, /vault and any /dashboard/* sub-route
  // all have their own shells (sidebar on desktop, immersive layout on mobile).
  // Global navbar/footer never renders on those pages.
  const isFullyHidden =
    location.pathname === '/admin' ||
    location.pathname.startsWith('/admin/') ||
    location.pathname === '/chat' ||
    location.pathname === '/vault' ||
    location.pathname === '/dashboard' ||
    location.pathname.startsWith('/dashboard/');

  if (isFullyHidden) return null;
  const isImmersiveMobile = false;

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
          {/* Hamburger — only visible on mobile via CSS */}
          <button
            className="v3-nav-burger"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            type="button"
          >
            {menuOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="7" x2="21" y2="7" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="17" x2="21" y2="17" />
              </svg>
            )}
          </button>

          <button className="v3-nav-search" aria-label="Search">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </button>

          {fanUser ? (
            <>
              {isMembersDomain() ? (
                <Link to="/dashboard" className="v3-btn v3-btn-outline" style={{ fontSize: '0.72rem', padding: '10px 18px' }}>
                  Dashboard
                </Link>
              ) : (
                <a href={crossDomainUrl('/dashboard', 'members')} className="v3-btn v3-btn-outline" style={{ fontSize: '0.72rem', padding: '10px 18px' }}>
                  Dashboard
                </a>
              )}
              <button onClick={handleLogout} className="v3-btn v3-btn-primary" style={{ fontSize: '0.72rem' }}>
                Sign out
              </button>
            </>
          ) : isMembersDomain() ? (
            // Members domain — full invitation modal (age-gated context)
            <button
              onClick={() => setJoinOpen(true)}
              className="v3-btn v3-btn-primary"
              type="button"
            >
              Step Inside ✨
            </button>
          ) : (
            // Marketing root — subtle text-only "Sign in" link.
            // No modal, no avatar, no signup pitch in the DOM — keeps the
            // root domain looking like a clean linktree to IG/TikTok bots.
            <a
              href={crossDomainUrl('/login', 'members')}
              style={{
                fontSize: '0.78rem',
                color: 'var(--v3-ink-soft)',
                textDecoration: 'none',
                fontWeight: 500,
                padding: '8px 6px',
              }}
            >
              Sign in
            </a>
          )}
        </div>
      </nav>

      {/* Mobile menu drawer — slides down under the navbar */}
      {menuOpen && (
        <>
          <div
            className="v3-mobile-menu-backdrop"
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="v3-mobile-menu" role="menu">
            <Link to="/"        role="menuitem">Home</Link>
            <Link to="/about"   role="menuitem">About</Link>
            <Link to="/gallery" role="menuitem">Gallery</Link>
            <Link to="/blog"    role="menuitem">Blog</Link>
            {fanUser && (
              <Link to="/dashboard" role="menuitem" className="v3-mobile-menu-cta">
                My Dashboard →
              </Link>
            )}
          </div>
        </>
      )}

      {/* JoinPremiumModal renders ONLY on the members subdomain. On the
          root marketing domain we never mount it — keeps the avatar/seal
          image and signup pitch text out of the public DOM so IG/TikTok
          bots can't fingerprint it. */}
      {isMembersDomain() && (
        <JoinPremiumModal
          open={joinOpen}
          onClose={() => setJoinOpen(false)}
          fanvueUrl={fanvueUrl}
          creatorName={siteTitle}
          avatarUrl={avatarUrl}
        />
      )}
    </div>
  );
};

export default Navbar;
