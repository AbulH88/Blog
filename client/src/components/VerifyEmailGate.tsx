import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMe, resendVerificationEmail } from '../api';
import { useToast } from './Toast';

/**
 * Hard full-page gate. Use this to wrap a page (Chat, Vault, etc.) so that
 * unverified fans see a verification CTA instead of the page content.
 *
 * Loading state: render children optimistically — we don't want to flash
 * a gate for a verified user while we wait on /auth/me. If the user comes
 * back unverified, we swap to the gate. Verified or not-logged-in: render
 * the page as normal (logged-out users are handled by the page itself).
 *
 * Creators are never gated (no emailVerified field server-side).
 */
export default function VerifyEmailGate({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  /** What's being gated — e.g. "messaging" / "the Vault". */
  title?: string;
  /** Optional explainer line under the title. */
  subtitle?: string;
}) {
  const [status, setStatus] = useState<'loading' | 'gated' | 'allowed'>('loading');
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      // No fanToken: leave it to the page to redirect / show its own login CTA.
      const tok = localStorage.getItem('fanToken');
      if (!tok) return setStatus('allowed');
      const me = await getMe();
      const u = me?.user;
      if (u && u.emailVerified === false) {
        setEmail(u.email || '');
        setStatus('gated');
      } else {
        setStatus('allowed');
      }
    })();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleResend = async () => {
    setSending(true);
    try {
      const res = await resendVerificationEmail();
      if (res?.ok) {
        setSent(true);
        setCooldown(60);
        toast.success('Verification email sent — check your inbox.');
      } else if (res?.error) {
        toast.error(res.error);
      } else {
        toast.error('Could not send right now — please try again in a moment.');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Network error — please try again.');
    } finally {
      setSending(false);
    }
  };

  // Don't flash a gate for verified users while we check.
  if (status !== 'gated') return <>{children}</>;

  return (
    <div style={{
      minHeight: 'calc(100vh - 80px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
      background: 'var(--v3-cream)',
    }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        background: '#fff',
        borderRadius: 16,
        padding: '36px 32px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.06)',
        border: '1px solid var(--v3-rose-100)',
        textAlign: 'center',
      }}>
        <div style={{
          width: 64, height: 64,
          margin: '0 auto 20px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #fff8e1, #ffe0bd)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem',
        }}>✉️</div>

        <h1 style={{
          fontFamily: 'var(--v3-heading)',
          fontSize: '1.6rem',
          fontWeight: 800,
          letterSpacing: -0.3,
          color: 'var(--v3-ink)',
          margin: '0 0 8px',
        }}>
          Verify your email to {title || 'continue'}
        </h1>

        <p style={{
          fontSize: '0.92rem',
          color: 'var(--v3-ink-soft)',
          lineHeight: 1.5,
          margin: '0 0 18px',
        }}>
          {subtitle || `We sent a verification link to ${email || 'your inbox'}. Tap it to unlock this page.`}
        </p>

        {email && (
          <div style={{
            display: 'inline-block',
            padding: '8px 14px',
            borderRadius: 10,
            background: 'var(--v3-cream)',
            border: '1px solid var(--v3-rose-100)',
            fontSize: '0.86rem',
            fontWeight: 600,
            color: 'var(--v3-ink)',
            marginBottom: 22,
          }}>
            {email}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sent ? (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(76, 175, 80, 0.1)',
              border: '1px solid rgba(76, 175, 80, 0.3)',
              borderRadius: 10,
              color: '#2e7d32',
              fontSize: '0.88rem',
              fontWeight: 600,
            }}>
              ✓ Sent — check your inbox (and spam folder)
            </div>
          ) : (
            <button
              onClick={handleResend}
              disabled={sending || cooldown > 0}
              style={{
                background: 'var(--v3-terracotta)',
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                padding: '14px 0',
                fontFamily: 'inherit',
                fontSize: '0.94rem',
                fontWeight: 700,
                cursor: sending || cooldown > 0 ? 'not-allowed' : 'pointer',
                opacity: sending || cooldown > 0 ? 0.55 : 1,
                width: '100%',
              }}>
              {sending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend verification email'}
            </button>
          )}

          <Link
            to="/dashboard"
            style={{
              padding: '12px 0',
              fontFamily: 'inherit',
              fontSize: '0.86rem',
              fontWeight: 600,
              color: 'var(--v3-ink-soft)',
              textDecoration: 'none',
              borderRadius: 12,
              border: '1px solid var(--v3-rose-100)',
              background: 'transparent',
              textAlign: 'center',
            }}>
            ← Back to dashboard
          </Link>
        </div>

        <p style={{
          marginTop: 20,
          fontSize: '0.74rem',
          color: 'var(--v3-muted)',
          lineHeight: 1.5,
        }}>
          Didn't get the email? Check spam, or contact support if it doesn't arrive within a few minutes.
        </p>
      </div>
    </div>
  );
}
