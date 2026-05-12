# Software Requirements Specification (SRS) & Functional Requirements Specification (FRS)

**Last updated:** 2026-05-13  
**Project:** White-label creator subscription platform (OnlyFans/Fanvue equivalent)  
**Architecture:** One shared backend · One React codebase deployed per creator via `VITE_CREATOR_SLUG`

---

## Project Overview

Transforms a simple Instagram bridge page into a fully self-hosted, multi-tenant subscription platform. One Node.js/Express/SQLite backend serves multiple creator deployments. Each frontend deployment is a separate Vite build with its own `.env` (`VITE_CREATOR_SLUG`, `VITE_API_URL`).

**Dev credentials (seed data):**
- Email: `cristina@example.com` · Password: `admin123`
- Login at: `http://localhost:5173/login`

**Ports:** Backend `5000` · Frontend `5173`

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, TypeScript, React Router 7 |
| Backend | Node.js, Express, Socket.io |
| Database | SQLite (dev) → PostgreSQL (prod), Sequelize ORM |
| Auth | JWT — fans `{ userId, role:'fan' }`, creators `{ creatorId, role:'creator', slug }` |
| Storage | Local `/uploads/` (dev) → AWS S3 (prod) |
| Realtime | Socket.io rooms: `fan:${userId}`, `creator:${creatorId}` |

---

## 1. Completed Work

### 1.1 Backend Models (`server/models/`)

| Model | File | Key Fields |
|---|---|---|
| Creator | `Creator.js` | slug, displayName, shortBio, bio, profileImage, heroImages[], galleryImages[], links{}, theme{}, seo{}, subscriptionPrice, subscriptionPricePremium, maintenanceMode |
| User (fan) | `User.js` | email, username, passwordHash, role |
| Post | `Post.js` | creatorId, title, caption, mediaUrls[], mediaType, isPremium, isPinned, collectionId, price, publishAt, expiresAt, likesCount |
| Collection | `Collection.js` | creatorId, title, description, coverImage, price, isPublished |
| Subscription | `Subscription.js` | userId, creatorId, tier (basic/premium), status (active/cancelled), expiresAt |
| Message | `Message.js` | creatorId, fromUserId, senderType, content, mediaUrl, isPPV, ppvPrice, isUnlocked |
| Transaction | `Transaction.js` | userId, creatorId, type (subscription/ppv_unlock/collection_unlock), amount, referenceId, description |

**Important:** Database uses `sequelize.sync()` (no `alter:true`). Any schema change requires deleting `platform.db` and reseeding:
```powershell
Stop-Process -Name "node" -Force
Remove-Item server\platform.db
cd server && node scripts/seed.js
```

### 1.2 Backend Routes (`server/routes/`)

| Route file | Prefix | Key endpoints |
|---|---|---|
| `authRoutes.js` | `/api/auth` | POST /creator/login, POST /login (fan), POST /register |
| `creatorRoutes.js` | `/api/creator` | GET /:slug, PATCH /:slug, GET /:slug/analytics |
| `postRoutes.js` | `/api/posts` | GET /:creatorSlug (public feed + gating), POST / (upload), PATCH /:id, DELETE /:id, POST /:id/like |
| `collectionRoutes.js` | `/api/collections` | GET /:slug/all (admin), GET /:slug (public), POST /, PATCH /:id, DELETE /:id, PATCH /:id/assign, PATCH /remove-post/:postId, POST /:id/unlock |
| `subscriptionRoutes.js` | `/api/subscriptions` | POST /subscribe, POST /unsubscribe, GET /status/:slug, GET /my, GET /transactions |
| `chatRoutes.js` | `/api/chat` | GET /:slug (fan history), POST /:slug (fan send), GET /:slug/inbox (creator), GET /:slug/thread/:fanId, POST /:slug/blast, POST /:messageId/unlock |

### 1.3 Content Gating Logic

