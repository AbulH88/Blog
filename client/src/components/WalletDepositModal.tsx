import { useEffect, useMemo, useState } from 'react';
import { depositToWallet, getWalletCoins, getCreator, type WalletCoin } from '../api';

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
  /** Suggested amount (e.g. when fan needs to top up to afford a specific unlock). */
  suggested?: number;
  /** Where to send fan back after returning from hosted checkout. */
  returnPath?: string;
}

// Static fallback so the modal still renders if /api/wallet/coins is slow.
// Live mins come from NOWPayments on mount.
const FALLBACK_COINS: WalletCoin[] = [
  { code: 'usdttrc20', label: 'USDT (Tron)',     icon: '💲', min: 2,  hint: 'Cheapest fees' },
  { code: 'trx',       label: 'TRON (TRX)',      icon: '🔴', min: 1,  hint: 'Cheapest coin' },
  { code: 'ltc',       label: 'Litecoin (LTC)',  icon: '🟡', min: 3,  hint: 'Fast + cheap' },
  { code: 'sol',       label: 'Solana (SOL)',    icon: '🟣', min: 5,  hint: 'Fast, low fees' },
  { code: 'eth',       label: 'Ethereum (ETH)',  icon: '⚪', min: 10, hint: 'Mid fees' },
  { code: 'btc',       label: 'Bitcoin (BTC)',   icon: '🟠', min: 20, hint: 'Highest min' },
];

/**
 * NOWPayments deposit modal — smart per-coin minimum.
 *
 * Flow:
 *   1. Fan picks a coin → we know the live USD-equivalent minimum for it.
 *   2. Fan picks an amount (validated against THAT coin's minimum).
 *   3. We pass pay_currency to NOWPayments so they don't show their own
 *      coin picker again — fan lands on the BTC/USDT/etc. pay page directly.
 *   4. NOWPayments invoice is created with is_fee_paid_by_user=true so
 *      the on-chain network fee is added on top of the deposit (merchant
 *      receives the full deposit amount, fan pays slightly more).
 */
