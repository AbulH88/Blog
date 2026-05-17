require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Server } = require('socket.io');

const { syncDatabase } = require('./models');
const { initPayments } = require('./payments');
const authRoutes = require('./routes/authRoutes');
const creatorRoutes = require('./routes/creatorRoutes');
const postRoutes = require('./routes/postRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const chatRoutes = require('./routes/chatRoutes');
const collectionRoutes = require('./routes/collectionRoutes');
const setupSocket = require('./socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
setupSocket(io);
const PORT = process.env.PORT || 5000;

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Multer (local upload — replaced by S3 in production) ─────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname)),
});

const allowedTypes = /jpeg|jpg|png|webp|gif|mp4|mov|mp3|m4a/;
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mime = allowedTypes.test(file.mimetype);
    cb(ext && mime ? null : new Error('Invalid file type'), ext && mime);
  },
});

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

// ─── V2 Routes ─────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/creator', creatorRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/instagram', require('./routes/instagramRoutes'));

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

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ─── Start ─────────────────────────────────────────────────────────────────────
syncDatabase()
  .then(() => {
    initPayments();
    server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('Failed to sync database:', err.message);
    process.exit(1);
  });
