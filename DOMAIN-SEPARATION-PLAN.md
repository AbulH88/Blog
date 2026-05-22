# Domain Separation — Marketing vs Billing Plan

> **Branch:** `feature/domain-separation`
> **Goal:** Split the live site into a clean public marketing front (`thecristinaadam.com`) and an age-gated members/billing back-end (`members.thecristinaadam.com`). Required for adult-friendly card processor (CCBill/Verotel/Segpay) approval AND to keep IG/TikTok bots from flagging the bio URL.

---

## Context

Today everything runs on `thecristinaadam.com` — public Home/About/Gallery/Blog AND signup/login/vault/chat/dashboard/admin. This creates two problems:

1. **Card processor onboarding (the real blocker):** CCBill, Verotel, Segpay, and SegPay all require the URL submitted in the application to clearly present as an "age-gated subscription site." Submitting the current `thecristinaadam.com` (which displays as a clean creator linktree) gets flagged as misleading. Submitting a URL that hits the paywall/vault directly gets approved.
2. **IG/TikTok bot flagging:** Social-network preview crawlers fetch the bio URL. They scan for adult/explicit signals. The fan-paywall flow (`/register`, `/vault`, `/chat`) is what trips classifiers, even though our content is currently SFW.

**Solution (from the Gemini + my synthesis):**
- Root domain stays public, clean, linktree-style
- New subdomain `members.thecristinaadam.com` serves the members/billing side
- Same VPS, same Node app, same Postgres — just different nginx vhost + frontend hostname-aware routing
- IG bio link points to **root** → tracked `/r/cristina` shortlink → server-side 302 to `members.*/register`
- Card processor application uses `members.thecristinaadam.com` as the submitted URL

---

## Locked architectural decisions

| Decision | Choice | Why |
|---|---|---|
| New domain | Subdomain `members.thecristinaadam.com` | Cheapest, shares SSL via wildcard, single nginx host config |
| Same VPS / same app | Both vhosts proxy to same Node:5000 | Avoids duplication; frontend does hostname-aware routing |
| Hostname detection | Both frontend (React Router-level) AND backend (request middleware) | Frontend: nicer 404s + UX. Backend: redirect path requests if hit on wrong domain |
| Cross-domain session | JWT in localStorage (current setup) | No cookie cross-domain issue — localStorage is per-origin so members.* and root are separate JWT scopes. This is actually fine because public root has no logged-in features. |
| Email links (verify, password-reset) | Always point to `members.*` (where login lives) | These flows only matter for fans, who live on members.* |
| Admin (creator panel) | Stays on `members.*/admin` | Creator-only, no public exposure benefit on root |
| SEO / robots | Root: keep current "indexable toggle". Members: hard-block all crawlers always | Adult-adjacent flow stays hidden from search even if root opens up later |
| Cloudflare cache | Already-aggressive on `/uploads/*` regardless of domain — already documented in `CLOUDFLARE.md` | No change needed |
| CORS | Allow both `thecristinaadam.com` + `members.thecristinaadam.com` (+ www variants) | Matches existing pattern, just extends `ALLOWED_ORIGINS` |
| Existing fan bookmarks (`thecristinaadam.com/dashboard` etc.) | Backend redirects to `members.*` equivalent | One-time courtesy. Drop the redirect after ~6 months. |

---

## Route inventory — where everything lives after the split

### Root domain (`thecristinaadam.com`) — PUBLIC, SAFE FOR BOTS

| Route | Status | Notes |
|---|---|---|
| `/` | ✅ Stays | Linktree-style home (already mostly safe) |
| `/about` | ✅ Stays | Bio page |
| `/gallery` | ✅ Stays | Public photo gallery (SFW only) |
| `/blog` | ✅ Stays | Journal posts |
| `/privacy`, `/terms`, `/dmca`, `/2257` | ✅ Stays | Legal pages (good for SEO + processor verification) |
| `/r/:character` | 🆕 NEW | Tracked redirect → members.*/register?via=:character |
| `/api/network/webhook` | 🆕 NEW | Receives bot-fleet events (already in BOT-FLEET-PLAN) |
| `/register`, `/login`, `/vault`, `/chat`, `/dashboard*`, `/admin` | ❌ Removed | → redirect to `members.*` equivalent |
| `/forgot-password`, `/reset-password`, `/verify-email`, `/payment/return` | ❌ Removed | → redirect to `members.*` equivalent |

