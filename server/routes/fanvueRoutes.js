/**
 * Public, bot-safe Fanvue entry point.
 *
 *   GET /f/:slug
 *
 * Lives on the MARKETING ROOT domain (e.g. thecristinaadam.com/f/cristina).
 * Unlike the members subdomain, the root deliberately ALLOWS social-preview
 * bots (so IG/TikTok can render a clean preview of the creator's bio link).
 * That means we cannot rely on nginx to filter bots here — the gate has to
 * live in Node, per-request, by User-Agent.
 *
 * Behaviour:
 *   - A social-preview crawler (facebookexternalhit, TikTokBot, …) gets a
 *     neutral 200 HTML page. No redirect, no "Fanvue" string, nothing that
 *     could flag the creator's IG/TikTok account. The bot makes its harmless
 *     preview and leaves none the wiser.
 *   - A real browser gets a 302 straight to the creator's Fanvue profile —
 *     one tap from the bio/homepage, no login, no signup.
 *
 * The Fanvue URL is never written into client HTML or the JS bundle; it is
 * only ever revealed in a 302 served to a non-bot request at click time.
 *
 * Mirrors the existing `/r/:character` shortlink pattern (shortlinkRoutes.js).
 */
const express = require('express');
const router = express.Router();

const { Creator } = require('../models');
const events = require('../services/events');
const { isSocialBot } = require('../lib/socialBots');

/**
 * Minimal, lifestyle-neutral page served to social-preview crawlers.
 * Intentionally boring: no monetization language, no Fanvue, no redirect.
 */
function neutralBotPage(displayName) {
  const name = (displayName || 'Welcome').replace(/[<>&]/g, '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${name}</title>
<meta property="og:title" content="${name}">
<meta property="og:description" content="Lifestyle, travel, and creative work.">
</head>
<body style="font-family:system-ui,sans-serif;text-align:center;padding:60px 20px;color:#333">
<p>Loading…</p>
</body>
</html>`;
}

// GET /f/:slug — primary entry. Bot → neutral 200; human → 302 to Fanvue.
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;

  let creator = null;
  try {
    creator = await Creator.findOne({ where: { slug } });
  } catch {
    /* DB hiccup — fall through to graceful redirect below */
  }

  // No creator or no Fanvue configured → never a dead link; bounce to home.
  if (!creator || !creator.fanvueUrl) {
    return res.redirect(302, '/');
  }

  // Edge caches must NOT cache this per-UA response (we vary the answer by
  // User-Agent). Same no-store posture we use for robots.txt.
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.set('Vary', 'User-Agent');

  // Social-preview crawler → neutral page, never sees Fanvue.
  if (isSocialBot(req.headers['user-agent'])) {
    return res.status(200).type('html').send(neutralBotPage(creator.displayName));
  }

  // Real human → log the click, then bounce straight to Fanvue.
  try {
    events.log('fanvue_link_clicked', {
      creatorId: creator.id,
      props: { slug, source: 'redirect' },
    });
  } catch {
    /* analytics best-effort */
  }

  return res.redirect(302, creator.fanvueUrl);
});

module.exports = router;
