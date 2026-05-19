import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { checkResetToken, submitPasswordReset } from '../api';
import PasswordInput from '../components/PasswordInput';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [checking, setChecking] = useState(true);
  const [validToken, setValidToken] = useState(false);
  const [emailHint, setEmailHint] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setChecking(false); setValidToken(false); return; }
    checkResetToken(token).then((res) => {
      setValidToken(!!res.valid);
      if (res.email) setEmailHint(res.email);
      if (res.error) setError(res.error);
    }).finally(() => setChecking(false));
  }, [token]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setError("Passwords don't match"); return; }
    setSubmitting(true);
    const res = await submitPasswordReset(token, newPassword);
    setSubmitting(false);
    if (res?.ok) {
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } else {
      setError(res?.error || 'Reset failed');
    }
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
        <h1 style={{ margin: 0, fontSize: '1.4rem', letterSpacing: 0.5 }}>Set a new password</h1>

        {checking ? (
          <p style={{ margin: '14px 0', color: 'var(--v3-ink-soft)' }}>Checking link…</p>
        ) : !validToken ? (
          <>
            <p style={{ margin: '14px 0', color: 'var(--v3-danger)', fontSize: '0.96rem' }}>
              ⚠️ This reset link is invalid or has expired.
            </p>
            <p style={{ fontSize: '0.86rem', color: 'var(--v3-ink-soft)' }}>
              Reset links are valid for 60 minutes. You can request a new one below.
            </p>
            <div style={{ marginTop: 18 }}>
              <Link to="/forgot-password"
                style={{
                  display: 'inline-block', background: 'var(--v3-terracotta)', color: '#fff',
                  padding: '10px 22px', borderRadius: 22, textDecoration: 'none', fontWeight: 700,
                }}>
                Request a new link
              </Link>
            </div>
          </>
        ) : done ? (
          <>
            <p style={{ margin: '14px 0', color: '#1f7a3f', fontSize: '0.96rem' }}>
              ✅ Password updated. Redirecting you to sign in…
            </p>
          </>
        ) : (
          <form onSubmit={submit}>
            <p style={{ margin: '14px 0', color: 'var(--v3-ink-soft)', fontSize: '0.96rem' }}>
              Resetting password for <strong>{emailHint}</strong>.
            </p>

            {error && (
              <div style={{
                background: 'rgba(220,38,38,0.10)', color: 'var(--v3-danger)',
                padding: '10px 14px', borderRadius: 8, fontSize: '0.86rem', marginBottom: 14,
              }}>{error}</div>
            )}

            <label style={fieldLabel}>New password (≥ 8 characters)</label>
            <PasswordInput
              value={newPassword}
              onChange={setNewPassword}
              required
              autoComplete="new-password"
              showStrength
              style={{ marginBottom: 14 }}
            />

            <label style={fieldLabel}>Confirm new password</label>
            <PasswordInput
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
              autoComplete="new-password"
              style={{ marginBottom: 14 }}
            />

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 22,
                background: 'var(--v3-terracotta)', color: '#fff', border: 'none',
                fontSize: '0.96rem', fontWeight: 700, marginTop: 10,
                cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1,
              }}>
              {submitting ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: '0.78rem', color: 'var(--v3-muted)',
  marginTop: 12, marginBottom: 4, fontWeight: 600,
};
const input: React.CSSProperties = {
  width: '100%', padding: '11px 14px', borderRadius: 10,
  border: '1px solid var(--v3-rose-100)', fontSize: '0.96rem',
  boxSizing: 'border-box', outline: 'none',
};
