const jwt = require('jsonwebtoken');
const { Message, Creator, Collection } = require('./models');
require('dotenv').config();

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

        const payload = { ...msg.toJSON() };
        io.to(`fan:${user.userId}`).emit('new_message', payload);
        io.to(`creator:${creator.id}`).emit('new_message', payload);
      } catch (err) {
        socket.emit('chat_error', err.message);
      }
    });

    // Creator replies to a fan
    socket.on('creator_reply', async ({ fanId, content, isPPV, ppvPrice, mediaUrl, collectionId }) => {
      try {
        if (user.role !== 'creator') return;

        // Bundle attach: derive PPV price and media from the Collection
        let effectivePrice = isPPV ? parseFloat(ppvPrice) || 0 : 0;
        let effectiveMedia = mediaUrl || null;
        let effectiveCollectionId = null;
        if (collectionId) {
          const col = await Collection.findByPk(collectionId);
          if (!col || col.creatorId !== user.creatorId) return socket.emit('chat_error', 'Bundle not found');
          effectivePrice = parseFloat(col.price || 0);
          effectiveMedia = col.coverImage || effectiveMedia;
          effectiveCollectionId = col.id;
        }

        const msg = await Message.create({
          creatorId: user.creatorId,
          fanId,
          senderId: user.creatorId,
          senderType: 'creator',
          content: isPPV || collectionId ? (content || '') : (content || ''),
          mediaUrl: effectiveMedia,
          isPPV: !!(isPPV || collectionId),
          ppvPrice: effectivePrice,
          collectionId: effectiveCollectionId,
          isUnlocked: !(isPPV || collectionId),
        });

        const payload = { ...msg.toJSON() };
        io.to(`fan:${fanId}`).emit('new_message', payload);
        io.to(`creator:${user.creatorId}`).emit('new_message', payload);
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
