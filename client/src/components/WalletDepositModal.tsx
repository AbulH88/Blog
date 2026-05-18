import { useState } from 'react';
import { depositToWallet } from '../api';

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
  /** Suggested amount (e.g. when fan needs to top up to afford a specific unlock). */
  suggested?: number;
  /** Where to send fan back after returning from hosted checkout. */
  returnPath?: string;
}

const PRESETS = [10, 25, 50, 100, 250];

const SUPPORTED = [
  { code: 'USDT', name: 'Tether', badge: 'TRX', color: '#26a17b' },
  { code: 'BTC',  name: 'Bitcoin', badge: 'BTC', color: '#f7931a' },
  { code: 'ETH',  name: 'Ethereum', badge: 'ETH', color: '#627eea' },
  { code: 'BNB',  name: 'BNB',     badge: 'BNB', color: '#f3ba2f' },
  { code: 'LTC',  name: 'Litecoin', badge: 'LTC', color: '#345d9d' },
  { code: 'DOGE', name: 'Dogecoin', badge: 'DOGE', color: '#c2a633' },
];

/**
 * NOWPayments-styled deposit modal. The fan picks an amount, we create an
 * invoice on NOWPayments, fan picks the actual coin on NOWPayments' hosted
 * checkout (350+ supported), pays, lands back on /payment/return.
 */
