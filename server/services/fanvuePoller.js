/**
 * Fanvue AI auto-reply poller.
 *
 * For each creator with fanvueConnected && fanvueAiAutoReply, periodically scans
 * their Fanvue chats and replies (in the creator's AI persona) to any chat whose
 * NEWEST message is from the fan and hasn't been answered yet. Dedup via
 * creator.fanvueAiSeen (chatUuid → last-replied message uuid).
 *
 * Safety:
 *   - Single PM2 worker only (guarded at start in index.js).
 *   - Caps replies per cycle + small delays → respects Fanvue's 100 req/60s.
 *   - Everything wrapped in try/catch; never throws to the event loop.
 */
const { Creator } = require('../models');
const fanvue = require('./fanvue');
const aiChat = require('./aiChat');
const { mapFanvueHistory, asArray, pick, isFromCreator, msgUuid, msgTime } = require('./fanvueAi');

const INTERVAL_MS = 45_000;
const MAX_CHATS_PER_CYCLE = 25;
const MAX_REPLIES_PER_CYCLE = 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const newestMessage = (msgs) => {
  if (!msgs.length) return null;
  return [...msgs].sort((a, b) => msgTime(b) - msgTime(a))[0]; // newest by timestamp
};
const chatUuidOf = (c) =>
  pick(c.user || {}, 'uuid', 'id') || pick(c, 'counterpartUserUuid', 'userUuid', 'uuid', 'id');
// Real chat shape uses unreadMessagesCount + isRead.
const hasUnread = (c) => {
  const u = pick(c, 'unreadMessagesCount', 'unreadCount', 'unread');
  if (typeof u === 'number') return u > 0;
  const r = pick(c, 'isRead');
  if (typeof r === 'boolean') return !r;
  return null; // unknown → process anyway
};

async function processCreator(creator) {
  const creatorUuid = creator.fanvueUserUuid;
  const chats = asArray(await fanvue.fanvueFetch(creator, 'GET', '/chats')).slice(0, MAX_CHATS_PER_CYCLE);
  const seen = { ...(creator.fanvueAiSeen || {}) };
  let replies = 0;
  let changed = false;

  for (const c of chats) {
    if (replies >= MAX_REPLIES_PER_CYCLE) break;
    const chatUuid = chatUuidOf(c);
    if (!chatUuid) continue;

    await sleep(300);
    let msgs;
    try { msgs = asArray(await fanvue.fanvueFetch(creator, 'GET', `/chats/${chatUuid}/messages`)); }
    catch { continue; }

    const newest = newestMessage(msgs);
    if (!newest) continue;
    if (isFromCreator(newest, creatorUuid)) continue;  // last word is ours → nothing to answer
    const newestId = msgUuid(newest) || String(msgTime(newest));
    if (seen[chatUuid] === newestId) continue;          // already answered this one

    let text;
    try { text = await aiChat.generateFanvueReply({ creator, history: mapFanvueHistory(msgs, creatorUuid) }); }
    catch (e) { console.warn(`[fanvue-poll] gen fail chat=${chatUuid}: ${e.message}`); continue; }
    if (!text) { seen[chatUuid] = newestId; changed = true; continue; }

    try {
      await fanvue.fanvueFetch(creator, 'POST', `/chats/${chatUuid}/messages`, { text });
      seen[chatUuid] = newestId; changed = true; replies++;
      console.log(`[fanvue-poll] replied creator=${creator.id} chat=${chatUuid}`);
      await sleep(300);
    } catch (e) {
      console.warn(`[fanvue-poll] send fail chat=${chatUuid}: ${e.message}`);
    }
  }

  if (changed) await creator.update({ fanvueAiSeen: seen });
}

async function cycle() {
  let creators = [];
  try {
    creators = await Creator.findAll({ where: { fanvueConnected: true, fanvueAiAutoReply: true } });
  } catch (e) { console.warn('[fanvue-poll] query fail:', e.message); return; }
  if (creators.length) console.log(`[fanvue-poll] cycle — ${creators.length} creator(s)`);
  for (const creator of creators) {
    try { await processCreator(creator); }
    catch (e) { console.warn(`[fanvue-poll] creator=${creator.id} fail: ${e.message}`); }
  }
}

function start() {
  console.log('[fanvue-poll] auto-reply poller started');
  setInterval(() => { cycle().catch((e) => console.warn('[fanvue-poll] cycle error:', e.message)); }, INTERVAL_MS);
}

module.exports = { start, cycle };
