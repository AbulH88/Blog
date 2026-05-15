# HANDOFF — Cristina Platform (V3 design + freemium pivot)

> **For the next agent picking this up:**
> Read this file first. Then `README.md` for the product overview, `SRS_FRS_DOCUMENT.md` for the full technical inventory.

**Active branch:** `feature/v3-design-pivot`
**Worktree path:** `C:\Users\jimi\Documents\APP\Blog\.claude\worktrees\upbeat-keller-f96724`
**Last commit (session end):** `c509eb2` — compliance bundle
**Remote:** https://github.com/AbulH88/Blog

---

## 🎯 The North-Star Goal

**This is being built as a multi-tenant platform for the user's future AI-influencer accounts.**

Right now there's one creator seeded (`cristina`). The user plans to spin up multiple creators (each one an AI persona on Instagram) and deploy each as its own frontend pointing at the shared backend. The backend was designed with this in mind — every model has a `creatorId` foreign key, the auth system distinguishes creator vs. fan, and the frontend reads `VITE_CREATOR_SLUG` to know which tenant it's rendering.

**Implication for the next agent:** when adding features, always think "would this work if there were 10 creators in the DB?" Don't add `if (slug === 'cristina')` shortcuts.

---

## 📍 Current State (as of session end)

### ✅ What's shipped on `feature/v3-design-pivot`

1. **Full V3 design system** — terracotta/cream (desktop) + rose-pink (mobile) · serif italic display fonts · `theme-v3.css` is the single source of truth · `body.v3` class activates it globally
2. **Freemium pivot** — subscriptions are now free "follower" records (no monthly charge). Revenue flows from: per-bundle unlocks · per-post unlocks · PPV chat · Fanvue redirect
3. **Every public + fan page rebuilt:** Home · Gallery (masonry + lightbox) · Blog (Journal) · About (polaroid timeline) · Vault (admin-shell desktop, pink mobile) · Chat (admin-shell desktop, pink mobile) · Fan Dashboard (admin-shell desktop, pink mobile) · Login · Register
4. **Admin Dashboard** — full sidebar with 11 tabs · Bio Links table (drag handles, status pills, click counts) · sparkline stat cards · Quick Insights weekly chart · Top Performing Content · **Top Spenders** mini-panel
5. **Audience tab** (was "Coming soon") — full fans table with per-fan spend / purchase count / message count / last-active · live search + sort · Recent Purchases activity feed
6. **Bio Builder tab** — logo upload · social links · featured tile editor · Instagram posts placeholder
7. **Gallery tab** — Hero slider + Gallery image management with drag-and-drop multi-upload
8. **Get Premium Access modal** — pink gradient hero · two option cards (💎 Watch on Fanvue / ✨ Join Free Here) · Fanvue option auto-hides when `Creator.fanvueUrl` is empty
9. **Compliance bundle (THE LATEST WORK):**
   - Enhanced AgeGate (blocking modal with checkbox + ToS/Privacy/2257 links)
   - `/terms` — Terms of Service (14 sections, placeholder `[STATE]` / `[COUNTY]`)
   - `/privacy` — Privacy Policy (12 sections, mentions discreet billing)
   - `/2257` — 18 U.S.C. § 2257 Compliance Statement (placeholder `[Custodian Name]` etc.)
   - Easy "Cancel my account" button in Fan Dashboard sidebar (red, confirm dialog, calls `unsubscribe()`)
   - `Creator.billingDescriptor` field (22-char max, neutral statement descriptor like `CRISTINA`) — set in Admin → Settings
10. **Documentation** — `README.md` (status overview) · `SRS_FRS_DOCUMENT.md` (full SRS) · `docs/instagram-option-a-setup.pdf` (Meta App OAuth setup guide for future Instagram API integration) · `docs/superpowers/plans/` (two design plans from earlier sessions)

### 🔵 Still TODO (small polish — should fit in 1 session)

- Drag-to-reorder for posts inside Content tab (Bio Links table already has up/down arrows)
- Drag-to-reorder for bundles, gallery images, hero slider images
- Delete dead `client/src/components/SubscribeModal.tsx` (superseded by `JoinPremiumModal`)
- Delete dead `client/src/components/PostCard.tsx` (superseded by `VaultTile`)
- Optimistic UI for chat send (currently waits for socket round-trip before showing the message)

### 🟡 PHASE 6 — Real payments (the next major workstream)

User has decided on these processors:
- **🪙 Crypto:** NOWPayments → https://nowpayments.io
- **💳 Cards:** Segpay → https://segpay.com *(switched from CCBill — Segpay is 24-72hr approval vs CCBill's 2-4 weeks, same fees)*

**The plan (agreed with user):**

