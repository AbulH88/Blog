/**
 * Bio shortlinks for the marketing-vs-members domain split.
 *
 * Pattern: each creator's IG/TikTok bio points at
 *   https://thecristinaadam.com/r/cristina
 * which lands on the public marketing domain. The crawler that previews the
 * bio link only ever sees the clean marketing root.
 *
 * When a human follows the link, the route:
 *   1. records an Event('bio_link_clicked', { character }) for the funnel
 *   2. 302 redirects to https://members.<root>/register?via=:character
 *
 * Two endpoints mounted because the SPA also fires a fire-and-forget tracking
 * POST from <ShortlinkRedirect /> in case the user is already past the page
 * (e.g. they used the back button on members.* and bounced back to root).
 */
const express = require('express');
const router = express.Router();

const events = require('../services/events');

/**
 * Build the members destination from the incoming Host header so this works
 * for any creator brand (cristina/aria/maya). Trims an optional `www.` and
 * prepends `members.`.
 */
function membersDestination(req, character) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  let host = (req.hostname || req.headers.host || '').toLowerCase().replace(/^www\./, '');
  // If somehow already on members.*, don't double up.
  if (!host.startsWith('members.')) host = `members.${host}`;
  // Preserve port for local dev (members.localhost:5173)
  const reqHost = String(req.headers.host || '');
  const portMatch = reqHost.match(/:(\d+)$/);
  const port = portMatch ? `:${portMatch[1]}` : '';
  return `${proto}://${host}${port}/register?via=${encodeURIComponent(character)}`;
}

// GET /r/:character — primary entry from IG bio. Logs + 302 to members.*.
router.get('/:character', (req, res) => {
  const { character } = req.params;
  try { events.log('bio_link_clicked', { props: { character } }); }
  catch { /* analytics best-effort */ }
  return res.redirect(302, membersDestination(req, character));
});

// POST /api/r/:character — fire-and-forget tracking from the SPA fallback
// (when SPA-side redirect runs before the GET would fire).
router.post('/:character', (req, res) => {
  const { character } = req.params;
  try { events.log('bio_link_clicked', { props: { character, source: 'spa' } }); }
  catch { /* ignore */ }
  return res.json({ ok: true });
});

module.exports = router;
