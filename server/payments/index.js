/**
 * Payment subsystem boot: register every active provider once at startup.
 * Called from server/index.js before routes are mounted.
 */

const { registerProvider, listProviders } = require('./registry');
const { getActiveProviders } = require('./config');
const MockProvider = require('./providers/mock');

function initPayments() {
  registerProvider('mock', new MockProvider());

  const active = getActiveProviders();
  if (active.includes('nowpayments')) {
    try {
      const NowPaymentsProvider = require('./providers/nowpayments');
      registerProvider('nowpayments', new NowPaymentsProvider());
    } catch (e) {
      console.warn('NOWPayments provider failed to load:', e.message);
    }
  }
  if (active.includes('card')) {
    try {
      const CardProvider = require('./providers/card');
      registerProvider('card', new CardProvider());
    } catch (e) {
      console.warn('Card provider failed to load:', e.message);
    }
  }

  console.log('Payment providers registered:', listProviders().join(', '));
}

module.exports = { initPayments };
