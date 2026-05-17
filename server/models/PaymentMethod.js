const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const PaymentMethod = sequelize.define('PaymentMethod', {
  id:              { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId:          { type: DataTypes.INTEGER, allowNull: false },
  provider:        { type: DataTypes.STRING,  allowNull: false },
  providerTokenId: { type: DataTypes.STRING,  allowNull: false },
  last4:           { type: DataTypes.STRING,  allowNull: true },
  brand:           { type: DataTypes.STRING,  allowNull: true },
  expMonth:        { type: DataTypes.INTEGER, allowNull: true },
  expYear:         { type: DataTypes.INTEGER, allowNull: true },
  isDefault:       { type: DataTypes.BOOLEAN, defaultValue: false },
}, {
  indexes: [{ fields: ['userId'] }],
});

module.exports = PaymentMethod;
