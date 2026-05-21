export const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const CREATOR_SLUG = import.meta.env.VITE_CREATOR_SLUG || 'cristina';
const API_URL = `${SERVER_URL}/api`;

const getToken = () => localStorage.getItem('adminToken') || '';
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`,
});

// ─── Shape adapters ────────────────────────────────────────────────────────────
// Keeps all existing page components working without any changes.

const normalize = (creator: any) => ({
  // V1-compatible fields
  siteTitle: creator.displayName,
  heroTitle: creator.displayName,
  heroSubtitle: creator.shortBio,
  homeBio: creator.shortBio,
  bio: creator.bio,
  images: {
    hero: creator.profileImage || '',
    heroSlider: creator.heroImages || [],
    gallery: creator.galleryImages || [],
  },
  links: creator.links || {},
  cta: { primary: 'Unlock Exclusive Content 🔒', secondary: 'View Gallery' },
  theme: creator.theme || {},
  seo: creator.seo || {},
  settings: {
    maintenanceMode: creator.maintenanceMode || false,
    showFaq: true,
    showMustHaves: true,
  },
  blog: creator.blog || [],
  faq: creator.faq || [],
  mustHaves: creator.mustHaves || [],
  analytics: creator.analytics || {},
  // V2 passthrough
  id: creator.id,
  slug: creator.slug,
  subscriptionPrice: creator.subscriptionPrice,
  subscriptionPricePremium: creator.subscriptionPricePremium,
  welcomeMessage: creator.welcomeMessage,
  fanvueUrl: creator.fanvueUrl || '',
  billingDescriptor: creator.billingDescriptor || '',
  logoUrl: creator.logoUrl || '',
  chatAvatarUrl: creator.chatAvatarUrl || '',
  featuredLinks: creator.featuredLinks || [],
  instagramPosts: creator.instagramPosts || [],
  // Visibility toggles
  ageGateEnabled: creator.ageGateEnabled !== false,
  disclosureVisible: creator.disclosureVisible !== false,
  searchIndexable: creator.searchIndexable === true,
});

const denormalize = (config: any) => {
  const data: any = {
    displayName: config.siteTitle || config.heroTitle,
    shortBio: config.homeBio || config.heroSubtitle,
    bio: config.bio,
    profileImage: config.images?.hero || '',
    heroImages: config.images?.heroSlider || [],
    galleryImages: config.images?.gallery || [],
    links: config.links || {},
    theme: config.theme || {},
    seo: config.seo || {},
    maintenanceMode: config.settings?.maintenanceMode || false,
    blog: config.blog || [],
    faq: config.faq || [],
    mustHaves: config.mustHaves || [],
    fanvueUrl: config.fanvueUrl || null,
    billingDescriptor: config.billingDescriptor || null,
    logoUrl: config.logoUrl || null,
    chatAvatarUrl: config.chatAvatarUrl || null,
    featuredLinks: config.featuredLinks || [],
    instagramPosts: config.instagramPosts || [],
    ageGateEnabled: config.ageGateEnabled !== false,
    disclosureVisible: config.disclosureVisible !== false,
    searchIndexable: config.searchIndexable === true,
  };
  if (config.newPassword) data.newPassword = config.newPassword;
  return data;
};

// ─── Creator (V2) ──────────────────────────────────────────────────────────────

export const getCreator = async () => {
  const res = await fetch(`${API_URL}/creator/${CREATOR_SLUG}`);
  const creator = await res.json();
  return normalize(creator);
};

export const updateCreator = async (config: any) => {
  const res = await fetch(`${API_URL}/creator/${CREATOR_SLUG}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(denormalize(config)),
  });
  return res.json();
};

