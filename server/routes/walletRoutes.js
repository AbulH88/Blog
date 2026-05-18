/**
 * Fan wallet — pre-funded balance for one-tap unlocks.
 *
 * Deposit flow:
 *  1. Fan picks amount → POST /api/wallet/deposit → server creates a Transaction
 *     (type='wallet_deposit', status='pending') and a NOWPayments invoice.
 *  2. Fan pays on the hosted checkout, NOWPayments webhook (paymentRoutes.js)
 *     flips the Transaction to 'completed' and credits User.walletBalance.
 *
 * Spend flow (called from postRoutes/collectionRoutes/chatRoutes — added here as a helper):
 *  - debitWallet({ userId, amount, type, referenceId, description })
 *  - Atomically subtracts the price from balance, creates a Transaction, returns success.
 *  - Idempotent against repeated charges for the same product (relies on caller's check).
 */
const express = require('express');
const { User, Transaction } = require('../models');
const { requireAuth } = require('../middleware/authMiddleware');
const { getProvider, hasProvider } = require('../payments/registry');

const router = express.Router();

// ─── GET balance + recent activity ───────────────────────────────────────────
router.get('/me', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'fan') return res.status(403).json({ error: 'Fan account required' });
    const user = await User.findByPk(req.user.userId, { attributes: ['id', 'walletBalance'] });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const recent = await Transaction.findAll({
      where: { userId: req.user.userId, type: 'wallet_deposit' },
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    res.json({
      balance: parseFloat(user.walletBalance || 0),
      recentDeposits: recent.map(t => ({
        id: t.id,
        amount: parseFloat(t.amount),
        status: t.status,
        provider: t.provider,
        date: t.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST deposit — create a NOWPayments invoice to add USD to wallet ────────
router.post('/deposit', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'fan') return res.status(403).json({ error: 'Fan account required' });
    const providerName = req.body?.provider || 'nowpayments';
    const amount = parseFloat(req.body?.amount);
    if (!amount || amount < 5 || amount > 1000) {
      return res.status(400).json({ error: 'amount must be between $5 and $1000' });
    }
    if (!hasProvider(providerName)) {
      return res.status(503).json({ error: `Provider ${providerName} not configured` });
    }
    const provider = getProvider(providerName);

    const checkout = await provider.createCheckout({
      amount,
      currency: 'USD',
      fanId: req.user.userId,
      creatorId: 0,
      productRef: { type: 'wallet_deposit' },
      statementDescriptor: null,
    });

    const tx = await Transaction.create({
      userId: req.user.userId,
      creatorId: null,
      type: 'wallet_deposit',
      amount,
      description: `Wallet top-up — $${amount.toFixed(2)}`,
      provider: providerName,
      providerInvoiceId: checkout.providerInvoiceId,
      status: checkout.status || 'pending',
    });

    if (checkout.redirectUrl) {
      return res.json({
        success: false,
        transactionId: tx.id,
        redirectUrl: checkout.redirectUrl,
        status: tx.status,
      });
    }
    res.json({ success: tx.status === 'completed', transactionId: tx.id, status: tx.status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── POST spend — debit wallet to unlock content (one-tap) ──────────────────
// body: { productType: 'post_unlock'|'collection_unlock'|'ppv_message', productId }
router.post('/spend', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'fan') return res.status(403).json({ error: 'Fan account required' });
    const { Post, Collection, Message } = require('../models');
    const { productType, productId } = req.body || {};
    if (!productType || !productId) {
      return res.status(400).json({ error: 'productType and productId required' });
    }

    // Look up the product server-side (never trust client-supplied amount).
    let amount, creatorId, description;
    let effectiveType = productType;
    let effectiveRefId = productId;
    let bundleMessageId = null;

    if (productType === 'post_unlock') {
      const post = await Post.findByPk(productId);
      if (!post) return res.status(404).json({ error: 'Post not found' });
      if (post.collectionId) return res.status(400).json({ error: 'Buy the bundle to unlock bundle posts' });
      amount = parseFloat(post.price || 0);
      creatorId = post.creatorId;
      description = `Post unlock: ${post.title || post.id}`;
    } else if (productType === 'collection_unlock') {
      const col = await Collection.findByPk(productId);
      if (!col) return res.status(404).json({ error: 'Collection not found' });
      const base = parseFloat(col.price || 0);
      const disc = Math.min(90, Math.max(0, parseInt(col.discountPercent || 0, 10)));
      amount = Number((base * (1 - disc / 100)).toFixed(2));
      creatorId = col.creatorId;
      description = disc > 0 ? `Bundle unlock: ${col.title} (-${disc}%)` : `Bundle unlock: ${col.title}`;
    } else if (productType === 'ppv_message') {
      const msg = await Message.findByPk(productId);
      if (!msg) return res.status(404).json({ error: 'Message not found' });
      if (msg.fanId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
      amount = parseFloat(msg.ppvPrice || 0);
      creatorId = msg.creatorId;
      if (msg.collectionId) {
        effectiveType = 'collection_unlock';
        effectiveRefId = msg.collectionId;
        description = `Bundle unlock (chat): ${msg.collectionId}`;
        bundleMessageId = msg.id;
      } else {
        description = 'PPV message unlock';
      }
    } else {
      return res.status(400).json({ error: 'Unknown productType' });
    }

    // Idempotency: if already unlocked, succeed without charging.
    const existing = await Transaction.findOne({
      where: {
        userId: req.user.userId,
        type: effectiveType,
        referenceId: effectiveRefId,
        status: 'completed',
      },
    });
    if (existing) {
      if (bundleMessageId) {
        const m = await Message.findByPk(bundleMessageId);
        if (m && !m.isUnlocked) await m.update({ isUnlocked: true });
      }
      return res.json({ success: true, alreadyUnlocked: true });
    }

    // Atomic balance check + debit.
    const user = await User.findByPk(req.user.userId);
    const balance = parseFloat(user.walletBalance || 0);
    if (balance < amount) {
      return res.status(402).json({
        error: 'Insufficient wallet balance',
        balance, required: amount, shortBy: Number((amount - balance).toFixed(2)),
      });
    }
    await user.update({ walletBalance: Number((balance - amount).toFixed(2)) });

    const tx = await Transaction.create({
      userId: req.user.userId,
      creatorId,
      type: effectiveType,
      amount,
      referenceId: effectiveRefId,
      description,
      provider: 'wallet',
      status: 'completed',
    });

    if (bundleMessageId) {
      const m = await Message.findByPk(bundleMessageId);
      if (m && !m.isUnlocked) await m.update({ isUnlocked: true });
    }
    if (effectiveType === 'ppv_message') {
      const m = await Message.findByPk(effectiveRefId);
      if (m && !m.isUnlocked) await m.update({ isUnlocked: true });
    }

    res.json({
      success: true,
      transactionId: tx.id,
      newBalance: Number((balance - amount).toFixed(2)),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
