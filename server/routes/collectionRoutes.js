const express = require('express');
const jwt = require('jsonwebtoken');
const { Collection, Post, Creator, Transaction } = require('../models');
const { requireAuth, requireCreator, requireVerifiedEmail } = require('../middleware/authMiddleware');
const { getProvider, hasProvider } = require('../payments/registry');

const PROD_PROVIDERS = ['nowpayments'];
function resolveProvider(body) {
  const name = body?.provider;
  if (!name || (process.env.NODE_ENV === 'production' && !PROD_PROVIDERS.includes(name))) return null;
  if (!hasProvider(name)) return null;
  return name;
}
require('dotenv').config();

const router = express.Router();

const decodeFan = (authHeader) => {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    return decoded.role === 'fan' ? decoded : null;
  } catch { return null; }
};

// GET /api/collections/:slug/all — creator sees all collections + their posts
router.get('/:slug/all', requireAuth, requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.slug } });
    if (!creator || creator.id !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });

    const collections = await Collection.findAll({
      where: { creatorId: creator.id },
      order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']],
    });

    const withPosts = await Promise.all(
      collections.map(async col => {
        const posts = await Post.findAll({ where: { collectionId: col.id } });
        return { ...col.toJSON(), posts };
      })
    );

    res.json(withPosts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/collections/:slug — public, published collections with post count
router.get('/:slug', async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.slug } });
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const collections = await Collection.findAll({
      where: { creatorId: creator.id, isPublished: true },
      order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']],
    });

    // Optional fan auth — surface unlock state per bundle and a thumbnail strip
    const fan = decodeFan(req.headers.authorization);
    const unlockedIds = new Set();
    if (fan) {
      const unlocks = await Transaction.findAll({
        where: { userId: fan.userId, type: 'collection_unlock', status: 'completed' },
        attributes: ['referenceId'],
      });
      unlocks.forEach(u => unlockedIds.add(u.referenceId));
    }

    const withCounts = await Promise.all(
      collections.map(async col => {
        const [postCount, sampleThumbs] = await Promise.all([
          Post.count({ where: { collectionId: col.id } }),
          Post.findAll({
            where: { collectionId: col.id },
            attributes: ['mediaUrls'],
            limit: 4,
            order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']],
          }),
        ]);
        const thumbs = sampleThumbs
          .map(p => Array.isArray(p.mediaUrls) ? p.mediaUrls[0] : null)
          .filter(Boolean);
        return {
          ...col.toJSON(),
          postCount,
          thumbs,
          isUnlocked: unlockedIds.has(col.id),
        };
      })
    );

    res.json(withCounts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/collections — create collection
router.post('/', requireAuth, requireCreator, async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.body.creatorSlug } });
    if (!creator || creator.id !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });

    const { title, description, price, isPublished } = req.body;
    const col = await Collection.create({
      creatorId: creator.id,
      title: title || 'Untitled Bundle',
      description: description || '',
      price: parseFloat(price) || 9.99,
      isPublished: isPublished !== false,
    });

    res.status(201).json(col);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/collections/reorder — bulk update sort order
router.patch('/reorder', requireAuth, requireCreator, async (req, res) => {
  try {
    const { items } = req.body; // [{ id, sortOrder }]
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items must be an array' });
    await Promise.all(items.map(({ id, sortOrder }) =>
      Collection.update({ sortOrder }, { where: { id, creatorId: req.user.creatorId } })
    ));
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/collections/:id — update collection
router.patch('/:id', requireAuth, requireCreator, async (req, res) => {
  try {
    const col = await Collection.findByPk(req.params.id);
    if (!col || col.creatorId !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });

    const { title, description, price, isPublished } = req.body;
    await col.update({ title, description, price: parseFloat(price), isPublished });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/collections/:id — delete, unlinks posts
router.delete('/:id', requireAuth, requireCreator, async (req, res) => {
  try {
    const col = await Collection.findByPk(req.params.id);
    if (!col || col.creatorId !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });

    await Post.update({ collectionId: null }, { where: { collectionId: col.id } });
    await col.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/collections/:id/assign — assign a post to this collection
router.patch('/:id/assign', requireAuth, requireCreator, async (req, res) => {
  try {
    const col = await Collection.findByPk(req.params.id);
    if (!col || col.creatorId !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });

    const post = await Post.findByPk(req.body.postId);
    if (!post || post.creatorId !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });

    await post.update({ collectionId: col.id, isPremium: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/collections/remove-post/:postId — remove post from its collection
router.patch('/remove-post/:postId', requireAuth, requireCreator, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.postId);
    if (!post || post.creatorId !== req.user.creatorId) return res.status(403).json({ error: 'Forbidden' });
    await post.update({ collectionId: null });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/collections/:id/unlock — fan unlocks a collection (mock — real payment via Stripe later)
router.post('/:id/unlock', requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    if (req.user.role !== 'fan') return res.status(403).json({ error: 'Fan access required' });

    const col = await Collection.findByPk(req.params.id);
    if (!col) return res.status(404).json({ error: 'Collection not found' });

    // Check if already unlocked
    const existing = await Transaction.findOne({
      where: { userId: req.user.userId, type: 'collection_unlock', referenceId: col.id, status: 'completed' },
    });
    if (existing) return res.json({ success: true, alreadyUnlocked: true });

    const providerName = resolveProvider(req.body);
    if (!providerName) return res.status(400).json({ error: 'Valid payment provider required (nowpayments or card)' });
    const provider = getProvider(providerName);
    const creator = await Creator.findByPk(col.creatorId);

    const basePrice = parseFloat(col.price || 0);
    const disc = Math.min(90, Math.max(0, parseInt(col.discountPercent || 0, 10)));
    const effectivePrice = Number((basePrice * (1 - disc / 100)).toFixed(2));

    const checkout = await provider.createCheckout({
      amount: effectivePrice,
      currency: 'USD',
      fanId: req.user.userId,
      creatorId: col.creatorId,
      productRef: { type: 'collection_unlock', id: col.id },
      statementDescriptor: creator?.billingDescriptor || null,
    });

    const tx = await Transaction.create({
      userId: req.user.userId,
      creatorId: col.creatorId,
      type: 'collection_unlock',
      amount: effectivePrice,
      referenceId: col.id,
      description: disc > 0
        ? `Bundle unlock: ${col.title} (-${disc}%)`
        : `Bundle unlock: ${col.title}`,
      provider: providerName,
      providerInvoiceId: checkout.providerInvoiceId,
      status: checkout.status || 'pending',
    });

    res.json({
      success: checkout.status === 'completed',
      transactionId: tx.id,
      status: tx.status,
      redirectUrl: checkout.redirectUrl,
      clientToken: checkout.clientToken,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
