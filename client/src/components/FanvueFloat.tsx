/**
 * Floating "Tip with a card" pill — fixed to the bottom-right, stays visible
 * while scrolling so the card-payment door is never more than one tap away.
 *
 * Bot-safe:
 *   - Neutral copy (no "Fanvue" / adult words)
 *   - Links to our /f/:slug endpoint (302s humans to Fanvue, neutral page for
 *     social bots) — the real fanvue.com URL never ships in the bundle.
 *
 * Mounted on the marketing root domain only (App.tsx gates with
 * !isMembersDomain()). Renders nothing if the creator has no Fanvue URL.
 */
import { fanvueLink } from '../lib/fanvueLink';
import SocialIcons from './SocialIcons';

interface Props {
  fanvueUrl?: string | null;
}

export default function FanvueFloat({ fanvueUrl }: Props) {
  if (!fanvueUrl) return null;

  return (
    <a
      href={fanvueLink()}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Tip with a card"
      style={{
        position: 'fixed',
        right: 'max(18px, env(safe-area-inset-right))',
        bottom: 'max(18px, env(safe-area-inset-bottom))',
        zIndex: 900,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        padding: '13px 20px',
        background: 'var(--v3-terracotta, #C16748)',
        color: '#fff',
        textDecoration: 'none',
        borderRadius: 999,
        fontWeight: 800,
        fontSize: '0.9rem',
        letterSpacing: 0.3,
        boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
      }}
    >
      <SocialIcons name="card" size={19} /> Tip with a card
    </a>
  );
}
