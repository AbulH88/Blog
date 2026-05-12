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
        navigate('/vip');
      } else {
        setError(res.error || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '80px 20px', maxWidth: '380px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '8px' }}>Join the Club</h1>
      <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--secondary)', marginBottom: '32px' }}>
        Create your free account to access exclusive content from{' '}
        <strong>{config?.heroTitle || 'the creator'}</strong>
      </p>

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
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: '#111', color: '#fff' }}
        />
        <input
          type="password"
          placeholder="Password (min 8 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: '#111', color: '#fff' }}
        />
        <input
          type="password"
          placeholder="Confirm password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          style={{ padding: '12px', borderRadius: '6px', border: '1px solid var(--border)', background: '#111', color: '#fff' }}
        />
        {error && <p style={{ color: '#f87171', fontSize: '0.82rem', margin: 0 }}>{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={loading}
          style={{ padding: '13px', marginTop: '4px', opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Creating account…' : 'Create Account — Free'}
        </button>
      </form>

      <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '0.85rem', color: 'var(--secondary)' }}>
        Already a member?{' '}
        <Link to="/login" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>Sign in</Link>
      </p>

      <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '0.75rem', color: '#555' }}>
        By joining you confirm you are 18 or older.
      </p>
    </div>
  );
};

export default Register;
