const { DataTypes } = require('sequelize');
const sequelize = require('../database');

/**
 * Lightweight funnel analytics events.
 *
 * Indexed on (name, createdAt) so the admin funnel report ("how many users
 * did X this week") is cheap. The name is a stable enum-ish string —
 * fan_signed_up, email_verified, chat_message_sent, deposit_completed,
 * unlock_completed, account_deleted. Add new ones freely; older names live
 * forever in history.
 *
 * userId is nullable for anonymous events (page views, signups before User
 * row is committed). props is a small JSON blob for ad-hoc context
 * (e.g. { amount: 9.99 } on deposit_completed).
 */
const Event = sequelize.define('Event', {
  id:        { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name:      { type: DataTypes.STRING, allowNull: false },
  userId:    { type: DataTypes.INTEGER, allowNull: true },
  creatorId: { type: DataTypes.INTEGER, allowNull: true },
  props:     { type: DataTypes.JSON, defaultValue: {} },
}, {
  timestamps: true,
  updatedAt: false, // events are immutable
  indexes: [
    { fields: ['name', 'createdAt'] },
    { fields: ['userId'] },
  ],
});

module.exports = Event;
