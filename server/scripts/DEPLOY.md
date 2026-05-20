# Deploy guide — aaPanel + nginx + PM2 cluster + Cloudflare

End-to-end runbook for shipping the Cristina Platform to a fresh aaPanel VPS.
Read top to bottom on launch day; cross-reference the other docs in this
folder as you go.

---

## 0. Prerequisites

- aaPanel installed on the VPS (any 2-core / 4 GB / 80 GB box is fine to start — Hetzner CX22, Vultr/DigitalOcean equivalents).
- Domain DNS pointed at the VPS IP via Cloudflare (orange-cloud proxied).
- The following installed from `aaPanel → App Store`:
  - **Node.js 20+** (aaPanel installs nvm under the hood)
  - **PostgreSQL 16**
  - **Redis** (latest)
  - **PM2** (aaPanel "Node Project" feature uses PM2 internally)

---

## 1. Database + user (one-time)

See `POSTGRES.md` for the aaPanel PG Manager flow. Create:
- DB: `cristina_prod`
- User: `cristina_app` (with auto-gen password)
- Grant ALL on this DB to that user

Save the password — going into `.env` next.

---

## 2. Pull the repo

```bash
cd /www/wwwroot
sudo mkdir -p cristina && sudo chown -R $USER:$USER cristina
git clone https://github.com/AbulH88/Blog.git cristina
cd cristina/server
npm ci --omit=dev
cd ../client
npm ci
npm run build
```

Output goes to `client/dist/` — that's what nginx serves as the frontend.

---

## 3. Server `.env`

`/www/wwwroot/cristina/server/.env`:

```bash
# Required
JWT_SECRET=$(openssl rand -hex 64)
JWT_EXPIRES_IN=24h
PORT=5000

# Database (Postgres — see POSTGRES.md)
DB_DIALECT=postgres
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cristina_prod
DB_USER=cristina_app
DB_PASSWORD=<paste from aaPanel PG Manager>
DB_SSL=false

# Redis
REDIS_URL=redis://localhost:6379
# If you set a password in aaPanel Redis config:
# REDIS_URL=redis://:PASSWORD@localhost:6379

# Public URLs
SITE_URL=https://thecristinaadam.com
PUBLIC_APP_URL=https://thecristinaadam.com
PUBLIC_API_URL=https://thecristinaadam.com

# CORS allow-list
ALLOWED_ORIGINS=https://thecristinaadam.com,https://www.thecristinaadam.com

# SMTP (MXroute — already configured)
SMTP_HOST=blizzard.mxrouting.net
SMTP_PORT=465
SMTP_USER=noreply@thecristinaadam.com
SMTP_PASS='<paste — use single quotes if it contains #>'
SMTP_FROM=Cristina Adam <noreply@thecristinaadam.com>

# NOWPayments (already live)
NOWPAYMENTS_API_KEY=...
NOWPAYMENTS_IPN_SECRET=...

# OpenRouter (AI chatbot)
OPENROUTER_API_KEY=sk-or-v1-...

# Sentry (optional — get DSN from sentry.io)
SENTRY_DSN=
```

```bash
chmod 600 /www/wwwroot/cristina/server/.env
```

---

## 4. PM2 cluster mode

`/www/wwwroot/cristina/server/ecosystem.config.js`:

```js
module.exports = {
  apps: [{
    name: 'cristina-server',
    script: 'index.js',
    cwd: '/www/wwwroot/cristina/server',
    instances: 2,           // 2 workers — matches typical 2-core VPS
    exec_mode: 'cluster',   // load-balances HTTP across workers
    max_memory_restart: '600M',
    env: {
      NODE_ENV: 'production',
    },
    error_file: '/var/log/cristina/error.log',
    out_file:   '/var/log/cristina/out.log',
    time: true,             // prefix each log line with ISO timestamp
  }],
};
```

```bash
sudo mkdir -p /var/log/cristina && sudo chown -R $USER:$USER /var/log/cristina
pm2 start ecosystem.config.js
pm2 save                    # remember running apps across reboot
pm2 startup                 # follow the printed command to enable on boot
```

Verify both workers are running: `pm2 list` should show `online | online` and `cluster mode`.

---

## 5. nginx — frontend static + API reverse proxy + CF-only origin

In aaPanel → Websites → thecristinaadam.com → Config → paste this on top of the auto-generated config (above any default `location` blocks):

