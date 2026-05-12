const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Subscription = sequelize.define('Subscription', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false },
  creatorId: { type: DataTypes.INTEGER, allowNull: false },
  tier: {
    type: DataTypes.ENUM('basic', 'premium'),
    defaultValue: 'basic',
  },
  status: {
    type: DataTypes.ENUM('active', 'cancelled', 'expired', 'trial'),
    defaultValue: 'active',
  },
  startDate: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  renewalDate: { type: DataTypes.DATE, allowNull: true },
  cancelledAt: { type: DataTypes.DATE, allowNull: true },
  stripeSubscriptionId: { type: DataTypes.STRING, allowNull: true },
});

module.exports = Subscription;
