/**
 * Floating Fanvue pill — fixed to the bottom-right, stays visible while
 * scrolling so the Fanvue door is never more than one tap away.
 *
 * Bot-safe by construction:
 *   - The branding (logo mark + "Fanvue" label) comes from the server config
 *     and is present ONLY for non-bot requests, so the word "Fanvue" and the
 *     logo never live in the client JS bundle.
 *   - The link is the UA-gated /f/:slug redirect (302s humans to Fanvue,
 *     neutral page for social-preview bots).
 *
 * Mounted on the marketing root domain only (App.tsx gates with
 * !isMembersDomain()). Renders nothing if Fanvue branding is absent.
 */
import { fanvueLink } from '../lib/fanvueLink';

interface Props {
  fanvue?: { label: string; logo: string } | null;
}

export default function FanvueFloat({ fanvue }: Props) {
  if (!fanvue) return null;

  return (
    <a
      href={fanvueLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={fanvue.label}
      className="v3-fanvue-float"
    >
      <img className="v3-fanvue-mark" src={fanvue.logo} alt="" />
      {fanvue.label}
      <span aria-hidden style={{ opacity: 0.55, marginLeft: 2 }}>→</span>
    </a>
  );
}
