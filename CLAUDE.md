# Cristina Adam Platform — Claude memory

See `PROJECT.md` for the full status/architecture. Quick operational memory below.

## VPS / deployment access

- **VPS:** `192.3.81.151` (AlmaLinux · aaPanel + nginx + PM2). Node app on port 5000.
- **Run remote commands:** `python .deploy/ssh_run.py "<command>"`
  - Credentials live in **`.deploy/deploy_env.json`** (gitignored — host/user/password/port). **Never put the password in any tracked file** (CLAUDE.md / PROJECT.md are committed).
- **Deploy to production:** push to **`main`** → the `.githooks/pre-push` hook auto-runs `bash /root/deploy.sh` on the VPS (pull → clean → build client → PM2 reload → health). Deploy output streams to `.deploy/last-deploy.log`.
  - Manual alternative: `python .deploy/ssh_run.py "bash /root/deploy.sh"`.
  - Pushing any **non-main** branch does **not** deploy.
- **nginx vhosts on VPS:**
  - root: `/www/server/panel/vhost/nginx/thecristinaadam.com.conf` (proxies `/api/`, `/r/`, `/f/` → Node; SPA fallback for the rest).
  - members: `/www/server/panel/vhost/nginx/members.thecristinaadam.com.conf` (403s social bots).
  - Reload after edits: `nginx -t && nginx -s reload` (binary: `/www/server/nginx/sbin/nginx`).
  - nginx changes are **not** part of `deploy.sh` — they must be applied separately over SSH.

## Live URLs
- Marketing root (clean hub): https://thecristinaadam.com
- Members: https://members.thecristinaadam.com · Admin: `/admin`

## Conventions / guardrails
- **No cloaking:** `/f/:slug` (Fanvue funnel) and `/api/creator/:slug` MUST return identical responses for all User-Agents — no bot detection, no UA branching. See `PROJECT.md §0.2`.
- IG bio link = the **root domain** (clean hub). Never link `fanvue.com` or `/f/` directly from IG; keep bio/caption text neutral (no Fanvue/OnlyFans/exclusive/18+).
- Build/typecheck client: `cd client && npx tsc --noEmit -p tsconfig.app.json`.
