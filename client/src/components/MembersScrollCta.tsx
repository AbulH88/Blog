/**
 * Scroll-triggered conversion popup — fires the full JoinPremiumModal once
 * the visitor scrolls past 60% of the page. Bot-safe because:
 *   - Bots don't scroll (they download HTML once and leave) → never renders
 *   - No auto-popup behaviour on landing
 *   - Lazy-loaded chunk so the modal strings + photo asset aren't in the
 *     main bundle that ships to root-domain HTML scrapers
 *
 * Behaviour:
 *   - Shows once per session (sessionStorage) so it doesn't re-pop after
 *     dismiss-and-scroll-up-and-scroll-back-down
 *   - After explicit dismiss via the modal's × button, remembers for 7 days
 *     in localStorage so returning fans aren't pestered
 *
 * Mounted on the marketing root domain only (App.tsx wraps the mount in an
 * isMembersDomain() check). Cross-domain navigates to members.* when the
 * "Follow free" CTA is tapped — handled inside JoinPremiumModal.
 */
import { useEffect, useState, lazy, Suspense } from 'react';
import { isMembersDomain } from '../lib/hostname';

const JoinPremiumModal = lazy(() => import('./JoinPremiumModal'));

const STORAGE_KEY = 'members_scroll_cta_dismissed_at';
const SESSION_KEY = 'members_scroll_cta_shown_this_session';
const REMIND_AFTER_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const SCROLL_THRESHOLD = 0.6;                    // 60% of the page

interface Props {
  /** Creator config passed from App. Used to source the hero photo +
   *  avatar + display name for the modal. */
  config?: {
    siteTitle?: string;
    logoUrl?: string;
    chatAvatarUrl?: string;
    fanvueUrl?: string;
    images?: {
      hero?: string;
      heroSlider?: string[];
    };
  };
}

export default function MembersScrollCta({ config }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Don't run on members.* — only the marketing root needs this.
    if (isMembersDomain()) return;

    // Don't pop more than once per session.
    if (sessionStorage.getItem(SESSION_KEY)) return;

    // Don't show if recently dismissed via the modal close.
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
          sessionStorage.setItem(SESSION_KEY, '1');
          setOpen(true);
          window.removeEventListener('scroll', onScroll);
        }
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    // Also check once on mount in case the user landed mid-page (refresh).
    onScroll();

    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleClose = () => {
    // Explicit close = 7-day cooldown so they don't get re-pestered every visit
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
    setOpen(false);
  };

  // Source the hero photo: prefer the first hero-slider slide (creator's best
  // shot, intentionally chosen for the home page), fall back to the legacy
  // single hero image, then logo as last resort.
  const heroImageUrl =
    (config?.images?.heroSlider && config.images.heroSlider[0]) ||
    config?.images?.hero ||
    config?.logoUrl ||
    '';

  const avatarUrl =
    config?.chatAvatarUrl ||
    config?.images?.hero ||
    config?.logoUrl ||
    '';

  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <JoinPremiumModal
        open={open}
        onClose={handleClose}
        creatorName={config?.siteTitle}
        fanvueUrl={config?.fanvueUrl}
        avatarUrl={avatarUrl}
        heroImageUrl={heroImageUrl}
      />
    </Suspense>
  );
}
