/**
 * Public Fanvue entry point — "Clean Hub" click-through landing page.
 *
 *   GET /f/:slug
 *
 * ⚠️  THIS RESPONSE MUST BE IDENTICAL FOR ALL USER-AGENTS.
 *     No bot detection, no UA branching, no conditional status/headers/body.
 *     See PROJECT.md §0.2. (We deliberately removed the old cloaking that
 *     served bots a neutral page and humans a redirect — cloaking is itself a
 *     platform-risk signal. The safe pattern is one consistent landing page
 *     where the visitor clicks through to Fanvue.)
 *
 * Behaviour (same for everyone):
 *   - 404 if the creator/slug isn't found or has no Fanvue configured.
 *   - Otherwise a 200 HTML landing page showing the Fanvue logo + a visible
 *     "Continue →" button. The redirect to Fanvue happens ONLY when the
 *     visitor clicks that button (a normal <a href>).
 */
const express = require('express');
const router = express.Router();

const { Creator } = require('../models');
const events = require('../services/events');
const { fanvueBranding } = require('../lib/fanvueBrand');

const esc = (s) => String(s || '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

/** Click-through landing page — identical bytes for every visitor. */
function landingPage({ name, fanvueUrl, label, logo }) {
  const safeName = esc(name);
  const href = esc(fanvueUrl);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="data:,">
<title>${safeName}</title>
<style>
  :root { --cream:#FDF6EC; --ink:#1F1A14; --muted:#8A7E70; --terra:#C75A3E; --line:#E8DCC8; }
  * { box-sizing: border-box; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:var(--cream); color:var(--ink);
         font-family:'Inter',system-ui,-apple-system,sans-serif; padding:24px; }
  .card { width:100%; max-width:380px; background:#fff; border:1px solid var(--line);
          border-radius:18px; padding:38px 30px; text-align:center;
          box-shadow:0 18px 50px rgba(31,26,20,0.10); }
  .logo { width:64px; height:64px; border-radius:16px; margin:0 auto 18px; display:block; }
  h1 { font-family:'Cormorant Garamond',Georgia,serif; font-style:italic; font-weight:700;
       font-size:2rem; margin:0 0 4px; }
  .sub { color:var(--muted); font-size:0.92rem; margin:0 0 26px; line-height:1.5; }
  .btn { display:block; width:100%; padding:15px 22px; border-radius:999px;
         background:var(--terra); color:#fff; text-decoration:none; font-weight:700;
         font-size:0.98rem; letter-spacing:0.3px; transition:background .15s, transform .15s;
         box-shadow:0 6px 18px rgba(199,90,62,0.28); }
  .btn:hover { background:#A8482F; transform:translateY(-1px); }
  .foot { margin-top:18px; font-size:0.74rem; color:var(--muted); }
</style>
</head>
<body>
  <main class="card">
    <img class="logo" src="${logo}" alt="${esc(label)}" />
    <h1>${safeName}</h1>
    <p class="sub">Tap below to continue to my ${esc(label)} page.</p>
    <a class="btn" href="${href}" rel="noopener noreferrer">Continue →</a>
    <p class="foot">No signup needed — opens ${esc(label)}</p>
  </main>
</body>
</html>`;
}

// GET /f/:slug — one identical landing page for everyone; click → Fanvue.
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;

  let creator = null;
  try {
    creator = await Creator.findOne({ where: { slug } });
  } catch {
    /* DB hiccup — treat as not found below */
  }

  // 404 if no creator or nothing to link to.
  if (!creator || !creator.fanvueUrl) {
    return res.status(404).type('html').send('<!doctype html><meta charset="utf-8"><title>Not found</title><p>Not found.</p>');
  }

  // Best-effort funnel logging — uniform for every request, not UA-conditional.
  try {
    events.log('fanvue_landing_view', { creatorId: creator.id, props: { slug } });
  } catch {
    /* analytics best-effort */
  }

  const { label, logo } = fanvueBranding();
  // Same content for all → safe to cache uniformly. NO Vary: User-Agent.
  res.set('Cache-Control', 'public, max-age=60');
  return res.status(200).type('html').send(
    landingPage({ name: creator.displayName, fanvueUrl: creator.fanvueUrl, label, logo })
  );
});

module.exports = router;
