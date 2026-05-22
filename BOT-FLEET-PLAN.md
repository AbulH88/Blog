# Bot Fleet Platform — Final Plan

> **Approved:** 2026-05-22
> **Codename:** `cristina-bot-fleet`
> **Plan file (private):** `~/.claude/plans/check-the-hardoff-md-lucky-brooks.md`
> **Status:** Ready to execute — Phase 0 user prep can begin anytime

## Context

The Cristina platform is live at `thecristinaadam.com` on aaPanel VPS, serving the user's flagship account (@cristinadd2m, 60k organic IG followers, manually managed on iPhone — stays untouched, no automation).

**This plan addresses a separate concern:** the user wants to grow 5 NEW AI character accounts from scratch using AI-generated content + automated cross-platform publishing (Instagram + TikTok). Manual management of 5 AI accounts is unsustainable at 2-3 posts/day across each.

**Why a separate system (not bolt-on to Cristina):**
- Different runtime — bot platform is stateful, persistent, talks to external APIs continuously
- Different security envelope — bot work talks to proxy networks, AI generation pipeline, third-party APIs; isolate from main fan-platform reputation
- Different VPS — bot fleet on its own $7/mo box prevents bleeding into `thecristinaadam.com` domain reputation
- Different scaling pattern — one worker per character account, not request/response

**Why Meta Graph API in Development Mode (bypassing 3-month app review):**
Meta's Development Mode with Standard Access permissions lets a developer app interact with accounts owned by the developer (added as Testers) WITHOUT app review. This is the official, documented path for self-managed account fleets — confirmed against Meta's docs and current 2026 developer community. The 3-month review is only required to operate on accounts you don't own.

**Why "abandon device after warmup":**
GeeLark cloud Android phones (~$30/mo) are needed only for the 14-day manual warmup phase. Once an account graduates to Business + linked FB Page + Meta Graph API tokens, all subsequent activity runs server-to-server through the API. Device identity becomes irrelevant. This collapses device cost from $750+ upfront (physical iPhones) or $150/mo ongoing (cloud phones forever) to $40 one-time per fleet of 5.

**Why local RTX 5090 + ComfyUI for content gen:**
User has the hardware. Cloud GPU alternatives (Runware, Replicate) cost $20-50/mo at our volume; local is $0 marginal. Full LoRA control means consistent character likeness across thousands of generated stills — the key bottleneck for AI influencer quality per the 2026 industry consensus.

**Intended outcome:** A standalone repo (`cristina-bot-fleet`) that, after one-time per-account setup (14 days warmup → API connect), autonomously runs 5 AI character accounts on IG + TikTok with posting, comment auto-reply, and DM auto-response. The user generates content on their 5090, reviews/approves in a clean admin UI, the platform handles the rest. Light webhook integration exposes a "Network" dashboard inside Cristina platform for unified analytics + attribution.

---

## Locked architectural decisions

