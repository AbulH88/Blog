import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { getMySubscriptions, getMyTransactions, unsubscribe, CREATOR_SLUG } from '../api';

const FanDashboard = () => {
  const [subs, setSubs] = useState<any[]>([]);
  const [txns, setTxns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fanUser = JSON.parse(localStorage.getItem('fanUser') || 'null');

  useEffect(() => {
    if (!localStorage.getItem('fanToken')) { navigate('/login'); return; }
    const load = async () => {
      const [s, t] = await Promise.all([getMySubscriptions(), getMyTransactions()]);
      setSubs(s || []);
      setTxns(t || []);
      setLoading(false);
    };
    load();
  }, [navigate]);

  const handleUnsubscribe = async (slug: string) => {
    if (!window.confirm('Cancel this subscription?')) return;
    await unsubscribe(slug);
    setSubs(prev => prev.filter(s => s.Creator?.slug !== slug));
  };

  const handleLogout = () => {
    localStorage.removeItem('fanToken');
    localStorage.removeItem('fanUser');
    navigate('/');
  };

  if (loading) return <div className="loading">Loading…</div>;

  return (
    <div style={{ padding: '80px 20px', maxWidth: 680, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 40, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: '0 0 6px' }}>My Account</h1>
          <p style={{ margin: 0, color: 'var(--secondary)', fontSize: '0.9rem' }}>{fanUser?.email}</p>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 20px', fontSize: '0.8rem', color: '#aaa' }}>
          Sign out
        </button>
      </div>

      {/* Active memberships */}
      <section style={{ marginBottom: 40 }}>
        <h3 style={{ marginBottom: 16, fontSize: '0.8rem', letterSpacing: 3, textTransform: 'uppercase', color: 'var(--secondary)' }}>Active Memberships</h3>
        {subs.length === 0 ? (
          <div style={{ padding: '28px 24px', background: '#111', border: '1px solid #2a2a2a', borderRadius: 12, textAlign: 'center' }}>
            <p style={{ margin: '0 0 16px', color: 'var(--secondary)' }}>No active memberships</p>
            <Link to="/vip" className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '0.85rem' }}>Join the Club</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {subs.map(sub => (
              <div key={sub.id} style={{ padding: '18px 20px', background: '#111', border: '1px solid #2a2a2a', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <p style={{ margin: 0, fontWeight: 700 }}>{sub.Creator?.displayName || sub.Creator?.slug}</p>
                  <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--secondary)', textTransform: 'capitalize' }}>
                    {sub.tier} · renews {new Date(sub.renewalDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Link to="/vault" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>Open Vault</Link>
                  <button onClick={() => handleUnsubscribe(sub.Creator?.slug || CREATOR_SLUG)} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.8rem', color: '#f87171', borderColor: '#f87171' }}>Cancel</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Spending history */}
      <section>
        <h3 style={{ marginBottom: 16, fontSize: '0.8rem', letterSpacing: 3, textTransform: 'uppercase', color: 'var(--secondary)' }}>Spending History</h3>
        {txns.length === 0 ? (
          <p style={{ color: '#555', fontSize: '0.85rem' }}>No transactions yet.</p>
        ) : (
          <div style={{ border: '1px solid #2a2a2a', borderRadius: 12, overflow: 'hidden' }}>
            {txns.map((t, i) => (
              <div key={t.id} style={{ padding: '14px 20px', display: 'flex', justifyContent: 'space-between', borderBottom: i < txns.length - 1 ? '1px solid #1a1a1a' : 'none' }}>
                <div>
                  <p style={{ margin: 0, fontSize: '0.88rem' }}>{t.description}</p>
                  <p style={{ margin: '3px 0 0', fontSize: '0.75rem', color: '#555' }}>{new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>${parseFloat(t.amount).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default FanDashboard;
