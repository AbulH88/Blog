/**
 * Funnel event logging — fire-and-forget.
 *
 * Designed to NEVER throw or block the calling request. Sentry-style:
 * if the DB write fails, log a warning and move on. Analytics losses
 * are acceptable; user-facing failures are not.
 *
 * Usage:
 *   const events = require('./services/events');
 *   events.log('fan_signed_up', { userId, creatorId });
 *   events.log('deposit_completed', { userId, creatorId, props: { amount: 25 } });
 *
 * Names should be snake_case verbs in past tense.
 */

let EventModel = null;

function getModel() {
  if (!EventModel) {
    try { EventModel = require('../models').Event; }
    catch { /* not yet wired */ }
  }
  return EventModel;
}

/**
 * Log an event. Returns a Promise but you should NOT await it from
 * request handlers — let it run in the background.
 */
function log(name, { userId = null, creatorId = null, props = {} } = {}) {
  const Event = getModel();
  if (!Event) return Promise.resolve(); // model not registered yet (e.g. during startup)

  return Event.create({ name, userId, creatorId, props })
    .catch((err) => {
      console.warn('[events] failed to log', name, '—', err.message);
    });
}

/**
 * Funnel report — distinct user counts per event, within a time window.
 * Returns:
 *   { signups: 42, verified: 38, sent_message: 25, deposited: 8, unlocked: 12 }
 */
async function funnel({ days = 30, creatorId = null } = {}) {
  const Event = getModel();
  if (!Event) return null;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const { Op, fn, col, literal } = require('sequelize');
  const where = { createdAt: { [Op.gte]: since } };
  if (creatorId) where.creatorId = creatorId;

  // Pull all rows in window — for our scale this is cheap and
  // lets us count distinct users per name without a complex query.
  const rows = await Event.findAll({
    where,
    attributes: ['name', 'userId'],
    raw: true,
  });

  const byName = {};
  for (const r of rows) {
    if (!byName[r.name]) byName[r.name] = new Set();
    if (r.userId != null) byName[r.name].add(r.userId);
  }

  // Convert sets to counts. Keep raw event count too (some events
  // are anonymous — userId null — so distinct-user count under-reports).
  const result = {};
  for (const [name, users] of Object.entries(byName)) {
    result[name] = {
      distinctUsers: users.size,
      total: rows.filter(r => r.name === name).length,
    };
  }
  // Suppress unused-import warnings — these are exported for future ad-hoc reports
  void fn; void col; void literal;
  return result;
}

module.exports = { log, funnel };
