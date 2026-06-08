/**
 * Shared Fanvue ↔ AI glue. Used by the /ai-reply route (assist) and the
 * background auto-reply poller, so the message-mapping lives in one place.
 */
const fanvue = require('./fanvue');
const aiChat = require('./aiChat');

const pick = (o, ...ks) => { for (const k of ks) if (o && o[k] != null) return o[k]; return undefined; };
const asArray = (d) => (Array.isArray(d) ? d : (d?.data || d?.items || d?.results || d?.messages || []));

const isFromCreator = (m) => !!pick(m, 'isCreator', 'fromCreator', 'isSelf', 'sentByMe', 'fromSelf');
const msgText = (m) => pick(m, 'text', 'content', 'body', 'message') || '';
const msgUuid = (m) => pick(m, 'uuid', 'id', 'messageUuid');

/** Map Fanvue messages → chat-completion history (creator=assistant, fan=user). */
function mapFanvueHistory(messages) {
  return asArray(messages)
    .map((m) => ({ role: isFromCreator(m) ? 'assistant' : 'user', content: msgText(m) }))
    .filter((m) => m.content);
}

/** Fetch a chat thread + generate an in-persona suggested reply. Returns text. */
async function suggestReply(creator, chatUuid) {
  const msgs = await fanvue.fanvueFetch(creator, 'GET', `/chats/${chatUuid}/messages`);
  const history = mapFanvueHistory(msgs);
  if (history.length === 0) return '';
  return aiChat.generateFanvueReply({ creator, history });
}

module.exports = { mapFanvueHistory, suggestReply, asArray, pick, isFromCreator, msgText, msgUuid };
