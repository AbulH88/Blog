/**
 * Redis client — env-driven, with a graceful no-op fallback for dev.
 *
 * Behaviour:
 *   - REDIS_URL set                 → real ioredis client (production / VPS)
 *   - REDIS_HOST set (no URL)       → real ioredis client (split form)
 *   - Nothing set                   → no-op stub. App still works, just
 *                                     without distributed cache, multi-process
 *                                     Socket.IO, or persistent rate-limit state.
 *
 * Why the stub: lets devs run locally on Windows without installing Redis.
 * Production VPS sets REDIS_URL=redis://localhost:6379 and everything wires up.
 *
 * Exposed:
 *   client       — main ioredis instance (or stub)
 *   pubClient    — pub/sub client for Socket.IO adapter (or stub)
 *   subClient    — pub/sub client for Socket.IO adapter (or stub)
 *   isEnabled()  — true when a real Redis is connected
 *   ping()       — promise that resolves 'PONG' on a real connection, or 'PONG-stub'
 */

let client;
let pubClient;
let subClient;
let enabled = false;
let connectAttempted = false;

function buildStub() {
  // Quack-like-ioredis stub. Only the methods we touch — get/set/del/expire/incr —
  // plus enough EventEmitter-ish surface that the Socket.IO adapter doesn't crash
  // if someone accidentally uses it (we guard against that in socket.js).
  const stub = {
    isStub: true,
    status: 'stub',
    async get() { return null; },
    async set() { return 'OK'; },
    async setex() { return 'OK'; },
    async del() { return 0; },
    async expire() { return 0; },
    async incr() { return 1; },
    async ping() { return 'PONG-stub'; },
    async quit() { return 'OK'; },
    on() { return stub; },
    duplicate() { return stub; },
    // rate-limit-redis uses sendCommand. Stubbed to a no-op object so the
    // library can still load without throwing.
    async sendCommand() { return null; },
  };
  return stub;
}

function buildClient() {
  if (connectAttempted) return; // idempotent
  connectAttempted = true;

  const url = process.env.REDIS_URL;
  const host = process.env.REDIS_HOST;

  if (!url && !host) {
    client = buildStub();
    pubClient = buildStub();
    subClient = buildStub();
    enabled = false;
    console.warn('[redis] no REDIS_URL/REDIS_HOST set — running with in-memory stub (dev mode)');
    return;
  }

  // Real connection
  let Redis;
  try {
    Redis = require('ioredis');
  } catch {
    console.warn('[redis] ioredis not installed — falling back to stub');
    client = buildStub();
    pubClient = buildStub();
    subClient = buildStub();
    enabled = false;
    return;
  }

  const opts = url
    ? url
    : {
        host: host || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        // Don't crash boot if Redis is slow/unreachable — log + retry.
        maxRetriesPerRequest: 3,
        enableOfflineQueue: true,
      };

  client = new Redis(opts);
  pubClient = client.duplicate();
  subClient = client.duplicate();

  client.on('error', (err) => {
    console.warn('[redis] client error:', err.message);
  });
  client.on('ready', () => {
    enabled = true;
    console.log('[redis] connected');
  });
  // Best-effort: probe immediately so we know whether we're live.
  client.ping().then(() => { enabled = true; }).catch(() => { enabled = false; });
}

buildClient();

function isEnabled() { return enabled === true && !client?.isStub; }
async function ping() { return client.ping(); }

module.exports = {
  get client()    { return client; },
  get pubClient() { return pubClient; },
  get subClient() { return subClient; },
  isEnabled,
  ping,
};
