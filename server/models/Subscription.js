const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Subscription = sequelize.define('Subscription', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  creatorId: { type: DataTypes.INTEGER, allowNull: false },
  // 'free' is the auto-follow tier created on signup so the fan instantly
  // appears in the creator's inbox without paying. 'basic'/'premium' are
  // paid tiers via NOWPayments. Order matters for the existing Postgres
  // enum — additions happen via ALTER TYPE in applyMigrations.
  tier: {
    type: DataTypes.ENUM('free', 'basic', 'premium'),
    defaultValue: 'free',
  },
  status: {
    type: DataTypes.ENUM('active', 'cancelled', 'expired', 'trial'),
    defaultValue: 'active',
  },
  startDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  renewalDate: { type: DataTypes.DATE, allowNull: true },
  cancelledAt: { type: DataTypes.DATE, allowNull: true },
  stripeSubscriptionId: { type: DataTypes.STRING, allowNull: true },

  // AI auto-reply toggle for this specific creator-fan thread.
  // Default OFF — creator opts in per-thread from the chat UI.
  aiAutoReplyEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
});

module.exports = Subscription;
