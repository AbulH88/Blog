/**
 * First-login welcome modal that points fans at the creator's Fanvue link
 * as a card-payment alternative while in-app card processing is pending.
 *
 * Visibility rules:
 *  - Only renders if creator.fanvueUrl is set (creator can disable globally).
 *  - Shows once per fan account (tracks via localStorage flag).
 *  - Dismiss button writes the flag; users get a "remind me later" implied
 *    if they just close without seeing the link.
 */
import { useEffect, useState } from 'react';

interface Props {
  fanvueUrl?: string | null;
  creatorName?: string;
  /** Unique per-fan key so the "seen" flag is scoped to the logged-in user. */
  fanKey: string;
}

export default function FanvueWelcomeModal({ fanvueUrl, creatorName = 'the creator', fanKey }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!fanvueUrl) return;
    const flag = `fanvue_welcome_seen:${fanKey}`;
    if (localStorage.getItem(flag)) return;
    // Short delay so the modal appears AFTER the dashboard renders — less jarring.
    const id = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(id);
  }, [fanvueUrl, fanKey]);

  const dismiss = () => {
    localStorage.setItem(`fanvue_welcome_seen:${fanKey}`, '1');
    setOpen(false);
  };

  const goToFanvue = () => {
    localStorage.setItem(`fanvue_welcome_seen:${fanKey}`, '1');
    window.open(fanvueUrl as string, '_blank', 'noopener,noreferrer');
    setOpen(false);
  };

  if (!open || !fanvueUrl) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 2500,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        backdropFilter: 'blur(4px)',
      }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 18,
          width: '100%', maxWidth: 460,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}>
        {/* Header banner */}
        <div style={{
          background: 'linear-gradient(135deg, #2C3E5C 0%, #4A6FA5 100%)',
          color: '#fff', padding: '26px 26px 20px',
          position: 'relative',
        }}>
          <button onClick={dismiss} aria-label="Close"
            style={{
              position: 'absolute', top: 12, right: 14,
              background: 'rgba(255,255,255,0.15)', border: 'none',
              width: 28, height: 28, borderRadius: '50%',
              color: '#fff', fontSize: '1.1rem', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              lineHeight: 1,
            }}>×</button>
          <div style={{ fontSize: '2rem', marginBottom: 6 }}>💎</div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, letterSpacing: -0.3 }}>
            Follow {creatorName} on Fanvue too — it's free!
          </h2>
          <p style={{ margin: '6px 0 0', fontSize: '0.88rem', opacity: 0.9, lineHeight: 1.5 }}>
            Same girl, same vibe — verified on both platforms. Free to follow, no card needed. If you ever want to tip or unlock with a card instead of crypto, that's where to do it.
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 26px 22px' }}>
          <ul style={{
            margin: 0, padding: 0, listStyle: 'none',
            display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.88rem', color: 'var(--v3-ink)',
          }}>
            <li style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
              <span style={{ color: 'var(--v3-terracotta)' }}>✓</span>
              <span><strong>100% free to follow</strong> — no subscription, no card on file</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
              <span style={{ color: 'var(--v3-terracotta)' }}>✓</span>
              <span><strong>Verified creator</strong> on Fanvue (blue tick ✓)</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
              <span style={{ color: 'var(--v3-terracotta)' }}>✓</span>
              <span><strong>Card payments accepted</strong> there if you ever want to tip or buy PPV without crypto</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
              <span style={{ color: 'var(--v3-terracotta)' }}>✓</span>
              <span>Stays signed in on both — pick whichever you prefer day to day</span>
            </li>
          </ul>

          <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
            <button
              onClick={goToFanvue}
              style={{
                flex: 1, background: 'var(--v3-terracotta)', color: '#fff',
                border: 'none', borderRadius: 10, padding: '12px 0',
                fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
              Follow Free on Fanvue →
            </button>
            <button
              onClick={dismiss}
              style={{
                background: 'transparent', color: 'var(--v3-ink-soft)',
                border: '1px solid var(--v3-rose-100)', borderRadius: 10, padding: '12px 18px',
                fontWeight: 600, fontSize: '0.88rem', cursor: 'pointer',
                fontFamily: 'inherit',
              }}>
              Maybe later
            </button>
          </div>

          <p style={{
            margin: '14px 0 0', fontSize: '0.72rem', color: 'var(--v3-muted)',
            textAlign: 'center', lineHeight: 1.5,
          }}>
            This message won't show again. The Fanvue link stays in your sidebar + dashboard.
          </p>
        </div>
      </div>
    </div>
  );
}
