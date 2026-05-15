# SRS & FRS — Cristina Platform

**Last updated:** 2026-05-14
**Project:** White-label creator subscription platform (Fanvue-equivalent)
**Architecture:** One shared backend · one React codebase deployed per creator via `VITE_CREATOR_SLUG`
**Active branch:** `feature/v3-design-pivot`
**Dev credentials:** `cristina@example.com` / `admin123` · login at `http://localhost:5173/login`
**Ports:** Backend `5000` · Frontend `5173`

---

## Business model

**Freemium + PPV**, not subscription-first. Signup is free. Revenue comes from:
- **Per-bundle unlocks** (Vault bundle cards, creator-set prices)
- **Per-post unlocks** (standalone paid Vault posts, creator-set prices)
- **PPV chat messages** (creator-priced one-shots)
- **Fanvue redirect** (outbound CTA via the "Get Premium Access" modal — Fanvue handles its own subscription)

The `Subscription` model is still used but tier is always `free` — it functions as a "follower" record so the Messages inbox + analytics work. No monthly charge.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, TypeScript, React Router 7 |
| Backend | Node.js, Express, Socket.io |
| Database | SQLite (dev) → PostgreSQL (prod), Sequelize ORM |
| Auth | JWT — fans `{ userId, role:'fan' }`, creators `{ creatorId, role:'creator', slug }` |
| Storage | Local `/uploads/` (dev) → AWS S3 (prod) |
| Realtime | Socket.io rooms: `fan:${userId}`, `creator:${creatorId}` |
| Design system | `client/src/styles/theme-v3.css` — terracotta/navy/cream desktop · rose-gradient mobile |
| Fonts | Cormorant Garamond (display), DM Serif Display (heading), Inter (body) — Google Fonts |

---

## ✅ Done (current state)

### Backend models (`server/models/`)

| Model | Key fields |
|---|---|
| **Creator** | slug, displayName, email, passwordHash, bio, shortBio, profileImage, heroImages, galleryImages, subscriptionPrice, fanvueUrl, **logoUrl**, **featuredLinks**, **instagramPosts**, theme, links, seo, blog, faq, mustHaves, isLive, maintenanceMode, analytics |
| **User** (fan) | email, username, passwordHash, role |
| **Post** | creatorId, title, caption, mediaUrls[], mediaType, isPremium, isPinned, **collectionId**, price, publishAt, expiresAt, likesCount |
| **Collection** | creatorId, title, description, coverImage, price, isPublished |
| **Subscription** | userId, creatorId, **tier (now 'free')**, status, expiresAt — repurposed as a follower record |
| **Message** | creatorId, fanId, senderId, senderType, content, **mediaUrl**, isPPV, ppvPrice, isUnlocked, isRead |
| **Transaction** | userId, creatorId, type (`subscription` / `ppv_unlock` / `ppv_message` / **`collection_unlock`** / **`post_unlock`**), amount, referenceId, description |

**In-place migration helper** in `server/models/index.js` (`applyMigrations` → uses `queryInterface.addColumn` to add nullable cols without dropping data). Already-applied fields: `fanvueUrl`, `featuredLinks`, `instagramPosts`, `logoUrl`.

### Backend routes (`server/routes/`)

| Route file | Prefix | Endpoints |
|---|---|---|
| `authRoutes.js` | `/api/auth` | POST `/creator/login`, POST `/login`, POST `/register` |
| `creatorRoutes.js` | `/api/creator` | GET `/:slug`, PATCH `/:slug`, PATCH `/:slug/password`, GET `/:slug/analytics`, GET `/:slug/subscribers` |
| `postRoutes.js` | `/api/posts` | GET `/:slug` (gating: free / paid-w/-price / bundle-bound), POST `/`, PATCH `/:id`, DELETE `/:id`, POST `/:id/like`, **POST `/:id/unlock`** |
| `collectionRoutes.js` | `/api/collections` | GET `/:slug/all` (admin), GET `/:slug` (public, w/ isUnlocked + thumbs), POST `/`, PATCH `/:id`, DELETE `/:id`, PATCH `/:id/assign`, PATCH `/remove-post/:postId`, POST `/:id/unlock` |
| `subscriptionRoutes.js` | `/api/subscriptions` | POST `/subscribe` (now creates free tier · no charge), POST `/unsubscribe`, GET `/status/:slug`, GET `/my`, GET `/transactions` |
| `chatRoutes.js` | `/api/chat` | GET `/:slug` (fan history), GET `/:slug/inbox` (creator, filtered to active subs, w/ tier + memberSince), GET `/:slug/thread/:fanId`, POST `/:messageId/unlock`, POST `/:slug/blast` (w/ mediaUrl) |
| `instagramRoutes.js` | `/api/instagram` | GET `/:slug` (shortcode-derived stub — Instagram killed public embeds Q4 2024, see "Pending Phase 6") |

