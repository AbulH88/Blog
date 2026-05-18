/**
 * Intent classifier — the "vibe reader" pre-step before generating Cristina's reply.
 *
 * Two outputs:
 *   - allowPpv: hard yes/no gate for whether the main AI may attach a bundle
 *   - guidance: a short response-style hint passed into the system prompt so
 *               replies match the situation (greeting vs. compliment vs. tip)
 *
 * Falls back to safe defaults on any failure (no pitch, neutral guidance).
 * Costs ~$0.0001 per classification with Haiku 4.5.
 */

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const CLASSIFIER_MODEL = process.env.AI_CLASSIFIER_MODEL || 'anthropic/claude-haiku-4.5';

/**
 * Intent registry — single source of truth.
 * Each intent has:
 *   - allowPpv: may the main AI attach a PPV bundle this turn?
 *   - guidance: a one-line behavior hint injected into the main system prompt.
 *   - description: what this label covers (used in the classifier system prompt).
 */
const INTENT_TABLE = {
  WANTS_CONTENT: {
    allowPpv: true,
    guidance: 'Fan explicitly wants to see content. If a fitting bundle exists, you may attach one. Otherwise tease and promise something later.',
    description: 'Fan explicitly asked to see content: "show me", "send a pic", "what are you wearing", "can I see", "got any photos", "more please".',
  },
  ESCALATION: {
    allowPpv: true,
    guidance: 'Fan is escalating sexually or building a fantasy. Match their energy, engage with the scenario, and you may attach ONE fitting bundle.',
    description: 'Fan is escalating sexually or building fantasy: explicit talk, role-play opening, "what would you do", suggestive scenarios.',
  },
  PRICING_QUESTION: {
    allowPpv: true,
    guidance: 'Fan is asking about price or value — they are ready to buy. Be confident and direct: name one bundle with its price. Do not be coy.',
    description: 'Fan asked about pricing, cost, discount, or value: "how much", "what does it cost", "any deals", "what do you charge".',
  },
  CUSTOM_REQUEST: {
    allowPpv: false,
    guidance: 'Fan is asking for a custom video/photo. Do NOT promise anything. Say you have to think about it or check your schedule — the creator will reach out personally.',
    description: 'Fan asked for a CUSTOM piece of content (made for them specifically): "can you make me", "custom video for me", "would you do X for me".',
  },
  GREETING: {
    allowPpv: false,
    guidance: 'Fan just said hi or opened the chat. Reply warmly, casually, and ask ONE light question to keep the conversation going. Do NOT pitch.',
    description: 'Fan is opening the conversation or returning: "hi", "hey babe", "you up?", "good morning", "long time no talk".',
  },
  GOODBYE: {
    allowPpv: false,
    guidance: 'Fan is wrapping up. Say bye warmly, leave the door open ("text me later 💋"). Do NOT pitch — that feels desperate.',
    description: 'Fan is ending the conversation: "gotta go", "talk later", "ttyl", "bye", "off to bed".',
  },
  COMPLIMENT: {
    allowPpv: false,
    guidance: 'Fan is complimenting you. Accept it playfully ("aww thx baby 🥺", "you\'re sweet"). Do NOT pitch — it would feel transactional.',
    description: 'Fan complimented your looks or personality: "you\'re hot", "beautiful", "cute", "love your vibe".',
  },
  POST_PURCHASE_REACTION: {
    allowPpv: false,
    guidance: 'Fan just unlocked content and is reacting. Show appreciation, react to their reaction, build connection. Do NOT pitch another bundle this turn.',
    description: 'Fan is reacting to content they just unlocked: "loved it", "wow", "amazing", "more like that", reacting to your last PPV.',
  },
  TIP_OFFER: {
    allowPpv: false,
    guidance: 'Fan offered a tip or just tipped. Give a warm, slightly extra thank-you. Do NOT immediately pitch a bundle — it looks greedy.',
    description: 'Fan offered or mentioned a tip: "here\'s a tip", "tipping you", "you deserve it", "buying you coffee".',
  },
  BOUNDARY_VIOLATION: {
    allowPpv: false,
    guidance: 'Fan crossed a hard line (minors, real-people impersonation, violence, illegal acts). Decline firmly but stay in character. Change subject.',
    description: 'Fan said something violating hard limits: anything involving minors, illegal acts, doxxing real people, violence, or impersonation of other real celebs.',
  },
  CHITCHAT: {
    allowPpv: false,
    guidance: 'Normal conversation — chat naturally, ask questions back, build connection. Do NOT pitch.',
    description: 'General conversation, small talk, getting to know each other, asking about her day/life, off-topic chat.',
  },
  COLD: {
    allowPpv: false,
    guidance: 'Fan is disengaged or one-word. Try ONE engaging hook (a teasing question, something curious) — but if they stay cold, let them go.',
    description: 'Fan is short, disengaged, or testing: "k", "lol", "ok", "...", one-word replies, hostility.',
  },
};

