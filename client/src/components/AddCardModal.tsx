import { useState } from 'react';
import { addPaymentMethod } from '../api';

interface Props {
  onClose: () => void;
  onAdded?: () => void;
}

const BRANDS = {
  visa: { name: 'Visa', color: '#1A1F71', short: 'VISA' },
  mastercard: { name: 'Mastercard', color: '#EB001B', short: 'MC' },
  amex: { name: 'American Express', color: '#006FCF', short: 'AMEX' },
  discover: { name: 'Discover', color: '#FF6000', short: 'DISC' },
};

// Detect brand from card number prefix (basic — real gateways do this server-side)
const detectBrand = (num: string): keyof typeof BRANDS | null => {
  const n = num.replace(/\s/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^6(011|5)/.test(n)) return 'discover';
  return null;
};

const formatCardNumber = (raw: string) => {
  const digits = raw.replace(/\D/g, '').slice(0, 19);
  return digits.replace(/(.{4})/g, '$1 ').trim();
};

export default function AddCardModal({ onClose, onAdded }: Props) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [cvc, setCvc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cleanNum = number.replace(/\s/g, '');
  const brand = detectBrand(cleanNum);
  const last4 = cleanNum.slice(-4);
  const previewMasked = cleanNum
    ? cleanNum.replace(/\d(?=\d{4})/g, '•').replace(/(.{4})/g, '$1 ').trim()
    : '•••• •••• •••• ••••';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (cleanNum.length < 13) { setError('Enter a valid card number'); return; }
    const m = parseInt(expMonth, 10), y = parseInt(expYear, 10);
    if (!m || m < 1 || m > 12) { setError('Invalid month'); return; }
    if (!y || y < new Date().getFullYear() % 100) { setError('Card is expired'); return; }
    if (!/^\d{3,4}$/.test(cvc)) { setError('Invalid CVC'); return; }
    setSubmitting(true);
    const r = await addPaymentMethod(
      { number: cleanNum, brand: brand || undefined, expMonth: m, expYear: 2000 + y, cvc },
      true,
    );
    setSubmitting(false);
    if (r?.method) {
      onAdded?.();
      onClose();
    } else {
      setError(r?.error || 'Failed to save card');
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
          width: '100%', maxWidth: 480,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--v3-rose-100)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', letterSpacing: 0.5 }}>Add a payment card</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: 'var(--v3-muted)' }}>
              Saved cards make every unlock a one-tap purchase
            </p>
          </div>
          <button onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--v3-muted)', lineHeight: 1 }}>
            ×
          </button>
        </div>

        {/* Card preview */}
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{
            background: brand ? BRANDS[brand].color : 'linear-gradient(135deg, #2a2a3e 0%, #1a1a2e 100%)',
            borderRadius: 12, padding: '18px 20px', color: '#fff',
            boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
            position: 'relative', minHeight: 130,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
              <span style={{ fontSize: '0.7rem', letterSpacing: 2, opacity: 0.8 }}>CARD</span>
              <span style={{ fontWeight: 800, fontSize: '0.92rem', letterSpacing: 1 }}>
                {brand ? BRANDS[brand].short : '••••'}
              </span>
            </div>
            <div style={{ marginTop: 28, fontSize: '1.15rem', letterSpacing: 3, fontFamily: 'monospace' }}>
              {previewMasked || '•••• •••• •••• ••••'}
            </div>
            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', opacity: 0.9 }}>
              <div>
                <div style={{ opacity: 0.7, marginBottom: 2 }}>CARDHOLDER</div>
                <div style={{ letterSpacing: 0.5 }}>{name.toUpperCase() || 'YOUR NAME'}</div>
              </div>
              <div>
                <div style={{ opacity: 0.7, marginBottom: 2 }}>EXPIRES</div>
                <div>{expMonth.padStart(2, '0') || 'MM'}/{expYear || 'YY'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={submit} style={{ padding: '20px 24px 16px' }}>
          {error && (
            <div style={{ padding: '8px 12px', background: 'rgba(220,38,38,0.10)', color: 'var(--v3-danger)', borderRadius: 8, fontSize: '0.84rem', marginBottom: 12 }}>
              {error}
            </div>
          )}

          <label style={fieldLabel}>Card number</label>
          <input
            value={number}
            onChange={e => setNumber(formatCardNumber(e.target.value))}
            placeholder="1234 5678 9012 3456"
            inputMode="numeric"
            autoComplete="cc-number"
            maxLength={23}
            style={input}
          />

          <label style={fieldLabel}>Cardholder name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="John Smith"
            autoComplete="cc-name"
            style={input}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={fieldLabel}>Month</label>
              <input
                value={expMonth}
                onChange={e => setExpMonth(e.target.value.replace(/\D/g, '').slice(0, 2))}
                placeholder="MM"
                inputMode="numeric"
                autoComplete="cc-exp-month"
                style={input}
              />
            </div>
            <div>
              <label style={fieldLabel}>Year</label>
              <input
                value={expYear}
                onChange={e => setExpYear(e.target.value.replace(/\D/g, '').slice(0, 2))}
                placeholder="YY"
                inputMode="numeric"
                autoComplete="cc-exp-year"
                style={input}
              />
            </div>
            <div>
              <label style={fieldLabel}>CVC</label>
              <input
                value={cvc}
                onChange={e => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="123"
                inputMode="numeric"
                autoComplete="cc-csc"
                style={input}
              />
            </div>
          </div>

          {/* Trust signals */}
          <div style={{
            marginTop: 16, padding: '10px 12px', background: 'var(--v3-cream)',
            borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
            fontSize: '0.78rem', color: 'var(--v3-ink-soft)',
          }}>
            <span style={{ fontSize: '1.1rem' }}>🔒</span>
            <div style={{ flex: 1 }}>
              <strong style={{ color: 'var(--v3-ink)' }}>Encrypted &amp; secure.</strong> Your card details are
              tokenized — we never see the full number. Discreet billing descriptor on your statement.
            </div>
          </div>

          {/* Accepted brands */}
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', opacity: 0.7 }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--v3-muted)' }}>WE ACCEPT</span>
            {(Object.keys(BRANDS) as Array<keyof typeof BRANDS>).map(b => (
              <span key={b} style={{
                fontSize: '0.66rem', fontWeight: 800, letterSpacing: 0.5,
                padding: '3px 8px', borderRadius: 5,
                color: '#fff', background: BRANDS[b].color,
              }}>
                {BRANDS[b].short}
              </span>
            ))}
          </div>

          {/* Action */}
          <div style={{ display: 'flex', gap: 10, marginTop: 18, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} disabled={submitting}
              style={{
                background: 'none', border: '1px solid var(--v3-rose-100)',
                borderRadius: 22, padding: '10px 18px', fontSize: '0.86rem',
                cursor: 'pointer', fontFamily: 'inherit', color: 'var(--v3-ink-soft)',
              }}>
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              style={{
                background: 'var(--v3-terracotta)', color: '#fff', border: 'none',
                borderRadius: 22, padding: '10px 22px', fontSize: '0.86rem', fontWeight: 700,
                cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.6 : 1,
              }}>
              {submitting ? 'Saving…' : last4 ? `Save card ending in ${last4}` : 'Save card'}
            </button>
          </div>

          <p style={{ marginTop: 10, fontSize: '0.7rem', color: 'var(--v3-muted)', textAlign: 'center' }}>
            Test mode — no real charges. Real gateway integration ships with Phase 6.
          </p>
        </form>
      </div>
    </div>
  );
}

const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: '0.74rem',
  color: 'var(--v3-muted)',
  margin: '12px 0 4px',
  fontWeight: 600,
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid var(--v3-rose-100)',
  fontFamily: 'inherit',
  fontSize: '0.92rem',
  outline: 'none',
  background: '#fff',
  color: 'var(--v3-ink)',
  boxSizing: 'border-box',
};
