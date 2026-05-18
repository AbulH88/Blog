const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  username: { type: DataTypes.STRING, allowNull: false },
  passwordHash: { type: DataTypes.STRING, allowNull: false },
  avatarUrl: { type: DataTypes.STRING, defaultValue: '' },
  isBlocked: { type: DataTypes.BOOLEAN, defaultValue: false },
  lastLoginAt: { type: DataTypes.DATE },

  // Pre-funded wallet — fans deposit crypto/card here, then one-tap unlock from balance.
  // Stored in USD (the platform's accounting currency); crypto deposits are auto-converted.
  walletBalance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
});

module.exports = User;
