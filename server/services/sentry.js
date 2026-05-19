/**
 * Sentry error monitoring — graceful no-op when SENTRY_DSN is unset.
 *
 * Production: paste the DSN into .env, restart, errors stream to sentry.io.
 * Local dev: leave SENTRY_DSN empty, this module is a silent passthrough.
 */
let Sentry = null;
let enabled = false;

function init(app) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    console.log('[sentry] SENTRY_DSN not set — error tracking disabled');
    return;
  }
  try {
    Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.RELEASE_TAG || undefined,
      tracesSampleRate: 0.1,            // 10% of transactions
      profilesSampleRate: 0,
      integrations: [
        Sentry.httpIntegration(),
        Sentry.expressIntegration(),
      ],
    });
    // Express integration auto-installs middleware via setupExpressErrorHandler later.
    enabled = true;
    console.log('[sentry] error tracking ENABLED');
  } catch (err) {
    console.warn('[sentry] failed to init:', err.message);
  }
}

/**
 * Mount the Sentry express error handler. Must be called AFTER all routes
 * and BEFORE the final express error handler.
 */
function mountErrorHandler(app) {
  if (!enabled || !Sentry) return;
  try {
    Sentry.setupExpressErrorHandler(app);
  } catch {/* SDK version mismatch — silently skip */}
}

function captureException(err, ctx) {
  if (!enabled || !Sentry) return;
  try { Sentry.captureException(err, { extra: ctx }); } catch {/* noop */}
}

module.exports = { init, mountErrorHandler, captureException };
