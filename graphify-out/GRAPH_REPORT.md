# Graph Report - .  (2026-05-22)

## Corpus Check
- 125 files · ~98,186 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 900 nodes · 1310 edges · 65 communities (57 shown, 8 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Frontend UI Components|Frontend UI Components]]
- [[_COMMUNITY_Server API + Middleware|Server API + Middleware]]
- [[_COMMUNITY_Database Models (ORM)|Database Models (ORM)]]
- [[_COMMUNITY_Route Handlers + Helpers|Route Handlers + Helpers]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_Ops Docs + Platform Strategy|Ops Docs + Platform Strategy]]
- [[_COMMUNITY_Auth + Email Tokens|Auth + Email Tokens]]
- [[_COMMUNITY_Frontend Dependencies|Frontend Dependencies]]
- [[_COMMUNITY_PPV + Telegram Approval|PPV + Telegram Approval]]
- [[_COMMUNITY_Fan Payments + Wallet UI|Fan Payments + Wallet UI]]
- [[_COMMUNITY_Fan Feed + Follow Routes|Fan Feed + Follow Routes]]
- [[_COMMUNITY_Admin Upload + Dashboard|Admin Upload + Dashboard]]
- [[_COMMUNITY_Auth Middleware Guards|Auth Middleware Guards]]
- [[_COMMUNITY_Database Migrations|Database Migrations]]
- [[_COMMUNITY_Payment Provider Resolution|Payment Provider Resolution]]
- [[_COMMUNITY_Client TypeScript Config|Client TypeScript Config]]
- [[_COMMUNITY_Admin Messaging UI|Admin Messaging UI]]
- [[_COMMUNITY_Server TypeScript Config|Server TypeScript Config]]
- [[_COMMUNITY_Fan Settings UI|Fan Settings UI]]
- [[_COMMUNITY_Payment Method Picker UI|Payment Method Picker UI]]
- [[_COMMUNITY_AI Chat + Intent Routing|AI Chat + Intent Routing]]
- [[_COMMUNITY_Coin Unlock + Pricing|Coin Unlock + Pricing]]
- [[_COMMUNITY_Audience Segmentation|Audience Segmentation]]
- [[_COMMUNITY_Admin AI Chatbot UI|Admin AI Chatbot UI]]
- [[_COMMUNITY_Homepage + Social Feed|Homepage + Social Feed]]
- [[_COMMUNITY_Fanvue Integration UI|Fanvue Integration UI]]
- [[_COMMUNITY_App Context + Toast UI|App Context + Toast UI]]
- [[_COMMUNITY_Coin Catalog + Balance|Coin Catalog + Balance]]
- [[_COMMUNITY_Payment Provider Base Class|Payment Provider Base Class]]
- [[_COMMUNITY_Creator Cache Layer|Creator Cache Layer]]
- [[_COMMUNITY_Fan AI + PPV Routes|Fan AI + PPV Routes]]
- [[_COMMUNITY_Payment Provider Registry|Payment Provider Registry]]
- [[_COMMUNITY_Admin Broadcast + Hero Slide|Admin Broadcast + Hero Slide]]
- [[_COMMUNITY_Add Card Modal|Add Card Modal]]
- [[_COMMUNITY_Card Payment Provider|Card Payment Provider]]
- [[_COMMUNITY_NowPayments Crypto Provider|NowPayments Crypto Provider]]
- [[_COMMUNITY_User Transaction Routes|User Transaction Routes]]
- [[_COMMUNITY_Cache Utilities|Cache Utilities]]
- [[_COMMUNITY_Redis Client|Redis Client]]
- [[_COMMUNITY_Mobile Nav + Vault|Mobile Nav + Vault]]
- [[_COMMUNITY_Tip Modal UI|Tip Modal UI]]
- [[_COMMUNITY_Image Upload Processing|Image Upload Processing]]
- [[_COMMUNITY_NowPayments Webhook|NowPayments Webhook]]
- [[_COMMUNITY_Mock Payment Provider|Mock Payment Provider]]
- [[_COMMUNITY_Vault Tile UI|Vault Tile UI]]
- [[_COMMUNITY_DMCA Page|DMCA Page]]
- [[_COMMUNITY_Fan Sidebar Nav|Fan Sidebar Nav]]
- [[_COMMUNITY_Fan Chat UI|Fan Chat UI]]
- [[_COMMUNITY_Blog UI|Blog UI]]
- [[_COMMUNITY_Mock Card Provider|Mock Card Provider]]
- [[_COMMUNITY_Funnel Analytics Card|Funnel Analytics Card]]
- [[_COMMUNITY_About Page|About Page]]
- [[_COMMUNITY_Gallery UI|Gallery UI]]
- [[_COMMUNITY_TypeScript Project References|TypeScript Project References]]
- [[_COMMUNITY_Wallet Card UI|Wallet Card UI]]
- [[_COMMUNITY_Instagram PDF Generator|Instagram PDF Generator]]

