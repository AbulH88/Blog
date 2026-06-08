/**
 * Fanvue API client + OAuth 2.0 (authorization_code + PKCE, refresh_token).
 *
 * Fanvue has no static API keys — every request needs a short-lived Bearer
 * access token (~1h) minted from a one-time browser authorize, then kept alive
 * via the refresh token (offline_access). Client auth = client_secret_basic.
 *
 * Tokens live on the Creator row (server-only; stripped from public config).
 * PKCE state is parked in the shared cache (Redis in prod) so /connect and
 * /callback work across PM2 cluster workers.
 */
const crypto = require('crypto');
const cache = require('./cache');

const AUTH_BASE = 'https://auth.fanvue.com';
const API_BASE = 'https://api.fanvue.com';
const API_VERSION = '2025-06-26';
// Full scope list matching every resource exposed by the admin's allow-listed
// proxy (see fanvueApiRoutes.js GET_/POST_/PATCH_/DELETE_ALLOW). Each resource
// gets the read + write scope it actually needs. Adding new admin tabs?
// Add the matching scope here AND have the creator re-OAuth.
//
// If Fanvue rejects an unknown scope name during authorize, drop it and reconnect.
const SCOPES = [
  // Required for OAuth + token refresh
  'openid',
  'offline_access',
  'offline',
  // Profile / account / notifications
  'read:self',
  'read:notification',
  // Chats + DM send
  'read:chat',
  'write:chat',
  // Fans / subscribers / lists
  'read:fan',
  'read:list',
  'write:list',
  // Posts + comments
  'read:post',
  'write:post',
  // Vault folders + media (THIS is what fixes the "Insufficient scopes" error)
  'read:vault',
  'write:vault',
  'read:media',
  'write:media',
  // Mass messages / broadcasts / templates
  'read:broadcast',
  'write:broadcast',
  // Tracking links
  'read:tracking',
  'write:tracking',
  // Earnings + insights
  'read:earnings',
  'read:insight',
  // Content collections
  'read:collection',
  'write:collection',
].join(' ');
const PKCE_TTL = 600; // 10 min

const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Basic auth header from the creator's OAuth client credentials. */
function basicAuth(creator) {
  const raw = `${creator.fanvueClientId}:${creator.fanvueClientSecret}`;
  return 'Basic ' + Buffer.from(raw).toString('base64');
}

/**
 * Build the Fanvue authorize URL (PKCE S256). Stashes {codeVerifier, creatorId}
 * in the cache keyed by `state`, consumed in the callback.
 */
async function buildAuthorizeUrl(creator, redirectUri) {
  if (!creator.fanvueClientId) throw new Error('Fanvue Client ID not set');
  const state = b64url(crypto.randomBytes(24));
  const codeVerifier = b64url(crypto.randomBytes(48));
  const codeChallenge = b64url(crypto.createHash('sha256').update(codeVerifier).digest());
  await cache.set(`fanvue:pkce:${state}`, PKCE_TTL, { codeVerifier, creatorId: creator.id, redirectUri });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: creator.fanvueClientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${AUTH_BASE}/oauth2/auth?${params.toString()}`;
}

/** Look up the parked PKCE entry for a callback `state` (single-use). */
async function consumePkce(state) {
  const entry = await cache.get(`fanvue:pkce:${state}`);
  if (entry) await cache.del(`fanvue:pkce:${state}`);
  return entry;
}

/** Persist a token response onto the creator row. */
async function storeTokens(creator, tok) {
  const expiresAt = new Date(Date.now() + ((tok.expires_in || 3600) - 60) * 1000);
  await creator.update({
    fanvueAccessToken: tok.access_token,
    // Fanvue may rotate the refresh token; keep the old one if none returned.
    fanvueRefreshToken: tok.refresh_token || creator.fanvueRefreshToken,
    fanvueTokenExpiresAt: expiresAt,
    fanvueScopes: tok.scope || creator.fanvueScopes,
    fanvueConnected: true,
  });
}

/** Exchange an authorization code for tokens (callback step). */
async function exchangeCode(creator, code, codeVerifier, redirectUri) {
  const res = await fetch(`${AUTH_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: basicAuth(creator), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });
  const tok = await res.json();
  if (!res.ok) throw new Error(`token exchange failed: ${tok.error || res.status} ${tok.error_description || ''}`);
  await storeTokens(creator, tok);
  return tok;
}

/** Refresh the access token using the stored refresh token. */
async function refreshAccessToken(creator) {
  if (!creator.fanvueRefreshToken) throw new Error('No Fanvue refresh token — reconnect required');
  const res = await fetch(`${AUTH_BASE}/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: basicAuth(creator), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: creator.fanvueRefreshToken }),
  });
  const tok = await res.json();
  if (!res.ok) {
    // Refresh token dead → mark disconnected so the UI prompts a reconnect.
    await creator.update({ fanvueConnected: false });
    throw new Error(`refresh failed: ${tok.error || res.status}`);
  }
  await storeTokens(creator, tok);
  return tok.access_token;
}

/** Return a non-expired access token, refreshing if needed. */
async function getValidAccessToken(creator) {
  if (!creator.fanvueAccessToken) throw new Error('Fanvue not connected');
  const exp = creator.fanvueTokenExpiresAt ? new Date(creator.fanvueTokenExpiresAt).getTime() : 0;
  if (Date.now() >= exp) return refreshAccessToken(creator);
  return creator.fanvueAccessToken;
}

/**
 * Call the Fanvue API. `path` starts with "/". Refreshes + retries once on 401.
 * Returns parsed JSON (or throws with the upstream status/body).
 */
async function fanvueFetch(creator, method, path, body, _retry = false) {
  const token = await getValidAccessToken(creator);
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Fanvue-API-Version': API_VERSION,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 401 && !_retry) {
    await refreshAccessToken(creator);
    return fanvueFetch(creator, method, path, body, true);
  }
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 500) }; }
  if (!res.ok) {
    const detail = (data && (data.error_description || data.message || data.error)) || '';
    const err = new Error(`Fanvue ${method} ${path} → ${res.status}${detail ? ' · ' + detail : ''}`);
    err.status = res.status; err.body = data;
    throw err;
  }
  return data;
}

module.exports = {
  SCOPES, API_VERSION,
  buildAuthorizeUrl, consumePkce, exchangeCode, refreshAccessToken,
  getValidAccessToken, fanvueFetch, storeTokens,
};