```nginx
# Restrict access to Cloudflare IPs only — prevents anyone bypassing
# CF protection by hitting the VPS IP directly.
# Update this list periodically: https://www.cloudflare.com/ips-v4/
# (and ips-v6 — strip /www/server/panel default-allow IPs first)
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
real_ip_header CF-Connecting-IP;

# brotli + gzip — CF compresses edge-side, but origin compression helps
# on cache MISS and intra-CF→origin transfers.
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;
# Brotli requires the ngx_brotli module — aaPanel may already have it; if
# `nginx -V 2>&1 | grep brotli` shows it, uncomment:
# brotli on;
# brotli_comp_level 5;
# brotli_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

# HTTP/2 — aaPanel sets this when you enable SSL. Verify with `listen 443 ssl http2;`.

# Frontend static (Vite build)
root /www/wwwroot/cristina/client/dist;
index index.html;

# Hash-named JS / CSS assets cache forever
location /assets/ {
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
}

# Uploaded media — backend serves with its own immutable cache header
location /uploads/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable" always;
}

# API
location /api/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}

# Socket.IO (specific path so we get explicit websocket upgrade)
location /socket.io/ {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 86400;
}

# SPA fallback — every other route returns index.html so React Router can
# render the page client-side.
location / {
    try_files $uri $uri/ /index.html;
}

# Hide nginx version in headers
server_tokens off;
```

Save → aaPanel reloads nginx. Test: `curl -I https://thecristinaadam.com` returns 200.

---

## 6. SSL — Let's Encrypt via aaPanel

aaPanel → Websites → thecristinaadam.com → SSL → Let's Encrypt → Apply.
Auto-renews every 90 days. Make sure "Force HTTPS" is on.

---

## 7. Backup cron

See `BACKUPS.md`. Quick version:

```bash
chmod +x /www/wwwroot/cristina/server/scripts/backup.sh
sudo tee /etc/cristina-backup.env <<'EOF'
SERVER_DIR=/www/wwwroot/cristina/server
BACKUP_DIR=/var/backups/cristina
KEEP_DAYS=14
RCLONE_REMOTE=    # leave empty until you set up B2/R2
EOF
sudo mkdir -p /var/backups/cristina && sudo chown $USER:$USER /var/backups/cristina

# Cron — 3 AM daily
( crontab -l 2>/dev/null; echo "0 3 * * * /www/wwwroot/cristina/server/scripts/backup.sh >> /var/log/cristina-backup.log 2>&1" ) | crontab -
```

Note: for Postgres we should also dump the DB. Update `backup.sh` later
to add `pg_dump cristina_prod > $BACKUP_DIR/db-$TS.sql` before the tar.

---

## 8. Log rotation

Prevent `/var/log/cristina/*.log` from growing forever:

```bash
sudo tee /etc/logrotate.d/cristina <<'EOF'
/var/log/cristina/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www www
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
EOF
```

Test: `sudo logrotate -d /etc/logrotate.d/cristina` (dry-run).

---

## 9. fail2ban — SSH brute-force protection

```bash
sudo apt install -y fail2ban
sudo tee /etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
findtime = 600
bantime = 3600
EOF
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

---

## 10. Cloudflare dashboard

See `CLOUDFLARE.md`. Key items:
- DNS records orange-cloud Proxied
- SSL/TLS → Full (strict)
- Cache rule for `/uploads/*` aggressive caching
- WAF rules: bot blocklist, state geo-block, empty-UA block

---

## 11. UptimeRobot

See `UPTIME.md`. Add the `/api/health` monitor with keyword `"status":"ok"`.

---

## 12. First-boot verification

```bash
# Server up?
curl https://thecristinaadam.com/api/health | jq

# Site loads?
curl -I https://thecristinaadam.com

# DB writes work? Sign up via UI, check Users table:
psql -U cristina_app -d cristina_prod -c "SELECT id, email, emailVerified FROM \"Users\";"

# Redis active?
redis-cli ping     # PONG

# PM2 cluster?
pm2 list           # should show 2 instances, cluster mode, online

# Logs look clean?
pm2 logs --lines 50
```

---

## Rollback plan

If a deploy goes bad:
```bash
cd /www/wwwroot/cristina
git log --oneline -5         # find the last good commit
git checkout <commit>
cd client && npm run build
pm2 reload all
```

DB schema changes from migrations can be reverted manually via psql. Worst case, restore from backup:
```bash
/www/wwwroot/cristina/server/scripts/restore.sh latest
```