| Decision | Choice | Rationale |
|---|---|---|
| Posting channel | Meta Graph API (Dev Mode + Standard Access) | Bypasses app review entirely; official sanctioned path |
| Device for warmup | GeeLark cloud Android × 14 days, then abandon | $40 one-time vs $750+ upfront for physical phones |
| Asset generation | Local ComfyUI on RTX 5090 | $0 marginal cost; LoRA per character for consistency |
| Asset hosting | Cloudflare R2 default, AWS S3 swap-in via env | R2 = cheapest with zero egress; S3 if Meta scraper ever flags R2 origins |
| Platforms | Instagram + TikTok | TikTok via Content Posting API in Sandbox mode (same Dev-Mode pattern as Meta) |
| Repo | Separate `cristina-bot-fleet` repo | Isolation from Cristina platform |
| Deployment | Separate $7/mo Hetzner CX22 VPS | Reputation isolation |
| Bot fleet UI | Own admin UI (React + Vite, same stack as Cristina) | Specialised workflow doesn't belong inside Cristina admin |
| Cristina integration | Light webhook + new "Network" tab + attribution shortlinks | Full integration but each surface keeps its own UI |
| Auto-replies | **YES — both comment auto-reply AND DM auto-responder** | High algo + funnel value; both work under Standard Access in Dev Mode |
| Auto-engagement (like / follow / comment on OTHER users' posts) | NEVER | Account-killing ban risk; no official API supports it |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  CONTENT GENERATION (your local rig)                            │
│  ────────────                                                   │
│  RTX 5090 + headless ComfyUI                                    │
│  - Custom LoRA per character (one-time train, ~30 min/char)     │
│  - Overnight batch: ~10 stills + 2 reels per character          │
│  - Output to watched folder OR HTTP-push to bot platform        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP push / file watcher
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  BOT FLEET PLATFORM (new repo, separate $7/mo Hetzner VPS)      │
│  ─────────────────                                              │
│  Node 20 + Express 5 + Postgres 16 + Redis + R2/S3              │
│                                                                  │
│  Workers (PM2 cluster):                                          │
│  ├── web              — Express API + serves admin UI           │
│  ├── scheduler        — cron 60s, publishes due ScheduledPosts  │
│  ├── token-refresh    — auto-renews 60d tokens 7d before expiry │
│  ├── analytics-poll   — pulls IG + TikTok insights every 6h     │
│  ├── webhook-receiver — handles IG + TikTok platform callbacks  │
│  └── auto-reply       — processes inbound comment + DM events   │
│                                                                  │
│  Admin UI (React + Vite + TS):                                   │
│  ├── Login            — JWT auth, owner-only                    │
│  ├── Dashboard        — all-character overview                  │
│  ├── Characters       — CRUD 5 character profiles               │
│  ├── Approval         — review pending AI assets                │
│  ├── Schedule         — calendar of upcoming posts              │
│  ├── Conversations    — view + tune comment + DM auto-replies   │
│  ├── Analytics        — per-character growth charts             │
│  └── Integrations     — IG / TikTok OAuth connect buttons       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS webhook (HMAC-signed events)
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  CRISTINA PLATFORM (existing aaPanel VPS, light additions)      │
│  ──────────────────                                             │
│  ├── /api/network/webhook (new)  — receives bot-fleet events   │
│  ├── /r/:character (new)         — tracked shortlinks for bio  │
│  └── /admin → Network tab (new)  — aggregate dashboard          │
└─────────────────────────────────────────────────────────────────┘

ONE-TIME PER ACCOUNT (manual, ~2-3 weeks calendar time):
┌─────────────────────────────────────────────────────────────────┐
│  Day 1-14:   Warmup on GeeLark cloud Android + 4G mobile proxy  │
│  Day 15:     Convert IG to Creator/Business → link FB Page →   │
│              add FB account as Tester on Meta App → OAuth flow  │
│  Day 15:     ABANDON the GeeLark instance — API takes over     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js 20 |
| Web framework | Express 5 |
| ORM | Sequelize (mirrors Cristina platform) |
| Database | Postgres 16 (no SQLite — production from day one) |
| Cache + queue | Redis (rate limiters, Socket.IO if needed, pub/sub) |
| Object storage | Cloudflare R2 (default) / AWS S3 (env-swappable) |
| Image gen | ComfyUI headless on local RTX 5090 |
| Video gen | Kling AI or Runway Gen-3 ($20-30/mo, optional) — later via local 5090 too |
| LLM | OpenRouter (Claude Haiku 4.5 / Gemini Flash) for captions + reply gen |
| Admin frontend | React 18 + Vite + TypeScript |
| Auth | JWT (mirror Cristina's pattern + secret) |
| Process manager | PM2 cluster (2 web workers + 4 dedicated job workers) |
| Reverse proxy | Caddy (auto-TLS) |
| Monitoring | Sentry (mirror Cristina's pattern) |

---

## Repo structure

```
cristina-bot-fleet/
├── README.md
├── .env.example
├── ecosystem.config.js
├── server/
│   ├── server.js
│   ├── database.js
│   ├── models/
│   │   ├── index.js
│   │   ├── Character.js          # Per-character creds + persona + LoRA ref
│   │   ├── ContentItem.js        # Asset (pending_approval/approved/published/discarded)
│   │   ├── ScheduledPost.js      # Publish queue
│   │   ├── Conversation.js       # DM threads (one row per fan-character pair)
│   │   ├── CommentReply.js       # Comment auto-reply audit log
│   │   └── Event.js              # Analytics events (sent to Cristina webhook)
│   ├── routes/
│   │   ├── authRoutes.js         # Owner login
│   │   ├── characterRoutes.js    # CRUD characters
│   │   ├── contentRoutes.js      # Approval queue + history
│   │   ├── scheduleRoutes.js     # Calendar CRUD
│   │   ├── conversationRoutes.js # View + tune auto-replies
│   │   ├── ingestRoutes.js       # ComfyUI → bot platform push
│   │   ├── igOauthRoutes.js
│   │   ├── tiktokOauthRoutes.js
│   │   └── webhookRoutes.js      # Meta + TikTok inbound webhooks
│   ├── services/
│   │   ├── crypto.js             # AES-256-GCM encrypted-at-rest
│   │   ├── storage.js            # R2/S3 adapter
│   │   ├── metaGraph.js          # IG Graph API client
│   │   ├── tiktokApi.js          # TikTok Content Posting API client
│   │   ├── comfyui.js            # HTTP client to local 5090
│   │   ├── tokenRefresh.js       # 60d token rotator
│   │   ├── scheduler.js          # 60s publish loop
│   │   ├── analytics.js          # 6h insights poller
│   │   ├── autoReply.js          # Comment + DM AI reply gen
│   │   └── webhookCristina.js    # Push events to main platform
│   └── middleware/
│       ├── authMiddleware.js
│       └── rateLimit.js
└── client/
    ├── vite.config.ts
    └── src/
        ├── App.tsx
        ├── pages/
        │   ├── Login.tsx
        │   ├── Dashboard.tsx
        │   ├── Characters.tsx
        │   ├── Approval.tsx
        │   ├── Schedule.tsx
        │   ├── Conversations.tsx
        │   ├── Analytics.tsx
        │   └── Integrations.tsx
        └── components/
            ├── AssetGrid.tsx
            ├── ApprovalCard.tsx
            ├── ScheduleCalendar.tsx
            └── ReplyTuningPanel.tsx
```

---

## Per-character setup flow (one-time, ~3 weeks calendar)

```
Day -7:    User prep
           • Pick character name, persona, niche (lifestyle / fashion / fitness / travel / cosplay)
           • Train LoRA on RTX 5090 (~30 reference images → 30-min fine-tune)
           • Buy 1 GeeLark Cloud Android instance ($30/mo, 14 days)
           • Buy 1 dedicated 4G mobile proxy from SOAX/IPRoyal ($15-25/mo)
           • Buy 5sim.net / Anosim SMS verification credit ($1-2)

Day 1-14:  Warmup (manual, ~15 min/day)
           Day 1:     Sign up on GeeLark via burner SMS + catch-all email
                      No profile pic, persona-matching name + bio
           Day 2-5:   Scroll 10 min/day, like 3-5 niche posts. No posts.
           Day 6-10:  Follow 5 niche competitors. 1 natural comment/day.
           Day 11-12: Add LoRA-generated profile pic (low-res), bio, 1 highlight
           Day 13-14: First feed post (a B-roll LoRA still)

Day 15:    Convert + link (manual, ~10 min)
           1. IG → Settings → Switch to Professional → Creator/Business
           2. In GeeLark, open Facebook → create new FB Page (owned by master FB account)
           3. IG settings → Account → Linked accounts → connect to FB Page
           4. Meta Developer Dashboard → App Roles → add master FB account as Tester
           5. Accept invite in Facebook
           6. Bot platform admin → Integrations → "Connect Instagram for <character>"
              → OAuth flow → 60-day token stored encrypted
           7. TikTok parallel: TikTok Developer Dashboard → Sandbox testers → add account
              → OAuth from bot admin → tokens stored
           8. Kill the GeeLark instance — never needed again

Day 16+:   Autonomous operation
           Bot platform handles posting, comment auto-reply, DM auto-response
           User generates content batches on the 5090 + reviews approval queue
```

---

## Daily operations flow

```
00:00 (overnight)
  Cron triggers ComfyUI batch on RTX 5090 (5 characters × ~12 assets each)
  Outputs written to local watched folder

00:30
  Watcher script HTTP-pushes new assets to bot platform's /api/ingest
  Bot platform:
  • Uploads each asset to R2 (signed-URL-friendly, public-read path)
  • Creates ContentItem with status='pending_approval'
  • Generates suggested caption + hashtags via OpenRouter
  • Sends Discord/email notification: "12 items pending for Aria, 8 for Maya, ..."

08:00 (user reviews, ~5 min/character/day)
  Bot admin → Approval tab → grid of pending items per character
  Per item: thumbnail + AI-suggested caption + hashtags
  Actions: approve / edit caption / discard
  On approve:
  • Item gets auto-scheduled per character's posting strategy
    (Aria: 2/day at 12:00 + 19:00 local; Maya: 1/day at 17:00; etc.)
  • Platforms picked: IG always; TikTok if asset has a video version

12:00 (scheduler worker, every 60s)
  • Finds ScheduledPost rows where scheduledAt <= now AND status='queued'
  • Locks job (status='publishing') for idempotency
  • IG: create container with R2 URL → poll status_code until FINISHED
        → publish via /media_publish → store platformPostIds.ig
  • TikTok: init upload → chunked PUT → publish → poll status
        → store platformPostIds.tiktok
  • Update status='published', publishedAt=now
  • Record Event(name='post_published', characterId, platform, postId)
  • POST to Cristina webhook with HMAC signature

12:01+ (Meta webhook callbacks — inbound)
  Comment received on a character's post:
  • Comment auto-reply worker picks up event
  • Generates AI reply via OpenRouter using character's persona prompt
  • Filters: skip if comment is hostile/spam (intent classifier)
  • Posts reply via Meta Graph API /:commentId/replies endpoint
  • Records CommentReply row for audit

  DM received from a fan:
  • DM auto-responder worker picks up event
  • Checks: is this first-touch in 24h? If yes → respond with on-voice reply
    including the character's /r/<character> bio shortlink
  • Tracks subsequent DMs as Conversation rows for context
  • Hand-off: if intent classifier detects high-intent ("how do I see more"),
    response includes the Cristina platform signup link

19:00
  Second daily post for accounts with 2/day cadence

Every 6h (analytics-poll worker)
  Per character:
  • Meta Graph API /me/insights → followers, reach, impressions, profile_views
  • Meta Graph API per recent post → engagement metrics
  • TikTok API user/info + per-video stats
  • Update Character.metrics + per-post stats
  • POST to Cristina webhook: { type: 'metrics_updated', metrics: {...} }

Every 53 days (token-refresh worker — auto-renew 7 days before expiry)
  • Calls Meta long-lived-token refresh endpoint
  • Stores new 60d token (encrypted) + new expiry
  • Same flow for TikTok refresh tokens
  • Alerts if any token fails to refresh (account may have been disconnected)
```

---

## Permissions + API access strategy

### Instagram (Meta Graph API)

Permissions required (all under Standard Access, no app review):
- `instagram_content_publish` — post stills, reels, stories, carousels
- `instagram_manage_comments` — read comments on own posts + reply
- `instagram_manage_messages` — DM auto-respond (24h window after fan messages first)
- `instagram_basic` — read profile data
- `pages_show_list` — list linked FB Pages
- `pages_read_engagement` — read Page insights (for analytics)
- `business_management` — Business Discovery features

App configuration:
- Type: Business
- Mode: **Development (permanent)**
- Access tier: **Standard Access**
- Tester accounts: 5 master Facebook profiles, one per AI character

Token strategy:
- Long-lived (60-day) tokens, auto-refreshed at day 53 by `token-refresh` worker
- Stored encrypted-at-rest via `crypto.js` AES-256-GCM
- Refresh failure alerts surface in admin dashboard

Rate limits:
- 200 calls/hour/user under Standard Access (more than enough — we use ~30/account/day)
- Per-account Redis counter prevents accidental over-consumption
- Buffer at 150/hour (leave headroom for retries)

### TikTok (Content Posting API)

App configuration:
- Sandbox mode (TikTok's equivalent of Meta Dev Mode)
- Sandbox testers: same 5 master accounts

Permissions required:
- `video.upload` — upload videos
- `video.publish` — publish uploaded videos
- `user.info.basic` — read profile
- `user.info.stats` — read follower stats

Token strategy:
- Access token (24h) + refresh token (365d)
- `token-refresh` worker auto-renews access token before expiry

Limits:
- 6 video posts/day per account (TikTok hard cap)
- Photo Mode for stills (still uses video endpoint with image carousel)

---

## Cristina platform integration (light additions only)

Files in existing `cristina-app` repo:

| File | Change |
|---|---|
| `server/routes/networkRoutes.js` (new) | `POST /api/network/webhook` — HMAC-verified inbound from bot fleet; writes to existing `Events` table with `source='bot-fleet'` |
| `server/routes/shortlinkRoutes.js` (new) | `GET /r/:character` — tracked redirect to `/register?via=:character` |
| `server/models/index.js` | Add lightweight `NetworkCharacter` model — read-cache of bot-fleet character data |
| `client/src/pages/Admin.tsx` | New sidebar tab: "Network" |
| `client/src/pages/admin/NetworkTab.tsx` (new) | Aggregate dashboard: all character growth, top posts, attribution funnel |
| `client/src/pages/Register.tsx` | Capture `?via=:character` UTM → attribute signup to that character (writes Event row) |

### Cross-promote funnel

```
Character IG bio:
  "💌 my private space → thecristinaadam.com/r/aria"
            │
            ▼
  Cristina backend /r/aria
            │
            ├── Records Event('clicked_bio_link', character='aria')
            │
            ▼
  Redirect to /register?via=aria
            │
            ▼
  Fan signs up
            │
            ▼
  Event('signup_attributed', character='aria')
            │
            ▼
  Bot-fleet admin Analytics tab shows:
    "Aria: 12,400 IG followers, 84 bio clicks, 7 signups, $89 attributed earnings"
```

---

## Cost breakdown

### One-time (fleet of 5 accounts)
| Item | Cost |
|---|---|
| GeeLark warmup (14 days × 5 accounts) | $40 |
| Mobile proxies (14 days × 5 accounts prorated) | $50 |
| SMS verification credits | $10 |
| Catch-all email domain | $12/yr |
| Meta Developer App registration | $0 |
| TikTok Developer App registration | $0 |
| LoRA training compute (local 5090, electricity) | ~$5 |
| **Total one-time** | **~$120** |

### Ongoing monthly
| Item | Lean | With cloud reel gen |
|---|---|---|
| Bot platform VPS (Hetzner CX22) | $7 | $7 |
| Cloudflare R2 storage (~50GB) | $0.75 | $0.75 |
| OpenRouter (captions + DM/comment replies, ~600 calls/mo) | $5 | $5 |
| GPU electricity (local 5090, ~$1/day) | $30 | $30 |
| Kling AI / Runway for reels | $0 | $25 |
| Domain renewal | $1 | $1 |
| Meta Graph API | $0 | $0 |
| TikTok API | $0 | $0 |
| **Total monthly** | **~$44** | **~$69** |

**Per-character cost: $9-14/month.** Breakeven at any 1 character earning >$70/mo.

---

## Build phases

### Phase 0 — User parallel setup (week 1, ~2-3 hours user time)
- Create Meta Developer App (Business, Dev Mode)
- Create TikTok Developer App (Sandbox)
- Cloudflare R2: create bucket `cristina-bot-fleet-assets`
- Register catch-all domain + email aliases
- Pick 5 character names, niches, base prompts
- Provision Hetzner CX22 VPS, install Caddy + Postgres + Redis
- Buy GeeLark instances + mobile proxies + SMS credit (only when ready to start warmups)

### Phase 1 — Bot platform scaffolding (~3 dev days)
- New repo, GitHub
- Express + Sequelize + Postgres + Redis + PM2 config
- JWT auth (owner-only)
- Encrypted-at-rest crypto helper (AES-256-GCM)
- R2/S3 storage adapter (env-driven, both implementations)
- Models: Character, ContentItem, ScheduledPost, Conversation, CommentReply, Event
- Idempotent column-add migration pattern (reuse Cristina's `addIfMissing` helper)
- Frontend scaffold: Vite + React + minimal admin shell (Login, Characters, Integrations)

### Phase 2 — Platform OAuth + posting (~3 dev days)
- IG: OAuth start/callback, long-lived 60d token exchange
- IG: token-refresh worker (renew at day 53)
- IG: two-step publish (create container → poll status_code → publish)
- IG: stills, reels, stories, carousels
- TikTok: OAuth start/callback, refresh-token flow
- TikTok: init-upload → chunked upload → publish flow
- Test publish a single still + reel to a real test account on each platform

### Phase 3 — Content pipeline (~2 dev days)
- Ingest endpoint (HTTP push from ComfyUI watcher)
- Local ComfyUI HTTP client (trigger generation from bot admin if needed)
- Approval UI (grid of pending items, approve/edit/discard with caption editor)
- Auto-schedule on approval per character's posting cadence
- Scheduler worker (60s loop, job locking for idempotency, retry on failure)
- Per-character rate limiter in Redis (max 150 calls/hour)

### Phase 4 — Auto-reply (~2 dev days)
- Webhook receiver for Meta comments + DMs (HMAC signature verification)
- Comment-reply worker: pulls character persona, generates AI reply via OpenRouter
- Intent classifier filter — skip hostile/spam comments (reuse logic pattern from `server/services/intentClassifier.js` in Cristina platform)
- DM auto-responder: detect first-touch, generate on-voice reply, include bio shortlink
- High-intent hand-off: detect "how do I see more" patterns → include Cristina signup link
- Conversation logging for context across DM threads
- Admin "Conversations" tab to review + tune reply behavior

### Phase 5 — Analytics + dashboard (~1 dev day)
- Analytics-poll worker (every 6h)
- Insights endpoints: Meta `/me/insights`, TikTok `/user/info` + per-post
- Charts in admin Analytics tab (per-character growth, top posts, engagement rate)
- Event recording for all key actions

### Phase 6 — Cristina platform integration (~1 dev day)
- Webhook endpoint on Cristina: `POST /api/network/webhook` (HMAC-signed)
- New "Network" tab in Cristina admin (NetworkTab.tsx)
- `/r/:character` shortlink routes — tracked → redirects to `/register?via=:character`
- UTM attribution in Register.tsx — capture `via` param, write Event

### Phase 7 — Operational hardening (~1 dev day)
- Graceful shutdown handlers (mirror Cristina pattern, see `server/index.js`)
- Sentry init (`server/services/sentry.js` pattern)
- Health endpoint `/api/health` with DB ping + Redis ping
- Token-expiry alerts: email + Cristina dashboard banner if any token <3d to expiry
- Daily nightly backup script (mirror Cristina's `server/scripts/backup.sh`)
- Log rotation via logrotate (mirror Cristina's `server/scripts/DEPLOY.md` pattern)

**Total dev time: ~13 days. Calendar runway to "first auto-post live": ~3-4 weeks (Phase 0 + warmup runs parallel).**

---

## Existing utilities to reuse (from Cristina platform)

The bot fleet repo is new, but several patterns transfer directly:

- **Per-creator background-service pattern** — Cristina's `server/services/telegram.js` shows the per-creator poller pattern (Map of `{creatorId → poller}`, `initFromDb()` at boot). Apply same shape for per-character token refresh + scheduler workers.
- **Idempotent column-add migration helper** — Cristina's `server/models/index.js` `addIfMissing()` function works as-is.
- **Encrypted-at-rest pattern** — copy approach from Cristina's `crypto.js` (or create fresh if it doesn't exist there yet).
- **Sentry wrapper** — Cristina's `server/services/sentry.js` graceful no-op pattern.
- **Health endpoint** — Cristina's `/api/health` (DB authenticate + Redis ping + cache no-store).
- **Backup script** — Cristina's `server/scripts/backup.sh` (Postgres pg_dump + rclone off-site).
- **Deploy doc pattern** — Cristina's `server/scripts/DEPLOY.md` (Caddy + PM2 + cron + logrotate + fail2ban).
- **Webhook HMAC verification** — pattern Meta NOWPayments uses in Cristina's `server/routes/paymentRoutes.js`.
- **JWT auth + token refresh** — Cristina's `server/middleware/authMiddleware.js` + `server/routes/authRoutes.js`.
- **OpenRouter integration** — Cristina's existing AI chatbot pipeline (reuse for both caption generation AND auto-reply generation).
- **Intent classifier** — Cristina's `server/services/intentClassifier.js` (use to filter hostile comments + detect high-intent DMs).
- **Rate-limit Redis store** — Cristina's `rate-limit-redis` setup (clone wholesale).

---

## Verification

After each phase:

**Phase 1:** Log into bot admin. CRUD a Character row. Encryption helper round-trips correctly. R2 upload/download works.

**Phase 2:** OAuth-connect a real test IG account → publishes a still + a reel to that account via API. Same for TikTok. Token-refresh worker renews a token on demand (force expiry to test).

**Phase 3:** Push a test image via the ingest endpoint → appears in approval queue → approve → auto-scheduled → publishes at scheduled time → `platformPostIds` populated.

**Phase 4:** Send a comment on a test post → comment auto-reply worker generates + posts reply within 60s. Send a DM to the test account → auto-responder fires within 60s with on-voice reply containing the bio shortlink.

**Phase 5:** Analytics tab shows follower count + reach matching the actual IG profile. TikTok stats match. Per-post engagement updates after every poll cycle.

**Phase 6:** Cristina admin → Network tab shows the test character with aggregated metrics. Click bio shortlink `/r/test` → tracked event → redirects to `/register?via=test`. Sign up → attribution Event row in Cristina DB.

**Phase 7:** Restart bot platform → in-flight jobs survive cleanly (idempotency). `/api/health` returns 200 with db: reachable, redis: reachable. Sentry catches a forced error. Force a token to <3d expiry → admin banner appears.

**End-to-end smoke (after all phases live):**
1. User generates 10 LoRA stills overnight on 5090 → pushed to bot platform
2. 8 approved in morning review (~5 min)
3. 8 posts publish across 2 characters over 4 days
4. Random fan comments on Aria's post → AI reply within minutes
5. Random fan DMs Aria → AI reply with bio link within minutes
6. Fan clicks bio link → tracked → signs up on Cristina
7. Cristina admin Network tab shows: "Aria: 1 new signup attributed today"

---

## Out of scope (deliberately)

- ❌ Auto-like / auto-follow / auto-comment on OTHER users' posts (ban-risky, never)
- ❌ X (Twitter) / Reddit publishing (separate phase, defer)
- ❌ Real-time AI content moderation (rely on user approval gate)
- ❌ Multi-tenant SaaS (single-owner system for now)
- ❌ Mobile admin app (web admin is sufficient)
- ❌ Live video / stories beyond simple stills + reels + standard stories
- ❌ Comment moderation / shadow-deleting hostile fans (out of scope phase 1)
- ❌ Influencer marketplace / brand deals integration

---

## Decisions deferred to execute time

These don't affect plan structure — to be confirmed at Phase 0:

| Item | Default suggestion | Decide before |
|---|---|---|
| 5 character names + niches | Aria, Maya, Luna, Sage, Sky — all lifestyle | Phase 0 |
| Posting cadence per character | 2 posts/day per character on IG; 1/day on TikTok | Phase 1 |
| Bot platform VPS provider | Hetzner CX22 ($7/mo, EU) — separate from Cristina's VPS for isolation | Phase 0 |
| Catch-all email domain | New domain (e.g. `ariastudios.com`) for clean separation from `thecristinaadam.com` | Phase 0 |
| Bot admin credentials | Separate from Cristina (different threat surface) | Phase 1 |
| Reel generation | Local 5090 frame-by-frame initially; add Kling AI later if quality bottleneck | Phase 3 |
| Comment auto-reply persona toggle | Per-character on/off in admin | Phase 4 |
| DM auto-reply 24h window enforcement | Hard-enforce (skip replies outside 24h) — Meta's policy | Phase 4 |
