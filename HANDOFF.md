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

# 🚀 DEPLOYMENT — Production VPS (Rocky/CentOS/Alma + Postgres + Nginx)

> Step-by-step playbook to put this on a real VPS. Target: Rocky Linux 9 / AlmaLinux 9 / CentOS Stream 9 (all use `dnf` + `firewalld` + `systemd`). Adjust only minor commands for Ubuntu (`apt` instead of `dnf`, `ufw` instead of `firewalld`).
>
> Assumes: VPS already provisioned, root access via SSH, domain (e.g. `cristina.com`) owned with DNS access.

## Architecture this doc deploys

```
ONE VPS:
  - Node backend (PM2 daemon, port 5000, listens 127.0.0.1 only)
  - Postgres 16 (port 5432, localhost only)
  - Nginx (ports 80/443, public)
  - Built React frontends in /var/www/{slug}-build/
  - Telegram pollers, AI client, sockets run inside the Node process

EXTERNAL:
  - OpenRouter (AI) — paid API
  - Backblaze B2 (optional, add later for media at scale)
```

---

## 0. Prerequisites checklist

- [ ] SSH access to VPS as `root` (or sudo user)
- [ ] Domain registered (e.g. `cristina.com`) with DNS panel access
- [ ] At least: 2 vCPU, 4GB RAM, 40GB SSD (Hetzner CPX21 / Vultr 2GB OK; CPX31 recommended)
- [ ] Repo pushed to GitHub (✅ done — `https://github.com/AbulH88/Blog`)
- [ ] OpenRouter API key (✅ have one; rotate before going live)

---

## 1. Server hardening (one-time, ~10 min)

SSH in as `root`, then:

```bash
# Update everything
dnf update -y

# Create a non-root user with sudo
adduser deploy
passwd deploy                       # set a strong password
usermod -aG wheel deploy            # wheel = sudo group on RHEL family

# (Optional but recommended) Copy your SSH key to the deploy user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Lock down SSH — disable root login, require keys
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd

# Firewall — open only what we need
systemctl enable --now firewalld
firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload

# Add 2GB swap (helps build steps on small VPS)
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

From now on, SSH as `deploy` (`ssh deploy@<vps-ip>`).

---

## 2. Install the stack

```bash
# Node.js 22 (LTS at time of writing) via NodeSource
curl -fsSL https://rpm.nodesource.com/setup_22.x | sudo bash -
sudo dnf install -y nodejs gcc-c++ make git

# PM2 (process manager — keeps Node running, restarts on crash, on reboot)
sudo npm install -g pm2

# Postgres 16
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl enable --now postgresql

# Nginx + certbot (Let's Encrypt SSL)
sudo dnf install -y nginx
sudo dnf install -y epel-release
sudo dnf install -y certbot python3-certbot-nginx
sudo systemctl enable --now nginx

# Verify
node -v          # → v22.x
psql --version   # → 16.x
nginx -v
```

---

## 3. Create Postgres database + user

```bash
sudo -u postgres psql <<'EOF'
CREATE USER cristina_app WITH PASSWORD 'CHANGE_ME_STRONG_RANDOM_64_CHARS';
CREATE DATABASE platform OWNER cristina_app;
GRANT ALL PRIVILEGES ON DATABASE platform TO cristina_app;
\q
EOF
```

> Replace the password. Generate one: `openssl rand -hex 32`. Save it for the `.env` step.

Then enable password auth for local apps. Edit `/var/lib/pgsql/data/pg_hba.conf` and change the `host` line for `127.0.0.1/32` from `ident` to `scram-sha-256`. Reload:

```bash
sudo systemctl reload postgresql
```

---

## 4. Switch the app from SQLite to Postgres

The code currently uses SQLite. Two-line change to support both via env var.

Edit `server/database.js`:

```js
const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

const isPg = process.env.DB_DIALECT === 'postgres';

const sequelize = isPg
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      pool: { max: 10, min: 0, idle: 10000 },
    })
  : new Sequelize({
      dialect: 'sqlite',
      storage: path.resolve(__dirname, process.env.DATABASE_PATH || './data/platform.db'),
      logging: false,
    });

module.exports = sequelize;
```

Install the pg driver (in the next deploy step). Existing migrations work as-is — Sequelize handles both dialects.

---

## 5. Deploy the code

```bash
# As deploy user
sudo mkdir -p /var/www
sudo chown deploy:deploy /var/www
cd /var/www

git clone https://github.com/AbulH88/Blog.git platform
cd platform
git checkout feature/phase-7-ai-chatbot   # or main after merge

# Backend deps + Postgres driver
cd server
npm install
npm install pg pg-hstore                   # for Postgres dialect

