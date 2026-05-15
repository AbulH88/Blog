# Homepage Feature Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the v3 Homepage from a static-content shell to a creator-editable page with real social links, working hero slider, real Instagram feed, and an admin Bio Builder tab to control everything.

**Architecture:** Four independent features stacked into one page. Three are pure frontend (social SVGs, hero slider, Bio Builder UI). The Instagram feed needs backend support — a single proxy endpoint that fetches Instagram oEmbed/Basic Display data, caches it for 6 hours in a JSON file, and returns it to the public client. Bio Builder writes its state into the existing Creator model's JSON columns (`heroSlider`, `links`, `homeBio`, plus a new `featuredLinks` array) — no new tables.

**Tech Stack:** React 19, Vite, TypeScript, Express, Sequelize, plain CSS. Instagram integration uses Instagram's public oEmbed endpoint (no API key) for individual posts as a v1; users can paste post URLs and we render embeds. Future iteration can move to the OAuth-gated Basic Display API.

**Run order:**
1. Pre-req: complete `2026-05-14-admin-design-consistency.md` first so Admin styling is unified before we add a new Bio Builder tab.
2. This plan, tasks 1 → 7.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `client/src/components/SocialIcons.tsx` | Reusable SVG glyphs for Instagram, TikTok, YouTube, Twitter/X, Threads, Pinterest. Single component, switches by `name` prop. | Create |
| `client/src/components/HeroSlider.tsx` | Self-contained hero slider: auto-advance, dot navigation, Ken-Burns zoom. Used by Home. | Create |
| `client/src/components/InstagramFeed.tsx` | Fetches `/api/instagram/:slug` and renders a 3x3 grid. Falls back to gallery placeholder if empty. | Create |
| `client/src/pages/Home.tsx` | Compose the above. Drive featured-link tiles from `config.featuredLinks` instead of hardcoded array. | Modify |
| `client/src/pages/Admin.tsx` | Replace the `biobuilder` placeholder with a real editor: hero slider list, social links, featured-link tile rows. | Modify |
| `client/src/api.ts` | Add `getInstagramFeed(slug)` helper. Normalize/denormalize new `featuredLinks` field. | Modify |
| `client/src/styles/theme-v3.css` | Styles for the Bio Builder cards, drag-and-reorder rows. | Modify |
| `server/models/Creator.js` | Add new JSON column `featuredLinks` (default `[]`). | Modify |
| `server/models/index.js` | Add migration: `addIfMissing('Creators', 'featuredLinks', { type: JSON, defaultValue: [] })`. | Modify |
| `server/routes/creatorRoutes.js` | PATCH already passes unknown fields through — no changes needed. | (unchanged) |
| `server/routes/instagramRoutes.js` | NEW. `GET /api/instagram/:slug` returns cached oEmbed data for the creator's pinned post URLs. | Create |
| `server/index.js` | Mount `/api/instagram` router. | Modify |
| `server/data/.gitignore` | Ignore `instagram-cache-*.json` files. | Modify |

---

## Task 1: Build the SocialIcons component

**Files:**
- Create: `client/src/components/SocialIcons.tsx`

- [ ] **Step 1: Create the file**

