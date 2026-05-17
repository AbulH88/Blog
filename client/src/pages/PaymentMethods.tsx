import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getPaymentMethods,
  addPaymentMethod,
  removePaymentMethod,
  setDefaultPaymentMethod,
  type SavedCard,
} from '../api';

/**
 * Saved-card management. Uses MockCardProvider on the backend until a
 * real card gateway is plugged in — once that happens, the inline form
 * is replaced by the gateway's iframe SDK, but everything else (list,
 * default, delete) stays the same.
 */
export default function PaymentMethods() {
  const nav = useNavigate();
  const [methods, setMethods] = useState<SavedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ number: '', expMonth: 12, expYear: 2030, cvc: '' });
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const r = await getPaymentMethods();
    setMethods(r.methods || []);
    setLoading(false);
  };

  useEffect(() => {
    if (!localStorage.getItem('fanToken')) { nav('/login'); return; }
    load();
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const r = await addPaymentMethod(form, true);
    setSubmitting(false);
    if (r?.method) {
      setForm({ number: '', expMonth: 12, expYear: 2030, cvc: '' });
      load();
    } else {
      alert(r?.error || 'Failed to save card');
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Remove this card?')) return;
    await removePaymentMethod(id);
    load();
  };

  const makeDefault = async (id: number) => {
    await setDefaultPaymentMethod(id);
    load();
  };

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', padding: 24 }}>
      <h1 style={{ marginBottom: 8 }}>💳 Payment Methods</h1>
      <p style={{ opacity: 0.7, marginBottom: 24 }}>
        Saved cards make every unlock a one-tap purchase.
      </p>

      <h3>Your cards</h3>
      {loading ? (
        <p>Loading…</p>
      ) : methods.length === 0 ? (
        <p style={{ opacity: 0.6 }}>No saved cards yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {methods.map((m) => (
            <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, border: '1px solid #2a2a2a', borderRadius: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 20 }}>💳</span>
              <span style={{ flex: 1 }}>
                {m.brand} •••• {m.last4} &nbsp; <small style={{ opacity: 0.6 }}>{String(m.expMonth).padStart(2, '0')}/{m.expYear}</small>
                {m.isDefault && <span style={{ marginLeft: 8, fontSize: 11, background: '#1f1f1f', padding: '2px 6px', borderRadius: 4 }}>DEFAULT</span>}
              </span>
              {!m.isDefault && <button onClick={() => makeDefault(m.id)} style={{ fontSize: 12 }}>Make default</button>}
              <button onClick={() => remove(m.id)} style={{ fontSize: 12, color: '#e55' }}>Remove</button>
            </li>
          ))}
        </ul>
      )}

      <h3 style={{ marginTop: 32 }}>Add a card</h3>
      <form onSubmit={submit} style={{ display: 'grid', gap: 12, maxWidth: 400 }}>
        <input
          required
          placeholder="Card number (e.g. 4242 4242 4242 4242)"
          value={form.number}
          onChange={(e) => setForm({ ...form, number: e.target.value })}
        />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <input
            required type="number" min={1} max={12}
            placeholder="MM"
            value={form.expMonth}
            onChange={(e) => setForm({ ...form, expMonth: Number(e.target.value) })}
          />
          <input
            required type="number" min={2024} max={2050}
            placeholder="YYYY"
            value={form.expYear}
            onChange={(e) => setForm({ ...form, expYear: Number(e.target.value) })}
          />
          <input
            required
            placeholder="CVC"
            value={form.cvc}
            onChange={(e) => setForm({ ...form, cvc: e.target.value })}
          />
        </div>
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save card'}
        </button>
        <small style={{ opacity: 0.5 }}>
          Test mode — cards are not charged. Real gateway integration coming once provider is selected.
        </small>
      </form>
    </div>
  );
}
