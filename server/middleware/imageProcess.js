/**
 * Image post-processing middleware — runs after multer, before the route handler.
 *
 * For each uploaded file:
 *   - If it's an image (jpg/png/webp/gif), resize to max 2000px wide and
 *     re-encode as JPEG quality 82. Animated GIFs are passed through untouched.
 *   - If it's video/audio, skip — multer already capped the size and these
 *     would need ffmpeg to transcode (out of scope for now).
 *
 * The original disk filename is preserved so DB references stay valid; the
 * file extension is rewritten to `.jpg` when re-encoded so the MIME stays
 * consistent. We swap req.file.filename / mimetype to match.
 *
 * Why this exists:
 *   Without it, multer accepts up to 500 MB photos. A few 4K JPEGs would
 *   blow out the VPS disk + Cloudflare bandwidth budget. Resizing on
 *   upload typically reduces a 12 MB phone JPEG to ~250 KB.
 */
const sharp = require('sharp');
const fs = require('fs').promises;
const path = require('path');

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const IMAGE_MIMES = /^image\/(jpeg|png|webp|gif)$/i;

const MAX_WIDTH = 2000;   // Photo gallery rarely needs more than this
const JPEG_QUALITY = 82;  // ~85% perceptual quality, ~30% file size of original

/**
 * Reprocess a single file in place. Returns the (possibly rewritten) file object.
 * Animated GIFs are passed through — re-encoding strips animation and we'd
 * rather keep the file as-is than silently break it.
 */
async function processOne(file) {
  if (!file?.path) return file;

  const ext = path.extname(file.originalname || file.filename || '').toLowerCase();
  const isImageByExt = IMAGE_EXTS.has(ext);
  const isImageByMime = IMAGE_MIMES.test(file.mimetype || '');
  if (!isImageByExt && !isImageByMime) return file;

  // Animated GIFs — leave alone (sharp would lose animation by default).
  if (ext === '.gif') {
    try {
      const meta = await sharp(file.path).metadata();
      if ((meta.pages || 1) > 1) return file;
    } catch { /* fall through and re-encode static gif as jpeg */ }
  }

  try {
    const img = sharp(file.path, { failOn: 'none' });
    const meta = await img.metadata();
    const needsResize = (meta.width || 0) > MAX_WIDTH;

    // Preserve transparency: PNG/WebP images with an alpha channel must stay
    // in a format that supports alpha. JPEG flattens alpha to black — the
    // classic "transparent logo on black" bug. Detect alpha and route to
    // PNG output (smaller than JPEG for typical logos with few colors).
    const keepAlpha = !!meta.hasAlpha;
    const outExt = keepAlpha ? '.png' : '.jpg';
    const outMime = keepAlpha ? 'image/png' : 'image/jpeg';

    const dir = path.dirname(file.path);
    const base = path.basename(file.path, path.extname(file.path));
    const tmpPath = path.join(dir, `${base}.tmp${outExt}`);
    const finalPath = path.join(dir, `${base}${outExt}`);

    let pipeline = sharp(file.path, { failOn: 'none' }).rotate(); // auto-orient
    if (needsResize) pipeline = pipeline.resize({ width: MAX_WIDTH, withoutEnlargement: true });
    if (keepAlpha) {
      // PNG with palette + max compression — good for logos/UI graphics.
      // palette:true quantizes to 256 colors which dramatically shrinks
      // photographic PNGs but is fine for flat logos. The library falls
      // back to non-palette PNG automatically if quantization fails.
      pipeline = pipeline.png({ compressionLevel: 9, palette: true });
    } else {
      pipeline = pipeline.jpeg({ quality: JPEG_QUALITY, progressive: true, mozjpeg: true });
    }

    await pipeline.toFile(tmpPath);

    // If extension changed (e.g. .jpg → .png for an alpha PNG, or .png → .jpg
    // for a flat one) the original is at a different path — remove it.
    if (file.path !== finalPath) {
      await fs.unlink(file.path).catch(() => {});
    }
    await fs.rename(tmpPath, finalPath);

    // Update the file object so the route handler stores the new filename.
    const newFilename = path.basename(finalPath);
    file.path = finalPath;
    file.filename = newFilename;
    file.mimetype = outMime;
    const stat = await fs.stat(finalPath);
    file.size = stat.size;
  } catch (err) {
    // If anything fails (corrupt upload, sharp panic), leave the original.
    console.warn('[imageProcess] failed for', file.path, '—', err.message);
  }
  return file;
}

/**
 * Express middleware. Works with single, array, and fields multer setups.
 */
async function processImageUploads(req, _res, next) {
  try {
    if (req.file) {
      await processOne(req.file);
    }
    if (Array.isArray(req.files)) {
      for (const f of req.files) await processOne(f);
    } else if (req.files && typeof req.files === 'object') {
      // .fields() → { fieldName: File[] }
      for (const arr of Object.values(req.files)) {
        if (Array.isArray(arr)) for (const f of arr) await processOne(f);
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { processImageUploads, processOne };
