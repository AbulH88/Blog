const crypto = require('crypto');
const https = require('https');
const { URL } = require('url');
const { PaymentProvider } = require('../PaymentProvider');
const { getNowPaymentsConfig } = require('../config');

/**
 * NOWPayments — hosted crypto checkout.
 *
 * Docs: https://documenter.getpostman.com/view/7907941/2s93JusNJt
 *
 * Flow:
 *  1. createCheckout() → POST /v1/invoice → returns hosted invoice_url.
 *     Fan is redirected; they pick any crypto and pay.
 *  2. NOWPayments POSTs to webhook callback with HMAC-SHA512 signature
 *     (sorted-key JSON, hex). We verify, then flip Transaction.status.
 */

const NP_STATUS_TO_LOCAL = {
  finished: 'completed',
  confirmed: 'completed',
  partially_paid: 'completed', // accept whatever they sent
  failed: 'failed',
  expired: 'failed',
  refunded: 'refunded',
};

class NowPaymentsProvider extends PaymentProvider {
  constructor() {
    super('nowpayments');
    const cfg = getNowPaymentsConfig();
    if (!cfg.apiKey) throw new Error('NOWPAYMENTS_API_KEY not set');
    this.cfg = cfg;
  }

  async createCheckout({ amount, currency = 'USD', fanId, creatorId, productRef, statementDescriptor, payCurrency }) {
    const orderId = `order_${fanId}_${creatorId}_${productRef.type}_${productRef.id || ''}_${Date.now()}`;
    const successUrl = process.env.PUBLIC_APP_URL
      ? `${process.env.PUBLIC_APP_URL}/payment/return?invoice=${orderId}`
      : undefined;

    const body = {
      price_amount: Number(amount),
      price_currency: currency.toLowerCase(),
      order_id: orderId,
      order_description: `${statementDescriptor || 'Platform'} — ${productRef.type}`,
      ipn_callback_url: this.cfg.callbackUrl || undefined,
      success_url: successUrl,
      cancel_url: successUrl,
      // If the fan picked a coin on our UI, lock NOWPayments to that coin so they
      // don't see the picker again. They land directly on the BTC/USDT/etc. pay page.
      ...(payCurrency ? { pay_currency: String(payCurrency).toLowerCase() } : {}),
      // Fan pays the on-chain network fee on top — protects merchant from shortfall.
      // Without this, ETH/BTC fees come out of the deposit and the credited
      // amount is less than what the fan saw on our UI.
      is_fee_paid_by_user: true,
      // Lock the exchange rate at invoice creation time. Prevents the "amount
      // changed at checkout" surprise that happens with floating-rate invoices.
      is_fixed_rate: true,
    };

    const resp = await this._post('/invoice', body);
    if (!resp.id || !resp.invoice_url) {
      throw new Error(`NOWPayments invoice creation failed: ${JSON.stringify(resp)}`);
    }

    return {
      providerInvoiceId: String(resp.id),
      redirectUrl: resp.invoice_url,
      status: 'pending',
      orderId,
    };
  }

  // Look up the minimum USD-equivalent deposit for a given coin. Cached for
  // 1h in-memory since NOWPayments doesn't change these often and we don't
  // want to hit their API on every wallet-modal open.
  async getMinAmount(payCurrency, priceCurrency = 'usd') {
    if (!this._minCache) this._minCache = new Map();
    const key = `${priceCurrency}->${payCurrency}`;
    const hit = this._minCache.get(key);
    if (hit && Date.now() - hit.at < 60 * 60 * 1000) return hit.value;

    const resp = await this._get(`/min-amount?currency_from=${priceCurrency}&currency_to=${payCurrency}&fiat_equivalent=usd`);
    // Response shape: { currency_from, currency_to, min_amount, fiat_equivalent }
    const min = Number(resp.fiat_equivalent ?? resp.min_amount ?? 0);
    if (Number.isFinite(min) && min > 0) {
      this._minCache.set(key, { at: Date.now(), value: min });
      return min;
    }
    return null;
  }

  _get(pathSegment) {
    const url = new URL(this.cfg.publicUrl + pathSegment);
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'GET',
        headers: { 'x-api-key': this.cfg.apiKey },
      }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error(`Non-JSON GET from NOWPayments: ${data.slice(0, 200)}`)); }
        });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => req.destroy(new Error('NOWPayments GET timeout')));
      req.end();
    });
  }

  async verifyWebhook(rawBody, signatureHeader) {
    if (!this.cfg.ipnSecret) throw new Error('NOWPAYMENTS_IPN_SECRET not set');
    if (!signatureHeader) throw new Error('Missing signature');

    const bodyString = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody);
    const parsed = JSON.parse(bodyString);

    // NOWPayments signs the JSON body with sorted keys (alphabetical), HMAC-SHA512, hex.
    const sortedJson = JSON.stringify(parsed, Object.keys(parsed).sort());
    const expected = crypto
      .createHmac('sha512', this.cfg.ipnSecret)
      .update(sortedJson)
      .digest('hex');

    const ok = crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signatureHeader, 'hex'),
    );
    if (!ok) throw new Error('Invalid webhook signature');

    return {
      event: 'invoice.update',
      providerInvoiceId: String(parsed.invoice_id ?? parsed.payment_id ?? ''),
      status: NP_STATUS_TO_LOCAL[parsed.payment_status] || 'pending',
      amount: parsed.price_amount ? Number(parsed.price_amount) : undefined,
      raw: parsed,
    };
  }

  _post(pathSegment, body) {
    const url = new URL(this.cfg.publicUrl + pathSegment);
    const payload = JSON.stringify(body);
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
          'x-api-key': this.cfg.apiKey,
        },
      }, (res) => {
        let data = '';
        res.on('data', (c) => { data += c; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Non-JSON response from NOWPayments: ${data.slice(0, 200)}`));
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(15000, () => req.destroy(new Error('NOWPayments request timeout')));
      req.write(payload);
      req.end();
    });
  }
}

module.exports = NowPaymentsProvider;
