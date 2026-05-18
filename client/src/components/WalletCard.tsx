import { useState } from 'react';
import WalletDepositModal from './WalletDepositModal';

interface Props {
  balance: number;
  onDeposited?: () => void;
}

export default function WalletCard({ balance, onDeposited }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div style={{
        background: 'linear-gradient(135deg, #2a2a3e 0%, #1a1a2e 100%)',
        color: '#fff',
        borderRadius: 16,
        padding: 22,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        marginTop: 18,
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(196,92,58,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.6rem', flexShrink: 0,
        }}>💰</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.72rem', letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.65 }}>
            Wallet balance
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.2, marginTop: 2 }}>
            ${balance.toFixed(2)}
          </div>
          <div style={{ fontSize: '0.74rem', opacity: 0.7, marginTop: 2 }}>
            Use it for one-tap unlocks · top up with crypto, get 5% bonus on $50+
          </div>
        </div>

        <button
          onClick={() => setOpen(true)}
          style={{
            background: 'var(--v3-terracotta)', color: '#fff',
            border: 'none', borderRadius: 22,
            padding: '10px 22px',
            fontWeight: 700, fontSize: '0.88rem',
            cursor: 'pointer', flexShrink: 0,
          }}>
          ＋ Add money
        </button>

        {/* decorative */}
        <div style={{ position: 'absolute', bottom: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(196,92,58,0.10)' }} />
      </div>

      {open && (
        <WalletDepositModal
          onClose={() => setOpen(false)}
          onSuccess={() => { setOpen(false); onDeposited?.(); }}
          returnPath="/dashboard"
        />
      )}
    </>
  );
}
