# Uptime monitoring

A free 5-min check on `GET /api/health` so you get an alert within 5 min
if the server dies. UptimeRobot free tier covers 50 monitors at 5-min
intervals — plenty for this project.

## Endpoint

```
GET https://thecristinaadam.com/api/health
```

Healthy response (200):
```json
{
  "status": "ok",
  "uptime": 12345,
  "timestamp": "2026-05-20T03:00:00.000Z",
  "version": "1.0.0",
  "db": "reachable"
}
```

Unhealthy response (503): same shape but `status: "degraded"`, `db:
"unreachable"`, and `error: "<message>"`. UptimeRobot fires the alert
on the HTTP status code, the JSON body is for human-readable debugging.

The endpoint pings the database (single `SELECT 1`), so it catches DB
outages and not just "the Node process is up." Cache-Control: no-store
so Cloudflare never serves a stale "ok" while the origin is dead.

## UptimeRobot setup (5 min)

1. Sign up at <https://uptimerobot.com> (free tier, no credit card)
2. Dashboard → **+ New monitor**
3. Configure:

   | Field | Value |
   |---|---|
   | Monitor Type | **HTTP(s)** |
   | Friendly Name | `Cristina Platform — API health` |
   | URL | `https://thecristinaadam.com/api/health` |
   | Monitoring Interval | **5 minutes** (the free-tier minimum) |
   | Monitor Timeout | 30 seconds |
   | HTTP Method | GET |
   | Keyword Monitoring | enable → keyword `"status":"ok"` → alert if **not exists** |

4. Add **Alert Contacts**:
   - Email — your phone-receiving address
   - (Recommended) Telegram bot — instant push without unlocking phone
   - (Recommended) SMS — works even when you're offline (paid feature, ~$0.30/SMS)

5. Save. Run a manual check from the monitor's "..." menu → "Test" to
   confirm UptimeRobot can reach the endpoint.

## Status badge (optional, marketing)

UptimeRobot gives you a public status page URL. Useful to embed in a
"Service status" link in your footer once you have paying fans:
- Settings → Public Status Pages → New → choose monitors → custom URL

Or skip — internal monitoring only.

## Local smoke test

While the server is running on `localhost:5000`:

```bash
curl -s http://localhost:5000/api/health | jq
# Expect: {"status":"ok","uptime":...,"db":"reachable"}
```

Simulate a DB outage by stopping/locking the SQLite file → endpoint
should return 503.

## What triggers an alert

- HTTP 5xx returned (server crashed, DB unreachable)
- Connection timeout (≥30 s, configured above)
- Keyword `"status":"ok"` missing from body (degraded health)
- Cloudflare returning its own 5xx (origin offline)

What does NOT trigger an alert (intentional):
- 4xx — these are normal API responses to bad client requests
- Slow responses < timeout
- Rate-limit errors

## When you get an alert

1. SSH into the VPS: `ssh user@thecristinaadam.com`
2. Check pm2 status: `pm2 list` — if the node process is down, `pm2 restart all`
3. Check recent server logs: `pm2 logs --lines 100` or `tail -100 /var/log/cristina-server.log`
4. Check disk: `df -h` — out of space is a common SQLite-DB-write failure cause
5. Check CF dashboard for an origin error spike (CF caches some 5xx pages briefly)
6. If everything looks fine on the VPS, the issue is likely Cloudflare or DNS
