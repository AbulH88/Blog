const express = require('express');
const bodyParser = require('body-parser');
const { Transaction, Post, Collection, Message } = require('../models');
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

module.exports = router;
