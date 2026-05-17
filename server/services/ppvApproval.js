/**
 * PPV Approval orchestration.
 *
 * When the AI suggests a PPV and the creator has aiApprovalRequired=true,
 * we create a PendingPpv record, notify via Telegram (if configured),
 * and schedule a 10-min auto-send timer. The creator can resolve it via
 * Admin UI or Telegram inline buttons; if no decision, auto-send fires.
 *
 * sendCreatorMessage is passed in to avoid a circular dep with socket.js.
 */
const { PendingPpv, Creator, Collection, User } = require('../models');
const telegram = require('./telegram');

// Per-pending timer handles, so we can cancel on resolution
const timers = new Map();

/**
 * Hold a PPV suggestion for creator review.
 * Returns the created PendingPpv row.
 */
async function createSuggestion({ io, sendCreatorMessage, creator, fanId, text, collectionId }) {
  const timeoutSec = creator.aiApprovalTimeoutSec || 600;
  const autoSendAt = new Date(Date.now() + timeoutSec * 1000);

  const pending = await PendingPpv.create({
    creatorId: creator.id,
    fanId,
    aiReplyText: text || '',
    suggestedCollectionId: collectionId,
    autoSendAt,
    status: 'pending',
  });

  // Notify creator's admin UI via socket
  io.to(`creator:${creator.id}`).emit('ppv_suggestion', {
    id: pending.id,
    fanId,
    aiReplyText: pending.aiReplyText,
    suggestedCollectionId: collectionId,
    autoSendAt: pending.autoSendAt,
  });

  // Notify via Telegram (best effort)
  if (creator.telegramBotToken && creator.telegramChatId) {
    try {
      const [bundle, fan] = await Promise.all([
        Collection.findByPk(collectionId),
        User.findByPk(fanId, { attributes: ['username'] }),
      ]);
      const msg = await telegram.sendPpvApproval(creator.telegramBotToken, creator.telegramChatId, {
        pendingId: pending.id,
        fanUsername: fan?.username || `fan${fanId}`,
        aiText: text,
        bundleTitle: bundle?.title || `Bundle #${collectionId}`,
        bundlePrice: bundle?.price || '?',
        bundleCover: bundle?.coverImage,
        timeoutSec,
      });
      pending.telegramMessageId = msg.message_id;
      await pending.save();
    } catch (err) {
      console.warn('[ppv] telegram notify failed:', err.message);
    }
  }

  // Schedule auto-send
  const handle = setTimeout(() => {
    autoSend({ io, sendCreatorMessage, pendingId: pending.id }).catch(err =>
      console.warn('[ppv] auto-send failed:', err.message)
    );
  }, timeoutSec * 1000);
  timers.set(pending.id, handle);

  return pending;
}

/** Cancel timer for a resolved suggestion. */
function cancelTimer(pendingId) {
  const h = timers.get(pendingId);
  if (h) { clearTimeout(h); timers.delete(pendingId); }
}

/** Common path after a decision: clear timer, mark Telegram resolved. */
async function finalizeUi({ pending, resolutionText }) {
  cancelTimer(pending.id);
  if (pending.telegramMessageId) {
    const creator = await Creator.findByPk(pending.creatorId, {
      attributes: ['telegramBotToken', 'telegramChatId'],
    });
    if (creator?.telegramBotToken && creator?.telegramChatId) {
      await telegram.markResolved(
        creator.telegramBotToken, creator.telegramChatId,
        pending.telegramMessageId, resolutionText
      );
    }
  }
}

/** Approve: send AI text + originally suggested bundle. */
async function approve({ io, sendCreatorMessage, pendingId, by = 'manual' }) {
  const pending = await PendingPpv.findByPk(pendingId);
  if (!pending || pending.status !== 'pending') return { ok: false, reason: 'not_pending' };

  await sendCreatorMessage({
    io,
    creatorId: pending.creatorId,
    fanId: pending.fanId,
    content: pending.aiReplyText,
    collectionId: pending.suggestedCollectionId,
  });

  pending.status = 'sent';
  pending.finalCollectionId = pending.suggestedCollectionId;
  pending.decidedAt = new Date();
  pending.decisionBy = by;
  await pending.save();

  io.to(`creator:${pending.creatorId}`).emit('ppv_resolved', { id: pending.id, status: 'sent' });
  await finalizeUi({ pending, resolutionText: '✅ <b>Sent</b> as suggested' });
  return { ok: true };
}

