import { SERVER_URL, CREATOR_SLUG } from '../api';

/**
 * Build the bot-safe Fanvue smart-link.
 *
 * We point at our OWN server's `/f/:slug` endpoint — never at the raw
 * fanvue.com URL. That keeps the word "Fanvue" and the real destination out
 * of the client bundle and out of any link a social-preview bot can read.
 * The server decides, per request, whether to 302 a human to Fanvue or hand
 * a bot a neutral page (see server/routes/fanvueRoutes.js).
 *
 * Uses SERVER_URL so it works in both environments without nginx locally:
 *   - prod:  https://thecristinaadam.com/f/cristina  (nginx proxies /f/ → Node)
 *   - local: http://localhost:5000/f/cristina        (hits Node directly)
 */
export function fanvueLink(slug: string = CREATOR_SLUG): string {
  return `${SERVER_URL}/f/${encodeURIComponent(slug)}`;
}