| Phase | Description | Days |
|---|---|---|
| **6.1** | `server/payments/PaymentProvider.js` interface + `mock.js` provider (current behavior, kept for dev). Switch all unlock endpoints to call `PaymentProvider.x()` instead of recording transactions directly. | 0.5 |
| **6.2** | NOWPayments plugin — ship first (instant signup, no KYC). Build the OAuth-like create-invoice → redirect-to-pay-url → webhook-confirms flow. | 1 |
| **6.3** | Saved Payment Methods UX — settings page where fans add a card once, then every unlock is one-tap "Pay $4.99 with •••• 4242". **This is the #1 conversion lever** — every Fanvue/OnlyFans creator's revenue depends on it. | 2 |
| **6.4** | Segpay plugin — cards. Use their hosted iframe for PCI compliance. Set statement descriptor to `Creator.billingDescriptor`. | 2 |
| **6.5** | Webhooks — `POST /api/payments/webhook/{provider}`. Transaction stays `status: 'pending'` until webhook fires and verifies. Refunds + chargebacks handled here. | 1 |
| **6.6** | Tipping — `POST /api/payments/tip` with amount picker ($5/$10/$25/custom). Adds `Transaction { type: 'tip' }`. Wire into Chat composer. | 0.5 |
| **6.7** | (defer) Multi-processor routing — decline fallback, country-based routing. Wait until $1k+/day flowing. | 3 |

**Total to MVP real payments: ~7 days dev.**

### 🟡 PHASE 7 — Instagram auto-sync

The user has the setup guide PDF (`docs/instagram-option-a-setup.pdf`). When they're ready to spend 15 min on Meta's dev portal, the OAuth flow needs to be wired up. **Wait for the user to provide `INSTAGRAM_APP_ID` + `INSTAGRAM_APP_SECRET` env vars** before doing this phase.

### 🟡 PHASE 8 — Production hardening

When the user is ready to actually deploy:
- AWS S3 for media storage + signed URLs for premium content
- PostgreSQL instead of SQLite
- Migrate `applyMigrations` helper to real Sequelize migrations
- `helmet` security headers + `express-rate-limit`
- Email verification + minimal KYC for fan signup
- Per-creator subdomain CORS allow-listing
- Custom domain support per creator (this is where multi-tenant gets real)
- Push notifications (web push + SendGrid)

### 🟢 PHASE 9 — Stretch features

Documented in README and SRS — scheduled/drip posts, referral links, revenue charts, comments on Vault posts, multi-tier subscription as opt-in, etc.

---

## 🧠 Key Decisions Made (so you don't ask the user again)

| Decision | What | Why |
|---|---|---|
| **Freemium not subscription** | Signup is free. Revenue from per-content unlocks + PPV. | Top Fanvue/OF creators get 80% of revenue from PPV, not subs. Free signup = higher conversion. |
| **Two payment paths from day 1** | Modal lets fan choose Fanvue OR direct | Fan picks comfort level. Whales pay direct (95% margin), casual fans pay via Fanvue (70% margin). User's IG is brand-safe with custom site as the funnel. |
| **NOWPayments + Segpay** | Skipped CCBill (slower approval), Stripe/PayPal (will ban adult content) | Segpay = 24-72hr approval. NOWPayments = 5-min signup. |
| **Custom domain funnel** | User's IG bio links to their custom site, not Fanvue directly | IG algorithm doesn't recognize the domain as adult, so reach isn't suppressed. Site has age gate, then Premium modal. |
| **One backend, many frontends** | Each creator is one row in `Creators` table. Each frontend deployment sets `VITE_CREATOR_SLUG`. | Future multi-tenant goal — user will spin up multiple AI influencer accounts. |
| **In-place migrations** | `applyMigrations` helper uses `queryInterface.addColumn` for nullable adds | No DB resets during dev. Real migrations come in Phase 8. |
| **Mobile pages have their own shell** | Vault, Chat, Dashboard all have admin-style sidebar on desktop and immersive pink design on mobile | Best UX per surface. Mobile users get app-like experience; desktop gets SaaS-like nav. |
| **Bottom nav: 3 tabs** | Home / Chat / Vault. Skipped Shop and Contact. | User said: "skip both for now" (Shop is coming soon, Contact is being removed). |
| **Gallery is its own admin tab** | Was inside Settings, moved out | User specifically requested this. Drag-and-drop multi-upload added. |
| **All passwords stored bcrypt** | Cost factor 12 | Standard. |

---

## 🧪 Test Accounts (already seeded)

| Role | Email | Password | Redirects to |
|---|---|---|---|
| Creator | `cristina@example.com` | `admin123` | `/admin` |
| Fan | `fan@example.com` | `fanpass123` | `/dashboard` |

