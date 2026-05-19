require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { Server } = require('socket.io');

const { syncDatabase } = require('./models');
const { initPayments } = require('./payments');
const sentryService = require('./services/sentry');
const authRoutes = require('./routes/authRoutes');
const creatorRoutes = require('./routes/creatorRoutes');
const postRoutes = require('./routes/postRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const chatRoutes = require('./routes/chatRoutes');
const collectionRoutes = require('./routes/collectionRoutes');
const setupSocket = require('./socket');

const app = express();
sentryService.init(app); // no-op if SENTRY_DSN unset
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
setupSocket(io);
app.set('io', io);
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────────────────────
// Security headers — relaxed CSP because frontend is served from the same origin
// in production (Nginx serves /var/www/<creator>-build/) but talks to /api/.
app.use(helmet({
  contentSecurityPolicy: false, // disabled for now; frontend handles its own CSP if needed
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow /uploads/ to be embedded
}));
app.use(cors());
app.use(bodyParser.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limits — protect against brute-force on auth + spam on tipping/wallet.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20, // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many auth attempts. Please try again in 15 minutes.' },
});
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 60, // 60 writes per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
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

// ─── V1 Legacy helpers (config.json — kept for backward compat during migration) ─
const CONFIG_PATH = path.join(__dirname, 'data', 'config.json');

const getConfig = () => JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
const saveConfig = (config) => fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

// ─── Traffic tracking (V1) ─────────────────────────────────────────────────────
const trackTraffic = (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.includes('.')) return next();
  try {
    const config = getConfig();
    if (!config.analytics) config.analytics = { totalHits: 0, pages: {}, referrers: {} };
    config.analytics.totalHits += 1;
    const page = req.path || '/';
    config.analytics.pages[page] = (config.analytics.pages[page] || 0) + 1;
    const referrer = req.get('Referrer') || 'Direct';
    const source = referrer.includes('instagram.com') ? 'Instagram'
      : referrer.includes('t.co') || referrer.includes('twitter.com') ? 'Twitter/X'
      : referrer.includes('facebook.com') ? 'Facebook'
      : referrer.includes('tiktok.com') ? 'TikTok'
      : 'Other/Direct';
    config.analytics.referrers[source] = (config.analytics.referrers[source] || 0) + 1;
    saveConfig(config);
  } catch { /* non-fatal */ }
  next();
};
app.use(trackTraffic);

// ─── robots.txt — respects Creator.searchIndexable ───────────────────────────
// Adult sites usually want to be invisible to Google/Bing/IG bots by default.
// Creator can flip the toggle in Admin → Visibility to allow indexing.
app.get('/robots.txt', async (req, res) => {
  try {
    const { Creator } = require('./models');
    const creator = await Creator.findOne({ attributes: ['searchIndexable'] });
    const indexable = creator?.searchIndexable === true;
    res.type('text/plain');
    if (indexable) {
      res.send(`User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\n`);
    } else {
      // Block everything — including IG/Facebook/Twitter preview bots.
      res.send([
        '# Site is private during launch — no indexing allowed.',
        'User-agent: *',
        'Disallow: /',
        '',
        '# Block social-media preview bots specifically',
        'User-agent: facebookexternalhit',
        'Disallow: /',
        'User-agent: Twitterbot',
        'Disallow: /',
        'User-agent: Instagram',
        'Disallow: /',
        'User-agent: meta-externalagent',
        'Disallow: /',
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

// ─── V1 Legacy Routes (kept during frontend migration to V2) ───────────────────
app.get('/api/analytics', (req, res) => {
  try {
    res.json(getConfig().analytics || { totalHits: 0, pages: {}, referrers: {} });
  } catch {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

app.get('/api/config', (req, res) => {
  try {
    const { adminPassword, ...publicConfig } = getConfig();
    res.json(publicConfig);
  } catch {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const config = getConfig();
  if (password === config.adminPassword) {
    res.json({ success: true, token: 'legacy-admin-token' });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const updates = req.body;
    const current = getConfig();
    const updated = { ...current, ...updates };
    if (updates.newPassword) { updated.adminPassword = updates.newPassword; delete updated.newPassword; }
    saveConfig(updated);
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Failed to save config' });
  }
});

app.post('/api/upload', upload.single('image'), processImageUploads, (req, res) => {
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
