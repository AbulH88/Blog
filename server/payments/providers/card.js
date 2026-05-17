const crypto = require('crypto');
const { PaymentProvider } = require('../PaymentProvider');
const { getCardProviderConfig } = require('../config');

/**
 * Abstract base for any card-network provider (Segpay / Epoch / CCBill /
 * RocketGate / etc.). Implements the parts that don't vary by gateway:
 * choosing which concrete subclass to instantiate based on CARD_PROVIDER
 * env var.
 *
 * Subclasses override tokenizeCard, chargeSavedToken, and verifyWebhook.
 * Until the user picks a gateway and provides keys, MockCardProvider is
 * used so the saved-card UX can be built/tested end-to-end.
 */
class CardProvider extends PaymentProvider {
  constructor(name = 'card') {
    super(name);
  }
}

class MockCardProvider extends CardProvider {
  constructor() { super('card'); }

  async tokenizeCard({ fanId, cardData }) {
    const last4 = (cardData?.number || '4242424242424242').slice(-4);
    return {
      providerTokenId: `mock_tok_${fanId}_${crypto.randomBytes(4).toString('hex')}`,
      last4,
      brand: cardData?.brand || 'Visa',
      expMonth: cardData?.expMonth || 12,
      expYear: cardData?.expYear || 2030,
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

  async verifyWebhook() {
    throw new Error('MockCardProvider does not receive webhooks');
  }

  async refund({ providerChargeId }) {
    return {
      providerRefundId: `mock_ref_${crypto.randomBytes(8).toString('hex')}`,
      status: 'completed',
      chargeRefunded: providerChargeId,
    };
  }
}

/**
 * Factory: pick the concrete subclass based on CARD_PROVIDER env var.
 * Until you pick a real gateway, this returns MockCardProvider so the
 * UI flow can be built/tested end-to-end.
 *
 * To plug in a real gateway later, add a file in providers/ (e.g.
 * segpay.js) that extends CardProvider, then add a case here.
 */
function createCardProvider() {
  const cfg = getCardProviderConfig();
  switch ((cfg.provider || 'mock').toLowerCase()) {
    case 'mock':
    default:
      return new MockCardProvider();
  }
}

module.exports = createCardProvider;
module.exports.CardProvider = CardProvider;
module.exports.MockCardProvider = MockCardProvider;