/** Approve with a different bundle. */
async function approveWithBundle({ io, sendCreatorMessage, pendingId, collectionId, by = 'manual' }) {
  const pending = await PendingPpv.findByPk(pendingId);
  if (!pending || pending.status !== 'pending') return { ok: false, reason: 'not_pending' };

  await sendCreatorMessage({
    io,
    creatorId: pending.creatorId,
    fanId: pending.fanId,
    content: pending.aiReplyText,
    collectionId,
  });

  pending.status = 'sent';
  pending.finalCollectionId = collectionId;
  pending.decidedAt = new Date();
  pending.decisionBy = by;
  await pending.save();

  io.to(`creator:${pending.creatorId}`).emit('ppv_resolved', { id: pending.id, status: 'sent' });
  await finalizeUi({ pending, resolutionText: `✅ <b>Sent</b> with different bundle (#${collectionId})` });
  return { ok: true };
}

/** Text only: send AI's reply text without the PPV. */
async function textOnly({ io, sendCreatorMessage, pendingId, by = 'manual' }) {
  const pending = await PendingPpv.findByPk(pendingId);
  if (!pending || pending.status !== 'pending') return { ok: false, reason: 'not_pending' };

  if (pending.aiReplyText?.trim()) {
    await sendCreatorMessage({
      io,
      creatorId: pending.creatorId,
      fanId: pending.fanId,
      content: pending.aiReplyText,
    });
  }

  pending.status = 'text_only';
  pending.decidedAt = new Date();
  pending.decisionBy = by;
  await pending.save();

  io.to(`creator:${pending.creatorId}`).emit('ppv_resolved', { id: pending.id, status: 'text_only' });
  await finalizeUi({ pending, resolutionText: '📝 <b>Sent text only</b> (PPV dropped)' });
  return { ok: true };
}

/** Reject: discard everything, fan gets nothing. */
async function reject({ io, pendingId, by = 'manual' }) {
  const pending = await PendingPpv.findByPk(pendingId);
  if (!pending || pending.status !== 'pending') return { ok: false, reason: 'not_pending' };

  pending.status = 'rejected';
  pending.decidedAt = new Date();
  pending.decisionBy = by;
  await pending.save();

  io.to(`creator:${pending.creatorId}`).emit('ppv_resolved', { id: pending.id, status: 'rejected' });
  await finalizeUi({ pending, resolutionText: '❌ <b>Rejected</b> — nothing sent' });
  return { ok: true };
}

/** Auto-send fired by timeout. */
async function autoSend({ io, sendCreatorMessage, pendingId }) {
  const pending = await PendingPpv.findByPk(pendingId);
  if (!pending || pending.status !== 'pending') return;

  await sendCreatorMessage({
    io,
    creatorId: pending.creatorId,
    fanId: pending.fanId,
    content: pending.aiReplyText,
    collectionId: pending.suggestedCollectionId,
  });

  pending.status = 'expired_auto_sent';
  pending.finalCollectionId = pending.suggestedCollectionId;
  pending.decidedAt = new Date();
  pending.decisionBy = 'auto';
  await pending.save();

  io.to(`creator:${pending.creatorId}`).emit('ppv_resolved', { id: pending.id, status: 'expired_auto_sent' });
  await finalizeUi({ pending, resolutionText: '⏱ <b>Auto-sent</b> (no decision in time)' });
}

/**
 * On startup: re-schedule timers for any pending suggestions that survived
 * a server restart. If they're already past their autoSendAt, fire immediately.
 */
async function rehydrate({ io, sendCreatorMessage }) {
  const list = await PendingPpv.findAll({ where: { status: 'pending' } });
  const now = Date.now();
  for (const p of list) {
    const remainingMs = new Date(p.autoSendAt).getTime() - now;
    if (remainingMs <= 0) {
      autoSend({ io, sendCreatorMessage, pendingId: p.id }).catch(() => {});
    } else {
      const handle = setTimeout(() => {
        autoSend({ io, sendCreatorMessage, pendingId: p.id }).catch(() => {});
      }, remainingMs);
      timers.set(p.id, handle);
    }
  }
  if (list.length) console.log(`[ppv] rehydrated ${list.length} pending suggestions`);
}

module.exports = {
  createSuggestion,
  approve,
  approveWithBundle,
  textOnly,
  reject,
  autoSend,
  rehydrate,
};
