require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const { syncDatabase } = require('./models');
const { initPayments } = require('./payments');
const sentryService = require('./services/sentry');
const { requireAuth, requireCreator } = require('./middleware/authMiddleware');
const authRoutes = require('./routes/authRoutes');
const creatorRoutes = require('./routes/creatorRoutes');
const postRoutes = require('./routes/postRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const chatRoutes = require('./routes/chatRoutes');
const collectionRoutes = require('./routes/collectionRoutes');
const setupSocket = require('./socket');

// Allowed origins — driven by ALLOWED_ORIGINS env var (comma-separated).
// Must be set in production to your frontend domain(s).
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const app = express();
app.set('trust proxy', 1); // required behind nginx/Cloudflare so req.ip is the real client IP
sentryService.init(app); // no-op if SENTRY_DSN unset
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: allowedOrigins, methods: ['GET', 'POST'] },
});

// Socket.IO Redis adapter — when Redis is enabled, real-time events propagate
// across all PM2 workers. Without it, a fan connected to worker-2 wouldn't
// receive a message that arrived via worker-1's HTTP route. No-op when Redis
// stubbed (dev mode → single-process, in-memory is fine).
const redis = require('./services/redis');
// Attach the Socket.IO Redis adapter once the connection is confirmed ready.
// isEnabled() is checked synchronously at require-time (before the async 'ready'
// event fires), so we use once('ready') to avoid a race where the adapter never
// attaches in PM2 cluster mode even when Redis is running.
if (process.env.REDIS_URL || process.env.REDIS_HOST) {
  redis.client.once('ready', () => {
    try {
      const { createAdapter } = require('@socket.io/redis-adapter');
      io.adapter(createAdapter(redis.pubClient, redis.subClient));
      console.log('[socket.io] using Redis adapter');
    } catch (err) {
      console.warn('[socket.io] failed to attach Redis adapter:', err.message);
    }
  });
}

setupSocket(io);
app.set('io', io);
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────────────────────
// Security headers — relaxed CSP because frontend is served from the same origin
// in production (Nginx serves /var/www/<creator>-build/) but talks to /api/.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      mediaSrc: ["'self'", 'https:'],
      connectSrc: ["'self'", 'wss:', 'ws:', 'https:'],
      fontSrc: ["'self'", 'https:'],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow /uploads/ to be embedded
}));
// gzip / deflate compression on all API responses. Cloudflare also compresses
// edge-side, but origin compression saves bandwidth between VPS and CF, and
// is what fans see on cache MISS (the first hit per file per region).
// level=6 is the sweet spot — ~70% size reduction with minimal CPU cost.
const compression = require('compression');
app.use(compression({
  level: 6,
  threshold: 1024, // don't bother for responses < 1 KB
}));

app.use(cors({
  origin: (origin, cb) => {
    // No Origin header → same-origin request / mobile WebView / curl / SSR — allow.
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    // Returning false (not an Error) omits the Access-Control-Allow-Origin
    // header so the browser blocks the response. We don't throw because
    // throwing produces a 500; cleanest is silent header-omit + log.
    console.warn('[cors] blocked origin:', origin);
    return cb(null, false);
  },
  credentials: true,
}));
// Capture raw bytes for the NOWPayments webhook BEFORE the global JSON parser
// consumes the body. Must be first so the route-level bodyParser.raw() sees
// req._body unset and captures a Buffer (needed for HMAC verification).
app.use('/api/payments/webhook/nowpayments', bodyParser.raw({ type: '*/*', limit: '1mb' }));
app.use(bodyParser.json({ limit: '1mb' }));
// /uploads/ is served with a long-lived immutable cache header. Filenames
// embed a timestamp (Date.now() + random suffix) so they're effectively
// content-addressed — when content changes, the URL changes. Cloudflare CDN
// will respect this and cache at edge for 1 year, dropping origin traffic
// by ~95% once the cache warms up.
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '365d',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

