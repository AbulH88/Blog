# Cristina Adam Platform — Single Source of Truth

> **Last updated:** 2026-05-23
> **Live:** https://thecristinaadam.com (marketing) · https://members.thecristinaadam.com (members)
> **Status:** ✅ Shipped and running in production

A creator monetization platform — bio/marketing site on the root domain, age-gated members area on a subdomain, single Node backend, single Postgres DB. Built for crypto + (future) card payments.

---

## 1. Architecture at a glance

```
                       Cloudflare (DNS + WAF + cache + AI-bot block)
                                       │
                                       ▼
                        ┌──────────────────────────────┐
                        │  VPS 192.3.81.151 (AlmaLinux)│
                        │  aaPanel + nginx + PM2       │
                        └──────────────┬───────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            │                                                     │
   nginx vhost: root                                  nginx vhost: members
   thecristinaadam.com                                members.thecristinaadam.com
   - clean linktree/bio                               - signup, vault, chat, admin
   - IG/FB/TikTok bots: allowed                       - IG/FB/TikTok bots: 403
   - robots.txt: creator-toggle                       - robots.txt: hard Disallow
            │                                                     │
            └──────────────────┬──────────────────────────────────┘
                               ▼
                  Node.js (Express + Socket.IO)
                  PM2 cluster · 2 workers · port 5000
                               │
              ┌────────────────┼─────────────────┐
              ▼                ▼                 ▼
         Postgres 16        Redis 7        File uploads
         (aaPanel,         (Socket.IO       /var/www/cristina/
         127.0.0.1:5432)   adapter +        server/uploads/
                           rate-limit)      (served by nginx + CDN)
```

**Tech stack:** Node 24 · Express · Socket.IO · Sequelize · React 19 + Vite · TypeScript · Tailwind-style v3 theme system.

**External services:**
- **NOWPayments** — crypto checkout (BTC/USDT/ETH/etc), live keys, $5/mo spending cap
- **OpenRouter** — AI chat (DeepSeek V4 Flash for replies + Claude Haiku for intent classification), $5/mo cap
- **MXRoute SMTP** — transactional email (verification, password reset)
- **Fanvue** — alt card-payment funnel (linked from members.* + dashboard CTA)
- **Cloudflare** — DNS, WAF, CDN, SSL

---

## 2. What's DONE (everything currently in production)

### 2.1 Auth & accounts
- ✅ Fan signup with email verification (24h token, MXRoute SMTP)
- ✅ Email normalization on every auth path (lowercase + trim) — blocks case-variant duplicates
- ✅ Creator login (separate role)
- ✅ JWT in localStorage, separate scopes per origin (`thecristinaadam.com` vs `members.thecristinaadam.com`)
- ✅ Auto-follow on signup: `tier='free'` Subscription created → fan appears in creator inbox immediately
- ✅ Loud error logging when auto-follow fails (silent enum mismatches caused invisible fans on launch day)
- ✅ Forgot password / reset / resend verification flows

### 2.2 Creator admin (`members.thecristinaadam.com/admin`)
- ✅ **Bio Builder** — name, bio, links, theme colors, fonts, favicon, SEO meta
- ✅ **Gallery** — album system (hero + photo albums, per-slide desktop+mobile pairs, one active album at a time)
- ✅ **Analytics** — KPIs (30d revenue, active members, conversion rate, ARPU), daily revenue chart, revenue-by-source breakdown, top earning posts, traffic referrers, recent transactions
- ✅ **Content/Vault** — post + collection (PPV bundle) CRUD with thumbnails, drag-reorder
- ✅ **Messages** — inbox of paying fans, threaded DM, per-thread AI toggle
- ✅ **Broadcast** — mass DM with audience segments (all/paying/top-spenders/recently-active/new/never-purchased/high-message-activity)
- ✅ **Audience** — fan-level CRM (totalSpent, lastPurchase, lastMessage), filter + sort
- ✅ **AI Chatbot** — persona prompt editor (5,137 chars for Cristina), model picker (DeepSeek V4 Flash recommended), NSFW level, PPV approval rules, Telegram approval bot
- ✅ **Settings** — SEO, favicon, profile, password change, age gate, search-indexable toggle, AI auto-reply default
- ✅ **Manage Users + Notifications** — bell shows real Events feed, user detail drawer