### Socket.io (`server/socket.js`)

- Auth handshake decodes JWT to populate `socket.user`
- Rooms: `fan:${userId}`, `creator:${creatorId}`
- Events: `fan_message`, **`creator_reply` (w/ mediaUrl)**, `creator_typing`, `fan_typing`
- All emit `new_message` to both involved rooms

### Frontend pages (`client/src/pages/`)

| Page | Route | State |
|---|---|---|
| `Home.tsx` | `/` | V3 redesign: terracotta-framed hero slider (cross-fade + dots) · WELCOME TO MY WORLD + bio + featured-link tile grid · Instagram-style sidebar (gallery + Follow CTA) · decorative leaves |
| `Vault.tsx` | `/vault` | Pink-marble mobile design · profile header + tagline · Bundles grid (unlock $X buttons) · standalone mixed-state lock-tile grid · MESSAGE-creator CTA when logged-in, Get-Premium-Access when not · bottom nav |
| `Chat.tsx` | `/chat` | Pink gradient header · CHAT WITH CRISTINA · asymmetric bubbles (creator rose / fan white) · PPV media tiles with blurred preview + Unlock CTA · emoji/+/send composer · bottom nav |
| `FanDashboard.tsx` | `/dashboard` | **NEW** from Nano mockup: pink header · "Hi, {name}" · 💬 MESSAGE CTA · Quick Stats card · Locked Bundles horizontal row · Latest Content 3-col grid · last-message preview · bottom nav |
| `Admin.tsx` | `/admin` | V3 cream/terracotta sidebar + colored stat cards · 11 tabs (Dashboard, Bio Builder, Analytics, Content, **Gallery**, Messages, Broadcast, Audience, Branding, Settings, Support) |
| `AdminMessages.tsx` | inside Admin | Two-column subscriber inbox + thread view · v3 cream palette · 3-zone PPV composer |
| `AdminBroadcast.tsx` | inside Admin | Mass-DM card · subscriber count · attach + PPV + Send Broadcast |
| `Login.tsx`, `Register.tsx` | `/login`, `/register` | V3 cream cards · terracotta CTAs · fan registration → `/dashboard` |
| Public pages | `/gallery`, `/blog`, `/about` | Functional, **still on legacy dark theme** (re-skin pending) |

### Components (`client/src/components/`)

| Component | Used by |
|---|---|
| `Navbar.tsx` | Hides on `/chat`, `/vault`, `/dashboard`. Renders logo if `config.logoUrl` set, falls back to wordmark. |
| `Footer.tsx` | Terracotta band, social icons, copyright. Hides on mobile-rose pages. |
| `MobileBottomNav.tsx` | Home/Chat/Vault tabs on rose-themed pages. |
| `JoinPremiumModal.tsx` | "Get Premium Access" CTA modal — hero gradient header + 💎 Fanvue / ✨ Join Free options + secure footer. |
| `SocialIcons.tsx` | 9 platform SVG glyphs (Instagram, TikTok, YouTube, Twitter, Threads, Pinterest, Shop, Document, Handshake). |
| `HeroSlider.tsx` | Auto-advancing cross-fade slider with dot navigation, Ken Burns scale. |
| `InstagramFeed.tsx` | Gallery-based 3×3 grid + "Follow on Instagram" pink-gradient CTA. (Real auto-sync deferred — see Phase 6.) |
| `DragDropUpload.tsx` | Reusable drag-and-drop file picker. Multi-file, drop-zone visual feedback. |
| `PostCard.tsx` | Vault post grid card (still old dark-themed — re-skin pending). |
| `SubscribeModal.tsx` | Legacy — slated for removal (replaced by JoinPremiumModal). |
| `AgeGate.tsx` | First-visit age gate overlay. |

