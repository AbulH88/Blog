import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  updateConfig, uploadImage, SERVER_URL, createPost, updatePost, deletePost,
  CREATOR_SLUG, getCreatorAnalytics,
  getCollections, createCollection, updateCollection, deleteCollection,
  assignPostToCollection, removePostFromCollection,
  reorderPosts, reorderCollections,
  getFans, getCreatorTransactions,
} from '../api';
import AdminMessages from './AdminMessages';
import AdminAiChatbot from './AdminAiChatbot';
import AdminBroadcast from './AdminBroadcast';
import DragDropUpload from '../components/DragDropUpload';
import FunnelCard from '../components/FunnelCard';
import AddHeroSlideModal from '../components/AddHeroSlideModal';
import FanDetailDrawer from '../components/FanDetailDrawer';
import AdminNotificationBell from '../components/AdminNotificationBell';

type Tab =
  | 'overview' | 'biobuilder' | 'analytics' | 'content' | 'gallery'
  | 'messages' | 'broadcast' | 'audience' | 'branding'
  | 'aichatbot' | 'settings' | 'support';

const TABS: { id: Tab; label: string; icon: string; badge?: string }[] = [
  { id: 'overview',   label: 'Dashboard',    icon: '🏠', badge: 'Active' },
  { id: 'biobuilder', label: 'Bio Builder',  icon: '☰' },
  { id: 'analytics',  label: 'Analytics',    icon: '📊' },
  { id: 'content',    label: 'Content',      icon: '◈' },
  { id: 'gallery',    label: 'Gallery',      icon: '🖼' },
  { id: 'messages',   label: 'Messages',     icon: '◎' },
  { id: 'broadcast',  label: 'Broadcast',    icon: '📣' },
  { id: 'audience',   label: 'Audience',     icon: '👥' },
  { id: 'branding',   label: 'Branding',     icon: '🔗' },
  { id: 'aichatbot',  label: 'AI Chatbot',   icon: '🤖' },
  { id: 'settings',   label: 'Settings',     icon: '⚙' },
  { id: 'support',    label: 'Support',      icon: '?' },
];

const mkColors = (dark: boolean) => ({
  text:        dark ? '#fff'    : '#111',
  muted:       dark ? '#666'    : '#888',
  faint:       dark ? '#444'    : '#bbb',
  border:      dark ? '#1a1a1a' : '#e8e8e8',
  borderFaint: dark ? '#141414' : '#f0f0f0',
  bg:          dark ? '#0a0a0a' : '#fafafa',
  inputBg:     dark ? '#0a0a0a' : '#f8f8f8',
  progressBg:  dark ? '#1a1a1a' : '#e5e5e5',
  editBg:      dark ? '#0a0a0a' : '#f8f8f8',
  sidebarText: dark ? '#555'    : '#bbb',
  logoutText:  dark ? '#444'    : '#aaa',
});

