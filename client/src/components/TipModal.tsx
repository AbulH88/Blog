import { useEffect, useState } from 'react';
import { getPaymentMethods, sendTip, type SavedCard } from '../api';

interface Props {
  creatorId: number;
  creatorName?: string;
  onClose: () => void;
  onSuccess?: (amount: number) => void;
}

const PRESETS = [5, 10, 25, 50];

export default function TipModal({ creatorId, creatorName, onClose, onSuccess }: Props) {
  const [amount, setAmount] = useState<number>(10);
  const [custom, setCustom] = useState('');
  const [message, setMessage] = useState('');
  const [methods, setMethods] = useState<SavedCard[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getPaymentMethods().then(r => setMethods(r.methods || [])).catch(() => {});
  }, []);

  const finalAmount = custom ? parseFloat(custom) : amount;
  const defaultCard = methods.find(m => m.isDefault) || methods[0] || null;

  const submit = async () => {
    if (!finalAmount || finalAmount < 1 || finalAmount > 1000) {
      alert('Tip must be between $1 and $1000');
      return;
    }
    setSubmitting(true);
    const r = await sendTip(creatorId, finalAmount, {
      message: message.trim() || undefined,
      paymentMethodId: defaultCard?.id,
    });
    setSubmitting(false);
    if (r?.redirectUrl) {
      window.location.href = r.redirectUrl;
      return;
    }
    if (r?.success) {
      onSuccess?.(finalAmount);
      onClose();
    } else {
      alert(r?.error || 'Tip failed');
    }
  };

  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()}
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 14, padding: 24, maxWidth: 380, width: '100%' }}>
        <h3 style={{ marginTop: 0 }}>💰 Send a tip{creatorName ? ` to ${creatorName}` : ''}</h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
          {PRESETS.map(p => (
            <button key={p}
              onClick={() => { setAmount(p); setCustom(''); }}
              style={{
                padding: '10px 0',
                border: amount === p && !custom ? '2px solid var(--v3-terracotta, #c45c3a)' : '1px solid #333',
                background: 'none', color: '#fff', borderRadius: 8,
                cursor: 'pointer', fontWeight: 600,
              }}>
              ${p}
            </button>
          ))}
        </div>

        <input
          type="number"
          min={1} max={1000} step={1}
          placeholder="Custom amount"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          style={{ width: '100%', padding: 10, marginBottom: 12, borderRadius: 8, border: '1px solid #333', background: '#0f0f0f', color: '#fff' }}
        />

        <textarea
          placeholder="Add a message (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={200}
          rows={3}
          style={{ width: '100%', padding: 10, marginBottom: 12, borderRadius: 8, border: '1px solid #333', background: '#0f0f0f', color: '#fff', resize: 'vertical' }}
        />

        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
          {defaultCard
            ? <>Paying with {defaultCard.brand} •••• {defaultCard.last4}</>
            : <>No saved card — you'll be redirected to checkout. <a href="/dashboard/payment-methods" style={{ color: 'var(--v3-terracotta, #c45c3a)' }}>Add a card</a> for one-tap.</>
          }
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={submitting}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #333', background: 'none', color: '#aaa', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={submit} disabled={submitting || !finalAmount || finalAmount < 1}
            style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--v3-terracotta, #c45c3a)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
            {submitting ? 'Sending…' : `Send $${finalAmount || 0}`}
          </button>
        </div>
      </div>
    </div>
  );
}
