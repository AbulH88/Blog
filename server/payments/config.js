/**
 * Platform-wide payment configuration, read from environment.
 *
 * The user is the sole merchant of record — one set of API keys covers all
 * AI personas. Per-persona statement descriptor still varies (pulled from
 * Creator.billingDescriptor at charge time).
 */

require('dotenv').config();

function getActiveProviders() {
  const active = ['mock'];
  if (process.env.NOWPAYMENTS_API_KEY) active.push('nowpayments');
  if (process.env.CARD_PROVIDER) active.push('card');
  return active;
}

function getNowPaymentsConfig() {
  return {
    apiKey: process.env.NOWPAYMENTS_API_KEY || null,
    ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET || null,
    publicUrl: process.env.NOWPAYMENTS_PUBLIC_URL || 'https://api.nowpayments.io/v1',
    callbackUrl: process.env.PUBLIC_API_URL
      ? `${process.env.PUBLIC_API_URL}/api/payments/webhook/nowpayments`
      : null,
  };
}

function getCardProviderConfig() {
  return {
    provider: process.env.CARD_PROVIDER || 'mock',
    apiKey: process.env.CARD_PROVIDER_API_KEY || null,
    webhookSecret: process.env.CARD_PROVIDER_WEBHOOK_SECRET || null,
  };
}

module.exports = { getActiveProviders, getNowPaymentsConfig, getCardProviderConfig };
