/**
 * PaymentProvider — abstract interface every concrete provider implements.
 *
 * Subclasses must override the methods they support. Methods left as no-ops
 * throw `NotSupportedError` so calling code can detect capability gaps
 * (e.g. NOWPayments doesn't tokenize cards, MockCardProvider doesn't redirect).
 */

class NotSupportedError extends Error {
  constructor(method, providerName) {
    super(`${providerName} does not support ${method}()`);
    this.name = 'NotSupportedError';
  }
}

class PaymentProvider {
  constructor(name) {
    if (!name) throw new Error('PaymentProvider requires a name');
    this.name = name;
  }

  /**
   * @param {{
   *   amount: number, currency: string,
   *   fanId: number, creatorId: number,
   *   productRef: { type: 'post_unlock'|'collection_unlock'|'ppv_message'|'tip', id?: number },
   *   metadata?: object,
   *   statementDescriptor?: string,
   * }} _params
   * @returns {Promise<{ providerInvoiceId: string, redirectUrl?: string, clientToken?: string, status: 'pending'|'completed' }>}
   */
  async createCheckout(_params) {
    throw new NotSupportedError('createCheckout', this.name);
  }

  /**
   * @param {Buffer|string} _rawBody
   * @param {string} _signatureHeader
   * @returns {Promise<{ event: string, providerInvoiceId: string, status: 'completed'|'failed'|'refunded', amount?: number }>}
   */
  async verifyWebhook(_rawBody, _signatureHeader) {
    throw new NotSupportedError('verifyWebhook', this.name);
  }

  /**
   * @param {{ clientToken?: string, cardData?: object, billingAddress?: object, fanId: number }} _params
   * @returns {Promise<{ providerTokenId: string, last4: string, brand: string, expMonth: number, expYear: number }>}
   */
  async tokenizeCard(_params) {
    throw new NotSupportedError('tokenizeCard', this.name);
  }

  /**
   * @param {{ providerTokenId: string, amount: number, currency: string, fanId: number, creatorId: number, productRef: object, statementDescriptor?: string }} _params
   * @returns {Promise<{ providerChargeId: string, status: 'completed'|'failed' }>}
   */
  async chargeSavedToken(_params) {
    throw new NotSupportedError('chargeSavedToken', this.name);
  }

  /**
   * @param {{ providerChargeId: string, amount?: number }} _params
   * @returns {Promise<{ providerRefundId: string, status: 'completed'|'failed' }>}
   */
  async refund(_params) {
    throw new NotSupportedError('refund', this.name);
  }
}

module.exports = { PaymentProvider, NotSupportedError };
