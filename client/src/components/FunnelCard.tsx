import { useEffect, useState } from 'react';
import { getCreatorFunnel } from '../api';

/**
 * Funnel snapshot for Admin overview. Hits /creator/:slug/funnel and shows
 * distinct-user counts per stage over a window. Stages render in funnel
 * order with conversion % vs the top-of-funnel (signups).
 */

const STAGES: { name: string; label: string; emoji: string }[] = [
  { name: 'fan_signed_up',      label: 'Signed up',     emoji: '👋' },
  { name: 'email_verified',     label: 'Verified email', emoji: '✓' },
  { name: 'chat_message_sent',  label: 'Sent a message', emoji: '💬' },
  { name: 'deposit_completed',  label: 'Deposited',     emoji: '💰' },
  { name: 'unlock_completed',   label: 'Unlocked content', emoji: '🔓' },
];

type EventCount = { distinctUsers: number; total: number };

export default function FunnelCard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Record<string, EventCount> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getCreatorFunnel(days)
      .then(r => setData(r?.events || {}))
      .finally(() => setLoading(false));
  }, [days]);

  const top = data?.fan_signed_up?.distinctUsers || 0;
  const pct = (n: number) => top > 0 ? Math.round((n / top) * 100) : 0;

  return (
    <div className="v3-card" style={{ marginTop: 18 }}>
      <div className="v3-card-head" style={{ marginBottom: 12 }}>
        <h3>Funnel</h3>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          style={{
            background: '#fff', border: '1px solid var(--v3-rose-100)',
            borderRadius: 8, padding: '4px 8px',
            fontFamily: 'inherit', fontSize: '0.8rem', color: 'var(--v3-ink)',
          }}>
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      {loading ? (
        <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem', margin: 0 }}>Loading…</p>
      ) : top === 0 ? (
        <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem', margin: 0 }}>
          No signups yet in this window. Funnel will populate as fans join.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {STAGES.map((stage) => {
            const count = data?.[stage.name]?.distinctUsers || 0;
            const conv = pct(count);
            return (
              <div key={stage.name} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px',
                background: 'var(--v3-cream)',
                borderRadius: 10,
              }}>
                <span style={{ fontSize: '1.2rem', width: 24, textAlign: 'center', flexShrink: 0 }}>{stage.emoji}</span>
                <span style={{ flex: 1, fontSize: '0.88rem', color: 'var(--v3-ink)', fontWeight: 600 }}>
                  {stage.label}
                </span>
                <div style={{
                  flex: 2, height: 8, background: '#fff',
                  borderRadius: 4, overflow: 'hidden', maxWidth: 220,
                }}>
                  <div style={{
                    width: `${conv}%`, height: '100%',
                    background: 'linear-gradient(90deg, var(--v3-terracotta), #e6927a)',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--v3-ink)', minWidth: 36, textAlign: 'right' }}>
                  {count}
                </span>
                <span style={{ fontSize: '0.74rem', color: 'var(--v3-muted)', minWidth: 40, textAlign: 'right' }}>
                  {conv}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