Posts feed (`GET /api/posts/:creatorSlug`) applies this gating:
1. Active subscriber → all posts unlocked
2. Post in a collection the fan has unlocked (`collection_unlock` Transaction) → unlocked
3. `isPremium` or in any collection → `isLocked: true`, `mediaUrls: []`
4. Free post → shown as-is

### 1.4 Socket.io (`server/socket.js`)

- Creator connects with `adminToken` → joins `creator:${creatorId}` room
- Fan connects with `fanToken` → joins `fan:${userId}` room
- Events: `fan_message` (fan sends), `creator_reply` (creator sends with optional PPV), `creator_typing`

### 1.5 Frontend Pages (`client/src/pages/`)

| Page | Route | Description |
|---|---|---|
| `Home.tsx` | `/` | Hero slider, short bio, CTA |
| `Gallery.tsx` | `/gallery` | Public gallery images |
| `About.tsx` | `/about` | Full bio |
| `Vault.tsx` | `/vault` | Post feed — locked/unlocked based on subscription |
| `Chat.tsx` | `/chat` | Fan-side chat: history, send messages, PPV unlock |
| `Login.tsx` | `/login` | Creator login (saves `adminToken`) |
| `FanLogin.tsx` | `/fan-login` | Fan login (saves `fanToken`) |
| `Admin.tsx` | `/admin` | Creator dashboard (see below) |

### 1.6 Admin Dashboard (`client/src/pages/Admin.tsx`)

- Dark/light theme toggle — persisted to `localStorage('adminTheme')`
- 3 tabs: **Overview** (analytics stats + traffic), **Content** (post upload + post list), **Settings** (profile, media, appearance, SEO, social links, blog, security, maintenance mode)
- Mobile: sidebar hidden, fixed bottom nav with 3 tabs
- `<AdminFloatingChat>` rendered as fixed overlay (to be replaced — see Section 3)

### 1.7 Current Floating Chat (`client/src/components/AdminFloatingChat.tsx`)

**This component is a stopgap and must be replaced by the Messages page in Section 3.**
- Purple 💬 FAB fixed bottom-right
- Inbox panel with Mass DM section + conversation list
- Individual chat windows (up to 3) stacked left of FAB
- PPV toggle per message with price field
- No media attachment support
- Socket.io connected with `adminToken`

### 1.8 Client API Layer (`client/src/api.ts`)

All API calls centralised here. Key exports:
- `getCreator / getConfig` — fetch creator profile (normalized for V1 compatibility)
- `updateCreator / updateConfig` — PATCH creator
- `creatorLogin, fanLogin, fanRegister`
- `getPosts, createPost, updatePost, deletePost, likePost`
- `getCollections, createCollection, updateCollection, deleteCollection, assignPostToCollection, removePostFromCollection, unlockCollection`
- `getChatHistory, unlockMessage, getCreatorInbox, getThreadWithFan, sendBlast`
- `getSubscriptionStatus, subscribe, unsubscribe, getMySubscriptions, getMyTransactions`
- `uploadImage`

---

## 2. Known Issues / Deferred

- **Stripe payments** — all subscriptions and unlocks are mock (no real money). Transactions are recorded but no payment is taken.
- **S3 storage** — media saved to local `server/uploads/`. Direct URLs can be scraped.
- **`sequelize.sync()` no alter** — any model field addition requires a full DB reset.
- **FloatingChat on mobile** — chat windows overflow on small screens (resolved by Messages page redesign).
- **No email verification / KYC** — creators created via seed script only.
- **Content tab** — shows flat post list only, no collection grouping UI yet (backend is ready).

---

## 3. Next Task — Messages Page Redesign (START HERE)

Replace `AdminFloatingChat` with a full dedicated Messages page. This is the core monetization/sales feature.

### 3.1 Remove floating chat

- Delete `client/src/components/AdminFloatingChat.tsx`
- Remove `<AdminFloatingChat isDark={isDark} />` from `Admin.tsx`
- Remove `AdminFloatingChat` import from `Admin.tsx`

