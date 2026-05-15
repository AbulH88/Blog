import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  fanvueUrl?: string;
  creatorName?: string;
}

/**
 * "Get Premium Access" modal — two-option chooser with a hero header.
 * Desktop: centered card. Mobile: bottom sheet.
 */
const JoinPremiumModal = ({ open, onClose, fanvueUrl, creatorName }: Props) => {
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

  const handleFanvue = () => {
    if (!fanvueUrl) return;
    window.open(fanvueUrl, '_blank', 'noopener,noreferrer');
    onClose();
  };

  const handleJoinDirect = () => {
    onClose();
    navigate(isLoggedIn ? '/dashboard' : '/register');
  };

  const name = creatorName || 'me';

  return (
    <div className="v3-modal-backdrop" onClick={onClose}>
      <div className="v3-modal-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {/* Hero */}
        <div className="v3-modal-hero">
          <button className="v3-modal-close" onClick={onClose} aria-label="Close">×</button>
          <div className="v3-modal-hero-emoji">✨</div>
          <h2>Get Premium Access</h2>
          <p>Choose how you'd like to connect with {name}</p>
        </div>

        {/* Body */}
        <div className="v3-modal-body">
          {fanvueUrl && (
            <button className="v3-option-card fanvue" onClick={handleFanvue}>
              <span className="ico">💎</span>
              <span className="meta">
                <span className="t">Watch on Fanvue</span>
                <span className="s">My verified Fanvue page — trusted &amp; secure</span>
                <span className="pill">Recommended</span>
              </span>
              <span className="arrow">→</span>
            </button>
          )}

          <button className="v3-option-card primary" onClick={handleJoinDirect}>
            <span className="ico">{isLoggedIn ? '👋' : '✨'}</span>
            <span className="meta">
              <span className="t">{isLoggedIn ? 'Go to your Dashboard' : 'Join Free Here'}</span>
              <span className="s">
                {isLoggedIn
                  ? 'Continue to your personal space'
                  : 'Chat directly · Unlock what you love · Free signup'}
              </span>
              {!isLoggedIn && <span className="pill">No card required</span>}
            </span>
            <span className="arrow">→</span>
          </button>

          {!isLoggedIn && (
            <p className="v3-modal-foot">
              Already a member? <Link to="/login" onClick={onClose}>Sign in</Link>
            </p>
          )}

          <p className="v3-modal-secure">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Secure &amp; private · You're in control
          </p>
        </div>
      </div>
    </div>
  );
};

export default JoinPremiumModal;
