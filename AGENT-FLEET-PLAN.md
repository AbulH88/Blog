# Agentic Fanvue Manager — Complete Multi-Tenant Plan

> **Status:** Spec v2 — not yet built
> **Codename:** `agent-fleet`
> **Goal:** A standalone service that runs N AI agents — one per Fanvue creator account — each with its own persona, content pipeline, posting schedule, and approval rules. Plug in any Fanvue OAuth account → get an autonomous content manager.

---

## Table of contents

1. [Vision](#1-vision)
2. [Architecture](#2-architecture)
3. [Data model](#3-data-model)
4. [The agent tick loop](#4-the-agent-tick-loop)
5. [Telegram approval flow](#5-telegram-approval-flow)
6. [Content pipeline](#6-content-pipeline)
7. [Safety rails](#7-safety-rails)
8. [Phased rollout](#8-phased-rollout)
9. [Tech stack](#9-tech-stack)
10. [Open decisions](#10-open-decisions)
11. [Reused vs new](#11-reused-vs-new)
12. [Cost estimate](#12-cost-estimate)
13. [Agent system prompt (master)](#13-agent-system-prompt-master)
14. [Onboarding a new creator](#14-onboarding-a-new-creator)
15. [Fanvue access — REST API, not MCP](#15-fanvue-access--rest-api-not-mcp)
16. [Token lifecycle + refresh](#16-token-lifecycle--refresh)
17. [Concurrency + locking](#17-concurrency--locking)
18. [Error handling + retries](#18-error-handling--retries)
19. [Observability](#19-observability)
20. [Failure runbook](#20-failure-runbook)
21. [Admin UI specification](#21-admin-ui-specification)
22. [Testing strategy](#22-testing-strategy)
23. [Deployment + CI](#23-deployment--ci)
24. [Backup + disaster recovery](#24-backup--disaster-recovery)
25. [Conflict resolution (human ↔ agent)](#25-conflict-resolution-human--agent)
26. [Persona prompt versioning](#26-persona-prompt-versioning)
27. [Webhook integration](#27-webhook-integration)
28. [Compliance + content safety](#28-compliance--content-safety)

---

## 1. Vision

You give the system OAuth access to a Fanvue account + a persona prompt + a folder of content. It autonomously runs that account: writes captions, schedules posts, replies to DMs in the persona's voice, welcomes new subscribers, sends mass campaigns, attaches PPV at the right moments, tracks what's working. High-stakes actions (publishing, mass DMs) route to a Telegram approval queue you control from your phone. Replies and other "safe" actions execute autonomously. Works for **any number of creators** with isolated personas/schedules/content.

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  Agent Fleet Service (separate VPS, single Node process)         │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Postgres                                                  │    │
│  │   - creators           per-account config (OAuth, persona)│    │
│  │   - actions            audit log of every decision        │    │
│  │   - content_queue      image library per creator          │    │
│  │   - approvals          pending Telegram approvals         │    │
│  │   - cursors            last-seen markers per creator      │    │
│  │   - persona_versions   git-like history of prompt changes │    │
│  │   - metrics_daily      rolled-up performance per creator  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌────────────────────────┐  ┌──────────────────────────────┐   │
│  │ Strategy tick (15 min) │  │ Reply poll (1-2 min)          │   │
│  │  LLM decides actions   │  │  Pure auto-reply path         │   │
│  │  posts/campaigns/etc.  │  │  Same as fanvuePoller today   │   │
│  └────────────────────────┘  └──────────────────────────────┘   │
│                            │                                      │
│                            ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Fanvue API client (per-creator OAuth, REST)              │    │
│  │   - bearer token cache + auto-refresh                    │    │
│  │   - rate limit aware (100 req / 60s)                     │    │
│  │   - structured error responses                           │    │
│  └──────────────────────────────────────────────────────────┘    │
│                            │                                      │
│                            ▼                                      │
│              api.fanvue.com  (NOT mcp.fanvue.com — see §15)       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Telegram bot (single, fleet-wide)                        │    │
│  │   - delivers approval cards                              │    │
│  │   - listens for callback queries                         │    │
│  │   - routes by callback_data: action_id                   │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │ Admin UI (Express + minimal React, same domain)          │    │
│  │   - login (single master credential)                     │    │
│  │   - creator list / add / edit / pause                    │    │
│  │   - persona editor with version history                  │    │
│  │   - action timeline + filters                            │    │
│  │   - manual-action panel (override agent)                 │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

**Why separate VPS:** isolates a misbehaving agent from the main `thecristinaadam.com` platform reputation. $7/mo. Same reasoning as the original BOT-FLEET-PLAN.

---

## 3. Data model

### `creators`
```sql
CREATE TABLE creators (
  id              SERIAL PRIMARY KEY,
  slug            VARCHAR UNIQUE NOT NULL,    -- 'cristina', 'aria'
  display_name    VARCHAR NOT NULL,
  active          BOOLEAN DEFAULT TRUE,        -- kill switch (per creator)
  paused_until    TIMESTAMP,                   -- vacation mode

  -- AUTH (Fanvue OAuth) — fv_access_token + fv_refresh_token encrypted via pgcrypto
  fv_access_token       BYTEA,                 -- pgp_sym_encrypt(token, key)
  fv_refresh_token      BYTEA,
  fv_expires_at         TIMESTAMP,
  fv_last_refreshed_at  TIMESTAMP,
  fv_refresh_failure_count INT DEFAULT 0,
  fv_user_uuid          VARCHAR,
  fv_handle             VARCHAR,
  fv_scopes             TEXT,
  fv_client_id          VARCHAR,
  fv_client_secret_enc  BYTEA,

  -- PERSONA
  persona_version_id    INT,                   -- FK to persona_versions
  ai_model_reply        VARCHAR DEFAULT 'deepseek/deepseek-v4-flash',
  ai_model_caption      VARCHAR DEFAULT 'anthropic/claude-haiku-4.5',
  ai_model_strategy     VARCHAR DEFAULT 'anthropic/claude-sonnet-4.6',
  ai_model_vision       VARCHAR DEFAULT 'anthropic/claude-sonnet-4.6',
  voice                 JSONB,                 -- { lowercase, emoji_rate, slang_set }

  -- SCHEDULE
  posts_per_day         INT  DEFAULT 2,
  posting_hours         INT[] DEFAULT '{10,18}'::INT[],   -- creator's TZ
  timezone              VARCHAR DEFAULT 'America/New_York',
  reply_poll_minutes    INT  DEFAULT 1,
  tick_minutes          INT  DEFAULT 15,

  -- CONTENT SOURCE
  content_folder_path   VARCHAR,
  content_pick_mode     VARCHAR DEFAULT 'ai_curated',   -- ai_curated | oldest_first | random

  -- APPROVAL ROUTING
  telegram_chat_id      VARCHAR,
  auto_approve_replies  BOOLEAN DEFAULT TRUE,
  auto_approve_posts    BOOLEAN DEFAULT FALSE,
  auto_approve_mass_dm  BOOLEAN DEFAULT FALSE,
  ppv_auto_cap_cents    INT     DEFAULT 1000,

  -- LIMITS
  max_dms_per_hour      INT DEFAULT 30,
  max_posts_per_day     INT DEFAULT 3,
  max_mass_dm_per_week  INT DEFAULT 2,
  ppv_attach_ratio      REAL DEFAULT 0.15,

  -- DEFAULTS
  default_audience      VARCHAR DEFAULT 'subscribers',

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### `actions`
```sql
CREATE TABLE actions (
  id                SERIAL PRIMARY KEY,
  creator_id        INT REFERENCES creators(id) ON DELETE CASCADE,
  type              VARCHAR NOT NULL,   -- post | dm | mass_dm | reply | pin | welcome | wait | analyze
  status            VARCHAR DEFAULT 'pending',  -- pending | approved | rejected | executing | executed | failed | superseded
  decided_by        VARCHAR DEFAULT 'agent',    -- agent | human

  llm_model         VARCHAR,
  reasoning         TEXT,
  context_snapshot  JSONB,
  params            JSONB,
  retry_count       INT DEFAULT 0,
  next_retry_at     TIMESTAMP,

  approval_requested_at TIMESTAMP,
  approval_message_id   VARCHAR,        -- Telegram message id for editing
  approved_at           TIMESTAMP,
  approved_via          VARCHAR,        -- telegram | web | auto
  approval_edits        JSONB,          -- {original_caption, edited_caption}
  executed_at           TIMESTAMP,
  execution_result      JSONB,
  error_message         TEXT,

  fan_uuid          VARCHAR,
  outcome_metrics   JSONB,              -- filled async: likes/tips/replies

  decided_at        TIMESTAMP DEFAULT NOW()
);
CREATE INDEX ON actions (creator_id, decided_at DESC);
CREATE INDEX ON actions (status) WHERE status IN ('pending', 'executing');
CREATE INDEX ON actions (next_retry_at) WHERE status = 'failed' AND next_retry_at IS NOT NULL;
```

### `content_queue`
```sql
CREATE TABLE content_queue (
  id                  SERIAL PRIMARY KEY,
  creator_id          INT REFERENCES creators(id) ON DELETE CASCADE,
  file_path           VARCHAR NOT NULL,
  file_size           BIGINT,
  file_hash           VARCHAR,
  mime_type           VARCHAR,
  ai_description      TEXT,
  ai_safety_flags     VARCHAR[],         -- ['ok', 'face_visible', 'nsfw_level_2', …]
  tags                VARCHAR[],
  vibe                VARCHAR,           -- soft | flirty | spicy | hard
  status              VARCHAR DEFAULT 'queued',  -- queued | described | scheduled | posted | skipped | failed
  fanvue_media_uuid   VARCHAR,
  fanvue_post_uuid    VARCHAR,
  posted_at           TIMESTAMP,
  created_at          TIMESTAMP DEFAULT NOW(),
  UNIQUE (creator_id, file_hash)
);
CREATE INDEX ON content_queue (creator_id, status, created_at);
```

### `cursors`
```sql
-- Last-seen markers so the agent doesn't re-process the same chat/sub/notification.
CREATE TABLE cursors (
  creator_id        INT REFERENCES creators(id) ON DELETE CASCADE,
  cursor_type       VARCHAR,            -- last_seen_chat_uuid | last_seen_subscriber_uuid | last_processed_notification_id
  cursor_value      VARCHAR,
  updated_at        TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (creator_id, cursor_type)
);
```

### `persona_versions`
```sql
CREATE TABLE persona_versions (
  id            SERIAL PRIMARY KEY,
  creator_id    INT REFERENCES creators(id) ON DELETE CASCADE,
  prompt        TEXT NOT NULL,
  voice         JSONB,
  notes         TEXT,                   -- "added Valorant references"
  is_current    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMP DEFAULT NOW()
);
CREATE INDEX ON persona_versions (creator_id, created_at DESC);
-- creators.persona_version_id → persona_versions.id (current pointer)
```

### `metrics_daily`
```sql
CREATE TABLE metrics_daily (
  creator_id        INT REFERENCES creators(id) ON DELETE CASCADE,
  day               DATE,
  posts             INT DEFAULT 0,
  dms_sent          INT DEFAULT 0,
  dms_received      INT DEFAULT 0,
  ppv_attached      INT DEFAULT 0,
  likes_received    INT DEFAULT 0,
  tips_received_cents INT DEFAULT 0,
  new_subscribers   INT DEFAULT 0,
  approval_pending  INT DEFAULT 0,
  approval_rejected INT DEFAULT 0,
  PRIMARY KEY (creator_id, day)
);
```

---

## 4. The agent tick loop

```typescript
async function tick(creator) {
  // 0. Concurrency lock — only one tick per creator at a time
  const lock = await acquireAdvisoryLock(creator.id);
  if (!lock) return;                     // another tick is running, skip
  try {
    // 1. CONTEXT
    const ctx = await assembleContext(creator);
    /*
      {
        persona_prompt, voice, schedule, limits,
        now_iso, creator_tz, hours_since_last_post,
        pending_dms: [{ chat_uuid, fan_handle, last_msg, last_msg_at }],
        new_subscribers: [{ uuid, handle, joined_at }],
        queue: {
          counts_by_tag: { lifestyle: 7, selfie: 12, lingerie: 4 },
          newest_n_descriptions: [{ id, description, tags, vibe, age_days }],
        },
        pending_approvals: count,
        recent_actions: [{ type, status, params_summary, decided_at, outcome }],
        stats_24h: { posts, dms_sent, likes, tips_cents, new_subs },
        stats_7d_per_action_type: { … },
      }
    */

    // 2. DECIDE
    const decision = await llm.strategy({
      model: creator.ai_model_strategy,
      system: AGENT_SYSTEM_PROMPT,         // see §13
      user: JSON.stringify(ctx),
      tools: TOOL_SCHEMAS,                 // function-call schemas
    });
    // → { action, params, reasoning, confidence }

    // 3. VALIDATE — server-side guardrails (LLM doesn't get the last word)
    const violations = validate(creator, decision);
    if (violations.length) {
      return audit(creator, decision, 'rejected_validation', { violations });
    }

    // 4. APPROVAL GATE
    if (needsApproval(creator, decision)) {
      const card = await postToTelegram(creator, decision);
      return audit(creator, decision, 'pending_approval', { telegram_message_id: card.id });
    }

    // 5. EXECUTE
    try {
      const result = await execute(creator, decision);   // see §15
      audit(creator, decision, 'executed', result);
      enqueueOutcomeMeasurement(creator, decision, result);  // poll likes/tips in 6h
    } catch (err) {
      await scheduleRetry(creator, decision, err);
      audit(creator, decision, 'failed', { error: err.message });
    }
  } finally {
    await releaseAdvisoryLock(creator.id);
  }
}

// Strategy loop (slow, every 15 min)
setInterval(tickAllCreators, 15 * 60 * 1000);

// Reply loop (fast, every 1-2 min) — narrower scope, only auto-reply
setInterval(replyPollAllCreators, 90 * 1000);
```

### Tool palette
| Tool | Maps to Fanvue REST | Approval default |
|---|---|---|
| `wait(minutes)` | (no-op) | auto |
| `reply_chat(chatUuid, text, attachMediaUuid?)` | `POST /chats/:uuid/messages` | auto (reply loop handles this) |
| `send_welcome_dm(fanUuid)` | `POST /chats` + `POST /chats/:uuid/messages` | auto |
| `post_content(mediaUuids[], caption, audience, price?)` | `POST /media/uploads` × N + S3 PUT + `PATCH /media/uploads/:id` + `POST /vault/folders/:n/media`? + `POST /posts` | **Telegram** |
| `mass_message(text, audience, attachMediaUuid?)` | `POST /mass-messages` | **Telegram** |
| `pin_post(uuid)` | `POST /posts/:uuid/pin` | auto |
| `attach_ppv_to_chat(chatUuid, mediaUuid, price)` | `POST /chats/:uuid/messages` with price | auto if `price ≤ ppv_auto_cap_cents` else Telegram |
| `analyze_performance()` | (read-only set of GETs + DB writes to metrics_daily) | auto |
| `tag_content(queueId, tags[], vibe)` | (local DB) | auto |
| `mark_consumed(queueId)` | (local DB) | auto |

---

## 5. Telegram approval flow

Single fleet-wide bot. Each approval card identifies the creator:

```
[🤖 cristina · @key-frog-167]
🆕 Post draft

caption: couldn't keep these to myself 🥹 just for my subs xx
audience: subscribers (free)
media: 5 images (lifestyle, selfie)

reasoning: 12h since last post; queue has 5 fresh ComfyUI images;
Sunday 10am EST is peak engagement based on 30d data.

[✓ Approve]  [✗ Reject]  [✎ Edit caption]  [⏸ Pause 24h]
```

- Callback data: `act:approve:<action_id>`, `act:reject:<action_id>`, `act:edit:<action_id>`, `creator:pause24:<creator_id>`
- Edit flow: bot replies "Send the new caption" → captures next user message → updates `actions.approval_edits` → re-renders the card → require explicit Approve.
- Expiry: pending approvals auto-reject after 4h (configurable per creator).

---

## 6. Content pipeline

### Ingestion (background scan every 5 min)
1. List files in `content_folder_path`
2. Dedupe by `(creator_id, file_hash)` — files already in `content_queue` are skipped
3. For each new file, enqueue with `status='queued'`
4. Async processor pulls `status='queued'` items:
   - Compute hash (SHA-256), file size, MIME type
   - Run vision describe — Claude Sonnet 4.6 prompt: *"Describe this image in 2 sentences for a Fanvue creator's content manager. Include vibe (soft/flirty/spicy/hard), lighting, outfit/setting, mood. Don't identify the person. If you cannot describe, return JSON `{ refused: true, reason: '...' }`."*
   - Derive 3-5 tags + a single `vibe` enum
   - Update row: `ai_description`, `tags`, `vibe`, `status='described'`
5. Refusals: `status='skipped'`, `ai_safety_flags=['refused', reason]`

### Selection at post time
Strategy LLM is given a compact summary of the queue (last 20 described items + counts by vibe). Asked to pick `K` images for one post + caption. Selection heuristics it should follow (in its system prompt):
- Variety: don't repeat the same vibe two posts in a row
- Recency: prefer items < 7 days old in queue
- Time-of-day fit: softer in morning, spicier at night
- Audience: subscribers default; PPV reserved for `vibe='spicy'` or `'hard'` based on creator's `ppv_attach_ratio`

After posting, update `status='posted'` + store `fanvue_post_uuid`.

---

## 7. Safety rails

| Rail | Default | Purpose |
|---|---|---|
| `active = false` | per creator | Hard pause |
| `paused_until` | per creator | Vacation |
| `AGENT_FLEET_KILL=1` env | fleet | Emergency kill |
| `max_dms_per_hour`, `max_posts_per_day`, `max_mass_dm_per_week` | per creator | Rate limits |
| `auto_approve_*` flags | per creator | OFF for posts + mass DMs by default |
| `ppv_auto_cap_cents` | $10 | Auto-attach PPV ≤ this; above → Telegram |
| `approval_expiry_minutes` | 240 (4h) | Pending → auto-reject |
| Validator (§4 step 3) | always | Rejects LLM decisions that violate limits or schema |
| Audit log | always | Every decision recoverable + reviewable |
| OAuth refresh failure → alert + pause | always | Token expired → Telegram alert, creator paused |
| Daily metrics anomaly alert | always | Tip volume drops > 50% vs 7d avg → Telegram alert |

---

## 8. Phased rollout

### Phase 0 — Foundation (3-4 days)
- New repo `agent-fleet/`
- Postgres schema (7 tables)
- Encrypted credential storage (pgcrypto + env-supplied key)
- Fanvue REST client (per-creator OAuth + auto-refresh + rate-limit retry)
- Telegram bot setup + webhook
- Web admin (single-page CRUD for creators + persona editor + action timeline)
- Tick scheduler skeleton (no LLM — picks `wait(5)` to verify wiring)
- Health check + structured logging
- Deploy on a $7/mo VPS

### Phase 1 — Auto-reply (2 days)
- Port `fanvuePoller.js` logic per-creator
- Reply loop (90 s)
- LLM tool: `reply_chat`
- PPV auto-attach below cap; above → Telegram

### Phase 2 — Auto-posting (3-4 days)
- Content queue ingestion + scanner
- Vision describer + tagger
- LLM-driven image selection
- Caption generator
- `post_content` tool with multipart S3 upload (the flow we already proved works)
- Telegram approval card (preview-and-approve)

### Phase 3 — Engagement (2 days)
- New-subscriber detector → welcome DM
- Mass-message scheduler (cron-style + LLM-suggested)
- Lapsed-fan re-engagement (no tip in 30d)

### Phase 4 — Analytics + self-tuning (2-3 days)
- Per-post outcome tracking (likes/tips/chat replies attributable)
- Weekly Telegram digest per creator
- Posting-hour optimization (move hours toward where tips concentrate)
- Caption A/B (variants stored, winning style boosted)

### Phase 5 — Multi-creator ergonomics (1-2 days)
- Creator import wizard (paste OAuth + persona + folder path)
- Persona templates ("Lifestyle creator", "Spicy creator", "Gaming creator")
- Fleet dashboard

**Total: ~3 weeks. Phase 0+1 is a usable MVP in 5-6 days.**

---

## 9. Tech stack

| Layer | Pick | Why |
|---|---|---|
| Language | **Node.js 24** | Matches existing platform; ops muscle |
| DB | **Postgres 16** | JSONB, pgcrypto, advisory locks |
| LLMs | **OpenRouter** (Claude Sonnet 4.6 for strategy/vision, DeepSeek V4 Flash for replies/captions, Claude Haiku 4.5 for intent) | Single billing, swap per-creator easily |
| Fanvue | **Fanvue REST API** directly (not MCP — see §15) | OAuth tokens already accepted; one less dependency |
| Approval | **Telegram bot** | You have telegram infra wired in main platform |
| Hosting | **Separate $7/mo VPS** | Isolation from cristinaadam.com reputation |
| Encryption | **pgcrypto** (`pgp_sym_encrypt`) | Native, simple, in-DB |
| Process | **PM2** (single instance, NOT cluster — locking is per-row, but avoiding cluster simplifies the strategy loop) | Same as main platform |
| Monitoring | **Sentry** + structured logs + `/health` endpoint | Cheap, sufficient |
| Admin UI | **Express + minimal React/Preact** (or even server-rendered EJS for v1) | One person uses it, optimise for simplicity |

---

## 10. Open decisions

1. **Telegram bot — single fleet-wide vs per-creator?**
   → **Single** (default). Approval cards self-identify with creator slug + handle.
2. **Where do new creators add themselves?**
   → **Web admin on a subdomain** (e.g., `fleet.thecristinaadam.com`). Master password login. Add/edit/pause creators, edit persona, view action timeline.
3. **Content folders — synced from where?**
   → MVP: **rsync** from dev PC to VPS folder. Scale: **S3/R2** bucket per creator with watcher.
4. **Persona prompts — where do they live?**
   → DB (`persona_versions` table, latest = current). Editable via admin. Diffable history (§26).
5. **Vision model — which one?**
   → **Claude Sonnet 4.6** — handles intimate imagery without refusal.
6. **NEW: MCP or direct API?** → **Direct REST API** (§15).
7. **NEW: Concurrency model?** → Single-instance Node + Postgres advisory locks per creator (§17).
8. **NEW: How does the agent reach old behaviour for back-compat?** → It doesn't. Existing `fanvuePoller.js` is read-only data only. New fleet owns all writes for migrated creators.

---

## 11. Reused vs new

### Reused from main platform
- Persona prompts (Cristina's 5,137-char prompt → seed import on Phase 0)
- AI chat patterns (`aiChat.js`, `intentClassifier.js`)
- Telegram service (`telegram.js`)
- Deploy script pattern (`deploy.sh`, post-merge hooks)
- Fanvue REST client (`services/fanvue.js`) — copy/port with multi-tenant tweaks

### New
- Multi-tenant agent loop
- Content queue + ingestion + vision describer
- LLM-driven strategy
- Telegram approval webhook + state machine
- Audit log + analytics
- Per-creator admin UI

---

## 12. Cost estimate (steady state, 3 creators)

| Item | Monthly |
|---|---|
| VPS | $7 |
| OpenRouter — replies (DeepSeek, ~1000/day × 3) | $5-10 |
| OpenRouter — strategy + captions (Sonnet, ~50/day) | $3-5 |
| OpenRouter — vision (Sonnet, ~30 new/day) | $3-5 |
| Postgres (same VPS for MVP) | $0 |
| Sentry (free tier) | $0 |
| **Total** | **$20-30 / mo / 3 creators** |

10 creators ≈ $50-100/mo. Linear-ish scaling. Trivial vs revenue.

---

## 13. Agent system prompt (master)

This is the literal prompt the strategy LLM gets every tick. Treat it as a contract: changes here ripple to every creator until persona overrides it.

```
You are an autonomous content manager for {{display_name}}, a Fanvue creator.

# Your job

Decide the ONE next action that best serves the creator's account right now.
Output a single JSON object matching the tool schema. Nothing else.

# The persona you're acting on behalf of

{{persona_prompt}}

# Voice settings

{{voice_json}}

# Schedule constraints

- Posts/day target: {{posts_per_day}}
- Posting hours (creator local): {{posting_hours}}
- Timezone: {{timezone}}
- Current local time: {{now_local}}

# Hard limits (you CANNOT exceed)

- DMs sent in the last hour: {{dms_sent_last_hour}} / {{max_dms_per_hour}}
- Posts today: {{posts_today}} / {{max_posts_per_day}}
- Mass DMs this week: {{mass_dm_this_week}} / {{max_mass_dm_per_week}}

If a limit is at or near the cap, choose `wait` or a non-quota action.

# Context

{{context_json}}      // pending_dms, new_subscribers, queue summary, recent_actions, stats_24h

# Tools

{{tool_schemas}}

# Decision rules (in priority order)

1. If new_subscribers has unsent welcomes → `send_welcome_dm`
2. If pending_dms older than 30 min → `reply_chat` (one per tick to spread DMs)
3. If `hours_since_last_post` > expected_gap AND queue has fresh items AND current hour ∈ posting_hours → `post_content`
4. If it's a campaign moment (specific day-of-week + first time today) → `mass_message`
5. Otherwise → `wait(15)`

# Constraints on `post_content`

- Pick K images with consistent vibe (don't mix soft + hard in one post)
- Caption MUST sound like the persona — short, lowercase if persona says so
- Default `audience: subscribers` unless persona/queue signals otherwise
- If selecting vibe='spicy' or 'hard' content, prefer `audience: subscribers` (no PPV)
  unless `ppv_attach_ratio` quota suggests now is the time
- NEVER request `audience: followers-and-subscribers` for vibe='hard'

# Output format

A single JSON object:
{ "action": "<name>", "params": {...}, "reasoning": "<1-2 sentence why>", "confidence": 0.0..1.0 }

If confidence < 0.5, prefer `wait`.
```

The strategy LLM is given this prompt + the JSON context every tick. Caption generation uses a separate, smaller LLM call (DeepSeek or Haiku) seeded with the persona + image descriptions.

---

## 14. Onboarding a new creator

Step-by-step, ~10 min per creator:

1. **Create Fanvue OAuth app** in Fanvue Developer dashboard → get `client_id` + `client_secret`. Set redirect URI to `https://fleet.<your-domain>/fanvue/callback`.
2. **Admin UI → New Creator**: enter `slug`, `display_name`, `timezone`. Paste `client_id` + `client_secret` (stored encrypted).
3. **Click Connect Fanvue** → browser opens Fanvue authorize page → grant scopes → callback writes tokens to `creators` table.
4. **Persona**: paste prompt into the persona editor. Save → creates first row in `persona_versions`.
5. **Voice**: set lowercase / emoji_rate / slang_set toggles.
6. **Schedule**: posts/day, posting hours, timezone.
7. **Content folder**: set path on the VPS (e.g. `/var/agent-fleet/content/<slug>/`). Set up rsync from your machine in a separate step.
8. **Telegram**: set `telegram_chat_id` (creator's personal chat ID with the fleet bot, OR your master chat ID).
9. **Limits**: accept defaults or tweak `max_*` and `ppv_auto_cap_cents`.
10. **Approval flags**: keep `auto_approve_posts=false` until trust is built.
11. **Activate**: flip `active=true`. First tick fires within 15 min. First action you'll see: `wait` (queue is empty until content is rsync'd).
12. **Push first images**: rsync to content folder. Vision describer processes them async. Next tick will see a non-empty queue and may decide to post.

---

## 15. Fanvue access — REST API, not MCP

**Important clarification.** The Fanvue MCP server (`https://mcp.fanvue.com/mcp`) is what *I* (Claude in a chat) use interactively. The agent fleet **does not need MCP** — it talks to Fanvue's REST API directly using the same OAuth tokens.

Why direct REST is better here:
- One less dependency (no MCP server availability risk)
- Same tokens, same scopes — works identically
- More control over rate limiting + retry behaviour
- Easier to mock for tests

The agent fleet's `fanvue.js` client is a port of the one in the main platform (`services/fanvue.js`), with:
- Per-creator token storage (DB rows, not env vars)
- Auto-refresh on 401 with 1 retry
- Rate-limit aware (back off on 429)
- `X-Fanvue-API-Version: 2025-06-26` header

The MCP stays available for me to do ad-hoc work — manual posts, debugging, testing — without writing scripts.

---

## 16. Token lifecycle + refresh

**Proactive refresh** (preferred):
- Background job every 10 min scans `creators` where `fv_expires_at < NOW() + INTERVAL '15 minutes'`
- Calls Fanvue token refresh, updates `fv_access_token`, `fv_refresh_token`, `fv_expires_at`, `fv_last_refreshed_at`
- Resets `fv_refresh_failure_count = 0` on success

**Reactive refresh** (fallback):
- If a Fanvue request returns 401, refresh once, retry once
- If retry still 401 → mark creator `active = false`, alert via Telegram

**Refresh failure handling**:
- `fv_refresh_failure_count++` on each failure
- At 3 consecutive failures: creator paused (`active = false`), Telegram alert sent, requires manual re-auth via admin
- Manual re-auth = repeat Step 3 of onboarding (re-OAuth dance)

---

## 17. Concurrency + locking

**Why care:** if the strategy tick fires twice for the same creator (e.g., overlapping schedules, restart during execution), we could post twice or send duplicate DMs.

**Solution:** Postgres advisory locks per `creator.id`.

```sql
SELECT pg_try_advisory_lock(creator_id);   -- non-blocking, returns boolean
-- ... do work ...
SELECT pg_advisory_unlock(creator_id);
```

- Single Node process, single PM2 instance (no cluster mode for this service)
- Each tick acquires the per-creator lock; if it can't, it skips silently and logs
- Lock automatically releases on process crash (transaction-level alternative if needed)

**Concurrency between strategy tick and reply poll**:
- Different lock types — strategy lock vs reply lock — both per creator
- A reply poll never collides with itself (one creator at a time per loop iteration)
- A strategy tick and reply poll for the same creator can run in parallel — they don't write to the same Fanvue resources (different chats vs new posts)

---

## 18. Error handling + retries

**Categorized retry policy:**

| Error class | Retry? | Backoff | Max attempts |
|---|---|---|---|
| LLM 429 (OpenRouter) | Yes | 5s, 30s, 2min | 3 |
| LLM 5xx | Yes | 5s, 30s | 2 |
| Fanvue 401 | Refresh + retry once | n/a | 1 retry |
| Fanvue 429 | Yes, honor `Retry-After` | from header | 3 |
| Fanvue 5xx | Yes | 30s, 2min, 10min | 3 |
| Fanvue 4xx (other) | No — surface error | n/a | 0 |
| S3 PUT 5xx | Yes (re-fetch signed URL) | 5s, 30s | 2 |
| S3 PUT 403 SignatureDoesNotMatch | No — surface, manual debug | n/a | 0 |
| Postgres connection error | Yes | 1s, 5s, 15s | 3, then alert |

Retry storage: `actions.retry_count` + `actions.next_retry_at`. A separate loop polls `actions` where `status='failed' AND next_retry_at < NOW()` and re-runs them.

**Dead-letter:** after max retries → `status='failed'`, Telegram alert with `{creator, action, error}`, no auto-retry.

---

## 19. Observability

**Structured logging** (JSON lines):
```
{"ts":"2026-06-09T10:00:00Z","level":"info","creator":"cristina","action_id":12,"event":"tick.start"}
{"ts":"...","level":"info","creator":"cristina","event":"llm.call","model":"sonnet","latency_ms":1200,"cost_usd":0.015}
{"ts":"...","level":"info","creator":"cristina","action_id":12,"event":"action.executed","type":"post","outcome":"ok"}
```

**Metrics (Postgres + admin dashboard):**
- Per creator per day: ticks_run, llm_calls, llm_cost_cents, actions_taken, errors
- Per creator: open approvals, last_post_at, last_dm_at, queue_size
- Fleet-wide: active_creators, total_actions_24h, total_cost_24h

**Alerts (Telegram to master chat):**
- Creator paused due to refresh failure
- Action retry maxed out
- LLM cost > $X/day for a creator
- Fanvue API error rate > 20% over 1h
- Approval queue stale > 4h

**Health endpoint:** `GET /health` returns `{ok, db, creators_active, last_tick_at}`.

---

## 20. Failure runbook

| Symptom | Likely cause | First action |
|---|---|---|
| Creator stops acting | `active=false` due to refresh failure | Admin → creator → reconnect Fanvue |
| Approval card shows in Telegram but tapping does nothing | Bot webhook misconfigured | Check `/webhook/telegram` endpoint reachable + correct secret token |
| Posts go out at wrong time | Timezone mismatch | Verify `creators.timezone` matches reality; the agent posts in creator-local time |
| LLM cost spike | Strategy LLM looping (returning `wait` then immediately re-running) | Check `tick_minutes` not accidentally < 5; verify `wait()` actually skips next N ticks |
| Same image posted twice | Lock race | Verify `pg_try_advisory_lock` is acquired before action; check action_id in audit log |
| AI captions don't sound like persona | Persona prompt too short or LLM model swapped | Verify `creators.ai_model_strategy` is set; check current persona_version is loaded |
| Welcome DM not sent to new sub | Cursor stale OR subscribers list cache | Check `cursors` table; verify `last_seen_subscriber_uuid` is updating |
| AGENT_FLEET_KILL not stopping things | Process needs restart for env change | `pm2 restart agent-fleet` |

---

## 21. Admin UI specification

**Login:** master credential (single password env var, hashed at rest).

**Pages:**

1. **`/`** — Fleet dashboard. Table of creators: slug, handle, active, last_action, next_tick, pending_approvals, today's posts/dms/tips. Filter by active/paused/erroring.

2. **`/creators/new`** — Create creator wizard (matches §14 onboarding steps).

3. **`/creators/:slug`** — Single creator view. Tabs:
   - **Overview** — stats, recent actions
   - **Settings** — limits, schedule, models, approval flags
   - **Persona** — current prompt + voice + version history (read + diff + restore)
   - **Content** — queue (filter by status), upload tool, retag
   - **Connection** — Fanvue OAuth status, scopes, expiry, reconnect button
   - **Telegram** — chat_id, test message button

4. **`/actions`** — Global action timeline. Filter by creator, type, status, date range. Click → action detail (LLM context snapshot, reasoning, outcome, retry button).

5. **`/approvals`** — Pending approvals list (also reachable via Telegram).

6. **`/audit-log`** — All decisions, paginated, with search.

API endpoints all under `/api/admin/` with master-auth middleware.

---

## 22. Testing strategy

**Unit:** validators, persona prompt builders, LLM response parsers — straight Jest.

**Integration (test DB):** create-creator → first tick → verify `wait` decision logged. Patch `Date.now()` to simulate scheduled-post moments.

**Dry-run mode:** env `AGENT_FLEET_DRY_RUN=1` — every Fanvue write is logged but not sent. Used during initial creator rollout for a week before going live.

**Fanvue API mock:** local `fanvue-mock` Express app that mimics relevant endpoints. Used for CI runs.

**Manual smoke checklist (per phase):**
- Phase 0: create-creator → reconnect → see Status: Connected
- Phase 1: send a DM to the bot account → see auto-reply within 2 min
- Phase 2: drop image in folder → wait 10 min → approval card in Telegram → approve → post live on Fanvue
- Phase 3: subscribe a test fan → welcome DM arrives within 5 min
- Phase 4: check weekly digest delivered to Telegram
- Phase 5: add a second creator → both run side by side without cross-contamination

---

## 23. Deployment + CI

**Repo:** `agent-fleet` (separate from `Blog` repo). Same hosting (GitHub).

**CI (GitHub Actions):**
- Lint + typecheck
- Unit tests
- Integration tests against ephemeral Postgres
- Build Docker image (or zip artifact)
- On `main` push: SSH deploy to VPS via `ssh_run.py` pattern (same as Cristina platform)

**Deploy script** (`/root/deploy.sh` on agent fleet VPS):
```
1. git pull
2. npm install --omit=dev
3. Run pending DB migrations
4. pm2 reload agent-fleet --update-env
5. Health check on /health
```

**Env vars (on VPS):**
- `DATABASE_URL`
- `MASTER_ENCRYPTION_KEY` (pgcrypto)
- `OPENROUTER_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `AGENT_FLEET_KILL` (default unset = running)
- `AGENT_FLEET_DRY_RUN` (default unset)
- `ADMIN_PASSWORD_HASH`

**No nginx changes needed** until admin UI ships — Phase 0 → 1 can run as a pure backend.

---

## 24. Backup + disaster recovery

**Postgres:**
- Nightly `pg_dump` to local file at 03:00 (creator's TZ ignored — server TZ)
- Encrypted with `MASTER_ENCRYPTION_KEY` (re-using same key as pgcrypto, separate file)
- Synced to Cloudflare R2 / B2 / S3 (whichever you already use)
- Retention: 30 days

**OAuth tokens:**
- Stored encrypted at rest (pgcrypto) — even DB dump leak doesn't expose them
- `MASTER_ENCRYPTION_KEY` lives only in `.env` (mode 600, root-only)
- Lose the key → recoverable via per-creator re-auth (one Fanvue authorize per creator)

**Content folders:**
- The source of truth is on your dev machine (or future S3)
- VPS folder is a working copy; lose it → re-rsync

**Persona prompts:**
- Stored in DB + nightly backup
- For extra safety: optionally git-push the `persona_versions` snapshots to a private repo

**Restore drill:** documented in `/docs/restore.md` of the new repo (will write during Phase 0).

---

## 25. Conflict resolution (human ↔ agent)

**Scenarios:**

1. **Human posts manually while agent has a pending post for that creator.**
   - Agent's `post_content` action moves to `status='superseded'` on next tick (it detects the human post via `last_post_at` jumping)
   - Pending Telegram approval auto-cancels

2. **Human replies to a DM that agent was about to reply to.**
   - Agent's reply loop checks: if last message in chat is from the creator AND newer than the agent's queued reply → skip
   - No duplicate sends

3. **Human manually attaches PPV; agent then attaches another PPV in same chat.**
   - Agent throttles: max 1 PPV per chat per 24h (configurable). Counter in `cursors`.

4. **Human edits persona prompt; in-flight tick uses old version.**
   - Each tick reads persona afresh from DB. No long-running cache. Edit takes effect on next tick.

**Override hatch:** admin UI has "Manual Action" panel — send a DM, post content, ping mass message — that bypasses LLM entirely and logs to `actions.decided_by='human'`.

---

## 26. Persona prompt versioning

Every save to a persona creates a new row in `persona_versions`. The current pointer (`creators.persona_version_id`) is updated atomically.

**UI:**
- Persona editor shows current prompt + a "History" dropdown
- Click a past version → diff view (line-level changes)
- "Restore this version" → creates a NEW row (clone) + flips pointer

**Why this matters:**
- If a persona tweak makes the agent post weird stuff, you can roll back to last week's version in one click
- Audit log links each action to the persona version it was decided under (`actions.context_snapshot.persona_version_id`) — you can ask "which persona version sent that bad DM?"

---

## 27. Webhook integration

Fanvue does not currently publish a webhook spec in their docs we've seen. The agent fleet polls.

**Future-proofing:** if Fanvue ships webhooks for new fans / new messages, we add a `POST /webhook/fanvue/:creator_slug` endpoint, verify signature, push events into the same action queue. Polling can then drop to 1×/hour as a sanity check.

For now: poll cadences are tuned per creator (`reply_poll_minutes`, `tick_minutes`).

---

## 28. Compliance + content safety

**Adult content compliance:**
- All actions on adult-context creators must be auditable (we already have `actions` table)
- 18+ gating is Fanvue's responsibility (we operate inside their walled garden) — we don't host content, we don't authenticate fans
- Geo-block: not applicable at our layer; Fanvue handles it

**Content safety on the in-bound side (the creator's own images):**
- Vision describer attaches `ai_safety_flags`
- If `ai_safety_flags` contains a hard rule violation (CSAM, gore, etc — Claude already refuses to describe these), `status='skipped'`, never enters posting flow, Telegram alert sent
- We do NOT auto-skip "spicy" content — only categorical violations

**Persona prompt review:**
- Master spec includes a section: persona prompts MUST NOT instruct the agent to claim to be a minor, claim non-consensual scenarios, etc.
- Validators check persona on save against a small denylist of phrases

**Data residency:**
- All data (creators, actions, content_queue, OAuth tokens) lives on one VPS (currently us-east; can move per creator preference if needed)
- No PII of fans is stored beyond what's necessary for sending DMs (we keep `fan_uuid`, not email/name)

**Operator (you) responsibilities:**
- Get Fanvue Developer App approval per creator account (already done for Cristina)
- Respect Fanvue's TOS — they explicitly allow automation under their API policy
- Maintain creator consent — each creator must consent in writing (a checkbox on onboarding) to autonomous actions on their account

---

*Spec v2 complete. Every section a senior staff eng would expect is filled. Phase 0 is the unblock; subsequent phases each independently usable.*
