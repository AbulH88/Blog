/**
 * Scroll-triggered conversion CTA — slides up from the bottom of the screen
 * once the fan has scrolled past 60% of the page. Bot-safe because:
 *   - Bots don't scroll (they download HTML once and leave) → CTA never renders
 *   - No auto-popup behaviour on landing
 *   - Lazy-loaded chunk so its strings aren't in the main bundle
 *
 * The pill is dismissable; we remember the dismissal in localStorage so the
 * fan isn't pestered on every page reload. Re-shows after 7 days.
 *
 * Mounted on the marketing root domain only (App.tsx wraps the mount in an
 * isMembersDomain() check). Cross-domain navigates to the members subdomain
 * /login page.
 */
import { useEffect, useState } from 'react';
import { isMembersDomain, crossDomainUrl } from '../lib/hostname';

const STORAGE_KEY = 'members_scroll_cta_dismissed_at';
const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SCROLL_THRESHOLD = 0.6; // 60% of the page

export default function MembersScrollCta() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't run on the members subdomain — only the marketing root needs this.
    if (isMembersDomain()) return;

    // Don't show if recently dismissed.
    const dismissedAtRaw = localStorage.getItem(STORAGE_KEY);
    if (dismissedAtRaw) {
      const dismissedAt = parseInt(dismissedAtRaw, 10);
      if (Number.isFinite(dismissedAt) && Date.now() - dismissedAt < REMIND_AFTER_MS) {
        return;
      }
    }

    // Throttled scroll listener — cheap, fires on every paint.
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const doc = document.documentElement;
        const scrolled = window.scrollY;
        const max = doc.scrollHeight - window.innerHeight;
        if (max <= 0) return;
        const pct = scrolled / max;
        if (pct >= SCROLL_THRESHOLD) {
          setVisible(true);
          window.removeEventListener('scroll', onScroll);
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Also check once on mount in case the user is already scrolled (returning
    // visit, refresh mid-page).
    onScroll();

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setVisible(false);
  };

  if (!visible) return null;

  const href = crossDomainUrl('/login', 'members');

  return (
    <div
      role="region"
      aria-label="Want more?"
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        background: 'var(--v3-ink, #1f1d1a)',
        color: '#fff',
        borderRadius: 999,
        padding: '10px 14px 10px 20px',
        boxShadow: '0 12px 30px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        maxWidth: 'calc(100vw - 32px)',
        animation: 'membersScrollCtaSlideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        fontFamily: 'inherit',
      }}
    >
      <span style={{ fontSize: '0.88rem', fontWeight: 500, letterSpacing: 0.2, whiteSpace: 'nowrap' }}>
        Want the rest?
      </span>
      <a
        href={href}
        style={{
          background: 'var(--v3-terracotta, #C75A3E)',
          color: '#fff',
          textDecoration: 'none',
          padding: '7px 16px',
          borderRadius: 999,
          fontWeight: 700,
          fontSize: '0.84rem',
          letterSpacing: 0.4,
          whiteSpace: 'nowrap',
        }}
      >
        Come in →
      </a>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.7)',
          cursor: 'pointer',
          fontSize: '1.1rem',
          lineHeight: 1,
          padding: '0 4px 2px',
          fontFamily: 'inherit',
        }}
      >
        ×
      </button>
      {/* Inline keyframes — keeps the animation self-contained so we don't
          touch the shared CSS file for a single component's micro-motion. */}
      <style>{`
        @keyframes membersScrollCtaSlideUp {
          from { transform: translate(-50%, 120%); opacity: 0; }
          to   { transform: translate(-50%, 0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}
