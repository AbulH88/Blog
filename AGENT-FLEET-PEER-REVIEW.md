# Peer Review Prompt — Agent Fleet Spec

> Paste everything below into a fresh ChatGPT (GPT-5) or Gemini 3 chat. Send.
> Compare its critique to what's in the spec. Where it pushes back hard or
> spots something we missed, bring back to me and we iterate.

---

I'm designing a multi-tenant agentic AI system that autonomously manages Fanvue creator accounts (Fanvue is an adult-creator platform like OnlyFans/Fansly). Each tenant is one creator account — the system handles posting, DM replies, mass campaigns, and PPV attachments on their behalf, in a per-creator persona voice.

**Context I'm bringing in:**
- We already have a working creator platform at `members.thecristinaadam.com` (Node/Express/Postgres + React + Fanvue MCP).
- Cristina's Fanvue account is live and verified working via the official Fanvue MCP server (`mcp__Fanvue__*` tools).
- An existing `services/fanvuePoller.js` does basic auto-reply for one creator; the new system generalizes + extends this.
- I have a separate (now-deleted) BOT-FLEET-PLAN that covered IG/TikTok automation for AI-generated character accounts; this Fanvue plan is the monetization counterpart.

**I need a tough peer review of the spec below.** Specifically grade these axes:

1. **Architecture soundness** — is the single-Node tick-loop model right, or should this be event-driven (queues, workers)?
2. **Security** — encrypted OAuth storage, kill-switch, audit log. Is anything missing? Realistic threat model for an adult platform.
3. **Multi-tenancy isolation** — could one creator's tokens/data leak to another's session? Where are the boundaries weak?
4. **LLM cost + latency** — is the "Sonnet for strategy + DeepSeek for replies + Sonnet vision for image describe" mix right? Anything cheaper/equivalent? Where am I over-paying?
5. **Approval UX** — Telegram-based approval for posts/mass DMs. Better patterns?
6. **Compliance** — adult content + content moderation + identity verification + data residency. Anything I'm ignoring?
7. **Scalability** — does this hold at 10 creators? 50? 200? Where do I hit a wall?
8. **Missing capabilities** — what would a senior staff eng add to the spec that I missed?
9. **Phase ordering** — Phase 0 → 1 → 2 → … is it optimal? Should Phase 2 come before Phase 1?
10. **Simpler alternatives** — is there a 30%-effort version that delivers 80% of the value?

Be brutal. I'd rather find problems on paper than at week 3 of implementation.

