# Software Requirements Specification (SRS) & Functional Requirements Specification (FRS)

## Project Overview
This project transforms a simple bridge page (redirecting Instagram traffic) into a fully-fledged, multi-tenant subscription platform (similar to OnlyFans or Fanvue). The architecture was migrated from a flat-file JSON structure to a structured database using SQLite, Sequelize, and Express for the backend, alongside React for the frontend.

## 1. What Has Been Implemented (Completed)

### 1.1 Backend Architecture (Multi-Tenancy)
- Replaced `config.json` with a structured SQLite database.
- Created Sequelize ORM models:
  - **Creator:** Represents the models/influencers (has bio, subscription price, profile images).
  - **User:** Represents the fans/subscribers.
  - **Post:** Represents the media content (images/videos) uploaded to the Vault.
  - **Subscription:** Links Users to Creators.
  - **Message:** Handles direct messaging between users and creators.

### 1.2 Authentication & Authorization
- Built `authRoutes.ts` with `/register` and `/login` endpoints.
- Implemented `bcryptjs` for password hashing.
- Implemented `jsonwebtoken` (JWT) for secure, stateless sessions.
- Created `authMiddleware.ts` to protect private routes.

### 1.3 The Vault & Secure Content Management
- Built `postRoutes.ts` for handling media uploads via `multer`.
- Implemented logic where `isPremium` content is hidden from non-subscribed users.

### 1.4 Mock Subscriptions & Payments
- Built `paymentRoutes.ts` with mock endpoints for `/subscribe/:creatorId` and `/unlock/:postId`.
- Currently bypasses actual payment gateway integration but updates database tables accordingly.

### 1.5 Real-time Live Chat
- Integrated `socket.io` on the Node.js backend.
- Created a real-time messaging gateway handling token verification via websockets.
- Added a `Chat.tsx` UI component in the React frontend.
- Added PPV messaging fields (`isPPV`, `ppvPrice`) to the Message model.

### 1.6 Dynamic Multi-Tenant Frontend
- Refactored `App.tsx` to pull `username` dynamically from the route (e.g., `/:username`) rather than from a static file.
- Fetches the specific creator's profile (`bio`, `subscriptionPrice`) from the API.

---

## 2. What Is Left (Pending / Next Steps for Agent)

### 2.1 Complete the Frontend UI Integration
- The Admin Dashboard (`Admin.tsx`) needs to be fully refactored to use the new REST API instead of modifying the old `config.json`.
- The Vault UI: Needs a dedicated page in the admin panel to manage, upload, and set prices for `Posts`.
- Ensure the Chat UI properly handles PPV un-locking.

### 2.2 Payment Gateway Integration
- Replace the mock endpoints in `paymentRoutes.ts` with actual Stripe (Stripe Connect for payouts) or CCBill API integration.
- Implement webhooks to handle subscription renewals, failures, and cancellations.

### 2.3 Cloud Media Storage
- Currently, `multer` saves files locally to `/uploads/`.
- **Action:** Integrate AWS S3 (or similar) to upload media securely. Generate signed URLs for premium content so that direct file paths cannot be shared or scraped.

### 2.4 Creator Verification (KYC)
- Implement a flow for creators to submit ID verification before their profile is live or payouts are enabled.

### 2.5 Security & Production Readiness
- Move secrets (like `JWT_SECRET`) to a `.env` file.
- Migrate from SQLite to PostgreSQL for production scalability.
