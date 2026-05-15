import { useLocation } from 'react-router-dom';

const Footer = ({ config }: { config: any }) => {
  const location = useLocation();
  if (
    location.pathname === '/chat' ||
    location.pathname === '/vault' ||
    location.pathname === '/dashboard'
  ) return null;

  const year = new Date().getFullYear();

  return (
    <footer className="v3-footer">
      <div className="v3-footer-icons">
        {config.links?.instagram && (
          <a href={config.links.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-5.838 2.435-5.838 5.838s2.435 5.838 5.838 5.838 5.838-2.435 5.838-5.838-2.435-5.838-5.838-5.838zm0 9.674c-2.09 0-3.836-1.746-3.836-3.836s1.746-3.836 3.836-3.836 3.836 1.746 3.836 3.836-1.746 3.836-3.836 3.836zm5.838-10.499c.742 0 1.344.603 1.344 1.344s-.603 1.344-1.344 1.344-1.344-.603-1.344-1.344.603-1.344 1.344-1.344z"/></svg>
          </a>
        )}
        {config.links?.tiktok && (
          <a href={config.links.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.83 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/></svg>
          </a>
        )}
        {config.links?.twitter && (
          <a href={config.links.twitter} target="_blank" rel="noreferrer" aria-label="X">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 7.719 8.502 11.231h-6.653l-5.208-6.817-5.964 6.817H1.614l7.737-8.854L.813 2.25h6.823l4.707 6.227L18.244 2.25z"/></svg>
          </a>
        )}
        {config.links?.youtube && (
          <a href={config.links.youtube} target="_blank" rel="noreferrer" aria-label="YouTube">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136C4.495 20.455 12 20.455 12 20.455s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.546 15.568V8.432L15.818 12l-6.272 3.568z"/></svg>
          </a>
        )}
      </div>

      <p className="copy">© {year} {config.siteTitle?.toUpperCase()}. ALL RIGHTS RESERVED.</p>

      <div className="v3-footer-links">
        <a href="#">Privacy Policy</a>
        <a href="#">Terms</a>
        <a href="#">Contact</a>
      </div>
    </footer>
  );
};

export default Footer;
