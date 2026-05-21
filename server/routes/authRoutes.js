const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { User, Creator, Subscription, Message } = require('../models');
const { requireAuth } = require('../middleware/authMiddleware');
const { sendPasswordResetEmail, sendEmailVerification } = require('../services/email');
const events = require('../services/events');
require('dotenv').config();

const router = express.Router();

const signToken = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '24h' });

// Normalize an email so case + whitespace can't be used to register duplicate accounts.
// Empty/missing inputs return '' (callers should still 400 on empty).
const normalizeEmail = (s) => String(s || '').trim().toLowerCase();

// Fan registration
router.post('/register', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { username, password } = req.body || {};
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'email, username and password are required' });
    }
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);

    // Email verification token — 24h validity (encoded in URL, expiry checked
    // on click against User.passwordResetExpires-style schema would require
    // a new column; the token itself is single-use and rotated on resend).
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const user = await User.create({
      email, username, passwordHash,
      emailVerified: false,
      emailVerifyToken: verifyToken,
    });

    // Fire-and-forget the verification email — failure must not break signup.
    try {
      const base = process.env.PUBLIC_APP_URL || process.env.SITE_URL || 'http://localhost:5173';
      const verifyUrl = `${base.replace(/\/$/, '')}/verify-email?token=${verifyToken}`;
      await sendEmailVerification({ to: user.email, username: user.username, verifyUrl });
    } catch (mailErr) {
      console.warn('[auth] verification email send failed:', mailErr.message);
    }

    // Auto-follow every existing creator (single-tenant for now) so the new
    // fan immediately shows up in the creator's Messages inbox + sees content.
    // Freemium model: tier='free', no charge.
    try {
      const creators = await Creator.findAll();
      await Promise.all(creators.map(c =>
        Subscription.create({
          userId: user.id, creatorId: c.id,
          tier: 'free', status: 'active', startDate: new Date(),
        })
      ));

      // Welcome PPV: drop a locked teaser into the DM thread so the fan
      // sees it on first chat load. Converts within minutes of signup.
      for (const c of creators) {
        if (c.welcomeEnabled && c.welcomePpvPrice && parseFloat(c.welcomePpvPrice) > 0) {
          await Message.create({
            creatorId: c.id,
            fanId: user.id,
            senderId: c.id,
            senderType: 'creator',
            content: c.welcomePpvText || '',
            mediaUrl: c.welcomeMediaUrl || null,
            isPPV: true,
            ppvPrice: parseFloat(c.welcomePpvPrice),
            isUnlocked: false,
          });
        }
      }
    } catch (subErr) {
      // Loud — a silent failure here means new fans never appear in the
      // creator's inbox (lesson learned the hard way during launch).
      console.error('[auth] AUTO-FOLLOW FAILED on register for user', user.id, ':', subErr.message);
      console.error(subErr.stack);
    }

    const token = signToken({ userId: user.id, role: 'fan', email: user.email });
    events.log('fan_signed_up', { userId: user.id, props: { username: user.username } });
    res.status(201).json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed', detail: err.message });
  }
});

// Fan login
router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const { password } = req.body || {};
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
    const email = normalizeEmail(req.body?.email);
    const { password } = req.body || {};
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

// Fan profile update (display name + email). Returns a refreshed JWT if email changed.
router.patch('/me', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'fan') return res.status(403).json({ error: 'Fan account required' });
    const user = await User.findByPk(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { username, email } = req.body || {};
    if (username !== undefined) {
      const trimmed = String(username).trim();
      if (!trimmed) return res.status(400).json({ error: 'Username cannot be empty' });
      user.username = trimmed;
    }
    let emailChanged = false;
    if (email !== undefined) {
      const trimmed = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      if (trimmed !== user.email) {
        const taken = await User.findOne({ where: { email: trimmed } });
        if (taken) return res.status(409).json({ error: 'Email already in use' });
        user.email = trimmed;
        emailChanged = true;
      }
    }
    await user.save();

    const payload = { id: user.id, username: user.username, email: user.email };
    if (emailChanged) {
      const token = signToken({ userId: user.id, role: 'fan', email: user.email });
      return res.json({ ok: true, user: payload, token });
    }
    res.json({ ok: true, user: payload });
  } catch (err) {
    res.status(500).json({ error: 'Update failed', detail: err.message });
  }
});

// Fan password change.
router.patch('/me/password', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'fan') return res.status(403).json({ error: 'Fan account required' });
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'currentPassword and newPassword required' });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }
    const user = await User.findByPk(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Password change failed', detail: err.message });
  }
});

// ─── Email verification ──────────────────────────────────────────────────────
// Soft-verify model: fan can sign up, log in, chat, browse — but money-moving
// actions (deposit, unlocks) are gated by middleware requireVerifiedEmail.