The fan account has been pre-seeded with **5 transactions totaling $40.95** + **2 messages from the creator** (one regular welcome, one PPV at $4.99) so the Audience tab + Top Spenders panel + Recent Message preview all show real data.

---

## 🚀 How to run

```powershell
# Terminal 1
cd server && node index.js     # http://localhost:5000

# Terminal 2
cd client && npm run dev       # http://localhost:5173
```

Both servers were running at session end. If they're down, the user can restart with the commands above. Vite has HMR so frontend changes auto-reload. Backend changes need a manual restart.

**Database:** SQLite at `server/data/platform.db`. Don't delete unless you need a full reset — migrations are non-destructive via `applyMigrations()` in `server/models/index.js`.

---

## 📂 Important file pointers (so you don't have to grep)

| Need | File |
|---|---|
| Design tokens + utility classes | `client/src/styles/theme-v3.css` |
| Routes + body class activation | `client/src/App.tsx` |
| API helpers (normalize/denormalize, all fetches) | `client/src/api.ts` |
| Admin shell + all tabs (Dashboard, Bio Builder, etc.) | `client/src/pages/Admin.tsx` (~1500 lines, the biggest file — break it up someday) |
| Fan Dashboard | `client/src/pages/FanDashboard.tsx` (renders BOTH mobile + desktop shell with CSS hiding) |
| Vault | `client/src/pages/Vault.tsx` (same pattern) |
| Chat | `client/src/pages/Chat.tsx` (same pattern) |
| Compliance pages | `client/src/pages/Terms.tsx`, `Privacy.tsx`, `Compliance2257.tsx` |
| Age gate | `client/src/components/AgeGate.tsx` |
| Get Premium Access modal | `client/src/components/JoinPremiumModal.tsx` |
| Drag-drop upload (reusable) | `client/src/components/DragDropUpload.tsx` |
| Vault tile (FREE / PAID / BUNDLE variants) | `client/src/components/VaultTile.tsx` |
| Mobile bottom nav | `client/src/components/MobileBottomNav.tsx` |
| Social SVG icons | `client/src/components/SocialIcons.tsx` |
| Hero slider | `client/src/components/HeroSlider.tsx` |
| IG feed (gallery fallback) | `client/src/components/InstagramFeed.tsx` |
| All backend routes | `server/routes/*.js` (`authRoutes`, `creatorRoutes`, `postRoutes`, `collectionRoutes`, `subscriptionRoutes`, `chatRoutes`, `instagramRoutes`) |
| Real-time chat socket | `server/socket.js` |
| Models + in-place migration helper | `server/models/index.js` |
| Creator model (look here for fields) | `server/models/Creator.js` |

---

## ⚠️ Gotchas + Things to Know

