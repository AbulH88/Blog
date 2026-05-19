import { useEffect, useState } from 'react';

/**
 * Age verification gate. Required by Segpay/CCBill/Epoch for adult content
 * processor approval. Renders as a full-screen blocking modal that records
 * acknowledgment to localStorage.
 *
 * Compliance notes:
 * - The user MUST affirmatively click "I am 18+" — no auto-bypass
 * - The "Exit" path leads off-domain (Google)
 * - State persists across sessions until cleared
 */
const AgeGate = ({ onVerify }: { onVerify: () => void }) => {
  const [confirmed, setConfirmed] = useState(false);

  // Block page scroll while the gate is shown
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const handleVerify = () => {
    if (!confirmed) return;
    localStorage.setItem('ageVerified', 'true');
    localStorage.setItem('ageVerifiedAt', new Date().toISOString());
    onVerify();
  };

  return (
    <div className="v3-agegate-back" style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(20, 14, 8, 0.92)',
      backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, fontFamily: 'var(--v3-body, Inter, sans-serif)',
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 22,
        maxWidth: 480, width: '100%',
        padding: '36px 32px',
        boxShadow: '0 30px 80px rgba(0,0,0,0.4)',
        textAlign: 'center',
      }}>
        <p style={{ fontSize: '2.4rem', margin: '0 0 8px' }}>🔞</p>
        <h1 style={{
          fontFamily: 'var(--v3-heading, "DM Serif Display", serif)',
          fontSize: '1.7rem',
          margin: '0 0 10px',
          color: 'var(--v3-ink, #1F1A14)',
        }}>
          Adults Only
        </h1>
        <p style={{
          fontSize: '0.94rem',
          color: 'var(--v3-ink-soft, #4A3F33)',
          lineHeight: 1.55,
          margin: '0 0 24px',
        }}>
          This site contains adult content intended for persons aged <b>18 years or older</b>.
          By entering, you confirm you are of legal age in your jurisdiction and consent to viewing
          adult content.
        </p>

        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '12px 14px',
          background: '#FAF1E1',
          borderRadius: 10,
          textAlign: 'left',
          marginBottom: 18,
          fontSize: '0.86rem',
          color: 'var(--v3-ink, #1F1A14)',
          cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            style={{ marginTop: 4, transform: 'scale(1.2)', accentColor: '#C75A3E' }}
          />
          <span>
            I confirm I am at least 18 years old and agree to the{' '}
            <a href="/terms" target="_blank" style={{ color: '#C75A3E', fontWeight: 700 }}>Terms of Service</a>{' '}
            and{' '}
            <a href="/privacy" target="_blank" style={{ color: '#C75A3E', fontWeight: 700 }}>Privacy Policy</a>.
          </span>
        </label>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button
            onClick={handleVerify}
            disabled={!confirmed}
            style={{
              flex: 1,
              background: confirmed ? '#C75A3E' : '#E8DCC8',
              color: '#fff',
              border: 'none',
              padding: '14px 20px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.94rem',
              letterSpacing: 0.5,
              cursor: confirmed ? 'pointer' : 'not-allowed',
              opacity: confirmed ? 1 : 0.6,
              transition: 'all 0.18s',
              fontFamily: 'inherit',
            }}
          >
            I am 18+ — Enter
          </button>
          <a
            href="https://www.google.com"
            style={{
              flex: 1,
              background: 'transparent',
              color: 'var(--v3-ink-soft, #4A3F33)',
              border: '1.5px solid var(--v3-line, #E8DCC8)',
              padding: '13px 20px',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: '0.94rem',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'inherit',
            }}
          >
            Exit
          </a>
        </div>

        <p style={{
          fontSize: '0.72rem',
          color: 'var(--v3-muted, #8A7E70)',
          margin: 0,
          lineHeight: 1.5,
        }}>
          Records of age verification consent are stored on your device.
          See our <a href="/2257" target="_blank" style={{ color: '#C75A3E' }}>AI Content Notice</a>.
        </p>
      </div>
    </div>
  );
};

export default AgeGate;