```tsx
type IconName = 'instagram' | 'tiktok' | 'youtube' | 'twitter' | 'threads' | 'pinterest' | 'shopping' | 'document' | 'handshake';

interface Props {
  name: IconName;
  size?: number;
  color?: string;
}

/**
 * White-on-color SVG icons used by Home's featured-link tiles
 * and the footer. All viewBox 0 0 24 24, all currentColor.
 */
const SocialIcons = ({ name, size = 28, color = '#fff' }: Props) => {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    style: { color, display: 'block' },
    'aria-hidden': true,
  } as const;

  switch (name) {
    case 'instagram':
      return (
        <svg {...props}><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-5.838 2.435-5.838 5.838s2.435 5.838 5.838 5.838 5.838-2.435 5.838-5.838-2.435-5.838-5.838-5.838zm0 9.674c-2.09 0-3.836-1.746-3.836-3.836s1.746-3.836 3.836-3.836 3.836 1.746 3.836 3.836-1.746 3.836-3.836 3.836zm5.838-10.499c.742 0 1.344.603 1.344 1.344s-.603 1.344-1.344 1.344-1.344-.603-1.344-1.344.603-1.344 1.344-1.344z"/></svg>
      );
    case 'tiktok':
      return (
        <svg {...props}><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.83 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/></svg>
      );
    case 'youtube':
      return (
        <svg {...props}><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136C4.495 20.455 12 20.455 12 20.455s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.546 15.568V8.432L15.818 12l-6.272 3.568z"/></svg>
      );
    case 'twitter':
      return (
        <svg {...props}><path d="M18.244 2.25h3.308l-7.227 7.719 8.502 11.231h-6.653l-5.208-6.817-5.964 6.817H1.614l7.737-8.854L.813 2.25h6.823l4.707 6.227L18.244 2.25z"/></svg>
      );
    case 'threads':
      return (
        <svg {...props}><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.85 1.205 8.603.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.781 3.63 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.964-.065-1.19.408-2.285 1.33-3.082.88-.76 2.119-1.207 3.583-1.291 1.078-.062 2.087.005 3.02.195-.124-.748-.375-1.339-.75-1.759-.513-.577-1.308-.87-2.359-.876h-.029c-.844 0-1.992.232-2.721 1.32L7.83 7.844c.976-1.45 2.561-2.249 4.464-2.249h.044c3.182.019 5.078 1.949 5.267 5.31.108.046.216.094.32.144 1.49.7 2.58 1.761 3.154 3.07.797 1.82.871 4.79-1.548 7.158-1.85 1.81-4.094 2.628-7.277 2.65h-.04l-.029.001zm.135-9.787c-.282 0-.567.008-.857.025-1.984.116-3.214.92-3.111 2.014.077.815 1.001 1.59 2.45 1.51 1.357-.071 2.288-.605 2.876-1.738.404-.776.633-1.755.659-2.946-.673-.137-1.34-.198-1.973-.198l-.044.001z"/></svg>
      );
    case 'pinterest':
      return (
        <svg {...props}><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
      );
    case 'shopping':
      return (
        <svg {...props}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
      );
    case 'document':
      return (
        <svg {...props}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
      );
    case 'handshake':
      return (
        <svg {...props}><path d="M11 17 7 13l5-5 4 4-5 5zM3 12l5-5 4 4M21 12l-5-5-4 4M9 21l3-3 3 3"/></svg>
      );
    default:
      return null;
  }
};

export default SocialIcons;
```

- [ ] **Step 2: Verify it imports cleanly**

Watch Vite output. Expected: no compile errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/SocialIcons.tsx
git commit -m "feat(home): add SocialIcons component with 9 platform glyphs"
```

---

## Task 2: Drive featured-link tiles from creator config

Replace the hardcoded `tiles` array in `Home.tsx` with `config.featuredLinks` so the Bio Builder (Task 7) can edit them. Use the `SocialIcons` component.

**Files:**
- Modify: `client/src/pages/Home.tsx`
- Modify: `server/models/Creator.js` (add JSON column)
- Modify: `server/models/index.js` (migration)

- [ ] **Step 1: Add `featuredLinks` column to Creator model**

In `server/models/Creator.js`, add this line right after `fanvueUrl`:

```js
  // Bio Builder — array of { kind, title, subtitle, icon, href }
  featuredLinks: { type: DataTypes.JSON, defaultValue: [] },
```

- [ ] **Step 2: Add migration for existing DB**

In `server/models/index.js`, add this line inside `applyMigrations` after the `fanvueUrl` migration:

```js
  await addIfMissing('Creators', 'featuredLinks', { type: DataTypes.JSON, defaultValue: [] });
```

- [ ] **Step 3: Restart backend**

Run: `taskkill /f /im node.exe` (or stop the current backend task) then `cd server && node index.js`.

Expected log line: `+ added Creators.featuredLinks` on first start, then nothing on subsequent restarts.

Verify with: `curl -s http://localhost:5000/api/creator/cristina | grep featuredLinks`
Expected output: `"featuredLinks":[]`

