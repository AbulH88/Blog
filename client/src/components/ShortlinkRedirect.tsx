import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

/**
 * `/r/:character` — handles the bio shortlink:
 *   1. Fires a fire-and-forget tracking POST so the Events table records
 *      `bio_link_clicked` for funnel analytics.
 *   2. Replaces the URL with `members.<root-domain>/register?via=:character`.
 *
 * Lives ONLY on the marketing root domain (e.g. thecristinaadam.com).
 * The flow exists so the URL in a creator's IG bio reads as a clean root
 * domain to social-network preview bots, while the actual signup happens on
 * the members subdomain (age-gated, bot-blocked).
 */
export default function ShortlinkRedirect() {
  const { character } = useParams<{ character: string }>();

  useEffect(() => {
    const slug = character || '';

    // Track the click (best-effort; server logs the Event row).
    // Don't await — we want the redirect to feel instant.
    fetch(`/api/r/${encodeURIComponent(slug)}`, { method: 'POST', keepalive: true })
      .catch(() => { /* tracking is best-effort */ });

    // Build the members destination from the current hostname so this works
    // for any creator brand (cristina/aria/maya). E.g. on
    // thecristinaadam.com we land on members.thecristinaadam.com/...
    const host = window.location.hostname;
    // For local dev: thecristinaadam.com → members.thecristinaadam.com
    // For local-host dev: localhost → members.localhost
    const membersHost = host.startsWith('members.')
      ? host                                      // we're already there (shouldn't happen, defensive)
      : `members.${host}`;
    const port = window.location.port ? `:${window.location.port}` : '';
    const protocol = window.location.protocol;
    const url = `${protocol}//${membersHost}${port}/register?via=${encodeURIComponent(slug)}`;

    // window.location.replace so the back-button doesn't bounce them into a
    // redirect loop on the marketing site.
    window.location.replace(url);
  }, [character]);

  return (
    <div
      className="loading"
      style={{
        padding: '60px 20px',
        textAlign: 'center',
        color: 'var(--v3-muted)',
        fontSize: '0.92rem',
      }}
    >
      Stepping inside{character ? ` ${character}'s` : ''} space…
    </div>
  );
}
