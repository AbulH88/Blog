const express = require('express');
const bodyParser = require('body-parser');
const { Transaction, Post, Collection, Message, PaymentMethod, Creator } = require('../models');
const { requireAuth } = require('../middleware/authMiddleware');
const { getProvider, hasProvider } = require('../payments/registry');

const router = express.Router();

/**
 * Mark the underlying product (post / collection / chat message) as unlocked
 * for the fan once a Transaction flips to 'completed'. Idempotent.
 */
async function applyUnlock(tx) {
  if (tx.type === 'ppv_message' && tx.referenceId) {
    const msg = await Message.findByPk(tx.referenceId);
    if (msg && !msg.isUnlocked) await msg.update({ isUnlocked: true });
  }
  // post_unlock and collection_unlock are derived from Transaction rows
  // (the routes filter by status:'completed'), so nothing else to flip.
}

// ─── Webhook: NOWPayments ─────────────────────────────────────────────────────
// Mounted with raw body parser so HMAC signature verification sees the exact
// bytes NOWPayments sent.
router.post(
  '/webhook/nowpayments',
  bodyParser.raw({ type: '*/*', limit: '1mb' }),
  async (req, res) => {
    try {
      if (!hasProvider('nowpayments')) {
        return res.status(503).json({ error: 'NOWPayments not configured' });
      }
      const provider = getProvider('nowpayments');
      const signature = req.header('x-nowpayments-sig');
      const result = await provider.verifyWebhook(req.body, signature);

      const tx = await Transaction.findOne({
        where: { providerInvoiceId: result.providerInvoiceId, provider: 'nowpayments' },
      });
      if (!tx) {
        // Unknown invoice — ack 200 so NOWPayments doesn't retry forever.
        return res.json({ ok: true, ignored: true });
      }

      if (tx.status !== result.status) {
        await tx.update({ status: result.status, webhookReceivedAt: new Date() });
        if (result.status === 'completed') await applyUnlock(tx);
      }
      res.json({ ok: true });
    } catch (err) {
      console.warn('NOWPayments webhook rejected:', err.message);
      res.status(401).json({ error: 'Invalid webhook', detail: err.message });
    }
  },
);

// ─── Polling: fan returning from hosted checkout ──────────────────────────────
// Frontend polls this until status flips off 'pending'.
router.get('/status/:transactionId', requireAuth, async (req, res) => {
  try {
    const tx = await Transaction.findByPk(req.params.transactionId);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.userId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
    res.json({
      id: tx.id,
      status: tx.status,
      provider: tx.provider,
      type: tx.type,
      referenceId: tx.referenceId,
      amount: tx.amount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── List active providers (frontend uses this to choose UI options) ─────────
router.get('/providers', requireAuth, async (_req, res) => {
  const { listProviders } = require('../payments/registry');
  res.json({ providers: listProviders() });
});

// ─── Saved payment methods (cards) ───────────────────────────────────────────

router.get('/methods', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'fan') return res.status(403).json({ error: 'Fan account required' });
    const methods = await PaymentMethod.findAll({
      where: { userId: req.user.userId },
      order: [['isDefault', 'DESC'], ['createdAt', 'DESC']],
    });
    res.json({ methods });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/methods', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'fan') return res.status(403).json({ error: 'Fan account required' });
    if (!hasProvider('card')) return res.status(503).json({ error: 'Card provider not configured' });

    const { cardData, billingAddress, setDefault } = req.body || {};
    const provider = getProvider('card');
    const tok = await provider.tokenizeCard({ fanId: req.user.userId, cardData, billingAddress });

    if (setDefault) {
      await PaymentMethod.update({ isDefault: false }, { where: { userId: req.user.userId } });
    }

    const method = await PaymentMethod.create({
      userId: req.user.userId,
      provider: 'card',
      providerTokenId: tok.providerTokenId,
      last4: tok.last4,
      brand: tok.brand,
      expMonth: tok.expMonth,
      expYear: tok.expYear,
      isDefault: !!setDefault,
    });
    res.json({ method });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/methods/:id', requireAuth, async (req, res) => {
  try {
    const method = await PaymentMethod.findByPk(req.params.id);
    if (!method) return res.status(404).json({ error: 'Method not found' });
    if (method.userId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
    await method.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/methods/:id/default', requireAuth, async (req, res) => {
  try {
    const method = await PaymentMethod.findByPk(req.params.id);
    if (!method || method.userId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
    await PaymentMethod.update({ isDefault: false }, { where: { userId: req.user.userId } });
    await method.update({ isDefault: true });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── One-tap charge with a saved method ──────────────────────────────────────
// Body: { paymentMethodId, productType: 'post_unlock'|'collection_unlock'|'ppv_message', productId }
// Server looks up price (never trust client-supplied amount) and charges.
router.post('/charge', requireAuth, async (req, res) => {
  try {
    if (req.user.role !== 'fan') return res.status(403).json({ error: 'Fan account required' });
    const { paymentMethodId, productType, productId } = req.body || {};
    if (!paymentMethodId || !productType || !productId) {
      return res.status(400).json({ error: 'paymentMethodId, productType, productId required' });
    }

    const method = await PaymentMethod.findByPk(paymentMethodId);
    if (!method || method.userId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });

    // Look up the product server-side
    let amount, creatorId, description;
    let effectiveType = productType;
    let effectiveRefId = productId;
    let bundleMessageId = null; // when unlocking a bundle via chat, also reveal the message
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
      amount = parseFloat(col.price || 0);
      creatorId = col.creatorId;
      description = `Bundle unlock: ${col.title}`;
    } else if (productType === 'ppv_message') {
      const msg = await Message.findByPk(productId);
      if (!msg) return res.status(404).json({ error: 'Message not found' });
      if (msg.fanId !== req.user.userId) return res.status(403).json({ error: 'Forbidden' });
      amount = parseFloat(msg.ppvPrice || 0);
      creatorId = msg.creatorId;
      if (msg.collectionId) {
        // Bundle attached to chat — treat as collection_unlock so the bundle
        // appears unlocked in Vault. Also flip the message itself.
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

    // Idempotency: skip if already unlocked
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

    const creator = await Creator.findByPk(creatorId);
    const provider = getProvider(method.provider);
    const charge = await provider.chargeSavedToken({
      providerTokenId: method.providerTokenId,
      amount,
      currency: 'USD',
      fanId: req.user.userId,
      creatorId,
      productRef: { type: effectiveType, id: effectiveRefId },
      statementDescriptor: creator?.billingDescriptor || null,
    });

    const tx = await Transaction.create({
      userId: req.user.userId,
      creatorId,
      type: effectiveType,
      amount,
      referenceId: effectiveRefId,
      description,
      provider: method.provider,
      providerChargeId: charge.providerChargeId,
      status: charge.status === 'completed' ? 'completed' : 'failed',
    });

    // Bundle-via-chat: also flip the message's isUnlocked
    if (tx.status === 'completed' && bundleMessageId) {
      const m = await Message.findByPk(bundleMessageId);
      if (m && !m.isUnlocked) await m.update({ isUnlocked: true });
    }

    if (tx.status === 'completed') await applyUnlock(tx);

    res.json({
      success: tx.status === 'completed',
      transactionId: tx.id,
      status: tx.status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
