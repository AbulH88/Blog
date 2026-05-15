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

// Instagram public oEmbed has been gated behind auth since 2020. Without an
// access token we can only do best-effort: derive the post shortcode from the
// URL and build the public thumbnail + embed URLs.
//
// Future iteration: integrate the Instagram Basic Display API for OAuthed
// creators (returns proper media + caption + permalink reliably).
const fetchPostMeta = async (url) => {
  if (!url) return null;
  const m = url.match(/instagram\.com\/(?:p|reel)\/([^/?#]+)/);
  if (!m) return null;
  const shortcode = m[1];
  return {
    url,
    shortcode,
    thumbnail: `https://www.instagram.com/p/${shortcode}/media/?size=l`,
    embedUrl: `https://www.instagram.com/p/${shortcode}/embed`,
  };
};

router.get('/:slug', async (req, res) => {
  try {
    const creator = await Creator.findOne({ where: { slug: req.params.slug } });
    if (!creator) return res.status(404).json({ error: 'Creator not found' });

    const posts = Array.isArray(creator.instagramPosts) ? creator.instagramPosts : [];

    const cached = readCache(req.params.slug);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS
        && Array.isArray(cached.urls)
        && cached.urls.length === posts.length
        && cached.urls.every((u, i) => u === posts[i])) {
      return res.json({ posts: cached.posts, cached: true });
    }

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
