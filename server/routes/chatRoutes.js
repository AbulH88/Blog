const express = require('express');
const { Message, Creator, User, Subscription, Transaction } = require('../models');
const { requireAuth, requireCreator } = require('../middleware/authMiddleware');
const { Op } = require('sequelize');

const router = express.Router();

// GET /api/chat/:creatorSlug — fan loads their conversation history
router.get('/:creatorSlug', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'fan') return res.status(403).json({ error: 'Fan access required' });

    const creator = await Creator.findOne({ where: { slug: req.params.creatorSlug } });
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const messages = await Message.findAll({
      where: { creatorId: creator.id, fanId: req.user.userId },
      order: [['sentAt', 'ASC']],
    });

    // Mark all as read
    await Message.update(
      { isRead: true },
      { where: { creatorId: creator.id, fanId: req.user.userId, senderType: 'creator', isRead: false } }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load messages', detail: err.message });
  }
});

// GET /api/chat/:creatorSlug/inbox — creator sees all fan conversations
router.get('/:creatorSlug/inbox', requireAuth, requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.creatorSlug } });
    if (!creator || creator.id !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });

    // Get latest message per fan
    const messages = await Message.findAll({
      where: { creatorId: creator.id },
      order: [['sentAt', 'DESC']],
    });

    // Group by fanId — keep latest message per fan
    const threads = new Map();
    for (const msg of messages) {
      if (!threads.has(msg.fanId)) {
        threads.set(msg.fanId, msg.toJSON());
      }
    }

    // Attach fan usernames
    const fanIds = Array.from(threads.keys());
    const fans = await User.findAll({ where: { id: fanIds }, attributes: ['id', 'username', 'email'] });
    const fanMap = Object.fromEntries(fans.map(f => [f.id, f]));

    // Unread counts
    const unreadMsgs = await Message.findAll({
      where: { creatorId: creator.id, senderType: 'fan', isRead: false },
    });
    const unreadMap = {};
    for (const m of unreadMsgs) {
      unreadMap[m.fanId] = (unreadMap[m.fanId] || 0) + 1;
    }

    // Active subscriptions — map fanId → { tier, createdAt }
    const activeSubs = await Subscription.findAll({
      where: { creatorId: creator.id, status: 'active', userId: fanIds },
    });
    const subMap = Object.fromEntries(
      activeSubs.map(s => [s.userId, { tier: s.tier, since: s.createdAt }])
    );

    // Only include fans who currently have an active subscription
    const inbox = Array.from(threads.values())
      .filter(thread => subMap[thread.fanId])
      .map(thread => ({
        ...thread,
        fan: fanMap[thread.fanId] || { id: thread.fanId, username: 'Unknown' },
        unread: unreadMap[thread.fanId] || 0,
        subscriptionTier: subMap[thread.fanId].tier,
        memberSince: subMap[thread.fanId].since,
      }));

    res.json(inbox);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load inbox', detail: err.message });
  }
});

// GET /api/chat/:creatorSlug/thread/:fanId — creator loads full thread with a fan
router.get('/:creatorSlug/thread/:fanId', requireAuth, requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.creatorSlug } });
    if (!creator || creator.id !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });

    const messages = await Message.findAll({
      where: { creatorId: creator.id, fanId: req.params.fanId },
      order: [['sentAt', 'ASC']],
    });

    // Mark fan messages as read
    await Message.update(
      { isRead: true },
      { where: { creatorId: creator.id, fanId: req.params.fanId, senderType: 'fan', isRead: false } }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load thread', detail: err.message });
  }
});

// POST /api/chat/:messageId/unlock — fan pays to unlock PPV message
router.post('/:messageId/unlock', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'fan') return res.status(403).json({ error: 'Fan access required' });

    const msg = await Message.findByPk(req.params.messageId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });
    if (!msg.isPPV) return res.status(400).json({ error: 'Not a PPV message' });
    if (msg.isUnlocked) return res.json({ success: true, message: msg });
    if (msg.fanId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

    await msg.update({ isUnlocked: true });

    await Transaction.create({
      userId: req.user.userId,
      creatorId: msg.creatorId,
      type: 'ppv_message',
      amount: msg.ppvPrice,
      description: `PPV message unlock`,
    });

    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unlock message', detail: err.message });
  }
});

// POST /api/chat/:creatorSlug/blast — creator sends mass DM to all active subscribers
router.post('/:creatorSlug/blast', requireAuth, requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.creatorSlug } });
    if (!creator || creator.id !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });

    const { content, isPPV, ppvPrice, mediaUrl } = req.body;
    if (!content && !isPPV && !mediaUrl) return res.status(400).json({ error: 'Content, media, or PPV required' });

    const subs = await Subscription.findAll({
      where: { creatorId: creator.id, status: 'active' },
    });

    const messages = await Promise.all(
      subs.map(sub =>
        Message.create({
          creatorId: creator.id,
          fanId: sub.userId,
          senderId: creator.id,
          senderType: 'creator',
          content: isPPV ? '' : (content || ''),
          mediaUrl: mediaUrl || null,
          isPPV: !!isPPV,
          ppvPrice: isPPV ? parseFloat(ppvPrice) || 0 : 0,
          isUnlocked: !isPPV,
        })
      )
    );

    // Socket emit handled by caller — blast messages delivered on next fan load
    res.json({ success: true, sent: messages.length });
  } catch (err) {
    res.status(500).json({ error: 'Blast failed', detail: err.message });
  }
});

module.exports = router;