### Admin tab matrix

| Tab | Built? | Notes |
|---|---|---|
| Dashboard | ✅ | Colored stat cards (pink/dark/peach/blush) + traffic breakdown. Sparklines + Quick Insights chart still pending. |
| **Bio Builder** | ✅ | Logo upload · Social Links · Featured Tiles · Instagram Posts placeholder. Save → applies to home page. |
| Analytics | 🟡 stub | "Coming soon" placeholder. Detailed charts pending. |
| Content | ✅ | Bundles CRUD · Post upload (drag-drop) · per-post Paid+price toggle · Add-to-bundle dropdown · post list w/ Members/Pin/Delete actions. |
| **Gallery** | ✅ | Hero Slider Images + Gallery Images, drag-drop multi-upload, per-tile remove. Moved out of Settings. |
| Messages | ✅ | Section-3 redesign (subscriber inbox, thread view, PPV media composer). |
| Broadcast | ✅ | Mass DM card with attach + PPV + Send. |
| Audience | 🟡 stub | "Coming soon" placeholder. |
| Branding | 🟡 stub | "Coming soon" placeholder. Logo currently lives in Bio Builder; will migrate here later with colors + fonts. |
| Settings | ✅ | Profile · Fanvue Integration card · Appearance · SEO · Social links · Blog · Security · Maintenance. (Hero/Gallery removed → now in Gallery tab.) |
| Support | 🟡 stub | "Coming soon" placeholder. |

### Design system (`client/src/styles/theme-v3.css`)

- **Palette tokens:** `--v3-terracotta`, `--v3-navy`, `--v3-cream`, `--v3-rose-{50,100,200,300,400}`, `--v3-gold`, `--v3-ink`, `--v3-line`, status colors.
- **Typography:** display = Cormorant Garamond italic, heading = DM Serif Display, body = Inter.
- **Reusable classes:** `v3-btn`, `v3-btn-primary`, `v3-btn-outline`, `v3-card`, `v3-stat`, `v3-link-tile.{terracotta,navy}`, `v3-bubble.{creator,fan}`, `v3-lock-tile`, `v3-admin-*`, `v3-dash-*`, `v3-modal-*`, `v3-bio-row`, `v3-ig-feed`.
- **Activation:** `body.v3` class added globally in `App.tsx`.
- **Legacy overrides:** `body.v3 .av2-*` overrides force the old dark theme to cream/terracotta inside the admin shell — applies until the legacy markup is fully rewritten.

### Recent feature commits

| SHA | Title |
|---|---|
| `b7995ec` | feat: v3 design + freemium pivot + Get Premium Access + Fan Dashboard + Bio Builder |
| `60a7ce9` | fix(home): pivot IG feed to gallery + Follow CTA (Instagram killed embeds) |
| `1271784` | feat(admin): Gallery tab + drag-and-drop file uploads |
| `07aa98b` | feat(brand): logo upload in Bio Builder + display in Navbar & Admin sidebar |

---

## 🟡 In progress / partial

- **Admin Dashboard "Bio Links" table** (Linktree-style with drag handles + click counts) — mockup exists, not built. Would need a `BioLink` model + a `/go/:id` click-tracking redirect endpoint.
- **Quick Insights weekly traffic chart** — mockup exists, not built. Needs daily aggregation backend + a chart lib (recharts or victory-native-web).
- **Top Performing Content panel** — right-column panel in mockup, not built. Pulls from existing posts/transactions, just needs the UI.
- **Sparklines on stat cards** — current cards are static; mocked sparkline shapes are inline SVG paths.
- **Bundle drag-to-reorder, Post drag-to-reorder.** Add/Remove already works.
- **Legacy dark-themed pages** still un-restyled: `Gallery`, `Blog`, `About`, `PostCard`.

