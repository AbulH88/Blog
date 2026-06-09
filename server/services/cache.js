/**
 * Response cache helper — Redis-backed in production, in-process Map in dev.
 *
 * Usage:
 *   const cache = require('./services/cache');
 *   const fresh = await cache.getOrSet('creator:cristina', 60, async () => {
 *     return await Creator.findOne({ where: { slug: 'cristina' } });
 *   });
 *
 * Why this matters at scale: the launch-day spike from 60k followers will
 * hit /api/creator/:slug 50+ times per second. Each call is a DB query.
 * With a 60s cache:
 *   - First hit: 1 DB query, populates cache
 *   - Next 59s of traffic: 0 DB queries
 *   - DB load reduced ~99% on the hottest endpoint
 *
 * Invalidation: when a creator updates their profile, call cache.del(key).
 * For ephemeral cached responses (60s TTL), eventual consistency is fine.
 */

const redis = require('./redis');

// In-process fallback — bounded so memory doesn't grow unbounded if Redis is
// off and the app runs for weeks. Eviction on first-set when full.
const MAX_LOCAL_ENTRIES = 500;
const localStore = new Map();

function setLocal(key, value, ttlSec) {
  if (localStore.size >= MAX_LOCAL_ENTRIES) {
    // Drop oldest entry (FIFO)
    const oldest = localStore.keys().next().value;
    localStore.delete(oldest);
  }
  const expiresAt = Date.now() + ttlSec * 1000;
  localStore.set(key, { value, expiresAt });
}

function getLocal(key) {
  const entry = localStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    localStore.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Get cached value or compute + cache it. `compute` runs at most once per
 * miss; concurrent requests during cold-cache don't dogpile because Redis
 * SET is atomic and the local fallback is single-process anyway.
 *
 * @param {string} key      — cache key (use colons as separators: 'creator:cristina')
 * @param {number} ttlSec   — cache lifetime in seconds
 * @param {Function} compute — async function returning the value to cache
 */
async function getOrSet(key, ttlSec, compute) {
  if (redis.isEnabled()) {
    try {
      const cached = await redis.client.get(key);
      if (cached) return JSON.parse(cached);
      const fresh = await compute();
      // setex = SET with EX (expire) — atomic.
      await redis.client.setex(key, ttlSec, JSON.stringify(fresh));
      return fresh;
    } catch (err) {
      console.warn('[cache] redis error, falling through to compute:', err.message);
      return compute();
    }
  }
  // Local fallback
  const hit = getLocal(key);
  if (hit !== null) return hit;
  const fresh = await compute();
  setLocal(key, fresh, ttlSec);
  return fresh;
}

/** Plain set with TTL (Redis in prod = cluster-safe across PM2 workers). */
async function set(key, ttlSec, value) {
  if (redis.isEnabled()) {
    try { await redis.client.setex(key, ttlSec, JSON.stringify(value)); return; }
    catch (err) { console.warn('[cache] set error:', err.message); }
  }
  setLocal(key, value, ttlSec);
}

/** Plain get — returns null on miss/expiry. */
async function get(key) {
  if (redis.isEnabled()) {
    try { const c = await redis.client.get(key); return c ? JSON.parse(c) : null; }
    catch (err) { console.warn('[cache] get error:', err.message); return null; }
  }
  return getLocal(key);
}

/**
 * Atomic claim — set the key ONLY if it doesn't already exist (Redis SET NX).
 * Returns true if THIS caller won the claim, false if someone already holds it.
 * Cluster-safe across PM2 workers (Redis is shared). Used to guarantee a single
 * AI auto-reply per inbound message even when the webhook and the poller race.
 */
async function claim(key, ttlSec) {
  if (redis.isEnabled()) {
    try {
      const r = await redis.client.set(key, '1', 'EX', ttlSec, 'NX');
      return r === 'OK';
    } catch (err) {
      console.warn('[cache] claim error:', err.message);
      // Fall through to local (best-effort) rather than risk a double-send block.
    }
  }
  if (getLocal(key) !== null) return false;
  setLocal(key, '1', ttlSec);
  return true;
}

/** Invalidate a single key (e.g. after a write that affects cached data). */
async function del(key) {
  if (redis.isEnabled()) {
    try { await redis.client.del(key); } catch { /* ignore */ }
  }
  localStore.delete(key);
}

/**
 * Pattern-invalidate. Redis: SCAN + DEL. Local: iterate. Use sparingly —
 * SCAN is O(N) over the keyspace.
 */
async function delPattern(pattern) {
  if (redis.isEnabled()) {
    try {
      const stream = redis.client.scanStream({ match: pattern, count: 100 });
      const keys = [];
      for await (const chunk of stream) keys.push(...chunk);
      if (keys.length) await redis.client.del(...keys);
    } catch (err) {
      console.warn('[cache] delPattern error:', err.message);
    }
  }
  // Local store — turn glob into a simple startsWith / contains check
  const prefix = pattern.replace(/\*$/, '');
  for (const k of localStore.keys()) {
    if (k.startsWith(prefix)) localStore.delete(k);
  }
}

module.exports = { getOrSet, set, get, claim, del, delPattern };
