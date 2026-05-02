# Technical Documentation: AI Model Blog Funnel (V2.0 Ultimate)

## 1. Project Overview
A high-performance, safe bridge-page funnel designed to drive Instagram traffic to monetization platforms (Fanvue) while maintaining a high brand "Trust Score" with social media algorithms.

---

## 2. Architecture
- **Frontend:** React 18 (Vite), TypeScript, React Router 6.
- **Backend:** Node.js + Express.
- **Database:** Flat-file JSON (`server/data/config.json`).
- **Media Storage:** Local file system (`server/uploads/`).

---

## 3. Media Requirements & Image Sizes
To maintain the "High Fashion" aesthetic and fast load times, follow these recommended dimensions:

| Component | Aspect Ratio | Recommended Resolution | File Type |
|-----------|--------------|------------------------|-----------|
| **Hero Slider** | 9:16 (Vertical) | 1080 x 1920 px | WebP / JPG |
| **Gallery** | 4:5 or 1:1 | 1080 x 1350 px | WebP / JPG |
| **Favicon** | 1:1 | 32 x 32 px | PNG / ICO |
| **Blog Thumbs** | 16:9 | 800 x 450 px | WebP / JPG |

*Note: The Full-Page Slider is optimized for vertical (mobile) viewing as 90% of traffic is expected from Instagram.*

---

## 4. Key Components

### Public Side
- `App.tsx`: Handles dynamic theme injection (CSS Variables), SEO meta management, and "Maintenance Mode" logic.
- `Home.tsx`: Full-page immersive slider with Ken Burns animation and latest gallery preview.
- `VIP.tsx`: The conversion point. Features blurred previews and the final Fanvue redirect.

### Admin Side (CMS)
- `Admin.tsx`: Centralized dashboard with tabbed navigation (Analytics, Content, Blog, Media, Socials, SEO, Theme, Settings).
- `api.ts`: Central service for fetching/updating `config.json` and handling multipart image uploads.

---

## 5. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/config` | Fetches public configuration (excludes password). |
| `POST` | `/api/login` | Validates admin password. |
| `POST` | `/api/config` | Updates `config.json` schema. |
| `POST` | `/api/upload` | Handles image uploads to `/uploads/`. |
| `GET` | `/api/analytics` | Returns page views and referrer data. |

---

## 6. Development & Extension
### To add a new feature:
1. **Schema:** Update `server/data/config.json` with the new data key.
2. **Backend:** If logic is needed, update `server/index.js`.
3. **Frontend:** 
   - Update `Admin.tsx` to include a control for the new data.
   - Update the relevant page component to display the data.

### Performance Constraint:
Always use `loading="lazy"` for images below the fold to maintain the sub-1-second load time requirement.

---

## 7. Security
- **Admin Password:** Stored in plain text in `config.json` for simplicity in this version.
- **Path Protection:** The `/admin` route is protected by a local storage token checked on component mount.
- **Safety:** The CMS includes built-in reminders to avoid "trigger words" (OnlyFans, Nudes) to prevent domain blacklisting.