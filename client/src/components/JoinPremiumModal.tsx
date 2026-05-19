import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { SERVER_URL } from '../api';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Deprecated — kept for prop compatibility but no longer rendered in this modal.
   *  Fanvue is now exposed only to logged-in fans (FanSidebar + PayMethodPicker)
   *  so it stays hidden from IG / Meta / Twitter crawlers. */
  fanvueUrl?: string;
  creatorName?: string;
  /** Optional avatar/logo to put inside the invitation seal. */
  avatarUrl?: string;
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
const JoinPremiumModal = ({ open, onClose, creatorName, avatarUrl }: Props) => {
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
    navigate(isLoggedIn ? '/dashboard' : '/register');
  };

  const name = creatorName || 'the creator';
  const avatarSrc = fullUrl(avatarUrl);

  return (
    <div className="v3-invite-backdrop" onClick={onClose}>
      <div className="v3-invite-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="v3-invite-close" onClick={onClose} aria-label="Close">×</button>

        {/* Seal — avatar inside a circular border */}
        <div className="v3-invite-seal">
          {avatarSrc ? (
            <img src={avatarSrc} alt={name} />
          ) : (
            <span className="initial">{name.slice(0, 1).toUpperCase()}</span>
          )}
        </div>

        <p className="v3-invite-eyebrow">YOU'RE INVITED</p>

        <h2 className="v3-invite-title">
          Step inside <span className="ital">{name}'s</span> private world
        </h2>

        <p className="v3-invite-lede">
          Real conversations, unfiltered content, the side of me reserved for the people who actually show up.
        </p>

        <ul className="v3-invite-perks">
          <li><span className="check">✓</span> Direct messages — no bots, no filters</li>
          <li><span className="check">✓</span> Exclusive photos &amp; videos in the Vault</li>
          <li><span className="check">✓</span> Tip jar, PPV, requests — your call</li>
        </ul>

        <button className="v3-invite-cta" onClick={handleJoinDirect}>
          {isLoggedIn ? 'Continue to your Dashboard' : 'Join free — takes 30 seconds'}
          <span className="arrow">→</span>
        </button>

        {!isLoggedIn && (
          <p className="v3-invite-signin">
            Already inside? <Link to="/login" onClick={onClose}>Sign in</Link>
          </p>
        )}

        <p className="v3-invite-foot">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          18+ only · Secure &amp; private · Cancel anytime
        </p>
      </div>
    </div>
  );
};

export default JoinPremiumModal;
