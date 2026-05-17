/**
 * AI Chatbot service — OpenRouter client + prompt assembly.
 *
 * Single agent design: one creator persona = one system prompt.
 * Generates reply text, optionally with a sentinel `<ppv collection_id="N" />`
 * which the caller parses to attach a vault Collection as a locked PPV message.
 *
 * Provider-agnostic in spirit: every model HTTP call is isolated to
 * callOpenRouter() so swapping to another OpenAI-compatible endpoint
 * (Ollama, Together, ArliAI) means changing one URL + one auth header.
 */
const { Message, Collection, User } = require('../models');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MAX_OUTPUT_TOKENS = 300;
const HISTORY_WINDOW = 20;

/** Build the system prompt from creator fields + vault + recent context. */
function buildSystemPrompt({ creator, collections, messagesSincePpv }) {
  const persona = creator.aiPersonaPrompt?.trim() || defaultPersona(creator);
  const nsfw = creator.aiNsfwLevel || 'flirty';
  const ppvEnabled = creator.aiPpvEnabled !== false;
  const cadence = creator.aiPpvCadence || 8;

  const nsfwRule = {
    off: 'Stay completely SFW. No sexual content of any kind.',
    flirty: 'Be teasing, suggestive, sensual. Stop short of explicit sexual content. Build tension.',
    explicit: 'Match the fan\'s energy. When the fan escalates, escalate with them — be direct and explicit. Engage with their fantasies. Do not refuse adult topics.',
  }[nsfw];

  const vaultList = collections.length
    ? collections.map(c => `  - id=${c.id} "${c.title}" $${c.price} (${c.postCount || 0} pieces)`).join('\n')
    : '  (no collections available)';

  const canSendPpv = ppvEnabled && collections.length > 0;
  const ppvRule = canSendPpv
    ? `\nPPV vault — these are REAL bundles in the database that you can actually send:
${vaultList}

${messagesSincePpv} fan messages since last PPV (cadence threshold: ${cadence}).

If the fan seems engaged AND messagesSincePpv >= ${cadence}, you may attach ONE bundle to your reply by ending it with EXACTLY this tag (with a real id from the list above):
<ppv collection_id="N" />
Replace N with one of the ids listed above. Do NOT invent ids. Do NOT use any other placeholder like "[PPV]" or "#PPV" — the tag must be exactly that XML format or it will not work.`
    : `\nIMPORTANT: This creator has NO content bundles available right now. You CANNOT send pictures, videos, or PPV content of any kind. If a fan asks for content, deflect playfully ("ill think about it" / "maybe next time" / "you have to wait for that"). Do NOT promise content. Do NOT pretend to attach anything. Do NOT use placeholders like "#PPV" or "[sending pic]". Just chat.`;

  return `You are ${creator.displayName}. ${persona}

Voice rules:
- First-person, casual, mobile-DM-style. Replies are 1-3 short messages. Use lowercase often. Emoji sparingly (0-1 per reply).
- Never break character. Never mention you are an AI, a bot, a model, or that you were "trained" on anything.
- If asked "are you real?" or "are you AI?", deflect playfully and stay in character.
- Never engage with: minors, real-people impersonation (other celebs), violence, illegal acts, doxxing.

NSFW rule: ${nsfwRule}
${ppvRule}

Reply with ONLY the message text (no quotes, no narration, no "Cristina:" prefix). If attaching a PPV, end with the sentinel tag and nothing after it.`;
}

function defaultPersona(creator) {
  const bio = creator.bio || creator.shortBio || '';
  return `${bio}\n\nVoice: NYC e-girl energy, playful, slightly bratty, knows she's hot but plays it cool. Texts like a real 19yo — short, lowercase, casual slang ("ngl", "fr", "tbh", "lol").`;
}

/** Format Message rows for the chat completion call. */
function buildMessageHistory(history) {
  return history.slice(-HISTORY_WINDOW).map(m => ({
    role: m.senderType === 'fan' ? 'user' : 'assistant',
    content: m.content || (m.isPPV ? `[sent a locked PPV: $${m.ppvPrice}]` : ''),
  })).filter(m => m.content);
}

