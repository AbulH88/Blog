const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Transaction = sequelize.define('Transaction', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId:          { type: DataTypes.INTEGER, allowNull: false },
  creatorId:       { type: DataTypes.INTEGER, allowNull: false },
  type: {
    type: DataTypes.ENUM('subscription', 'post_unlock', 'ppv_message', 'tip', 'collection_unlock'),
    allowNull: false,
  },
  amount:          { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  currency:        { type: DataTypes.STRING,  defaultValue: 'USD' },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending',
    allowNull: false,
    validate: { isIn: [['pending', 'completed', 'failed', 'refunded']] },
  },
  provider:           { type: DataTypes.STRING,  allowNull: true },
  providerInvoiceId:  { type: DataTypes.STRING,  allowNull: true },
  providerChargeId:   { type: DataTypes.STRING,  allowNull: true },
  webhookReceivedAt:  { type: DataTypes.DATE,    allowNull: true },
  stripePaymentId:    { type: DataTypes.STRING,  allowNull: true }, // deprecated, kept for back-compat
  description:        { type: DataTypes.STRING,  defaultValue: '' },
  referenceId:        { type: DataTypes.INTEGER, allowNull: true }, // collectionId for collection_unlock
});

module.exports = Transaction;