## God Nodes (most connected - your core abstractions)
1. `getToken()` - 29 edges
2. `compilerOptions` - 17 edges
3. `compilerOptions` - 16 edges
4. `Creator` - 14 edges
5. `SRS & FRS — Cristina Platform` - 13 edges
6. `requireAuth()` - 11 edges
7. `authHeaders()` - 10 edges
8. `PaymentProvider` - 10 edges
9. `User` - 9 edges
10. `Collection` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Icon Sprite SVG (Bluesky, Discord, GitHub, X, social, docs)` --conceptually_related_to--> `Homepage Feature Polish Plan`  [INFERRED]
  client/public/icons.svg → docs/superpowers/plans/2026-05-14-homepage-feature-polish.md
- `Cristina Platform README` --references--> `Instagram Option A Setup (PDF guide)`  [EXTRACTED]
  README.md → docs/instagram-option-a-setup.pdf
- `SRS & FRS — Cristina Platform` --references--> `Instagram Option A Setup (PDF guide)`  [EXTRACTED]
  SRS_FRS_DOCUMENT.md → docs/instagram-option-a-setup.pdf
- `Creator Blog Funnel Requirements V1` --semantically_similar_to--> `Funnel Marketing Plan: Instagram to Fanvue`  [INFERRED] [semantically similar]
  creator_blog_funnel_requirements.md → FUNNEL_MARKETING_PLAN.md
- `Hero Asset PNG (isometric 3D cube/layer graphic, purple tones — likely branding or placeholder)` --conceptually_related_to--> `V3 Design System (terracotta/navy/cream palette)`  [INFERRED]
  client/src/assets/hero.png → SRS_FRS_DOCUMENT.md

## Hyperedges (group relationships)
- **Creator Funnel Conversion Pipeline: Instagram → Blog → Fanvue** — funnel_marketing_plan, funnel_requirements_v1, instagram_bridge_strategy, instagram_funnel_flow, safe_word_replacement [EXTRACTED 0.95]
- **V3 Design System Implementation** — v3_design_system, plan_admin_design_consistency, plan_homepage_feature_polish, srs_frs_cristina_platform [EXTRACTED 0.95]
- **Production Infrastructure Stack** — deploy_md, cloudflare_md, backups_md, postgres_md, uptime_md, aapanel_pm2_nginx, cloudflare_cdn_waf [EXTRACTED 0.95]
- **Platform Technology Stack** — react_vite_ts_stack, sequelize_sqlite_postgres, socketio_realtime, client_readme, client_index_html [EXTRACTED 0.95]

## Communities (65 total, 8 thin omitted)

### Community 0 - "Frontend UI Components"
Cohesion: 0.04
Nodes (25): fullUrl(), JoinPremiumModal(), Props, PasswordStrength(), Props, scorePassword(), Mode, creatorLogin() (+17 more)

### Community 1 - "Server API + Middleware"
Cohesion: 0.04
Nodes (42): [action, idStr], aiLimiter, allowedOrigins, app, authLimiter, authRoutes, bodyParser, chatRoutes (+34 more)

### Community 2 - "Database Models (ORM)"
Cohesion: 0.04
Nodes (34): Collection, { DataTypes }, sequelize, Creator, { DataTypes }, sequelize, { DataTypes }, Event (+26 more)

### Community 3 - "Route Handlers + Helpers"
Cohesion: 0.05
Nodes (35): allowed, ALLOWED_FIELDS, bcrypt, cache, countByUser, { Creator, Subscription, Transaction, Post, sequelize }, d, dayIndex (+27 more)

### Community 4 - "Package Dependencies"
Cohesion: 0.06
Nodes (35): author, dependencies, bcryptjs, body-parser, compression, cors, dotenv, express (+27 more)

### Community 5 - "Ops Docs + Platform Strategy"
Cohesion: 0.09
Nodes (33): aaPanel + PM2 Cluster + nginx Deployment Stack, Backups & Restore Guide, Client Entry HTML (index.html), Client Vite+React README, Cloudflare CDN + WAF Strategy, Cloudflare CDN/WAF Setup Guide, Deploy Guide (aaPanel + nginx + PM2), Favicon SVG (Claude Code lightning bolt, purple gradient) (+25 more)

### Community 6 - "Auth + Email Tokens"
Cohesion: 0.09
Nodes (26): bcrypt, crypto, email, events, expires, express, jwt, { Op } (+18 more)

### Community 7 - "Frontend Dependencies"
Cohesion: 0.07
Nodes (28): dependencies, react, react-dom, react-router-dom, socket.io-client, @types/react-router-dom, devDependencies, eslint (+20 more)

### Community 8 - "PPV + Telegram Approval"
Cohesion: 0.11
Nodes (23): sendCreatorMessage(), approve(), approveWithBundle(), autoSend(), cancelTimer(), finalizeUi(), { PendingPpv, Creator, Collection, User }, rehydrate() (+15 more)

### Community 9 - "Fan Payments + Wallet UI"
Cohesion: 0.10
Nodes (17): FALLBACK_COINS, Props, sectionLabel, fieldLabel, checkResetToken(), denormalize(), depositToWallet(), deriveActiveGallery() (+9 more)

### Community 10 - "Fan Feed + Follow Routes"
Cohesion: 0.10
Nodes (22): decodeFan(), express, feed, getFollowStatus(), { getProvider, hasProvider }, getUnlockedCollections(), getUnlockedPosts(), jwt (+14 more)

### Community 11 - "Admin Upload + Dashboard"
Cohesion: 0.12
Nodes (19): Props, Admin(), mkColors(), Tab, TABS, assignPostToCollection(), authHeaders(), createCollection() (+11 more)

### Community 12 - "Auth Middleware Guards"
Cohesion: 0.10
Nodes (19): jwt, requireAuth(), requireCreator(), requireVerifiedEmail(), express, fanIds, fanMap, { getProvider, hasProvider } (+11 more)

### Community 13 - "Database Migrations"
Cohesion: 0.12
Nodes (17): applyMigrations(), Collection, Creator, Event, Message, PaymentMethod, Post, sequelize (+9 more)

### Community 14 - "Payment Provider Resolution"
Cohesion: 0.10
Nodes (19): hasProvider(), resolveProvider(), basePrice, { Collection, Post, Creator, Transaction }, disc, effectivePrice, express, fan (+11 more)

### Community 15 - "Client TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 16 - "Admin Messaging UI"
Cohesion: 0.13
Nodes (15): AdminMessages(), ChatMessage, InboxRow, initials(), mediaUrlAbs(), PendingPpvCard(), approvePpv(), changePpvBundle() (+7 more)

### Community 17 - "Server TypeScript Config"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 18 - "Fan Settings UI"
Cohesion: 0.11
Nodes (14): cardHeadStyle, inputStyle, linkStyle, panelHeadStyle, PaymentsTab, secondaryBtn, Section, sections (+6 more)

### Community 19 - "Payment Method Picker UI"
Cohesion: 0.12
Nodes (16): arrow, badge, methodIcon(), methodRow, methodTitle, PayMethodPicker(), ProductType, Props (+8 more)

### Community 20 - "AI Chat + Intent Routing"
Cohesion: 0.21
Nodes (15): buildMessageHistory(), buildSystemPrompt(), callOpenRouter(), { classifyIntent }, countMessagesSincePpv(), defaultPersona(), generateReply(), generateTestReply() (+7 more)

### Community 21 - "Coin Unlock + Pricing"
Cohesion: 0.12
Nodes (14): amt, base, bodyParser, disc, express, { getProvider, hasProvider }, io, { listProviders } (+6 more)

### Community 22 - "Audience Segmentation"
Cohesion: 0.18
Nodes (13): activeRows(), daysSince(), getLastActivity(), normalizeSegmentId(), SEGMENT_DEFINITIONS, SEGMENT_IDS, selectFanIdsForSegment(), toTime() (+5 more)

### Community 23 - "Admin AI Chatbot UI"
Cohesion: 0.18
Nodes (12): ChatTurn, MODEL_OPTIONS, AiSettings, getActivePaymentProviders(), getAiSettings(), getAiStarterTemplate(), getToken(), likePost() (+4 more)

### Community 24 - "Homepage + Social Feed"
Cohesion: 0.14
Nodes (4): Props, IconName, Props, Tile

### Community 25 - "Fanvue Integration UI"
Cohesion: 0.16
Nodes (9): Props, Props, FanDashboard(), fmtTime(), fullUrl(), cancelWalletDeposit(), getMyTransactions(), getWallet() (+1 more)

### Community 26 - "App Context + Toast UI"
Cohesion: 0.18
Nodes (9): Ctx, Kind, ToastApi, ToastItem, ToastProvider(), useToast(), VerifyEmailBanner(), getMe() (+1 more)

### Community 27 - "Coin Catalog + Balance"
Cohesion: 0.14
Nodes (13): amount, balance, base, COIN_CATALOG, disc, express, { getProvider, hasProvider }, { Op } (+5 more)

### Community 28 - "Payment Provider Base Class"
Cohesion: 0.17
Nodes (4): NotSupportedError, PaymentProvider, crypto, { PaymentProvider }

### Community 29 - "Creator Cache Layer"
Cohesion: 0.18
Nodes (11): CACHE_DIR, cached, cacheFile(), cleaned, { Creator }, express, fs, path (+3 more)

### Community 30 - "Fan AI + PPV Routes"
Cohesion: 0.15
Nodes (10): PendingPpv, aiChat, { Creator, Subscription, PendingPpv, Collection }, express, fanId, out, ppvApproval, { requireAuth, requireCreator } (+2 more)

### Community 31 - "Payment Provider Registry"
Cohesion: 0.26
Nodes (9): getActiveProviders(), { getActiveProviders }, initPayments(), MockProvider, { registerProvider, listProviders }, getProvider(), listProviders(), providers (+1 more)

### Community 32 - "Admin Broadcast + Hero Slide"
Cohesion: 0.20
Nodes (7): Kind, Props, AdminBroadcast(), mediaUrlAbs(), getCreatorAnalytics(), sendBlast(), uploadImage()

### Community 33 - "Add Card Modal"
Cohesion: 0.25
Nodes (7): AddCardModal(), BRANDS, detectBrand(), fieldLabel, input, Props, addPaymentMethod()

### Community 34 - "Card Payment Provider"
Cohesion: 0.29
Nodes (6): getCardProviderConfig(), CardProvider, createCardProvider(), crypto, { getCardProviderConfig }, { PaymentProvider }

### Community 36 - "User Transaction Routes"
Cohesion: 0.25
Nodes (7): Subscription, Transaction, User, express, { requireAuth }, router, { Subscription, Creator, Transaction, User }

### Community 37 - "Cache Utilities"
Cohesion: 0.36
Nodes (7): del(), delPattern(), getLocal(), getOrSet(), localStore, redis, setLocal()

### Community 38 - "Redis Client"
Cohesion: 0.32
Nodes (3): buildClient(), buildStub(), ping()

### Community 40 - "Tip Modal UI"
Cohesion: 0.29
Nodes (5): PRESETS, Props, getPaymentMethods(), SavedCard, sendTip()

### Community 41 - "Image Upload Processing"
Cohesion: 0.38
Nodes (6): IMAGE_EXTS, path, processImageUploads(), processOne(), sharp, maybeProcessImage()

### Community 42 - "NowPayments Webhook"
Cohesion: 0.29
Nodes (6): crypto, { getNowPaymentsConfig }, https, NP_STATUS_TO_LOCAL, { PaymentProvider }, { URL }

### Community 44 - "Vault Tile UI"
Cohesion: 0.40
Nodes (5): BundleTileProps, fullUrl(), PostTileProps, Props, VaultTile()

### Community 45 - "DMCA Page"
Cohesion: 0.33
Nodes (4): contactBox, h2, link, list

### Community 46 - "Fan Sidebar Nav"
Cohesion: 0.40
Nodes (5): FanSidebar(), fullUrl(), navItems, Props, unsubscribe()

### Community 48 - "Blog UI"
Cohesion: 0.53
Nodes (5): Blog(), CATEGORIES, formatDate(), fullUrl(), readMinutes()

### Community 50 - "Funnel Analytics Card"
Cohesion: 0.40
Nodes (3): EventCount, STAGES, getCreatorFunnel()

### Community 51 - "About Page"
Cohesion: 0.50
Nodes (4): About(), DEFAULT_FAVORITES, DEFAULT_PRESS, fullUrl()

### Community 52 - "Gallery UI"
Cohesion: 0.50
Nodes (4): CATEGORIES, Category, fullUrl(), Gallery()

## Knowledge Gaps
- **444 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+439 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Creator` connect `Database Migrations` to `Server API + Middleware`, `Route Handlers + Helpers`, `User Transaction Routes`, `Auth + Email Tokens`, `PPV + Telegram Approval`, `Fan Feed + Follow Routes`, `Auth Middleware Guards`, `Payment Provider Resolution`, `Coin Unlock + Pricing`, `Creator Cache Layer`, `Fan AI + PPV Routes`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `initPayments()` connect `Payment Provider Registry` to `Server API + Middleware`, `Card Payment Provider`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `PaymentProvider` connect `Payment Provider Base Class` to `Card Payment Provider`, `NowPayments Webhook`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _447 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.044326241134751775 - nodes in this community are weakly interconnected._
- **Should `Server API + Middleware` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._
- **Should `Database Models (ORM)` be split into smaller, more focused modules?**
  _Cohesion score 0.044444444444444446 - nodes in this community are weakly interconnected._