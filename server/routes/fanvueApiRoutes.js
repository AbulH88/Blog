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

// ── Thin proxies over the Fanvue API (auto-refresh handled in the service) ──
const proxy = (method, pathFn) => [loadCreator, async (req, res) => {
  try {
    const data = await fanvue.fanvueFetch(req.creator, method, pathFn(req), method === 'POST' ? req.body : undefined);
    res.json(data);
  } catch (err) {
    if (/not connected|reconnect/i.test(err.message)) return res.status(409).json({ error: err.message, needsConnect: true });
    res.status(err.status || 502).json({ error: err.message, detail: err.body });
  }
}];

const qs = (req) => { const s = new URLSearchParams(req.query).toString(); return s ? `?${s}` : ''; };

router.get('/account',            ...proxy('GET',  (req) => `/current-user/account`));
router.get('/me',                 ...proxy('GET',  (req) => `/current-user`));
router.get('/chats',              ...proxy('GET',  (req) => `/chats${qs(req)}`));
router.get('/chats/:uuid/messages', ...proxy('GET', (req) => `/chats/${req.params.uuid}/messages${qs(req)}`));
router.post('/chats/:uuid/messages', ...proxy('POST', (req) => `/chats/${req.params.uuid}/messages`));
router.get('/earnings/summary',   ...proxy('GET',  (req) => `/earnings/summary${qs(req)}`));
router.get('/earnings/data',      ...proxy('GET',  (req) => `/earnings/data${qs(req)}`));
router.get('/subscribers',        ...proxy('GET',  (req) => `/subscribers${qs(req)}`));
router.get('/followers',          ...proxy('GET',  (req) => `/followers${qs(req)}`));
router.get('/fans/top-spending',  ...proxy('GET',  (req) => `/fans/top-spending${qs(req)}`));

module.exports = router;
