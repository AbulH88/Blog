const express = require('express');
const bcrypt = require('bcryptjs');
const { Creator, Subscription, Transaction } = require('../models');
const { requireAuth, requireCreator } = require('../middleware/authMiddleware');

const router = express.Router();

// Public — fetch creator branding by slug (used by frontend on load)
// Returns everything needed to render the site — no sensitive data
router.get('/:slug', async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.slug } });
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const { passwordHash, email, ...publicData } = creator.toJSON();
    res.json(publicData);
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

    const { passwordHash, email, id, slug, newPassword, ...allowed } = req.body;
    if (newPassword) {
      allowed.passwordHash = await bcrypt.hash(newPassword, 12);
    }
    await creator.update(allowed);
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

// Creator — list subscribers
router.get('/:slug/subscribers', requireAuth, requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.slug } });
    if (!creator || creator.id !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });

    const subscribers = await Subscription.findAll({
      where: { creatorId: creator.id },
      include: [{ model: require('../models').User, attributes: ['id', 'username', 'email', 'createdAt'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(subscribers);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscribers', detail: err.message });
  }
});

module.exports = router;
