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

// ─── Media ─────────────────────────────────────────────────────────────────────

export const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append('image', file);
  const res = await fetch(`${API_URL}/upload`, { method: 'POST', body: formData });
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

export const deletePost = async (id: number) => {
  const res = await fetch(`${API_URL}/posts/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${getToken()}` },
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

export const createCollection = async (data: { creatorSlug: string; title: string; description: string; price: number }) => {
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

export const unlockCollection = async (collectionId: number) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/collections/${collectionId}/unlock`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fanToken}` },
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

export const unlockMessage = async (messageId: number) => {
  const fanToken = localStorage.getItem('fanToken');
  const res = await fetch(`${API_URL}/chat/${messageId}/unlock`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${fanToken}` },
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

export const sendBlast = async (creatorSlug: string, content: string, isPPV: boolean, ppvPrice: number) => {
  const res = await fetch(`${API_URL}/chat/${creatorSlug}/blast`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ content, isPPV, ppvPrice }),
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
