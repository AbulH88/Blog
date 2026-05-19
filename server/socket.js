const jwt = require('jsonwebtoken');
const { Message, Creator, Collection, Subscription } = require('./models');
const aiChat = require('./services/aiChat');
const ppvApproval = require('./services/ppvApproval');
require('dotenv').config();

/**
 * Shared helper: create a creator-side Message (manual reply OR AI reply OR
 * AI welcome). Handles bundle PPV via Collection lookup and broadcasts the
 * new_message to both fan and creator rooms. Single source of truth for
 * "the creator (or her AI) just sent something".
 */
async function sendCreatorMessage({
  io,
  creatorId,
  fanId,
  content,
  mediaUrl = null,
  isPPV = false,
  ppvPrice = 0,
  collectionId = null,
}) {
  let effectivePrice = isPPV ? parseFloat(ppvPrice) || 0 : 0;
  let effectiveMedia = mediaUrl || null;
  let effectiveCollectionId = null;
  let effectiveIsPPV = !!isPPV;

  if (collectionId) {
    const col = await Collection.findByPk(collectionId);
    if (!col || col.creatorId !== creatorId) throw new Error('Bundle not found');
    effectivePrice = parseFloat(col.price || 0);
    effectiveMedia = col.coverImage || effectiveMedia;
    effectiveCollectionId = col.id;
    effectiveIsPPV = true;
  }

  const msg = await Message.create({
    creatorId,
    fanId,
    senderId: creatorId,
    senderType: 'creator',
    content: content || '',
    mediaUrl: effectiveMedia,
    isPPV: effectiveIsPPV,
    ppvPrice: effectivePrice,
    collectionId: effectiveCollectionId,
    isUnlocked: !effectiveIsPPV,
  });

  const payload = { ...msg.toJSON() };
  io.to(`fan:${fanId}`).emit('new_message', payload);
  io.to(`creator:${creatorId}`).emit('new_message', payload);
  return msg;
}

/**
 * Fire-and-forget AI auto-reply for a fan message. Emits typing indicator,
 * generates the reply, then sends it via sendCreatorMessage. Silent on error
 * (we don't want a broken AI to kill the chat experience — the creator can
 * still reply manually).
 */
async function triggerAiReply({ io, creator, fanId }) {
  try {
    io.to(`fan:${fanId}`).emit('creator_typing');

    const history = await Message.findAll({
      where: { creatorId: creator.id, fanId },
      order: [['sentAt', 'ASC']],
      limit: 50,
    });

    const { text, collectionId } = await aiChat.generateReply({
      creator,
      fanId,
      history,
    });

    if (!text && !collectionId) return; // safety: empty reply, skip

    // PPV approval gate: if AI wants to attach a bundle AND creator requires approval,
    // hold both text + PPV for review. Otherwise auto-send immediately.
    if (collectionId && creator.aiApprovalRequired !== false) {
      await ppvApproval.createSuggestion({
        io,
        sendCreatorMessage,
        creator,
        fanId,
        text: text || '',
        collectionId,
      });
      return;
    }

    await sendCreatorMessage({
      io,
      creatorId: creator.id,
      fanId,
      content: text || '',
      collectionId: collectionId || null,
    });
  } catch (err) {
    console.warn(`AI reply failed for creator=${creator.id} fan=${fanId}:`, err.message);
  }
}

const setupSocket = (io) => {
  // Auth handshake
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket;

    if (user.role === 'fan') {
      socket.join(`fan:${user.userId}`);
    } else if (user.role === 'creator') {
      socket.join(`creator:${user.creatorId}`);
    }

    // Fan sends message to creator
    socket.on('fan_message', async ({ creatorSlug, content }) => {
      try {
        const creator = await Creator.findOne({ where: { slug: creatorSlug } });
        if (!creator || user.role !== 'fan') return;

        const msg = await Message.create({
          creatorId: creator.id,
          fanId: user.userId,
          senderId: user.userId,
          senderType: 'fan',
          content,
          isUnlocked: true,
        });
        require('./services/events').log('chat_message_sent', {
          userId: user.userId, creatorId: creator.id, props: { length: (content || '').length },
        });

        const payload = { ...msg.toJSON() };
        io.to(`fan:${user.userId}`).emit('new_message', payload);
        io.to(`creator:${creator.id}`).emit('new_message', payload);

        // AI auto-reply — only if per-fan toggle is on
        const sub = await Subscription.findOne({
          where: { creatorId: creator.id, userId: user.userId },
        });
        if (sub?.aiAutoReplyEnabled && (creator.aiNsfwLevel || 'flirty') !== 'off') {
          // Fire and forget — don't block the socket ack on AI latency
          triggerAiReply({ io, creator, fanId: user.userId });
        }
      } catch (err) {
        socket.emit('chat_error', err.message);
      }
    });

    // Creator replies to a fan (manual)
    socket.on('creator_reply', async ({ fanId, content, isPPV, ppvPrice, mediaUrl, collectionId }) => {
      try {
        if (user.role !== 'creator') return;
        await sendCreatorMessage({
          io,
          creatorId: user.creatorId,
          fanId,
          content,
          mediaUrl,
          isPPV,
          ppvPrice,
          collectionId,
        });
      } catch (err) {
        socket.emit('chat_error', err.message);
      }
    });

    // Typing indicators
    socket.on('typing', ({ creatorSlug, fanId }) => {
      if (user.role === 'fan') {
        Creator.findOne({ where: { slug: creatorSlug } }).then(c => {
          if (c) io.to(`creator:${c.id}`).emit('fan_typing', { fanId: user.userId });
        });
      } else if (user.role === 'creator') {
        io.to(`fan:${fanId}`).emit('creator_typing');
      }
    });

    socket.on('disconnect', () => {});
  });
};

module.exports = setupSocket;
module.exports.sendCreatorMessage = sendCreatorMessage;
module.exports.triggerAiReply = triggerAiReply;
