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

module.exports = { requireAuth, requireCreator, requireSubscription };