### 3.2 Add Messages tab back to Admin

In `client/src/pages/Admin.tsx`:
- Change `type Tab = 'overview' | 'content' | 'settings'` → add `'messages'`
- Add to TABS array: `{ id: 'messages', label: 'Messages', icon: '◎' }`
- Import and render `<AdminMessages isDark={isDark} />` when `activeTab === 'messages'`
- Pass `isDark` as prop

### 3.3 Create `client/src/pages/AdminMessages.tsx`

Full-page two-column layout:

**Left column (280px fixed) — Subscriber inbox:**
- Only show fans who are **active subscribers AND have sent at least one message**
- Each row: avatar initials circle (purple bg), fan username, last message preview (truncated 40 chars), relative timestamp, unread badge (red)
- Active row highlighted with purple left border
- Refresh button in header
- Socket.io `new_message` event updates the list in real-time

**Right column (flex 1) — Thread view:**
- Header: fan username + subscription tier badge (e.g. "Basic") + "Member since" date
- Scrollable message area with auto-scroll to bottom on new message
- Creator messages: purple bubble, right-aligned, rounded `12px 12px 2px 12px`
- Fan messages: dark/grey bubble, left-aligned, rounded `12px 12px 12px 2px`
- PPV locked messages show: blurred placeholder image (or dark box if no media) + 🔒 icon + price tag — labelled "Locked · $X"
- Empty state: "Select a conversation" centered

**Reply input area (3 zones stacked at bottom):**

Zone 1 — media preview strip (hidden unless file attached):
- Thumbnail (60×60) with ✕ remove button
- Shows before sending

Zone 2 — toolbar row:
- `📎 Attach` button → opens hidden `<input type="file" accept="image/*,video/*">` → on select, upload via `POST /api/upload`, store returned URL in state, show preview in Zone 1
- `🔒 PPV` toggle button (grey default, purple when active)
- Price input (only visible when PPV active): `$ [4.99]`

Zone 3 — send row:
- Textarea (1 row, auto-expands) · `Enter` sends · `Shift+Enter` newlines
- Send button (purple circle, ↑ icon) — disabled if no content and no attachment and PPV not active

**Socket emit on send:**
```js
socket.emit('creator_reply', { fanId, content, isPPV, ppvPrice, mediaUrl })
```

### 3.4 Create `client/src/pages/AdminBroadcast.tsx`

Accessible as a "Broadcast" button in the admin sidebar (below theme toggle, above View Site).

Layout (single scrollable card):
- Title: "Broadcast to all subscribers"
- Subscriber count: "X active subscribers will receive this"
- Textarea: "Write your message…"
- Media attach: same 📎 button → upload → thumbnail preview
- PPV toggle + price field
- Big purple "Send Broadcast" button
- Status feedback: "Sent to X subscribers" (green) or error (red)
- Recent broadcasts list (last 5): timestamp · preview · sent count

Calls existing `POST /api/chat/:slug/blast` — but needs `mediaUrl` added (see 3.5).

### 3.5 Backend — Update blast endpoint

In `server/routes/chatRoutes.js`, update `POST /:slug/blast`:
- Accept `mediaUrl` in request body
- Store it on each Message created: `mediaUrl: mediaUrl || null`

Verify `server/models/Message.js` has:
```js
mediaUrl: { type: DataTypes.STRING, allowNull: true }
```
If field is missing → reset DB after adding it.

### 3.6 Fan side — Update `client/src/pages/Chat.tsx`

Update PPV locked message rendering:
```
┌─────────────────────────────┐
│  [blurred/dark placeholder] │
│  🔒  Exclusive content      │
│       $4.99                 │
│  [ Unlock Now ]             │
└─────────────────────────────┘
```
- If `msg.mediaUrl` exists and `!msg.isUnlocked`: show dark overlay on thumbnail
- After unlock (`POST /api/chat/:messageId/unlock` returns success): show full image/video inline
- Text-only PPV: show dark box with 🔒 and price, no thumbnail

