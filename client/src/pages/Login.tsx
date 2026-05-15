import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { creatorLogin, fanLogin } from '../api';

type Mode = 'creator' | 'fan';

const Login = () => {
  const [mode, setMode] = useState<Mode>('fan');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'creator') {
        const res = await creatorLogin(email, password);
        if (res.token) {
          localStorage.setItem('adminToken', res.token);
          localStorage.setItem('adminRole', 'creator');
          navigate('/admin');
        } else {
          setError(res.error || 'Invalid credentials');
        }
      } else {
        const res = await fanLogin(email, password);
        if (res.token) {
          localStorage.setItem('fanToken', res.token);
          localStorage.setItem('fanUser', JSON.stringify(res.user));
          navigate('/dashboard');
        } else {
          setError(res.error || 'Invalid credentials');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    padding: '12px 14px', borderRadius: 10,
    border: '1.5px solid var(--v3-line)',
    background: '#FFFAF4', color: 'var(--v3-ink)',
    fontFamily: 'inherit', fontSize: '0.92rem', outline: 'none',
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', background: 'var(--v3-cream)' }}>
      <div style={{ width: '100%', maxWidth: 420, padding: '36px 32px', background: '#fff', borderRadius: 18, border: '1px solid var(--v3-line)', boxShadow: 'var(--v3-shadow)' }}>
        <h1 style={{ fontFamily: 'var(--v3-heading)', fontSize: '1.7rem', textAlign: 'center', margin: '0 0 6px', color: 'var(--v3-ink)' }}>
          {mode === 'creator' ? 'Creator Login' : 'Welcome back'}
        </h1>
        <p style={{ textAlign: 'center', fontSize: '0.88rem', color: 'var(--v3-ink-soft)', margin: '0 0 24px' }}>
          {mode === 'creator' ? 'Access your admin dashboard' : 'Sign in to your account'}
        </p>

        <div style={{ display: 'flex', background: 'var(--v3-cream-deep)', borderRadius: 10, padding: 4, marginBottom: 22 }}>
          {(['fan', 'creator'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); setError(''); }}
              style={{
                flex: 1, padding: '9px 0', border: 'none', borderRadius: 7, cursor: 'pointer',
                background: mode === m ? '#fff' : 'transparent',
                color: mode === m ? 'var(--v3-ink)' : 'var(--v3-ink-soft)',
                fontWeight: mode === m ? 700 : 500, fontSize: '0.82rem',
                fontFamily: 'inherit', textTransform: 'capitalize',
                boxShadow: mode === m ? 'var(--v3-shadow-sm)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {m === 'fan' ? 'Member' : 'Creator'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="email" placeholder="Email address" value={email}
            onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
          <input type="password" placeholder="Password" value={password}
            onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
          {error && <p style={{ color: 'var(--v3-danger)', fontSize: '0.84rem', margin: 0 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="v3-btn v3-btn-primary"
            style={{ marginTop: 4, opacity: loading ? 0.7 : 1, width: '100%' }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {mode === 'fan' && (
          <p style={{ textAlign: 'center', marginTop: 22, fontSize: '0.88rem', color: 'var(--v3-ink-soft)' }}>
            No account?{' '}
            <Link to="/register" style={{ color: 'var(--v3-terracotta)', textDecoration: 'none', fontWeight: 700 }}>
              Join free
            </Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default Login;
