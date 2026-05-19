const jwt = require('jsonwebtoken');
require('dotenv').config();

const requireAuth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireCreator = (req, res, next) => {
  if (req.user?.role !== 'creator') {
    return res.status(403).json({ error: 'Creator access required' });
  }
  next();
};

const requireSubscription = async (req, res, next) => {
  const { Subscription } = require('../models');
  const creatorId = req.params.creatorId || req.query.creatorId;
  if (!creatorId) return res.status(400).json({ error: 'creatorId required' });

  const sub = await Subscription.findOne({
    where: { userId: req.user.userId, creatorId, status: 'active' },
  });
  if (!sub) return res.status(403).json({ error: 'Active subscription required' });
  req.subscription = sub;
  next();
};

/**
 * Gate "money-moving" actions (wallet deposit, post/bundle/PPV unlocks) behind
 * a verified email. Soft-launched: chat, browsing, and free content are NOT
 * gated. Returns a structured 402 with { requiresEmailVerification: true }
 * so the frontend can show a "verify first" prompt instead of a raw error.
 *
 * Must run AFTER requireAuth.
 */
const requireVerifiedEmail = async (req, res, next) => {
  // Creators are never gated by this — they don't have an emailVerified field
  // and they're the ones running the platform.
  if (req.user?.role !== 'fan') return next();
  try {
    const { User } = require('../models');
    const user = await User.findByPk(req.user.userId, { attributes: ['emailVerified'] });
    if (!user) return res.status(401).json({ error: 'User not found' });
    if (!user.emailVerified) {
      return res.status(402).json({
        error: 'Please verify your email before completing this action.',
        requiresEmailVerification: true,
      });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: 'Verification check failed', detail: err.message });
  }
};

module.exports = { requireAuth, requireCreator, requireSubscription, requireVerifiedEmail };
