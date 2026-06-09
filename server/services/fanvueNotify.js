/**
 * Fanvue → Telegram mobile alerts.
 *
 * Turns a Fanvue webhook event (message.received, tip.new, subscription.new,
 * follow.new, purchase.new, …) into a short push to the creator's phone via
 * their existing Telegram bot (creator.telegramBotToken + telegramChatId).
 *
 * No-ops silently if Telegram isn't configured or fanvueNotify is off, so it's
 * always safe to call from the webhook receiver.
 */
const telegram = require('./telegram');

const esc = (s) => String(s == null ? '' : s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Deep pick: supports dotted paths ("user.handle") and plain keys.
const dpick = (o, ...paths) => {
  for (const p of paths) {
    const v = String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
    if (v != null && v !== '') return v;
  }
  return undefined;
};

const money = (v) => {
  if (v == null) return '';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!Number.isFinite(n)) return '';
  // Fanvue amounts are in cents.
  return `$${(n / 100).toFixed(2)}`;
};

/** Build the alert text for an event. */
function format(event, body) {
  const d = body?.data || body?.payload || body || {};
  const fan = dpick(d,
    'user.handle', 'user.displayName', 'user.username',
    'sender.handle', 'sender.displayName', 'sender.username',
    'fan.handle', 'fan.displayName', 'follower.handle',
    'handle', 'displayName', 'username') || 'someone';
  const amt = money(dpick(d, 'amount', 'amountInCents', 'total', 'price', 'tip.amount', 'transaction.amount'));
  const e = String(event || '').toLowerCase();

  if (e.includes('message')) {
    const text = dpick(d, 'message.text', 'message.content', 'text', 'content', 'preview') || '';
    const body = String(text).slice(0, 300);
    return `💬 <b>New message</b> from ${esc(fan)}` + (body ? `\n${esc(body)}` : '');
  }
  if (e.includes('tip'))          return `💸 <b>${esc(fan)} tipped${amt ? ' ' + amt : ''}!</b> 🎉`;
  if (e.includes('subscription')) return `🌟 <b>New subscriber:</b> ${esc(fan)}${amt ? ` (${amt})` : ''}`;
  if (e.includes('follow'))       return `➕ <b>New follower:</b> ${esc(fan)}`;
  if (e.includes('purchase'))     return `🛒 <b>${esc(fan)} unlocked content</b>${amt ? ` — ${amt}` : ''} 🔓`;
  if (e.includes('payout'))       return `🏦 <b>Payout${amt ? ' ' + amt : ''}</b> is on its way.`;
  return `🔔 Fanvue: ${esc(event)}`;
}

/** Send a Telegram alert for a Fanvue event (no-op if not configured). */
async function notify(creator, event, body) {
  if (!creator || !creator.telegramBotToken || !creator.telegramChatId) return false;
  if (creator.fanvueNotify === false) return false;
  try {
    await telegram.sendText(creator.telegramBotToken, creator.telegramChatId, format(event, body));
    return true;
  } catch (e) {
    console.warn('[fanvue-notify] send fail:', e.message);
    return false;
  }
}

module.exports = { notify, format };