---

## 🔨 Pending (planned, not started)

### Phase 5 — UI polish carryover
- Restyle `Gallery.tsx`, `Blog.tsx`, `About.tsx`, `PostCard.tsx` to v3 cream/terracotta.
- Remove `SubscribeModal.tsx` (superseded by `JoinPremiumModal.tsx`).
- Optional: drag-to-reorder for bundles, posts, featured tiles, hero slider, gallery images.

### Phase 6 — Payments (multi-provider)
Per user direction: **Path C** — provider-agnostic abstraction with multiple plugins (PayPal, Card, Crypto), then layer in real money. Today every transaction is a mock-recorded row in `Transactions`.

| Step | Description |
|---|---|
| 6.1 | `server/payments/PaymentProvider.js` interface + `server/payments/providers/mock.js` (current behavior). |
| 6.2 | `nowpayments.js` plugin — crypto-first, no KYC headache, works pre-launch. |
| 6.3 | `stripe.js` plugin — cards (Stripe Checkout) for non-adult content. |
| 6.4 | `paypal.js` plugin — PayPal JS SDK. |
| 6.5 | `ccbill.js` plugin — adult-friendly card processor (built only if Path A scope expands). |
| 6.6 | Real-money switchover for `/subscriptions/subscribe` (still free), `/posts/:id/unlock`, `/collections/:id/unlock`, `/chat/:id/unlock`, blast PPV. |
| 6.7 | Webhook receivers for renewals / refunds / chargebacks. |

### Phase 7 — Instagram Basic Display API (Option A)
Documented in `docs/instagram-option-a-setup.pdf`. Replaces the gallery fallback feed with real auto-syncing IG posts.

| Step | Description |
|---|---|
| 7.1 | Creator does steps 1–6 from the PDF on Meta's developer console. |
| 7.2 | Backend adds `Creator.instagramAccessToken`, `instagramTokenExpiry`, `instagramUserId`, `instagramUsername`. |
| 7.3 | OAuth flow: `GET /api/instagram/oauth/start` → `callback` → exchange code → save long-lived token. |
| 7.4 | Replace shortcode-stub fetch with Graph API media endpoint. 1-hour cache. |
| 7.5 | Background job: refresh tokens before expiry (60-day window). |
| 7.6 | Deauthorize + data-deletion callback stubs (required by Meta). |

### Phase 8 — Production hardening
- AWS S3 for media storage + signed URLs for premium content (right now `/uploads/` paths are scrapable).
- PostgreSQL instead of SQLite (Sequelize-compatible; minor config swap).
- Migrate schema changes from `applyMigrations` helper to real Sequelize migrations.
- Per-creator subdomain CORS allow-listing.
- `helmet`, `express-rate-limit`, input sanitization.
- Email verification + minimal KYC for fan signup.
- Custom domain support per creator.
- Push notifications: web push + SendGrid email.

### Phase 9 — Stretch features
- Scheduled / drip posts (the `Post.publishAt` field already exists — just needs UI + a tick job).
- Referral tracking links.
- Creator-side revenue charts (combined `Transactions` view by week/month).
- Bio Link click tracking (`/go/:slug` redirect + counter).
- Tipping (one-off Transaction with `type: 'tip'`).
- Multi-tier subscription (re-introduce as an option for creators who want it).

---

## File map (current truth)

