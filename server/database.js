/**
 * Sequelize connection — supports SQLite (dev default) or Postgres (production).
 *
 * Switching:
 *   DB_DIALECT=postgres
 *   DATABASE_URL=postgres://user:pass@host:5432/dbname
 *     OR
 *   DB_HOST=localhost
 *   DB_PORT=5432
 *   DB_NAME=cristina_prod
 *   DB_USER=cristina_app
 *   DB_PASSWORD=...
 *
 * For SQLite (dev / fallback):
 *   DB_DIALECT=sqlite   (or unset)
 *   DATABASE_PATH=./data/platform.db
 *
 * Pool sizing: max=20 is comfortable for PM2 cluster mode with 2 workers
 * (each worker gets up to 10 concurrent DB connections). Bump if you go
 * to 4+ workers.
 */
const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const dialect = (process.env.DB_DIALECT || 'sqlite').toLowerCase();

let sequelize;

if (dialect === 'postgres') {
  const common = {
    dialect: 'postgres',
    logging: false,
    pool: { max: 20, min: 0, acquire: 30000, idle: 10000 },
    dialectOptions:
      // Cloud-hosted Postgres (Supabase, Neon, RDS) usually requires SSL.
      // Local-host Postgres (aaPanel on same VPS) does not.
      process.env.DB_SSL === 'true'
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {},
  };

  if (process.env.DATABASE_URL) {
    sequelize = new Sequelize(process.env.DATABASE_URL, common);
  } else {
    sequelize = new Sequelize(
      process.env.DB_NAME || 'cristina_prod',
      process.env.DB_USER || 'cristina_app',
      process.env.DB_PASSWORD || '',
      {
        ...common,
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
      },
    );
  }
} else {
  // SQLite — dev default, also used for CI / quick local boot.
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.resolve(__dirname, process.env.DATABASE_PATH || './data/platform.db'),
    logging: false,
  });
}

module.exports = sequelize;