export default function WalletDepositModal({ onClose, onSuccess, suggested, returnPath = '/dashboard' }: Props) {
  const [coins, setCoins] = useState<WalletCoin[]>(FALLBACK_COINS);
  const [pickedCode, setPickedCode] = useState<string>('usdttrc20');
  const [custom, setCustom] = useState('');
  const [amount, setAmount] = useState<number>(suggested || 20);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fanvueUrl, setFanvueUrl] = useState<string | null>(null);

  // Fetch live per-coin minimums + creator's fanvue link on mount.
  useEffect(() => {
    getWalletCoins().then(r => {
      if (Array.isArray(r?.coins) && r.coins.length) setCoins(r.coins);
    }).catch(() => { /* keep fallback */ });
    getCreator().then(c => {
      if (c?.fanvueUrl) setFanvueUrl(c.fanvueUrl);
    }).catch(() => { /* fanvue option just won't show */ });
  }, []);

  const pickedCoin = useMemo(
    () => coins.find(c => c.code === pickedCode) || coins[0],
    [coins, pickedCode]
  );

  const finalAmount = custom ? parseFloat(custom) : amount;
  const usingCustom = custom.length > 0;
  const belowMin = finalAmount > 0 && finalAmount < pickedCoin.min;
  const aboveMax = finalAmount > 1000;

  // Smart presets: $1 = floor (very rare), then scale based on picked coin's min.
  // Always include the coin's exact minimum as the lowest preset.
  const presets = useMemo(() => {
    const m = Math.max(1, Math.ceil(pickedCoin.min));
    const pool = [m, m * 2, m * 5, 50, 100, 250]
      .filter((v, i, a) => v <= 1000 && a.indexOf(v) === i)
      .slice(0, 5);
    return pool;
  }, [pickedCoin]);

  const submit = async () => {
    setError(null);
    if (!finalAmount || finalAmount < 1 || finalAmount > 1000) {
      setError('Enter an amount between $1 and $1,000.');
      return;
    }
    if (belowMin) {
      setError(`${pickedCoin.label} requires at least $${pickedCoin.min}. Increase the amount or pick a coin with a lower minimum (USDT/Tron).`);
      return;
    }
    setSubmitting(true);
    const res = await depositToWallet(finalAmount, 'nowpayments', pickedCoin.code);
    setSubmitting(false);
    if (res?.redirectUrl) {
      const ret = encodeURIComponent(returnPath);
      window.location.href = `${res.redirectUrl}${res.redirectUrl.includes('?') ? '&' : '?'}return=${ret}&tx=${res.transactionId}`;
      return;
    }
    if (res?.success) {
      onSuccess?.();
      onClose();
    } else if (res?.requiresEmailVerification) {
      setError('Please verify your email first — check your inbox or use the banner on your dashboard to resend the link.');
    } else if (res?.error) {
      setError(res.error);
    } else {
      setError('Unexpected — please try again');
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 760;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'center',
        padding: isMobile ? 0 : 20,
        backdropFilter: 'blur(4px)',
        overflowY: 'auto',
      }}>
      <div
        onClick={e => e.stopPropagation()}
        className="v3-deposit-modal"
        style={{
          background: '#fff',
          borderRadius: isMobile ? 0 : 18,
          width: '100%', maxWidth: 560,
          minHeight: isMobile ? '100vh' : 'auto',
          boxShadow: isMobile ? 'none' : '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          padding: isMobile ? 22 : 28,
        }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, letterSpacing: -0.3 }}>
              Add money to your wallet
            </h2>
            <p style={{ margin: '6px 0 0', fontSize: '0.86rem', color: 'var(--v3-muted)', lineHeight: 1.4 }}>
              Top up once, unlock content with one tap.
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

        {/* Pay-with-card alternative via Fanvue — only shown if creator set the link */}
        {fanvueUrl && (
          <a
            href={fanvueUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'linear-gradient(135deg, #2C3E5C 0%, #4A6FA5 100%)',
              color: '#fff', textDecoration: 'none',
              padding: '12px 14px', borderRadius: 10,
              marginBottom: 16,
            }}>
            <span style={{ fontSize: '1.4rem' }}>💎</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                Want to use a card instead? Tip her on Fanvue (free to join)
              </div>
              <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>
                Same creator — Fanvue accepts cards for tips & PPV
              </div>
            </div>
            <span style={{ opacity: 0.9 }}>→</span>
          </a>
        )}

        {/* Step 1 — coin */}
        <label style={sectionLabel}>1. Pick the coin you'll pay with</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
          {coins.map(c => {
            const picked = pickedCoin.code === c.code;
            return (
              <button
                key={c.code}
                onClick={() => setPickedCode(c.code)}
                style={{
                  padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10,
                  border: picked ? '2px solid var(--v3-terracotta)' : '1px solid var(--v3-rose-100)',
                  background: picked ? 'var(--v3-rose-50)' : '#fff',
                  borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                }}>
                <span style={{ fontSize: '1.2rem' }}>{c.icon}</span>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.86rem', color: 'var(--v3-ink)' }}>{c.label}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--v3-muted)' }}>
                    Min ${c.min} · {c.hint}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Step 2 — amount */}
        <label style={sectionLabel}>2. Amount (min ${pickedCoin.min} for {pickedCoin.label})</label>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${presets.length}, 1fr)`, gap: 8, marginBottom: 12 }}>
          {presets.map(p => {
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

        <div style={{ position: 'relative', marginBottom: 8 }}>
          <span style={{
            position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--v3-muted)', fontWeight: 600,
          }}>$</span>
          <input
            type="number"
            min={1}
            max={1000}
            step={1}
            placeholder="Custom amount"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            style={{
              width: '100%', padding: '11px 14px 11px 28px', borderRadius: 10,
              border: belowMin ? '1px solid var(--v3-danger)' : '1px solid var(--v3-rose-100)',
              fontSize: '0.95rem',
              fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Live warning — visible before clicking Continue */}
        {belowMin && (
          <div style={{
            padding: '10px 12px', background: 'rgba(220,38,38,0.10)', color: 'var(--v3-danger)',
            borderRadius: 8, fontSize: '0.8rem', marginBottom: 12, fontWeight: 600,
          }}>
            ⚠️ {pickedCoin.label} requires at least ${pickedCoin.min}. Tip: USDT (Tron) accepts as low as ${coins[0]?.min || 1}.
          </div>
        )}
        {aboveMax && (
          <div style={{ padding: '10px 12px', background: 'rgba(220,38,38,0.10)', color: 'var(--v3-danger)', borderRadius: 8, fontSize: '0.8rem', marginBottom: 12, fontWeight: 600 }}>
            ⚠️ Max single deposit is $1,000.
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting || !finalAmount || belowMin || aboveMax}
          style={{
            width: '100%',
            background: 'var(--v3-terracotta)', color: '#fff',
            border: 'none', borderRadius: 22, padding: '13px 0',
            fontWeight: 700, fontSize: '0.96rem',
            cursor: (submitting || belowMin || aboveMax) ? 'not-allowed' : 'pointer',
            opacity: (submitting || belowMin || aboveMax) ? 0.5 : 1,
            marginTop: 6,
          }}>
          {submitting
            ? 'Creating invoice…'
            : belowMin
              ? `Increase to $${pickedCoin.min} to continue`
              : `Continue with $${finalAmount.toFixed(2)} in ${pickedCoin.label.split(' ')[0]}`}
        </button>

        <div style={{
          marginTop: 14, padding: '10px 12px', background: 'var(--v3-cream)',
          borderRadius: 10, fontSize: '0.76rem', color: 'var(--v3-ink-soft)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: '1.1rem' }}>🔒</span>
          <span>
            Your coin is pre-selected on the next page. <strong>If you see "currency unavailable,"</strong>
            tap the coin name at the top of the NOWPayments page to switch to another. Network fee is
            added on top. Funds credit within 5–15 min of confirmation.
          </span>
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