# Create .env
cat > .env <<'EOF'
PORT=5000
DB_DIALECT=postgres
DATABASE_URL=postgres://cristina_app:THE_PASSWORD_FROM_STEP_3@127.0.0.1:5432/platform
JWT_SECRET=GENERATE_WITH_openssl_rand_hex_64
JWT_EXPIRES_IN=24h
PLATFORM_FEE_PERCENT=10

# AI
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY
SITE_URL=https://cristina.com

# Future: payments, S3, etc.
EOF
chmod 600 .env

# Test boot — should print migrations + "Server running"
node index.js
# Ctrl-C to stop
```

---

## 6. Run the backend under PM2 (auto-restart, survives reboot)

```bash
cd /var/www/platform/server
pm2 start index.js --name platform-api
pm2 save
pm2 startup systemd -u deploy --hp /home/deploy
# pm2 startup prints a sudo command — run it as instructed
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u deploy --hp /home/deploy

# Verify
pm2 ls
pm2 logs platform-api --lines 30
```

The API is now running on `127.0.0.1:5000` (localhost only — Nginx will reverse-proxy public traffic to it).

---

## 7. Build + deploy the React frontend for Cristina

```bash
cd /var/www/platform/client
npm install

# Set per-creator build config
cat > .env.production <<'EOF'
VITE_API_URL=https://cristina.com/api
VITE_SERVER_URL=https://cristina.com
VITE_CREATOR_SLUG=cristina
EOF

npm run build
# Outputs to /var/www/platform/client/dist