// Rate limits — protect against brute-force on auth + spam on tipping/wallet.
// When Redis is available, state lives in Redis so:
//   - Limits survive Node restarts (no "reboot to reset window" exploit)
//   - Limits are shared across PM2 cluster workers
// When Redis isn't available (dev), falls back to in-memory.
let limiterStore;
try {
  if (redis.isEnabled()) {
    const RedisStore = require('rate-limit-redis').default;
    limiterStore = (prefix) => new RedisStore({
      sendCommand: (...args) => redis.client.call(...args),
      prefix: `rl:${prefix}:`,
    });
    console.log('[rate-limit] using Redis store');
  }
} catch (err) {
  console.warn('[rate-limit] Redis store init failed, falling back to memory:', err.message);
}

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20, // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  store: limiterStore ? limiterStore('auth') : undefined,
  message: { error: 'Too many auth attempts. Please try again in 15 minutes.' },
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 60, // 60 writes per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  store: limiterStore ? limiterStore('write') : undefined,
  message: { error: 'Too many requests. Slow down a bit.' },
});
// Apply selectively — only on the endpoints that need it. Webhooks must NOT be limited.
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/creator/login', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/reset-password', authLimiter);
app.use('/api/auth/resend-verification', authLimiter);
app.use('/api/auth/verify-email', authLimiter);
app.use('/api/wallet', writeLimiter);

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 20, // 20 AI requests per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  store: limiterStore ? limiterStore('ai') : undefined,
  message: { error: 'Too many AI requests. Please slow down.' },
});
app.use('/api/ai', aiLimiter);

// ─── Multer (local upload — replaced by S3 in production) ─────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});

const allowedTypes = /jpeg|jpg|png|webp|gif|mp4|mov|mp3|m4a/;
// Images are post-processed by sharp (see middleware/imageProcess) so the
// pre-resize cap is mostly a sanity check against disk-fill DoS. Videos are
// passed through; ffmpeg transcoding is a future enhancement.
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB upper bound (was 500)
  fileFilter: (req, file, cb) => {
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    cb(ext && mime ? null : new Error('Invalid file type'), ext && mime);
  },
});
const { processImageUploads } = require('./middleware/imageProcess');


// ─── robots.txt — respects Creator.searchIndexable ───────────────────────────
// Adult sites usually want to be invisible to Google/Bing/IG bots by default.
// Creator can flip the toggle in Admin → Visibility to allow indexing.
// ─── Health check — hit by UptimeRobot every 5 min ──────────────────────────
// Returns 200 with { status: "ok" } when the server can talk to the DB, else
// 503. Designed to be cheap (DB ping is a single round-trip). Cache-Control:
// no-store so a cached CF response doesn't lie about live status.
const startedAt = Date.now();
app.get('/api/health', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const { sequelize } = require('./models');
    await sequelize.authenticate(); // SELECT 1 under the hood — < 1ms on SQLite
    const uptimeSec = Math.round((Date.now() - startedAt) / 1000);
    res.json({
      status: 'ok',
      uptime: uptimeSec,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || 'dev',
      db: 'reachable',
    });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      timestamp: new Date().toISOString(),
      db: 'unreachable',
      error: err.message,
    });
  }
});