### 2.3 Fan side (members.thecristinaadam.com)
- ✅ Dashboard (wallet, stats, latest content, latest message, purchase history)
- ✅ Vault — locked content browser with unlock flow
- ✅ Chat (real-time Socket.IO, PPV preview/unlock, AI replies)
- ✅ FanSettings (account, payments, subscriptions, history)
- ✅ Mobile nav + responsive layouts everywhere

### 2.4 Payments (crypto, via NOWPayments)
- ✅ Wallet deposit modal with smart per-coin minimums (live from NOWPayments)
- ✅ 8 coins supported (USDT-Tron, TRX, LTC, SOL, USDT-ETH, ETH, BNB-BSC, BTC)
- ✅ `is_fee_paid_by_user: true` — network fee added on top, merchant gets clean USD
- ✅ `is_fixed_rate: true` — locked exchange rate, no mid-checkout surprises
- ✅ `pay_currency` pre-selection on NOWPayments hosted checkout
- ✅ Wallet → atomic SQL debit (race-condition-safe spend)
- ✅ Resume/Cancel for pending wallet deposits (saved `checkoutUrl` column)
- ✅ One-tap unlock from wallet for posts/collections/PPV messages
- ✅ Tip flow
- ✅ Webhook signature verification (HMAC-SHA512, sorted-key JSON)
- ✅ NOWPayments IPN URL configured (`/api/payments/webhook/nowpayments`)
- ✅ Production-only provider allowlist (no mock in prod)

### 2.5 AI chatbot
- ✅ Two-model architecture: DeepSeek V4 Flash for replies + Claude Haiku 4.5 for intent classification
- ✅ Intent gating: AI only attaches PPV when fan signals interest (GREETING/COLD intents = no PPV)
- ✅ PPV approval queue (in-panel + Telegram bot inline-button flow)
- ✅ Per-fan auto-reply toggle (Subscription.aiAutoReplyEnabled)
- ✅ Creator-wide NSFW level (off / flirty / explicit) — kill switch
- ✅ Welcome PPV on signup (configurable per creator)
- ✅ Conversation memory (last 50 messages per fan)
- ✅ Sandbox test chat in admin

### 2.6 Domain separation (the card-processor + IG-bot defense)
- ✅ Marketing root vs age-gated members subdomain split
- ✅ Frontend hostname-aware routing (different `<Routes>` per domain)
- ✅ Backend `/r/:character` shortlink for IG bio links (logs Event + 302 to members)
- ✅ nginx: separate vhosts, both proxy to same Node:5000
- ✅ SSL: self-signed cert with all 3 SANs (root, www, members) — Cloudflare Full mode
- ✅ Email links (`PUBLIC_APP_URL`) point to members.*
- ✅ CORS allow-list covers both domains
- ✅ Defensive `HostRedirect` for stale bookmarks (`thecristinaadam.com/dashboard` → bounce to members)

### 2.7 Anti-bot hardening on root (IG/TikTok safety)
- ✅ JoinPremiumModal: lazy-loaded chunk + hostname-conditional render (strings never in main bundle)
- ✅ Chunk renamed via Vite to `m-*.js` — no descriptive filename leak
- ✅ Navbar: subtle "Members" button replaces signup pitch CTA
- ✅ Footer: legal links (Privacy/Terms/DMCA/Disclosure) only render on members.*
- ✅ nginx Host check on members.*: hard 403 for facebookexternalhit, Twitterbot, TikTokBot, Instagram, meta-externalagent, LinkedInBot, Pinterest, Slackbot, WhatsApp, TelegramBot, Discordbot, SocialBot
- ✅ Members robots.txt: hard `Disallow: /` (overrides app default)
- ✅ Cloudflare AI-scraper block (GPTBot, ClaudeBot, CCBot, Bytespider, etc.) — free bonus
- ✅ Scroll-triggered Members CTA (60% scroll → slide-up pill) — bots don't scroll = never renders
- ✅ Bot-safe copy throughout ("Members" / "Come in →" / "There's more, if you want it")