- [ ] **Step 4: Add denormalize passthrough in `client/src/api.ts`**

Find the `denormalize` function. Add the `featuredLinks` line just after `fanvueUrl`:

```ts
    fanvueUrl: config.fanvueUrl || null,
    featuredLinks: config.featuredLinks || [],
```

In the `normalize` function add:

```ts
  fanvueUrl: creator.fanvueUrl || '',
  featuredLinks: creator.featuredLinks || [],
```

- [ ] **Step 5: Rewrite the tiles section in Home.tsx**

Find the `const tiles = [ ... ]` block. Replace with this block (uses creator config + falls back to a sane default if empty):

```tsx
  const defaultTiles = [
    { kind: 'terracotta', icon: 'instagram', title: 'INSTAGRAM', subtitle: '', href: config?.links?.instagram || '' },
    { kind: 'navy',       icon: 'tiktok',    title: 'TIKTOK',    subtitle: '', href: config?.links?.tiktok || '' },
    { kind: 'terracotta', icon: 'youtube',   title: 'YOUTUBE',   subtitle: 'Latest videos', href: config?.links?.youtube || '' },
    { kind: 'navy',       icon: 'shopping',  title: 'SHOP',      subtitle: 'My favorites',   href: '' },
    { kind: 'navy',       icon: 'document',  title: 'BLOG',      subtitle: 'Stories', href: '/blog' },
    { kind: 'terracotta', icon: 'handshake', title: 'COLLABS',   subtitle: '', href: '' },
  ];

  // Creator-edited tiles override defaults entirely if any exist
  const tiles = (config?.featuredLinks?.length ? config.featuredLinks : defaultTiles)
    .filter((t: any) => t.title); // drop empty rows
```

Then update the tile render block — replace the `{t.icon}` rendering with the SVG component:

```tsx
import SocialIcons from '../components/SocialIcons';
// ...
<span className="icon" aria-hidden>
  <SocialIcons name={t.icon} size={28} />
</span>
```

Also: hide tiles whose `href` is empty (so we don't render broken links). Wrap the map:

```tsx
{tiles.filter((t: any) => !!t.href).map((t, i) => { /* existing tile JSX */ })}
```

- [ ] **Step 6: Verify visually**

Open http://localhost:5173/. Tiles use real Instagram/TikTok SVG glyphs. Tiles without a URL set in `config.links` should disappear (not render as broken links).

- [ ] **Step 7: Commit**

```bash
git add server/models/Creator.js server/models/index.js client/src/api.ts client/src/pages/Home.tsx
git commit -m "feat(home): featured tiles driven by creator config + real social SVGs"
```

---

## Task 3: Build the HeroSlider component

Replace the static hero image with an auto-advancing slider that honors `config.images.heroSlider` (already an array).

**Files:**
- Create: `client/src/components/HeroSlider.tsx`
- Modify: `client/src/pages/Home.tsx`
- Modify: `client/src/styles/theme-v3.css`

- [ ] **Step 1: Create HeroSlider.tsx**

```tsx
import { useEffect, useState } from 'react';
import { SERVER_URL } from '../api';

interface Props {
  images: string[];
  interval?: number; // ms
  alt?: string;
}

const fullUrl = (p: string) => (p?.startsWith('http') ? p : `${SERVER_URL}${p}`);

const HeroSlider = ({ images, interval = 6000, alt = '' }: Props) => {
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = setInterval(() => setActive((i) => (i + 1) % images.length), interval);
    return () => clearInterval(id);
  }, [images.length, interval]);

  if (images.length === 0) {
    return <div className="v3-hero-image" style={{ background: '#e6d6c2' }} />;
  }

  return (
    <div className="v3-hero-slider">
      {images.map((img, i) => (
        <img
          key={img + i}
          src={fullUrl(img)}
          alt={alt}
          className={`v3-hero-slide ${i === active ? 'active' : ''}`}
          loading={i === 0 ? 'eager' : 'lazy'}
        />
      ))}
      {images.length > 1 && (
        <div className="v3-hero-dots">
          {images.map((_, i) => (
            <button
              key={i}
              className={`v3-hero-dot ${i === active ? 'active' : ''}`}
              onClick={() => setActive(i)}
              aria-label={`Show slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default HeroSlider;
```

- [ ] **Step 2: Add slider styles to theme-v3.css**

Find the `.v3-hero-image` block. Append directly below it:

```css
.v3-hero-slider {
  position: relative;
  width: 100%;
  height: 480px;
  border-radius: 2px;
  overflow: hidden;
}
.v3-hero-slide {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transform: scale(1.04);
  transition: opacity 1.2s ease, transform 6s ease;
}
.v3-hero-slide.active {
  opacity: 1;
  transform: scale(1);
}
.v3-hero-dots {
  position: absolute;
  bottom: 16px;
  left: 0; right: 0;
  display: flex;
  justify-content: center;
  gap: 6px;
  z-index: 2;
}
.v3-hero-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  border: none;
  background: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  transition: width 0.2s, background 0.2s;
}
.v3-hero-dot.active {
  width: 22px;
  border-radius: 4px;
  background: #fff;
}

