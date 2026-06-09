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

/**
 * Suggest a photo to send in a chat. Reads the creator's curated AI photo
 * folder, uses Fanvue's auto-generated descriptions/tags (get /media/bulk) so
 * the AI can pick the best match, then drafts a caption. Suggest-only — the
 * route returns this to the admin UI for the creator to approve + send.
 * @returns {{none:true, reason}} | {{mediaUuid, name, description, caption, price}}
 */
async function suggestPhoto(creator, chatUuid) {
  const folder = creator.fanvueAiPhotoFolder || 'AI Images';
  const media = asArray(await fanvue.fanvueFetch(
    creator, 'GET', `/vault/folders/${encodeURIComponent(folder)}/media?size=50`));
  if (!media.length) return { none: true, reason: `No photos in your "${folder}" Vault folder yet. Add some there first.` };

  const uuids = media.map((m) => pick(m, 'uuid', 'id')).filter(Boolean).slice(0, 20);
  let results = {};
  try {
    const bulk = await fanvue.fanvueFetch(creator, 'GET', `/media/bulk?mediaUuids=${uuids.join(',')}`);
    results = bulk?.results || {};
  } catch { /* fall through — handled below */ }

  const catalog = uuids.map((u, idx) => {
    const r = results[u] || {};
    const tags = Array.isArray(r?.tags?.tags) ? r.tags.tags.join(', ') : '';
    return { i: idx + 1, uuid: u, name: r.name || '', desc: r.description || r.caption || '', tags, price: r.recommendedPrice || null };
  }).filter((c) => c.desc);
  if (!catalog.length) return { none: true, reason: 'Your photos are still being tagged by Fanvue — try again in a minute.' };

  const msgs = await fanvue.fanvueFetch(creator, 'GET', `/chats/${chatUuid}/messages`);
  const history = mapFanvueHistory(msgs, creator.fanvueUserUuid);
  if (!history.length) return { none: true, reason: 'No conversation yet to base a photo on.' };

  const decision = await aiChat.pickFanvuePhoto({ creator, history, catalog });
  if (!decision.photo) return { none: true, reason: decision.reason || 'AI judged no photo fits right now.' };

  const chosen = catalog.find((c) => c.i === decision.photo);
  if (!chosen) return { none: true, reason: 'AI picked a photo that is not available.' };
  const price = chosen.price || creator.fanvueAiPhotoPrice || 500;
  return {
    mediaUuid: chosen.uuid,
    name: chosen.name,
    description: chosen.desc,
    caption: decision.caption || '',
    price,
    reason: decision.reason || '',
  };
}

module.exports = { mapFanvueHistory, suggestReply, suggestPhoto, asArray, pick, isFromCreator, senderUuid, msgText, msgUuid, msgTime };
