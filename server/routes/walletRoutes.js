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
const { User, Transaction, sequelize } = require('../models');
const { Op } = require('sequelize');
const { requireAuth, requireVerifiedEmail } = require('../middleware/authMiddleware');
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
router.post('/deposit', requireAuth, requireVerifiedEmail, async (req, res) => {
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
      // Save the hosted-checkout URL so the fan can Resume if they bail out
      checkoutUrl: checkout.redirectUrl || null,
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

// ─── Resume a pending wallet deposit — returns the saved checkout URL ──────
// Used when a fan bailed out of NOWPayments and wants to finish the same top-up
// without creating a new pending row.
router.get('/deposit/:id/resume', requireAuth, async (req, res) => {
  try {
    const tx = await Transaction.findByPk(req.params.id);
    if (!tx || tx.userId !== req.user.userId || tx.type !== 'wallet_deposit') {
      return res.status(404).json({ error: 'Deposit not found' });
    }
    if (tx.status !== 'pending') {
      return res.status(400).json({ error: `Deposit already ${tx.status}` });
    }
    if (!tx.checkoutUrl) {
      return res.status(410).json({ error: 'Checkout link no longer available — please cancel and start a new top-up' });
    }
    res.json({ redirectUrl: tx.checkoutUrl, transactionId: tx.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Cancel a pending wallet deposit ────────────────────────────────────────
// Marks the row 'failed' so it stops cluttering the fan's pending list. We use
// 'failed' instead of 'cancelled' because the status enum doesn't include the
// latter (validate.isIn would reject it) and adding a new enum value would
// require a DB migration we don't need yet.
router.post('/deposit/:id/cancel', requireAuth, async (req, res) => {
  try {
    const tx = await Transaction.findByPk(req.params.id);
    if (!tx || tx.userId !== req.user.userId || tx.type !== 'wallet_deposit') {
      return res.status(404).json({ error: 'Deposit not found' });
    }
    if (tx.status !== 'pending') {
      return res.status(400).json({ error: `Deposit already ${tx.status}` });
    }
    await tx.update({ status: 'failed', checkoutUrl: null });
    res.json({ success: true, transactionId: tx.id, status: tx.status });
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

    // Atomic debit — single UPDATE that both checks and subtracts, no race condition.
    const [rowsAffected] = await User.update(
      { walletBalance: sequelize.literal(`walletBalance - ${amount}`) },
      { where: { id: req.user.userId, walletBalance: { [Op.gte]: amount } } }
    );
    if (!rowsAffected) {
      const user = await User.findByPk(req.user.userId, { attributes: ['walletBalance'] });
      const balance = parseFloat(user?.walletBalance || 0);
      return res.status(402).json({
        error: 'Insufficient wallet balance',
        balance, required: amount, shortBy: Number((amount - balance).toFixed(2)),
      });
    }

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

    require('../services/events').log('unlock_completed', {
      userId: req.user.userId, creatorId,
      props: { type: effectiveType, amount, provider: 'wallet' },
    });

    const updated = await User.findByPk(req.user.userId, { attributes: ['walletBalance'] });
    res.json({
      success: true,
      transactionId: tx.id,
      newBalance: parseFloat(updated.walletBalance || 0),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
