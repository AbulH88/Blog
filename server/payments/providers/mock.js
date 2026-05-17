const crypto = require('crypto');
const { PaymentProvider } = require('../PaymentProvider');

/**
 * Mock provider — preserves the pre-Phase-6 behavior. Every checkout / charge
 * settles instantly so dev flows keep working without real money.
 */
class MockProvider extends PaymentProvider {
  constructor() {
    super('mock');
  }

  async createCheckout({ amount, currency = 'USD', fanId, creatorId, productRef }) {
    const providerInvoiceId = `mock_inv_${crypto.randomBytes(8).toString('hex')}`;
    return {
      providerInvoiceId,
      status: 'completed',
      amount,
      currency,
      meta: { fanId, creatorId, productRef },
    };
  }

  async verifyWebhook() {
    throw new Error('Mock provider does not receive webhooks');
  }

  async tokenizeCard({ fanId }) {
    return {
      providerTokenId: `mock_tok_${fanId}_${crypto.randomBytes(4).toString('hex')}`,
      last4: '4242',
      brand: 'Visa',
      expMonth: 12,
      expYear: 2030,
    };
  }

  async chargeSavedToken({ providerTokenId, amount }) {
    return {
      providerChargeId: `mock_chg_${crypto.randomBytes(8).toString('hex')}`,
      status: 'completed',
      amount,
      tokenUsed: providerTokenId,
    };
  }

  async refund({ providerChargeId }) {
    return {
      providerRefundId: `mock_ref_${crypto.randomBytes(8).toString('hex')}`,
      status: 'completed',
      chargeRefunded: providerChargeId,
    };
  }
}

module.exports = MockProvider;
