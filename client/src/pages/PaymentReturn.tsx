import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getTransactionStatus } from '../api';

/**
 * Landing page after a fan returns from a hosted checkout (NOWPayments).
 * Polls /api/payments/status/:id every 2s for up to 90s, then surfaces
 * outcome and bounces them back to wherever they came from.
 */
export default function PaymentReturn() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const txId = params.get('tx');
  const returnTo = params.get('return') || '/dashboard';
  const [status, setStatus] = useState<string>('pending');
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!txId) return;
    let cancelled = false;
    const poll = async () => {
      const res = await getTransactionStatus(Number(txId));
      if (cancelled) return;
      setStatus(res.status || 'pending');
      if (res.status && res.status !== 'pending') return;
      setTries((n) => n + 1);
    };
    poll();
    const iv = setInterval(() => { if (!cancelled && status === 'pending' && tries < 45) poll(); }, 2000);
    return () => { cancelled = true; clearInterval(iv); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [txId, status, tries]);

  useEffect(() => {
    if (status === 'completed') {
      const t = setTimeout(() => nav(returnTo), 1500);
      return () => clearTimeout(t);
    }
  }, [status, returnTo, nav]);

  return (
    <div style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
      <div>
        {status === 'pending' && (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <h2>Confirming payment…</h2>
            <p style={{ opacity: 0.7 }}>Crypto payments usually settle in under a minute.</p>
          </>
        )}
        {status === 'completed' && (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <h2>Payment received</h2>
            <p style={{ opacity: 0.7 }}>Redirecting you back…</p>
          </>
        )}
        {(status === 'failed' || status === 'refunded') && (
          <>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
            <h2>Payment {status}</h2>
            <button onClick={() => nav(returnTo)} style={{ marginTop: 16 }}>Go back</button>
          </>
        )}
        {tries >= 45 && status === 'pending' && (
          <p style={{ marginTop: 12, opacity: 0.6 }}>
            Still pending. Refresh later — you'll get the unlock as soon as the network confirms.
          </p>
        )}
      </div>
    </div>
  );
}
