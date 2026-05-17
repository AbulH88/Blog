/**
 * Telegram bot integration for AI PPV approval.
 *
 * Each creator runs their OWN bot (they get the token from @BotFather).
 * We poll Telegram's getUpdates API per-creator to receive button taps.
 *
 * Why long-polling instead of webhooks: localhost dev has no public URL.
 * Long-polling works behind NAT, in dev, in production — strictly worse latency
 * (~1s) but zero infra. Acceptable for a 10-minute approval window.
 *
 * Each running poller is tracked in `pollers` by creatorId. When the creator
 * updates their token, we cancel the old poller and start a new one.
 */
const TG_API = 'https://api.telegram.org/bot';

const pollers = new Map(); // creatorId -> { abortCtl, lastUpdateId, token }

// Lazy import to avoid circular dep with aiChatRoutes
let onCallback = async () => {};
function setCallbackHandler(fn) { onCallback = fn; }

/** Low-level Telegram API call. */
async function tg(token, method, body) {
  const res = await fetch(`${TG_API}${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Telegram ${method}: ${json.description}`);
  return json.result;
}

/** Verify a bot token is valid + return bot username. */
async function verifyToken(token) {
  const me = await tg(token, 'getMe', null);
  return { username: me.username, id: me.id };
}

/** Send a plain text message. */
async function sendText(token, chatId, text) {
  return tg(token, 'sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' });
}

/** Send a PPV approval notification with inline buttons. */
async function sendPpvApproval(token, chatId, { pendingId, fanUsername, aiText, bundleTitle, bundlePrice, bundleCover, timeoutSec }) {
  const minutes = Math.round(timeoutSec / 60);
  const caption = `🤖 <b>AI suggestion for ${escapeHtml(fanUsername)}</b>\n\n💬 <i>${escapeHtml(aiText || '(no text)')}</i>\n\n📦 <b>${escapeHtml(bundleTitle)}</b> — $${bundlePrice}\n\n⏱ Auto-sends in ${minutes}m if no action.`;

  const body = {
    chat_id: chatId,
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [
          { text: '✅ Send', callback_data: `send:${pendingId}` },
          { text: '📝 Text only', callback_data: `text:${pendingId}` },
        ],
        [
          { text: '❌ Reject', callback_data: `rej:${pendingId}` },
        ],
      ],
    },
  };

  // Try with photo if bundleCover is a remote/public URL; else just text
  if (bundleCover && /^https?:\/\//i.test(bundleCover)) {
    return tg(token, 'sendPhoto', { ...body, photo: bundleCover, caption });
  }
  return tg(token, 'sendMessage', { ...body, text: caption });
}

/** Edit a previously-sent approval message to show the resolution. */
async function markResolved(token, chatId, messageId, resolutionText) {
  try {
    // Try editing as photo caption first; fall back to text edit
    await tg(token, 'editMessageCaption', {
      chat_id: chatId, message_id: messageId,
      caption: resolutionText, parse_mode: 'HTML',
    });
  } catch {
    try {
      await tg(token, 'editMessageText', {
        chat_id: chatId, message_id: messageId,
        text: resolutionText, parse_mode: 'HTML',
      });
    } catch {/* swallow */}
  }
  // Always strip the buttons regardless
  try {
    await tg(token, 'editMessageReplyMarkup', {
      chat_id: chatId, message_id: messageId, reply_markup: { inline_keyboard: [] },
    });
  } catch {/* swallow */}
}

/** Acknowledge a callback so the button stops spinning on user's phone. */
async function answerCallback(token, callbackQueryId, text = '') {
  try {
    await tg(token, 'answerCallbackQuery', { callback_query_id: callbackQueryId, text });
  } catch {/* swallow */}
}

/** Start long-polling for a creator's bot. Cancels any prior poller. */
function startPolling(creatorId, token) {
  stopPolling(creatorId);
  if (!token) return;

  const abortCtl = new AbortController();
  const state = { abortCtl, lastUpdateId: 0, token };
  pollers.set(creatorId, state);

  (async () => {
    console.log(`[telegram] poll start creator=${creatorId}`);
    while (!abortCtl.signal.aborted) {
      try {
        const url = `${TG_API}${token}/getUpdates?timeout=25&offset=${state.lastUpdateId + 1}&allowed_updates=["callback_query","message"]`;
        const res = await fetch(url, { signal: abortCtl.signal });
        const json = await res.json();
        if (!json.ok) {
          console.warn(`[telegram] creator=${creatorId} getUpdates error: ${json.description}`);
          await sleep(5000);
          continue;
        }
        for (const update of json.result) {
          state.lastUpdateId = Math.max(state.lastUpdateId, update.update_id);
          if (update.callback_query) {
            const cq = update.callback_query;
            try {
              await onCallback({
                creatorId,
                callbackQueryId: cq.id,
                data: cq.data,
                fromUserId: cq.from.id,
                chatId: cq.message?.chat?.id,
                messageId: cq.message?.message_id,
              });
            } catch (err) {
              console.warn(`[telegram] callback handler error:`, err.message);
              await answerCallback(token, cq.id, '❌ Error: ' + err.message.slice(0, 80));
            }
          } else if (update.message?.text?.startsWith('/start')) {
            // First-time setup: reply with chat id so the creator can copy it
            const chatId = update.message.chat.id;
            await sendText(
              token, chatId,
              `👋 Hi! Your chat ID is <code>${chatId}</code>\n\nPaste this into Admin → AI Chatbot → Telegram Chat ID, then save.`
            );
          }
        }
      } catch (err) {
        if (abortCtl.signal.aborted) break;
        console.warn(`[telegram] poll error creator=${creatorId}:`, err.message);
        await sleep(5000);
      }
    }
    console.log(`[telegram] poll stop creator=${creatorId}`);
  })();
}

function stopPolling(creatorId) {
  const p = pollers.get(creatorId);
  if (p) {
    p.abortCtl.abort();
    pollers.delete(creatorId);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

/** Init: start pollers for every creator that has a token configured. */
async function initFromDb() {
  const { Creator } = require('../models');
  const creators = await Creator.findAll({
    where: { telegramBotToken: { [require('sequelize').Op.ne]: null } },
    attributes: ['id', 'telegramBotToken'],
  });
  for (const c of creators) {
    if (c.telegramBotToken) startPolling(c.id, c.telegramBotToken);
  }
}

module.exports = {
  verifyToken,
  sendText,
  sendPpvApproval,
  markResolved,
  answerCallback,
  startPolling,
  stopPolling,
  initFromDb,
  setCallbackHandler,
};
