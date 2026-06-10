/**
 * Floating neutral "Join VIP" pill — fixed to the bottom-right. Links to the
 * /f/:slug click-through page (same page for everyone — no bot detection, no
 * cloaking). The Fanvue brand is revealed on that landing page after the
 * click, never on the public hub.
 *
 * Hidden until the visitor scrolls past the hero: above the fold the hero's
 * own primary CTA is the single conversion path (two identical buttons on one
 * screen just split attention), and at rest the pill was covering content.
 *
 * Mounted on the marketing root domain only (App.tsx gates with
 * !isMembersDomain()). Renders nothing if no Fanvue funnel is configured.
 */
import { useEffect, useState } from 'react';
import { fanvueLink } from '../lib/fanvueLink';

const SHOW_AFTER_PX = 420; // ≈ past the hero on phones

interface Props {
  fanvueEnabled?: boolean;
}

export default function FanvueFloat({ fanvueEnabled }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    onScroll(); // honor an already-scrolled position (e.g. back-navigation)
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!fanvueEnabled) return null;

  return (
    <a
      href={fanvueLink()}
      className={`v3-fanvue-float${visible ? '' : ' v3-fanvue-float--hidden'}`}
      aria-label="Join VIP"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <span className="vip-star" aria-hidden>✦</span>
      Join VIP
      <span aria-hidden style={{ opacity: 0.6, marginLeft: 2 }}>→</span>
    </a>
  );
}