### Members subdomain (`members.thecristinaadam.com`) — AGE-GATED

| Route | Status | Notes |
|---|---|---|
| `/` | 🆕 Redirects | → `/register` for non-logged-in fans, → `/dashboard` for logged-in |
| `/register`, `/login` | ✅ Moved | Has prominent 18+ age gate on every page |
| `/forgot-password`, `/reset-password`, `/verify-email` | ✅ Moved | Email link targets switch to members.* |
| `/dashboard`, `/dashboard/settings*` | ✅ Moved | Fan dashboard |
| `/vault` | ✅ Moved | Paid content browser |
| `/chat` | ✅ Moved | DM with creator |
| `/admin*` | ✅ Moved | Creator-only |
| `/payment/return` | ✅ Moved | Post-checkout redirect target |
| `/api/*` | ✅ Shared | API works on both domains (same Node app) |
| Crawler bots | 🚫 Hard-blocked | nginx + robots.txt + meta noindex |

---

## Frontend changes

### `client/src/App.tsx` — hostname-aware routing

Determine which "shell" to render based on `window.location.hostname`. Two top-level branches:

```tsx
const isMembersDomain = window.location.hostname.startsWith('members.');

// MARKETING domain (root): only public routes
<Routes>
  <Route path="/" element={<Home config={config} />} />
  <Route path="/about" element={<About config={config} />} />
  <Route path="/gallery" element={<Gallery images={...} />} />
  <Route path="/blog" element={<Blog blog={...} />} />
  <Route path="/privacy" element={<Privacy config={config} />} />
  <Route path="/terms" element={<Terms config={config} />} />
  <Route path="/dmca" element={<DMCA />} />
  <Route path="/2257" element={<Compliance2257 config={config} />} />
  <Route path="/r/:character" element={<ShortlinkRedirect />} />  // Phase 1
  
  // Backward-compat redirects for anyone hitting old URLs on root
  <Route path="/register" element={<HostRedirect to="/register" target="members" />} />
  <Route path="/login" element={<HostRedirect to="/login" target="members" />} />
  <Route path="/dashboard/*" element={<HostRedirect to="/dashboard" target="members" />} />
  <Route path="/vault" element={<HostRedirect to="/vault" target="members" />} />
  <Route path="/chat" element={<HostRedirect to="/chat" target="members" />} />
  <Route path="/admin/*" element={<HostRedirect to="/admin" target="members" />} />
  // ... etc for forgot/reset/verify-email/payment/return

  <Route path="*" element={<NotFound />} />
</Routes>

// MEMBERS domain: only authenticated/paid routes
<Routes>
  <Route path="/" element={<Navigate to="/dashboard" replace />} />
  <Route path="/register" element={<Register config={config} />} />
  <Route path="/login" element={<Login />} />
  <Route path="/forgot-password" element={<ForgotPassword />} />
  <Route path="/reset-password" element={<ResetPassword />} />
  <Route path="/verify-email" element={<VerifyEmail />} />
  <Route path="/dashboard" element={<FanDashboard />} />
  <Route path="/dashboard/settings" element={<FanSettings />} />
  <Route path="/dashboard/settings/:section" element={<FanSettings />} />
  <Route path="/vault" element={<Vault config={config} />} />
  <Route path="/chat" element={<Chat config={config} />} />
  <Route path="/payment/return" element={<PaymentReturn />} />
  <Route path="/admin" element={<Admin config={config} refreshConfig={refreshConfig} />} />
  // Legal pages also accessible here for processor verification
  <Route path="/privacy" element={<Privacy config={config} />} />
  <Route path="/terms" element={<Terms config={config} />} />
  <Route path="/dmca" element={<DMCA />} />
  <Route path="/2257" element={<Compliance2257 config={config} />} />
  <Route path="*" element={<NotFound />} />
</Routes>
```

