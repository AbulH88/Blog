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

  // Password reset — single-use token + expiry (60 min). Cleared on successful reset.
  passwordResetToken: { type: DataTypes.STRING, allowNull: true },
  passwordResetExpires: { type: DataTypes.DATE, allowNull: true },

  // Email verification — fan must click link before account is fully active.
  // For now soft-enforced (allow login but show banner) — promote to hard gate later.
  emailVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
  emailVerifyToken: { type: DataTypes.STRING, allowNull: true },
});

module.exports = User;
