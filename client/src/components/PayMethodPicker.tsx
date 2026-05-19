import { useEffect, useState } from 'react';
import {
  getPaymentMethods, getActivePaymentProviders, chargeSavedMethod,
  unlockPost, unlockCollection, unlockMessage,
  getWallet, spendFromWallet, getCreator,
  type SavedCard,
} from '../api';

type ProductType = 'post_unlock' | 'collection_unlock' | 'ppv_message';

interface Props {
  productType: ProductType;
  productId: number;
  amount: number;
  title?: string;
  /** Return URL after a hosted checkout redirect (e.g. '/vault', '/chat'). */
  returnPath?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Unified payment picker. Shows fan their options for completing an unlock:
 *  1. One-tap with default saved card (if any)
 *  2. Pick a different saved card
 *  3. Pay with crypto via NOWPayments hosted checkout
 *  4. Mock provider (dev only)
 *
 * Handles the actual charge / checkout-redirect flow per option.
 */
export default function PayMethodPicker({
  productType, productId, amount, title, returnPath = '/dashboard',
  onClose, onSuccess,
}: Props) {
  const [cards, setCards] = useState<SavedCard[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [fanvueUrl, setFanvueUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [m, p, w, c] = await Promise.all([
        getPaymentMethods().catch(() => ({ methods: [] })),
        getActivePaymentProviders().catch(() => ({ providers: [] })),
        getWallet().catch(() => ({ balance: 0 })),
        getCreator().catch(() => null),
      ]);
      setCards(m.methods || []);
      setProviders(p.providers || []);
      setWalletBalance(typeof w?.balance === 'number' ? w.balance : parseFloat(w?.balance || '0'));
      setFanvueUrl(c?.fanvueUrl || '');
      setLoading(false);
    })();
  }, []);

  const hasCrypto = providers.includes('nowpayments');
  const hasCard = providers.includes('card');
  const hasMock = providers.includes('mock');

  // Run the matching unlock fn
  const callUnlock = async (provider: string) => {
    if (productType === 'post_unlock') return unlockPost(productId, provider);
    if (productType === 'collection_unlock') return unlockCollection(productId, provider);
    return unlockMessage(productId, provider);
  };

  // Handler: pay via a hosted-checkout provider (nowpayments / mock)
  const payViaCheckout = async (provider: string) => {
    setBusy(true); setError(null);
    try {
      const res = await callUnlock(provider);
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
        setError('Payment did not complete');
      }
    } catch (err: any) {
      setError(err?.message || 'Payment failed');
    } finally {
      setBusy(false);
    }
  };

  // Handler: one-tap with a saved card
  const payWithSavedCard = async (paymentMethodId: number) => {
    setBusy(true); setError(null);
    try {
      const res = await chargeSavedMethod(paymentMethodId, productType, productId);
      if (res?.success || res?.alreadyUnlocked) {
        onSuccess?.();
        onClose();
      } else if (res?.error) {
        setError(res.error);
      } else {
        setError('Card charge failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Charge failed');
    } finally {
      setBusy(false);
    }
  };

  // Handler: pay from prepaid wallet balance
  const payFromWallet = async () => {
    setBusy(true); setError(null);
    try {
      const res = await spendFromWallet(productType, productId);
      if (res?.success || res?.alreadyUnlocked) {
        onSuccess?.();
        onClose();
      } else if (res?.error) {
        setError(res.error);
      } else {
        setError('Wallet charge failed');
      }
    } catch (err: any) {
      setError(err?.message || 'Wallet charge failed');
    } finally {
      setBusy(false);
    }
  };

  const walletCanCover = walletBalance >= amount;

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
          width: '100%', maxWidth: 440,
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
        }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--v3-rose-100)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '0.74rem', color: 'var(--v3-muted)', letterSpacing: 1.5, textTransform: 'uppercase', margin: 0 }}>
                Unlock
              </p>
              <h2 style={{ margin: '4px 0 0', fontSize: '1.1rem' }}>
                {title || 'Choose payment method'}
              </h2>
              <p style={{ margin: '4px 0 0', fontSize: '1.4rem', fontWeight: 800, color: 'var(--v3-terracotta)' }}>
                ${amount.toFixed(2)}
              </p>
            </div>
            <button onClick={onClose} aria-label="Close"
              style={{ background: 'none', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--v3-muted)', lineHeight: 1 }}>
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px 20px' }}>
          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(220,38,38,0.10)', color: 'var(--v3-danger)', borderRadius: 8, fontSize: '0.86rem', marginBottom: 14 }}>
              ⚠️ {error}
            </div>
          )}

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--v3-muted)', padding: '20px 0' }}>Loading…</p>
          ) : (
            <>
              {/* Wallet — top option when balance is sufficient */}
              {walletBalance > 0 && (
                <>
                  <p style={sectionLabel}>Wallet</p>
                  <button
                    onClick={walletCanCover ? payFromWallet : undefined}
                    disabled={busy || !walletCanCover}
                    style={{
                      ...methodRow,
                      opacity: walletCanCover ? 1 : 0.6,
                      cursor: walletCanCover ? 'pointer' : 'not-allowed',
                      border: walletCanCover ? '2px solid var(--v3-terracotta)' : '1px solid var(--v3-rose-100)',
                      background: walletCanCover ? 'var(--v3-rose-50)' : '#fff',
                    }}>
                    <span style={{ fontSize: '1.4rem' }}>💰</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>
                      <strong>Pay from wallet</strong>
                      <p style={subtext}>
                        Balance: ${walletBalance.toFixed(2)}
                        {!walletCanCover && (
                          <span style={{ color: 'var(--v3-danger)', marginLeft: 6 }}>
                            (need ${(amount - walletBalance).toFixed(2)} more)
                          </span>
                        )}
                      </p>
                    </span>
                    <span style={arrow}>{walletCanCover ? '⚡' : '→'}</span>
                  </button>
                </>
              )}

              {/* Saved cards */}
              {cards.length > 0 && (
                <>
                  <p style={sectionLabel}>Saved cards</p>
                  {cards.map(c => (
                    <button key={c.id}
                      onClick={() => payWithSavedCard(c.id)}
                      disabled={busy}
                      style={methodRow}>
                      <span style={{ fontSize: '1.4rem' }}>💳</span>
                      <span style={{ flex: 1, textAlign: 'left' }}>
                        <strong>{c.brand}</strong> •••• {c.last4}
                        <small style={{ color: 'var(--v3-muted)', marginLeft: 8 }}>
                          {String(c.expMonth).padStart(2, '0')}/{String(c.expYear).slice(-2)}
                        </small>
                        {c.isDefault && (
                          <span style={badge}>Default</span>
                        )}
                      </span>
                      <span style={arrow}>→</span>
                    </button>
                  ))}
                </>
              )}

              {/* New card */}
              {hasCard && (
                <button
                  onClick={() => payViaCheckout('card')}
                  disabled={busy}
                  style={methodRow}>
                  <span style={{ fontSize: '1.4rem' }}>＋</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    <strong>Pay with a new card</strong>
                    <p style={subtext}>Save it for one-tap next time</p>
                  </span>
                  <span style={arrow}>→</span>
                </button>
              )}

              {/* Crypto via NOWPayments */}
              {hasCrypto && (
                <button
                  onClick={() => payViaCheckout('nowpayments')}
                  disabled={busy}
                  style={methodRow}>
                  <span style={{ fontSize: '1.4rem' }}>🪙</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    <strong>Pay with crypto</strong>
                    <p style={subtext}>BTC · ETH · USDT · 350+ supported</p>
                  </span>
                  <span style={arrow}>→</span>
                </button>
              )}

              {/* Mock (dev only) */}
              {hasMock && !hasCard && !hasCrypto && (
                <button
                  onClick={() => payViaCheckout('mock')}
                  disabled={busy}
                  style={methodRow}>
                  <span style={{ fontSize: '1.4rem' }}>🧪</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    <strong>Test payment</strong>
                    <p style={subtext}>Dev mode — no real charge</p>
                  </span>
                  <span style={arrow}>→</span>
                </button>
              )}

              {/* Empty state */}
              {!hasCard && !hasCrypto && !hasMock && (
                <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem', textAlign: 'center', padding: '14px 0' }}>
                  No payment methods configured. Contact support.
                </p>
              )}

              {/* Fanvue alt path — logged-in only, never exposed to crawlers */}
              {fanvueUrl && (
                <>
                  <p style={{ ...sectionLabel, marginTop: 14, textAlign: 'center' }}>
                    Or prefer another platform?
                  </p>
                  <a
                    href={fanvueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      ...methodRow,
                      background: 'linear-gradient(135deg, #fff7f1 0%, #ffe6dc 100%)',
                      textDecoration: 'none',
                    }}>
                    <span style={{ fontSize: '1.4rem' }}>💎</span>
                    <span style={{ flex: 1, textAlign: 'left' }}>
                      <strong>Unlock on Fanvue</strong>
                      <p style={subtext}>Pay with card on my verified Fanvue page</p>
                    </span>
                    <span style={arrow}>↗</span>
                  </a>
                </>
              )}
            </>
          )}

          {/* Trust footer */}
          <div style={{
            marginTop: 14, padding: '10px 12px', background: 'var(--v3-cream)',
            borderRadius: 10, display: 'flex', alignItems: 'center', gap: 10,
            fontSize: '0.76rem', color: 'var(--v3-ink-soft)',
          }}>
            <span style={{ fontSize: '1rem' }}>🔒</span>
            <span><strong style={{ color: 'var(--v3-ink)' }}>Secure checkout.</strong> Cards are tokenized · crypto goes through industry-standard processors · discreet billing descriptor.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: '0.7rem',
  color: 'var(--v3-muted)',
  letterSpacing: 1,
  textTransform: 'uppercase',
  margin: '4px 0 6px',
  fontWeight: 700,
};

const methodRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  padding: '12px 14px',
  marginBottom: 8,
  background: '#fff',
  border: '1px solid var(--v3-rose-100)',
  borderRadius: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.92rem',
  color: 'var(--v3-ink)',
  textAlign: 'left',
  transition: 'background 0.15s',
};

const arrow: React.CSSProperties = {
  color: 'var(--v3-muted)',
  fontSize: '1.1rem',
};

const badge: React.CSSProperties = {
  marginLeft: 8,
  fontSize: 10,
  background: 'var(--v3-rose-100)',
  color: 'var(--v3-terracotta)',
  padding: '2px 8px',
  borderRadius: 10,
  fontWeight: 700,
};

const subtext: React.CSSProperties = {
  fontSize: '0.74rem',
  color: 'var(--v3-muted)',
  margin: '2px 0 0',
};
