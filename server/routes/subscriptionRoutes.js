const express = require('express');
const { Subscription, Creator, Transaction, User } = require('../models');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// POST /api/subscriptions/subscribe
router.post('/subscribe', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'fan') return res.status(403).json({ error: 'Fan account required' });

    const { creatorSlug, tier = 'basic' } = req.body;
    if (!creatorSlug) return res.status(400).json({ error: 'creatorSlug required' });

    const creator = await Creator.findOne({ where: { slug: creatorSlug } });
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const price = tier === 'premium'
      ? parseFloat(creator.subscriptionPricePremium)
      : parseFloat(creator.subscriptionPrice);

    const renewalDate = new Date();
    renewalDate.setMonth(renewalDate.getMonth() + 1);

    const existing = await Subscription.findOne({
      where: { userId: req.user.userId, creatorId: creator.id },
    });

    if (existing?.status === 'active') {
      return res.status(409).json({ error: 'Already subscribed' });
    }

    let subscription;
    if (existing) {
      await existing.update({ status: 'active', tier, startDate: new Date(), renewalDate, cancelledAt: null });
      subscription = existing;
    } else {
      subscription = await Subscription.create({
        userId: req.user.userId,
        creatorId: creator.id,
        tier,
        status: 'active',
        startDate: new Date(),
        renewalDate,
      });
    }

    await Transaction.create({
      userId: req.user.userId,
      creatorId: creator.id,
      type: 'subscription',
      amount: price,
      description: `${tier} subscription to ${creator.displayName}`,
    });

    res.status(201).json({ success: true, subscription, price });
  } catch (err) {
    res.status(500).json({ error: 'Subscribe failed', detail: err.message });
  }
});

// POST /api/subscriptions/unsubscribe
router.post('/unsubscribe', requireAuth, async (req, res) => {
  try {
    const { creatorSlug } = req.body;
    const creator = await Creator.findOne({ where: { slug: creatorSlug } });
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const sub = await Subscription.findOne({
      where: { userId: req.user.userId, creatorId: creator.id, status: 'active' },
    });
    if (!sub) return res.status(404).json({ error: 'No active subscription found' });

    await sub.update({ status: 'cancelled', cancelledAt: new Date() });
    res.json({ success: true, message: 'Subscription cancelled. Access continues until renewal date.' });
  } catch (err) {
    res.status(500).json({ error: 'Unsubscribe failed', detail: err.message });
  }
});

// GET /api/subscriptions/status/:slug — check if current fan is subscribed
router.get('/status/:slug', requireAuth, async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.slug } });
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const sub = await Subscription.findOne({
      where: { userId: req.user.userId, creatorId: creator.id },
    });

    res.json({
      isSubscribed: sub?.status === 'active',
      tier: sub?.tier || null,
      renewalDate: sub?.renewalDate || null,
      prices: {
        basic: parseFloat(creator.subscriptionPrice),
        premium: parseFloat(creator.subscriptionPricePremium),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Status check failed', detail: err.message });
  }
});

// GET /api/subscriptions/my — all active subscriptions for logged-in fan
router.get('/my', requireAuth, async (req, res) => {
  try {
    const subs = await Subscription.findAll({
      where: { userId: req.user.userId, status: 'active' },
      include: [{ model: Creator, attributes: ['slug', 'displayName', 'profileImage', 'subscriptionPrice'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch subscriptions', detail: err.message });
  }
});

// GET /api/subscriptions/transactions — fan spending history
router.get('/transactions', requireAuth, async (req, res) => {
  try {
    const txns = await Transaction.findAll({
      where: { userId: req.user.userId },
      order: [['createdAt', 'DESC']],
      limit: 50,
    });
    res.json(txns);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transactions', detail: err.message });
  }
});

module.exports = router;
