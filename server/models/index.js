const sequelize = require('../database');
const Creator     = require('./Creator');
const User        = require('./User');
const Post        = require('./Post');
const Collection  = require('./Collection');
const Subscription = require('./Subscription');
const Message     = require('./Message');
const Transaction = require('./Transaction');
const PaymentMethod = require('./PaymentMethod');
const PendingPpv  = require('./PendingPpv');

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
Message.belongsTo(Collection, { foreignKey: 'collectionId', as: 'collection' });

Creator.hasMany(Transaction,   { foreignKey: 'creatorId', as: 'transactions' });
User.hasMany(Transaction,      { foreignKey: 'userId',    as: 'transactions' });
Transaction.belongsTo(Creator, { foreignKey: 'creatorId' });
Transaction.belongsTo(User,    { foreignKey: 'userId' });

User.hasMany(PaymentMethod,        { foreignKey: 'userId', as: 'paymentMethods' });
PaymentMethod.belongsTo(User,      { foreignKey: 'userId' });

// Lightweight in-place migrations — apply nullable column additions safely.
// Use this pattern whenever you add a nullable column to an existing model,
// so we don't have to wipe platform.db.
const applyMigrations = async () => {
  const qi = sequelize.getQueryInterface();
  const { DataTypes } = require('sequelize');

  const addIfMissing = async (table, column, spec) => {
    try {
      const cols = await qi.describeTable(table);
      if (!cols[column]) {
        await qi.addColumn(table, column, spec);
        console.log(`+ added ${table}.${column}`);
      }
    } catch (e) {
      console.warn(`migration warn (${table}.${column}):`, e.message);
    }
  };

  await addIfMissing('Creators', 'fanvueUrl', { type: DataTypes.STRING, allowNull: true });
  await addIfMissing('Creators', 'featuredLinks', { type: DataTypes.JSON, defaultValue: [] });
  await addIfMissing('Creators', 'instagramPosts', { type: DataTypes.JSON, defaultValue: [] });
  await addIfMissing('Creators', 'logoUrl', { type: DataTypes.STRING, allowNull: true });
  await addIfMissing('Creators', 'billingDescriptor', { type: DataTypes.STRING, allowNull: true });
  await addIfMissing('Posts', 'sortOrder', { type: DataTypes.INTEGER, defaultValue: 0 });
  await addIfMissing('Collections', 'sortOrder', { type: DataTypes.INTEGER, defaultValue: 0 });

  // Phase 6 — payments
  await addIfMissing('Transactions', 'status', { type: DataTypes.STRING, defaultValue: 'completed' });
  await addIfMissing('Transactions', 'provider', { type: DataTypes.STRING, allowNull: true });
  await addIfMissing('Transactions', 'providerInvoiceId', { type: DataTypes.STRING, allowNull: true });
  await addIfMissing('Transactions', 'providerChargeId', { type: DataTypes.STRING, allowNull: true });
  await addIfMissing('Transactions', 'webhookReceivedAt', { type: DataTypes.DATE, allowNull: true });
  await addIfMissing('Messages', 'collectionId', { type: DataTypes.INTEGER, allowNull: true });

  // Phase 6.6 — Welcome PPV
  await addIfMissing('Creators', 'welcomeEnabled', { type: DataTypes.BOOLEAN, defaultValue: false });
  await addIfMissing('Creators', 'welcomePpvText', { type: DataTypes.TEXT, allowNull: true });
  await addIfMissing('Creators', 'welcomeMediaUrl', { type: DataTypes.STRING, allowNull: true });
  await addIfMissing('Creators', 'welcomePpvPrice', { type: DataTypes.DECIMAL(10, 2), allowNull: true });

  // Phase 6.7 — Collection discount %
  await addIfMissing('Collections', 'discountPercent', { type: DataTypes.INTEGER, defaultValue: 0 });

  // Phase 7 — AI Chatbot
  await addIfMissing('Creators', 'aiPersonaPrompt', { type: DataTypes.TEXT, allowNull: true });
  await addIfMissing('Creators', 'aiModel', { type: DataTypes.STRING, defaultValue: 'sao10k/l3.3-euryale-70b' });
  // SQLite stores ENUMs as VARCHAR + CHECK; addColumn with STRING is the safe portable path
  await addIfMissing('Creators', 'aiNsfwLevel', { type: DataTypes.STRING, defaultValue: 'flirty' });
  await addIfMissing('Creators', 'aiPpvEnabled', { type: DataTypes.BOOLEAN, defaultValue: true });
  await addIfMissing('Creators', 'aiPpvCadence', { type: DataTypes.INTEGER, defaultValue: 8 });
  await addIfMissing('Subscriptions', 'aiAutoReplyEnabled', { type: DataTypes.BOOLEAN, defaultValue: false });

  // AI PPV approval system + Telegram integration
  await addIfMissing('Creators', 'aiApprovalRequired', { type: DataTypes.BOOLEAN, defaultValue: true });
  await addIfMissing('Creators', 'aiApprovalTimeoutSec', { type: DataTypes.INTEGER, defaultValue: 600 });
  await addIfMissing('Creators', 'telegramBotToken', { type: DataTypes.STRING, allowNull: true });
  await addIfMissing('Creators', 'telegramChatId', { type: DataTypes.STRING, allowNull: true });
};

const syncDatabase = async () => {
  await sequelize.sync();
  await applyMigrations();
  console.log('Database synced');
};

module.exports = {
  sequelize, syncDatabase,
  Creator, User, Post, Collection, Subscription, Message, Transaction, PaymentMethod, PendingPpv,
};