app.get('/robots.txt', async (req, res) => {
  try {
    res.type('text/plain');

    // members.* subdomain — ALWAYS hard-block all crawlers, regardless of
    // the searchIndexable toggle. The paywall side of the platform must
    // never be exposed to search engines or social-preview bots.
    const host = (req.hostname || '').toLowerCase();
    if (host.startsWith('members.')) {
      res.send([
        '# members subdomain — age-gated paywall, hard-block all crawlers',
        'User-agent: *',
        'Disallow: /',
        '',
        'User-agent: facebookexternalhit',
        'Disallow: /',
        'User-agent: Twitterbot',
        'Disallow: /',
        'User-agent: Instagram',
        'Disallow: /',
        'User-agent: meta-externalagent',
        'Disallow: /',
        'User-agent: TikTokBot',
        'Disallow: /',
      ].join('\n'));
      return;
    }

    const { Creator } = require('./models');
    const creator = await Creator.findOne({ attributes: ['searchIndexable'] });
    const indexable = creator?.searchIndexable === true;
    if (indexable) {
      res.send([
        '# Public mode — search indexing on.',
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /admin',
        'Disallow: /r/',
        '',
        '# Block AI scrapers (training-data harvesters)',
        'User-agent: GPTBot',
        'Disallow: /',
        'User-agent: ClaudeBot',
        'Disallow: /',
        'User-agent: CCBot',
        'Disallow: /',
        'User-agent: Bytespider',
        'Disallow: /',
        'User-agent: Google-Extended',
        'Disallow: /',
        'User-agent: Applebot-Extended',
        'Disallow: /',
      ].join('\n'));
    } else {
      // Private-launch mode: block general crawlers + AI scrapers, but
      // EXPLICITLY ALLOW social-media link-preview bots so Instagram /
      // TikTok / Facebook / Twitter bio links still render preview cards.
      // The previous version disallowed these, which was hostile to the
      // very bots that drive bio-link traffic to the marketing site.
      res.send([
        '# Private launch — no general indexing, but link previews work.',
        '',
        '# Default: block everything (incl. Googlebot, Bingbot, etc.)',
        'User-agent: *',
        'Disallow: /',
        '',
        '# Block AI training/scraping bots',
        'User-agent: GPTBot',
        'Disallow: /',
        'User-agent: ClaudeBot',
        'Disallow: /',
        'User-agent: CCBot',
        'Disallow: /',
        'User-agent: Bytespider',
        'Disallow: /',
        '',
        '# Allow social-media link-preview bots — needed for IG/TikTok bio links',
        'User-agent: facebookexternalhit',
        'Allow: /',
        'User-agent: Twitterbot',
        'Allow: /',
        'User-agent: Instagram',
        'Allow: /',
        'User-agent: meta-externalagent',
        'Allow: /',
        'User-agent: TikTokBot',
        'Allow: /',
        'User-agent: LinkedInBot',
        'Allow: /',
        'User-agent: Pinterest',
        'Allow: /',
        'User-agent: Slackbot',
        'Allow: /',
        'User-agent: WhatsApp',
        'Allow: /',
        'User-agent: TelegramBot',
        'Allow: /',
        'User-agent: Discordbot',
        'Allow: /',
      ].join('\n'));
    }
  } catch {
    res.type('text/plain').send('User-agent: *\nDisallow: /\n');
  }
});

// ─── V2 Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/creator', creatorRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/wallet', require('./routes/walletRoutes'));
app.use('/api/instagram', require('./routes/instagramRoutes'));
app.use('/api/ai', require('./routes/aiChatRoutes'));
// Bio shortlinks for the marketing/members domain split. Two mounts:
//   - GET  /r/:character     — primary, hit by IG bio clicks on the root domain
//   - POST /api/r/:character — fire-and-forget tracker from SPA fallback
// Only the GET should ever land on the marketing root (members.* would mean
// the user already crossed the boundary, so we don't gate by host here —
// the redirect helper will detect and avoid double-prefixing).
app.use('/r', require('./routes/shortlinkRoutes'));
app.use('/api/r', require('./routes/shortlinkRoutes'));

