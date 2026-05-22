# Admin: Manage Users + Notifications — Plan

> **Branch:** `feature/admin-manage-users`
> **Goal:** Complete the existing Audience tab into a real user-management surface + wire the existing admin notification bell to a live event feed.

---

## Context

The current Admin → Audience tab is a stat-cards-and-list view, partially built:
- ✅ Existing: list, sort by spend/recent/joined, text search, total stats, top spenders panel
- ❌ Missing: status filter, spend-tier filter, per-fan actions, per-fan detail drilldown

The admin top-bar already has a bell icon (`<div className="v3-admin-bell">🔔<span className="dot">3</span></div>` in `Admin.tsx:2442`) but the "3" is hardcoded and there's no dropdown — no real notification system.

We also already have an `Event` model + `services/events.js` (built in pre-deploy step #8) that logs `fan_signed_up`, `email_verified`, `chat_message_sent`, `deposit_completed`, `unlock_completed`, `account_deleted`. **Those events are exactly the notification feed we need.** No new event-generation work — just expose them to the admin bell.

---

## Scope

### Feature 1 — Manage Users (extend existing Audience tab)

| Requirement | Existing? | What's needed |
|---|---|---|
| List: username, email, signup date, last login, total spent, status | Partial — missing status column + last-login field | Add columns, surface `lastLoginAt` from User model |
| Search by email | ✅ Already in `audienceFilter` (case-insensitive contains) | — |
| Filter by spend tier | ❌ | Add tier picker: All / Free ($0) / Paying ($1+) / VIP ($100+) |
| Filter by status | ❌ | Add picker: All / Active / Blocked / Deleted |
| Action: View detail | ❌ | New detail modal/drawer with full per-fan activity |
| Action: Block / unblock | Backend `isBlocked` exists, no UI | Add button + backend endpoint |
| Action: Force-logout | ❌ | Backend: rotate the user's `tokenVersion` (new field) → all existing JWTs invalid |
| Action: Delete (GDPR) | Backend `DELETE /api/auth/me` exists for self-delete; no admin-side endpoint | Add `DELETE /api/creator/:slug/fans/:fanId` with same anonymize logic |
| Per-fan detail page | ❌ | Full activity drilldown |

### Feature 2 — Notifications (Option A: admin receives system notifications)

Bell in admin top-bar shows real recent events. Clicking opens a dropdown with:
- Newest 20 events (auto-refresh every 30s)
- Per-event: emoji + one-line summary + relative time + click-through link
- Unread counter as the red dot (clears when dropdown is opened)

**Event types surfaced (existing Events from `Event` model):**

| Event name | Emoji | Display | Click-through |
|---|---|---|---|
| `fan_signed_up` | 👋 | "*Username* signed up" | → /admin → audience → fan detail |
| `email_verified` | ✓ | "*Username* verified their email" | → fan detail |
| `chat_message_sent` | 💬 | "*Username* sent a message" | → /admin → messages |
| `deposit_completed` | 💰 | "*Username* deposited $X" | → fan detail → transactions |
| `unlock_completed` | 🔓 | "*Username* unlocked *Bundle Name* ($X)" | → fan detail → transactions |
| `account_deleted` | 🗑️ | "*Username* deleted their account" | → fan detail |
| `dm_pending_approval` (new) | ⏳ | "AI wants to send PPV — needs your approval" | → /admin → messages (already exists as PendingPpv) |

**Don't include in v1:**
- Push notifications (web push API) — defer
- Email digests — defer
- Per-event admin preferences — defer

---

## Architecture decisions

| Decision | Choice | Rationale |
|---|---|---|
| Detail view UX | Right-side slide-out drawer (not a separate route) | Keeps admin context; no full nav cost |
| Block enforcement | Existing `User.isBlocked` field + auth middleware check | Already wired — just expose UI |
| Force-logout strategy | New `User.tokenVersion` (int, default 0) — JWT carries the version, middleware rejects stale | Industry standard; no JWT blocklist needed |
| Notification source | Existing `Event` table — no new model | Already capturing the right events |
| Bell polling | 30s interval via `setInterval` in admin top-bar component | Cheap; admins are 1-2 humans, not 1000s |
| Unread tracking | Per-admin `lastNotificationCheckedAt` in localStorage | No backend persistence needed for single admin |

---

## Data model changes

### `server/models/User.js` — additions

```js
// Token versioning — bump to force-logout all sessions for this user
tokenVersion: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false },
```

Use idempotent `addIfMissing()` migration helper from `server/models/index.js`.

### `server/services/events.js` — no changes, already capturing what we need

---

## Backend changes

### New endpoints

| Method + path | Purpose |
|---|---|
| `GET    /api/creator/:slug/fans/:fanId` | Per-fan detail (subscriptions, transactions, messages count, unlock counts, last login, status) |
| `PATCH  /api/creator/:slug/fans/:fanId/block` | `{ blocked: true \| false }` → flips `User.isBlocked` |
| `POST   /api/creator/:slug/fans/:fanId/force-logout` | Bumps `User.tokenVersion` — invalidates all existing JWTs |
| `DELETE /api/creator/:slug/fans/:fanId` | Admin-initiated GDPR delete (mirrors fan-side `DELETE /api/auth/me` anonymization) |
| `GET    /api/creator/:slug/notifications` | Returns recent 20 events for the bell dropdown |
| `POST   /api/auth/me/logout-everywhere` | Fan-side: bump own `tokenVersion` to invalidate all sessions |

### Middleware change

`server/middleware/authMiddleware.js` — `requireAuth` needs to check `tokenVersion`:

```js
// After jwt.verify
if (decoded.role === 'fan') {
  const user = await User.findByPk(decoded.userId, { attributes: ['tokenVersion', 'isBlocked'] });
  if (!user) return res.status(401).json({ error: 'User not found' });
  if (user.isBlocked) return res.status(403).json({ error: 'Account blocked' });
  if ((user.tokenVersion || 0) !== (decoded.tv || 0)) {
    return res.status(401).json({ error: 'Session expired', requiresLogin: true });
  }
}
```

And `signToken` in `authRoutes.js` adds `tv` to the JWT payload.

This is a security-net change — failures are 401, frontend already handles re-login flow.

### Authorization model

All new endpoints require `requireAuth + requireCreator`. The fan endpoints check that the requested fan has interacted with this creator (Subscription row exists) — prevents one creator from snooping on another's audience in the multi-tenant future. Today single-creator, but cheap to add now.

---

## Frontend changes

### `client/src/pages/Admin.tsx` — extend Audience tab

1. **Add filter row** under the existing search bar:
   - Spend tier dropdown: All / Free / Paying ($1+) / VIP ($100+)
   - Status dropdown: All / Active / Blocked / Deleted
2. **Add columns to the list** for last-login + status badge
3. **Each row gets an actions menu** (3-dot kebab → block, force-logout, refund, delete) **or** make the whole row clickable → opens detail drawer
4. **Stat cards already there** — leave them

### New component: `client/src/components/FanDetailDrawer.tsx`

Right-side slide-out drawer (350-400px wide), opens on row click. Sections:
- **Header**: avatar + username + email + status pill
- **Quick stats**: total spent, lifetime unlocks, messages sent, last seen
- **Subscriptions**: which bundles owned, with unlock dates
- **Transactions**: full list with status, with per-row refund button
- **Messages**: count + link to "/admin → messages?fan=:id"
- **Posts unlocked**: list + links
- **Wallet**: current balance + deposit history
- **Danger zone**: block/unblock, force-logout, delete (with confirm)

Reuses Cristina's existing `unsubscribe`-style confirm dialog pattern.

### `client/src/api.ts` — new helpers

```ts
export const getFanDetail        = (fanId: number) => …
export const blockFan            = (fanId: number, blocked: boolean) => …
export const forceLogoutFan      = (fanId: number) => …
export const adminDeleteFan      = (fanId: number, reason: string) => …
export const refundTransaction   = (txId: number, reason: string) => …
export const getAdminNotifications = () => …
```

### New component: `client/src/components/AdminNotificationBell.tsx`

- Replaces the hardcoded `<div className="v3-admin-bell">🔔<span className="dot">3</span></div>` in `Admin.tsx:2442`
- Polls `GET /api/creator/:slug/notifications` every 30s
- Counts unread (events newer than `lastNotificationCheckedAt` from localStorage)
- Click → opens dropdown like the existing `FanDashboard` notifications dropdown (reuse styling)
- Each event row: emoji + summary + relative time → click navigates to relevant admin tab/drawer
- "Mark all read" link at bottom — updates `lastNotificationCheckedAt`

Reuses styling pattern from `FanDashboard.tsx` notifications dropdown (lines ~160-210).

---

## File-level change summary

| File | Change |
|---|---|
| `server/models/User.js` | Add `tokenVersion` field |
| `server/models/Transaction.js` | Add `refundedAt`, `refundedBy`, `refundReason` fields |
| `server/models/index.js` | Idempotent `addIfMissing()` migrations for the new columns |
| `server/middleware/authMiddleware.js` | Check `tokenVersion` + `isBlocked` on each authenticated request |
| `server/routes/authRoutes.js` | Include `tv` in JWT payload at signToken; bump tv on password change/reset |
| `server/routes/creatorRoutes.js` | 6 new endpoints (block, force-logout, delete-fan, refund, fan-detail, notifications) |
| `client/src/api.ts` | 6 new helper functions |
| `client/src/pages/Admin.tsx` | Extend Audience tab — filters, action menu, drawer trigger; swap bell for new component |
| `client/src/components/FanDetailDrawer.tsx` | **NEW** — slide-out detail panel |
| `client/src/components/AdminNotificationBell.tsx` | **NEW** — bell + dropdown |
| `client/src/styles/theme-v3.css` | Drawer styles + notification dropdown polish |

---

## Build phases

### Phase 1 — Backend foundation (~1 day)
- Add `User.tokenVersion`, `Transaction.refunded*` fields + idempotent migrations
- Update `authMiddleware` to verify `tokenVersion`
- Update `signToken` + add tv to JWT on login/register/password-reset/profile-update
- New endpoints: block, force-logout, delete-fan, refund, fan-detail, notifications
- Curl-test each endpoint locally against the dev SQLite DB

### Phase 2 — FanDetailDrawer + Audience tab extension (~1.5 days)
- Build FanDetailDrawer component (sections: header, stats, transactions, messages, posts unlocked, wallet, danger zone)
- Add status + spend-tier filters to Audience tab
- Wire row-click → drawer open
- Per-transaction refund button inside drawer
- Block/unblock/force-logout/delete buttons in drawer's danger zone

### Phase 3 — Admin notification bell (~0.5 day)
- Build AdminNotificationBell component
- Replace hardcoded bell in Admin.tsx top-bar
- Wire to `/notifications` endpoint with 30s polling
- localStorage unread tracking
- Click-through routing (per-event-type navigation)

### Phase 4 — Polish + verification (~0.5 day)
- Empty states (no fans yet, no notifications yet)
- Confirmation dialogs for destructive actions
- Toast feedback on success (reuse existing Toast system)
- Mobile responsiveness for the drawer (becomes bottom sheet)
- TS clean, build clean, smoke test

**Total: ~3.5 dev days.**

---

## Verification

**Phase 1:**
- Curl `/api/creator/cristina/fans/:fanId` returns the right shape
- Curl `/block` → `User.isBlocked` flips; next API call from that fan returns 403
- Curl `/force-logout` → bumps tokenVersion; next API call from old token returns 401 with `requiresLogin: true`
- Curl `/refund` → Transaction shows `status='refunded'`, wallet balance adjusted, Event row written

**Phase 2:**
- Audience tab filter "Status = Blocked" shows only blocked fans
- Filter "Spend = VIP" shows only fans with `totalSpent >= 100`
- Row click → drawer slides in from right with all sections populated
- Refund button inside drawer disables tx + shows "Refunded $X" badge
- Block button → toast "Fan blocked" + status pill updates inline

**Phase 3:**
- Notification bell shows real number matching `Events` table count since `lastNotificationCheckedAt`
- Drop-down lists events newest-first with correct relative times
- Click on a `fan_signed_up` event opens the fan detail drawer
- "Mark all read" zeroes the count

**End-to-end smoke:**
1. Fresh test fan signs up → bell badge increments within 30s
2. Admin clicks bell → sees "👋 testfan signed up — 12s ago"
3. Clicks event → drawer opens on that fan
4. Reviews fan detail → clicks refund on a transaction → confirms → transaction flips to refunded
5. Clicks "Block" → confirms → fan tries to log in → blocked
6. Admin clicks "Unblock" → fan can log in again
7. Admin clicks "Force logout" → fan's existing session 401s on next API call → forced to re-login

---

## Out of scope (deferred)

- ❌ Email/push notification dispatch to admin (web push API needs HTTPS + service worker — defer)
- ❌ Per-event admin preferences (mute deposits, etc.)
- ❌ Bulk operations (block all fans matching criteria) — risky without good safeguards
- ❌ Audit log of admin actions on fans — useful but deferred
- ❌ Multi-creator scoping refinements (today single-creator, deferred to multi-tenant phase)
- ❌ Refund partial amounts (full-refund only for v1)

---

## Open items needing user input

1. **Refund: full vs partial?** v1 = full-only is simpler. Confirm OK.
2. **Force-logout bump tv strategy applies to all sessions** — meaning admin can force a fan to re-login. Should we ALSO add a "log me out everywhere" button in fan settings for the fan themselves? Easy bonus while we're here.
3. **Notification polling cadence** — 30s default. If you want it more snappy (10s) or chill (60s), say so.
4. **Drawer or full route for fan detail?** Default = drawer (faster context). If you want a `/admin/fans/:id` URL for direct linking, that's an extra ~0.5 day. Drawer-only is fine for v1?

Once confirmed I start Phase 1 (backend).