@media (max-width: 960px) {
  .v3-hero-slider { height: 340px; }
}
```

- [ ] **Step 3: Wire HeroSlider into Home.tsx**

Find the hero `<img className="v3-hero-image" />` block. Replace it with:

```tsx
import HeroSlider from '../components/HeroSlider';
// ...
<HeroSlider
  images={config?.images?.heroSlider?.length
    ? config.images.heroSlider
    : (config?.images?.hero ? [config.images.hero] : [])}
  alt={config?.siteTitle}
/>
```

Remove the now-unused `heroImage` variable + the conditional that rendered a single img.

- [ ] **Step 4: Verify**

Open http://localhost:5173/. If the creator has 2+ images in `heroSlider`, you should see them cross-fade every 6 seconds. Dots at the bottom of the hero area; click a dot → it jumps to that slide. With only 1 image, no dots, no autoplay.

To test multi-image: log in as creator → **Settings** tab → Hero Slider Images → upload 2 more images → Save → return to /.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/HeroSlider.tsx client/src/pages/Home.tsx client/src/styles/theme-v3.css
git commit -m "feat(home): hero slider with auto-advance and dot navigation"
```

---

## Task 4: Instagram feed — backend proxy + cache

Build a backend endpoint that fetches Instagram oEmbed for each of the creator's stored post URLs and returns cached results.

**Files:**
- Create: `server/routes/instagramRoutes.js`
- Modify: `server/index.js`
- Modify: `server/data/.gitignore`
- Modify: `server/models/Creator.js` (add `instagramPosts` JSON column)
- Modify: `server/models/index.js` (migration)

- [ ] **Step 1: Add `instagramPosts` column to Creator model**

In `server/models/Creator.js`, after `featuredLinks`:

```js
  // Bio Builder — array of Instagram post URLs to display on Home IG feed
  instagramPosts: { type: DataTypes.JSON, defaultValue: [] },
```

In `server/models/index.js` migration:

```js
  await addIfMissing('Creators', 'instagramPosts', { type: DataTypes.JSON, defaultValue: [] });
```

- [ ] **Step 2: Create `server/routes/instagramRoutes.js`**

```js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { Creator } = require('../models');

const router = express.Router();

const CACHE_DIR = path.join(__dirname, '..', 'data');
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

const cacheFile = (slug) => path.join(CACHE_DIR, `instagram-cache-${slug}.json`);

const readCache = (slug) => {
  try {
    const raw = fs.readFileSync(cacheFile(slug), 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
};

const writeCache = (slug, data) => {
  try { fs.writeFileSync(cacheFile(slug), JSON.stringify(data)); } catch {}
};

// Instagram oEmbed — no auth required for permalink-only fetches.
// Endpoint: https://www.instagram.com/api/v1/oembed/?url=<post-url>
// Note: Meta deprecated the official oEmbed in 2020 for public access.
// Our v1 fallback: parse the post URL and return a placeholder card with
// "View on Instagram" link. v2 can integrate the Basic Display API.
const fetchPostMeta = async (url) => {
  // Extract shortcode from the URL: https://www.instagram.com/p/<code>/
  const m = url.match(/instagram\.com\/(?:p|reel)\/([^/?#]+)/);
  if (!m) return null;
  const shortcode = m[1];
  return {
    url,
    shortcode,
    // Instagram public thumbnail pattern (works in most browsers):
    thumbnail: `https://www.instagram.com/p/${shortcode}/media/?size=l`,
    embedUrl: `https://www.instagram.com/p/${shortcode}/embed`,
  };
};

