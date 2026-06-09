/**
 * Shared Fanvue ↔ AI glue. Used by the /ai-reply route (assist) and the
 * background auto-reply poller, so the message-mapping lives in one place.
 */
const fanvue = require('./fanvue');
const aiChat = require('./aiChat');

const pick = (o, ...ks) => { for (const k of ks) if (o && o[k] != null) return o[k]; return undefined; };
const asArray = (d) => (Array.isArray(d) ? d : (d?.data || d?.items || d?.results || d?.messages || []));

// The Fanvue message shape is { sender:{uuid}, recipient:{uuid}, text, sentAt, uuid }.
// A message is from the creator when its sender uuid == the creator's own Fanvue
// uuid (creator.fanvueUserUuid). Fall back to legacy boolean flags if present.
const senderUuid = (m) => pick(m.sender || {}, 'uuid') || pick(m, 'senderUuid', 'sentByUserId');
const isFromCreator = (m, creatorUuid) => {
  const su = senderUuid(m);
  if (creatorUuid && su) return su === creatorUuid;
  return !!pick(m, 'isCreator', 'fromCreator', 'isSelf', 'sentByMe', 'fromSelf');
};
const msgText = (m) => pick(m, 'text', 'content', 'body', 'message') || '';
const msgUuid = (m) => pick(m, 'uuid', 'id', 'messageUuid');
const msgTime = (m) => { const v = pick(m, 'sentAt', 'createdAt', 'created', 'timestamp'); const n = v ? Date.parse(v) : NaN; return Number.isFinite(n) ? n : 0; };

/**
 * Map Fanvue messages → chat-completion history (creator=assistant, fan=user),
 * in CHRONOLOGICAL order. The API returns newest-first, so sort ascending.
 */
function mapFanvueHistory(messages, creatorUuid) {
  const arr = asArray(messages).slice().sort((a, b) => msgTime(a) - msgTime(b));
  return arr
    .map((m) => ({ role: isFromCreator(m, creatorUuid) ? 'assistant' : 'user', content: msgText(m) }))
    .filter((m) => m.content);
}

/** Fetch a chat thread + generate an in-persona suggested reply. Returns text. */
async function suggestReply(creator, chatUuid) {
  const msgs = await fanvue.fanvueFetch(creator, 'GET', `/chats/${chatUuid}/messages`);
  const history = mapFanvueHistory(msgs, creator.fanvueUserUuid);
  if (history.length === 0) return '';
  return aiChat.generateFanvueReply({ creator, history });
}

module.exports = { mapFanvueHistory, suggestReply, asArray, pick, isFromCreator, senderUuid, msgText, msgUuid, msgTime };
