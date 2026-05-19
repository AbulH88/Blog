import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { verifyEmailToken } from '../api';

/**
 * Lands here when the fan clicks the link in the verification email.
 * Hits /api/auth/verify-email?token=... and renders success / already / error.
 */
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';

  const [state, setState] = useState<'checking' | 'ok' | 'already' | 'error'>(token ? 'checking' : 'error');
  const [errMsg, setErrMsg] = useState<string>('');

  useEffect(() => {
    if (!token) { setErrMsg('No token in URL.'); return; }
    (async () => {
      const res = await verifyEmailToken(token);
      if (res?.ok && res?.alreadyVerified) setState('already');
      else if (res?.ok) setState('ok');
      else { setState('error'); setErrMsg(res?.error || 'Verification failed.'); }
    })();
  }, [token]);

  const headline =
    state === 'checking'  ? 'Verifying your email…' :
    state === 'ok'        ? 'Email verified! 🎉' :
    state === 'already'   ? 'Already verified ✓' :
                            'Verification failed';

  const blurb =
    state === 'checking'  ? 'Hang on for a sec.' :
    state === 'ok'        ? "You're all set. Wallet deposits and unlocks are now open." :
    state === 'already'   ? "This account was already verified — you're good to go." :
                            errMsg || 'The link may be expired or already used.';

  const isLoggedIn = !!localStorage.getItem('fanToken');

  return (
    <div style={{
      minHeight: 'calc(100vh - 120px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px', background: 'var(--v3-cream)',
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        padding: '36px 32px', background: '#fff',
        borderRadius: 18, border: '1px solid var(--v3-line)',
        boxShadow: 'var(--v3-shadow)', textAlign: 'center',
      }}>
        <div style={{ fontSize: '2.4rem', marginBottom: 6 }}>
          {state === 'checking' ? '⏳' : (state === 'error' ? '⚠️' : '✓')}
        </div>
        <h1 style={{ fontFamily: 'var(--v3-heading)', fontSize: '1.5rem', margin: '0 0 8px', color: 'var(--v3-ink)' }}>
          {headline}
        </h1>
        <p style={{ fontSize: '0.92rem', color: 'var(--v3-ink-soft)', margin: '0 0 22px', lineHeight: 1.5 }}>
          {blurb}
        </p>

        {(state === 'ok' || state === 'already') && (
          <button
            onClick={() => navigate(isLoggedIn ? '/dashboard' : '/login')}
            className="v3-btn v3-btn-primary"
            style={{ width: '100%' }}>
            {isLoggedIn ? 'Go to dashboard →' : 'Sign in →'}
          </button>
        )}

        {state === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Link to="/login" className="v3-btn v3-btn-outline" style={{ width: '100%', display: 'block' }}>
              Sign in to resend
            </Link>
            <Link to="/" style={{ color: 'var(--v3-muted)', fontSize: '0.84rem', textDecoration: 'none' }}>
              ← Back to home
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