export const getCreatorAnalytics = async () => {
  const res = await fetch(`${API_URL}/creator/${CREATOR_SLUG}/analytics`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

/** Funnel report — distinct-user counts per event over the past N days. */
export const getCreatorFunnel = async (days = 30) => {
  const res = await fetch(`${API_URL}/creator/${CREATOR_SLUG}/funnel?days=${days}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

// Creator — list of fans with per-fan spend + activity (used in Audience tab)
export const getFans = async () => {
  const res = await fetch(`${API_URL}/creator/${CREATOR_SLUG}/subscribers`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

// Creator — full transaction history (optionally filtered by type or userId)
export const getCreatorTransactions = async (opts: { type?: string; userId?: number; limit?: number } = {}) => {
  const params = new URLSearchParams();
  if (opts.type) params.set('type', opts.type);
  if (opts.userId) params.set('userId', String(opts.userId));
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  const res = await fetch(`${API_URL}/creator/${CREATOR_SLUG}/transactions${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

// V1 compat aliases — used by existing components
export const getConfig = getCreator;
export const updateConfig = updateCreator;

// ─── Auth ──────────────────────────────────────────────────────────────────────

export const creatorLogin = async (email: string, password: string) => {
  const res = await fetch(`${API_URL}/auth/creator/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
};

export const fanLogin = async (email: string, password: string) => {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  return res.json();
};

export const fanRegister = async (email: string, username: string, password: string) => {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username, password }),
  });
  return res.json();
};

export const updateMyProfile = async (patch: { username?: string; email?: string }) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/auth/me`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${fanToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (data?.token) localStorage.setItem('fanToken', data.token);
  return data;
};

export const changeMyPassword = async (payload: { currentPassword: string; newPassword: string }) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/auth/me/password`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${fanToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
};

export const requestPasswordReset = async (email: string) => {
  const res = await fetch(`${API_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  return res.json();
};

export const checkResetToken = async (token: string) => {
  const res = await fetch(`${API_URL}/auth/reset-password/check?token=${encodeURIComponent(token)}`);
  return res.json();
};

export const submitPasswordReset = async (token: string, newPassword: string) => {
  const res = await fetch(`${API_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  });
  return res.json();
};

// ─── Email verification (soft-verify model) ────────────────────────────────
// Fan can sign up + log in immediately, but money-moving actions (deposit,
// unlocks) return 402 { requiresEmailVerification: true } until verified.

export const verifyEmailToken = async (token: string) => {
  const res = await fetch(`${API_URL}/auth/verify-email?token=${encodeURIComponent(token)}`);
  return res.json();
};

export const resendVerificationEmail = async () => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/auth/resend-verification`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  return res.json();
};

/** Fetch the current fan's profile incl. emailVerified flag (for the banner). */
export const getMe = async () => {
  const fanToken = localStorage.getItem('fanToken');
  if (!fanToken) return null;
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  if (!res.ok) return null;
  return res.json();
};

export const deleteMyAccount = async (currentPassword: string) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/auth/me`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${fanToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword }),
  });
  return res.json();
};

// ─── Media ─────────────────────────────────────────────────────────────────────

export const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('image', file);
  // Don't set Content-Type — the browser sets multipart boundary automatically.
  // But the auth header is required: /api/upload is gated by requireAuth+requireCreator.
  const res = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  return res.json();
};

// ─── Subscriptions ────────────────────────────────────────────────────────────

export const getSubscriptionStatus = async (slug: string) => {
  const fanToken = localStorage.getItem('fanToken');
  if (!fanToken) return { isSubscribed: false };
  const res = await fetch(`${API_URL}/subscriptions/status/${slug}`, {
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  return res.json();
};

export const subscribe = async (creatorSlug: string, tier: 'basic' | 'premium' = 'basic') => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/subscriptions/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fanToken}` },
    body: JSON.stringify({ creatorSlug, tier }),
  });
  return res.json();
};

export const unsubscribe = async (creatorSlug: string) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/subscriptions/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fanToken}` },
    body: JSON.stringify({ creatorSlug }),
  });
  return res.json();
};

export const getMySubscriptions = async () => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/subscriptions/my`, {
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  return res.json();
};

export const getMyTransactions = async () => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/subscriptions/transactions`, {
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  return res.json();
};

// ─── Posts / Vault ────────────────────────────────────────────────────────────

export const getPosts = async (slug: string) => {
  const fanToken = localStorage.getItem('fanToken');
  const headers: Record<string, string> = {};
  if (fanToken) headers['Authorization'] = `Bearer ${fanToken}`;
  const res = await fetch(`${API_URL}/posts/${slug}`, { headers });
  return res.json();
};

export const createPost = async (formData: FormData) => {
  const res = await fetch(`${API_URL}/posts`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  return res.json();
};

export const updatePost = async (id: number, data: any) => {
  const res = await fetch(`${API_URL}/posts/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
};

export const reorderPosts = async (items: { id: number; sortOrder: number }[]) => {
  const res = await fetch(`${API_URL}/posts/reorder`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  });
  return res.json();
};

export const deletePost = async (id: number) => {
  const res = await fetch(`${API_URL}/posts/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

export const getInstagramFeed = async (slug: string) => {
  const res = await fetch(`${API_URL}/instagram/${slug}`);
  return res.json();
};

export const unlockPost = async (id: number, provider: string = 'mock') => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/posts/${id}/unlock`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fanToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  return res.json();
};

export const likePost = async (id: number) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/posts/${id}/like`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fanToken || getToken()}` },
  });
  return res.json();
};

