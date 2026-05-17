/**
 * AI Chatbot admin endpoints. All creator-only.
 *   PATCH /api/ai/settings          — update persona / model / nsfw / ppv settings
 *   GET   /api/ai/settings          — fetch current
 *   PATCH /api/ai/thread/:fanId     — per-fan AI auto-reply toggle
 *   POST  /api/ai/test              — sandbox: run one AI generation
 *   GET   /api/ai/starter-template  — prefill suggestion from creator bio
 */
const express = require('express');
const { Creator, Subscription, PendingPpv, Collection } = require('../models');
const { requireAuth, requireCreator } = require('../middleware/authMiddleware');
const aiChat = require('../services/aiChat');
const ppvApproval = require('../services/ppvApproval');
const telegram = require('../services/telegram');

const router = express.Router();
router.use(requireAuth, requireCreator);

router.get('/settings', async (req, res) => {
  const c = await Creator.findByPk(req.user.creatorId, {
    attributes: [
      'aiPersonaPrompt', 'aiModel', 'aiNsfwLevel', 'aiPpvEnabled', 'aiPpvCadence',
      'aiApprovalRequired', 'aiApprovalTimeoutSec',
      'telegramBotToken', 'telegramChatId',
    ],
  });
  // Mask the bot token in the response — only expose presence
  const out = c.toJSON();
  out.telegramBotTokenSet = !!out.telegramBotToken;
  delete out.telegramBotToken;
  res.json(out);
});

router.patch('/settings', async (req, res) => {
  const c = await Creator.findByPk(req.user.creatorId);
  const {
    aiPersonaPrompt, aiModel, aiNsfwLevel, aiPpvEnabled, aiPpvCadence,
    aiApprovalRequired, aiApprovalTimeoutSec,
    telegramBotToken, telegramChatId,
  } = req.body;
  if (aiPersonaPrompt !== undefined) c.aiPersonaPrompt = aiPersonaPrompt;
  if (aiModel !== undefined) c.aiModel = aiModel;
  if (aiNsfwLevel !== undefined) {
    if (!['off', 'flirty', 'explicit'].includes(aiNsfwLevel)) {
      return res.status(400).json({ error: 'invalid aiNsfwLevel' });
    }
    c.aiNsfwLevel = aiNsfwLevel;
  }
  if (aiPpvEnabled !== undefined) c.aiPpvEnabled = !!aiPpvEnabled;
  if (aiPpvCadence !== undefined) c.aiPpvCadence = parseInt(aiPpvCadence, 10) || 8;
  if (aiApprovalRequired !== undefined) c.aiApprovalRequired = !!aiApprovalRequired;
  if (aiApprovalTimeoutSec !== undefined) c.aiApprovalTimeoutSec = parseInt(aiApprovalTimeoutSec, 10) || 600;

  // Telegram token change → restart poller. Empty string clears it.
  let tokenChanged = false;
  if (telegramBotToken !== undefined) {
    const trimmed = (telegramBotToken || '').trim() || null;
    if (trimmed !== c.telegramBotToken) {
      c.telegramBotToken = trimmed;
      tokenChanged = true;
    }
  }
  if (telegramChatId !== undefined) c.telegramChatId = (telegramChatId || '').trim() || null;

  await c.save();

  if (tokenChanged) {
    telegram.stopPolling(c.id);
    if (c.telegramBotToken) telegram.startPolling(c.id, c.telegramBotToken);
  }

  res.json({ ok: true });
});

// ── Telegram helpers ──────────────────────────────────────────────
router.post('/telegram/verify', async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  try {
    const bot = await telegram.verifyToken(token);
    res.json({ ok: true, username: bot.username });
  } catch (err) {
    res.status(400).json({ error: 'invalid_token', detail: err.message });
  }
});

router.post('/telegram/test', async (req, res) => {
  const c = await Creator.findByPk(req.user.creatorId);
  if (!c.telegramBotToken || !c.telegramChatId) {
    return res.status(400).json({ error: 'telegram not configured' });
  }
  try {
    await telegram.sendText(c.telegramBotToken, c.telegramChatId,
      `✅ Test message from your AI chatbot setup.\n\nApproval notifications will look like this when fans need your attention.`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'send_failed', detail: err.message });
  }
});

