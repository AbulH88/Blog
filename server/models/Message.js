const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Message = sequelize.define('Message', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  creatorId: { type: DataTypes.INTEGER, allowNull: false },
  fanId: { type: DataTypes.INTEGER, allowNull: false },
  senderId: { type: DataTypes.INTEGER, allowNull: false },
  senderType: { type: DataTypes.ENUM('fan', 'creator'), allowNull: false },
  content: { type: DataTypes.TEXT, defaultValue: '' },
  mediaUrl: { type: DataTypes.STRING, allowNull: true },
  isPPV: { type: DataTypes.BOOLEAN, defaultValue: false },
  ppvPrice: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  isUnlocked: { type: DataTypes.BOOLEAN, defaultValue: false },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  sentAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
});

module.exports = Message;
