import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SERVER_URL } from '../api';
import { isMembersDomain, crossDomainUrl } from '../lib/hostname';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Deprecated — kept for prop compatibility but no longer rendered in this modal.
   *  Fanvue is now exposed only to logged-in fans (FanSidebar + PayMethodPicker)
   *  so it stays hidden from IG / Meta / Twitter crawlers. */
  fanvueUrl?: string;
  creatorName?: string;
  /** Small circular avatar in the invitation seal (always rendered). */
  avatarUrl?: string;
  /** Optional big hero photo at the top of the modal — IG-profile-header feel.
   *  When present the modal switches to the photo-led layout; otherwise the
   *  bare seal layout from earlier versions is used. Source typically the
   *  creator's heroSlider[0] or hero image. */
  heroImageUrl?: string;
}

const fullUrl = (p?: string) => {
  if (!p) return '';
  if (p.startsWith('http')) return p;
  return p.startsWith('/') ? `${SERVER_URL}${p}` : `${SERVER_URL}/${p}`;
};

/**
 * Invitation-card modal — editorial style matching the v3 theme.
 * Replaces the older "chooser" design now that Fanvue is gated behind login.
 * Desktop: centered card. Mobile: bottom sheet.
 */
const JoinPremiumModal = ({ open, onClose, creatorName, avatarUrl, heroImageUrl }: Props) => {
  const navigate = useNavigate();
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('fanToken');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleJoinDirect = () => {
    onClose();
    const dest = isLoggedIn ? '/dashboard' : '/register';
    // On the marketing root domain, cross-domain navigate to members.*.
    // On members.* itself (or local SPA), use the router as before.
    if (isMembersDomain()) {
      navigate(dest);
    } else {
      window.location.href = crossDomainUrl(dest, 'members');
    }
  };

  const name = creatorName || 'the creator';
  const avatarSrc = fullUrl(avatarUrl);
  const heroSrc = fullUrl(heroImageUrl);
  const hasHero = !!heroSrc;

  return (
    <div className="v3-invite-backdrop" onClick={onClose}>
      <div
        className={`v3-invite-card${hasHero ? ' has-hero' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button className="v3-invite-close" onClick={onClose} aria-label="Close">×</button>

        {hasHero && (
          <div className="v3-invite-hero">
            <img src={heroSrc} alt="" loading="eager" />
          </div>
        )}

        {/* Seal — small circular avatar. With a hero photo it floats over
            the bottom edge (IG profile-header look). Without one it sits
            centered at the top (original layout). */}
        <div className="v3-invite-seal">
          {avatarSrc ? (
            <img src={avatarSrc} alt={name} />
          ) : (
            <span className="initial">{name.slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        <p className="v3-invite-eyebrow">YOU'RE INVITED</p>

        <h2 className="v3-invite-title">
          Step inside <span className="ital">{name}'s</span> creative space
        </h2>

        <p className="v3-invite-lede">
          A closer look at my daily life — fashion, travel, the little moments I share with people who actually show up.
        </p>

        <ul className="v3-invite-perks">
          <li><span className="check">✓</span> Daily updates straight from me</li>
          <li><span className="check">✓</span> A real-time look behind the lens</li>
          <li><span className="check">✓</span> Say hi — I read every message</li>
        </ul>

        <button className="v3-invite-cta" onClick={handleJoinDirect}>
          {isLoggedIn ? 'Continue to your Dashboard' : 'Follow free — takes 30 seconds'}
          <span className="arrow">→</span>
        </button>

        {!isLoggedIn && (
          <p className="v3-invite-signin">
            Already inside?{' '}
            {isMembersDomain() ? (
              <Link to="/login" onClick={onClose}>Sign in</Link>
            ) : (
              <a href={crossDomainUrl('/login', 'members')} onClick={onClose}>Sign in</a>
            )}
          </p>
        )}

        <p className="v3-invite-foot">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          No card required · Unfollow anytime
        </p>
      </div>
    </div>
  );
};

export default JoinPremiumModal;
