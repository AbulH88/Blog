import { useState } from 'react';
import { subscribe, CREATOR_SLUG } from '../api';

interface Props {
  prices: { basic: number; premium: number };
  creatorName: string;
  onSuccess: () => void;
  onClose: () => void;
}

const SubscribeModal = ({ prices, creatorName, onSuccess, onClose }: Props) => {
  const [tier, setTier] = useState<'basic' | 'premium'>('basic');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const price = tier === 'premium' ? prices.premium : prices.basic;

  const handleSubscribe = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await subscribe(CREATOR_SLUG, tier);
      if (res.success) {
        onSuccess();
      } else {
        setError(res.error || 'Something went wrong');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        background: '#111', border: '1px solid #2a2a2a', borderRadius: 16,
        padding: '32px 28px', width: '100%', maxWidth: 420, position: 'relative',
      }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: '#666', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>

        <h2 style={{ margin: '0 0 6px', fontSize: '1.3rem' }}>Join {creatorName}</h2>
        <p style={{ margin: '0 0 24px', fontSize: '0.85rem', color: 'var(--secondary)' }}>
          Choose your membership plan
        </p>

        {/* Plan selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
          {(['basic', 'premium'] as const).map(t => (
            <div
              key={t}
              onClick={() => setTier(t)}
              style={{
                padding: '16px 18px', borderRadius: 10, cursor: 'pointer',
                border: `2px solid ${tier === t ? 'var(--primary)' : '#2a2a2a'}`,
                background: tier === t ? 'rgba(255,255,255,0.04)' : 'transparent',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                transition: 'border-color 0.2s',
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 700, textTransform: 'capitalize' }}>{t}</p>
                <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--secondary)' }}>
                  {t === 'basic' ? 'Full Vault access + messaging' : 'Vault + Priority DMs + Exclusive content'}
                </p>
              </div>
              <span style={{ fontWeight: 800, fontSize: '1.05rem', whiteSpace: 'nowrap', marginLeft: 16 }}>
                ${t === 'premium' ? prices.premium : prices.basic}<span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#666' }}>/mo</span>
              </span>
            </div>
          ))}
        </div>

        {/* Mock card form — replaced by Stripe in Phase 6 */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#555', textTransform: 'uppercase', letterSpacing: 1 }}>Payment details</p>
          <input disabled placeholder="Card number" style={{ width: '100%', marginBottom: 8, padding: '10px 12px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#555', fontSize: '0.85rem', boxSizing: 'border-box' }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <input disabled placeholder="MM / YY" style={{ padding: '10px 12px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#555', fontSize: '0.85rem' }} />
            <input disabled placeholder="CVV" style={{ padding: '10px 12px', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#555', fontSize: '0.85rem' }} />
          </div>
          <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: '#444' }}>
            💳 Stripe payments coming soon — membership is free during beta
          </p>
        </div>

        {error && <p style={{ color: '#f87171', fontSize: '0.82rem', marginBottom: 12 }}>{error}</p>}

        <button
          onClick={handleSubscribe}
          disabled={loading}
          className="btn btn-primary"
          style={{ width: '100%', padding: '14px', fontSize: '0.95rem', opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Processing…' : `Start ${tier.charAt(0).toUpperCase() + tier.slice(1)} — $${price}/mo`}
        </button>

        <p style={{ textAlign: 'center', marginTop: 12, fontSize: '0.72rem', color: '#444' }}>
          Cancel anytime. No hidden fees.
        </p>
      </div>
    </div>
  );
};

export default SubscribeModal;