// ─── Collections / Bundles ───────────────────────────────────────────────────

export const getCollections = async (creatorSlug: string) => {
  const res = await fetch(`${API_URL}/collections/${creatorSlug}/all`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

// Public — fan-facing bundle list. Includes isUnlocked when fan token present.
export const getPublicCollections = async (creatorSlug: string) => {
  const fanToken = localStorage.getItem('fanToken');
  const headers: Record<string, string> = {};
  if (fanToken) headers['Authorization'] = `Bearer ${fanToken}`;
  const res = await fetch(`${API_URL}/collections/${creatorSlug}`, { headers });
  return res.json();
};

export const createCollection = async (data: { creatorSlug: string; title: string; description: string; price: number; discountPercent?: number }) => {
  const res = await fetch(`${API_URL}/collections`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
};

export const updateCollection = async (id: number, data: any) => {
  const res = await fetch(`${API_URL}/collections/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(data),
  });
  return res.json();
};

export const reorderCollections = async (items: { id: number; sortOrder: number }[]) => {
  const res = await fetch(`${API_URL}/collections/reorder`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  });
  return res.json();
};

export const deleteCollection = async (id: number) => {
  const res = await fetch(`${API_URL}/collections/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

export const assignPostToCollection = async (collectionId: number, postId: number) => {
  const res = await fetch(`${API_URL}/collections/${collectionId}/assign`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ postId }),
  });
  return res.json();
};

export const removePostFromCollection = async (postId: number) => {
  const res = await fetch(`${API_URL}/collections/remove-post/${postId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

export const unlockCollection = async (collectionId: number, provider: string = 'mock') => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/collections/${collectionId}/unlock`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fanToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  return res.json();
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const getChatHistory = async (creatorSlug: string) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/chat/${creatorSlug}`, {
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  return res.json();
};

export const unlockMessage = async (messageId: number, provider: string = 'mock') => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/chat/${messageId}/unlock`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fanToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider }),
  });
  return res.json();
};

// ─── Payments ────────────────────────────────────────────────────────────────

export const getActivePaymentProviders = async (): Promise<{ providers: string[] }> => {
  const fanToken = localStorage.getItem('fanToken') || getToken();
  const res = await fetch(`${API_URL}/payments/providers`, {
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  return res.json();
};

export const getTransactionStatus = async (transactionId: number) => {
  const fanToken = localStorage.getItem('fanToken') || getToken();
  const res = await fetch(`${API_URL}/payments/status/${transactionId}`, {
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  return res.json();
};

export interface SavedCard {
  id: number;
  provider: string;
  last4: string;
  brand: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export const getPaymentMethods = async (): Promise<{ methods: SavedCard[] }> => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/payments/methods`, {
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  return res.json();
};

export const addPaymentMethod = async (cardData: { number: string; brand?: string; expMonth: number; expYear: number; cvc?: string }, setDefault = true) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/payments/methods`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fanToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardData, setDefault }),
  });
  return res.json();
};

export const removePaymentMethod = async (id: number) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/payments/methods/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  return res.json();
};

export const setDefaultPaymentMethod = async (id: number) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/payments/methods/${id}/default`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  return res.json();
};

export const chargeSavedMethod = async (
  paymentMethodId: number,
  productType: 'post_unlock' | 'collection_unlock' | 'ppv_message',
  productId: number,
) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/payments/charge`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fanToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentMethodId, productType, productId }),
  });
  return res.json();
};

// ─── Wallet (fan pre-funded balance) ─────────────────────────────────────────

export interface WalletState {
  balance: number;
  recentDeposits: Array<{
    id: number;
    amount: number;
    status: string;
    provider: string;
    date: string;
  }>;
}

export const getWallet = async (): Promise<WalletState> => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/wallet/me`, {
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  return res.json();
};

export const depositToWallet = async (amount: number, provider: string = 'nowpayments', payCurrency?: string | null) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/wallet/deposit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fanToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, provider, payCurrency: payCurrency || undefined }),
  });
  return res.json();
};

export type WalletCoin = {
  code: string;       // NOWPayments pay_currency (e.g. 'btc', 'usdttrc20')
  label: string;
  icon: string;
  min: number;        // USD-equivalent minimum
  hint: string;
};

export const getWalletCoins = async (): Promise<{ coins: WalletCoin[] }> => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/wallet/coins`, {
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  return res.json();
};

