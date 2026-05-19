import { useEffect, useState } from 'react';
import { getMe, resendVerificationEmail } from '../api';

/**
 * Yellow banner shown on Dashboard / Settings until the fan verifies their
 * email. Backend gates deposits + unlocks behind verification; this UI nudge
 * makes that gate predictable instead of surprising.
 */
export default function VerifyEmailBanner() {
  const [needs, setNeeds] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    (async () => {
      const me = await getMe();
      const u = me?.user;
      if (u && u.emailVerified === false) {
        setNeeds(true);
        setEmail(u.email || '');
      }
    })();
  }, []);

  // Cooldown tick (60s after resend so people don't spam)
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  if (!needs) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      const res = await resendVerificationEmail();
      if (res?.ok) {
        setSent(true);
        setCooldown(60);
      } else if (res?.error) {
        alert(res.error);
      } else {
        alert('Could not send right now — please try again in a moment.');
      }
    } catch (err: any) {
      alert(err?.message || 'Network error — please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', marginBottom: 16,
      background: 'linear-gradient(90deg, #fff8e1 0%, #ffeacc 100%)',
      border: '1px solid #f3c97a',
      borderRadius: 12,
      fontSize: '0.88rem', color: '#5a4626',
    }}>
      <span style={{ fontSize: '1.2rem', flexShrink: 0 }}>✉️</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong style={{ color: '#3d2f17' }}>Verify your email before your first deposit.</strong>
        <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: '#7a6634' }}>
          We sent a link to <span style={{ fontWeight: 600 }}>{email}</span>. Tap it to finish setting up.
        </p>
      </div>
      {sent ? (
        <span style={{ fontSize: '0.78rem', color: '#3d6b2c', fontWeight: 700, flexShrink: 0 }}>
          Sent ✓
        </span>
      ) : (
        <button
          onClick={handleResend}
          disabled={sending || cooldown > 0}
          style={{
            flexShrink: 0,
            background: '#c45c3a', color: '#fff',
            border: 'none', borderRadius: 18,
            padding: '6px 14px',
            fontFamily: 'inherit', fontSize: '0.78rem', fontWeight: 700,
            cursor: sending || cooldown > 0 ? 'not-allowed' : 'pointer',
            opacity: sending || cooldown > 0 ? 0.55 : 1,
          }}>
          {sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
        </button>
      )}
    </div>
  );
}