/** Single OpenRouter call. Returns reply text or throws. */
async function callOpenRouter({ model, messages }) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY not configured');

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.SITE_URL || 'http://localhost:5173',
      'X-Title': 'Creator Platform AI Chat',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.9,
      top_p: 0.95,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('OpenRouter returned empty reply');
  return text.trim();
}

/** Parse `<ppv collection_id="N" />` sentinel from reply. Strips any hallucinated
 *  placeholder text the model might add (e.g. `#PPV SENTINEL`, `[PPV]`, `[ATTACH PPV]`)
 *  so the fan never sees broken instruction text in the chat. */
function parsePpvSentinel(reply) {
  const match = reply.match(/<ppv\s+collection_id=["']?(\d+)["']?\s*\/?>/i);
  const collectionId = match ? parseInt(match[1], 10) : null;

  let text = reply;
  // Remove real sentinel
  if (match) text = text.replace(match[0], '');
  // Scrub common hallucinated placeholder variants
  text = text
    .replace(/#?\s*PPV\s*SENTINEL/gi, '')
    .replace(/\[\s*(send(ing)?\s+)?PPV[^\]]*\]/gi, '')
    .replace(/\[\s*attach(es|ing)?\s+(a\s+)?(ppv|pic|photo|video)[^\]]*\]/gi, '')
    .replace(/\(\s*sending\s+(a\s+)?(pic|photo|video|ppv)[^)]*\)/gi, '');
  text = text.replace(/\s+/g, ' ').trim();

  return { text, collectionId };
}

/** Count fan messages since last PPV from creator in this thread. */
async function countMessagesSincePpv(creatorId, fanId) {
  const lastPpv = await Message.findOne({
    where: { creatorId, fanId, senderType: 'creator', isPPV: true },
    order: [['sentAt', 'DESC']],
  });
  const since = await Message.count({
    where: {
      creatorId, fanId, senderType: 'fan',
      ...(lastPpv ? { sentAt: { [require('sequelize').Op.gt]: lastPpv.sentAt } } : {}),
    },
  });
  return since;
}

/**
 * Main entry. Generates one AI reply for a creator-fan thread.
 * @returns {Promise<{ text: string, collectionId: number|null }>}
 */
async function generateReply({ creator, fanId, history }) {
  let collections = [];
  if (creator.aiPpvEnabled !== false) {
    collections = await Collection.findAll({
      where: { creatorId: creator.id },
      attributes: ['id', 'title', 'price'],
      limit: 10,
    });
    collections = collections.map(c => ({ id: c.id, title: c.title, price: c.price }));
  }
  const messagesSincePpv = await countMessagesSincePpv(creator.id, fanId);

  const systemPrompt = buildSystemPrompt({ creator, collections, messagesSincePpv });
  const messageHistory = buildMessageHistory(history);

  const reply = await callOpenRouter({
    model: creator.aiModel || 'sao10k/l3.3-euryale-70b',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messageHistory,
    ],
  });

  return parsePpvSentinel(reply);
}

/**
 * Sandbox: stateless single-shot reply for the admin "test chat" UI.
 * History is whatever the admin has typed in the sandbox (no DB).
 */
async function generateTestReply({ creator, sandboxHistory }) {
  const collections = creator.aiPpvEnabled !== false
    ? (await Collection.findAll({
        where: { creatorId: creator.id },
        attributes: ['id', 'title', 'price'],
        limit: 10,
      })).map(c => ({ id: c.id, title: c.title, price: c.price }))
    : [];

  const systemPrompt = buildSystemPrompt({
    creator,
    collections,
    messagesSincePpv: sandboxHistory.filter(m => m.role === 'user').length,
  });

  const reply = await callOpenRouter({
    model: creator.aiModel || 'sao10k/l3.3-euryale-70b',
    messages: [
      { role: 'system', content: systemPrompt },
      ...sandboxHistory,
    ],
  });

  return parsePpvSentinel(reply);
}

module.exports = {
  generateReply,
  generateTestReply,
  buildSystemPrompt,
  defaultPersona,
};