// ─── Admin upload ──────────────────────────────────────────────────────────────
// Custom middleware wrapper so we can conditionally skip sharp processing
// when the client passes ?raw=1 (used for logos / chat avatars where
// transparency must be preserved and the file is already small).
const maybeProcessImage = (req, res, next) => {
  if (req.query?.raw === '1' || req.query?.raw === 'true') return next();
  return processImageUploads(req, res, next);
};
app.post('/api/upload', requireAuth, requireCreator, writeLimiter, upload.single('image'), maybeProcessImage, (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ─── Start ─────────────────────────────────────────────────────────────────────
syncDatabase()
  .then(async () => {
    initPayments();

    // AI PPV approval system
    const telegram = require('./services/telegram');
    const ppvApproval = require('./services/ppvApproval');
    const { sendCreatorMessage } = require('./socket');

    // Wire Telegram inline-button callbacks → ppvApproval actions
    telegram.setCallbackHandler(async ({ creatorId, callbackQueryId, data, chatId, messageId }) => {
      const [action, idStr] = String(data || '').split(':');
      const pendingId = parseInt(idStr, 10);
      if (!pendingId) {
        await telegram.answerCallback(await tokenFor(creatorId), callbackQueryId, '⚠️ Bad data');
        return;
      }
      const ctx = { io, sendCreatorMessage, pendingId, by: 'telegram' };
      let result, ack = 'Done';
      try {
        if (action === 'send') { result = await ppvApproval.approve(ctx); ack = '✅ Sent'; }
        else if (action === 'text') { result = await ppvApproval.textOnly(ctx); ack = '📝 Text sent'; }
        else if (action === 'rej')  { result = await ppvApproval.reject({ io, pendingId, by: 'telegram' }); ack = '❌ Rejected'; }
        else { ack = 'Unknown action'; }
        if (result && !result.ok) ack = '⚠️ Already resolved';
      } catch (err) {
        ack = '⚠️ ' + err.message.slice(0, 60);
      }
      const token = await tokenFor(creatorId);
      if (token) await telegram.answerCallback(token, callbackQueryId, ack);
    });

    await telegram.initFromDb();
    await ppvApproval.rehydrate({ io, sendCreatorMessage });

    // Sentry error handler — mount AFTER all routes, BEFORE listen
    sentryService.mountErrorHandler(app);

    server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

    // ─── Graceful shutdown ─────────────────────────────────────────────────────
    // PM2 reload / SIGTERM / Ctrl-C all flow through here. We stop accepting
    // new connections, let in-flight requests finish (up to 10s), then close
    // Socket.IO + DB + Redis cleanly. Without this, pm2 reload drops live
    // chat connections and can corrupt half-finished DB writes.
    let shuttingDown = false;
    const shutdown = async (signal) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`[shutdown] received ${signal}, draining…`);

      const forceTimer = setTimeout(() => {
        console.warn('[shutdown] 10s drain timeout — forcing exit');
        process.exit(1);
      }, 10000);
      forceTimer.unref();

      try {
        // 1. Stop accepting new HTTP connections.
        await new Promise((resolve) => server.close(resolve));
        console.log('[shutdown] http closed');

        // 2. Close Socket.IO so connected clients see a clean disconnect.
        await new Promise((resolve) => io.close(() => resolve()));
        console.log('[shutdown] socket.io closed');

        // 3. Close Redis pub/sub clients (best-effort).
        try {
          if (redis.client?.quit)    await redis.client.quit();
          if (redis.pubClient?.quit) await redis.pubClient.quit();
          if (redis.subClient?.quit) await redis.subClient.quit();
        } catch (e) { console.warn('[shutdown] redis quit warn:', e.message); }

        // 4. Close DB pool last (everything else might want it).
        const { sequelize } = require('./models');
        await sequelize.close();
        console.log('[shutdown] db closed');

        console.log('[shutdown] clean exit');
        process.exit(0);
      } catch (err) {
        console.error('[shutdown] error:', err.message);
        process.exit(1);
      }
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT',  () => shutdown('SIGINT'));
  })
  .catch((err) => {
    console.error('Failed to sync database:', err.message);
    process.exit(1);
  });

async function tokenFor(creatorId) {
  const { Creator } = require('./models');
  const c = await Creator.findByPk(creatorId, { attributes: ['telegramBotToken'] });
  return c?.telegramBotToken;
}