### 2.8 Security
- ✅ JWT_SECRET: 64-char hex random, rotated at deploy time
- ✅ Bcrypt password hashing (cost 12)
- ✅ Express-rate-limit with Redis store (cluster + reboot survival): auth 20/15min, write 60/min, AI 20/min
- ✅ Helmet CSP enabled (`default-src 'self'`, locked-down)
- ✅ CSRF mitigation via JWT-in-header (not cookies)
- ✅ Mass-assignment defence: explicit ALLOWED_FIELDS allowlist on creator PATCH
- ✅ Wallet double-spend guard: atomic SQL UPDATE (no read-then-write race)
- ✅ File upload: type whitelist + multer 100MB cap + Sharp image processing
- ✅ PNG transparency preserved for logos/avatars (skip sharp pipeline via `raw=1` flag)
- ✅ `.env` perms: chmod 600, root-only
- ✅ `.env` gitignored, never tracked
- ✅ nginx: dotfile probes (`/.env`, `/.git/*`, etc.) → 404
- ✅ `trust proxy 1` so `req.ip` is real client IP behind Cloudflare/nginx
- ✅ PII normalization (email lowercased everywhere)

### 2.9 Infrastructure
- ✅ PM2 cluster mode (2 workers, `kill_timeout: 12000` for clean drains)
- ✅ Graceful shutdown handler (SIGTERM/SIGINT drain → close HTTP → close Socket.IO → close Redis → close DB)
- ✅ Socket.IO Redis adapter (cross-worker message delivery)
- ✅ Rate-limit Redis store (limits survive Node restarts)
- ✅ Cloudflare proxy enabled (orange cloud) for both domains
- ✅ Cloudflare auto-cache `/uploads/*` (1y immutable, content-addressed filenames)
- ✅ Compression (gzip level 6, > 1KB)
- ✅ Image processor (Sharp) auto-resizes to max 2000px, alpha-preserving for PNGs
- ✅ `pm2 startup systemd` → auto-restart on VPS reboot

### 2.10 Deploy automation
- ✅ One-command deploy: `bash /root/deploy.sh` (pull → cleanup → build → reload → health)
- ✅ `clean-vps.sh` strips docs cruft from prod (re-runnable)
- ✅ Git hooks: `post-merge` + `post-rewrite` auto-run cleanup on every pull
- ✅ Flags: `--backend` (skip client build), `--client` (skip PM2 reload)
- ✅ Local `.deploy/` scripts (gitignored — contain SSH password) drive the VPS

### 2.11 Misc product polish
- ✅ Hero slider: per-slide desktop (16:5) + mobile (4:5) overrides, native `<picture>` element
- ✅ Resume/Cancel for pending wallet deposits
- ✅ Wallet abandoned-deposit hiding in fan purchase history
- ✅ Fanvue alt-checkout cards (dashboard bar + first-login modal + deposit-modal strip) — only render if `creator.fanvueUrl` set
- ✅ AI Chatbot save button: sticky bottom (was easy to miss)
- ✅ FanDashboard hooks ordering (no more white-screen bug)

---

## 3. What's LEFT (prioritized)

### 3.1 High priority (real revenue blockers)
- ❌ **Card payment processor integration** (Verotel / CCBill / Segpay)
  - Why: 80% of fans don't have crypto. Currently the only on-platform path is crypto + Fanvue link.
  - Effort: ~1-2 weeks (merchant account approval is the bottleneck, not the code)
  - Code skeleton already exists (`server/payments/providers/card.js`) — just needs the real gateway plugin
  - Card processor underwriting will use `members.thecristinaadam.com` (already prepped for them)

### 3.2 Medium priority
- ❌ **Multi-tenant refactor** (1-2 days when needed)
  - Goal: same backend serves multiple creators by hostname
  - Steps: add `Creator.domain` column · hostname-resolution middleware · drop `VITE_CREATOR_SLUG` for runtime lookup
  - All DB tables already scope by `creatorId` — the refactor is surgical, not structural
- ❌ **Postgres backup automation** (cron `pg_dump` + offsite retention)
  - `server/scripts/backup.sh` exists locally but not scheduled
- ❌ **Cloudflare WAF rules** for US state-by-state geo blocks (TX, LA, UT, MS, MT, AR, NC, VA, FL, TN, KY) — adult content age-verification states
- ❌ **Cloudflare Origin Certificate** → swap self-signed cert for proper origin cert → switch SSL mode from Full to Full (strict)