export const resumeWalletDeposit = async (transactionId: number) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/wallet/deposit/${transactionId}/resume`, {
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  return res.json();
};

export const cancelWalletDeposit = async (transactionId: number) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/wallet/deposit/${transactionId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fanToken}` },
  });
  return res.json();
};

export const spendFromWallet = async (
  productType: 'post_unlock' | 'collection_unlock' | 'ppv_message',
  productId: number,
) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/wallet/spend`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fanToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ productType, productId }),
  });
  return res.json();
};

export const sendTip = async (creatorId: number, amount: number, opts: { message?: string; paymentMethodId?: number; provider?: string } = {}) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/payments/tip`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fanToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ creatorId, amount, ...opts }),
  });
  return res.json();
};

export const getCreatorInbox = async (creatorSlug: string) => {
  const res = await fetch(`${API_URL}/chat/${creatorSlug}/inbox`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

export const getThreadWithFan = async (creatorSlug: string, fanId: number) => {
  const res = await fetch(`${API_URL}/chat/${creatorSlug}/thread/${fanId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

export const sendBlast = async (
  creatorSlug: string,
  content: string,
  isPPV: boolean,
  ppvPrice: number,
  mediaUrl?: string | null,
) => {
  const res = await fetch(`${API_URL}/chat/${creatorSlug}/blast`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ content, isPPV, ppvPrice, mediaUrl: mediaUrl || null }),
  });
  return res.json();
};

// ─── AI Chatbot ───────────────────────────────────────────────────────────────

export interface AiSettings {
  aiPersonaPrompt: string | null;
  aiModel: string;
  aiNsfwLevel: 'off' | 'flirty' | 'explicit';
  aiPpvEnabled: boolean;
  aiPpvCadence: number;
  aiApprovalRequired: boolean;
  aiApprovalTimeoutSec: number;
  telegramBotTokenSet: boolean;
  telegramChatId: string | null;
}

export interface PendingPpvRow {
  id: number;
  fanId: number;
  aiReplyText: string;
  suggestedCollectionId: number;
  autoSendAt: string;
  status: string;
}

export const getAiSettings = async (): Promise<AiSettings> => {
  const res = await fetch(`${API_URL}/ai/settings`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

export const updateAiSettings = async (patch: Partial<AiSettings>) => {
  const res = await fetch(`${API_URL}/ai/settings`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  return res.json();
};

export const getAiStarterTemplate = async (): Promise<{ template: string }> => {
  const res = await fetch(`${API_URL}/ai/starter-template`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

export const setThreadAiEnabled = async (fanId: number, enabled: boolean) => {
  const res = await fetch(`${API_URL}/ai/thread/${fanId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  });
  return res.json();
};

export const testAiReply = async (history: { role: 'user' | 'assistant'; content: string }[]) => {
  const res = await fetch(`${API_URL}/ai/test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ history }),
  });
  return res.json();
};

// ── Telegram + PPV approval ──────────────────────────────────────
export const verifyTelegramBot = async (token: string) => {
  const res = await fetch(`${API_URL}/ai/telegram/verify`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  return res.json();
};

export const sendTelegramTest = async () => {
  const res = await fetch(`${API_URL}/ai/telegram/test`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

export const getPendingPpvForFan = async (fanId: number): Promise<PendingPpvRow | null> => {
  const res = await fetch(`${API_URL}/ai/ppv/pending/${fanId}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return null;
  const j = await res.json();
  return j && j.id ? j : null;
};

export const approvePpv = async (id: number) => {
  const res = await fetch(`${API_URL}/ai/ppv/${id}/approve`, {
    method: 'POST', headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

export const changePpvBundle = async (id: number, collectionId: number) => {
  const res = await fetch(`${API_URL}/ai/ppv/${id}/change`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ collectionId }),
  });
  return res.json();
};

export const ppvTextOnly = async (id: number) => {
  const res = await fetch(`${API_URL}/ai/ppv/${id}/text-only`, {
    method: 'POST', headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

export const rejectPpv = async (id: number) => {
  const res = await fetch(`${API_URL}/ai/ppv/${id}/reject`, {
    method: 'POST', headers: { Authorization: `Bearer ${getToken()}` },
  });
  return res.json();
};

// Legacy password-only login kept for reference during migration
export const login = async (password: string) => {
  const res = await fetch(`${API_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  return res.json();
};