// ── Pending PPV management ────────────────────────────────────────
router.get('/ppv/pending', async (req, res) => {
  const list = await PendingPpv.findAll({
    where: { creatorId: req.user.creatorId, status: 'pending' },
    order: [['createdAt', 'DESC']],
  });
  res.json(list);
});

router.get('/ppv/pending/:fanId', async (req, res) => {
  const fanId = parseInt(req.params.fanId, 10);
  const p = await PendingPpv.findOne({
    where: { creatorId: req.user.creatorId, fanId, status: 'pending' },
    order: [['createdAt', 'DESC']],
  });
  res.json(p);
});

function getIo(req) { return req.app.get('io'); }
function getSendCreatorMessage() { return require('../socket').sendCreatorMessage; }

router.post('/ppv/:id/approve', async (req, res) => {
  const p = await PendingPpv.findByPk(req.params.id);
  if (!p || p.creatorId !== req.user.creatorId) return res.status(404).json({ error: 'not_found' });
  const r = await ppvApproval.approve({
    io: getIo(req), sendCreatorMessage: getSendCreatorMessage(),
    pendingId: p.id, by: 'manual',
  });
  res.json(r);
});

router.post('/ppv/:id/change', async (req, res) => {
  const p = await PendingPpv.findByPk(req.params.id);
  if (!p || p.creatorId !== req.user.creatorId) return res.status(404).json({ error: 'not_found' });
  const { collectionId } = req.body;
  const col = await Collection.findByPk(collectionId);
  if (!col || col.creatorId !== req.user.creatorId) return res.status(400).json({ error: 'bad_collection' });
  const r = await ppvApproval.approveWithBundle({
    io: getIo(req), sendCreatorMessage: getSendCreatorMessage(),
    pendingId: p.id, collectionId, by: 'manual',
  });
  res.json(r);
});

router.post('/ppv/:id/text-only', async (req, res) => {
  const p = await PendingPpv.findByPk(req.params.id);
  if (!p || p.creatorId !== req.user.creatorId) return res.status(404).json({ error: 'not_found' });
  const r = await ppvApproval.textOnly({
    io: getIo(req), sendCreatorMessage: getSendCreatorMessage(),
    pendingId: p.id, by: 'manual',
  });
  res.json(r);
});

router.post('/ppv/:id/reject', async (req, res) => {
  const p = await PendingPpv.findByPk(req.params.id);
  if (!p || p.creatorId !== req.user.creatorId) return res.status(404).json({ error: 'not_found' });
  const r = await ppvApproval.reject({
    io: getIo(req), pendingId: p.id, by: 'manual',
  });
  res.json(r);
});

router.get('/starter-template', async (req, res) => {
  const c = await Creator.findByPk(req.user.creatorId);
  res.json({ template: aiChat.defaultPersona(c) });
});

router.patch('/thread/:fanId', async (req, res) => {
  const fanId = parseInt(req.params.fanId, 10);
  const sub = await Subscription.findOne({
    where: { creatorId: req.user.creatorId, userId: fanId },
  });
  if (!sub) return res.status(404).json({ error: 'subscription not found' });
  sub.aiAutoReplyEnabled = !!req.body.enabled;
  await sub.save();
  res.json({ enabled: sub.aiAutoReplyEnabled });
});

router.post('/test', async (req, res) => {
  try {
    const { history } = req.body; // [{ role: 'user'|'assistant', content: string }, ...]
    if (!Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ error: 'history array required' });
    }
    const creator = await Creator.findByPk(req.user.creatorId);
    const { text, collectionId } = await aiChat.generateTestReply({
      creator,
      sandboxHistory: history,
    });
    res.json({ text, collectionId });
  } catch (err) {
    res.status(500).json({ error: 'ai_failed', detail: err.message });
  }
});

module.exports = router;