---

## 4. Content Tab — Collection Grouping (Lower Priority)

Backend is complete. Frontend Content tab in Admin just shows a flat list. Future work:

- Add "New Bundle" button → modal: title, description, price, publish toggle → calls `POST /api/collections`
- Show posts grouped by collection: bundle card with title + price + post count + thumbnail grid
- "Add to bundle" button on each post row → dropdown of collections
- Fan-facing `Vault.tsx`: show bundle cards with lock overlay + "Unlock Bundle $X" CTA

---

## 5. Future Phases (Not Started)

### Phase 6 — Stripe Connect
- Replace mock subscribe/unlock with real Stripe Checkout
- Stripe Connect for creator payouts (platform takes % cut)
- Webhooks for subscription renewal/cancellation

### Phase 7 — Production Hardening
- AWS S3 for media (signed URLs for premium content)
- PostgreSQL instead of SQLite
- Per-domain CORS (each creator gets their own domain)
- Rate limiting, helmet.js, input sanitization

### Phase 8 — Advanced Features
- Scheduled / drip posts (`publishAt` field already exists in Post model)
- Referral links with tracking
- Push notifications (web push or email via SendGrid)
- Creator analytics dashboard (revenue charts, subscriber growth)

---

## 6. File Map (Key Files Only)

```
Blog/
├── SRS_FRS_DOCUMENT.md           ← This file
├── server/
│   ├── index.js                  ← Express app + Socket.io + legacy V1 routes
│   ├── socket.js                 ← Socket.io event handlers
│   ├── database.js               ← Sequelize SQLite connection
│   ├── platform.db               ← SQLite database (delete to reset schema)
│   ├── scripts/seed.js           ← Creates cristina@example.com / admin123
│   ├── models/
│   │   ├── index.js              ← All associations + syncDatabase()
│   │   ├── Creator.js
│   │   ├── User.js
│   │   ├── Post.js
│   │   ├── Collection.js
│   │   ├── Subscription.js
│   │   ├── Message.js
│   │   └── Transaction.js
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── creatorRoutes.js
│   │   ├── postRoutes.js
│   │   ├── collectionRoutes.js
│   │   ├── subscriptionRoutes.js
│   │   └── chatRoutes.js
│   └── middleware/
│       └── authMiddleware.js
│
└── client/
    ├── .env                      ← VITE_API_URL, VITE_CREATOR_SLUG
    └── src/
        ├── App.tsx               ← Routes
        ├── api.ts                ← All API calls
        ├── pages/
        │   ├── Admin.tsx         ← Creator dashboard (3 tabs — will become 4)
        │   ├── AdminMessages.tsx ← TO BE CREATED (see Section 3.3)
        │   ├── AdminBroadcast.tsx← TO BE CREATED (see Section 3.4)
        │   ├── Chat.tsx          ← Fan-side chat (needs PPV media update)
        │   ├── Vault.tsx         ← Fan content feed
        │   ├── Home.tsx
        │   ├── Gallery.tsx
        │   ├── About.tsx
        │   ├── Login.tsx
        │   └── FanLogin.tsx
        ├── components/
        │   ├── AdminFloatingChat.tsx  ← DELETE THIS
        │   ├── Navbar.tsx
        │   └── Footer.tsx
        └── styles/
            └── main.css          ← All styles including av2-* admin classes

```

---

## 7. How to Run Locally

```powershell
# Terminal 1 — Backend
cd server
node index.js

# Terminal 2 — Frontend
cd client
npm run dev
```

If port 5000 is already in use:
```powershell
Stop-Process -Name "node" -Force
```

If DB schema changes were made, reset:
```powershell
Stop-Process -Name "node" -Force
Remove-Item server\platform.db
cd server
node scripts/seed.js
node index.js
```
