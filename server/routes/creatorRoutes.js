const express = require('express');
const bcrypt = require('bcryptjs');
const { Creator, Subscription, Transaction, Post, sequelize } = require('../models');
const { Op } = require('sequelize');
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

    // Time window — last 30 days for the trend charts.
    const now = new Date();
    const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalSubs,
      activeSubs,
      totalRevenue,
      recentTransactions,
      completedTxns30d,
      revenueByTypeRaw,
      newSubs30d,
      topPostsRaw,
    ] = await Promise.all([
      Subscription.count({ where: { creatorId: creator.id } }),
      Subscription.count({ where: { creatorId: creator.id, status: 'active' } }),
      Transaction.sum('amount', { where: { creatorId: creator.id, status: 'completed' } }),
      Transaction.findAll({
        where: { creatorId: creator.id },
        order: [['createdAt', 'DESC']],
        limit: 10,
      }),
      // Daily revenue for last 30 days — group in JS rather than DB-specific SQL
      // so this stays portable across SQLite (dev) and Postgres (prod).
      Transaction.findAll({
        where: {
          creatorId: creator.id,
          status: 'completed',
          createdAt: { [Op.gte]: since30 },
        },
        attributes: ['amount', 'type', 'createdAt', 'referenceId'],
        raw: true,
      }),
      // Lifetime revenue grouped by type — handy for the "where's money coming from" pie.
      Transaction.findAll({
        where: { creatorId: creator.id, status: 'completed' },
        attributes: ['type', [sequelize.fn('SUM', sequelize.col('amount')), 'total']],
        group: ['type'],
        raw: true,
      }),
      // New subscribers per day for last 30 days — same JS-grouping approach.
      Subscription.findAll({
        where: { creatorId: creator.id, createdAt: { [Op.gte]: since30 } },
        attributes: ['createdAt'],
        raw: true,
      }),
      // Top earning posts — sum post_unlock revenue grouped by post id.
      Transaction.findAll({
        where: { creatorId: creator.id, type: 'post_unlock', status: 'completed' },
        attributes: [
          'referenceId',
          [sequelize.fn('SUM', sequelize.col('amount')), 'total'],
          [sequelize.fn('COUNT', sequelize.col('id')), 'unlocks'],
        ],
        group: ['referenceId'],
        order: [[sequelize.literal('total'), 'DESC']],
        limit: 5,
        raw: true,
      }),
    ]);

    // Build 30-day bucket arrays (oldest → newest). One entry per day.
    const dayMs = 24 * 60 * 60 * 1000;
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * dayMs);
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      days.push({ date: key, revenue: 0, newSubs: 0 });
    }
    const dayIndex = Object.fromEntries(days.map((d, i) => [d.date, i]));
    for (const t of completedTxns30d) {
      const k = new Date(t.createdAt).toISOString().slice(0, 10);
      if (dayIndex[k] != null) days[dayIndex[k]].revenue += parseFloat(t.amount || 0);
    }
    for (const s of newSubs30d) {
      const k = new Date(s.createdAt).toISOString().slice(0, 10);
      if (dayIndex[k] != null) days[dayIndex[k]].newSubs += 1;
    }

    // Resolve top-post titles in one query so the frontend gets ready-to-render rows.
    const topPostIds = topPostsRaw.map(r => r.referenceId).filter(Boolean);
    const topPostMap = topPostIds.length
      ? Object.fromEntries(
          (await Post.findAll({
            where: { id: topPostIds },
            attributes: ['id', 'title', 'thumbnailUrl', 'price'],
            raw: true,
          })).map(p => [p.id, p])
        )
      : {};
    const topPosts = topPostsRaw.map(r => ({
      postId: r.referenceId,
      title: topPostMap[r.referenceId]?.title || `Post #${r.referenceId}`,
      thumbnailUrl: topPostMap[r.referenceId]?.thumbnailUrl || null,
      price: parseFloat(topPostMap[r.referenceId]?.price || 0),
      revenue: parseFloat(r.total || 0),
      unlocks: parseInt(r.unlocks || 0, 10),
    }));

    const revenueByType = Object.fromEntries(
      revenueByTypeRaw.map(r => [r.type, parseFloat(r.total || 0)])
    );

    // 30-day revenue + conversion rate. Conversion = active subs / total hits.
    const revenue30d = days.reduce((sum, d) => sum + d.revenue, 0);
    const totalHits = parseInt(creator.analytics?.totalHits || 0, 10);
    const conversionRate = totalHits > 0 ? (activeSubs / totalHits) * 100 : 0;
    const avgRevenuePerFan = activeSubs > 0 ? (totalRevenue || 0) / activeSubs : 0;

    res.json({
      traffic: creator.analytics,
      subscribers: { total: totalSubs, active: activeSubs, new30d: newSubs30d.length },
      revenue: {
        total: parseFloat(totalRevenue || 0),
        last30d: parseFloat(revenue30d.toFixed(2)),
        byType: revenueByType,
        avgPerFan: parseFloat(avgRevenuePerFan.toFixed(2)),
      },
      conversion: {
        rate: parseFloat(conversionRate.toFixed(2)),
        visitors: totalHits,
        activeSubs,
      },
      daily: days,
      topPosts,
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