router.get('/:slug', async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.slug } });
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const posts = creator.instagramPosts || [];

    // Cache lookup
    const cached = readCache(req.params.slug);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS && cached.urls.length === posts.length) {
      return res.json({ posts: cached.posts, cached: true });
    }

    // Refetch metadata
    const expanded = await Promise.all(posts.map(fetchPostMeta));
    const cleaned = expanded.filter(Boolean);

    writeCache(req.params.slug, {
      fetchedAt: Date.now(),
      urls: posts,
      posts: cleaned,
    });

    res.json({ posts: cleaned, cached: false });
  } catch (err) {
    res.status(500).json({ error: 'IG fetch failed', detail: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 3: Mount the router**

In `server/index.js`, find the existing route mounts (look for `app.use('/api/posts'`). Add directly below them:

```js
app.use('/api/instagram', require('./routes/instagramRoutes'));
```

- [ ] **Step 4: Add cache ignore rule**

Create or modify `server/data/.gitignore`:

```
instagram-cache-*.json
```

- [ ] **Step 5: Restart backend and verify endpoint**

Stop current node, run `cd server && node index.js`. Expected: `+ added Creators.instagramPosts` (then no error).

Test the empty case:
```bash
curl -s http://localhost:5000/api/instagram/cristina
```
Expected: `{"posts":[],"cached":false}`

Seed two URLs via SQL or via curl PATCH:
```bash
# Get an admin token first
curl -s -X POST http://localhost:5000/api/auth/creator/login \
  -H "Content-Type: application/json" \
  -d '{"email":"cristina@example.com","password":"admin123"}'
# Copy the token, then:
curl -s -X PATCH http://localhost:5000/api/creator/cristina \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"instagramPosts":["https://www.instagram.com/p/ABC123/","https://www.instagram.com/p/XYZ789/"]}'
```

Then re-curl `/api/instagram/cristina`. Expected: 2 posts with shortcode + thumbnail + embedUrl.

- [ ] **Step 6: Commit**

```bash
git add server/models/Creator.js server/models/index.js server/routes/instagramRoutes.js server/index.js server/data/.gitignore
git commit -m "feat(home): backend Instagram feed proxy with 6h JSON cache"
```

---

## Task 5: Instagram feed — frontend component

**Files:**
- Create: `client/src/components/InstagramFeed.tsx`
- Modify: `client/src/api.ts`
- Modify: `client/src/pages/Home.tsx`

- [ ] **Step 1: Add client helper**

In `client/src/api.ts` add:

```ts
export const getInstagramFeed = async (slug: string) => {
  const res = await fetch(`${API_URL}/instagram/${slug}`);
  return res.json();
};
```

- [ ] **Step 2: Create InstagramFeed.tsx**

```tsx
import { useEffect, useState } from 'react';
import { getInstagramFeed, SERVER_URL } from '../api';

interface IGPost {
  url: string;
  shortcode: string;
  thumbnail: string;
  embedUrl: string;
}

const fullUrl = (p: string) => (p?.startsWith('http') ? p : `${SERVER_URL}${p}`);

const InstagramFeed = ({ slug, fallbackImages = [] }: { slug: string; fallbackImages?: string[] }) => {
  const [posts, setPosts] = useState<IGPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getInstagramFeed(slug)
      .then((data) => { if (!cancelled) setPosts(data?.posts || []); })
      .catch(() => { /* swallow; fall back to gallery */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  // Fall back to creator's gallery when no IG posts are configured
  const showFallback = !loading && posts.length === 0 && fallbackImages.length > 0;

  return (
    <div className="v3-ig-feed">
      <h3>INSTAGRAM FEED</h3>
      <div className="v3-ig-grid">
        {loading && [...Array(9)].map((_, i) => (
          <div key={i} className="v3-ig-card">
            <div style={{ aspectRatio: '1/1', background: '#eee' }} />
          </div>
        ))}

        {!loading && posts.map((p, i) => (
          <a key={p.shortcode} href={p.url} target="_blank" rel="noreferrer" className="v3-ig-card">
            <img src={p.thumbnail} alt="" loading="lazy"
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2'; }} />
            <div className="meta">♡ ◯ ⤴ <span style={{ marginLeft: 'auto' }}>View</span></div>
          </a>
        ))}

        {showFallback && fallbackImages.slice(0, 9).map((img, i) => (
          <div key={i} className="v3-ig-card">
            <img src={fullUrl(img)} alt="" loading="lazy" />
            <div className="meta">♡ ◯ ⤴ <span style={{ marginLeft: 'auto' }}>—</span></div>
          </div>
        ))}

        {!loading && posts.length === 0 && fallbackImages.length === 0 && (
          [...Array(9)].map((_, i) => (
            <div key={i} className="v3-ig-card">
              <div style={{ aspectRatio: '1/1', background: '#f1e4d6' }} />
              <div className="meta">♡ ◯ ⤴ • —</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default InstagramFeed;
```

- [ ] **Step 3: Wire into Home.tsx**

Find the existing `<div className="v3-ig-feed">` block in Home. Replace the entire block with:

```tsx
<InstagramFeed
  slug={config?.slug || 'cristina'}
  fallbackImages={config?.images?.gallery || []}
/>
```

Remove the `igPosts` and `igFilled` variables — no longer needed.

Add the import:

```tsx
import InstagramFeed from '../components/InstagramFeed';
```

- [ ] **Step 4: Verify**

Open http://localhost:5173/. The right column shows a 3x3 grid.

- If `instagramPosts` is set on the creator: real IG thumbnails (might 403 if Instagram blocks the unauthenticated thumbnail fetch — that's expected, the user-facing URL still works on click).
- If `instagramPosts` is empty and `gallery` has images: gallery images render as the feed.
- If both empty: 9 cream placeholders.

- [ ] **Step 5: Commit**

```bash
git add client/src/api.ts client/src/components/InstagramFeed.tsx client/src/pages/Home.tsx
git commit -m "feat(home): InstagramFeed component with fallback to gallery"
```

---

## Task 6: Bio Builder UI in Admin — replace placeholder

Wire the existing `biobuilder` tab placeholder to a real editor with three sections: Hero Slider Images, Social Links, Featured Tiles, Instagram Posts.

**Files:**
- Modify: `client/src/pages/Admin.tsx`
- Modify: `client/src/styles/theme-v3.css` (add `.v3-bio-row` styles)

- [ ] **Step 1: Add the renderBioBuilder function**

In `Admin.tsx`, just below `renderPlaceholder`, add this new render function:

```tsx
  const renderBioBuilder = () => {
    const featuredLinks: any[] = formData.featuredLinks || [];
    const instagramPosts: string[] = formData.instagramPosts || [];

    const updateFeatured = (idx: number, patch: any) => {
      const next = [...featuredLinks];
      next[idx] = { ...next[idx], ...patch };
      setFormData({ ...formData, featuredLinks: next });
    };

    const addFeatured = () => setFormData({
      ...formData,
      featuredLinks: [...featuredLinks, { kind: 'terracotta', icon: 'instagram', title: '', subtitle: '', href: '' }],
    });

    const removeFeatured = (idx: number) => setFormData({
      ...formData,
      featuredLinks: featuredLinks.filter((_, i) => i !== idx),
    });

    const updateIg = (idx: number, url: string) => {
      const next = [...instagramPosts];
      next[idx] = url;
      setFormData({ ...formData, instagramPosts: next });
    };
    const addIg = () => setFormData({ ...formData, instagramPosts: [...instagramPosts, ''] });
    const removeIg = (idx: number) => setFormData({ ...formData, instagramPosts: instagramPosts.filter((_, i) => i !== idx) });

    return (
      <div>
        <h1 className="title">BIO BUILDER</h1>
        <p className="welcome">Edit your homepage hero, social links, featured tiles, and IG feed.</p>

        {/* Social Links — already in Settings but mirror here for one-page editing */}
        <div className="av2-card">
          <p className="av2-section-label">Social Links</p>
          <label className="av2-label">Instagram</label>
          <input className="av2-input" name="links.instagram" value={formData.links?.instagram || ''} onChange={handleChange} placeholder="https://instagram.com/…" />
          <label className="av2-label">TikTok</label>
          <input className="av2-input" name="links.tiktok" value={formData.links?.tiktok || ''} onChange={handleChange} placeholder="https://tiktok.com/@…" />
          <label className="av2-label">YouTube</label>
          <input className="av2-input" name="links.youtube" value={formData.links?.youtube || ''} onChange={handleChange} placeholder="https://youtube.com/@…" />
          <label className="av2-label">Twitter / X</label>
          <input className="av2-input" name="links.twitter" value={formData.links?.twitter || ''} onChange={handleChange} placeholder="https://x.com/…" />
        </div>

        {/* Featured tiles */}
        <div className="av2-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p className="av2-section-label" style={{ marginBottom: 0 }}>Featured Tiles ({featuredLinks.length})</p>
            <button onClick={addFeatured}
              style={{ background: 'var(--v3-terracotta)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
              + Add Tile
            </button>
          </div>

          {featuredLinks.length === 0 && (
            <p style={{ fontSize: '0.86rem', color: 'var(--v3-muted)' }}>
              No custom tiles yet — your homepage uses the default Instagram/TikTok/YouTube tiles.
            </p>
          )}

          {featuredLinks.map((t, idx) => (
            <div key={idx} className="v3-bio-row">
              <select value={t.icon} onChange={(e) => updateFeatured(idx, { icon: e.target.value })}>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="twitter">Twitter/X</option>
                <option value="threads">Threads</option>
                <option value="pinterest">Pinterest</option>
                <option value="shopping">Shop</option>
                <option value="document">Document</option>
                <option value="handshake">Collab</option>
              </select>
              <select value={t.kind} onChange={(e) => updateFeatured(idx, { kind: e.target.value })}>
                <option value="terracotta">Terracotta</option>
                <option value="navy">Navy</option>
              </select>
              <input
                placeholder="Title (e.g. INSTAGRAM)"
                value={t.title}
                onChange={(e) => updateFeatured(idx, { title: e.target.value })}
              />
              <input
                placeholder="Subtitle (optional)"
                value={t.subtitle}
                onChange={(e) => updateFeatured(idx, { subtitle: e.target.value })}
              />
              <input
                placeholder="URL or /path"
                value={t.href}
                onChange={(e) => updateFeatured(idx, { href: e.target.value })}
              />
              <button onClick={() => removeFeatured(idx)} className="av2-tag-btn red" aria-label="Remove">✕</button>
            </div>
          ))}
        </div>

        {/* Instagram posts */}
        <div className="av2-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p className="av2-section-label" style={{ marginBottom: 0 }}>Instagram Posts ({instagramPosts.length})</p>
            <button onClick={addIg}
              style={{ background: 'var(--v3-terracotta)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
              + Add Post URL
            </button>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--v3-muted)', margin: '0 0 12px' }}>
            Paste full Instagram post URLs (https://www.instagram.com/p/…). Up to 9 will display on your home page.
          </p>

          {instagramPosts.map((url, idx) => (
            <div key={idx} className="v3-bio-row">
              <input
                style={{ flex: 1 }}
                placeholder="https://www.instagram.com/p/XYZ123/"
                value={url}
                onChange={(e) => updateIg(idx, e.target.value)}
              />
              <button onClick={() => removeIg(idx)} className="av2-tag-btn red" aria-label="Remove">✕</button>
            </div>
          ))}
        </div>

        {/* Save bar */}
        <div className="av2-save-bar">
          {status && <span style={{ fontSize: '0.85rem', color: status.includes('Error') ? 'var(--v3-danger)' : 'var(--v3-success)', fontWeight: 600 }}>{status}</span>}
          <button className="v3-btn v3-btn-primary" onClick={handleSave} style={{ padding: '12px 30px' }}>
            Save Changes
          </button>
        </div>
      </div>
    );
  };
```

- [ ] **Step 2: Replace the biobuilder placeholder switch line**

Find:

```tsx
{activeTab === 'biobuilder' && renderPlaceholder('Bio Builder', 'Drag-and-drop links, themes, and section blocks for your landing page.')}
```

Replace with:

```tsx
{activeTab === 'biobuilder' && renderBioBuilder()}
```

- [ ] **Step 3: Add `.v3-bio-row` styles to theme-v3.css**

Append to the legacy override section from the Admin Design Consistency plan (or add a new section):

```css
.v3-bio-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.v3-bio-row select,
.v3-bio-row input {
  background: #FFFAF4;
  border: 1.5px solid var(--v3-line);
  border-radius: 8px;
  padding: 9px 12px;
  font-family: var(--v3-body);
  font-size: 0.84rem;
  color: var(--v3-ink);
  outline: none;
}
.v3-bio-row select { min-width: 120px; }
.v3-bio-row input { flex: 1; min-width: 140px; }
.v3-bio-row input:focus,
.v3-bio-row select:focus { border-color: var(--v3-terracotta); }
```

- [ ] **Step 4: Verify**

Open http://localhost:5173/admin → log in → click **Bio Builder** in sidebar.

Expected: full editor with Social Links / Featured Tiles / Instagram Posts cards.

Add a featured tile: Icon `instagram`, Kind `terracotta`, Title `LATEST POST`, Subtitle `Check it out`, URL `https://instagram.com/…`. Save. Visit `/` → the homepage shows your new tile in the grid.

Add an Instagram post URL → Save → visit `/` → IG feed shows that post's thumbnail (or at least renders the row without breaking).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Admin.tsx client/src/styles/theme-v3.css
git commit -m "feat(admin): Bio Builder tab — edit social links, featured tiles, IG posts"
```

---

## Task 7: Plan-level smoke test and cleanup

- [ ] **Step 1: End-to-end walkthrough**

1. Log in as creator at /login.
2. Settings tab → upload 3 hero images. Save.
3. Bio Builder tab → set Instagram + TikTok + YouTube social URLs. Save.
4. Bio Builder tab → add 2 featured tiles + 3 Instagram post URLs. Save.
5. Sign out, visit `/`.
6. Hero shows 3 images cross-fading every 6s with dot navigation working.
7. Featured-tile grid shows your 2 new tiles using correct social SVGs, with empty-href tiles hidden.
8. IG feed shows 3 real-Instagram-thumbnail tiles, the rest fall back to gallery placeholders.

- [ ] **Step 2: Quick mobile check**

Resize to ~390px width. Hero shrinks to 340px height. Tiles wrap. IG feed stays readable.

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat(home): bio-builder driven homepage end-to-end" --allow-empty
```

---

## Verification (post-plan)

A. `curl -s http://localhost:5000/api/creator/cristina | grep -E "featuredLinks|instagramPosts"` returns both fields.
B. `curl -s http://localhost:5000/api/instagram/cristina` returns the configured posts.
C. Homepage / shows the editable hero slider + creator-driven tiles + IG feed.
D. Admin → Bio Builder tab can add/remove featured tiles and IG posts; Save persists to backend.
E. Removing all featured tiles falls back to the default Instagram/TikTok/YouTube/Shop/Blog/Collab tiles.

## Known limitations (not in scope)

- Instagram thumbnail URLs (`https://www.instagram.com/p/<code>/media/?size=l`) are unofficially supported and may 403 when Meta tightens access. v2 should integrate the Instagram Basic Display API with OAuth (creator-side authorization, refresh tokens). Out of scope here.
- Featured tile reordering is by add/remove only — drag-to-reorder is a future enhancement.
- Hero slider has no manual prev/next arrows on mobile — only dots. Add if requested.
- The "Shop" tile from the navbar/footer is intentionally hidden (per user). Bio Builder lets you re-add it as a featured tile if you want.
