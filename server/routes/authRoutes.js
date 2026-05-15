const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Creator, Subscription } = require('../models');
const { requireAuth } = require('../middleware/authMiddleware');
require('dotenv').config();

const router = express.Router();

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });

// Fan registration
router.post('/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'email, username and password are required' });
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ email, username, passwordHash });

    // Auto-follow every existing creator (single-tenant for now) so the new
    // fan immediately shows up in the creator's Messages inbox + sees content.
    // Freemium model: tier='free', no charge.
    try {
      const creators = await Creator.findAll({ attributes: ['id'] });
      await Promise.all(creators.map(c =>
        Subscription.create({
          userId: user.id, creatorId: c.id,
          tier: 'free', status: 'active', startDate: new Date(),
        })
      ));
    } catch (subErr) {
      console.warn('auto-follow on register failed:', subErr.message);
    }

    const token = signToken({ userId: user.id, role: 'fan', email: user.email });
    res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
});

// Fan login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.isBlocked) return res.status(403).json({ error: 'Account suspended' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    await user.update({ lastLoginAt: new Date() });
    const token = signToken({ userId: user.id, role: 'fan', email: user.email });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});

// Creator login
router.post('/creator/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const creator = await Creator.findOne({ where: { email } });
    if (!creator) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, creator.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ creatorId: creator.id, role: 'creator', slug: creator.slug });
    res.json({
      token,
      creator: { id: creator.id, slug: creator.slug, displayName: creator.displayName },
    });
  } catch (err) {
    res.status(500).json({ error: 'Login failed', detail: err.message });
  }
});

// Get current user info
router.get('/me', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'creator') {
      const creator = await Creator.findByPk(req.user.creatorId, {
        attributes: { exclude: ['passwordHash'] },
      });
      return res.json({ role: 'creator', creator });
    }
    const user = await User.findByPk(req.user.userId, {
      attributes: { exclude: ['passwordHash'] },
    });
    res.json({ role: 'fan', user });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user', detail: err.message });
  }
});

module.exports = router;
