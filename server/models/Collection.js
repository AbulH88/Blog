const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Collection = sequelize.define('Collection', {
  id:          { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  creatorId:   { type: DataTypes.INTEGER, allowNull: false },
  title:       { type: DataTypes.STRING,  allowNull: false, defaultValue: 'Untitled Bundle' },
  description: { type: DataTypes.TEXT,    defaultValue: '' },
  coverImage:  { type: DataTypes.STRING,  allowNull: true },
  price:       { type: DataTypes.DECIMAL(10, 2), defaultValue: 9.99 },
  isPublished: { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = Collection;
