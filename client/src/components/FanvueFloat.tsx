/**
 * Floating neutral "Support" pill — fixed to the bottom-right, stays visible
 * while scrolling. Links to the /f/:slug click-through page (same page for
 * everyone — no bot detection, no cloaking). The Fanvue brand is revealed on
 * that landing page after the click, never on the public hub.
 *
 * Mounted on the marketing root domain only (App.tsx gates with
 * !isMembersDomain()). Renders nothing if no Fanvue funnel is configured.
 */
import { fanvueLink } from '../lib/fanvueLink';

interface Props {
  fanvueEnabled?: boolean;
}

export default function FanvueFloat({ fanvueEnabled }: Props) {
  if (!fanvueEnabled) return null;

  return (
    <a href={fanvueLink()} className="v3-fanvue-float" aria-label="Support">
      Support
      <span aria-hidden style={{ opacity: 0.55, marginLeft: 2 }}>→</span>
    </a>
  );
}
