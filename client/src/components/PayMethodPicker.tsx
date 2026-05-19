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
  // Card path is intentionally disabled until a real card processor is wired
  // (Verotel / xMoney / Centrobill etc). The current 'card' provider is a stub
  // that errors with "card does not support createCheckout()". Re-enable by
  // changing this to `providers.includes('card')` once a real processor is live.
  const hasCard = false;
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

  // Lifetime / one-time language for the price hint
  const accessHint =
    productType === 'collection_unlock' ? 'Lifetime access' :
    productType === 'ppv_message'       ? 'Unlock this message' :
                                          'One-time unlock';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(20, 12, 10, 0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'v3-fade-in 0.18s ease',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fffaf4', borderRadius: 20,
          width: '100%', maxWidth: 440,
          boxShadow: '0 20px 60px rgba(0,0,0,0.30)',
          overflow: 'hidden',
          animation: 'v3-zoom-in 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
        {/* Header — title + price side by side, no eyebrow */}
        <div style={{
          position: 'relative',
          padding: '22px 52px 18px 24px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          background: 'linear-gradient(180deg, #fffaf4 0%, #fff5ec 100%)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.66rem', color: 'var(--v3-terracotta)', letterSpacing: 2, textTransform: 'uppercase', margin: 0, fontWeight: 700 }}>
                Checkout
              </p>
              <h2 style={{
                margin: '6px 0 4px', fontSize: '1.05rem',
                color: 'var(--v3-ink)', fontWeight: 700,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {title || 'Unlock content'}
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--v3-muted)', margin: 0 }}>
                {accessHint}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{
                margin: 0, fontSize: '1.55rem', fontWeight: 800,
                color: 'var(--v3-ink)', letterSpacing: -0.5, lineHeight: 1,
              }}>
                ${amount.toFixed(2)}
              </p>
              <p style={{ fontSize: '0.7rem', color: 'var(--v3-muted)', margin: '4px 0 0' }}>USD</p>
            </div>
          </div>
          <button onClick={onClose} aria-label="Close"
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(255,255,255,0.8)',
              border: '1px solid rgba(0,0,0,0.06)',
              fontSize: '1rem', cursor: 'pointer',
              color: 'var(--v3-ink-soft)', lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '18px 20px 18px' }}>
          {error && (
            <div style={{
              padding: '10px 14px', background: 'rgba(220,38,38,0.08)',
              color: 'var(--v3-danger)', borderRadius: 10,
              fontSize: '0.84rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: '1rem' }}>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <p style={{ textAlign: 'center', color: 'var(--v3-muted)', padding: '24px 0' }}>Loading payment options…</p>
          ) : (
            <>
              {/* Wallet — top option (only if balance > 0) */}
              {walletBalance > 0 && (
                <>
                  <p style={sectionLabel}>Pay instantly</p>
                  <button
                    onClick={walletCanCover ? payFromWallet : undefined}
                    disabled={busy || !walletCanCover}
                    style={{
                      ...methodRow,
                      opacity: walletCanCover ? 1 : 0.6,
                      cursor: walletCanCover ? 'pointer' : 'not-allowed',
                      border: walletCanCover ? '2px solid var(--v3-terracotta)' : '1px solid rgba(0,0,0,0.07)',
                      background: walletCanCover ? 'linear-gradient(135deg, #fff5ec 0%, #ffeadd 100%)' : '#fff',
                    }}>
                    <span style={methodIcon('#c75a3e')}>💰</span>
                    <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <strong style={methodTitle}>Wallet</strong>
                      <span style={subtext}>
                        Balance ${walletBalance.toFixed(2)}
                        {!walletCanCover && (
                          <span style={{ color: 'var(--v3-danger)', marginLeft: 6, fontWeight: 600 }}>
                            (need ${(amount - walletBalance).toFixed(2)} more)
                          </span>
                        )}
                      </span>
                    </span>
                    {walletCanCover && (
                      <span style={{
                        fontSize: '0.66rem', fontWeight: 700, color: '#fff',
                        background: 'var(--v3-terracotta)', padding: '4px 8px',
                        borderRadius: 99, letterSpacing: 0.5,
                      }}>
                        ONE-TAP
                      </span>
                    )}
                  </button>
                </>
              )}

              {/* Saved cards */}
              {cards.length > 0 && (
                <>
                  <p style={sectionLabel}>Your cards</p>
                  {cards.map(c => (
                    <button key={c.id}
                      onClick={() => payWithSavedCard(c.id)}
                      disabled={busy}
                      style={methodRow}>
                      <span style={methodIcon('#2a4365')}>💳</span>
                      <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                        <strong style={methodTitle}>
                          {c.brand} •••• {c.last4}
                          {c.isDefault && <span style={badge}>Default</span>}
                        </strong>
                        <span style={subtext}>
                          Expires {String(c.expMonth).padStart(2, '0')}/{String(c.expYear).slice(-2)}
                        </span>
                      </span>
                      <span style={arrow}>→</span>
                    </button>
                  ))}
                </>
              )}

              {/* New card (intentionally disabled — hasCard is forced false) */}
              {hasCard && (
                <button
                  onClick={() => payViaCheckout('card')}
                  disabled={busy}
                  style={methodRow}>
                  <span style={methodIcon('#2a4365')}>＋</span>
                  <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                    <strong style={methodTitle}>Pay with a new card</strong>
                    <span style={subtext}>Save it for one-tap next time</span>
                  </span>
                  <span style={arrow}>→</span>
                </button>
              )}

              {/* Crypto via NOWPayments */}
              {hasCrypto && (
                <>
                  {(walletBalance > 0 || cards.length > 0) && <p style={sectionLabel}>Or use crypto</p>}
                  {!(walletBalance > 0 || cards.length > 0) && <p style={sectionLabel}>Pay with</p>}
                  <button
                    onClick={() => payViaCheckout('nowpayments')}
                    disabled={busy}
                    style={methodRow}>
                    <span style={methodIcon('#f7931a')}>🪙</span>
                    <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <strong style={methodTitle}>Crypto</strong>
                      <span style={subtext}>BTC · ETH · USDT · 350+ coins via NOWPayments</span>
                    </span>
                    <span style={arrow}>→</span>
                  </button>
                </>
              )}

              {/* Mock (dev only) */}
              {hasMock && !hasCard && !hasCrypto && (
                <button
                  onClick={() => payViaCheckout('mock')}
                  disabled={busy}
                  style={methodRow}>
                  <span style={methodIcon('#7c8693')}>🧪</span>
                  <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                    <strong style={methodTitle}>Test payment</strong>
                    <span style={subtext}>Dev mode — no real charge</span>
                  </span>
                  <span style={arrow}>→</span>
                </button>
              )}

              {/* Empty state */}
              {!hasCard && !hasCrypto && !hasMock && walletBalance === 0 && (
                <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem', textAlign: 'center', padding: '18px 0' }}>
                  No payment methods configured. Contact support.
                </p>
              )}

              {/* Fanvue alt path — logged-in only, never exposed to crawlers */}
              {fanvueUrl && (
                <>
                  <div style={{
                    margin: '18px 0 12px',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}>
                    <span style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
                    <span style={{ fontSize: '0.7rem', color: 'var(--v3-muted)', letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
                      Alt platform
                    </span>
                    <span style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
                  </div>
                  <a
                    href={fanvueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      ...methodRow,
                      background: 'linear-gradient(135deg, #fdf2ee 0%, #fae0d2 100%)',
                      border: '1px solid #f0c4b1',
                      textDecoration: 'none',
                    }}>
                    <span style={methodIcon('#a86048')}>💎</span>
                    <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <strong style={methodTitle}>Unlock on Fanvue</strong>
                      <span style={subtext}>My verified Fanvue page — card payments accepted</span>
                    </span>
                    <span style={arrow}>↗</span>
                  </a>
                </>
              )}
            </>
          )}

          {/* Trust footer — three small badges */}
          <div style={{
            marginTop: 16, padding: '12px 14px',
            background: 'rgba(0,0,0,0.025)',
            border: '1px solid rgba(0,0,0,0.05)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 8,
            fontSize: '0.72rem', color: 'var(--v3-ink-soft)',
          }}>
            <span style={trustBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3a9d52' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Encrypted
            </span>
            <span style={{ width: 1, height: 14, background: 'rgba(0,0,0,0.1)' }} />
            <span style={trustBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3a9d52' }}>
                <circle cx="12" cy="12" r="10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
              Discreet billing
            </span>
            <span style={{ width: 1, height: 14, background: 'rgba(0,0,0,0.1)' }} />
            <span style={trustBadge}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: '#3a9d52' }}>
                <path d="m9 11 3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              Instant unlock
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: '0.66rem',
  color: 'var(--v3-muted)',
  letterSpacing: 1.5,
  textTransform: 'uppercase',
  margin: '12px 0 6px',
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
  border: '1px solid rgba(0,0,0,0.07)',
  borderRadius: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.92rem',
  color: 'var(--v3-ink)',
  textAlign: 'left',
  transition: 'transform 0.15s, box-shadow 0.15s, border-color 0.15s',
};

const methodIcon = (color: string): React.CSSProperties => ({
  width: 38, height: 38, borderRadius: 10,
  background: `linear-gradient(135deg, ${color}26 0%, ${color}12 100%)`,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '1.15rem',
  flexShrink: 0,
});

const methodTitle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.92rem',
  fontWeight: 700,
  color: 'var(--v3-ink)',
  lineHeight: 1.2,
};

const arrow: React.CSSProperties = {
  color: 'var(--v3-muted)',
  fontSize: '1.1rem',
  flexShrink: 0,
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
  display: 'block',
  fontSize: '0.74rem',
  color: 'var(--v3-muted)',
  margin: '3px 0 0',
  lineHeight: 1.3,
};

const trustBadge: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontWeight: 600,
  flex: 1,
  justifyContent: 'center',
  whiteSpace: 'nowrap',
};