# Move build to a per-creator static dir
sudo mkdir -p /var/www/cristina-build
sudo cp -r dist/* /var/www/cristina-build/
sudo chown -R nginx:nginx /var/www/cristina-build
```

---

## 8. Nginx — serve frontend + proxy API/sockets

Create `/etc/nginx/conf.d/cristina.conf`:

```nginx
server {
    listen 80;
    server_name cristina.com www.cristina.com;
    return 301 https://cristina.com$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cristina.com;

    # SSL certs filled in by certbot in next step

    client_max_body_size 500M;             # for large video uploads

    root /var/www/cristina-build;
    index index.html;

    # React Router — SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Uploaded media (served from VPS until you migrate to B2)
    location /uploads/ {
        alias /var/www/platform/server/uploads/;
        access_log off;
        expires 30d;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO — needs WebSocket upgrade headers
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }
}
```

SELinux note (RHEL family): allow nginx to proxy out + read app files:

```bash
sudo setsebool -P httpd_can_network_connect 1
sudo chcon -R -t httpd_sys_content_t /var/www/cristina-build
```

Point DNS:
- In your registrar (NameCheap/Cloudflare/etc), add `A` records:
  - `cristina.com` → `<vps-ip>`
  - `www.cristina.com` → `<vps-ip>`
- Wait 1-5 min for propagation (`dig cristina.com +short` should return your IP)

Get the SSL cert + auto-renewal:

```bash
sudo certbot --nginx -d cristina.com -d www.cristina.com
# Follow prompts (email, agree to ToS, redirect HTTP→HTTPS yes)
# Certbot edits the conf file with cert paths AND adds the renewal cron

# Test renewal
sudo certbot renew --dry-run
```

Reload + verify:

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -I https://cristina.com           # → HTTP/2 200
curl https://cristina.com/api/creator/cristina   # → JSON
```

Open `https://cristina.com` in browser. Site is live. 🎉

---

## 9. Seed the database + creator account

```bash
cd /var/www/platform/server
node scripts/seed.js
# Creates Cristina creator + fan@example.com test account

# Or create manually:
node -e "
const bcrypt = require('bcryptjs');
const { Creator } = require('./models');
(async () => {
  const passwordHash = await bcrypt.hash('STRONG_ADMIN_PASSWORD', 12);
  await Creator.create({
    slug: 'cristina', displayName: 'Cristina Adam',
    email: 'cristina@example.com', passwordHash,
    bio: 'NYC born and raised. 19.',
  });
  console.log('OK');
})();
"
```

Log in at `https://cristina.com/login`.

---

## 10. Adding model #2 (e.g. Aria) — 5 minutes

```bash
# Point DNS: aria.com → <same vps-ip>

# Build her frontend with her slug
cd /var/www/platform/client
cat > .env.production <<'EOF'
VITE_API_URL=https://aria.com/api
VITE_SERVER_URL=https://aria.com
VITE_CREATOR_SLUG=aria
EOF
npm run build

sudo mkdir -p /var/www/aria-build
sudo cp -r dist/* /var/www/aria-build/
sudo chown -R nginx:nginx /var/www/aria-build
sudo chcon -R -t httpd_sys_content_t /var/www/aria-build

# Nginx — copy cristina.conf to aria.conf, swap domain + root path
sudo cp /etc/nginx/conf.d/cristina.conf /etc/nginx/conf.d/aria.conf
sudo sed -i 's/cristina/aria/g' /etc/nginx/conf.d/aria.conf
sudo certbot --nginx -d aria.com -d www.aria.com
sudo nginx -t && sudo systemctl reload nginx

# Create her in the DB
cd /var/www/platform/server
node -e "
const bcrypt = require('bcryptjs');
const { Creator } = require('./models');
(async () => {
  await Creator.create({
    slug: 'aria', displayName: 'Aria',
    email: 'aria@example.com', passwordHash: await bcrypt.hash('admin123', 12),
  });
})();"
```

Now `https://aria.com` serves Aria's frontend, hitting the same backend. Same Cristina log-in/admin pattern. Same AI chatbot — she configures her own persona, model, Telegram bot, vault, fans.

---

## 11. Deploys (when you push new code)

```bash
ssh deploy@<vps-ip>
cd /var/www/platform
git pull

# Backend changed?
cd server && npm install && pm2 restart platform-api

# Frontend changed? (per slug — repeat for each)
cd ../client && npm install && npm run build
sudo cp -r dist/* /var/www/cristina-build/

# Done. Zero downtime — PM2 restart is fast, Nginx serves new static instantly.
```

Optionally automate with a `deploy.sh` script or GitHub Actions later.

---

## 12. Backups (do this BEFORE going live)

**Database (daily, ~30s)** — cron job as `deploy`:

```bash
crontab -e
# Add:
0 3 * * * pg_dump -U cristina_app -h 127.0.0.1 platform | gzip > /home/deploy/backups/platform-$(date +\%F).sql.gz
0 4 * * 0 find /home/deploy/backups -name 'platform-*.sql.gz' -mtime +30 -delete
```

**Uploads (weekly, sync to B2 or another VPS)** — see B2 migration step below.

**VPS snapshots** — most providers offer this. Hetzner: $1/mo, Vultr: 20% of VPS cost. Enable it. Restores in 60s.

---

## 13. Switching media to Backblaze B2 (do later when needed)

When you hit ANY of: first content leak, disk >70%, multi-model storage mess.

Already on the roadmap as Phase 8. Architecture:
- Install `@aws-sdk/client-s3` (B2 has S3-compatible API)
- New `server/services/storage.js` with `uploadFile()` and `signedUrl(key, ttl)` functions
- Refactor `POST /api/upload` to push to B2 instead of disk
- Refactor places that return `/uploads/...` URLs to return signed B2 URLs
- ~2 hours of work; the abstraction is already friendly (every model field stores a URL string)

---

## 14. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `502 Bad Gateway` | Node not running or wrong port | `pm2 ls`, `pm2 logs platform-api` |
| `permission denied` from Nginx | SELinux blocking | `sudo setsebool -P httpd_can_network_connect 1`; check `audit2allow` |
| Socket.IO disconnects every 60s | Nginx default proxy timeout | Already set `proxy_read_timeout 86400` in config above |
| SSL cert won't issue | DNS not propagated | `dig cristina.com +short` should return VPS IP; wait 5 min |
| Postgres connection refused | Auth method or wrong port | Check `pg_hba.conf` is `scram-sha-256` for `127.0.0.1/32`, `pg_ctl reload` |
| File upload 413 | Nginx body size limit | `client_max_body_size 500M;` in `server` block (already in config) |
| Telegram bot stops responding | Long-poll loop crashed | `pm2 logs` — look for `[telegram] poll error`; restart Node |

---

## 15. Going-live checklist (do all before pointing fans at it)

- [ ] Rotated OpenRouter key (the one shared in chat is compromised)
- [ ] Set OpenRouter spend cap (~$50-100/mo)
- [ ] Strong JWT_SECRET in `.env` (64 random hex chars)
- [ ] Strong Postgres password (64 random chars)
- [ ] Strong Cristina admin password (not `admin123`)
- [ ] `chmod 600 server/.env` (already done)
- [ ] DNS A records correct for cristina.com + www
- [ ] HTTPS working (`curl -I https://cristina.com` → 200)
- [ ] PM2 startup script saved (`pm2 startup` ran)
- [ ] Daily DB backup cron working (`crontab -l`)
- [ ] VPS snapshot enabled in provider dashboard
- [ ] Test account login + AI chat works end-to-end on the live URL
- [ ] Legal placeholders in `/terms`, `/privacy`, `/2257` filled in (state, custodian name, etc.)
- [ ] Telegram bot configured for live PPV approvals from your phone

---

**Welcome to the project. Read README.md + this file. You're caught up. Continue from where the user wants to go.**
