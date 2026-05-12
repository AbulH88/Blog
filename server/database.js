const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.resolve(__dirname, process.env.DATABASE_PATH || './data/platform.db'),
  logging: false,
});

module.exports = sequelize;
