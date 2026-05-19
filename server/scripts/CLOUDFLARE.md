# Cloudflare setup — CDN, cache, geo-block, WAF

Recipes for the Cloudflare dashboard once `thecristinaadam.com` is pointed
at the VPS. Saves ~95% of bandwidth on `/uploads/` and adds a free WAF layer.

---

## 1. DNS — make sure records are proxied (orange cloud)

`Cloudflare dashboard → Websites → thecristinaadam.com → DNS`

| Type | Name | Content | Proxy |
|---|---|---|---|
| A | `@` | `<VPS IP>` | 🟠 **Proxied** |
| A | `www` | `<VPS IP>` | 🟠 **Proxied** |
| MX | `@` | `blizzard.mxrouting.net` (prio 10) | ☁️ DNS only |
| TXT | `@` | SPF / DMARC records from MXroute | ☁️ DNS only |

**Mail records must be "DNS only"** (grey cloud), web records "Proxied" (orange).

---

## 2. SSL/TLS

`SSL/TLS → Overview`

- Encryption mode: **Full (strict)** — requires a valid cert on the VPS too (Let's Encrypt via certbot, free).
- ❌ Avoid "Flexible" — that lets CF → origin traffic stay HTTP, which is insecure.

`SSL/TLS → Edge Certificates`
- ✅ Always Use HTTPS
- ✅ HTTP Strict Transport Security (HSTS) — enable with 12-month max-age once you're confident
- ✅ Automatic HTTPS Rewrites

---

## 3. Cache rule for `/uploads/*` (the big win)

`Caching → Cache Rules → Create rule`

| Setting | Value |
|---|---|
| Rule name | `Cache /uploads aggressively` |
| Field | URI Path |
| Operator | starts with |
| Value | `/uploads/` |
| Cache eligibility | Eligible for cache |
| Edge TTL | Use cache-control header from origin (or override: 1 year) |
| Browser TTL | 1 year |

The server already sends `Cache-Control: public, max-age=31536000, immutable`
on `/uploads/*`, so CF will respect that automatically. This rule just makes
it explicit and bumps priority.

**Result:** first request per file per region pulls from your VPS. Every
subsequent request (across all visitors in that region) is served from
Cloudflare's edge for free. Your VPS bandwidth bill stays near zero.

---

## 4. WAF — block bad bots + geo-block US adult-verification states (#7)

`Security → WAF → Custom rules → Create rule`

### Rule A — Bot blocklist (always on)

```
(cf.client.bot) and not (cf.verified_bot_category in {"Search Engine Crawler" "Search Engine Optimization"})
```
Action: **Block**

### Rule B — Adult-verification state block (pre-emptive, before lawsuits)

These US states have passed laws requiring formal age verification for adult
sites with stiff fines per violation. Easier to block than comply right now.

```
(ip.geoip.country eq "US") and (ip.geoip.subdivision_1_iso_code in {"TX" "LA" "UT" "MS" "MT" "AR" "NC" "VA" "FL" "TN" "KY"})
```
Action: **Block** with a custom JSON response:
```json
{ "error": "Not available in your state right now." }
```
Or: redirect to a static "/unavailable" page on your site.

> Verify the current list before launch — these laws keep getting passed.
> https://www.freespeechcoalition.com/age-verification-bills

### Rule C — Block requests with no User-Agent (mostly bots/scripts)

```
(http.user_agent eq "")
```
Action: **Block**

---

## 5. Page rules / Cache reserve (optional, paid)

Cache Reserve ($0.015/GB stored) keeps assets in CF cache forever instead
of evicting after a few days. Worth it once you have 50+ paid bundles and
fans re-viewing old content.

`Caching → Cache Reserve → Enable`

---

## 6. Verify the CDN is working

After DNS is proxied and the cache rule is live, request a `/uploads/`
file twice and check the `cf-cache-status` header:

```bash
# First request — likely MISS (pulls from origin)
curl -sI https://thecristinaadam.com/uploads/<file>.jpg | grep -i cf-cache

# Second request — should be HIT
curl -sI https://thecristinaadam.com/uploads/<file>.jpg | grep -i cf-cache
# Expected: cf-cache-status: HIT
```

If you see `HIT`, CF is serving from edge → VPS is not being hit → you're done.

---

## Quick "did I miss anything" checklist

- [ ] A records orange-cloud Proxied
- [ ] Mail records grey-cloud DNS only
- [ ] SSL set to Full (strict), Always Use HTTPS on
- [ ] Cache rule for `/uploads/` active
- [ ] WAF: bot block + state geo-block + empty-UA block
- [ ] Verified `cf-cache-status: HIT` after two requests
