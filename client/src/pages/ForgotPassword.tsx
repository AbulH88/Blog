import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    await requestPasswordReset(email.trim().toLowerCase()).catch(() => {});
    setSubmitting(false);
    setSent(true);
  };

  return (
    <div style={{
      minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, background: 'var(--v3-cream)',
    }}>
      <div style={{
        background: '#fff', padding: 32, borderRadius: 18, maxWidth: 440, width: '100%',
        boxShadow: '0 8px 32px rgba(0,0,0,0.05)',
      }}>
        <h1 style={{ margin: 0, fontSize: '1.4rem', letterSpacing: 0.5 }}>Forgot your password?</h1>

        {sent ? (
          <>
            <p style={{ margin: '14px 0', color: 'var(--v3-ink-soft)', fontSize: '0.96rem', lineHeight: 1.5 }}>
              If an account exists for <strong>{email}</strong>, we've sent password reset instructions there.
              Check your inbox (and spam folder).
            </p>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'var(--v3-muted)' }}>
              The link expires in 60 minutes.
            </p>
            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              <Link to="/login" style={{ color: 'var(--v3-terracotta)', textDecoration: 'none', fontWeight: 700 }}>
                ← Back to sign in
              </Link>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <p style={{ margin: '14px 0', color: 'var(--v3-ink-soft)', fontSize: '0.96rem', lineHeight: 1.5 }}>
              Enter your email and we'll send you a link to reset your password.
            </p>
            <input
              type="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: '100%', padding: '11px 14px', borderRadius: 10,
                border: '1px solid var(--v3-rose-100)', fontSize: '0.96rem',
                marginTop: 6, marginBottom: 16, boxSizing: 'border-box',
              }}
            />
            <button
              type="submit"
              disabled={submitting || !email.trim()}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 22,
                background: 'var(--v3-terracotta)', color: '#fff', border: 'none',
                fontSize: '0.96rem', fontWeight: 700,
                cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1,
              }}>
              {submitting ? 'Sending…' : 'Send reset link'}
            </button>
            <div style={{ marginTop: 18, fontSize: '0.86rem', textAlign: 'center' }}>
              <Link to="/login" style={{ color: 'var(--v3-ink-soft)', textDecoration: 'none' }}>
                ← Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