1. **CRLF warnings on commit** — Windows line endings on git add. Harmless, ignore.
2. **Vite stale cache** — If the user reports "I don't see changes," tell them to hard refresh (Ctrl+Shift+R). Vite HMR misses occasionally.
3. **node_modules tracked in git** — They were committed by a previous agent. Don't try to fix this without asking the user first.
4. **`server/.env` is gitignored** — When testing, `JWT_SECRET` and `INSTAGRAM_*` envs are read from there. If a fresh worktree is broken, copy the file from the parent repo.
5. **Mobile + desktop layouts coexist in the same JSX** — On `/dashboard`, `/chat`, `/vault` the component renders BOTH mobile (single column) and desktop shell (sidebar + main). CSS hides one based on viewport. Don't be confused by duplicate JSX.
6. **Navbar visibility logic** — Global Navbar + Footer hide on `/dashboard`, `/chat`, `/vault` (their own shells handle navigation). See `client/src/components/Navbar.tsx` and `Footer.tsx`.
7. **Auto-follow on register** — `POST /api/auth/register` creates a free Subscription row for every Creator in the DB. This is so new fans immediately appear in creator inboxes. Re-check this works correctly when multi-tenant launches.
8. **The `instagramRoutes.js` endpoint is a stub** — Instagram disabled public iframe embeds in Q4 2024. The current implementation just builds embed URLs from shortcodes (which 404 / show "removed" pages). The real fix is OAuth via Basic Display API (Phase 7). The InstagramFeed component falls back to creator gallery + "Follow on Instagram" CTA.
9. **Legal placeholder text** — Terms / Privacy / 2257 all have `[BRACKETED]` placeholders the user needs to fill in before going live with real payments. Don't auto-fill these without user input — they're legal info specific to the operator.
10. **PR is not created** — The branch is fully pushed but no PR was opened (the `gh` CLI isn't installed locally). User said they understand what a PR is now. They can open one manually at https://github.com/AbulH88/Blog/pull/new/feature/v3-design-pivot or via `gh pr create` if they install the CLI.

---

## 🧭 Suggested Order of Next Tasks

If the user says "continue":

1. **Confirm priority with them.** Default = Phase 6.1 (PaymentProvider abstraction). But they might want to do small polish first, or skip straight to Phase 8 deployment work.

2. **If Phase 6:**
   - Build `server/payments/PaymentProvider.js` interface
   - Build `mock.js` provider (current behavior — no money, just records Transaction)
   - Refactor `/posts/:id/unlock`, `/collections/:id/unlock`, `/chat/:id/unlock` to call the provider
   - Then add `nowpayments.js` plugin
   - Ask user for `NOWPAYMENTS_API_KEY` env var when they sign up at https://nowpayments.io

3. **If small polish first:**
   - Delete `SubscribeModal.tsx` + `PostCard.tsx`
   - Add `react-beautiful-dnd` or similar for drag-reorder (the up/down arrows in Bio Links table are a stopgap)
   - Optimistic chat send

4. **If multi-tenant work:**
   - Add a "Create New Creator" admin UI (super-admin role, maybe just on creator dashboard for now)
   - Per-creator subdomain logic (`cristina.platform.com`, `aria.platform.com`)
   - Test creating a second creator and seeing only their content/fans

---

## 📋 What the User Cares About (Tone Notes)

- **They want it shipped, not perfect.** Don't get stuck polishing. Move forward.
- **They're not deeply technical.** Explain in layman's terms when discussing decisions. Use tables. Bullet points. Bold the decision.
- **They like AskUserQuestion for important branches.** Use it when there's a real choice to make.
- **They want commits/pushes after each meaningful chunk.** Don't accumulate 10 changes before pushing.
- **They prefer SHORT commit messages but DETAILED PR descriptions.**
- **They're building a real business, not a learning project.** Decisions should optimize for shipping revenue-generating product.
- **They responded well to:** mockups for design discussions, before/after explanations, "honest take" sections, real-cost trade-off tables.
- **They got frustrated when:** explanations were too long, options were given without recommendations, mobile design was just shrunk-down on desktop.

---

## 🛟 If something looks broken

| Symptom | Likely cause | Fix |
|---|---|---|
| `/dashboard` shows mobile design on desktop | Stale browser cache | Hard refresh Ctrl+Shift+R |
| `/api/...` returns 000 / connection refused | Backend not running | `cd server && node index.js` |
| `Cannot find module 'sequelize'` | Worktree node_modules not installed | `cd server && npm install` |
| Vite shows `Failed to resolve import` | Component file missing from worktree (worktree was created from older commit) | Copy missing file from `C:\Users\jimi\Documents\APP\Blog\client\src\components\` to worktree |
| Logo doesn't show | `Creator.logoUrl` is null | Upload it in Admin → Bio Builder → Logo card |
| Get Premium modal only shows one option | `Creator.fanvueUrl` is null | Set it in Admin → Settings → Fanvue Integration card |
| Audience tab is empty | New install, no fans yet | Register a fan, or run the seed snippet in `server/` (search HANDOFF for the node -e block from earlier sessions) |

---

## Latest commits on `feature/v3-design-pivot`

```
c509eb2 feat(compliance): age gate · terms · privacy · 2257 · cancel · billing descriptor
9f1a142 feat(admin): Audience tab with fan list, spend totals + Top Spenders
f5c8ba1 docs: re-encode README as UTF-8 (was UTF-16, GitHub treated as binary)
def2ba7 docs: rewrite README — status doc with done / left / quick-start
5347ec0 feat(vault): admin-style shell on desktop · mobile preserved
a70d91e fix(chat): rebuild desktop layout with admin-style shell
077aad5 feat(fan-dashboard): admin-style shell layout on desktop
88620ae feat(ui): true responsive for Dashboard/Vault/Chat — desktop layouts
ae22516 fix(ui): center mobile-first pages on desktop + auto-follow on register
2bd14b2 feat(ui): Blog + About + VaultTile redesigns from Nano mockups
ca99039 feat(admin): dashboard buildout — Bio Links + sparklines + Quick Insights + Top Content
ae82079 feat(gallery): v3 masonry redesign with lightbox + category chips
f11ff7d docs: rewrite SRS for current freemium + V3 state · bump logo display size
07aa98b feat(brand): logo upload in Bio Builder + display in Navbar & Admin sidebar
1271784 feat(admin): Gallery tab + drag-and-drop file uploads
60a7ce9 fix(home): pivot IG feed to gallery + Follow CTA (Instagram killed embeds)
b7995ec feat: v3 design + freemium pivot + Get Premium Access + Fan Dashboard + Bio Builder
44ae1c1 feat: messages page + broadcast + bundle UI (SRS sections 3 & 4)
```

---

**Welcome to the project. Read README.md + this file. You're caught up. Continue from where the user wants to go.**
