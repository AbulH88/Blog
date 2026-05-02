import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '../api';

const Login = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await login(password);
    if (res.token) {
      localStorage.setItem('adminToken', res.token);
      navigate('/admin');
    } else {
      setError('Invalid password');
    }
  };

  return (
    <div style={{ padding: '100px 0', maxWidth: '300px', margin: '0 auto', textAlign: 'center' }}>
      <h1>Admin Login</h1>
      <form onSubmit={handleSubmit} className="form-group" style={{ marginTop: '20px' }}>
        <input 
          type="password" 
          placeholder="Enter Admin Password" 
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ marginBottom: '10px' }}
        />
        {error && <p style={{ color: 'red', fontSize: '0.8rem' }}>{error}</p>}
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Login</button>
      </form>
    </div>
  );
};

export default Login;
