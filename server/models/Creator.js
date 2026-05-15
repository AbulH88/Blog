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
});

module.exports = Creator;
