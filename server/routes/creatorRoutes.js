const express = require('express');
const bcrypt = require('bcryptjs');
const { Creator, Subscription, Transaction } = require('../models');
const { requireAuth, requireCreator } = require('../middleware/authMiddleware');
const cache = require('../services/cache');

const router = express.Router();

// Public — fetch creator branding by slug (used by frontend on load).
// Cached for 60s — this is the hottest endpoint by far (every page load
// hits it). Cache is invalidated on PATCH /:slug below so creator-side
// edits show up immediately.
router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug;
    const data = await cache.getOrSet(`creator:public:${slug}`, 60, async () => {
      const creator = await Creator.findOne({ where: { slug } });
      if (!creator) return null;
      const { passwordHash, email, ...publicData } = creator.toJSON();
      return publicData;
    });
    if (!data) return res.status(404).json({ error: 'Creator not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch creator', detail: err.message });
  }
});

// Creator — update their own profile
router.patch('/:slug', requireAuth, requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.slug } });
    if (!creator) return res.status(404).json({ error: 'Creator not found' });
    if (creator.id !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });

    const ALLOWED_FIELDS = [
      'displayName', 'bio', 'shortBio', 'profileImage', 'heroImages',
      'galleryImages', 'theme', 'fanvueUrl', 'billingDescriptor', 'logoUrl',
      'featuredLinks', 'instagramPosts', 'links', 'seo', 'blog', 'faq',
      'mustHaves', 'isLive', 'maintenanceMode', 'welcomeMessage',
      'welcomeEnabled', 'welcomePpvText', 'welcomeMediaUrl', 'welcomePpvPrice',
      'chatAvatarUrl', 'ageGateEnabled', 'disclosureVisible', 'searchIndexable',
      'aiAutoReplyEnabled', 'aiNsfwLevel', 'aiApprovalRequired', 'aiPersonaPrompt',
    ];
    const allowed = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => ALLOWED_FIELDS.includes(k))
    );
    if (req.body.newPassword) {
      allowed.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
    }
    await creator.update(allowed);
    // Bust the public cache so fans see the change on the next request
    await cache.del(`creator:public:${req.params.slug}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update creator', detail: err.message });
  }
});

// Creator — update password
router.patch('/:slug/password', requireAuth, requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.slug } });
    if (!creator || creator.id !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });

    const { currentPassword, newPassword } = req.body;
    const valid = await bcrypt.compare(currentPassword, creator.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password incorrect' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await creator.update({ passwordHash });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update password', detail: err.message });
  }
});

// Creator — analytics dashboard
// Funnel report — distinct-user counts per event in the past N days
router.get('/:slug/funnel', requireAuth, requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.slug } });
    if (!creator || creator.id !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });
    const days = Math.min(365, Math.max(1, parseInt(req.query.days || '30', 10)));
    const events = require('../services/events');
    const data = await events.funnel({ days });
    res.json({ days, events: data || {} });
  } catch (err) {
    res.status(500).json({ error: 'Funnel fetch failed', detail: err.message });
  }
});

router.get('/:slug/analytics', requireAuth, requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.slug } });
    if (!creator || creator.id !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });

    const [totalSubs, activeSubs, totalRevenue, recentTransactions] = await Promise.all([
      Subscription.count({ where: { creatorId: creator.id } }),
      Subscription.count({ where: { creatorId: creator.id, status: 'active' } }),
      Transaction.sum('amount', { where: { creatorId: creator.id } }),
      Transaction.findAll({
        where: { creatorId: creator.id },
        order: [['createdAt', 'DESC']],
        limit: 10,
      }),
    ]);

    res.json({
      traffic: creator.analytics,
      subscribers: { total: totalSubs, active: activeSubs },
      revenue: { total: totalRevenue || 0 },
      recentTransactions,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics', detail: err.message });
  }
});

// Public — Bio Link click tracker → increments clickCount + redirects out
// Usage: GET /api/creator/:slug/link/:linkIdx → 302 to the link's URL
router.get('/:slug/link/:linkIdx', async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.slug } });
    if (!creator) return res.status(404).send('Creator not found');

    const idx = parseInt(req.params.linkIdx, 10);
    const links = Array.isArray(creator.featuredLinks) ? [...creator.featuredLinks] : [];
    if (!links[idx]) return res.status(404).send('Link not found');

    const link = { ...links[idx], clickCount: (links[idx].clickCount || 0) + 1 };
    links[idx] = link;
    await creator.update({ featuredLinks: links });

    const target = link.href || '/';
    if (!/^https?:\/\//i.test(target) && !target.startsWith('/')) {
      return res.status(400).send('Invalid link target');
    }
    return res.redirect(target);
  } catch (err) {
    return res.status(500).send('Click tracker failed: ' + err.message);
  }
});

// Creator — list subscribers with per-fan spend + activity
router.get('/:slug/subscribers', requireAuth, requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.slug } });
    if (!creator || creator.id !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });

    const { User, Message } = require('../models');

    const subscribers = await Subscription.findAll({
      where: { creatorId: creator.id },
      include: [{ model: User, attributes: ['id', 'username', 'email', 'createdAt', 'lastLoginAt'] }],
      order: [['createdAt', 'DESC']],
    });

    // Aggregate per-fan spend on this creator
    const userIds = subscribers.map(s => s.userId);
    const txns = await Transaction.findAll({
      where: { userId: userIds, creatorId: creator.id },
      attributes: ['userId', 'type', 'amount', 'createdAt'],
    });
    const spendByUser = {};
    const countByUser = {};
    const lastTxnByUser = {};
    for (const t of txns) {
      const u = t.userId;
      spendByUser[u] = (spendByUser[u] || 0) + parseFloat(t.amount || 0);
      countByUser[u] = (countByUser[u] || 0) + 1;
      if (!lastTxnByUser[u] || t.createdAt > lastTxnByUser[u]) lastTxnByUser[u] = t.createdAt;
    }

    // Last message activity (any direction)
    const msgs = await Message.findAll({
      where: { creatorId: creator.id, fanId: userIds },
      attributes: ['fanId', 'sentAt'],
      order: [['sentAt', 'DESC']],
    });
    const lastMsgByUser = {};
    const msgCountByUser = {};
    for (const m of msgs) {
      if (!lastMsgByUser[m.fanId]) lastMsgByUser[m.fanId] = m.sentAt;
      msgCountByUser[m.fanId] = (msgCountByUser[m.fanId] || 0) + 1;
    }

    const fans = subscribers.map(sub => {
      const u = sub.userId;
      return {
        subscriptionId: sub.id,
        tier: sub.tier,
        status: sub.status,
        joinedAt: sub.createdAt,
        fan: sub.User ? {
          id: sub.User.id,
          username: sub.User.username,
          email: sub.User.email,
          createdAt: sub.User.createdAt,
          lastLoginAt: sub.User.lastLoginAt,
        } : null,
        totalSpent: spendByUser[u] || 0,
        purchaseCount: countByUser[u] || 0,
        lastPurchaseAt: lastTxnByUser[u] || null,
        messageCount: msgCountByUser[u] || 0,
        lastMessageAt: lastMsgByUser[u] || null,
      };
    });

    res.json(fans);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscribers', detail: err.message });
  }
});

// Creator — full transaction history with optional filters
router.get('/:slug/transactions', requireAuth, requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.slug } });
    if (!creator || creator.id !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });

    const { User } = require('../models');
    const where = { creatorId: creator.id };
    if (req.query.type) where.type = req.query.type;
    if (req.query.userId) where.userId = req.query.userId;

    const txns = await Transaction.findAll({
      where,
      include: [{ model: User, attributes: ['id', 'username', 'email'] }],
      order: [['createdAt', 'DESC']],
      limit: parseInt(req.query.limit, 10) || 100,
    });

    res.json(txns);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions', detail: err.message });
  }
});

module.exports = router;