const Admin = ({ config, refreshConfig }: { config: any; refreshConfig: () => void }) => {
  const [formData, setFormData]     = useState(config);
  const [activeTab, setActiveTab]   = useState<Tab>('overview');
  const [isDark, setIsDark] = useState(() => localStorage.getItem('adminTheme') !== 'light');
  // Mobile nav drawer — sidebar slides in from left on < 960px screens.
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Toggle for the "Add Hero Slide" modal (lives in renderGallery's section
  // but the state has to be at the component level for hook rules).
  const [addSlideOpen, setAddSlideOpen] = useState(false);
  const C = mkColors(isDark);
  const toggleTheme = () => setIsDark(d => {
    const next = !d;
    localStorage.setItem('adminTheme', next ? 'dark' : 'light');
    return next;
  });
  const [status, setStatus]         = useState('');
  const [analytics, setAnalytics]   = useState<any>(null);
  const [editingPost, setEditingPost] = useState<any>(null);

  // Content (vault) state
  const [vaultPosts, setVaultPosts]   = useState<any[]>([]);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [newPost, setNewPost] = useState({ title: '', caption: '', isPremium: false, price: '0', isPinned: false });
  const [postFile, setPostFile]   = useState<File | null>(null);
  const [postStatus, setPostStatus] = useState('');

  // Bundles state
  const [bundles, setBundles] = useState<any[]>([]);
  const [editingBundle, setEditingBundle] = useState<any>(null); // { id?, title, description, price, isPublished }
  const [bundleStatus, setBundleStatus] = useState('');
  const [assigningPostId, setAssigningPostId] = useState<number | null>(null);

  // Drag-reorder refs
  const postDragIdx = useRef<number | null>(null);
  const bundleDragIdx = useRef<number | null>(null);
  const galleryDragIdx = useRef<number | null>(null);
  const sliderDragIdx = useRef<number | null>(null);

  const reorderArray = <T,>(arr: T[], from: number, to: number): T[] => {
    const next = [...arr];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  };

  // Audience tab state
  const [fans, setFans] = useState<any[]>([]);
  const [creatorTxns, setCreatorTxns] = useState<any[]>([]);
  const [audienceFilter, setAudienceFilter] = useState('');
  const [audienceSort, setAudienceSort] = useState<'spend' | 'recent' | 'joined'>('spend');
  // New filters from manage-users feature (Phase 2)
  const [audienceTier, setAudienceTier] = useState<'all' | 'free' | 'paying' | 'vip'>('all');
  const [audienceStatus, setAudienceStatus] = useState<'all' | 'active' | 'blocked' | 'deleted'>('all');
  // Drawer state — fanId !== null means drawer is open for that fan
  const [drawerFanId, setDrawerFanId] = useState<number | null>(null);

  const navigate = useNavigate();

  // Auth guard + initial analytics load
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { navigate('/login'); return; }
    getCreatorAnalytics().then(setAnalytics).catch(() => {});
  }, [navigate]);

  // Load data when switching to tabs that need it
  useEffect(() => {
    if (activeTab === 'content') {
      fetchVaultPosts();
      fetchBundles();
    } else if (activeTab === 'audience') {
      fetchAudience();
    } else if (activeTab === 'overview') {
      // Top spenders pull from the fans endpoint
      fetchAudience();
    }
  }, [activeTab]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData({ ...formData, [parent]: { ...formData[parent], [child]: val } });
    } else {
      setFormData({ ...formData, [name]: val });
    }
  };

  // Batch upload — used by DragDropUpload (supports multi-file drops)
  const handleFilesUpload = async (files: File[], type: 'gallery' | 'slider' | 'favicon') => {
    if (!files.length) return;
    setStatus(`Uploading ${files.length} file${files.length === 1 ? '' : 's'}…`);
    const urls: string[] = [];
    for (const file of files) {
      const res = await uploadImage(file);
      if (res.url) urls.push(res.url);
    }
    if (!urls.length) { setStatus('Upload failed'); return; }
    if (type === 'favicon') {
      setFormData((prev: any) => ({ ...prev, seo: { ...prev.seo, favicon: urls[0] } }));
    } else if (type === 'gallery') {
      setFormData((prev: any) => ({
        ...prev,
        images: { ...prev.images, gallery: [...(prev.images?.gallery || []), ...urls] },
      }));
    } else if (type === 'slider') {
      setFormData((prev: any) => ({
        ...prev,
        images: { ...prev.images, heroSlider: [...(prev.images?.heroSlider || []), ...urls] },
      }));
    }
    setStatus(`${urls.length} uploaded — remember to Save Changes`);
    setTimeout(() => setStatus(''), 4000);
  };

  const removeImage = (type: 'slider' | 'gallery', index: number) => {
    const key = type === 'slider' ? 'heroSlider' : 'gallery';
    const list = [...formData.images[key]];
    list.splice(index, 1);
    setFormData({ ...formData, images: { ...formData.images, [key]: list } });
  };

  const handleSave = async () => {
    setStatus('Saving…');
    const res = await updateConfig(formData);
    if (res.success) {
      setStatus('Saved!');
      refreshConfig();
      setTimeout(() => setStatus(''), 3000);
    } else {
      setStatus('Error saving');
    }
  };

  // Blog
  const saveBlogPost = () => {
    let updated = [...formData.blog];
    if (editingPost.id) {
      updated = updated.map((p: any) => p.id === editingPost.id ? editingPost : p);
    } else {
      const newId = Math.max(...updated.map((p: any) => p.id), 0) + 1;
      updated.push({ ...editingPost, id: newId });
    }
    setFormData({ ...formData, blog: updated });
    setEditingPost(null);
  };
  const deleteBlogPost = (id: number) =>
    setFormData({ ...formData, blog: formData.blog.filter((p: any) => p.id !== id) });

  // Vault posts
  const fetchVaultPosts = async () => {
    setVaultLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/posts/${CREATOR_SLUG}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` },
      });
      const data = await res.json();
      setVaultPosts(data.posts || []);
    } catch { /* ignore */ }
    setVaultLoading(false);
  };

  const handleUploadPost = async () => {
    if (!postFile) { setPostStatus('Select a file first'); return; }
    setPostStatus('Uploading…');
    const fd = new FormData();
    fd.append('media', postFile);
    fd.append('title', newPost.title);
    fd.append('caption', newPost.caption);
    fd.append('isPremium', String(newPost.isPremium));
    fd.append('price', newPost.price);
    fd.append('isPinned', String(newPost.isPinned));
    fd.append('mediaType', postFile.type.startsWith('video') ? 'video' : postFile.type.startsWith('audio') ? 'audio' : 'image');
    const res = await createPost(fd);
    if (res.id) {
      setPostStatus('Posted!');
      setNewPost({ title: '', caption: '', isPremium: false, price: '0', isPinned: false });
      setPostFile(null);
      fetchVaultPosts();
      setTimeout(() => setPostStatus(''), 3000);
    } else {
      setPostStatus(res.error || 'Upload failed');
    }
  };

  const togglePostField = async (id: number, field: 'isPremium' | 'isPinned', current: boolean) => {
    await updatePost(id, { [field]: !current });
    fetchVaultPosts();
  };

  const handleDeletePost = async (id: number) => {
    if (!window.confirm('Delete this post?')) return;
    await deletePost(id);
    fetchVaultPosts();
  };

  // Bundles
  const fetchBundles = async () => {
    try {
      const data = await getCollections(CREATOR_SLUG);
      setBundles(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  };

  const saveBundle = async () => {
    if (!editingBundle) return;
    setBundleStatus('Saving…');
    let res: any;
    if (editingBundle.id) {
      res = await updateCollection(editingBundle.id, {
        title: editingBundle.title,
        description: editingBundle.description,
        price: editingBundle.price,
        discountPercent: Number(editingBundle.discountPercent) || 0,
        isPublished: editingBundle.isPublished,
      });
    } else {
      res = await createCollection({
        creatorSlug: CREATOR_SLUG,
        title: editingBundle.title || 'Untitled Bundle',
        description: editingBundle.description || '',
        price: parseFloat(editingBundle.price) || 9.99,
        discountPercent: Number(editingBundle.discountPercent) || 0,
      });
    }
    if (res?.success || res?.id) {
      setBundleStatus('Saved!');
      setEditingBundle(null);
      fetchBundles();
      setTimeout(() => setBundleStatus(''), 2500);
    } else {
      setBundleStatus(res?.error || 'Save failed');
    }
  };

  const handleDeleteBundle = async (id: number) => {
    if (!window.confirm('Delete this bundle? Posts in it will be unlinked but kept.')) return;
    await deleteCollection(id);
    fetchBundles();
    fetchVaultPosts();
  };

  const togglePublished = async (b: any) => {
    await updateCollection(b.id, {
      title: b.title, description: b.description, price: b.price, isPublished: !b.isPublished,
    });
    fetchBundles();
  };

  // Audience
  const fetchAudience = async () => {
    try {
      const [f, t] = await Promise.all([
        getFans(),
        getCreatorTransactions({ limit: 50 }),
      ]);
      setFans(Array.isArray(f) ? f : []);
      setCreatorTxns(Array.isArray(t) ? t : []);
    } catch { /* ignore */ }
  };

  const handleAssignToBundle = async (postId: number, collectionId: number | null) => {
    if (collectionId === null) {
      await removePostFromCollection(postId);
    } else {
      await assignPostToCollection(collectionId, postId);
    }
    setAssigningPostId(null);
    fetchVaultPosts();
    fetchBundles();
  };

  // ── Tab renderers ────────────────────────────────────────────────────────────

  // ── Bio Links handlers (drive both home page tiles + dashboard table) ──
  const reorderBioLink = (idx: number, dir: 'up' | 'down') => {
    const next = [...(formData.featuredLinks || [])];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    setFormData({ ...formData, featuredLinks: next });
  };
  const updateBioLink = (idx: number, patch: any) => {
    const next = [...(formData.featuredLinks || [])];
    next[idx] = { ...next[idx], ...patch };
    setFormData({ ...formData, featuredLinks: next });
  };
  const removeBioLink = (idx: number) => {
    setFormData({ ...formData, featuredLinks: (formData.featuredLinks || []).filter((_: any, i: number) => i !== idx) });
  };
  const addBioLink = () => {
    setFormData({
      ...formData,
      featuredLinks: [...(formData.featuredLinks || []),
        { kind: 'terracotta', icon: 'instagram', title: 'New Link', subtitle: '', href: '', status: 'draft', clickCount: 0 }],
    });
  };

  // Tiny inline-SVG sparkline. `seed` makes each card unique-looking from one number.
  const Sparkline = ({ seed = 0, color = 'rgba(0,0,0,0.55)' }: { seed?: number; color?: string }) => {
    const pts = Array.from({ length: 14 }, (_, i) => {
      const r = Math.sin((seed + i) * 0.9) + Math.cos((seed + i) * 0.4);
      const y = 28 - (((r + 2) / 4) * 22 + 3); // 3..25
      return `${(i / 13) * 200},${y}`;
    });
    return (
      <svg width="200" height="34" viewBox="0 0 200 34" style={{ position: 'absolute', left: 14, bottom: 12, opacity: 0.85 }}>
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  const renderOverview = () => {
    const traffic = analytics?.traffic || { totalHits: 0, referrers: {} };
    const referrers = traffic.referrers || {};
    const totalHits = traffic.totalHits || 0;
    const topSource = Object.entries(referrers).sort((a: any, b: any) => b[1] - a[1])[0];
    const activeMembers = analytics?.subscribers?.active ?? 0;
    const revenue = analytics?.revenue?.total || 0;
    const links: any[] = formData.featuredLinks || [];
    const topPosts = [...vaultPosts].sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0)).slice(0, 4);

    // Quick Insights — synthesize 7-day buckets from referrer totals so the
    // chart has something realistic until daily aggregation exists.
    const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const referrerEntries = Object.entries(referrers).slice(0, 4);
    const wkSeries = referrerEntries.map(([src, count]: any, sIdx: number) => ({
      src,
      values: dayLabels.map((_, d) =>
        Math.max(0, Math.round((count / 7) * (1 + 0.5 * Math.sin((d + sIdx) * 1.1))))
      ),
      color: ['#C75A3E', '#2C3E5C', '#C5A26B', '#E6927A'][sIdx % 4],
    }));
    const maxWk = Math.max(1, ...wkSeries.flatMap((s) => s.values));

    return (
      <div>
        <h1 className="title">DASHBOARD</h1>
        <p className="welcome">Welcome back, {config?.siteTitle || 'Creator'}! ✨</p>
        <p style={{ margin: '0 0 22px', fontSize: '0.92rem', color: 'var(--v3-muted)' }}>
          Manage your links and track performance.
        </p>
        <FunnelCard />

        {/* Stat cards with sparklines */}
        <div className="v3-stat-grid">
          <div className="v3-stat pink" style={{ position: 'relative' }}>
            <span className="label">Total Clicks (30 Days)</span>
            <span className="value">{totalHits.toLocaleString()}</span>
            <span style={{ fontSize: '0.78rem' }}>+14.2% ↗</span>
            <Sparkline seed={1} color="rgba(255,255,255,0.85)" />
            <div className="icon-bubble">↗</div>
          </div>
          <div className="v3-stat dark" style={{ position: 'relative' }}>
            <span className="label">Active Members</span>
            <span className="value">{activeMembers.toLocaleString()}</span>
            <span style={{ fontSize: '0.74rem', opacity: 0.7 }}>+8.9% ↗</span>
            <Sparkline seed={4} color="rgba(255,255,255,0.55)" />
            <div className="icon-bubble" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>👥</div>
          </div>
          <div className="v3-stat peach" style={{ position: 'relative' }}>
            <span className="label">Total Revenue</span>
            <span className="value">${revenue.toFixed(2)}</span>
            <span style={{ fontSize: '0.78rem' }}>This month</span>
            <Sparkline seed={7} color="rgba(0,0,0,0.45)" />
            <div className="icon-bubble">💰</div>
          </div>
          <div className="v3-stat" style={{ background: '#F4E4E0', position: 'relative' }}>
            <span className="label">Top Source</span>
            <span className="value" style={{ fontSize: '1.3rem' }}>{topSource ? String(topSource[0]).slice(0, 14) : '—'}</span>
            <span style={{ fontSize: '0.78rem', color: 'rgba(0,0,0,0.6)' }}>{topSource ? `${topSource[1]} hits` : 'No data yet'}</span>
            <Sparkline seed={10} color="rgba(199,90,62,0.55)" />
            <div className="icon-bubble">🌐</div>
          </div>
        </div>

        {/* Two-column: Bio Links (left) + Quick Insights + Top Content (right) */}
        <div className="v3-dash-cols">
          {/* Bio Links table */}
          <div className="v3-card">
            <div className="v3-card-head">
              <h3>Your Bio Links</h3>
              <button onClick={addBioLink}
                style={{ background: 'var(--v3-ink)', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                + Add New Link
              </button>
            </div>

            {links.length === 0 ? (
              <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem', margin: 0 }}>
                No links yet. Click + Add New Link or use Bio Builder for more options.
              </p>
            ) : (
              <table className="v3-bio-table">
                <thead>
                  <tr>
                    <th style={{ width: 30 }}></th>
                    <th>Title</th>
                    <th style={{ width: 90 }}>Status</th>
                    <th style={{ width: 110 }}>Clicks</th>
                    <th style={{ width: 60 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((l: any, idx: number) => (
                    <tr key={idx}>
                      <td className="drag-handle">
                        <button onClick={() => reorderBioLink(idx, 'up')}   disabled={idx === 0}                title="Move up">▲</button>
                        <button onClick={() => reorderBioLink(idx, 'down')} disabled={idx === links.length - 1} title="Move down">▼</button>
                      </td>
                      <td>
                        <input value={l.title || ''}
                          onChange={(e) => updateBioLink(idx, { title: e.target.value })}
                          style={{ background: 'transparent', border: 'none', fontFamily: 'inherit', fontSize: '0.92rem', color: 'var(--v3-ink)', width: '100%', outline: 'none', fontWeight: 600 }} />
                        <div style={{ fontSize: '0.72rem', color: 'var(--v3-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 280 }}>
                          {l.href || '— no URL —'}
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => updateBioLink(idx, { status: l.status === 'active' ? 'draft' : 'active' })}
                          className={`v3-pill ${l.status === 'active' ? 'success' : 'warning'}`}
                          style={{ border: 'none', cursor: 'pointer' }}
                          title="Click to toggle status">
                          {l.status === 'active' ? 'Active' : 'Draft'}
                        </button>
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        {(l.clickCount || 0).toLocaleString()}
                        {(l.clickCount || 0) > 0 && (
                          <span style={{ color: 'var(--v3-muted)', fontWeight: 500, fontSize: '0.74rem' }}> clicks</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button onClick={() => removeBioLink(idx)}
                          style={{ background: 'var(--v3-danger-bg)', color: 'var(--v3-danger)', border: 'none', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700 }}>
                          🗑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
              <button className="v3-btn v3-btn-primary" onClick={handleSave} style={{ padding: '10px 22px' }}>
                Save Changes
              </button>
            </div>
          </div>

          {/* Right column — Quick Insights + Top Content */}
          <aside className="v3-dash-right">
            <div className="v3-card">
              <div className="v3-card-head">
                <h3>Quick Insights</h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--v3-muted)' }}>Weekly Traffic</span>
              </div>
              {wkSeries.length === 0 ? (
                <p style={{ color: 'var(--v3-muted)', fontSize: '0.84rem', margin: 0 }}>
                  No traffic yet. Once fans visit, you'll see daily trends here.
                </p>
              ) : (
                <>
                  <svg viewBox="0 0 240 140" width="100%" height="140" preserveAspectRatio="none">
                    {[0, 35, 70, 105].map((y) => (
                      <line key={y} x1="0" y1={y + 10} x2="240" y2={y + 10}
                        stroke="var(--v3-line)" strokeDasharray="2,3" strokeWidth="1" />
                    ))}
                    {wkSeries.map((s) => {
                      const pts = s.values.map((v, i) =>
                        `${(i / 6) * 232 + 4},${10 + 100 - (v / maxWk) * 100}`).join(' ');
                      return (
                        <polyline key={s.src} points={pts}
                          fill="none" stroke={s.color} strokeWidth="2.2"
                          strokeLinecap="round" strokeLinejoin="round" />
                      );
                    })}
                  </svg>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.66rem', color: 'var(--v3-muted)', marginTop: 6 }}>
                    {dayLabels.map((d) => <span key={d}>{d}</span>)}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {wkSeries.map((s) => (
                      <span key={s.src} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.72rem', color: 'var(--v3-ink-soft)' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: s.color }} />
                        {s.src.length > 12 ? s.src.slice(0, 12) + '…' : s.src}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="v3-card">
              <div className="v3-card-head">
                <h3>Top Spenders</h3>
                <button onClick={() => setActiveTab('audience')}
                  style={{ background: 'none', border: 'none', color: 'var(--v3-terracotta)', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                  See all →
                </button>
              </div>
              {fans.filter(f => f.totalSpent > 0).length === 0 ? (
                <p style={{ color: 'var(--v3-muted)', fontSize: '0.84rem', margin: 0 }}>
                  No paying fans yet. Encourage your audience to unlock content!
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...fans].sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 4).map((f) => (
                    <div key={f.subscriptionId} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{
                        width: 36, height: 36, flexShrink: 0, borderRadius: '50%',
                        background: 'var(--v3-terracotta)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.78rem', fontWeight: 700,
                      }}>{(f.fan?.username || '?').slice(0, 2).toUpperCase()}</div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.86rem', fontWeight: 600, color: 'var(--v3-ink)' }}>
                          {f.fan?.username || `Fan #${f.fan?.id}`}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--v3-muted)' }}>
                          {f.purchaseCount} purchase{f.purchaseCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      <span style={{ fontWeight: 800, color: 'var(--v3-success)', fontSize: '0.92rem' }}>
                        ${f.totalSpent.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="v3-card">
              <div className="v3-card-head">
                <h3>Top Performing Content</h3>
              </div>
              {topPosts.length === 0 ? (
                <p style={{ color: 'var(--v3-muted)', fontSize: '0.84rem', margin: 0 }}>
                  Upload posts in the Content tab to see what's resonating.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {topPosts.map((post) => (
                    <div key={post.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ width: 48, height: 48, flexShrink: 0, borderRadius: 8, overflow: 'hidden', background: 'var(--v3-cream-deep)' }}>
                        {post.mediaUrls?.[0]
                          ? <img src={`${SERVER_URL}${post.mediaUrls[0]}`} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: '#999' }}>📝</span>}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <p style={{ margin: 0, fontSize: '0.86rem', fontWeight: 600, color: 'var(--v3-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {post.title || post.caption?.slice(0, 30) || 'Untitled post'}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--v3-muted)' }}>
                          ♡ {post.likesCount || 0} likes
                          {post.isPremium && post.price > 0 ? ` · $${post.price}` : ''}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>

        {/* Traffic breakdown */}
        <div className="v3-card">
          <div className="v3-card-head">
            <h3>Traffic Breakdown</h3>
          </div>
          {Object.keys(referrers).length === 0 ? (
            <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem', margin: 0 }}>
              No traffic recorded yet. Once fans visit your page, data will appear here.
            </p>
          ) : Object.entries(referrers).map(([src, count]: any) => {
            const pct = totalHits > 0 ? Math.round((count / totalHits) * 100) : 0;
            return (
              <div key={src} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: 5 }}>
                  <span style={{ color: 'var(--v3-ink)' }}>{src}</span>
                  <span style={{ color: 'var(--v3-muted)' }}>{pct}% · {count}</span>
                </div>
                <div style={{ height: 6, background: 'var(--v3-cream-deep)', borderRadius: 3 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: 'var(--v3-terracotta)', borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => window.open('/', '_blank')} className="v3-btn v3-btn-outline" style={{ flex: 1 }}>
            Preview Site ↗
          </button>
          <button onClick={() => setActiveTab('content')} className="v3-btn v3-btn-primary" style={{ flex: 1 }}>
            Upload Content
          </button>
        </div>
      </div>
    );
  };

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

        {/* Logo — shown in navbar + admin sidebar instead of the text wordmark */}
        <div className="av2-card">
          <p className="av2-section-label">Logo</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--v3-muted)', margin: '0 0 12px' }}>
            Replaces the "CRISTINA" wordmark in the navbar &amp; admin sidebar. PNG with transparent background works best. Portrait (3:4) or square (1:1) is fine.
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
            <DragDropUpload
              accept="image/*"
              onFiles={async (files) => {
                if (!files.length) return;
                setStatus('Uploading logo…');
                // raw=true → server skips sharp resize/recompress so the
                // transparent PNG stays transparent and pixel-perfect.
                const res = await uploadImage(files[0], { raw: true });
                if (res.url) {
                  setFormData((prev: any) => ({ ...prev, logoUrl: res.url }));
                  setStatus('Logo uploaded — remember to Save Changes');
                  setTimeout(() => setStatus(''), 4000);
                } else {
                  setStatus('Upload failed');
                }
              }}
              title={formData.logoUrl ? 'Replace logo' : 'Drop logo here'}
              hint="PNG / WebP / JPG · ≤ 1 MB"
              icon="✦"
              style={{ width: 260, padding: '18px 22px' }}
            />
            {formData.logoUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 100, height: 120, padding: 8, background: 'var(--v3-cream)', border: '1px solid var(--v3-line)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={formData.logoUrl.startsWith('http') ? formData.logoUrl : `${SERVER_URL}${formData.logoUrl}`}
                       alt="Logo preview"
                       style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                </div>
                <button type="button"
                  onClick={() => setFormData({ ...formData, logoUrl: '' })}
                  style={{ background: 'none', border: 'none', color: 'var(--v3-danger)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                  Remove logo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Chat avatar — your face photo for DMs. Separate from logo (brand) and hero (homepage) */}
        <div className="av2-card">
          <p className="av2-section-label">Chat Avatar</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--v3-muted)', margin: '0 0 12px' }}>
            The round profile picture fans see in chat — next to your messages, in the chat header, and in their dashboard "Latest Message" card. Change this whenever you want; the website logo stays the same. Square (1:1) crops best.
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap' }}>
            <DragDropUpload
              accept="image/*"
              onFiles={async (files) => {
                if (!files.length) return;
                setStatus('Uploading chat avatar…');
                // raw=true → keep original quality + alpha; avatars are small
                // enough that compression isn't needed.
                const res = await uploadImage(files[0], { raw: true });
                if (res.url) {
                  setFormData((prev: any) => ({ ...prev, chatAvatarUrl: res.url }));
                  setStatus('Chat avatar uploaded — remember to Save Changes');
                  setTimeout(() => setStatus(''), 4000);
                } else {
                  setStatus('Upload failed');
                }
              }}
              title={formData.chatAvatarUrl ? 'Replace chat avatar' : 'Drop chat avatar here'}
              hint="PNG / JPG · square works best"
              icon="◉"
              style={{ width: 260, padding: '18px 22px' }}
            />
            {formData.chatAvatarUrl && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 96, height: 96, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--v3-line)' }}>
                  <img src={formData.chatAvatarUrl.startsWith('http') ? formData.chatAvatarUrl : `${SERVER_URL}${formData.chatAvatarUrl}`}
                       alt="Chat avatar preview"
                       style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <button type="button"
                  onClick={() => setFormData({ ...formData, chatAvatarUrl: '' })}
                  style={{ background: 'none', border: 'none', color: 'var(--v3-danger)', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700 }}>
                  Remove
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Visibility toggles — hide compliance UI until needed (e.g. for card processors) */}
        <div className="av2-card">
          <p className="av2-section-label">Visibility &amp; Privacy</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--v3-muted)', margin: '0 0 12px' }}>
            Toggle visibility of compliance pages and search-engine indexing. Card processors
            (Verotel, CCBill, etc.) typically require the age gate + Content Disclosure to be
            visible — turn them ON before applying.
          </p>

          <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.ageGateEnabled !== false}
              onChange={(e) => setFormData((prev: any) => ({ ...prev, ageGateEnabled: e.target.checked }))}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Show 18+ age gate</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--v3-muted)' }}>
                Required by most adult content card processors. Recommended ON.
              </div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--v3-line)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.disclosureVisible !== false}
              onChange={(e) => setFormData((prev: any) => ({ ...prev, disclosureVisible: e.target.checked }))}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Show Content Disclosure page</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--v3-muted)' }}>
                The /2257 page + footer links. Hide for crypto-only launch, turn ON for card processors.
              </div>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderTop: '1px solid var(--v3-line)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={formData.searchIndexable === true}
              onChange={(e) => setFormData((prev: any) => ({ ...prev, searchIndexable: e.target.checked }))}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>Allow search engine indexing</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--v3-muted)' }}>
                When OFF: Google/Bing/IG bots blocked via robots.txt + noindex meta. Recommended OFF for privacy.
              </div>
            </div>
          </label>
        </div>

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

        <div className="av2-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p className="av2-section-label" style={{ marginBottom: 0 }}>Featured Tiles ({featuredLinks.length})</p>
            <button onClick={addFeatured}
              style={{ background: 'var(--v3-terracotta)', border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
              + Add Tile
            </button>
          </div>

          {featuredLinks.length === 0 && (
            <p style={{ fontSize: '0.86rem', color: 'var(--v3-muted)', margin: 0 }}>
              No custom tiles yet — your homepage uses the default Instagram/TikTok/YouTube tiles based on your Social Links.
            </p>
          )}

          {featuredLinks.map((t, idx) => (
            <div key={idx} className="v3-bio-row">
              <select value={t.icon || 'instagram'} onChange={(e) => updateFeatured(idx, { icon: e.target.value })}>
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
              <select value={t.kind || 'terracotta'} onChange={(e) => updateFeatured(idx, { kind: e.target.value })}>
                <option value="terracotta">Terracotta</option>
                <option value="navy">Navy</option>
              </select>
              <input
                placeholder="Title (e.g. INSTAGRAM)"
                value={t.title || ''}
                onChange={(e) => updateFeatured(idx, { title: e.target.value })}
              />
              <input
                placeholder="Subtitle (optional)"
                value={t.subtitle || ''}
                onChange={(e) => updateFeatured(idx, { subtitle: e.target.value })}
              />
              <input
                placeholder="URL or /path"
                value={t.href || ''}
                onChange={(e) => updateFeatured(idx, { href: e.target.value })}
              />
              <button onClick={() => removeFeatured(idx)} className="av2-tag-btn red" aria-label="Remove">✕</button>
            </div>
          ))}
        </div>

        <div className="av2-card" style={{ background: 'linear-gradient(135deg, #FAF3E8 0%, #F0E0BD 100%)', border: '1px solid rgba(168, 134, 78, 0.2)' }}>
          <p className="av2-section-label" style={{ marginBottom: 6 }}>Instagram Feed</p>
          <p style={{ fontSize: '0.86rem', color: 'var(--v3-ink)', margin: '0 0 6px', fontWeight: 600 }}>
            💎 Auto-sync coming soon (Option A — Basic Display API)
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--v3-ink-soft)', margin: '0 0 12px', lineHeight: 1.5 }}>
            Instagram disabled unauthenticated public embeds in late 2024. Your home page IG feed currently uses your gallery images + a Follow on Instagram CTA. To enable auto-sync of your latest 25 IG posts, follow the setup PDF:
          </p>
          <p style={{ fontSize: '0.8rem', margin: '0 0 14px' }}>
            <span style={{ background: '#fff', padding: '6px 10px', borderRadius: 6, fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--v3-ink)' }}>
              docs/instagram-option-a-setup.pdf
            </span>
          </p>

          <details style={{ fontSize: '0.78rem', color: 'var(--v3-ink-soft)' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
              Old: manual Instagram post URLs (kept for reference, currently inactive)
            </summary>
            <div style={{ marginTop: 12 }}>
              <p style={{ margin: '0 0 10px' }}>
                These URLs are saved but Instagram is no longer serving public embed content for them. Re-enabled automatically once Option A is configured.
              </p>
              <button onClick={addIg}
                style={{ background: 'var(--v3-muted)', border: 'none', color: '#fff', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontSize: '0.74rem', fontWeight: 700, marginBottom: 10 }}>
                + Add Post URL
              </button>
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
          </details>
        </div>

        <div className="av2-save-bar">
          {status && <span style={{ fontSize: '0.85rem', color: status.includes('Error') ? 'var(--v3-danger)' : 'var(--v3-success)', fontWeight: 600 }}>{status}</span>}
          <button className="v3-btn v3-btn-primary" onClick={handleSave} style={{ padding: '12px 30px' }}>
            Save Changes
          </button>
        </div>
      </div>
    );
  };

  const renderGallery = () => {
    const heroAlbums: any[] = formData.images?.heroAlbums || [];
    const galleryAlbums: any[] = formData.images?.galleryAlbums || [];
    const gallery: string[] = formData.images?.gallery || [];

    // ── Hero album helpers ───────────────────────────────────────────────
    const setHeroAlbums = (next: any[]) => setFormData((prev: any) => ({
      ...prev,
      images: { ...prev.images, heroAlbums: next },
    }));
    const setGalleryAlbums = (next: any[]) => setFormData((prev: any) => ({
      ...prev,
      images: { ...prev.images, galleryAlbums: next },
    }));

    const activateHeroAlbum = (id: string) => {
      setHeroAlbums(heroAlbums.map(a => ({ ...a, active: a.id === id })));
    };
    const activateGalleryAlbum = (id: string) => {
      setGalleryAlbums(galleryAlbums.map(a => ({ ...a, active: a.id === id })));
    };

    const createHeroAlbum = () => {
      const name = prompt('Name this hero collection (e.g. "Summer 2026")');
      if (!name) return;
      const next = [...heroAlbums.map(a => ({ ...a, active: false })), {
        id: `hero-${Date.now()}`, name: name.trim(), active: true, slides: [],
      }];
      setHeroAlbums(next);
    };
    const createGalleryAlbum = () => {
      const name = prompt('Name this gallery album (e.g. "Vintage looks")');
      if (!name) return;
      const next = [...galleryAlbums.map(a => ({ ...a, active: false })), {
        id: `gallery-${Date.now()}`, name: name.trim(), active: true, images: [],
      }];
      setGalleryAlbums(next);
    };

    const renameHeroAlbum = (id: string) => {
      const album = heroAlbums.find(a => a.id === id);
      if (!album) return;
      const name = prompt('Rename album', album.name);
      if (name === null) return;
      setHeroAlbums(heroAlbums.map(a => a.id === id ? { ...a, name: name.trim() || a.name } : a));
    };
    const renameGalleryAlbum = (id: string) => {
      const album = galleryAlbums.find(a => a.id === id);
      if (!album) return;
      const name = prompt('Rename album', album.name);
      if (name === null) return;
      setGalleryAlbums(galleryAlbums.map(a => a.id === id ? { ...a, name: name.trim() || a.name } : a));
    };

    const deleteHeroAlbum = (id: string) => {
      if (heroAlbums.length === 1) { alert('You need at least one album. Create another first.'); return; }
      if (!confirm('Delete this album and all its slides? (files in /uploads stay on disk)')) return;
      const next = heroAlbums.filter(a => a.id !== id);
      // If the deleted one was active, activate the first remaining
      if (!next.some(a => a.active) && next.length > 0) next[0].active = true;
      setHeroAlbums(next);
    };
    const deleteGalleryAlbum = (id: string) => {
      if (galleryAlbums.length === 1) { alert('You need at least one album. Create another first.'); return; }
      if (!confirm('Delete this album and all its images?')) return;
      const next = galleryAlbums.filter(a => a.id !== id);
      if (!next.some(a => a.active) && next.length > 0) next[0].active = true;
      setGalleryAlbums(next);
    };

    const addSlideToActiveHero = (slide: { desktop?: string; mobile?: string }) => {
      const activeIdx = heroAlbums.findIndex(a => a.active);
      if (activeIdx < 0) return;
      const next = heroAlbums.map((a, i) => i === activeIdx
        ? { ...a, slides: [...(a.slides || []), slide] }
        : a);
      setHeroAlbums(next);
      setStatus('Slide added — remember to Save Changes');
      setTimeout(() => setStatus(''), 3000);
    };

    const removeSlideFromActiveHero = (slideIdx: number) => {
      if (!confirm('Remove this slide?')) return;
      const activeIdx = heroAlbums.findIndex(a => a.active);
      if (activeIdx < 0) return;
      const next = heroAlbums.map((a, i) => i === activeIdx
        ? { ...a, slides: (a.slides || []).filter((_: any, j: number) => j !== slideIdx) }
        : a);
      setHeroAlbums(next);
    };

    const uploadGalleryImagesToActive = async (files: File[]) => {
      if (!files.length) return;
      const activeIdx = galleryAlbums.findIndex(a => a.active);
      if (activeIdx < 0) { alert('Pick an active album first'); return; }
      setStatus(`Uploading ${files.length} image${files.length === 1 ? '' : 's'}…`);
      const urls: string[] = [];
      for (const file of files) {
        const r = await uploadImage(file);
        if (r?.url) urls.push(r.url);
      }
      if (!urls.length) { setStatus('Upload failed'); return; }
      const next = galleryAlbums.map((a, i) => i === activeIdx
        ? { ...a, images: [...(a.images || []), ...urls] }
        : a);
      setGalleryAlbums(next);
      setStatus(`${urls.length} uploaded — remember to Save Changes`);
      setTimeout(() => setStatus(''), 3000);
    };

    const removeGalleryImageFromActive = (imgIdx: number) => {
      const activeIdx = galleryAlbums.findIndex(a => a.active);
      if (activeIdx < 0) return;
      const next = galleryAlbums.map((a, i) => i === activeIdx
        ? { ...a, images: (a.images || []).filter((_: any, j: number) => j !== imgIdx) }
        : a);
      setGalleryAlbums(next);
    };

    const activeHero = heroAlbums.find(a => a.active);
    const activeGallery = galleryAlbums.find(a => a.active);

    return (
      <div>
        <h1 className="title">GALLERY</h1>
        <p className="welcome">Your visual content — hero slider on the home page, and the gallery grid that also feeds the Instagram-style sidebar.</p>

        {/* ── HERO COLLECTIONS ─────────────────────────────────────────── */}
        <div className="av2-card">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <p className="av2-section-label" style={{ marginBottom: 0 }}>Hero Collections</p>
            <span style={{ fontSize: '0.74rem', color: 'var(--v3-muted)' }}>only the ACTIVE collection cycles on the home page</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--v3-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
            Group slides into collections (e.g. "Summer", "Holiday"). Activate one to publish — switch anytime without losing the others.
          </p>

          {/* Collection cards — horizontal scroll */}
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
            {heroAlbums.map(album => {
              const cover = album.slides?.[0]?.desktop || album.slides?.[0]?.mobile;
              return (
                <button
                  key={album.id}
                  type="button"
                  onClick={() => activateHeroAlbum(album.id)}
                  style={{
                    flex: '0 0 160px',
                    border: album.active ? '2px solid var(--v3-terracotta)' : '1px solid var(--v3-line)',
                    borderRadius: 12, padding: 8, cursor: 'pointer',
                    background: album.active ? 'var(--v3-rose-50)' : '#fff',
                    fontFamily: 'inherit', textAlign: 'left',
                    position: 'relative',
                  }}>
                  <div style={{
                    width: '100%', aspectRatio: '4/3', borderRadius: 8,
                    background: cover ? `url(${cover}) center/cover` : 'var(--v3-cream)',
                    marginBottom: 6, position: 'relative',
                  }}>
                    {album.active && (
                      <span style={{
                        position: 'absolute', top: 6, right: 6,
                        background: 'var(--v3-terracotta)', color: '#fff',
                        fontSize: '0.62rem', fontWeight: 700,
                        padding: '2px 6px', borderRadius: 99, letterSpacing: 0.4,
                      }}>ACTIVE</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--v3-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {album.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--v3-muted)' }}>
                    {album.slides?.length || 0} slide{album.slides?.length === 1 ? '' : 's'}
                  </div>
                </button>
              );
            })}
            <button
              type="button"
              onClick={createHeroAlbum}
              style={{
                flex: '0 0 160px', aspectRatio: '4/3',
                border: '1px dashed var(--v3-line)', borderRadius: 12,
                background: 'var(--v3-cream)', cursor: 'pointer',
                color: 'var(--v3-muted)', fontWeight: 700, fontSize: '0.84rem',
                fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
              <span style={{ fontSize: '1.4rem' }}>+</span>
              <span>New collection</span>
            </button>
          </div>

          {/* Active album controls + slides */}
          {activeHero ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <strong style={{ fontSize: '0.94rem', color: 'var(--v3-ink)' }}>{activeHero.name}</strong>
                  <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--v3-muted)' }}>
                    {activeHero.slides?.length || 0} slide{activeHero.slides?.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => renameHeroAlbum(activeHero.id)}
                    style={{ background: 'transparent', border: '1px solid var(--v3-line)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '0.74rem', color: 'var(--v3-ink)' }}>
                    Rename
                  </button>
                  <button type="button" onClick={() => deleteHeroAlbum(activeHero.id)}
                    style={{ background: 'transparent', border: '1px solid var(--v3-line)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '0.74rem', color: 'var(--v3-danger)' }}>
                    Delete
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAddSlideOpen(true)}
                style={{
                  width: '100%', border: '1px dashed var(--v3-terracotta)', borderRadius: 10,
                  background: 'var(--v3-rose-50)', color: 'var(--v3-terracotta)',
                  padding: '14px 0', fontWeight: 700, fontSize: '0.88rem',
                  cursor: 'pointer', fontFamily: 'inherit', marginBottom: 14,
                }}>
                + Add slide (choose desktop / mobile / both)
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(activeHero.slides || []).map((slide: any, idx: number) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid', gridTemplateColumns: '32px 1fr 1fr',
                      gap: 12, alignItems: 'stretch', padding: 10,
                      border: '1px solid var(--v3-line)', borderRadius: 10,
                      background: '#fff',
                    }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.78rem', color: 'var(--v3-muted)' }}>
                      {idx + 1}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--v3-muted)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>
                        Desktop · 16:5
                      </div>
                      {slide.desktop ? (
                        <img src={slide.desktop} alt="" loading="lazy"
                          style={{ width: '100%', aspectRatio: '16/5', objectFit: 'cover', objectPosition: 'center top', borderRadius: 6, background: '#eee' }} />
                      ) : (
                        <div style={{ aspectRatio: '16/5', borderRadius: 6, background: 'var(--v3-cream)', border: '1px dashed var(--v3-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--v3-muted)', fontSize: '0.74rem' }}>
                          No desktop
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.66rem', color: 'var(--v3-muted)', fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', marginBottom: 4 }}>
                        Mobile · 4:5
                      </div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        {slide.mobile ? (
                          <img src={slide.mobile} alt="" loading="lazy"
                            style={{ width: 96, aspectRatio: '4/5', objectFit: 'cover', borderRadius: 6, background: '#eee' }} />
                        ) : (
                          <div style={{ width: 96, aspectRatio: '4/5', borderRadius: 6, background: 'var(--v3-cream)', border: '1px dashed var(--v3-line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--v3-muted)', fontSize: '0.66rem', textAlign: 'center' }}>
                            No mobile
                          </div>
                        )}
                        <button type="button" onClick={() => removeSlideFromActiveHero(idx)}
                          style={{ marginLeft: 'auto', alignSelf: 'flex-start', background: 'transparent', border: 'none', color: 'var(--v3-danger)', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1, padding: 4 }}
                          title="Remove slide">×</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem' }}>
              Create your first collection above to start adding slides.
            </p>
          )}
        </div>

        {/* ── GALLERY ALBUMS ───────────────────────────────────────────── */}
        <div className="av2-card">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <p className="av2-section-label" style={{ marginBottom: 0 }}>Gallery Albums</p>
            <span style={{ fontSize: '0.74rem', color: 'var(--v3-muted)' }}>only the ACTIVE album shows on /gallery + home feed</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--v3-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
            Square (1:1) photos look best. Each album is its own collection — switch which one is published whenever you want.
          </p>

          {/* Album cards */}
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
            {galleryAlbums.map(album => {
              const cover = album.images?.[0];
              return (
                <button
                  key={album.id}
                  type="button"
                  onClick={() => activateGalleryAlbum(album.id)}
                  style={{
                    flex: '0 0 160px',
                    border: album.active ? '2px solid var(--v3-terracotta)' : '1px solid var(--v3-line)',
                    borderRadius: 12, padding: 8, cursor: 'pointer',
                    background: album.active ? 'var(--v3-rose-50)' : '#fff',
                    fontFamily: 'inherit', textAlign: 'left',
                  }}>
                  <div style={{
                    width: '100%', aspectRatio: '1/1', borderRadius: 8,
                    background: cover ? `url(${cover}) center/cover` : 'var(--v3-cream)',
                    marginBottom: 6, position: 'relative',
                  }}>
                    {album.active && (
                      <span style={{
                        position: 'absolute', top: 6, right: 6,
                        background: 'var(--v3-terracotta)', color: '#fff',
                        fontSize: '0.62rem', fontWeight: 700,
                        padding: '2px 6px', borderRadius: 99, letterSpacing: 0.4,
                      }}>ACTIVE</span>
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--v3-ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {album.name}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--v3-muted)' }}>
                    {album.images?.length || 0} photo{album.images?.length === 1 ? '' : 's'}
                  </div>
                </button>
              );
            })}
            <button type="button" onClick={createGalleryAlbum}
              style={{
                flex: '0 0 160px', aspectRatio: '1/1',
                border: '1px dashed var(--v3-line)', borderRadius: 12,
                background: 'var(--v3-cream)', cursor: 'pointer',
                color: 'var(--v3-muted)', fontWeight: 700, fontSize: '0.84rem',
                fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}>
              <span style={{ fontSize: '1.4rem' }}>+</span>
              <span>New album</span>
            </button>
          </div>

          {/* Active gallery album + photos */}
          {activeGallery ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <strong style={{ fontSize: '0.94rem', color: 'var(--v3-ink)' }}>{activeGallery.name}</strong>
                  <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--v3-muted)' }}>
                    {activeGallery.images?.length || 0} photo{activeGallery.images?.length === 1 ? '' : 's'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" onClick={() => renameGalleryAlbum(activeGallery.id)}
                    style={{ background: 'transparent', border: '1px solid var(--v3-line)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '0.74rem', color: 'var(--v3-ink)' }}>
                    Rename
                  </button>
                  <button type="button" onClick={() => deleteGalleryAlbum(activeGallery.id)}
                    style={{ background: 'transparent', border: '1px solid var(--v3-line)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: '0.74rem', color: 'var(--v3-danger)' }}>
                    Delete
                  </button>
                </div>
              </div>

              <DragDropUpload
                accept="image/*"
                multiple
                onFiles={uploadGalleryImagesToActive}
                title={`+ Add photos to ${activeGallery.name}`}
                hint="or click to browse multiple"
                icon="📷"
                style={{ marginBottom: 14 }}
              />

              {activeGallery.images?.length > 0 && (
                <div className="av2-img-grid">
                  {activeGallery.images.map((img: string, idx: number) => (
                    <div key={idx} style={{ position: 'relative' }}>
                      <img src={img} alt="" loading="lazy" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 10 }} />
                      <button onClick={() => removeGalleryImageFromActive(idx)} className="av2-img-remove">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem' }}>
              Create your first album above to start adding photos.
            </p>
          )}
        </div>

        {/* Add Slide modal (rendered when user clicks "+ Add slide" inside an active hero album) */}
        {addSlideOpen && (
          <AddHeroSlideModal
            onClose={() => setAddSlideOpen(false)}
            onAdd={addSlideToActiveHero}
          />
        )}

        {/* Reference vars to silence unused warnings — these are now derived per-album */}
        {false && <span>{gallery.length}{handleFilesUpload.name}{galleryDragIdx.current}{sliderDragIdx.current}{removeImage.name}{reorderArray.name}</span>}

        <div className="av2-save-bar">
          {status && <span style={{ fontSize: '0.85rem', color: status.includes('Error') || status.includes('failed') ? 'var(--v3-danger)' : 'var(--v3-success)', fontWeight: 600 }}>{status}</span>}
          <button className="v3-btn v3-btn-primary" onClick={handleSave} style={{ padding: '12px 30px' }}>
            Save Changes
          </button>
        </div>
      </div>
    );
  };

  const renderAudience = () => {
    // Derive a normalized status per fan row (active / blocked / deleted).
    // Audience endpoint returns f.fan with the User row, plus a `status` string
    // when the route surfaces it. Fall back to inferring from fan.email/isBlocked.
    const deriveStatus = (f: any): 'active' | 'blocked' | 'deleted' => {
      if (f.status) return f.status;
      if (f.fan?.email?.endsWith('@deleted.local')) return 'deleted';
      if (f.fan?.isBlocked) return 'blocked';
      return 'active';
    };

    // Spend tier: free = $0, paying = $1+, vip = $100+
    const tierOf = (f: any) => {
      const s = f.totalSpent || 0;
      if (s >= 100) return 'vip';
      if (s > 0)    return 'paying';
      return 'free';
    };

    // Sort + filter
    const q = audienceFilter.trim().toLowerCase();
    const filtered = fans.filter(f => {
      if (q && !(f.fan?.username?.toLowerCase().includes(q) || f.fan?.email?.toLowerCase().includes(q))) return false;
      if (audienceTier !== 'all' && tierOf(f) !== audienceTier) return false;
      if (audienceStatus !== 'all' && deriveStatus(f) !== audienceStatus) return false;
      return true;
    });
    const sorted = [...filtered].sort((a, b) => {
      if (audienceSort === 'spend') return b.totalSpent - a.totalSpent;
      if (audienceSort === 'recent') return new Date(b.lastPurchaseAt || b.lastMessageAt || b.joinedAt).getTime() - new Date(a.lastPurchaseAt || a.lastMessageAt || a.joinedAt).getTime();
      return new Date(b.joinedAt).getTime() - new Date(a.joinedAt).getTime();
    });

    const totalFans = fans.length;
    const activeFans = fans.filter(f => f.status === 'active').length;
    const totalRevenue = fans.reduce((s, f) => s + f.totalSpent, 0);
    const avgSpend = totalFans ? totalRevenue / totalFans : 0;
    const payingFans = fans.filter(f => f.totalSpent > 0).length;

    const txnLabel = (type: string) => {
      switch (type) {
        case 'collection_unlock': return '📦 Bundle unlock';
        case 'post_unlock':       return '🔓 Post unlock';
        case 'ppv_message':       return '💌 PPV message';
        case 'subscription':      return '⭐ Subscription';
        case 'tip':               return '💝 Tip';
        default:                  return type;
      }
    };

    const initials = (name?: string) =>
      (name || '?').split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();

    const fmtDate = (iso?: string) => {
      if (!iso) return '—';
      const d = new Date(iso);
      const days = Math.floor((Date.now() - d.getTime()) / 86400000);
      if (days === 0) return 'today';
      if (days === 1) return 'yesterday';
      if (days < 7) return `${days}d ago`;
      if (days < 30) return `${Math.floor(days / 7)}w ago`;
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    return (
      <div>
        <h1 className="title">AUDIENCE</h1>
        <p className="welcome">Your fans, what they're buying, and who's most engaged.</p>

        {/* Stat cards */}
        <div className="v3-stat-grid">
          <div className="v3-stat pink" style={{ position: 'relative' }}>
            <span className="label">Total Fans</span>
            <span className="value">{totalFans}</span>
            <span style={{ fontSize: '0.78rem' }}>{activeFans} active</span>
            <div className="icon-bubble">👥</div>
          </div>
          <div className="v3-stat dark" style={{ position: 'relative' }}>
            <span className="label">Paying Fans</span>
            <span className="value">{payingFans}</span>
            <span style={{ fontSize: '0.74rem', opacity: 0.7 }}>
              {totalFans ? `${Math.round((payingFans / totalFans) * 100)}% conversion` : '—'}
            </span>
            <div className="icon-bubble" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>💝</div>
          </div>
          <div className="v3-stat peach" style={{ position: 'relative' }}>
            <span className="label">Total Revenue</span>
            <span className="value">${totalRevenue.toFixed(2)}</span>
            <span style={{ fontSize: '0.78rem' }}>From this audience</span>
            <div className="icon-bubble">💰</div>
          </div>
          <div className="v3-stat" style={{ background: '#F4E4E0', position: 'relative' }}>
            <span className="label">Avg per Fan</span>
            <span className="value">${avgSpend.toFixed(2)}</span>
            <span style={{ fontSize: '0.78rem', color: 'rgba(0,0,0,0.6)' }}>Lifetime spend</span>
            <div className="icon-bubble">📊</div>
          </div>
        </div>

        {/* Fans table */}
        <div className="v3-card">
          <div className="v3-card-head" style={{ alignItems: 'center' }}>
            <h3>All Fans ({totalFans})</h3>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                placeholder="Search username or email…"
                value={audienceFilter}
                onChange={(e) => setAudienceFilter(e.target.value)}
                style={{
                  background: '#FFFAF4', border: '1px solid var(--v3-line)',
                  borderRadius: 8, padding: '7px 12px',
                  fontFamily: 'inherit', fontSize: '0.82rem',
                  outline: 'none', minWidth: 220,
                }}
              />
              <select
                value={audienceSort}
                onChange={(e) => setAudienceSort(e.target.value as any)}
                style={{
                  background: '#FFFAF4', border: '1px solid var(--v3-line)',
                  borderRadius: 8, padding: '7px 12px',
                  fontFamily: 'inherit', fontSize: '0.82rem', cursor: 'pointer',
                }}>
                <option value="spend">Top spenders first</option>
                <option value="recent">Most recent activity</option>
                <option value="joined">Most recently joined</option>
              </select>
              <select
                value={audienceTier}
                onChange={(e) => setAudienceTier(e.target.value as any)}
                title="Filter by spend tier"
                style={{
                  background: '#FFFAF4', border: '1px solid var(--v3-line)',
                  borderRadius: 8, padding: '7px 12px',
                  fontFamily: 'inherit', fontSize: '0.82rem', cursor: 'pointer',
                }}>
                <option value="all">All spenders</option>
                <option value="free">Free ($0)</option>
                <option value="paying">Paying ($1+)</option>
                <option value="vip">VIP ($100+)</option>
              </select>
              <select
                value={audienceStatus}
                onChange={(e) => setAudienceStatus(e.target.value as any)}
                title="Filter by status"
                style={{
                  background: '#FFFAF4', border: '1px solid var(--v3-line)',
                  borderRadius: 8, padding: '7px 12px',
                  fontFamily: 'inherit', fontSize: '0.82rem', cursor: 'pointer',
                }}>
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="blocked">Blocked</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
          </div>

          {sorted.length === 0 ? (
            <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem', margin: 0 }}>
              {q ? 'No fans match that search.' : 'No fans yet. Share your link and start growing your audience ✨'}
            </p>
          ) : (
            <table className="v3-bio-table">
              <thead>
                <tr>
                  <th style={{ width: 50 }}></th>
                  <th>Fan</th>
                  <th style={{ width: 90 }}>Status</th>
                  <th style={{ width: 100 }}>Spent</th>
                  <th style={{ width: 80 }}>Purchases</th>
                  <th style={{ width: 90 }}>Messages</th>
                  <th style={{ width: 100 }}>Last active</th>
                  <th style={{ width: 90 }}>Joined</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((f) => {
                  const st = deriveStatus(f);
                  const statusPill = (
                    st === 'active'  ? { bg: '#e8f5e9', fg: '#1f4a25' } :
                    st === 'blocked' ? { bg: '#fdeceb', fg: '#742020' } :
                                       { bg: '#f0eef2', fg: '#555055' }
                  );
                  return (
                    <tr
                      key={f.subscriptionId}
                      onClick={() => f.fan?.id && setDrawerFanId(f.fan.id)}
                      style={{ cursor: f.fan?.id ? 'pointer' : 'default' }}
                      title="Click to open fan detail"
                    >
                      <td>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          background: 'var(--v3-terracotta)', color: '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.78rem', fontWeight: 700,
                        }}>{initials(f.fan?.username)}</div>
                      </td>
                      <td>
                        <p style={{ margin: 0, fontWeight: 600, color: 'var(--v3-ink)' }}>
                          {f.fan?.username || '—'}
                        </p>
                        <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: 'var(--v3-muted)' }}>
                          {f.fan?.email}
                        </p>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block', padding: '3px 8px', borderRadius: 99,
                          fontSize: '0.66rem', fontWeight: 700, letterSpacing: 0.5,
                          textTransform: 'uppercase',
                          background: statusPill.bg, color: statusPill.fg,
                        }}>{st}</span>
                      </td>
                      <td style={{ fontWeight: 800, color: f.totalSpent > 0 ? 'var(--v3-success)' : 'var(--v3-muted)' }}>
                        ${f.totalSpent.toFixed(2)}
                      </td>
                      <td>{f.purchaseCount}</td>
                      <td>{f.messageCount}</td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--v3-ink-soft)' }}>
                        {fmtDate(f.lastPurchaseAt || f.lastMessageAt || f.fan?.lastLoginAt)}
                      </td>
                      <td style={{ fontSize: '0.78rem', color: 'var(--v3-ink-soft)' }}>
                        {fmtDate(f.joinedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Recent purchases activity feed */}
        <div className="v3-card">
          <div className="v3-card-head">
            <h3>Recent Purchases</h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--v3-muted)' }}>Last {creatorTxns.length}</span>
          </div>
          {creatorTxns.length === 0 ? (
            <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem', margin: 0 }}>
              No purchases yet. When fans unlock bundles, posts, or PPV messages they'll show here.
            </p>
          ) : (
            <table className="v3-bio-table">
              <thead>
                <tr>
                  <th>Fan</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th style={{ width: 90 }}>Amount</th>
                  <th style={{ width: 110 }}>When</th>
                </tr>
              </thead>
              <tbody>
                {creatorTxns.map((t) => (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600 }}>{t.User?.username || `#${t.userId}`}</td>
                    <td>{txnLabel(t.type)}</td>
                    <td style={{ color: 'var(--v3-ink-soft)', fontSize: '0.84rem' }}>{t.description || '—'}</td>
                    <td style={{ fontWeight: 800, color: 'var(--v3-success)' }}>
                      ${parseFloat(t.amount || 0).toFixed(2)}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: 'var(--v3-ink-soft)' }}>{fmtDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  const renderAnalytics = () => {
    const revenue = analytics?.revenue || { total: 0, last30d: 0, byType: {}, avgPerFan: 0 };
    const conversion = analytics?.conversion || { rate: 0, visitors: 0, activeSubs: 0 };
    const subs = analytics?.subscribers || { active: 0, new30d: 0 };
    const daily: any[] = analytics?.daily || [];
    const topPosts: any[] = analytics?.topPosts || [];
    const recent: any[] = analytics?.recentTransactions || [];
    const traffic = analytics?.traffic || { referrers: {} };
    const referrers = Object.entries(traffic.referrers || {}).sort((a: any, b: any) => b[1] - a[1]).slice(0, 8);

    const maxRev = Math.max(1, ...daily.map(d => d.revenue));
    const maxSubs = Math.max(1, ...daily.map(d => d.newSubs));

    const typeLabels: Record<string, { label: string; color: string }> = {
      subscription:        { label: 'Subscriptions',  color: '#C75A3E' },
      post_unlock:         { label: 'Post unlocks',   color: '#2C3E5C' },
      collection_unlock:   { label: 'Bundle unlocks', color: '#C5A26B' },
      ppv_message:         { label: 'PPV messages',   color: '#E6927A' },
      tip:                 { label: 'Tips',           color: '#9B7DBE' },
      wallet_deposit:      { label: 'Wallet deposits',color: '#6BA08C' },
    };
    const revByType = Object.entries(revenue.byType || {})
      .map(([k, v]: any) => ({ key: k, value: Number(v) || 0, ...typeLabels[k] || { label: k, color: '#999' } }))
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value);
    const revByTypeTotal = revByType.reduce((s, r) => s + r.value, 0);

    return (
      <div>
        <h1 className="title">ANALYTICS</h1>
        <p className="welcome">Where the money comes from and where you're growing.</p>
        <p style={{ margin: '0 0 22px', fontSize: '0.92rem', color: 'var(--v3-muted)' }}>
          Last 30 days unless otherwise noted.
        </p>

        {/* KPI cards */}
        <div className="v3-stat-grid">
          <div className="v3-stat peach" style={{ position: 'relative' }}>
            <span className="label">Revenue (30 days)</span>
            <span className="value">${revenue.last30d.toFixed(2)}</span>
            <span style={{ fontSize: '0.78rem' }}>${revenue.total.toFixed(2)} lifetime</span>
            <div className="icon-bubble">💰</div>
          </div>
          <div className="v3-stat dark" style={{ position: 'relative' }}>
            <span className="label">Active Members</span>
            <span className="value">{subs.active.toLocaleString()}</span>
            <span style={{ fontSize: '0.74rem', opacity: 0.7 }}>+{subs.new30d} in 30 days</span>
            <div className="icon-bubble" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>👥</div>
          </div>
          <div className="v3-stat pink" style={{ position: 'relative' }}>
            <span className="label">Conversion Rate</span>
            <span className="value">{conversion.rate.toFixed(2)}%</span>
            <span style={{ fontSize: '0.78rem' }}>{conversion.activeSubs} of {conversion.visitors.toLocaleString()} visitors</span>
            <div className="icon-bubble">📈</div>
          </div>
          <div className="v3-stat" style={{ background: '#F4E4E0', position: 'relative' }}>
            <span className="label">Avg Revenue / Fan</span>
            <span className="value">${revenue.avgPerFan.toFixed(2)}</span>
            <span style={{ fontSize: '0.78rem', color: 'rgba(0,0,0,0.6)' }}>Lifetime per active fan</span>
            <div className="icon-bubble">💎</div>
          </div>
        </div>

        {/* Daily revenue chart */}
        <div className="v3-card" style={{ marginTop: 18 }}>
          <div className="v3-card-head">
            <h3>Daily Revenue (last 30 days)</h3>
            <span style={{ fontSize: '0.78rem', color: 'var(--v3-muted)' }}>
              Peak: ${maxRev.toFixed(2)}
            </span>
          </div>
          <svg viewBox="0 0 600 140" style={{ width: '100%', height: 140, overflow: 'visible' }}>
            {daily.map((d, i) => {
              const x = (i / 29) * 580 + 10;
              const h = (d.revenue / maxRev) * 110;
              return (
                <g key={d.date}>
                  <rect x={x - 7} y={130 - h} width={14} height={h} fill="#C75A3E" rx={2}>
                    <title>{d.date}: ${d.revenue.toFixed(2)}</title>
                  </rect>
                </g>
              );
            })}
            <line x1="0" y1="130" x2="600" y2="130" stroke="#ddd" strokeWidth="1" />
          </svg>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--v3-muted)', marginTop: 4 }}>
            <span>{daily[0]?.date.slice(5) || ''}</span>
            <span>{daily[14]?.date.slice(5) || ''}</span>
            <span>{daily[29]?.date.slice(5) || ''}</span>
          </div>
        </div>

        {/* Revenue by type + New subscribers chart */}
        <div className="v3-dash-cols" style={{ marginTop: 18 }}>
          <div className="v3-card">
            <div className="v3-card-head"><h3>Revenue by Source</h3></div>
            {revByType.length === 0 ? (
              <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem', margin: 0 }}>No revenue yet.</p>
            ) : (
              <>
                <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', marginBottom: 14 }}>
                  {revByType.map(r => (
                    <div key={r.key} title={`${r.label}: $${r.value.toFixed(2)}`}
                      style={{ background: r.color, width: `${(r.value / revByTypeTotal) * 100}%` }} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {revByType.map(r => (
                    <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.86rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 2, background: r.color, display: 'inline-block' }} />
                        {r.label}
                      </span>
                      <span style={{ fontWeight: 700 }}>${r.value.toFixed(2)} <span style={{ color: 'var(--v3-muted)', fontWeight: 500 }}>({((r.value / revByTypeTotal) * 100).toFixed(0)}%)</span></span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="v3-card">
            <div className="v3-card-head"><h3>New Subscribers (30 days)</h3></div>
            <svg viewBox="0 0 600 140" style={{ width: '100%', height: 140 }}>
              {daily.map((d, i) => {
                const x = (i / 29) * 580 + 10;
                const h = (d.newSubs / maxSubs) * 110;
                return (
                  <rect key={d.date} x={x - 7} y={130 - h} width={14} height={h} fill="#2C3E5C" rx={2}>
                    <title>{d.date}: {d.newSubs} new</title>
                  </rect>
                );
              })}
              <line x1="0" y1="130" x2="600" y2="130" stroke="#ddd" strokeWidth="1" />
            </svg>
            <p style={{ margin: '8px 0 0', fontSize: '0.78rem', color: 'var(--v3-muted)' }}>
              {subs.new30d} new in last 30 days · peak day: {maxSubs}
            </p>
          </div>
        </div>

        {/* Top earning posts + Referrers */}
        <div className="v3-dash-cols" style={{ marginTop: 18 }}>
          <div className="v3-card">
            <div className="v3-card-head"><h3>Top Earning Posts</h3></div>
            {topPosts.length === 0 ? (
              <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem', margin: 0 }}>No post unlocks yet.</p>
            ) : (
              <table className="v3-bio-table">
                <thead>
                  <tr>
                    <th>Post</th>
                    <th style={{ width: 80, textAlign: 'right' }}>Unlocks</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topPosts.map(p => (
                    <tr key={p.postId}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.title}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--v3-muted)' }}>${p.price.toFixed(2)} each</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{p.unlocks}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>${p.revenue.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="v3-card">
            <div className="v3-card-head"><h3>Top Traffic Sources</h3></div>
            {referrers.length === 0 ? (
              <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem', margin: 0 }}>No traffic data yet.</p>
            ) : (
              <table className="v3-bio-table">
                <thead>
                  <tr>
                    <th>Source</th>
                    <th style={{ width: 100, textAlign: 'right' }}>Hits</th>
                  </tr>
                </thead>
                <tbody>
                  {referrers.map(([src, count]: any) => (
                    <tr key={src}>
                      <td style={{ fontSize: '0.86rem' }}>{src}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }}>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent transactions */}
        <div className="v3-card" style={{ marginTop: 18 }}>
          <div className="v3-card-head"><h3>Recent Transactions</h3></div>
          {recent.length === 0 ? (
            <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem', margin: 0 }}>No transactions yet.</p>
          ) : (
            <table className="v3-bio-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Description</th>
                  <th style={{ width: 100 }}>Status</th>
                  <th style={{ width: 100, textAlign: 'right' }}>Amount</th>
                  <th style={{ width: 120, textAlign: 'right' }}>Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t: any) => (
                  <tr key={t.id}>
                    <td style={{ fontSize: '0.82rem' }}>{(typeLabels[t.type]?.label) || t.type}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--v3-muted)' }}>{t.description || '—'}</td>
                    <td>
                      <span className={`v3-pill ${t.status === 'completed' ? 'success' : t.status === 'pending' ? 'warning' : ''}`}>
                        {t.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>${parseFloat(t.amount || 0).toFixed(2)}</td>
                    <td style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--v3-muted)' }}>
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  const renderPlaceholder = (title: string, blurb: string) => (
    <div>
      <h1 className="title">{title.toUpperCase()}</h1>
      <p className="welcome">{blurb}</p>
      <div className="v3-card" style={{ textAlign: 'center', padding: '60px 24px', marginTop: 18 }}>
        <p style={{ fontSize: '2.2rem', margin: '0 0 10px' }}>✨</p>
        <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--v3-ink)' }}>Coming soon</p>
        <p style={{ margin: '4px 0 0', fontSize: '0.86rem', color: 'var(--v3-muted)' }}>
          This section is on the roadmap and will land in a future update.
        </p>
      </div>
    </div>
  );

  const renderContent = () => (
    <div>
      {/* Upload */}
      <div className="av2-card">
        <p className="av2-section-label">New Post</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <DragDropUpload
            accept="image/*,video/*,audio/*"
            onFiles={(files) => setPostFile(files[0] || null)}
            title={postFile ? '✓ Selected' : 'Drop media here'}
            hint={postFile ? postFile.name.substring(0, 30) + (postFile.name.length > 30 ? '…' : '') : 'image · video · audio'}
            icon={postFile ? '✓' : '＋'}
          />
          <div>
            <input className="av2-input" placeholder="Title (optional)"
              value={newPost.title} onChange={e => setNewPost({ ...newPost, title: e.target.value })} />
            <textarea className="av2-input" placeholder="Caption…" rows={3}
              value={newPost.caption} onChange={e => setNewPost({ ...newPost, caption: e.target.value })}
              style={{ resize: 'none', marginBottom: 10 }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
          <label className="av2-toggle-label">
            <input type="checkbox" checked={newPost.isPremium}
              onChange={e => setNewPost({ ...newPost, isPremium: e.target.checked })} />
            Paid post
          </label>
          <label className="av2-toggle-label">
            <input type="checkbox" checked={newPost.isPinned}
              onChange={e => setNewPost({ ...newPost, isPinned: e.target.checked })} />
            Pin to top
          </label>
          {newPost.isPremium && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.78rem', color: '#777' }}>Unlock $</span>
              <input type="number" min="0" step="0.99" className="av2-input"
                value={newPost.price} onChange={e => setNewPost({ ...newPost, price: e.target.value })}
                style={{ width: 80, marginBottom: 0 }} />
            </div>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            {postStatus && <span style={{ fontSize: '0.82rem', color: postStatus.includes('fail') || postStatus.includes('Select') ? '#f87171' : '#4ade80' }}>{postStatus}</span>}
            <button className="btn btn-primary" onClick={handleUploadPost} style={{ padding: '10px 24px', fontSize: '0.8rem' }}>
              Post
            </button>
          </div>
        </div>
      </div>

      {/* Bundles */}
      <div className="av2-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p className="av2-section-label" style={{ marginBottom: 0 }}>Bundles ({bundles.length})</p>
          <button
            onClick={() => setEditingBundle({ title: '', description: '', price: '9.99', isPublished: true })}
            style={{ background: 'var(--v3-terracotta)', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
            + New Bundle
          </button>
        </div>

        {editingBundle && (
          <div style={{ background: C.editBg, borderRadius: 8, padding: 16, border: `1px solid ${C.border}`, marginBottom: 14 }}>
            <label className="av2-label">Title</label>
            <input className="av2-input" placeholder="Behind the scenes"
              value={editingBundle.title}
              onChange={e => setEditingBundle({ ...editingBundle, title: e.target.value })} />
            <label className="av2-label">Description</label>
            <textarea className="av2-input" rows={2} placeholder="What's inside?"
              value={editingBundle.description}
              onChange={e => setEditingBundle({ ...editingBundle, description: e.target.value })}
              style={{ resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.82rem', color: C.muted }}>Price $</span>
                <input type="number" min="0.99" step="0.01"
                  value={editingBundle.price}
                  onChange={e => setEditingBundle({ ...editingBundle, price: e.target.value })}
                  className="av2-input" style={{ width: 100, marginBottom: 0 }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: '0.82rem', color: C.muted }}>Discount %</span>
                <input type="number" min="0" max="90" step="1"
                  value={editingBundle.discountPercent || 0}
                  onChange={e => setEditingBundle({ ...editingBundle, discountPercent: e.target.value })}
                  className="av2-input" style={{ width: 80, marginBottom: 0 }} />
                {Number(editingBundle.discountPercent) > 0 && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--v3-terracotta, #c45c3a)' }}>
                    → ${(parseFloat(editingBundle.price || 0) * (1 - Number(editingBundle.discountPercent || 0) / 100)).toFixed(2)}
                  </span>
                )}
              </div>
              <label className="av2-toggle-label">
                <input type="checkbox"
                  checked={!!editingBundle.isPublished}
                  onChange={e => setEditingBundle({ ...editingBundle, isPublished: e.target.checked })} />
                Published
              </label>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="btn btn-primary" style={{ flex: 1, padding: '10px' }} onClick={saveBundle}>Save</button>
              <button className="btn btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={() => setEditingBundle(null)}>Cancel</button>
              {bundleStatus && <span style={{ fontSize: '0.78rem', color: bundleStatus.includes('fail') ? '#f87171' : '#4ade80' }}>{bundleStatus}</span>}
            </div>
          </div>
        )}

        {bundles.length === 0 ? (
          <p style={{ color: C.faint, fontSize: '0.85rem' }}>No bundles yet. Create one to group premium posts.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
            {bundles.map((b, idx) => (
              <div
                key={b.id}
                draggable
                onDragStart={() => { bundleDragIdx.current = idx; }}
                onDragOver={e => e.preventDefault()}
                onDrop={() => {
                  if (bundleDragIdx.current === null || bundleDragIdx.current === idx) return;
                  const next = reorderArray(bundles, bundleDragIdx.current, idx);
                  bundleDragIdx.current = null;
                  setBundles(next);
                  reorderCollections(next.map((b2, i) => ({ id: b2.id, sortOrder: i })));
                }}
                style={{ background: C.editBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'grab' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '0.92rem', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.title}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: '0.74rem', color: C.muted }}>
                      ${parseFloat(b.price).toFixed(2)} · {b.posts?.length ?? 0} post{(b.posts?.length ?? 0) === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span
                    onClick={() => togglePublished(b)}
                    title={b.isPublished ? 'Published — click to hide' : 'Draft — click to publish'}
                    style={{
                      cursor: 'pointer', fontSize: '0.62rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                      padding: '3px 8px', borderRadius: 4,
                      background: b.isPublished ? '#4ade80' : '#444',
                      color: b.isPublished ? '#000' : '#ccc',
                    }}>
                    {b.isPublished ? 'Live' : 'Draft'}
                  </span>
                </div>

                {/* Thumbnail strip */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, minHeight: 56 }}>
                  {(b.posts || []).slice(0, 4).map((p: any) => (
                    <div key={p.id} style={{ aspectRatio: '1/1', background: 'var(--v3-cream-deep)', borderRadius: 4, overflow: 'hidden' }}>
                      {p.mediaUrls?.[0]
                        ? <img src={`${SERVER_URL}${p.mediaUrls[0]}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: '#555' }}>📝</div>}
                    </div>
                  ))}
                  {(b.posts?.length ?? 0) === 0 && (
                    <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.faint, fontSize: '0.72rem' }}>
                      No posts assigned
                    </div>
                  )}
                </div>

                {b.description && (
                  <p style={{ margin: 0, fontSize: '0.76rem', color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {b.description}
                  </p>
                )}

                <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                  <button onClick={() => setEditingBundle({ ...b, price: String(b.price) })}
                    style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 0', color: C.muted, cursor: 'pointer', fontSize: '0.74rem' }}>
                    Edit
                  </button>
                  <button onClick={() => handleDeleteBundle(b.id)}
                    style={{ flex: 1, background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '6px 0', color: '#f87171', cursor: 'pointer', fontSize: '0.74rem' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Post list */}
      <div className="av2-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p className="av2-section-label" style={{ marginBottom: 0 }}>All Posts ({vaultPosts.length})</p>
          <button onClick={fetchVaultPosts} style={{ background: 'none', border: '1px solid #222', borderRadius: 6, padding: '4px 12px', color: '#555', cursor: 'pointer', fontSize: '0.75rem' }}>
            Refresh
          </button>
        </div>
        {vaultLoading ? (
          <p style={{ color: C.faint, fontSize: '0.85rem' }}>Loading…</p>
        ) : vaultPosts.length === 0 ? (
          <p style={{ color: C.faint, fontSize: '0.85rem' }}>No posts yet. Upload your first one above.</p>
        ) : vaultPosts.map((post, idx) => (
          <div
            key={post.id}
            className="av2-post-row"
            draggable
            onDragStart={() => { postDragIdx.current = idx; }}
            onDragOver={e => e.preventDefault()}
            onDrop={() => {
              if (postDragIdx.current === null || postDragIdx.current === idx) return;
              const next = reorderArray(vaultPosts, postDragIdx.current, idx);
              postDragIdx.current = null;
              setVaultPosts(next);
              reorderPosts(next.map((p, i) => ({ id: p.id, sortOrder: i })));
            }}
            style={{ cursor: 'grab' }}
          >
            <div className="av2-post-thumb">
              {post.mediaUrls?.[0]
                ? <img src={`${SERVER_URL}${post.mediaUrls[0]}`} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: '1.2rem' }}>📝</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: C.text }}>
                {post.title || post.caption || 'Untitled'}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: '0.72rem', color: C.muted }}>
                {new Date(post.createdAt).toLocaleDateString()} · {post.likesCount} likes
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center', position: 'relative' }}>
              {post.collectionId ? (
                <button
                  onClick={() => handleAssignToBundle(post.id, null)}
                  className="av2-tag-btn purple"
                  title="Remove from bundle">
                  📦 {bundles.find(b => b.id === post.collectionId)?.title?.substring(0, 12) || 'Bundle'} ✕
                </button>
              ) : (
                <>
                  <button
                    onClick={() => setAssigningPostId(assigningPostId === post.id ? null : post.id)}
                    className="av2-tag-btn">
                    📦 Add to bundle
                  </button>
                  {assigningPostId === post.id && (
                    <div style={{
                      position: 'absolute', top: '100%', right: 0, marginTop: 4, zIndex: 50,
                      background: C.bg, border: `1px solid ${C.border}`, borderRadius: 8,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: 200, maxHeight: 240, overflowY: 'auto',
                    }}>
                      {bundles.length === 0 ? (
                        <p style={{ margin: 0, padding: '10px 14px', fontSize: '0.78rem', color: C.muted }}>
                          No bundles yet
                        </p>
                      ) : bundles.map(b => (
                        <button key={b.id} onClick={() => handleAssignToBundle(post.id, b.id)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '9px 14px', background: 'none', border: 'none',
                            color: C.text, cursor: 'pointer', fontSize: '0.8rem',
                            borderBottom: `1px solid ${C.borderFaint}`,
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = C.editBg)}
                          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          {b.title} <span style={{ color: C.muted, fontSize: '0.72rem' }}>· ${parseFloat(b.price).toFixed(2)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
              <button onClick={() => togglePostField(post.id, 'isPremium', post.isPremium)} className={`av2-tag-btn ${post.isPremium ? 'purple' : ''}`}>
                {post.isPremium ? `🔒 Paid${post.price > 0 ? ` $${post.price}` : ''}` : 'Free'}
              </button>
              <button onClick={() => togglePostField(post.id, 'isPinned', post.isPinned)} className={`av2-tag-btn ${post.isPinned ? 'green' : ''}`}>
                {post.isPinned ? '📌' : 'Pin'}
              </button>
              <button onClick={() => handleDeletePost(post.id)} className="av2-tag-btn red">
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div>
      {/* Profile */}
      <div className="av2-card">
        <p className="av2-section-label">Profile</p>
        <label className="av2-label">Display Name</label>
        <input className="av2-input" name="siteTitle" value={formData.siteTitle} onChange={handleChange} />
        <label className="av2-label">Short Bio (shown on home page)</label>
        <textarea className="av2-input" name="homeBio" value={formData.homeBio} onChange={handleChange} rows={2} style={{ resize: 'vertical' }} />
        <label className="av2-label">Full Bio (About page)</label>
        <textarea className="av2-input" name="bio" value={formData.bio} onChange={handleChange} rows={5} style={{ resize: 'vertical' }} />
      </div>

      {/* Billing descriptor — required for payment processor compliance */}
      <div className="av2-card">
        <p className="av2-section-label">Discreet Billing Descriptor</p>
        <p style={{ fontSize: '0.82rem', color: 'var(--v3-ink-soft)', margin: '0 0 12px', lineHeight: 1.55 }}>
          The short label that appears on your fans' bank/card statements for every charge.
          Required by adult payment processors (Segpay, CCBill, NOWPayments). Must be
          <strong> neutral and non-revealing</strong> — anything implying adult content
          will be rejected during onboarding. Max 22 characters.
        </p>
        <input
          className="av2-input"
          name="billingDescriptor"
          value={formData.billingDescriptor || ''}
          onChange={handleChange}
          maxLength={22}
          placeholder="CRISTINA"
          spellCheck={false}
          style={{ fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: 1 }}
        />
        <p style={{ fontSize: '0.74rem', color: 'var(--v3-muted)', margin: '6px 0 0' }}>
          Statement preview: <strong style={{ fontFamily: 'monospace' }}>
            {(formData.billingDescriptor || 'CRISTINA').toUpperCase()}*ORDER123
          </strong>
          {(formData.billingDescriptor || '').length > 0 && (
            <span style={{ marginLeft: 10, color: (formData.billingDescriptor || '').length > 22 ? 'var(--v3-danger)' : 'var(--v3-success)' }}>
              {(formData.billingDescriptor || '').length}/22 chars
            </span>
          )}
        </p>
      </div>

      {/* Fanvue — dedicated monetization card */}
      <div className="v3-fanvue-card">
        <div className="ico">💎</div>
        <div className="body">
          <h3>Fanvue Integration</h3>
          <p className="sub">
            Adding your Fanvue URL adds a <strong>"Watch on Fanvue"</strong> option to the "Get Premium Access"
            modal — a trusted second path for fans who prefer Fanvue's checkout.
            Leave blank to hide that option entirely.
          </p>
          <input
            type="url"
            name="fanvueUrl"
            value={formData.fanvueUrl || ''}
            onChange={handleChange}
            placeholder="https://fanvue.com/your-handle"
            spellCheck={false}
          />
          <div className="actions">
            <span className={`status-pill ${formData.fanvueUrl ? 'live' : 'empty'}`}>
              {formData.fanvueUrl ? '● Live in modal' : '○ Not connected'}
            </span>
            {formData.fanvueUrl && (
              <a className="test-link"
                 href={formData.fanvueUrl}
                 target="_blank"
                 rel="noreferrer">
                Test link ↗
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Welcome PPV — auto-send a teaser to every new fan */}
      <div className="v3-fanvue-card">
        <div className="ico">📩</div>
        <div className="body">
          <h3>Welcome PPV</h3>
          <p className="sub">
            Drops a locked teaser into every new fan's DM thread the moment they register.
            Typical conversion: 5–10% within the first session.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0 12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={!!formData.welcomeEnabled}
                onChange={(e) => setFormData((f: any) => ({ ...f, welcomeEnabled: e.target.checked }))}
              />
              Enabled
            </label>
          </div>
          <input
            type="text"
            name="welcomePpvText"
            placeholder="Caption (optional) — e.g. 'Just for you, baby 💋'"
            value={formData.welcomePpvText || ''}
            onChange={handleChange}
            style={{ marginBottom: 8 }}
          />
          <input
            type="url"
            name="welcomeMediaUrl"
            placeholder="Teaser media URL (upload via Gallery, paste path)"
            value={formData.welcomeMediaUrl || ''}
            onChange={handleChange}
            style={{ marginBottom: 8 }}
            spellCheck={false}
          />
          <input
            type="number"
            min="0.99"
            step="0.01"
            name="welcomePpvPrice"
            placeholder="Price (e.g. 4.99)"
            value={formData.welcomePpvPrice || ''}
            onChange={handleChange}
          />
          <div className="actions" style={{ marginTop: 10 }}>
            <span className={`status-pill ${formData.welcomeEnabled ? 'live' : 'empty'}`}>
              {formData.welcomeEnabled ? '● Live' : '○ Off'}
            </span>
          </div>
        </div>
      </div>

      {/* Media moved → see Gallery tab in the sidebar. */}

      {/* Appearance */}
      <div className="av2-card">
        <p className="av2-section-label">Appearance</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label className="av2-label">Primary Color</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" name="theme.primaryColor" value={formData.theme?.primaryColor || '#ffffff'} onChange={handleChange}
                style={{ width: 40, height: 40, padding: 2, border: '1px solid #1e1e1e', borderRadius: 6, background: 'none', cursor: 'pointer' }} />
              <input className="av2-input" name="theme.primaryColor" value={formData.theme?.primaryColor || '#ffffff'} onChange={handleChange} style={{ marginBottom: 0 }} />
            </div>
          </div>
          <div>
            <label className="av2-label">Background Color</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" name="theme.backgroundColor" value={formData.theme?.backgroundColor || '#0a0a0a'} onChange={handleChange}
                style={{ width: 40, height: 40, padding: 2, border: '1px solid #1e1e1e', borderRadius: 6, background: 'none', cursor: 'pointer' }} />
              <input className="av2-input" name="theme.backgroundColor" value={formData.theme?.backgroundColor || '#0a0a0a'} onChange={handleChange} style={{ marginBottom: 0 }} />
            </div>
          </div>
        </div>
        <label className="av2-label" style={{ marginTop: 14 }}>Font</label>
        <select className="av2-input" name="theme.fontFamily" value={formData.theme?.fontFamily} onChange={handleChange}>
          <option value="'Didot', serif">Luxury — Didot</option>
          <option value="'Inter', sans-serif">Modern — Inter</option>
          <option value="'Playfair Display', serif">Classic — Playfair</option>
          <option value="'System-UI', sans-serif">Minimal — System</option>
        </select>
      </div>

      {/* SEO */}
      <div className="av2-card">
        <p className="av2-section-label">SEO & Meta</p>
        <label className="av2-label">Page Title (browser tab)</label>
        <input className="av2-input" name="seo.metaTitle" value={formData.seo?.metaTitle || ''} onChange={handleChange} />
        <label className="av2-label">Meta Description</label>
        <textarea className="av2-input" name="seo.metaDescription" value={formData.seo?.metaDescription || ''} onChange={handleChange} rows={3} style={{ resize: 'vertical' }} />
        <label className="av2-label">Favicon</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <DragDropUpload
            accept="image/*"
            onFiles={(files) => handleFilesUpload(files, 'favicon')}
            title={formData.seo?.favicon ? 'Replace favicon' : 'Drop favicon'}
            hint="32×32 PNG or ICO works best"
            icon="✦"
            style={{ width: 240, padding: '16px 20px' }}
          />
          {formData.seo?.favicon && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src={formData.seo.favicon} style={{ width: 40, height: 40, objectFit: 'contain', border: '1px solid var(--v3-line)', borderRadius: 6, padding: 4 }} alt="" />
              <span style={{ fontSize: '0.78rem', color: 'var(--v3-muted)' }}>current</span>
            </div>
          )}
        </div>
      </div>

      {/* Social links */}
      <div className="av2-card">
        <p className="av2-section-label">Social Links</p>
        <label className="av2-label">Instagram</label>
        <input className="av2-input" name="links.instagram" value={formData.links?.instagram || ''} onChange={handleChange} placeholder="https://instagram.com/…" />
        <label className="av2-label">Twitter / X</label>
        <input className="av2-input" name="links.twitter" value={formData.links?.twitter || ''} onChange={handleChange} placeholder="https://x.com/…" />
        <label className="av2-label">TikTok</label>
        <input className="av2-input" name="links.tiktok" value={formData.links?.tiktok || ''} onChange={handleChange} placeholder="https://tiktok.com/@…" />
      </div>

      {/* Blog */}
      <div className="av2-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p className="av2-section-label" style={{ marginBottom: 0 }}>Blog Posts</p>
          <button onClick={() => setEditingPost({ title: '', excerpt: '', content: '' })}
            style={{ background: 'var(--v3-terracotta)', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
            + New Post
          </button>
        </div>
        {editingPost ? (
          <div style={{ background: C.editBg, borderRadius: 8, padding: 16, border: `1px solid ${C.border}` }}>
            <label className="av2-label">Title</label>
            <input className="av2-input" value={editingPost.title} onChange={e => setEditingPost({ ...editingPost, title: e.target.value })} />
            <label className="av2-label">Excerpt</label>
            <textarea className="av2-input" rows={2} value={editingPost.excerpt} onChange={e => setEditingPost({ ...editingPost, excerpt: e.target.value })} style={{ resize: 'vertical' }} />
            <label className="av2-label">Content</label>
            <textarea className="av2-input" rows={5} value={editingPost.content} onChange={e => setEditingPost({ ...editingPost, content: e.target.value })} style={{ resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" style={{ flex: 1, padding: '10px' }} onClick={saveBlogPost}>Save</button>
              <button className="btn btn-secondary" style={{ flex: 1, padding: '10px' }} onClick={() => setEditingPost(null)}>Cancel</button>
            </div>
          </div>
        ) : formData.blog?.length === 0 ? (
          <p style={{ color: '#444', fontSize: '0.85rem' }}>No blog posts yet.</p>
        ) : formData.blog?.map((post: any) => (
          <div key={post.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
            <div>
              <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600 }}>{post.title}</p>
              <p style={{ margin: '2px 0 0', fontSize: '0.76rem', color: C.muted }}>{(post.excerpt || '').substring(0, 60)}…</p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <button onClick={() => setEditingPost(post)} style={{ background: 'none', border: 'none', color: 'var(--v3-terracotta)', cursor: 'pointer', fontSize: '0.82rem' }}>Edit</button>
              <button onClick={() => deleteBlogPost(post.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.82rem' }}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {/* Security & Maintenance */}
      <div className="av2-card">
        <p className="av2-section-label">Security</p>
        <label className="av2-label">New Password (leave blank to keep current)</label>
        <input className="av2-input" type="password" name="newPassword" placeholder="Enter new password…" onChange={handleChange} />

        <p className="av2-section-label" style={{ marginTop: 20 }}>Maintenance Mode</p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0' }}>
          <div>
            <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600 }}>Show "Coming Soon" to public</p>
            <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: C.muted }}>Admin and login remain accessible.</p>
          </div>
          <input type="checkbox" name="settings.maintenanceMode" checked={!!formData.settings?.maintenanceMode}
            onChange={handleChange} style={{ width: 40, height: 22, cursor: 'pointer', accentColor: 'var(--v3-terracotta)' }} />
        </div>
      </div>

      {/* Save bar */}
      <div className="av2-save-bar">
        {status && <span style={{ fontSize: '0.85rem', color: status.includes('Error') ? '#f87171' : '#4ade80', fontWeight: 600 }}>{status}</span>}
        <button className="btn btn-primary" onClick={handleSave} style={{ padding: '12px 40px', fontSize: '0.85rem' }}>
          Save Changes
        </button>
      </div>
    </div>
  );

  // ── Layout ───────────────────────────────────────────────────────────────────

  const avatar = config?.images?.hero || config?.images?.heroSlider?.[0];
  const handle = (config?.links?.instagram?.split('/').filter(Boolean).pop()) || (config?.siteTitle?.toLowerCase() || 'cristina') + '.style';

  return (
    <div className="v3-admin">
      {/* Mobile drawer backdrop — taps to close the sidebar */}
      {mobileNavOpen && (
        <div
          className="v3-admin-mobile-backdrop"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      {/* Sidebar — slides in as drawer on mobile */}
      <aside className={`v3-admin-side ${mobileNavOpen ? 'mobile-open' : ''}`}>
        <div className="v3-admin-brand">
          {config?.logoUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '4px 0' }}>
              <img
                src={config.logoUrl.startsWith('http') ? config.logoUrl : `${SERVER_URL}${config.logoUrl}`}
                alt={config?.siteTitle || 'Logo'}
                style={{ maxHeight: 84, maxWidth: 140, objectFit: 'contain' }}
              />
              <small style={{ display: 'block', fontSize: '0.66rem', letterSpacing: 2, color: 'var(--v3-muted)' }}>BIO ADMIN · @{handle}</small>
            </div>
          ) : (
            <>
              {(config?.siteTitle || 'CRISTINA').toUpperCase()} <span style={{ color: 'var(--v3-muted)' }}>|</span> <small>BIO ADMIN</small>
            </>
          )}
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setMobileNavOpen(false); }}
              className={`v3-admin-nav-btn ${activeTab === t.id ? 'active' : ''}`}>
              <span style={{ width: 20, textAlign: 'center' }}>{t.icon}</span>
              <span>{t.label}</span>
              {t.badge && activeTab === t.id && <span className="badge">{t.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="v3-admin-side-footer">
          <button onClick={() => window.open('/', '_blank')}>View Live Website</button>
          <button onClick={toggleTheme} style={{ marginTop: 6 }}>
            {isDark ? '☀ Light Mode' : '☾ Dark Mode'}
          </button>
          <button onClick={() => { localStorage.removeItem('adminToken'); navigate('/login'); }}
            style={{ marginTop: 6, background: 'none', border: 'none', color: 'var(--v3-muted)' }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="v3-admin-main">
        {/* Top bar */}
        <div className="v3-admin-top">
          {/* Hamburger — mobile only (CSS hides on desktop) */}
          <button
            className="v3-admin-burger"
            aria-label="Open menu"
            onClick={() => setMobileNavOpen(o => !o)}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="v3-admin-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input placeholder="Search" />
          </div>
          <div className="right">
            <AdminNotificationBell
              onSelectFan={(fanId) => {
                setActiveTab('audience');
                setDrawerFanId(fanId);
              }}
            />
            <div className="v3-admin-bell" title="Help">?</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', background: '#ddd' }}>
                {avatar && <img src={avatar.startsWith('http') ? avatar : `${SERVER_URL}${avatar}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
              </div>
              <span style={{ fontSize: '0.85rem', color: 'var(--v3-ink)' }}>@{handle}</span>
            </div>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'overview'   && renderOverview()}
        {activeTab === 'biobuilder' && renderBioBuilder()}
        {activeTab === 'analytics'  && renderAnalytics()}
        {activeTab === 'content'    && renderContent()}
        {activeTab === 'gallery'    && renderGallery()}
        {activeTab === 'messages'   && <AdminMessages isDark={isDark} />}
        {activeTab === 'broadcast'  && <AdminBroadcast isDark={isDark} />}
        {activeTab === 'audience'   && renderAudience()}
        {activeTab === 'branding'   && renderPlaceholder('Branding', 'Logo, colors, fonts, domain — make the site feel like you.')}
        {activeTab === 'aichatbot'  && <AdminAiChatbot isDark={isDark} />}
        {activeTab === 'settings'   && renderSettings()}
        {activeTab === 'support'    && renderPlaceholder('Support', 'Docs, FAQs, and a direct line to the team.')}
      </main>

      {/* Per-fan detail drawer — opened from Audience tab row click */}
      <FanDetailDrawer
        fanId={drawerFanId}
        onClose={() => setDrawerFanId(null)}
        onMutated={() => { fetchAudience(); }}
      />
    </div>
  );
};

export default Admin;