```
Blog/
├── SRS_FRS_DOCUMENT.md            ← this file
├── TECHNICAL_GUIDE.md             ← v1 reference
├── FUNNEL_MARKETING_PLAN.md
├── docs/
│   ├── instagram-option-a-setup.pdf
│   └── superpowers/plans/
│       ├── 2026-05-14-admin-design-consistency.md
│       └── 2026-05-14-homepage-feature-polish.md
├── scripts/
│   └── generate-instagram-pdf.py
├── server/
│   ├── index.js                   ← Express app + Socket.io + traffic tracker
│   ├── socket.js                  ← Socket.io event handlers (creator_reply with mediaUrl)
│   ├── database.js                ← Sequelize SQLite connection
│   ├── data/
│   │   ├── platform.db            ← SQLite DB (delete to nuke)
│   │   └── config.json            ← Legacy v1 config (unused by v2)
│   ├── scripts/seed.js
│   ├── models/
│   │   ├── index.js               ← Associations + syncDatabase() + applyMigrations()
│   │   ├── Creator.js             ← + fanvueUrl, logoUrl, featuredLinks, instagramPosts
│   │   ├── User.js
│   │   ├── Post.js
│   │   ├── Collection.js
│   │   ├── Subscription.js        ← tier is now 'free'
│   │   ├── Message.js             ← + mediaUrl
│   │   └── Transaction.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── creatorRoutes.js
│   │   ├── postRoutes.js          ← + POST /:id/unlock, feed gating rewritten
│   │   ├── collectionRoutes.js    ← public endpoint returns isUnlocked + thumbs
│   │   ├── subscriptionRoutes.js  ← free tier only, no payment
│   │   ├── chatRoutes.js          ← inbox filters to active subs + tier/memberSince
│   │   └── instagramRoutes.js     ← shortcode stub (Option A pending)
│   └── middleware/
│       └── authMiddleware.js
│
└── client/
    ├── .env                       ← VITE_API_URL, VITE_CREATOR_SLUG
    └── src/
        ├── App.tsx                ← adds `body.v3` class, routes
        ├── api.ts                 ← normalize/denormalize for logoUrl, fanvueUrl, featuredLinks, instagramPosts
        ├── pages/
        │   ├── Home.tsx           ← v3 hero slider + welcome + featured tiles + IG feed
        │   ├── Vault.tsx          ← pink design, mixed free/paid + bundles + bottom nav
        │   ├── Chat.tsx           ← pink rose + asymmetric bubbles
        │   ├── FanDashboard.tsx   ← NEW post-signup landing
        │   ├── Admin.tsx          ← v3 admin shell · 11 tabs
        │   ├── AdminMessages.tsx
        │   ├── AdminBroadcast.tsx
        │   ├── Login.tsx          ← v3 cream card
        │   ├── Register.tsx       ← v3 cream card
        │   ├── Gallery.tsx        ← legacy dark (re-skin pending)
        │   ├── Blog.tsx           ← legacy dark (re-skin pending)
        │   └── About.tsx          ← legacy dark (re-skin pending)
        ├── components/
        │   ├── Navbar.tsx         ← logo image or wordmark fallback
        │   ├── Footer.tsx
        │   ├── MobileBottomNav.tsx
        │   ├── JoinPremiumModal.tsx
        │   ├── SocialIcons.tsx
        │   ├── HeroSlider.tsx
        │   ├── InstagramFeed.tsx  ← gallery + Follow CTA
        │   ├── DragDropUpload.tsx ← reusable drop-zone
        │   ├── PostCard.tsx       ← legacy dark (re-skin pending)
        │   ├── SubscribeModal.tsx ← legacy (slated for removal)
        │   └── AgeGate.tsx
        └── styles/
            ├── main.css           ← legacy + av2-* shell (still used)
            └── theme-v3.css       ← V3 design system + overrides
```

---

## How to run locally

```powershell
# Terminal 1 — Backend
cd server
node index.js

# Terminal 2 — Frontend
cd client
npm run dev
```

If port 5000 is in use:
```powershell
Stop-Process -Name "node" -Force
```

To reset the DB (rare — migrations are now non-destructive):
```powershell
Stop-Process -Name "node" -Force
Remove-Item server\data\platform.db
cd server
node scripts/seed.js
node index.js
```

---

## Next session priorities

1. **Admin Dashboard buildout** — Bio Links table, sparklines, Quick Insights chart, Top Performing Content panel.
2. **Re-skin remaining legacy pages** (Gallery, Blog, About, PostCard) to v3.
3. **Phase 6.1** — `PaymentProvider` interface + `mock.js` provider in `server/payments/` (no real money yet, just the abstraction so later providers are plug-ins).
