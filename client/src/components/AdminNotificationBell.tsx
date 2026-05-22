import { useEffect, useRef, useState, useCallback } from 'react';
import { getAdminNotifications } from '../api';

/**
 * Replaces the hard-coded "🔔 3" admin top-bar bell. Polls the new
 * /api/creator/:slug/notifications endpoint every 30s and shows the recent
 * events in a dropdown. Unread count is computed against a localStorage-
 * persisted timestamp (lastSeenAt) — single-admin system, no server-side
 * read state needed.
 *
 * Click an event row → fires the optional `onSelectFan(fanId)` callback so
 * the parent can open the FanDetailDrawer. Falls back to no-op if the
 * event has no userId (e.g. system events).
 */

interface Event {
  id: number;
  name: string;
  userId: number | null;
  username: string | null;
  props: any;
  createdAt: string;
}

interface Props {
  onSelectFan?: (fanId: number) => void;
}

const POLL_MS = 30_000;
const STORAGE_KEY = 'admin_notif_last_seen_at';

const fmtRelative = (iso: string) => {
  const t = new Date(iso).getTime();
  const s = Math.floor((Date.now() - t) / 1000);
  if (s < 5)     return 'now';
  if (s < 60)    return `${s}s ago`;
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Per-event-name display config — emoji + sentence template.
// Username is interpolated by the renderer.
const EVENT_DISPLAY: Record<string, { emoji: string; sentence: (e: Event) => string }> = {
  fan_signed_up:     { emoji: '👋', sentence: (e) => `${e.username || 'someone'} signed up` },
  email_verified:    { emoji: '✓',  sentence: (e) => `${e.username || 'someone'} verified email` },
  chat_message_sent: { emoji: '💬', sentence: (e) => `${e.username || 'someone'} sent a message` },
  deposit_completed: { emoji: '💰', sentence: (e) => {
    const amt = e.props?.amount ? `$${parseFloat(e.props.amount).toFixed(2)}` : '';
    return `${e.username || 'someone'} deposited ${amt}`.trim();
  }},
  unlock_completed:  { emoji: '🔓', sentence: (e) => {
    const amt = e.props?.amount ? `$${parseFloat(e.props.amount).toFixed(2)}` : '';
    const type = e.props?.type === 'collection_unlock' ? 'a bundle'
              : e.props?.type === 'post_unlock'       ? 'a post'
              : e.props?.type === 'ppv_message'       ? 'a PPV'
              :                                          'content';
    return `${e.username || 'someone'} unlocked ${type}${amt ? ` (${amt})` : ''}`;
  }},
  account_deleted:   { emoji: '🗑️', sentence: (e) => `${e.username || 'an account'} was deleted` },
};

const fallbackDisplay = (e: Event) => ({
  emoji: '•',
  sentence: () => `${e.name.replace(/_/g, ' ')} — ${e.username || ''}`.trim(),
});

export default function AdminNotificationBell({ onSelectFan }: Props) {
  const [events, setEvents] = useState<Event[]>([]);
  const [open, setOpen] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<number>(() => {
    const v = Number(localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(v) ? v : 0;
  });
  const wrapRef = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    try {
      const res = await getAdminNotifications(20);
      if (Array.isArray(res?.events)) setEvents(res.events);
    } catch { /* network blip, ignore */ }
  }, []);

  // Initial fetch + interval
  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Open dropdown = mark all current events as seen
  const markAllSeen = useCallback(() => {
    const now = Date.now();
    localStorage.setItem(STORAGE_KEY, String(now));
    setLastSeenAt(now);
  }, []);

  const handleClickBell = () => {
    setOpen((o) => !o);
    if (!open) markAllSeen();   // opening = mark read
  };

  const unread = events.filter(e => new Date(e.createdAt).getTime() > lastSeenAt).length;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={handleClickBell}
        className="v3-admin-bell"
        aria-label="Notifications"
        aria-haspopup="true"
        aria-expanded={open}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'inherit', padding: 0, position: 'relative',
        }}
      >
        🔔
        {unread > 0 && <span className="dot">{unread > 99 ? '99+' : unread}</span>}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 340,
            maxHeight: 480,
            background: '#fff',
            border: '1px solid var(--v3-rose-100)',
            borderRadius: 14,
            boxShadow: '0 12px 36px rgba(0,0,0,0.14)',
            zIndex: 200,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--v3-rose-100)',
            background: 'var(--v3-cream)',
          }}>
            <strong style={{ fontSize: '0.94rem', color: 'var(--v3-ink)' }}>Activity</strong>
            <span style={{ fontSize: '0.74rem', color: 'var(--v3-muted)' }}>
              {events.length} recent
            </span>
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
            {events.length === 0 ? (
              <p style={{
                padding: '24px 16px', textAlign: 'center',
                color: 'var(--v3-muted)', fontSize: '0.86rem', margin: 0,
              }}>
                Nothing yet — events will show up here as fans interact.
              </p>
            ) : (
              events.map((e) => {
                const display = EVENT_DISPLAY[e.name] || fallbackDisplay(e);
                const isUnread = new Date(e.createdAt).getTime() > lastSeenAt;
                const clickable = !!e.userId && onSelectFan;
                return (
                  <button
                    key={e.id}
                    onClick={() => {
                      if (e.userId && onSelectFan) onSelectFan(e.userId);
                      setOpen(false);
                    }}
                    disabled={!clickable}
                    style={{
                      display: 'flex', width: '100%', alignItems: 'flex-start',
                      gap: 10, padding: '10px 14px',
                      background: isUnread ? 'var(--v3-rose-50)' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid var(--v3-rose-50)',
                      cursor: clickable ? 'pointer' : 'default',
                      textAlign: 'left',
                      fontFamily: 'inherit',
                    }}
                  >
                    <span style={{ fontSize: '1.05rem', lineHeight: 1.2, flexShrink: 0, marginTop: 1 }}>
                      {display.emoji}
                    </span>
                    <span style={{
                      flex: 1, fontSize: '0.86rem',
                      color: 'var(--v3-ink)',
                      fontWeight: isUnread ? 600 : 400,
                      lineHeight: 1.35,
                    }}>
                      {display.sentence(e)}
                      <span style={{
                        display: 'block',
                        fontSize: '0.7rem',
                        color: 'var(--v3-muted)',
                        marginTop: 2,
                        fontWeight: 400,
                      }}>
                        {fmtRelative(e.createdAt)}
                      </span>
                    </span>
                    {isUnread && (
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: 'var(--v3-terracotta)',
                        marginTop: 6, flexShrink: 0,
                      }} />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer — manual mark-all-read */}
          {events.length > 0 && (
            <button
              onClick={markAllSeen}
              style={{
                padding: '10px 14px',
                background: 'var(--v3-cream)',
                borderTop: '1px solid var(--v3-rose-100)',
                border: 'none', borderBottomLeftRadius: 14, borderBottomRightRadius: 14,
                cursor: 'pointer', fontFamily: 'inherit',
                fontSize: '0.82rem', fontWeight: 700,
                color: 'var(--v3-terracotta)',
                textAlign: 'center',
              }}
            >
              Mark all as read
            </button>
          )}
        </div>
      )}
    </div>
  );
}
