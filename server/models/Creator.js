const { DataTypes } = require('sequelize');
const sequelize = require('../database');

const Creator = sequelize.define('Creator', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  slug: { type: DataTypes.STRING, allowNull: false, unique: true },
  displayName: { type: DataTypes.STRING, allowNull: false },
  email: { type: DataTypes.STRING, allowNull: false, unique: true },
  passwordHash: { type: DataTypes.STRING, allowNull: false },

  // Public profile
  bio: { type: DataTypes.TEXT, defaultValue: '' },
  shortBio: { type: DataTypes.TEXT, defaultValue: '' },
  profileImage: { type: DataTypes.STRING, defaultValue: '' },
  heroImages: { type: DataTypes.JSON, defaultValue: [] },
  galleryImages: { type: DataTypes.JSON, defaultValue: [] },

  // Monetisation
  subscriptionPrice: { type: DataTypes.DECIMAL(10, 2), defaultValue: 9.99 },
  subscriptionPricePremium: { type: DataTypes.DECIMAL(10, 2), defaultValue: 24.99 },
  welcomeMessage: { type: DataTypes.TEXT, defaultValue: '' },
  // Phase 6.6 — Welcome PPV: auto-sent to every new fan on registration.
  // When welcomeEnabled is true, a Message is created with isPPV=true,
  // ppvPrice=welcomePpvPrice, mediaUrl=welcomeMediaUrl, content=welcomePpvText.
  welcomeEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  welcomePpvText: { type: DataTypes.TEXT, allowNull: true },
  welcomeMediaUrl: { type: DataTypes.STRING, allowNull: true },
  welcomePpvPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: true },

  // Branding (applied as CSS variables on the frontend)
  theme: {
    type: DataTypes.JSON,
    defaultValue: {
      primaryColor: '#ffffff',
      backgroundColor: '#0a0a0a',
      accentColor: '#ffffff',
      fontFamily: "'Didot', serif",
    },
  },

  // Fanvue link — outbound CTA target for the "Join Premium" modal
  fanvueUrl: { type: DataTypes.STRING, allowNull: true },

  // Discreet billing descriptor — shown on bank statements for every
  // charge. Max ~22 chars (Visa/MC limit). Must be neutral / brand-safe —
  // adult processors will reject anything revealing the nature of the
  // content. Example: "CRISTINA" or "CRISTINA-DIGITAL".
  billingDescriptor: { type: DataTypes.STRING, allowNull: true },

  // Brand — logo image URL (shown in navbar + admin sidebar in place of wordmark)
  logoUrl: { type: DataTypes.STRING, allowNull: true },

  // Bio Builder — array of { kind, title, subtitle, icon, href }
  featuredLinks: { type: DataTypes.JSON, defaultValue: [] },
  // Bio Builder — array of Instagram post URLs displayed in IG feed grid
  instagramPosts: { type: DataTypes.JSON, defaultValue: [] },

  // External links
  links: {
    type: DataTypes.JSON,
    defaultValue: {
      instagram: '',
      twitter: '',
      tiktok: '',
    },
  },

  // SEO — must use lifestyle/blog language, never adult keywords
  seo: {
    type: DataTypes.JSON,
    defaultValue: {
      metaTitle: '',
      metaDescription: '',
      favicon: '',
      ogImage: '',
    },
  },

  // Blog posts stored per creator
  blog: { type: DataTypes.JSON, defaultValue: [] },

  // Homepage extras
  faq: { type: DataTypes.JSON, defaultValue: [] },
  mustHaves: { type: DataTypes.JSON, defaultValue: [] },

  // Site state
  isLive: { type: DataTypes.BOOLEAN, defaultValue: true },
  maintenanceMode: { type: DataTypes.BOOLEAN, defaultValue: false },

  // Analytics
  analytics: {
    type: DataTypes.JSON,
    defaultValue: { totalHits: 0, pages: {}, referrers: {} },
  },

  // ─── AI Chatbot ─────────────────────────────────────────────
  // Persona/voice script the AI uses to reply in this creator's voice.
  // Admin-editable. If null, a default is generated from bio + displayName.
  aiPersonaPrompt: { type: DataTypes.TEXT, allowNull: true },
  // OpenRouter model slug. Default = Lumimaid 70B (NSFW-tuned, 131K ctx).
  aiModel: { type: DataTypes.STRING, defaultValue: 'sao10k/l3.3-euryale-70b' },
  // NSFW gate passed into the system prompt.
  aiNsfwLevel: { type: DataTypes.ENUM('off', 'flirty', 'explicit'), defaultValue: 'flirty' },
  // Whether the AI is allowed to attach PPV vault Collections to its replies.
  aiPpvEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  // Minimum fan-message count between AI-sent PPVs (anti-spam).
  aiPpvCadence: { type: DataTypes.INTEGER, defaultValue: 8 },
  // PPV approval flow — when true, AI suggests; creator approves via UI or Telegram;
  // auto-sends after aiApprovalTimeoutSec if no decision.
  aiApprovalRequired: { type: DataTypes.BOOLEAN, defaultValue: true },
  aiApprovalTimeoutSec: { type: DataTypes.INTEGER, defaultValue: 600 },

  // Telegram bot integration (mobile notifications + remote approval)
  telegramBotToken: { type: DataTypes.STRING, allowNull: true },
  telegramChatId: { type: DataTypes.STRING, allowNull: true },

  // Dedicated chat avatar — separate from logoUrl (brand) and profileImage (hero).
  // Used in chat header, message bubbles, typing indicator, dashboard "Latest Message" card.
  chatAvatarUrl: { type: DataTypes.STRING, allowNull: true },

  // Visibility toggles — creator can hide certain compliance UI until needed.
  // Age gate: required for adult content in many jurisdictions, OFF only when card
  //   processor not in use. Default ON.
  // Content Disclosure: legal/compliance page at /2257. Toggle hides it from nav
  //   and serves 404 at the URL. Default ON.
  ageGateEnabled: { type: DataTypes.BOOLEAN, defaultValue: true },
  disclosureVisible: { type: DataTypes.BOOLEAN, defaultValue: true },

  // Search engine indexing — if false, robots.txt serves Disallow: * and pages
  //   include <meta robots="noindex,nofollow">. Default false (private launch).
  searchIndexable: { type: DataTypes.BOOLEAN, defaultValue: false },
});

module.exports = Creator;
