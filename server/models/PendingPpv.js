const { DataTypes } = require('sequelize');
const sequelize = require('../database');

/**
 * AI-generated PPV suggestion awaiting creator approval.
 * Created by triggerAiReply when the AI wants to attach a Collection.
 * Resolved by creator action (Admin UI or Telegram inline button) OR
 * by 10-minute auto-send timeout.
 */
const PendingPpv = sequelize.define('PendingPpv', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  creatorId: { type: DataTypes.INTEGER, allowNull: false },
  fanId: { type: DataTypes.INTEGER, allowNull: false },

  // What the AI wants to send
  aiReplyText: { type: DataTypes.TEXT, defaultValue: '' },
  suggestedCollectionId: { type: DataTypes.INTEGER, allowNull: false },

  // Resolution
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'rejected', 'text_only', 'expired_auto_sent'),
    defaultValue: 'pending',
  },
  finalCollectionId: { type: DataTypes.INTEGER, allowNull: true }, // if changed
  decidedAt: { type: DataTypes.DATE, allowNull: true },
  // 'manual' (creator clicked in UI), 'telegram' (button tap), 'auto' (timeout)
  decisionBy: { type: DataTypes.STRING, allowNull: true },

  // For Telegram message tracking — so we can edit the message after decision
  telegramMessageId: { type: DataTypes.INTEGER, allowNull: true },

  // Timeout config snapshot (in case creator changes cadence/timeout settings later)
  autoSendAt: { type: DataTypes.DATE, allowNull: false },
});

module.exports = PendingPpv;