export default function WalletDepositModal({ onClose, onSuccess, suggested, returnPath = '/dashboard' }: Props) {
  const [amount, setAmount] = useState<number>(suggested || 25);
  const [custom, setCustom] = useState('');
  const [pickedCoin, setPickedCoin] = useState(SUPPORTED[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalAmount = custom ? parseFloat(custom) : amount;
  const usingCustom = custom.length > 0;

  const submit = async () => {
    setError(null);
    if (!finalAmount || finalAmount < 5 || finalAmount > 1000) {
      setError('Amount must be between $5 and $1000');
      return;
    }
    setSubmitting(true);
    const res = await depositToWallet(finalAmount, 'nowpayments');
    setSubmitting(false);
    if (res?.redirectUrl) {
      const ret = encodeURIComponent(returnPath);
      window.location.href = `${res.redirectUrl}${res.redirectUrl.includes('?') ? '&' : '?'}return=${ret}&tx=${res.transactionId}`;
      return;
    }
    if (res?.success) {
      onSuccess?.();
      onClose();
    } else if (res?.error) {
      setError(res.error);
    } else {
      setError('Unexpected — please try again');
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, backdropFilter: 'blur(4px)',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 18,
          width: '100%', maxWidth: 880,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '1fr 1.4fr',
        }}>
        {/* LEFT — preview card (decorative, NOWPayments-style) */}
        <div style={{
          background: 'linear-gradient(135deg, #fff8f3 0%, #ffe8e0 100%)',
          padding: 28, display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{
              background: '#fff', borderRadius: 14, padding: 18,
              boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--v3-ink)' }}>Wallet top-up</span>
                <span style={{
                  background: pickedCoin.color, color: '#fff', borderRadius: 99,
                  width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: '0.7rem',
                }}>
                  {pickedCoin.badge.slice(0, 1)}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                <span style={chip(true)}>1. Choose amount</span>
                <span style={chip(false)}>2. Pick coin</span>
                <span style={chip(false)}>3. Send</span>
              </div>
              <div style={{
                background: 'var(--v3-rose-50)', borderRadius: 10, padding: '10px 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 12,
              }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--v3-muted)' }}>Currency</span>
                <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                  {pickedCoin.code} <span style={{ fontSize: '0.66rem', background: pickedCoin.color, color: '#fff', padding: '1px 6px', borderRadius: 5 }}>{pickedCoin.badge}</span>
                </span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--v3-muted)', marginBottom: 4 }}>You'll add</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--v3-ink)', letterSpacing: -0.5 }}>
                ${finalAmount > 0 ? finalAmount.toFixed(2) : '0.00'}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--v3-muted)', marginTop: 4 }}>
                ≈ {(finalAmount / 30000).toFixed(8).replace(/0+$/, '0')} BTC
              </div>
              <button
                disabled
                style={{
                  marginTop: 14, width: '100%',
                  background: 'var(--v3-terracotta)', color: '#fff',
                  border: 'none', borderRadius: 22, padding: '10px 0',
                  fontWeight: 700, fontSize: '0.86rem', opacity: 0.85,
                  cursor: 'default',
                }}>
                Create payment
              </button>
            </div>
            <p style={{ marginTop: 14, fontSize: '0.72rem', color: 'var(--v3-muted)', textAlign: 'center' }}>
              Powered by <strong style={{ color: 'var(--v3-ink)' }}>NOWPayments</strong>
            </p>
          </div>
          {/* decorative coin shapes */}
          <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(247,147,26,0.12)' }} />
          <div style={{ position: 'absolute', bottom: -40, left: -30, width: 90, height: 90, borderRadius: '50%', background: 'rgba(98,126,234,0.1)' }} />
        </div>

        {/* RIGHT — actual form */}
        <div style={{ padding: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: -0.3 }}>
                Add money to your wallet
              </h2>
              <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: 'var(--v3-muted)', lineHeight: 1.4 }}>
                Top up once, unlock content with one tap — no card form every time.
              </p>
            </div>
            <button onClick={onClose} aria-label="Close"
              style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--v3-muted)', lineHeight: 1 }}>
              ×
            </button>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', background: 'rgba(220,38,38,0.10)', color: 'var(--v3-danger)',
              borderRadius: 8, fontSize: '0.84rem', marginBottom: 14,
            }}>⚠️ {error}</div>
          )}

          <label style={sectionLabel}>Pick an amount</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 12 }}>
            {PRESETS.map(p => {
              const isPicked = !usingCustom && amount === p;
              return (
                <button
                  key={p}
                  onClick={() => { setAmount(p); setCustom(''); }}
                  style={{
                    padding: '10px 0',
                    border: isPicked ? '2px solid var(--v3-terracotta)' : '1px solid var(--v3-rose-100)',
                    background: isPicked ? 'var(--v3-rose-50)' : '#fff',
                    color: 'var(--v3-ink)',
                    borderRadius: 10, cursor: 'pointer',
                    fontWeight: 700, fontSize: '0.92rem',
                    fontFamily: 'inherit',
                  }}>
                  ${p}
                </button>
              );
            })}
          </div>

          <label style={sectionLabel}>Or custom amount</label>
          <div style={{ position: 'relative', marginBottom: 18 }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--v3-muted)', fontWeight: 600,
            }}>$</span>
            <input
              type="number"
              min={5}
              max={1000}
              step={1}
              placeholder="0"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              style={{
                width: '100%', padding: '11px 14px 11px 28px', borderRadius: 10,
                border: '1px solid var(--v3-rose-100)', fontSize: '0.95rem',
                fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
              }}
            />
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--v3-muted)', fontSize: '0.78rem' }}>
              $5–$1,000
            </span>
          </div>

          <label style={sectionLabel}>Preferred coin (you can change on the next page)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 18 }}>
            {SUPPORTED.map(c => {
              const picked = pickedCoin.code === c.code;
              return (
                <button
                  key={c.code}
                  onClick={() => setPickedCoin(c)}
                  style={{
                    padding: '10px 8px', display: 'flex', alignItems: 'center', gap: 8,
                    border: picked ? '2px solid var(--v3-terracotta)' : '1px solid var(--v3-rose-100)',
                    background: picked ? 'var(--v3-rose-50)' : '#fff',
                    borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit',
                  }}>
                  <span style={{
                    background: c.color, color: '#fff',
                    width: 24, height: 24, borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '0.62rem', flexShrink: 0,
                  }}>{c.badge.slice(0, 1)}</span>
                  <div style={{ textAlign: 'left', overflow: 'hidden' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--v3-ink)' }}>{c.code}</div>
                    <div style={{ fontSize: '0.66rem', color: 'var(--v3-muted)' }}>{c.name}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            onClick={submit}
            disabled={submitting || !finalAmount}
            style={{
              width: '100%',
              background: 'var(--v3-terracotta)', color: '#fff',
              border: 'none', borderRadius: 22, padding: '13px 0',
              fontWeight: 700, fontSize: '0.96rem',
              cursor: submitting ? 'wait' : 'pointer',
              opacity: submitting ? 0.6 : 1,
            }}>
            {submitting ? 'Creating invoice…' : `Continue with $${finalAmount.toFixed(2)}`}
          </button>

          <div style={{
            marginTop: 14, padding: '10px 12px', background: 'var(--v3-cream)',
            borderRadius: 10, fontSize: '0.76rem', color: 'var(--v3-ink-soft)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontSize: '1.1rem' }}>🔒</span>
            <span>
              You'll be redirected to a secure NOWPayments checkout to pay in the coin of your choice.
              Funds credit your wallet automatically once the transaction confirms (typically 5–15 min).
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '0.74rem',
  color: 'var(--v3-muted)',
  fontWeight: 700,
  letterSpacing: 0.5,
  textTransform: 'uppercase',
  marginBottom: 6,
};

const chip = (active: boolean): React.CSSProperties => ({
  fontSize: '0.6rem',
  background: active ? 'var(--v3-terracotta)' : 'var(--v3-rose-100)',
  color: active ? '#fff' : 'var(--v3-ink-soft)',
  padding: '3px 6px',
  borderRadius: 5,
  fontWeight: 700,
  letterSpacing: 0.3,
});