Output format I want:
- **🟢 Strengths** (3-5 bullets)
- **🔴 Critical concerns** (anything that's load-bearing wrong)
- **🟡 Smaller improvements** (per-axis above)
- **🟣 Alternative architecture** (if you'd build it materially differently)
- **A concrete revised Phase 0** spec if you'd start differently
- **Estimated implementation timeline** in your reckoning

---

## THE SPEC

# Agentic Fanvue Manager — Generic Multi-Tenant System

> **Goal:** A standalone service that runs N AI agents — one per Fanvue creator account — each with its own persona, content pipeline, posting schedule, and approval rules. Plug in any Fanvue OAuth account → get an autonomous content manager.

## 1. Vision

You give the system OAuth access to a Fanvue account + a persona prompt + a folder of content. It autonomously runs that account: writes captions, schedules posts, replies to DMs in the persona's voice, welcomes new subscribers, sends mass campaigns, attaches PPV at the right moments, tracks what's working. High-stakes actions (publishing, mass DMs) route to a Telegram approval queue you control from your phone. Replies and other "safe" actions execute autonomously. Works for **any number of creators** with isolated personas/schedules/content.

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Agent Fleet Service (separate VPS, single Node process + cron)  │
│                                                                   │
│  Postgres                                                         │
│    creators        per-account config (OAuth, persona…)           │
│    actions         audit log of every agent decision              │
│    content_queue   image library per creator                      │
│    approvals       pending approvals + telegram state             │
│                                                                   │
│  Tick loop (every 15 min)                                         │
│    for each active creator:                                       │
│      1. Load context (recent activity, queue, stats)              │
│      2. LLM decides next action                                   │
│      3. Validate against creator's rules + limits                 │
│      4. If high-stakes → Telegram approval queue                  │
│         Else → execute via Fanvue MCP                             │
│      5. Log to actions table                                      │
│                                                                   │
│              Fanvue MCP per creator (scoped OAuth token)          │
│                                                                   │
│  Telegram bot handler (single bot, fleet-wide)                    │
│      - delivers approval cards                                    │
│      - listens for Approve/Reject/Edit buttons                    │
│      - routes back to the originating creator's queue             │
└──────────────────────────────────────────────────────────────────┘
```

## 3. Data model

### `creators`
- id, slug, display_name, active, paused_until
- AUTH: fv_access_token, fv_refresh_token (encrypted), fv_expires_at, fv_user_uuid, fv_handle, fv_scopes
- PERSONA: persona_prompt (1k-10k chars), ai_model_reply (default `deepseek/deepseek-v4-flash`), ai_model_caption (`claude-haiku-4.5`), ai_model_vision (`claude-sonnet-4.6`), voice (JSONB)
- SCHEDULE: posts_per_day, posting_hours INT[], timezone, reply_poll_minutes, tick_minutes
- CONTENT SOURCE: content_folder_path, content_pick_mode (oldest_first | ai_curated | random)
- APPROVAL ROUTING: telegram_chat_id, auto_approve_replies (default true), auto_approve_posts (default false), auto_approve_mass_dm (default false), ppv_auto_cap_cents (default $10)
- LIMITS: max_dms_per_hour, max_posts_per_day, max_mass_dm_per_week, ppv_attach_ratio
- DEFAULTS: default_audience

### `actions` (audit log)
- creator_id, type (post/dm/mass_dm/reply/pin/wait), status (pending/approved/rejected/executed/failed)
- decided_by (agent/human), llm_model, reasoning, context_snapshot (JSONB), params (JSONB)
- approval_requested_at, approved_at, approved_via, executed_at, execution_result
- fan_uuid (nullable), outcome_metrics (filled async with likes/tips/replies)

### `content_queue`
- creator_id, file_path, file_size, file_hash (unique, dedupe), ai_description, tags VARCHAR[]
- status (queued/scheduled/posted/skipped), fanvue_media_uuid, fanvue_post_uuid, posted_at

## 4. The agent tick loop

```typescript
async function tick(creator) {
  // 1. CONTEXT
  const ctx = {
    persona, voice, schedule, limits,
    state: {
      hours_since_last_post,
      pending_dms,              // unanswered chats, limit=10
      new_subscribers,          // since last_tick
      queue_size,
      pending_approvals,
      stats_24h,                // posts, replies, likes, tips, DMs
    },
    recent_actions,             // limit=20
  };

  // 2. DECIDE — single Claude Sonnet call with structured tools
  const decision = await llm({
    model: 'anthropic/claude-sonnet-4.6',
    system: AGENT_SYSTEM_PROMPT,
    user: JSON.stringify(ctx),
    tools: TOOL_SCHEMAS,
  });
  // → { action, params, reasoning, confidence }

  // 3. VALIDATE — server-side guardrails
  const err = validate(creator, decision);
  if (err) return audit(creator, decision, 'rejected_validation', err);

  // 4. APPROVAL GATE
  if (needsApproval(creator, decision)) {
    await postToTelegram(creator, decision);
    return audit(creator, decision, 'pending_approval');
  }

  // 5. EXECUTE via Fanvue MCP
  const result = await execute(creator, decision);
  audit(creator, decision, 'executed', result);
}

// Master scheduler — every 15 min over all active creators
// Separate fast loop for reply polling (every 1-2 min per creator)
```

### Tool palette
| Tool | Maps to | Approval default |
|---|---|---|
| `wait(minutes)` | (no-op) | auto |
| `reply_chat(chatUuid, text, attachMediaUuid?)` | `send-message` | auto |
| `send_welcome_dm(fanUuid)` | `create-chat` + `send-message` | auto |
| `post_content(mediaUuids[], caption, audience, price?)` | upload + `create-post` | **Telegram** |
| `mass_message(text, audience, attachMediaUuid?)` | `send-mass-message` | **Telegram** |
| `pin_post(uuid)` | `pin-post` | auto |
| `attach_ppv_to_chat(chatUuid, mediaUuid, price)` | `send-message` w/ media | auto if price ≤ cap else Telegram |

## 5. Telegram approval flow
Approval card with [Approve / Reject / Edit caption / Pause creator 24h] buttons. Edit-caption replies are next-message-becomes-caption.

## 6. Content pipeline
Per tick (or every 5 min) per creator: scan `content_folder_path`, dedupe via file_hash, run vision model on new files (`"Describe in 2 sentences for a Fanvue creator's content manager"`), auto-tag. Selection: LLM picks next image considering variety, recency, time-of-day, past performance. Post-execution: mark `status='posted'`.

## 7. Safety rails
| Rail | Default | Purpose |
|---|---|---|
| `active = false` | per creator | Hard pause |
| `paused_until` | per creator | Vacation |
| `AGENT_FLEET_KILL=1` env | fleet | Emergency kill |
| `max_*` limits | per creator | Rate limits |
| `auto_approve_*` flags | per creator | OFF for posts + mass DMs by default |
| `ppv_auto_cap_cents` | $10 | Auto-attach PPV ≤ this; above → Telegram |
| Audit log | always | Every decision recoverable + reviewable |
| OAuth refresh failure → Telegram alert + pause creator | always | Token expiry safety |

## 8. Phased rollout

- **Phase 0 — Foundation (3-4 days):** New repo, Postgres schema, encrypted credentials (libsodium), Fanvue client w/ token refresh, Telegram bot, web admin (add/edit creator), tick scheduler skeleton. Deploy on a $7/mo VPS.
- **Phase 1 — Auto-reply (2 days):** Port `fanvuePoller` logic per-creator, fast loop (1-2min), auto-execute replies, PPV cap for auto-attach.
- **Phase 2 — Auto-posting (3-4 days):** Content queue scanner, vision describer, auto-tagger, LLM picks image, caption generator, Telegram preview-approve.
- **Phase 3 — Engagement (2 days):** Welcome DMs, mass campaigns, lapsed-fan re-engagement.
- **Phase 4 — Analytics + tuning (2-3 days):** Per-post tracking, weekly Telegram digest, posting-hour optimization, caption A/B test.
- **Phase 5 — Multi-creator UX (1-2 days):** Import wizard, persona templates, fleet dashboard.

**Total: ~3 weeks. Phase 0+1 is a usable MVP in 5-6 days.**

## 9. Tech stack
- Node.js 24 · Postgres 16 · OpenRouter (Claude Sonnet 4.6 for strategy + vision, DeepSeek V4 Flash for replies/captions, Claude Haiku 4.5 for intent classification)
- Fanvue MCP (verified) · Telegram bot · libsodium per-row encryption · PM2 · separate $7/mo VPS

## 10. Open decisions
1. Telegram bot — single fleet-wide vs per-creator? (lean: single)
2. Where to add new creators? (lean: web admin on subdomain)
3. Content folder sync? (lean: rsync for MVP, S3/R2 at scale)
4. Persona prompts in DB? (lean: yes, editable via admin)
5. Vision model? (lean: Claude Sonnet 4.6 — uncensored enough for the use case)

## 11. Reused from existing platform
Persona prompts (Cristina's 5,137-char prompt is the seed), `aiChat.js` patterns, `intentClassifier.js`, `telegram.js`, deploy.sh patterns.

## 12. Cost estimate (3 creators, steady state)
- VPS: $7/mo
- OpenRouter:
  - Replies (DeepSeek, ~1000/day across 3): $5-10
  - Strategy + captions (Sonnet, ~50/day): $3-5
  - Vision (Sonnet, ~30 new images/day): $3-5
- Postgres: $0-15
- **Total: $20-50/mo per 3 creators. ~Linear scaling.**

---

## END OF SPEC. Your critique below ↓
