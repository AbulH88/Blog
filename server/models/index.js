const sequelize = require('../database');
const Creator     = require('./Creator');
const User        = require('./User');
const Post        = require('./Post');
const Collection  = require('./Collection');
const Subscription = require('./Subscription');
const Message     = require('./Message');
const Transaction = require('./Transaction');

// Associations
Creator.hasMany(Post,        { foreignKey: 'creatorId', as: 'posts' });
Post.belongsTo(Creator,      { foreignKey: 'creatorId', as: 'creator' });

Creator.hasMany(Collection,  { foreignKey: 'creatorId', as: 'collections' });
Collection.belongsTo(Creator,{ foreignKey: 'creatorId' });
Collection.hasMany(Post,     { foreignKey: 'collectionId', as: 'posts' });
Post.belongsTo(Collection,   { foreignKey: 'collectionId', as: 'collection' });

Creator.hasMany(Subscription,  { foreignKey: 'creatorId', as: 'subscriptions' });
User.hasMany(Subscription,     { foreignKey: 'userId',    as: 'subscriptions' });
Subscription.belongsTo(Creator,{ foreignKey: 'creatorId' });
Subscription.belongsTo(User,   { foreignKey: 'userId' });

Creator.hasMany(Message,    { foreignKey: 'creatorId', as: 'messages' });
Message.belongsTo(Creator,  { foreignKey: 'creatorId' });

Creator.hasMany(Transaction,   { foreignKey: 'creatorId', as: 'transactions' });
User.hasMany(Transaction,      { foreignKey: 'userId',    as: 'transactions' });
Transaction.belongsTo(Creator, { foreignKey: 'creatorId' });
Transaction.belongsTo(User,    { foreignKey: 'userId' });

const syncDatabase = async () => {
  await sequelize.sync();
  console.log('Database synced');
};

module.exports = {
  sequelize, syncDatabase,
  Creator, User, Post, Collection, Subscription, Message, Transaction,
};
