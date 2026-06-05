import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SERVER_URL } from '../api';
import { isMembersDomain, crossDomainUrl } from '../lib/hostname';
import { fanvueLink } from '../lib/fanvueLink';

// NOTE: JoinPremiumModal used to be mounted from the Navbar (via a "Step
// Inside ✨" button) but has been removed — see below. The component still
// exists and can be wired into a scroll-triggered welcome popup on the root
// domain later. Keeping it OUT of the Navbar bundle means the marketing root
// never even fetches the chunk, so IG/TikTok crawlers can't fingerprint any
// signup-flow text from JS.

const Navbar = ({
  siteTitle,
  instagramHandle,
  logoUrl,
  fanvueEnabled,
}: {
  siteTitle: string;
  instagramHandle?: string;
  /** Whether a Fanvue funnel is configured → shows a neutral "Support"
   *  button → /f/ click-through page (no platform name on the hub). */
  fanvueEnabled?: boolean;
  logoUrl?: string;
  /** Reserved for future use */
  avatarUrl?: string;
}) => {
  const [fanUser, setFanUser] = useState<any>(null);
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
          {/* /about merged into Home (scroll-anchored), no nav link needed */}
          <Link to="/gallery">Gallery</Link>
          <Link to="/blog">Journal</Link>
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

          {/* Neutral hub "Support" button → /f/ click-through (marketing root
              only). No platform name on the public hub; Fanvue is revealed on
              the /f/ landing page. Same page for everyone — no cloaking. */}
          {!isMembersDomain() && fanvueEnabled && (
            <a href={fanvueLink()} className="v3-btn v3-fanvue-chip">
              <span className="vip-star" aria-hidden>✦</span> Join VIP
            </a>
          )}

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
            // Members domain — user is ALREADY past the marketing surface.
            // No need for a "Step Inside" pitch / invitation modal here.
            // Show a small "Sign in" link instead (they may be on /register
            // and want to switch to /login, or on /gallery and need auth).
            <Link
              to="/login"
              className="v3-btn v3-btn-outline"
              style={{ fontSize: '0.72rem', padding: '10px 18px', textDecoration: 'none' }}
            >
              Sign in
            </Link>
          ) : (
            // Marketing root — styled CTA button. Text is intentionally
            // neutral ("Members") to stay below IG/TikTok bot adult-flag
            // classifiers. Universal phrase (gyms, golf clubs, news sites
            // all use "Members"). Same colored button styling as the rest
            // of the v3 design system — drives conversion without leaking
            // signup-pitch language. Cross-domain navigates to members.*/login.
            <a
              href={crossDomainUrl('/login', 'members')}
              className="v3-btn v3-btn-outline"
              style={{ textDecoration: 'none', fontSize: '0.72rem', padding: '9px 18px' }}
            >
              Members
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
            <Link to="/gallery" role="menuitem">Gallery</Link>
            <Link to="/blog"    role="menuitem">Journal</Link>
            {fanUser && (
              <Link to="/dashboard" role="menuitem" className="v3-mobile-menu-cta">
                My Dashboard →
              </Link>
            )}
          </div>
        </>
      )}

      {/* JoinPremiumModal is no longer mounted from the Navbar. The Step
          Inside pitch was an unnecessary surface on members.* (users there
          are already past the marketing surface). The component still
          exists for future use (e.g. scroll-trigger welcome on root) but
          isn't wired anywhere right now. */}
    </div>
  );
};

export default Navbar;
