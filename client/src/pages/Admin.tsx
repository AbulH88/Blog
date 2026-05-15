import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  updateConfig, uploadImage, SERVER_URL, createPost, updatePost, deletePost,
  CREATOR_SLUG, getCreatorAnalytics,
  getCollections, createCollection, updateCollection, deleteCollection,
  assignPostToCollection, removePostFromCollection,
} from '../api';
import AdminMessages from './AdminMessages';
import AdminBroadcast from './AdminBroadcast';
import DragDropUpload from '../components/DragDropUpload';

type Tab =
  | 'overview' | 'biobuilder' | 'analytics' | 'content' | 'gallery'
  | 'messages' | 'broadcast' | 'audience' | 'branding'
  | 'settings' | 'support';

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

  const handleFileUpload = async (e: any, type: 'gallery' | 'slider' | 'favicon') => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus('Uploading…');
    const res = await uploadImage(file);
    if (res.url) {
      if (type === 'favicon') {
        setFormData({ ...formData, seo: { ...formData.seo, favicon: res.url } });
      } else if (type === 'gallery') {
        setFormData({ ...formData, images: { ...formData.images, gallery: [...formData.images.gallery, res.url] } });
      } else if (type === 'slider') {
        setFormData({ ...formData, images: { ...formData.images, heroSlider: [...(formData.images.heroSlider || []), res.url] } });
      }
      setStatus('Uploaded!');
    }
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
        isPublished: editingBundle.isPublished,
      });
    } else {
      res = await createCollection({
        creatorSlug: CREATOR_SLUG,
        title: editingBundle.title || 'Untitled Bundle',
        description: editingBundle.description || '',
        price: parseFloat(editingBundle.price) || 9.99,
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

  const renderOverview = () => {
    const traffic = analytics?.traffic || { totalHits: 0, referrers: {} };
    const referrers = traffic.referrers || {};
    const totalHits = traffic.totalHits || 0;
    const topSource = Object.entries(referrers).sort((a: any, b: any) => b[1] - a[1])[0];
    const activeMembers = analytics?.subscribers?.active ?? 0;
    const revenue = analytics?.revenue?.total || 0;

    return (
      <div>
        <h1 className="title">DASHBOARD</h1>
        <p className="welcome">Welcome back, {config?.siteTitle || 'Creator'}! ✨</p>
        <p style={{ margin: '0 0 22px', fontSize: '0.92rem', color: 'var(--v3-muted)' }}>
          Manage your links and track performance.
        </p>

        {/* Stat cards */}
        <div className="v3-stat-grid">
          <div className="v3-stat pink">
            <span className="label">Total Clicks (30 Days)</span>
            <span className="value">{totalHits.toLocaleString()}</span>
            <span style={{ fontSize: '0.78rem' }}>📈</span>
            <div className="icon-bubble">↗</div>
          </div>
          <div className="v3-stat dark">
            <span className="label">Active Members</span>
            <span className="value">{activeMembers.toLocaleString()}</span>
            <span style={{ fontSize: '0.74rem', opacity: 0.7 }}>Live subscribers</span>
            <div className="icon-bubble" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff' }}>👥</div>
          </div>
          <div className="v3-stat peach">
            <span className="label">Total Revenue</span>
            <span className="value">${revenue.toFixed(2)}</span>
            <span style={{ fontSize: '0.78rem' }}>This month</span>
            <div className="icon-bubble">💰</div>
          </div>
          <div className="v3-stat" style={{ background: '#F4E4E0' }}>
            <span className="label">Top Source</span>
            <span className="value" style={{ fontSize: '1.3rem' }}>{topSource ? String(topSource[0]).slice(0, 14) : '—'}</span>
            <span style={{ fontSize: '0.78rem', color: 'rgba(0,0,0,0.6)' }}>{topSource ? `${topSource[1]} hits` : 'No data yet'}</span>
            <div className="icon-bubble">🌐</div>
          </div>
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
                const res = await uploadImage(files[0]);
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
    const slider: string[] = formData.images?.heroSlider || [];
    const gallery: string[] = formData.images?.gallery || [];

    return (
      <div>
        <h1 className="title">GALLERY</h1>
        <p className="welcome">Your visual content — hero slider on the home page, and the gallery grid that also feeds the Instagram-style sidebar.</p>

        {/* Hero Slider */}
        <div className="av2-card">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <p className="av2-section-label" style={{ marginBottom: 0 }}>Hero Slider Images ({slider.length})</p>
            <span style={{ fontSize: '0.74rem', color: 'var(--v3-muted)' }}>auto-cycles on home page · 16:9 landscape · 1920×1080 ideal</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--v3-muted)', margin: '0 0 12px' }}>
            Add 2 or more to enable the cross-fading slider with dot navigation. Portrait photos get cropped — use landscape.
          </p>

          <DragDropUpload
            accept="image/*"
            multiple
            onFiles={(files) => handleFilesUpload(files, 'slider')}
            title="Drop hero images here"
            hint="or click to browse — JPG, PNG, WebP"
            icon="🖼"
            style={{ marginBottom: 14 }}
          />

          {slider.length > 0 && (
            <div className="av2-img-grid">
              {slider.map((img: string, idx: number) => (
                <div key={idx} style={{ position: 'relative' }}>
                  <img src={img} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 10 }} />
                  <button onClick={() => removeImage('slider', idx)} className="av2-img-remove">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gallery */}
        <div className="av2-card">
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <p className="av2-section-label" style={{ marginBottom: 0 }}>Gallery Images ({gallery.length})</p>
            <span style={{ fontSize: '0.74rem', color: 'var(--v3-muted)' }}>shown on /gallery + home page IG feed · 1:1 square · 1080×1080 ideal</span>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--v3-muted)', margin: '0 0 12px' }}>
            Square (1:1) photos look best. Add 6–9 to fill the home page feed grid.
          </p>

          <DragDropUpload
            accept="image/*"
            multiple
            onFiles={(files) => handleFilesUpload(files, 'gallery')}
            title="Drop gallery photos here"
            hint="or click to browse multiple"
            icon="📷"
            style={{ marginBottom: 14 }}
          />

          {gallery.length > 0 && (
            <div className="av2-img-grid">
              {gallery.map((img: string, idx: number) => (
                <div key={idx} style={{ position: 'relative' }}>
                  <img src={img} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 10 }} />
                  <button onClick={() => removeImage('gallery', idx)} className="av2-img-remove">✕</button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="av2-save-bar">
          {status && <span style={{ fontSize: '0.85rem', color: status.includes('Error') || status.includes('failed') ? 'var(--v3-danger)' : 'var(--v3-success)', fontWeight: 600 }}>{status}</span>}
          <button className="v3-btn v3-btn-primary" onClick={handleSave} style={{ padding: '12px 30px' }}>
            Save Changes
          </button>
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
            {bundles.map(b => (
              <div key={b.id} style={{ background: C.editBg, border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        ) : vaultPosts.map(post => (
          <div key={post.id} className="av2-post-row">
            <div className="av2-post-thumb">
              {post.mediaUrls?.[0]
                ? <img src={`${SERVER_URL}${post.mediaUrls[0]}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
      {/* Sidebar */}
      <aside className="v3-admin-side">
        <div className="v3-admin-brand">
          {config?.logoUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '4px 0 8px' }}>
              <img
                src={config.logoUrl.startsWith('http') ? config.logoUrl : `${SERVER_URL}${config.logoUrl}`}
                alt={config?.siteTitle || 'Logo'}
                style={{ maxHeight: 130, maxWidth: 180, objectFit: 'contain' }}
              />
              <small style={{ display: 'block' }}>BIO ADMIN</small>
            </div>
          ) : (
            <>
              {(config?.siteTitle || 'CRISTINA').toUpperCase()} <span style={{ color: 'var(--v3-muted)' }}>|</span> <small>BIO ADMIN</small>
            </>
          )}
        </div>

        <div className="v3-admin-profile">
          <div className="avatar">
            {avatar && <img src={avatar.startsWith('http') ? avatar : `${SERVER_URL}${avatar}`} alt="" />}
          </div>
          <div className="handle">@{handle}</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
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
          <div className="v3-admin-search">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input placeholder="Search" />
          </div>
          <div className="right">
            <div className="v3-admin-bell">🔔<span className="dot">3</span></div>
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
        {activeTab === 'analytics'  && renderPlaceholder('Analytics', 'Deeper traffic, click, and conversion analytics with charts.')}
        {activeTab === 'content'    && renderContent()}
        {activeTab === 'gallery'    && renderGallery()}
        {activeTab === 'messages'   && <AdminMessages isDark={isDark} />}
        {activeTab === 'broadcast'  && <AdminBroadcast isDark={isDark} />}
        {activeTab === 'audience'   && renderPlaceholder('Audience', 'Subscriber list, tiers, segments, and bulk actions.')}
        {activeTab === 'branding'   && renderPlaceholder('Branding', 'Logo, colors, fonts, domain — make the site feel like you.')}
        {activeTab === 'settings'   && renderSettings()}
        {activeTab === 'support'    && renderPlaceholder('Support', 'Docs, FAQs, and a direct line to the team.')}
      </main>
    </div>
  );
};

export default Admin;
