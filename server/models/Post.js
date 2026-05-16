const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Post = sequelize.define('Post', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  creatorId: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING, defaultValue: '' },
  caption: { type: DataTypes.TEXT, defaultValue: '' },
  mediaUrls: { type: DataTypes.JSON, defaultValue: [] },
  mediaType: {
    type: DataTypes.ENUM('image', 'video', 'audio', 'text'),
    defaultValue: 'image',
  },
  isPremium: { type: DataTypes.BOOLEAN, defaultValue: false },
  price: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  isPinned: { type: DataTypes.BOOLEAN, defaultValue: false },
  publishAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  expiresAt: { type: DataTypes.DATE, allowNull: true },
  likesCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  collectionId: { type: DataTypes.INTEGER, allowNull: true },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0 },
});

module.exports = Post;