### New utility component: `HostRedirect.tsx`

```tsx
// When user hits e.g. thecristinaadam.com/login → bounce them to
// members.thecristinaadam.com/login (keeps query params intact)
function HostRedirect({ to, target }: { to: string; target: 'members' | 'root' }) {
  useEffect(() => {
    const url = target === 'members'
      ? `https://members.thecristinaadam.com${to}${window.location.search}`
      : `https://thecristinaadam.com${to}${window.location.search}`;
    window.location.replace(url);
  }, [to, target]);
  return <div className="loading">Redirecting…</div>;
}
```

### New component: `ShortlinkRedirect.tsx`

```tsx
// /r/:character — track the click, then 302 to members.*/register?via=...
function ShortlinkRedirect() {
  const { character } = useParams();
  useEffect(() => {
    // Fire-and-forget tracking POST to existing /api/network/track or similar
    fetch(`/api/r/${character}`, { method: 'POST' }).catch(() => {});
    window.location.replace(
      `https://members.thecristinaadam.com/register?via=${encodeURIComponent(character || '')}`
    );
  }, [character]);
  return <div className="loading">Redirecting to {character}'s space…</div>;
}
```

### `client/src/components/Footer.tsx`

The footer already conditionally hides on dashboard/chat/vault routes. Keep that logic. Footer renders on legal pages + landing — they exist on BOTH domains so the link targets need to be hostname-aware:

```tsx
const isMembers = window.location.hostname.startsWith('members.');
const memberDomain = 'https://members.thecristinaadam.com';
const rootDomain = 'https://thecristinaadam.com';

// "Sign in" link on root → goes to members.*/login
// "Sign in" link on members → stays internal /login
```

### `client/src/components/Navbar.tsx`

Same pattern. The "Get Premium Access" button on the root domain now opens the modal whose "Join Free" button navigates to `https://members.thecristinaadam.com/register?via=cristinadirect` (rather than the current internal `/register`).

### Email links via `services/email.js` already use `PUBLIC_APP_URL`

We update `PUBLIC_APP_URL=https://members.thecristinaadam.com` in production `.env`. All verify-email and password-reset emails automatically point to the members subdomain. **No code change here** — just env config at deploy time.

---

## Backend changes

### `server/routes/shortlinkRoutes.js` — NEW

```js
// POST /api/r/:character → record Event('bio_link_clicked'), return 200
// GET  /api/r/:character → same but redirects (so direct URL hits work)
router.get('/:character', async (req, res) => {
  const { character } = req.params;
  events.log('bio_link_clicked', { props: { character } });
  res.redirect(302, `https://members.thecristinaadam.com/register?via=${encodeURIComponent(character)}`);
});
```

### `server/index.js` — extend ALLOWED_ORIGINS

```js
ALLOWED_ORIGINS=https://thecristinaadam.com,https://www.thecristinaadam.com,https://members.thecristinaadam.com
```

(No code change — just `.env` update.)

### `server/middleware/hostGuard.js` — NEW (optional belt-and-braces)

Backend redirect for direct curl/scripted hits that bypass the SPA. If someone POSTs to `thecristinaadam.com/api/auth/login`, we should still accept it (API endpoints work on both domains). But if someone GETs the `index.html` at `thecristinaadam.com/dashboard`, the static frontend already handles the bounce via `HostRedirect`.

**Skip this for v1** — frontend redirect is enough. Add only if we see direct-hit traffic in logs.

---

## Infrastructure changes (DNS + nginx + Cloudflare)

### 1. DNS

Add a CNAME or A record:
```
Type: A
Name: members
Value: <VPS IP>
TTL: Auto
Proxy: ON (orange cloud)
```

### 2. nginx (aaPanel)

Add a new vhost for `members.thecristinaadam.com`. **Easiest path with aaPanel:**

- aaPanel → Websites → Add Site
- Domain: `members.thecristinaadam.com`
- Root: same as existing — `/www/wwwroot/cristina/client/dist`
- SSL: Let's Encrypt (aaPanel auto-issues for the subdomain since DNS is proxied)
- Copy the existing `thecristinaadam.com` nginx config wholesale to `members.thecristinaadam.com`

Both vhosts serve the same `dist/` directory. React Router + `HostRedirect` handles hostname-aware routing at the SPA level.

**One critical addition** to the members nginx config: more aggressive bot blocking + stricter robots:

```nginx
# In members.thecristinaadam.com server block:
location = /robots.txt {
  return 200 "User-agent: *\nDisallow: /\n";
  add_header Content-Type text/plain;
}

