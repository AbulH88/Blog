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
const Event       = require('./Event');

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

  // Grandfather pre-existing users (any account that's ever logged in) as
  // verified — they signed up before this gate was added, so locking them
  // out would be retroactive. New signups are still unverified by default.
  // Portable: use User.update() instead of raw SQL so booleans + row-count
  // work on both SQLite and Postgres.
  try {
    const { Op } = require('sequelize');
    const [affected] = await User.update(
      { emailVerified: true },
      {
        where: {
          [Op.and]: [
            { lastLoginAt: { [Op.ne]: null } },
            {
              [Op.or]: [
                { emailVerified: false },
                { emailVerified: null },
              ],
            },
          ],
        },
      },
    );
    if (affected) console.log(`+ grandfathered ${affected} pre-existing user(s) as emailVerified`);
  } catch (err) {
    console.warn('emailVerified grandfather migration warn:', err.message);
  }

  // Relax Transactions.creatorId — make it nullable (wallet_deposit has no creator).
  // Postgres: simple ALTER COLUMN. SQLite: no ALTER COLUMN exists, so we rebuild
  // the table while preserving rows.
  try {
    const dialect = sequelize.getDialect();
    if (dialect === 'postgres') {
      // Idempotent: if already nullable, the statement is a no-op-equivalent.
      await sequelize.query('ALTER TABLE "Transactions" ALTER COLUMN "creatorId" DROP NOT NULL');
      console.log('+ relaxed Transactions.creatorId to nullable (postgres)');
    } else {
      // SQLite path — rebuild only if still NOT NULL.
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
        console.log('+ relaxed Transactions.creatorId to nullable (sqlite rebuild)');
      }
    }
  } catch (err) {
    console.warn('Transactions schema relax failed:', err.message);
  }

  // Add checkoutUrl column for Resume-pending-deposit feature. Idempotent.
  try {
    const dialect = sequelize.getDialect();
    if (dialect === 'postgres') {
      await sequelize.query('ALTER TABLE "Transactions" ADD COLUMN IF NOT EXISTS "checkoutUrl" VARCHAR(1024)');
    } else {
      // SQLite — check before adding to keep this idempotent
      const [cols] = await sequelize.query("PRAGMA table_info(Transactions)");
      if (!cols.some(c => c.name === 'checkoutUrl')) {
        await sequelize.query('ALTER TABLE Transactions ADD COLUMN checkoutUrl VARCHAR(1024)');
      }
    }
  } catch (err) {
    console.warn('Transactions.checkoutUrl migration warn:', err.message);
  }

  // Lowercase any historical email addresses on Users + Creators so the case-
  // sensitive unique index can't be bypassed by retroactive duplicates. The
  // app now normalizes on every write path; this catches pre-existing rows.
  // Idempotent — rows already lowercase are unaffected.
  try {
    const dialect = sequelize.getDialect();
    if (dialect === 'postgres') {
      await sequelize.query('UPDATE "Users" SET "email" = LOWER("email") WHERE "email" <> LOWER("email")');
      await sequelize.query('UPDATE "Creators" SET "email" = LOWER("email") WHERE "email" <> LOWER("email")');
    } else {
      await sequelize.query("UPDATE Users SET email = LOWER(email) WHERE email <> LOWER(email)");
      await sequelize.query("UPDATE Creators SET email = LOWER(email) WHERE email <> LOWER(email)");
    }
  } catch (err) {
    console.warn('email-lowercase migration warn:', err.message);
  }
};

const syncDatabase = async () => {
  await sequelize.sync();
  await applyMigrations();
  console.log('Database synced');
};

module.exports = {
  sequelize, syncDatabase,
  Creator, User, Post, Collection, Subscription, Message, Transaction, PaymentMethod, PendingPpv, Event,
};
