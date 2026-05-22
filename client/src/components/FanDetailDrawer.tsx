import { useEffect, useState } from 'react';
import {
  getFanDetail, blockFan, forceLogoutFan, adminDeleteFan, SERVER_URL,
} from '../api';
import { useToast } from './Toast';

interface Props {
  fanId: number | null;            // null = closed
  onClose: () => void;
  onMutated?: () => void;          // parent refresh after block/delete/etc
}

const fmtDate = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const fmtRelative = (iso?: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const txnEmoji = (type: string) => {
  switch (type) {
    case 'wallet_deposit':    return '💰';
    case 'collection_unlock': return '📦';
    case 'post_unlock':       return '🔓';
    case 'ppv_message':       return '💌';
    case 'subscription':      return '⭐';
    case 'tip':               return '💝';
    default:                  return '•';
  }
};

const txnLabel = (type: string) => {
  switch (type) {
    case 'wallet_deposit':    return 'Wallet deposit';
    case 'collection_unlock': return 'Bundle unlock';
    case 'post_unlock':       return 'Post unlock';
    case 'ppv_message':       return 'PPV message';
    case 'subscription':      return 'Subscription';
    case 'tip':               return 'Tip';
    default:                  return type;
  }
};

const statusBadge = (status: string): React.CSSProperties => {
  const palette =
    status === 'active'  ? { bg: '#e8f5e9', fg: '#1f4a25', border: '#7cb988' } :
    status === 'blocked' ? { bg: '#fdeceb', fg: '#742020', border: '#e09595' } :
                           { bg: '#f0eef2', fg: '#555055', border: '#bbb0bd' };
  return {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 99,
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    background: palette.bg,
    color: palette.fg,
    border: `1px solid ${palette.border}`,
  };
};

/**
 * Slide-in drawer for admin fan management. Renders nothing when fanId is
 * null. Fetches the full /fans/:id payload on every open (no caching — admin
 * action volume is too low to bother with).
 */
export default function FanDetailDrawer({ fanId, onClose, onMutated }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (fanId == null) { setData(null); return; }
    setLoading(true);
    getFanDetail(fanId)
      .then(setData)
      .catch(() => toast.error('Could not load fan'))
      .finally(() => setLoading(false));
  }, [fanId, toast]);

  // Lock body scroll while open
  useEffect(() => {
    if (fanId == null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [fanId]);

  if (fanId == null) return null;

  const fan = data?.fan;
  const stats = data?.stats || {};
  const transactions: any[] = data?.transactions || [];
  const status = data?.status || 'active';

  const refresh = async () => {
    setLoading(true);
    try { setData(await getFanDetail(fanId)); }
    finally { setLoading(false); }
  };

  const handleBlock = async () => {
    if (!fan) return;
    const wantBlocked = status !== 'blocked';
    if (!confirm(wantBlocked ? `Block ${fan.username}? They will be signed out and can't log in until unblocked.` : `Unblock ${fan.username}?`)) return;
    setBusy('block');
    try {
      const res = await blockFan(fan.id, wantBlocked);
      if (res?.ok) {
        toast.success(wantBlocked ? 'Fan blocked' : 'Fan unblocked');
        await refresh();
        onMutated?.();
      } else {
        toast.error(res?.error || 'Block toggle failed');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Block toggle failed');
    } finally {
      setBusy(null);
    }
  };

  const handleForceLogout = async () => {
    if (!fan) return;
    if (!confirm(`Force-logout ${fan.username}? Every existing session will be invalidated. They can sign in again immediately.`)) return;
    setBusy('logout');
    try {
      const res = await forceLogoutFan(fan.id);
      if (res?.ok) toast.success('Fan logged out everywhere');
      else toast.error(res?.error || 'Force-logout failed');
    } catch (err: any) {
      toast.error(err?.message || 'Force-logout failed');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!fan) return;
    if (!confirm(`PERMANENTLY anonymize ${fan.username}'s account?\n\n• Their email, username, and avatar will be wiped\n• They will be signed out and unable to recover the account\n• Transaction records are kept for tax compliance\n\nContinue?`)) return;
    setBusy('delete');
    try {
      const res = await adminDeleteFan(fan.id);
      if (res?.ok) {
        toast.success('Fan account anonymized');
        onMutated?.();
        onClose();
      } else {
        toast.error(res?.error || 'Delete failed');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setBusy(null);
    }
  };

  const isDeleted = status === 'deleted';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 4000,
          background: 'rgba(15, 10, 8, 0.45)',
          backdropFilter: 'blur(2px)',
          animation: 'v3-fade-in 0.18s ease',
        }}
      />
      {/* Drawer */}
      <aside
        role="dialog"
        aria-label="Fan detail"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: 'min(440px, 100vw)',
          zIndex: 4001,
          background: '#fffaf4',
          boxShadow: '-12px 0 36px rgba(0, 0, 0, 0.18)',
          overflowY: 'auto',
          animation: 'v3-drawer-slide-in 0.24s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          background: 'linear-gradient(180deg, #fffaf4 0%, #fff5ec 100%)',
          position: 'sticky', top: 0, zIndex: 2,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <p style={{ fontSize: '0.66rem', letterSpacing: 2, color: 'var(--v3-terracotta)', fontWeight: 700, margin: 0 }}>
              FAN DETAIL
            </p>
            <button onClick={onClose} aria-label="Close"
              style={{
                background: 'rgba(255,255,255,0.8)', border: '1px solid rgba(0,0,0,0.06)',
                width: 28, height: 28, borderRadius: '50%', cursor: 'pointer',
                fontSize: '1.1rem', lineHeight: 1, color: 'var(--v3-ink-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
          </div>
          {fan && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: fan.avatarUrl ? `url("${SERVER_URL}${fan.avatarUrl}") center/cover` : 'linear-gradient(135deg, #e6927a, #c75a3e)',
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '1.4rem', flexShrink: 0,
              }}>
                {!fan.avatarUrl && (fan.username || '?').slice(0, 1).toUpperCase()}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <h2 style={{
                  margin: 0, fontSize: '1.15rem', fontWeight: 700,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  color: 'var(--v3-ink)',
                }}>
                  {fan.username || '—'}
                </h2>
                <p style={{
                  margin: '2px 0 6px', fontSize: '0.82rem', color: 'var(--v3-ink-soft)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {fan.email}
                </p>
                <span style={statusBadge(status)}>{status}</span>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '18px 24px 32px', flex: 1 }}>
          {loading && !data && (
            <p style={{ color: 'var(--v3-muted)', textAlign: 'center', padding: '20px 0' }}>Loading…</p>
          )}

          {data && (
            <>
              {/* Quick stats — 2x2 grid */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
                marginBottom: 22,
              }}>
                <Stat label="Total spent" value={`$${(stats.totalSpent || 0).toFixed(2)}`} />
                <Stat label="Deposited" value={`$${(stats.totalDeposited || 0).toFixed(2)}`} />
                <Stat label="Wallet balance" value={`$${(stats.walletBalance || 0).toFixed(2)}`} />
                <Stat label="Unlocks" value={String(stats.unlocks || 0)} />
              </div>

              {/* Account info */}
              <Section title="Account">
                <Row label="Joined" value={fmtDate(stats.joinedAt)} />
                <Row label="Last login" value={fmtRelative(stats.lastLoginAt)} />
                <Row label="Email verified" value={fan?.emailVerified ? 'Yes ✓' : 'No'} />
                <Row label="Messages sent" value={String(stats.messageCount || 0)} />
              </Section>

              {/* Subscription */}
              {data.subscription && (
                <Section title="Subscription">
                  <Row label="Tier"   value={data.subscription.tier || 'free'} />
                  <Row label="Status" value={data.subscription.status || '—'} />
                  <Row label="Started" value={fmtDate(data.subscription.startDate)} />
                </Section>
              )}

              {/* Transactions */}
              <Section title={`Transactions (${transactions.length})`}>
                {transactions.length === 0 ? (
                  <p style={{ fontSize: '0.86rem', color: 'var(--v3-muted)', margin: 0 }}>
                    No transactions yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {transactions.slice(0, 30).map((t: any) => (
                      <div key={t.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 10px', borderRadius: 8,
                        background: 'rgba(0,0,0,0.025)',
                        fontSize: '0.84rem',
                      }}>
                        <span style={{ fontSize: '1rem' }}>{txnEmoji(t.type)}</span>
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {txnLabel(t.type)}
                          {t.description && (
                            <span style={{ color: 'var(--v3-muted)', marginLeft: 6 }}>— {t.description}</span>
                          )}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--v3-ink)' }}>
                          ${parseFloat(t.amount || 0).toFixed(2)}
                        </span>
                        <span style={{
                          fontSize: '0.7rem', color: 'var(--v3-muted)',
                          minWidth: 60, textAlign: 'right',
                        }}>
                          {fmtRelative(t.createdAt)}
                        </span>
                      </div>
                    ))}
                    {transactions.length > 30 && (
                      <p style={{ fontSize: '0.74rem', color: 'var(--v3-muted)', textAlign: 'center', margin: '6px 0 0' }}>
                        +{transactions.length - 30} more
                      </p>
                    )}
                  </div>
                )}
              </Section>

              {/* Danger zone */}
              {!isDeleted && (
                <Section title="Danger zone" titleColor="var(--v3-danger)">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <DangerButton
                      label={status === 'blocked' ? 'Unblock fan' : 'Block fan'}
                      busy={busy === 'block'}
                      tone={status === 'blocked' ? 'safe' : 'warn'}
                      onClick={handleBlock}
                    />
                    <DangerButton
                      label="Force-logout (all devices)"
                      busy={busy === 'logout'}
                      tone="warn"
                      onClick={handleForceLogout}
                    />
                    <DangerButton
                      label="Delete account (GDPR)"
                      busy={busy === 'delete'}
                      tone="danger"
                      onClick={handleDelete}
                    />
                  </div>
                </Section>
              )}

              {isDeleted && (
                <div style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: 'rgba(0,0,0,0.04)', color: 'var(--v3-muted)',
                  fontSize: '0.86rem', textAlign: 'center',
                }}>
                  This account has been anonymized. Transaction records are retained for tax compliance.
                </div>
              )}
            </>
          )}
        </div>
      </aside>

      <style>{`
        @keyframes v3-drawer-slide-in {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        @media (max-width: 600px) {
          aside[aria-label="Fan detail"] {
            width: 100vw !important;
          }
        }
      `}</style>
    </>
  );
}

