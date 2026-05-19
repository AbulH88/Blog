import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CREATOR_SLUG, SERVER_URL, unsubscribe } from '../api';

const fullUrl = (p?: string | null) => {
  if (!p) return '';
  if (p.startsWith('http')) return p;
  return p.startsWith('/') ? `${SERVER_URL}${p}` : `${SERVER_URL}/${p}`;
};

interface Props {
  creator: any;
  /** When true, signed-in fan-only items (Payment Methods, Cancel) are hidden. */
  guestMode?: boolean;
}

const navItems = [
  { to: '/dashboard', icon: '🏠', label: 'Dashboard' },
  { to: '/vault', icon: '💎', label: 'The Vault' },
  { to: '/chat', icon: '💬', label: 'Messages' },
  { to: '/gallery', icon: '🖼', label: 'Gallery' },
  { to: '/blog', icon: '📓', label: 'Journal' },
  { to: '/about', icon: '✨', label: 'About' },
  { to: '/dashboard/settings', icon: '⚙️', label: 'Settings', fanOnly: true },
];

const FanSidebar = ({ creator, guestMode = false }: Props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const fanUser = JSON.parse(localStorage.getItem('fanUser') || 'null');
  const creatorName = creator?.siteTitle || 'Creator';
  const handle = (creator?.links?.instagram?.split('/').filter(Boolean).pop()) || creatorName.toLowerCase().replace(/\s+/g, '');
  const avatar = creator?.chatAvatarUrl || creator?.images?.hero || creator?.images?.heroSlider?.[0] || creator?.logoUrl;

  const handleSignOut = () => {
    localStorage.removeItem('fanToken');
    localStorage.removeItem('fanUser');
    navigate('/');
  };

  const handleCancelAccount = async () => {
    const confirmed = window.confirm(
      'Cancel your account?\n\n' +
      '• Any content you have unlocked remains accessible until you log out.\n' +
      '• You will not be charged for anything after cancellation.\n' +
      '• You can re-activate by signing back in any time.\n\n' +
      'Continue?'
    );
    if (!confirmed) return;
    try { await unsubscribe(CREATOR_SLUG); } catch { /* ignore */ }
    alert("You're all set. We've stopped any future charges. Thanks for being part of " + creatorName + ' 💌');
    handleSignOut();
  };

  return (
    <aside className="v3-fan-side">
      <div className="v3-fan-brand">
        {creator?.logoUrl ? (
          <img src={fullUrl(creator.logoUrl)} alt={creatorName} />
        ) : (
          <>{creatorName.toUpperCase()}<small>FAN ACCOUNT</small></>
        )}
      </div>

      <div className="v3-fan-profile">
        <div className="avatar">
          {avatar && <img src={fullUrl(avatar)} alt={creatorName} />}
        </div>
        <div className="handle">@{guestMode ? handle : (fanUser?.username || 'fan')}</div>
        <div className="role">{guestMode ? 'Guest' : 'Following'}</div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {navItems.map(item => {
          if (item.fanOnly && guestMode) return null;
          const active = location.pathname === item.to
            || (item.to === '/dashboard/settings' && location.pathname.startsWith('/dashboard/settings'));
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`v3-fan-nav-btn ${active ? 'active' : ''}`}
            >
              <span style={{ width: 20, textAlign: 'center' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="v3-fan-side-footer">
        {/* Fanvue — only shown to logged-in fans (kept behind login wall so
            IG / Meta / Twitter crawlers never see the link). */}
        {!guestMode && creator?.fanvueUrl && (
          <a
            href={creator.fanvueUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', marginBottom: 10,
              background: 'linear-gradient(135deg, #fff7f1 0%, #ffe6dc 100%)',
              border: '1px solid var(--v3-rose-100)',
              borderRadius: 12, textDecoration: 'none',
              color: 'var(--v3-ink)', fontSize: '0.84rem', fontWeight: 700,
            }}>
            <span style={{ fontSize: '1.05rem' }}>💎</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              Watch on Fanvue
              <span style={{ display: 'block', fontSize: '0.68rem', fontWeight: 500, color: 'var(--v3-muted)' }}>
                Verified · alt checkout
              </span>
            </span>
            <span style={{ color: 'var(--v3-muted)', fontSize: '0.9rem' }}>↗</span>
          </a>
        )}

        {guestMode ? (
          <Link to="/login">Sign In</Link>
        ) : (
          <>
            <button onClick={handleSignOut}
              style={{ background: 'none', border: 'none', color: 'var(--v3-muted)', cursor: 'pointer', fontFamily: 'inherit' }}>
              Sign Out
            </button>
            <button onClick={handleCancelAccount}
              style={{
                background: 'none', border: 'none', color: 'var(--v3-danger)',
                fontSize: '0.74rem', cursor: 'pointer', padding: '8px 0',
                fontFamily: 'inherit', textAlign: 'center', width: '100%',
              }}>
              Cancel my account
            </button>
          </>
        )}
        <div style={{ marginTop: 8, display: 'flex', gap: 12, justifyContent: 'center', fontSize: '0.7rem' }}>
          <Link to="/terms" style={{ color: 'var(--v3-muted)', textDecoration: 'none' }}>Terms</Link>
          <Link to="/privacy" style={{ color: 'var(--v3-muted)', textDecoration: 'none' }}>Privacy</Link>
          {creator?.disclosureVisible !== false && (
            <Link to="/2257" style={{ color: 'var(--v3-muted)', textDecoration: 'none' }}>Disclosure</Link>
          )}
        </div>
      </div>
    </aside>
  );
};

export default FanSidebar;
