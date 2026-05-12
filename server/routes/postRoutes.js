const express = require('express');
const multer = require('multer');
const path = require('path');
const { Post, Creator, Subscription, Transaction } = require('../models');
const { requireAuth, requireCreator } = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e6) + path.extname(file.originalname)),
});
const allowed = /jpeg|jpg|png|webp|gif|mp4|mov|mp3|m4a/;
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
    cb(ok ? null : new Error('Invalid file type'), ok);
  },
});

const decodeFan = (authHeader) => {
  if (!authHeader?.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET);
    return decoded.role === 'fan' ? decoded : null;
  } catch { return null; }
};

const getSubscriptionStatus = async (authHeader, creatorId) => {
  const fan = decodeFan(authHeader);
  if (!fan) return false;
  const sub = await Subscription.findOne({ where: { userId: fan.userId, creatorId, status: 'active' } });
  return !!sub;
};

const getUnlockedCollections = async (authHeader) => {
  const fan = decodeFan(authHeader);
  if (!fan) return new Set();
  const unlocks = await Transaction.findAll({
    where: { userId: fan.userId, type: 'collection_unlock' },
    attributes: ['referenceId'],
  });
  return new Set(unlocks.map(u => u.referenceId).filter(Boolean));
};

// GET /api/posts/:creatorSlug — public feed
// Premium mediaUrls are stripped for non-subscribers; isLocked flag added
router.get('/:creatorSlug', async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.creatorSlug } });
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const [isSubscribed, unlockedCollections] = await Promise.all([
      getSubscriptionStatus(req.headers.authorization, creator.id),
      getUnlockedCollections(req.headers.authorization),
    ]);
    const now = new Date();

    const posts = await Post.findAll({
      where: { creatorId: creator.id },
      order: [['isPinned', 'DESC'], ['createdAt', 'DESC']],
    });

    const feed = posts
      .filter(p => {
        const published = !p.publishAt || new Date(p.publishAt) <= now;
        const notExpired = !p.expiresAt || new Date(p.expiresAt) > now;
        return published && notExpired;
      })
      .map(p => {
        const post = p.toJSON();
        if (isSubscribed) return { ...post, isLocked: false };
        // Collection post — check bundle unlock
        if (post.collectionId && unlockedCollections.has(post.collectionId)) {
          return { ...post, isLocked: false };
        }
        const locked = post.isPremium || !!post.collectionId;
        return {
          ...post,
          mediaUrls: locked ? [] : post.mediaUrls,
          isLocked: locked,
        };
      });

    res.json({ posts: feed, isSubscribed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts', detail: err.message });
  }
});

// POST /api/posts — creator uploads a new post
router.post('/', requireAuth, requireCreator, upload.array('media', 10), async (req, res) => {
  try {
    const creator = await Creator.findByPk(req.user.creatorId);
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const mediaUrls = (req.files || []).map(f => `/uploads/${f.filename}`);
    const { title, caption, mediaType, isPremium, price, isPinned, collectionId } = req.body;

    const post = await Post.create({
      creatorId: creator.id,
      title: title || '',
      caption: caption || '',
      mediaUrls,
      mediaType: mediaType || 'image',
      isPremium: isPremium === 'true' || isPremium === true || !!collectionId,
      price: parseFloat(price) || 0,
      isPinned: isPinned === 'true' || isPinned === true,
      collectionId: collectionId ? parseInt(collectionId) : null,
    });

    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create post', detail: err.message });
  }
});

// PATCH /api/posts/:id — update post metadata
router.patch('/:id', requireAuth, requireCreator, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const creator = await Creator.findByPk(req.user.creatorId);
    if (post.creatorId !== creator.id) return res.status(403).json({ error: 'Forbidden' });

    const { mediaUrls, creatorId, id, ...allowed } = req.body;
    await post.update(allowed);
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update post', detail: err.message });
  }
});

// DELETE /api/posts/:id
router.delete('/:id', requireAuth, requireCreator, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const creator = await Creator.findByPk(req.user.creatorId);
    if (post.creatorId !== creator.id) return res.status(403).json({ error: 'Forbidden' });

    await post.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete post', detail: err.message });
  }
});

// POST /api/posts/:id/like
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const post = await Post.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    await post.update({ likesCount: post.likesCount + 1 });
    res.json({ likesCount: post.likesCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to like post', detail: err.message });
  }
});

module.exports = router;
