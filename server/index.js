const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Storage setup for Multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// Database Paths
const CONFIG_PATH = path.join(__dirname, 'data', 'config.json');

// Helper to read config
const getConfig = () => {
  const data = fs.readFileSync(CONFIG_PATH, 'utf8');
  return JSON.parse(data);
};

// Helper to write config
const saveConfig = (config) => {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
};

// Traffic Tracking Middleware
const trackTraffic = (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.includes('.')) return next();
  
  try {
    const config = getConfig();
    if (!config.analytics) {
      config.analytics = { totalHits: 0, pages: {}, referrers: {} };
    }
    
    config.analytics.totalHits += 1;
    
    const page = req.path || '/';
    config.analytics.pages[page] = (config.analytics.pages[page] || 0) + 1;
    
    const referrer = req.get('Referrer') || 'Direct';
    const source = referrer.includes('instagram.com') ? 'Instagram' : 
                   referrer.includes('t.co') || referrer.includes('twitter.com') ? 'Twitter/X' :
                   referrer.includes('facebook.com') ? 'Facebook' : 
                   referrer.includes('tiktok.com') ? 'TikTok' : 'Other/Direct';
    
    config.analytics.referrers[source] = (config.analytics.referrers[source] || 0) + 1;
    
    saveConfig(config);
  } catch (err) {
    console.error('Traffic tracking failed', err);
  }
  next();
};

app.use(trackTraffic);

// Endpoints
app.get('/api/analytics', (req, res) => {
    try {
        const config = getConfig();
        res.json(config.analytics || { totalHits: 0, pages: {}, referrers: {} });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

app.get('/api/config', (req, res) => {
  try {
    const config = getConfig();
    const { adminPassword, ...publicConfig } = config;
    res.json(publicConfig);
  } catch (err) {
    res.status(500).json({ error: 'Failed to read config' });
  }
});

app.post('/api/login', (req, res) => {
    const { password } = req.body;
    const config = getConfig();
    if (password === config.adminPassword) {
        res.json({ success: true, token: 'fake-jwt-token-for-demo' });
    } else {
        res.status(401).json({ error: 'Invalid password' });
    }
});

app.post('/api/config', (req, res) => {
  try {
    const updates = req.body;
    const currentConfig = getConfig();
    
    // Deep merge for specific objects or full merge
    // We prioritize keeping analytics if not provided in updates
    const updatedConfig = { ...currentConfig, ...updates };
    
    // If updates has a new password field, we update the adminPassword
    if (updates.newPassword) {
      updatedConfig.adminPassword = updates.newPassword;
      delete updatedConfig.newPassword;
    }

    saveConfig(updatedConfig);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save config' });
  }
});

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
