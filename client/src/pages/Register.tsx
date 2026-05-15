import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fanRegister } from '../api';

const Register = ({ config }: { config: any }) => {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    setLoading(true);
    try {
      const res = await fanRegister(email, username, password);
      if (res.token) {
        localStorage.setItem('fanToken', res.token);
        localStorage.setItem('fanUser', JSON.stringify(res.user));
        navigate('/dashboard');
      } else {
        setError(res.error || 'Registration failed');
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
          Get Premium Access
        </h1>
        <p style={{ textAlign: 'center', fontSize: '0.88rem', color: 'var(--v3-ink-soft)', margin: '0 0 24px' }}>
          Create your free account to access exclusive content from{' '}
          <strong>{config?.heroTitle || config?.siteTitle || 'the creator'}</strong>
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="email" placeholder="Email address" value={email}
            onChange={(e) => setEmail(e.target.value)} required style={inputStyle} />
          <input type="text" placeholder="Username" value={username}
            onChange={(e) => setUsername(e.target.value)} required style={inputStyle} />
          <input type="password" placeholder="Password (min 8 characters)" value={password}
            onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
          <input type="password" placeholder="Confirm password" value={confirm}
            onChange={(e) => setConfirm(e.target.value)} required style={inputStyle} />
          {error && <p style={{ color: 'var(--v3-danger)', fontSize: '0.84rem', margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} className="v3-btn v3-btn-primary"
            style={{ marginTop: 4, opacity: loading ? 0.7 : 1, width: '100%' }}>
            {loading ? 'Creating account…' : 'Create Account — Free'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 22, fontSize: '0.88rem', color: 'var(--v3-ink-soft)' }}>
          Already a member?{' '}
          <Link to="/login" style={{ color: 'var(--v3-terracotta)', textDecoration: 'none', fontWeight: 700 }}>
            Sign in
          </Link>
        </p>
        <p style={{ textAlign: 'center', marginTop: 14, fontSize: '0.74rem', color: 'var(--v3-muted)' }}>
          By joining you confirm you are 18 or older.
        </p>
      </div>
    </div>
  );
};

export default Register;