const INTENT_LABELS = Object.keys(INTENT_TABLE);

const SYSTEM_PROMPT = `You are an intent classifier for an AI-companion chat platform.
Read the fan's most recent message in context and pick EXACTLY ONE label.

Labels:
${INTENT_LABELS.map(l => `- ${l} — ${INTENT_TABLE[l].description}`).join('\n')}

Rules:
- Pick the label that BEST fits the fan's LATEST message (use context only to disambiguate).
- When in doubt between a "pitch-allowed" label (WANTS_CONTENT, ESCALATION, PRICING_QUESTION) and a "pitch-not-allowed" one, pick the safer pitch-not-allowed label. Be conservative.
- Output a single-line JSON object only — no markdown, no commentary:
{"intent":"<LABEL>","reasoning":"<one short sentence>"}`;

function getGuidance(intent) {
  return INTENT_TABLE[intent]?.guidance || INTENT_TABLE.CHITCHAT.guidance;
}

function allowPpvFor(intent) {
  return INTENT_TABLE[intent]?.allowPpv === true;
}

/**
 * Classify the intent of the fan's most recent message.
 * @returns {Promise<{intent:string, allowPpv:boolean, guidance:string, reasoning:string}>}
 */
async function classifyIntent({ fanMessage, recentHistory = [] }) {
  const safeDefault = (reason) => ({
    intent: 'CHITCHAT',
    allowPpv: false,
    guidance: getGuidance('CHITCHAT'),
    reasoning: reason,
  });

  const key = process.env.OPENROUTER_API_KEY;
  if (!key || !fanMessage) return safeDefault('no key or empty msg');

  const contextLines = recentHistory.slice(-6).map(m =>
    `${m.role === 'user' ? 'FAN' : 'CRISTINA'}: ${m.content}`
  );
  const userPrompt = `Recent conversation:
${contextLines.join('\n') || '(no prior turns)'}

Fan's latest message to classify:
"${fanMessage}"

Classify and respond with the JSON object only.`;

  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:5173',
        'X-Title': 'Creator Platform Intent Classifier',
      },
      body: JSON.stringify({
        model: CLASSIFIER_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 80,
        temperature: 0.1,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn(`[intent] classifier ${res.status}: ${errText.slice(0, 150)}`);
      return safeDefault('classifier http error');
    }

    const data = await res.json();
    const raw = (data.choices?.[0]?.message?.content || '').trim();
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.warn(`[intent] could not parse JSON from: ${raw.slice(0, 100)}`);
      return safeDefault('parse fail');
    }

    const parsed = JSON.parse(match[0]);
    const intent = INTENT_LABELS.includes(parsed.intent) ? parsed.intent : 'CHITCHAT';
    return {
      intent,
      allowPpv: allowPpvFor(intent),
      guidance: getGuidance(intent),
      reasoning: String(parsed.reasoning || '').slice(0, 200),
    };
  } catch (err) {
    console.warn(`[intent] exception:`, err.message);
    return safeDefault('exception');
  }
}

module.exports = {
  classifyIntent,
  getGuidance,
  allowPpvFor,
  INTENT_LABELS,
  INTENT_TABLE,
};