function Section({
  title, titleColor, children,
}: { title: string; titleColor?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <h3 style={{
        margin: '0 0 10px',
        fontSize: '0.72rem',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        fontWeight: 700,
        color: titleColor || 'var(--v3-muted)',
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '6px 0', fontSize: '0.86rem',
      borderBottom: '1px dashed rgba(0,0,0,0.05)',
    }}>
      <span style={{ color: 'var(--v3-muted)' }}>{label}</span>
      <span style={{ color: 'var(--v3-ink)', fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      padding: '12px 14px', borderRadius: 12,
      background: '#fff', border: '1px solid rgba(0,0,0,0.07)',
    }}>
      <p style={{ margin: 0, fontSize: '0.68rem', color: 'var(--v3-muted)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
        {label}
      </p>
      <p style={{ margin: '4px 0 0', fontSize: '1.1rem', fontWeight: 700, color: 'var(--v3-ink)' }}>
        {value}
      </p>
    </div>
  );
}

function DangerButton({
  label, busy, tone, onClick,
}: { label: string; busy: boolean; tone: 'safe' | 'warn' | 'danger'; onClick: () => void }) {
  const palette =
    tone === 'safe'   ? { bg: '#e8f5e9', fg: '#1f4a25', border: '#7cb988' } :
    tone === 'warn'   ? { bg: '#fff7e6', fg: '#7a5316', border: '#e0b765' } :
                        { bg: '#fdeceb', fg: '#742020', border: '#e09595' };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        width: '100%', padding: '10px 14px',
        background: palette.bg, color: palette.fg,
        border: `1px solid ${palette.border}`,
        borderRadius: 10, cursor: busy ? 'wait' : 'pointer',
        fontFamily: 'inherit', fontSize: '0.88rem', fontWeight: 600,
        opacity: busy ? 0.6 : 1,
        textAlign: 'left',
      }}>
      {busy ? `${label}…` : label}
    </button>
  );
}
