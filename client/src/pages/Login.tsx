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
          navigate('/');
        } else {
          setError(res.error || 'Invalid credentials');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '80px 20px', maxWidth: '380px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '8px' }}>
        {mode === 'creator' ? 'Creator Login' : 'Member Login'}
      </h1>
      <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--secondary)', marginBottom: '32px' }}>
        {mode === 'creator' ? 'Access your admin dashboard' : 'Sign in to your membership'}
      </p>

      {/* Toggle */}
      <div style={{ display: 'flex', background: '#1a1a1a', borderRadius: '8px', padding: '4px', marginBottom: '28px' }}>
        {(['fan', 'creator'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setError(''); }}
            style={{
              flex: 1, padding: '8px', border: 'none', borderRadius: '6px', cursor: 'pointer',
              background: mode === m ? 'var(--primary)' : 'transparent',
              color: mode === m ? 'var(--bg)' : 'var(--secondary)',
              fontWeight: mode === m ? 700 : 400, fontSize: '0.85rem', textTransform: 'capitalize',
            }}
          >
            {m === 'fan' ? 'Member' : 'Creator'}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: '#111', color: '#fff' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: '#111', color: '#fff' }}
        />
        {error && <p style={{ color: '#f87171', fontSize: '0.82rem', margin: 0 }}>{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading}
          style={{ padding: '13px', marginTop: '4px', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>

      {mode === 'fan' && (
        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: 'var(--secondary)' }}>
          No account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
            Join the club
          </Link>
        </p>
      )}
    </div>
  );
};

export default Login;