# Hard-block known social bots BEFORE they even hit Node
if ($http_user_agent ~* (facebookexternalhit|Twitterbot|TikTokBot|Instagram|meta-externalagent|LinkedInBot|SocialBot)) {
  return 403;
}
```

### 3. Cloudflare

`thecristinaadam.com` is already proxied. Just need to verify `members.*` inherits the same WAF rules from `CLOUDFLARE.md`. Specifically:
- US state-verification geo-blocks (TX, LA, UT, MS, MT, AR, NC, VA, FL, TN, KY) apply to `members.*` — **critical**
- Cache rule for `/uploads/*` applies regardless of hostname
- "Always HTTPS" applies to all subdomains

Should be automatic once DNS is proxied. Verify with `curl -I https://members.thecristinaadam.com/api/health`.

---

## File-level change summary

| File | Change |
|---|---|
| `client/src/App.tsx` | Hostname-aware split into two `<Routes>` blocks |
| `client/src/components/HostRedirect.tsx` | **NEW** — backward-compat redirects for old root URLs |
| `client/src/components/ShortlinkRedirect.tsx` | **NEW** — `/r/:character` tracker + redirect |
| `client/src/components/Footer.tsx` | Hostname-aware link targets |
| `client/src/components/Navbar.tsx` | Hostname-aware "Get Premium Access" target |
| `client/src/components/JoinPremiumModal.tsx` | "Join Free" button → cross-domain navigate |
| `server/routes/shortlinkRoutes.js` | **NEW** — `/api/r/:character` endpoint |
| `server/index.js` | Mount shortlinkRoutes; verify CORS allowlist |
| `server/.env.example` | `PUBLIC_APP_URL=https://members.thecristinaadam.com` + `ALLOWED_ORIGINS` includes members.* |
| Production `.env` on VPS | Update `PUBLIC_APP_URL` + `ALLOWED_ORIGINS` |
| aaPanel | Add `members.thecristinaadam.com` vhost; Let's Encrypt SSL |
| Cloudflare | Verify subdomain proxied; WAF rules cover it |

**No DB changes.** No schema migration. Pure infra + routing.

---

## Build phases

### Phase 0 — User parallel setup (~30 min)
- aaPanel: Add `members.thecristinaadam.com` website + Let's Encrypt SSL
- Cloudflare: verify A record for `members` is orange-cloud Proxied
- Confirm `curl -I https://members.thecristinaadam.com` returns 200 from nginx default

### Phase 1 — Frontend hostname-aware routing (~1.5 days)
- Build `HostRedirect.tsx` + `ShortlinkRedirect.tsx`
- Refactor `App.tsx` into two `<Routes>` blocks via hostname detection
- Update `Footer.tsx` + `Navbar.tsx` + `JoinPremiumModal.tsx` for cross-domain link targets
- Build + smoke test locally with `127.0.0.1` (use `/etc/hosts` to point `members.thecristinaadam.com` → localhost)

### Phase 2 — Backend shortlink route (~0.5 day)
- New `server/routes/shortlinkRoutes.js`
- Mount in `server/index.js`
- Verify Event logging fires
- Test redirect chain end-to-end

### Phase 3 — Deploy + env updates (~0.5 day)
- Update VPS `.env`:
  - `PUBLIC_APP_URL=https://members.thecristinaadam.com`
  - `ALLOWED_ORIGINS=https://thecristinaadam.com,https://www.thecristinaadam.com,https://members.thecristinaadam.com`
- Pull main + rebuild + pm2 reload
- Run smoke test: signup → verify email link points to members.* → login works on members.*

### Phase 4 — Cloudflare WAF + verification (~0.5 day)
- Apply state geo-block rule to `members.*` if not already inherited
- Apply nginx bot-blocking inserts to members.* vhost
- Verify `cf-cache-status` header on `/uploads/*` from both domains
- Check `https://members.thecristinaadam.com/robots.txt` returns Disallow: /

**Total: ~3 dev days + ~30 min user infra setup.**

---

## Verification

**After Phase 1 (local):**
- `/etc/hosts` entries point `members.thecristinaadam.com` → `127.0.0.1`
- Visit `http://thecristinaadam.com:5173/dashboard` → bounces to `http://members.thecristinaadam.com:5173/dashboard`
- Visit `http://thecristinaadam.com:5173/` → clean landing page renders
- Visit `http://members.thecristinaadam.com:5173/` → redirects to `/register` (no login) or `/dashboard` (with login)

**After Phase 3 (production):**
- Visit `https://thecristinaadam.com/dashboard` → bounces to `https://members.thecristinaadam.com/dashboard`
- Visit `https://members.thecristinaadam.com/register` → renders cleanly with age gate
- Signup → verification email link points to `https://members.thecristinaadam.com/verify-email?token=...`
- Click link → verify works → land on `https://members.thecristinaadam.com/dashboard`

**End-to-end smoke (after Phase 4):**
1. IG bio set to `https://thecristinaadam.com/r/cristina`
2. Click bio link in IG app on phone
3. Tracked event recorded in Events table
4. Browser lands on `https://members.thecristinaadam.com/register?via=cristina`
5. Signup completes → fan in DB has `attribution=cristina`
6. `curl -I https://members.thecristinaadam.com/robots.txt` returns `Disallow: /`
7. `curl -A "facebookexternalhit/1.1" https://members.thecristinaadam.com/` returns 403
8. `curl -I https://thecristinaadam.com/` returns 200 (root still serves clean marketing)

---

## What this unlocks (the actual business reason)

1. **CCBill/Verotel/Segpay applications** — submit `https://members.thecristinaadam.com` as the URL. Age gate visible, paywall clear, processor underwriting approves.
2. **IG/TikTok bio safety** — root URL `thecristinaadam.com` looks like a creator linktree (safe). Members subdomain is invisible to IG bots due to nginx UA blocks + robots.txt.
3. **Future SEO play** — if you ever want public SEO traffic on creator content (blog posts, journal entries), root can become indexable without exposing members.
4. **Multi-tenant ready** — if a second creator (Aria) joins, you can add `aria.members.com` or similar with the same pattern. The architecture supports it.

---

## Out of scope (deferred)

- ❌ Splitting nginx into two different VPS boxes — same VPS works fine
- ❌ Separate Postgres DBs per domain — single DB, single API
- ❌ Sub-domain-per-creator (Phase 1 of multi-tenant) — single creator for now
- ❌ Geo-detection at the SPA level (e.g. show different homepage to UK vs US) — out of scope
- ❌ Cookie-based session sharing across subdomains — JWT in localStorage works fine and doesn't need this
- ❌ A/B testing root vs members landing page

---

## Open items needing user input

1. **DNS provider for `members.*` record** — Cloudflare DNS already managing the root? (Assume yes — confirm)
2. **Should `/admin` stay on `members.*` or move to a totally separate `admin.thecristinaadam.com`?**
   - Pro for admin.*: even cleaner separation, admin never crosses with fan traffic
   - Pro for members.*: one fewer subdomain, simpler
   - Default: keep on `members.*`
3. **Tracking event name for shortlink clicks** — default `bio_link_clicked` with character as prop. Or do you want per-platform names like `ig_bio_clicked`, `tiktok_bio_clicked`?
4. **Footer link behavior on members domain** — should the footer on `members.*` link to legal pages on the same domain (`members.../privacy`) or back to root (`thecristinaadam.com/privacy`)?
   - Default: same-domain (members.../privacy). Cleaner UX, no cross-domain bounce mid-flow.
5. **Should we delete the backward-compat redirects from root after 6 months?**
   - Default: yes, drop them after Q3 2026 — by then any saved bookmark is stale anyway