// GET /verify-email?token=... — called by the link in the email.
// Returns JSON so the frontend page can show a clean success/error UI
// (instead of redirecting + flashing a token in the URL bar).
router.get('/verify-email', async (req, res) => {
  try {
    const token = String(req.query?.token || '');
    if (!token) return res.status(400).json({ ok: false, error: 'Missing token' });

    const user = await User.findOne({ where: { emailVerifyToken: token } });
    if (!user) return res.status(404).json({ ok: false, error: 'Invalid or already-used link' });

    if (user.emailVerified) {
      // Idempotent — clicking the link a second time isn't an error
      return res.json({ ok: true, alreadyVerified: true });
    }

    await user.update({ emailVerified: true, emailVerifyToken: null });
    events.log('email_verified', { userId: user.id });
    res.json({ ok: true, email: user.email });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /resend-verification — for the logged-in fan. Rate-limited at the app level.
router.post('/resend-verification', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'fan') return res.status(403).json({ error: 'Fan account required' });

    const user = await User.findByPk(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.emailVerified) return res.json({ ok: true, alreadyVerified: true });

    const token = crypto.randomBytes(32).toString('hex');
    await user.update({ emailVerifyToken: token });

    try {
      const base = process.env.PUBLIC_APP_URL || process.env.SITE_URL || 'http://localhost:5173';
      const verifyUrl = `${base.replace(/\/$/, '')}/verify-email?token=${token}`;
      await sendEmailVerification({ to: user.email, username: user.username, verifyUrl });
    } catch (mailErr) {
      console.warn('[auth] resend verification email failed:', mailErr.message);
      return res.status(500).json({ error: 'Failed to send email' });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Resend failed', detail: err.message });
  }
});

// ─── Forgot password ─────────────────────────────────────────────────────────
// Request a reset — always returns 200 (don't leak which emails exist).
router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'Email required' });

    const user = await User.findOne({ where: { email } });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 60 min
      await user.update({ passwordResetToken: token, passwordResetExpires: expires });

      const base = process.env.PUBLIC_APP_URL || process.env.SITE_URL || 'http://localhost:5173';
      const resetUrl = `${base.replace(/\/$/, '')}/reset-password?token=${token}`;

      try {
        await sendPasswordResetEmail({ to: user.email, username: user.username, resetUrl });
      } catch (mailErr) {
        console.warn('[auth] failed to send reset email:', mailErr.message);
        // Don't reveal mail send failure to caller — still return 200
      }
    }
    res.json({ ok: true, message: "If an account exists, we've sent reset instructions." });
  } catch (err) {
    res.status(500).json({ error: 'Forgot-password failed', detail: err.message });
  }
});

// Validate token (used by the reset page on mount to show a clean error early)
router.get('/reset-password/check', async (req, res) => {
  try {
    const token = String(req.query?.token || '');
    if (!token) return res.status(400).json({ valid: false, error: 'No token' });
    const user = await User.findOne({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { [Op.gt]: new Date() },
      },
    });
    if (!user) return res.json({ valid: false, error: 'Invalid or expired token' });
    res.json({ valid: true, email: user.email });
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
});

// Actually reset the password — single-use token.
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) return res.status(400).json({ error: 'token and newPassword required' });
    if (String(newPassword).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const user = await User.findOne({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { [Op.gt]: new Date() },
      },
    });
    if (!user) return res.status(401).json({ error: 'Invalid or expired reset link' });

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Reset failed', detail: err.message });
  }
});

// ─── Account deletion (GDPR right-to-erasure) ────────────────────────────────
// Soft-delete: keep audit trail (transactions) but anonymize the user record
// and revoke access. Hard-delete is impractical because Verotel/NOWPayments
// need transaction records for 7 years per their MSA + tax requirements.
router.delete('/me', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'fan') return res.status(403).json({ error: 'Fan account required' });
    const { currentPassword } = req.body || {};
    if (!currentPassword) return res.status(400).json({ error: 'currentPassword required to confirm deletion' });

    const user = await User.findByPk(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });

    // Anonymize — keep userId on Transaction rows for accounting, but scrub PII.
    const anonId = `deleted-${user.id}-${Date.now()}`;
    await user.update({
      email: `${anonId}@deleted.local`,
      username: 'deleted user',
      passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12), // random unguessable
      isBlocked: true,
      avatarUrl: '',
      walletBalance: 0,
      passwordResetToken: null,
      passwordResetExpires: null,
      emailVerifyToken: null,
    });

    events.log('account_deleted', { userId: user.id });
    res.json({ ok: true, message: 'Account deleted. Transaction records retained per tax/payment-processor requirements.' });
  } catch (err) {
    res.status(500).json({ error: 'Account deletion failed', detail: err.message });
  }
});

module.exports = router;
