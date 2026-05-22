/**
 * Hostname helpers — shared by App.tsx, Navbar, Footer, JoinPremiumModal.
 *
 * The architecture: each creator has a paired marketing + members domain
 * (Option B in DOMAIN-SEPARATION-PLAN.md). Cristina lives on
 * thecristinaadam.com (marketing) + members.thecristinaadam.com (paid).
 * Locally, we test via `localhost` + `members.localhost` (both resolve to
 * 127.0.0.1 with no /etc/hosts changes — `.localhost` is reserved).
 */

/** Are we currently on a `members.*` subdomain? */
export function isMembersDomain(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.startsWith('members.');
}

/**
 * Build the corresponding "other" URL for cross-domain navigation.
 *   - From the marketing domain → returns members.*
 *   - From the members domain → returns the marketing root
 * Preserves protocol + port (so local dev `:5173` keeps working).
 */
export function crossDomainUrl(path: string, target: 'members' | 'marketing'): string {
  if (typeof window === 'undefined') return path;
  const host = window.location.hostname;

  let destHost: string;
  if (target === 'members') {
    destHost = host.startsWith('members.') ? host : `members.${host}`;
  } else {
    destHost = host.startsWith('members.') ? host.slice('members.'.length) : host;
  }

  const port = window.location.port ? `:${window.location.port}` : '';
  const protocol = window.location.protocol;
  return `${protocol}//${destHost}${port}${path.startsWith('/') ? path : `/${path}`}`;
}
