/**
 * Fanvue integration routes (admin / creator only).
 *
 *   POST /api/fanvue/credentials  — save OAuth client id/secret and/or paste tokens
 *   GET  /api/fanvue/connect      — returns the Fanvue authorize URL (client redirects)
 *   GET  /api/fanvue/callback     — OAuth redirect target (PUBLIC; identified via PKCE state)
 *   POST /api/fanvue/disconnect   — clear stored tokens
 *   GET  /api/fanvue/status       — connection status (no secrets)
 *   GET  /api/fanvue/account|chats|chats/:uuid/messages|earnings/*|subscribers|fans/top-spending
 *   POST /api/fanvue/chats/:uuid/messages — send a message
 *
 * All secrets/tokens stay on the Creator row and are only reachable through
 * these creator-authed routes — never the public config or the bundle.
 */
const express = require('express');
const router = express.Router();
const { Creator } = require('../models');
const { requireAuth, requireCreator } = require('../middleware/authMiddleware');
const fanvue = require('../services/fanvue');

const MEMBERS_URL = process.env.PUBLIC_APP_URL || 'https://members.thecristinaadam.com';
const callbackUri = (req) => `${req.protocol}://${req.get('host')}/api/fanvue/callback`;

// ── PUBLIC: OAuth callback (browser redirect from Fanvue, no admin token) ──
router.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const done = (status) => res.redirect(`${MEMBERS_URL}/admin?tab=fanvue&fanvue=${status}`);
  try {
    if (error) return done('denied');
    if (!code || !state) return done('error');
    const pkce = await fanvue.consumePkce(String(state));
    if (!pkce) return done('expired');
    const creator = await Creator.findByPk(pkce.creatorId);
    if (!creator) return done('error');
    await fanvue.exchangeCode(creator, String(code), pkce.codeVerifier, pkce.redirectUri);
    // Best-effort: cache handle for display.
    try {
      const me = await fanvue.fanvueFetch(creator, 'GET', '/current-user');
      await creator.update({
        fanvueUserUuid: me?.uuid || me?.id || null,
        fanvueHandle: me?.handle || me?.username || me?.displayName || null,
      });
    } catch { /* non-fatal */ }
    return done('connected');
  } catch (err) {
    console.error('[fanvue] callback error:', err.message);
    return done('error');
  }
});

// ── Everything below requires a creator (admin) token ──
router.use(requireAuth, requireCreator);

async function loadCreator(req, res, next) {
  const creator = await Creator.findByPk(req.user.creatorId);
  if (!creator) return res.status(404).json({ error: 'Creator not found' });
  req.creator = creator;
  next();
}

// Save OAuth client credentials and/or manually-pasted tokens.
router.post('/credentials', loadCreator, async (req, res) => {
  const { clientId, clientSecret, accessToken, refreshToken } = req.body || {};
  const patch = {};
  if (clientId !== undefined) patch.fanvueClientId = clientId.trim() || null;
  if (clientSecret !== undefined && clientSecret !== '') patch.fanvueClientSecret = clientSecret.trim();
  if (accessToken !== undefined && accessToken !== '') {
    patch.fanvueAccessToken = accessToken.trim();
    // Manual paste: assume ~1h validity unless a refresh token is also given.
    patch.fanvueTokenExpiresAt = new Date(Date.now() + 55 * 60 * 1000);
    patch.fanvueConnected = true;
  }
  if (refreshToken !== undefined && refreshToken !== '') patch.fanvueRefreshToken = refreshToken.trim();
  await req.creator.update(patch);
  res.json({ ok: true });
});

// Start OAuth — return the authorize URL for the client to navigate to.
router.get('/connect', loadCreator, async (req, res) => {
  try {
    if (!req.creator.fanvueClientId || !req.creator.fanvueClientSecret) {
      return res.status(400).json({ error: 'Save your Fanvue Client ID and Secret first.' });
    }
    const url = await fanvue.buildAuthorizeUrl(req.creator, callbackUri(req));
    res.json({ authorizeUrl: url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/disconnect', loadCreator, async (req, res) => {
  await req.creator.update({
    fanvueAccessToken: null, fanvueRefreshToken: null, fanvueTokenExpiresAt: null,
    fanvueConnected: false, fanvueScopes: null, fanvueUserUuid: null, fanvueHandle: null,
  });
  res.json({ ok: true });
});

router.get('/status', loadCreator, (req, res) => {
  const c = req.creator;
  res.json({
    connected: !!c.fanvueConnected,
    hasCredentials: !!(c.fanvueClientId && c.fanvueClientSecret),
    handle: c.fanvueHandle || null,
    scopes: c.fanvueScopes || null,
    tokenExpiresAt: c.fanvueTokenExpiresAt || null,
  });
});

// ── Generic, allow-listed proxy over the Fanvue API ──────────────────────────
// One pair of routes covers every creator-level resource. Hard limits:
//   - only the creator's OWN account (their stored token)
//   - only GET (read) + a tiny POST allow-list (send message / mass message)
//   - only paths matching the allow-list below (no arbitrary host/path)
// The client passes the full Fanvue path (incl. query) in ?path=.
const GET_ALLOW = [
  /^\/current-user(\/(account|unread-counts))?$/,
  /^\/notifications$/,
  /^\/posts$/,
  /^\/posts\/[\w-]+$/,
  /^\/posts\/[\w-]+\/(comments|likes|tips)$/,
  /^\/chats$/,
  /^\/chats\/[\w-]+\/(messages|media)$/,
  /^\/vault\/folders$/,
  /^\/vault\/folders\/[^/?]+(\/media)?$/,
  /^\/(custom-lists|smart-lists)$/,
  /^\/(custom-lists|smart-lists)\/[\w-]+\/members$/,
  /^\/user\/media$/,
  /^\/media\/[\w-]+$/,
  /^\/tracking-links$/,
  /^\/tracking-links\/[\w-]+\/users$/,
  /^\/insights\/top-spending-fans$/,
  /^\/insights\/fans\/[\w-]+$/,
  /^\/earnings\/(summary|data|percentile|reversals)$/,
  /^\/(subscribers|followers)$/,
  /^\/content-collections$/,
  /^\/(mass-messages|template-messages)$/,
];
const POST_ALLOW = [
  /^\/chats\/[\w-]+\/messages$/,
  /^\/mass-messages$/,
];

function handleErr(res, err) {
  if (/not connected|reconnect/i.test(err.message)) return res.status(409).json({ error: err.message, needsConnect: true });
  res.status(err.status || 502).json({ error: err.message, detail: err.body });
}
const pathOf = (full) => String(full || '').split('?')[0];

router.get('/get', loadCreator, async (req, res) => {
  const full = String(req.query.path || '');
  if (!full.startsWith('/') || !GET_ALLOW.some(re => re.test(pathOf(full)))) {
    return res.status(400).json({ error: `Path not allowed: ${pathOf(full)}` });
  }
  try { res.json(await fanvue.fanvueFetch(req.creator, 'GET', full)); }
  catch (err) { handleErr(res, err); }
});

router.post('/post', loadCreator, async (req, res) => {
  const full = String(req.query.path || '');
  if (!full.startsWith('/') || !POST_ALLOW.some(re => re.test(pathOf(full)))) {
    return res.status(400).json({ error: `Path not allowed: ${pathOf(full)}` });
  }
  try { res.json(await fanvue.fanvueFetch(req.creator, 'POST', full, req.body)); }
  catch (err) { handleErr(res, err); }
});

module.exports = router;
