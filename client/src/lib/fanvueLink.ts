import { SERVER_URL, CREATOR_SLUG } from '../api';

/**
 * Build the link to the Fanvue click-through landing page.
 *
 * We point at our OWN server's `/f/:slug` endpoint — never the raw fanvue.com
 * URL — so the destination isn't hard-coded in the client bundle. `/f/:slug`
 * serves ONE identical landing page to everyone (no bot detection / cloaking);
 * the visitor clicks "Continue" there to reach Fanvue. See server/routes/fanvueRoutes.js.
 *
 * Uses SERVER_URL so it works in both environments without nginx locally:
 *   - prod:  https://thecristinaadam.com/f/cristina  (nginx proxies /f/ → Node)
 *   - local: http://localhost:5000/f/cristina        (hits Node directly)
 */
export function fanvueLink(slug: string = CREATOR_SLUG): string {
  return `${SERVER_URL}/f/${encodeURIComponent(slug)}`;
}