### 3.3 Low priority
- ❌ Cleanup: convert `server/scripts/*.md` ops docs back into a runbook section here
- ❌ Sentry error tracking (`SENTRY_DSN` env wired but not configured)
- ❌ Telegram bot for creator-side PPV approval (code shipped, creator hasn't set up bot token yet)
- ❌ Move favicon upload to `raw=true` (still uses sharp pipeline, alpha flattens — same bug we fixed for logos)
- ❌ Replace hardcoded "favorites" chips on Home with admin-editable list
- ❌ Set page `<title>` properly (still showing default "client") — needs creator to fill SEO Meta in admin
- ❌ Lint clean-up (22 React Compiler lint warnings)

### 3.4 Out of scope (deferred)
- Audience-segment broadcast targeting backend (frontend exists; backend `/blast` doesn't filter)
- Native iOS/Android apps
- Live streaming
- Tiered subscriptions (free/basic/premium pricing tiers — currently flat)

---

## 4. Quick reference

### Deploy
```bash
# From local (uses .deploy/ssh_run.py — gitignored, contains VPS creds):
python .deploy/ssh_run.py "bash /root/deploy.sh"

# Or SSH in and run it yourself:
ssh root@192.3.81.151 'bash /root/deploy.sh'
```
Stages: pull → clean → build → PM2 reload → health.

### Live URLs
- **Marketing:** https://thecristinaadam.com (linktree + bio + journey)
- **Members:** https://members.thecristinaadam.com (signup/login/vault/chat)
- **Admin:** https://members.thecristinaadam.com/admin (creator only)
- **Shortlink:** https://thecristinaadam.com/r/cristina (302 → members register, logs Event)

### Default tab routing
| Path | Root domain | Members domain |
|---|---|---|
| `/` | Home (linktree + about) | → `/dashboard` if logged-in, else `/register` |
| `/gallery` | Public gallery | Public gallery (mirror) |
| `/blog` | Public blog | Public blog (mirror) |
| `/about` | Merged into Home (no route) | Merged into Home (no route) |
| `/privacy /terms /dmca /2257` | Routes exist, NOT linked in UI | Routes exist + linked in footer |
| `/register /login /forgot-password /reset-password /verify-email` | Redirect to members.* | Native |
| `/dashboard /chat /vault /admin` | Redirect to members.* | Native |

### Secrets (where they live)
- **Server:** `/var/www/cristina/server/.env` (chmod 600, root-only)
- **Client build-time:** `/var/www/cristina/client/.env.production`
- **Never in git** — `.gitignore` line 3 catches `.env` + `server/.env`

### Key Postgres config
```
Host:     127.0.0.1
Port:     5432
Database: cristina
User:     cristina
Network:  localhost-only (no remote access)
```

### Cron-able scripts
- `/root/deploy.sh` — full deploy
- `/root/clean-vps.sh` — re-runnable cruft strip
- `server/scripts/backup.sh` — pg_dump + S3/B2 upload (not scheduled yet)

---

## 5. Conventions

### Conversion CTAs on root (bot-safe)
| Spot | Copy | Why safe |
|---|---|---|
| Navbar | "Members" button | Universal word (gyms, golf clubs, news sites) |
| Home P.S. block | "There's more, if you want it" / "Come in →" | Newsletter-tier language, no flagged words |
| Scroll pill (60% threshold) | "Want the rest? · Come in →" | Bots don't scroll — never renders |
| Bio shortlink (`/r/cristina`) | Server 302 | Bots see a redirect, fans land on register |

### Adding a new creator (future, when multi-tenant ships)
1. Add Creator row in DB with slug, domain, theme, persona
2. Point DNS for new domain at the same VPS IP (Cloudflare proxy on)
3. Add nginx vhost(s) (root + members) referencing the same Node:5000
4. Deploy — no code changes needed once multi-tenant is wired

### When git pull on VPS happens
Auto-runs `/root/clean-vps.sh` via `post-merge` + `post-rewrite` hooks. No manual step.

---

*This file is the single status doc. Plan files for individual features (DOMAIN-SEPARATION-PLAN, BOT-FLEET-PLAN, etc.) have been consolidated here. Future feature plans go in `.planning/` (gitignored).*
