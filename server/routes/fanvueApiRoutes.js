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
const { suggestReply } = require('../services/fanvueAi');

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
  try {
    const creator = await Creator.findByPk(req.user.creatorId);
    if (!creator) return res.status(404).json({ error: 'Creator not found' });
    req.creator = creator;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Failed to load creator', detail: err.message });
  }
}

// Save OAuth client credentials and/or manually-pasted tokens.
router.post('/credentials', loadCreator, async (req, res) => {
  const { clientId, clientSecret, accessToken, refreshToken } = req.body || {};
  const patch = {};
  // Only overwrite when a non-empty value is supplied — saving with blank
  // fields must NOT wipe already-stored credentials.
  if (clientId && clientId.trim()) patch.fanvueClientId = clientId.trim();
  if (clientSecret && clientSecret.trim()) patch.fanvueClientSecret = clientSecret.trim();
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
    autoReply: !!c.fanvueAiAutoReply,
    userUuid: c.fanvueUserUuid || null,
  });
});

// AI assist — suggest a reply for a chat (reuses the creator's AI persona/model).
router.post('/ai-reply', loadCreator, async (req, res) => {
  const { chatUuid } = req.body || {};
  if (!chatUuid) return res.status(400).json({ error: 'chatUuid required' });
  try {
    const text = await suggestReply(req.creator, chatUuid);
    if (!text) return res.status(422).json({ error: 'No reply generated' });
    res.json({ text });
  } catch (err) {
    handleErr(res, err);
  }
});

// Toggle background AI auto-reply for new Fanvue DMs.
router.patch('/settings', loadCreator, async (req, res) => {
  const patch = {};
  if (typeof req.body?.autoReply === 'boolean') patch.fanvueAiAutoReply = req.body.autoReply;
  await req.creator.update(patch);
  res.json({ ok: true, autoReply: !!req.creator.fanvueAiAutoReply });
});

// ── Generic, allow-listed proxy over the Fanvue API ──────────────────────────
// Hard limits: only the creator's OWN account (their stored token), and only
// paths matching the per-method allow-list below. Agency endpoints
// (/agencies/*, /creators/{uuid}/*) are deliberately excluded everywhere.
const GET_ALLOW = [
  /^\/current-user(\/(account|unread-counts))?$/,
  /^\/users\/(me|account|unread-counts)$/,
  /^\/insights\/earnings\/(summary|data|percentile|reversals)$/,
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
  /^\/media\/bulk$/,
  /^\/media\/[\w-]+(\/entitled)?$/,
  // Multipart upload — signed URL per part. The uploadId is an opaque
  // Fanvue/S3 token that contains UUID-hyphens, underscores, dots, base64
  // chars, etc. — much wider than \w. Use [^/?]+ to match any uploadId.
  /^\/media\/uploads\/[^/?]+\/parts\/\d+\/url$/,
  /^\/tracking-links$/,
  /^\/tracking-links\/[\w-]+\/users$/,
  /^\/tracking-metadata\/[\w-]+$/,
  /^\/insights\/top-spending-fans$/,
  /^\/insights\/fans(\/[\w-]+|\/bulk)$/,
  /^\/earnings\/(summary|data|percentile|reversals)$/,
  /^\/(subscribers|followers)$/,
  /^\/content-collections$/,
  /^\/(mass-messages|template-messages)$/,
  /^\/template-messages\/[\w-]+$/,
];
// Writes (create / send / actions)
const POST_ALLOW = [
  /^\/posts$/,
  /^\/posts\/[\w-]+\/(pin|repost|comments)$/,
  /^\/chats$/,
  /^\/chats\/[\w-]+\/messages$/,
  /^\/chats\/messages\/(bulk|media\/resolve)$/,
  /^\/vault\/folders$/,
  /^\/vault\/folders\/[^/?]+\/media$/,
  /^\/custom-lists$/,
  /^\/custom-lists\/[\w-]+\/members$/,
  // Multipart upload session — create (POST). Completion is PATCH below,
  // NOT a separate /complete suffix. Both paths verified against docs.
  /^\/media\/uploads$/,
  /^\/media\/[\w-]+\/grant-access$/,
  /^\/tracking-links$/,
  /^\/mass-messages$/,
  /^\/insights\/fans\/bulk$/,
  /^\/content-collections$/,
];
const PATCH_ALLOW = [
  /^\/posts\/[\w-]+$/,
  /^\/chats\/[\w-]+$/,
  /^\/vault\/folders\/[^/?]+$/,
  /^\/custom-lists\/[\w-]+$/,
  /^\/mass-messages\/[\w-]+$/,
  /^\/content-collections\/[\w-]+$/,
  // Complete multipart upload — finalises the S3 upload and triggers
  // processing. Body carries the parts array with {PartNumber, ETag}.
  // uploadId is an opaque S3 token; use [^/?]+ (see GET_ALLOW comment).
  /^\/media\/uploads\/[^/?]+$/,
];
const DELETE_ALLOW = [
  /^\/posts\/[\w-]+$/,
  /^\/posts\/[\w-]+\/pin$/,
  /^\/posts\/[\w-]+\/comments\/[\w-]+$/,
  /^\/chats\/[\w-]+\/messages\/[\w-]+$/,
  /^\/vault\/folders\/[^/?]+$/,
  /^\/vault\/folders\/[^/?]+\/media\/[\w-]+$/,
  /^\/custom-lists\/[\w-]+$/,
  /^\/custom-lists\/[\w-]+\/members\/[\w-]+$/,
  /^\/tracking-links\/[\w-]+$/,
  /^\/mass-messages\/[\w-]+$/,
  /^\/content-collections\/[\w-]+$/,
];

function handleErr(res, err) {
  if (/not connected|reconnect/i.test(err.message)) return res.status(409).json({ error: err.message, needsConnect: true });
  res.status(err.status || 502).json({ error: err.message, detail: err.body });
}
const pathOf = (full) => String(full || '').split('?')[0];

// Single handler factory: validates the path against the method's allow-list,
// then forwards to Fanvue with the creator's token (auto-refresh in the service).
function proxyHandler(method, allow) {
  return [loadCreator, async (req, res) => {
    const full = String(req.query.path || '');
    if (!full.startsWith('/') || !allow.some(re => re.test(pathOf(full)))) {
      return res.status(400).json({ error: `Path not allowed for ${method}: ${pathOf(full)}` });
    }
    try {
      const body = (method === 'POST' || method === 'PATCH') ? req.body : undefined;
      res.json(await fanvue.fanvueFetch(req.creator, method, full, body));
    } catch (err) { handleErr(res, err); }
  }];
}

router.get('/get',       ...proxyHandler('GET', GET_ALLOW));
router.post('/post',     ...proxyHandler('POST', POST_ALLOW));
router.patch('/patch',   ...proxyHandler('PATCH', PATCH_ALLOW));
router.delete('/delete', ...proxyHandler('DELETE', DELETE_ALLOW));

module.exports = router;
