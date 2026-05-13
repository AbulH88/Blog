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

type Tab = 'overview' | 'content' | 'messages' | 'broadcast' | 'settings';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'overview',  label: 'Overview',  icon: '◻' },
  { id: 'content',   label: 'Content',   icon: '◈' },
  { id: 'messages',  label: 'Messages',  icon: '◎' },
  { id: 'settings',  label: 'Settings',  icon: '◉' },
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

    return (
      <div>
        <div className="av2-stat-grid">
          <div className="av2-stat">
            <p className="av2-stat-label">Active Members</p>
            <p className="av2-stat-value">{analytics?.subscribers?.active ?? '—'}</p>
          </div>
          <div className="av2-stat">
            <p className="av2-stat-label">Total Revenue</p>
            <p className="av2-stat-value">${(analytics?.revenue?.total || 0).toFixed(2)}</p>
          </div>
          <div className="av2-stat">
            <p className="av2-stat-label">Page Views</p>
            <p className="av2-stat-value">{totalHits.toLocaleString()}</p>
          </div>
          <div className="av2-stat">
            <p className="av2-stat-label">Top Source</p>
            <p className="av2-stat-value" style={{ fontSize: '1.1rem' }}>{topSource ? topSource[0] : '—'}</p>
          </div>
        </div>

        <div className="av2-card">
          <p className="av2-section-label">Traffic Breakdown</p>
          {Object.keys(referrers).length === 0 ? (
            <p style={{ color: C.faint, fontSize: '0.85rem' }}>No traffic recorded yet. Once fans visit your page, data will appear here.</p>
          ) : Object.entries(referrers).map(([src, count]: any) => {
            const pct = totalHits > 0 ? Math.round((count / totalHits) * 100) : 0;
            return (
              <div key={src} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 5 }}>
                  <span style={{ color: C.text }}>{src}</span>
                  <span style={{ color: C.muted }}>{pct}% · {count}</span>
                </div>
                <div style={{ height: 4, background: C.progressBg, borderRadius: 2 }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: '#7c3aed', borderRadius: 2 }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => window.open('/', '_blank')} className="btn btn-secondary"
            style={{ flex: 1, padding: '12px', fontSize: '0.8rem', letterSpacing: 1 }}>
            Preview Site ↗
          </button>
          <button onClick={() => setActiveTab('content')} className="btn btn-primary"
            style={{ flex: 1, padding: '12px', fontSize: '0.8rem', letterSpacing: 1 }}>
            Upload Content
          </button>
        </div>
      </div>
    );
  };

  const renderContent = () => (
    <div>
      {/* Upload */}
      <div className="av2-card">
        <p className="av2-section-label">New Post</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label className="av2-upload-area">
            <input type="file" accept="image/*,video/*,audio/*" style={{ display: 'none' }}
              onChange={e => setPostFile(e.target.files?.[0] || null)} />
            <span style={{ fontSize: '1.6rem' }}>{postFile ? '✓' : '+'}</span>
            <span style={{ fontSize: '0.78rem', color: C.muted, marginTop: 6 }}>
              {postFile ? postFile.name.substring(0, 20) + '…' : 'Pick media'}
            </span>
          </label>
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
            Members Only
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
            style={{ background: '#7c3aed', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
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
                    <div key={p.id} style={{ aspectRatio: '1/1', background: '#1a1a1a', borderRadius: 4, overflow: 'hidden' }}>
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
                {post.isPremium ? '🔒 Members' : 'Free'}
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

      {/* Media */}
      <div className="av2-card">
        <p className="av2-section-label">Hero Slider Images</p>
        <label className="av2-upload-area" style={{ marginBottom: 14 }}>
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'slider')} />
          <span style={{ fontSize: '1.4rem' }}>+</span>
          <span style={{ fontSize: '0.76rem', color: '#555', marginTop: 4 }}>Add slider image</span>
        </label>
        {(formData.images?.heroSlider || []).length > 0 && (
          <div className="av2-img-grid">
            {formData.images.heroSlider.map((img: string, idx: number) => (
              <div key={idx} style={{ position: 'relative' }}>
                <img src={img} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8 }} />
                <button onClick={() => removeImage('slider', idx)} className="av2-img-remove">✕</button>
              </div>
            ))}
          </div>
        )}

        <p className="av2-section-label" style={{ marginTop: 20 }}>Gallery Images</p>
        <label className="av2-upload-area" style={{ marginBottom: 14 }}>
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'gallery')} />
          <span style={{ fontSize: '1.4rem' }}>+</span>
          <span style={{ fontSize: '0.76rem', color: '#555', marginTop: 4 }}>Add gallery image</span>
        </label>
        {(formData.images?.gallery || []).length > 0 && (
          <div className="av2-img-grid">
            {formData.images.gallery.map((img: string, idx: number) => (
              <div key={idx} style={{ position: 'relative' }}>
                <img src={img} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 8 }} />
                <button onClick={() => removeImage('gallery', idx)} className="av2-img-remove">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

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
        <label className="av2-upload-area" style={{ width: 'fit-content', padding: '10px 20px', flexDirection: 'row', gap: 10 }}>
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => handleFileUpload(e, 'favicon')} />
          <span>Upload favicon</span>
          {formData.seo?.favicon && <img src={formData.seo.favicon} style={{ width: 24, height: 24, objectFit: 'contain' }} alt="" />}
        </label>
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
            style={{ background: '#7c3aed', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
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
              <button onClick={() => setEditingPost(post)} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: '0.82rem' }}>Edit</button>
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
            onChange={handleChange} style={{ width: 40, height: 22, cursor: 'pointer', accentColor: '#7c3aed' }} />
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

  return (
    <div className={`av2-layout ${isDark ? '' : 'light'}`}>
      {/* Desktop sidebar */}
      <aside className="av2-sidebar">
        <div style={{ padding: '0 24px 28px', borderBottom: `1px solid ${C.borderFaint}` }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '0.72rem', letterSpacing: 4, color: C.sidebarText, textTransform: 'uppercase' }}>Creator</p>
          <p style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', letterSpacing: 1, color: C.text }}>Dashboard</p>
        </div>

        <nav style={{ padding: '16px 0', flex: 1 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`av2-nav-btn ${activeTab === t.id ? 'active' : ''}`}>
              <span style={{ fontSize: '1rem', width: 22, textAlign: 'center' }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: `1px solid ${C.borderFaint}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={toggleTheme}
            style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px', color: C.muted, cursor: 'pointer', fontSize: '0.75rem', width: '100%' }}>
            {isDark ? '☀ Light Mode' : '☾ Dark Mode'}
          </button>
          <button onClick={() => setActiveTab('broadcast')}
            style={{
              background: activeTab === 'broadcast' ? '#7c3aed' : 'none',
              border: `1px solid ${activeTab === 'broadcast' ? '#7c3aed' : C.border}`,
              borderRadius: 8, padding: '9px',
              color: activeTab === 'broadcast' ? '#fff' : C.muted,
              cursor: 'pointer', fontSize: '0.75rem', width: '100%',
            }}>
            📣 Broadcast
          </button>
          <button onClick={() => window.open('/', '_blank')}
            style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px', color: C.muted, cursor: 'pointer', fontSize: '0.75rem', width: '100%' }}>
            View Site ↗
          </button>
          <button onClick={() => { localStorage.removeItem('adminToken'); navigate('/login'); }}
            style={{ background: 'none', border: 'none', padding: '9px', color: C.logoutText, cursor: 'pointer', fontSize: '0.75rem', width: '100%' }}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="av2-main">
        <div className="av2-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ margin: 0, fontSize: '0.68rem', letterSpacing: 3, textTransform: 'uppercase', color: C.faint, fontWeight: 700 }}>
            {activeTab}
          </p>
          <button onClick={toggleTheme}
            style={{ display: 'none', background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '6px 12px', color: C.muted, cursor: 'pointer', fontSize: '0.75rem' }}
            className="av2-theme-toggle-mobile">
            {isDark ? '☀' : '☾'}
          </button>
        </div>

        {activeTab === 'overview'  && renderOverview()}
        {activeTab === 'content'   && renderContent()}
        {activeTab === 'messages'  && <AdminMessages isDark={isDark} />}
        {activeTab === 'broadcast' && <AdminBroadcast isDark={isDark} />}
        {activeTab === 'settings'  && renderSettings()}
      </main>

      {/* Mobile bottom nav */}
      <nav className="av2-bottom-nav">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`av2-bottom-btn ${activeTab === t.id ? 'active' : ''}`}>
            <span>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

export default Admin;
