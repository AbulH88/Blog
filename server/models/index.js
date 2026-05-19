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

  // Dedicated chat avatar (separate from logo + hero)
  await addIfMissing('Creators', 'chatAvatarUrl', { type: DataTypes.STRING, allowNull: true });

  // Visibility toggles
  await addIfMissing('Creators', 'ageGateEnabled', { type: DataTypes.BOOLEAN, defaultValue: true });
  await addIfMissing('Creators', 'disclosureVisible', { type: DataTypes.BOOLEAN, defaultValue: true });
  await addIfMissing('Creators', 'searchIndexable', { type: DataTypes.BOOLEAN, defaultValue: false });

  // Fan wallet — pre-funded balance fans use for one-tap unlocks
  await addIfMissing('Users', 'walletBalance', { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 });

  // Password reset + email verification
  await addIfMissing('Users', 'passwordResetToken', { type: DataTypes.STRING, allowNull: true });
  await addIfMissing('Users', 'passwordResetExpires', { type: DataTypes.DATE, allowNull: true });
  await addIfMissing('Users', 'emailVerified', { type: DataTypes.BOOLEAN, defaultValue: false });
  await addIfMissing('Users', 'emailVerifyToken', { type: DataTypes.STRING, allowNull: true });

  // Grandfather pre-existing users (any account that's ever logged in OR has a
  // deposit transaction) as verified — they signed up before this gate was
  // added, so locking them out would be retroactive. New signups are still
  // unverified by default and must click the email link.
  try {
    const [granted] = await sequelize.query(`
      UPDATE Users
         SET emailVerified = 1
       WHERE (emailVerified = 0 OR emailVerified IS NULL)
         AND lastLoginAt IS NOT NULL
    `);
    if (granted?.changes) console.log(`+ grandfathered ${granted.changes} pre-existing user(s) as emailVerified`);
  } catch (err) {
    console.warn('emailVerified grandfather migration warn:', err.message);
  }

  // Relax Transactions.creatorId — make it nullable (wallet_deposit has no creator).
  // SQLite has no ALTER COLUMN, so we rebuild the table preserving rows.
  try {
    const [rows] = await sequelize.query("SELECT sql FROM sqlite_master WHERE type='table' AND name='Transactions'");
    const ddl = rows[0]?.sql || '';
    const needsRebuild = /`?creatorId`?\s+INTEGER\s+NOT\s+NULL/i.test(ddl);
    if (needsRebuild) {
      await sequelize.query('PRAGMA foreign_keys = OFF');
      await sequelize.query(`
        CREATE TABLE Transactions_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          userId INTEGER NOT NULL,
          creatorId INTEGER,
          type TEXT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          currency VARCHAR(255) DEFAULT 'USD',
          stripePaymentId VARCHAR(255),
          description VARCHAR(255) DEFAULT '',
          referenceId INTEGER,
          createdAt DATETIME NOT NULL,
          updatedAt DATETIME NOT NULL,
          status VARCHAR(255) DEFAULT 'completed',
          provider VARCHAR(255),
          providerInvoiceId VARCHAR(255),
          providerChargeId VARCHAR(255),
          webhookReceivedAt DATETIME
        )
      `);
      await sequelize.query(`
        INSERT INTO Transactions_new
          (id, userId, creatorId, type, amount, currency, stripePaymentId, description, referenceId, createdAt, updatedAt, status, provider, providerInvoiceId, providerChargeId, webhookReceivedAt)
        SELECT
          id, userId, creatorId, type, amount, currency, stripePaymentId, description, referenceId, createdAt, updatedAt, status, provider, providerInvoiceId, providerChargeId, webhookReceivedAt
        FROM Transactions
      `);
      await sequelize.query('DROP TABLE Transactions');
      await sequelize.query('ALTER TABLE Transactions_new RENAME TO Transactions');
      await sequelize.query('PRAGMA foreign_keys = ON');
      console.log('+ relaxed Transactions.creatorId to nullable (preserved all rows)');
    }
  } catch (err) {
    console.warn('Transactions schema relax failed:', err.message);
  }
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
