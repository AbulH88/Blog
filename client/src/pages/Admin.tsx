import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateConfig, uploadImage, SERVER_URL } from '../api';

const Admin = ({ config, refreshConfig }: { config: any, refreshConfig: () => void }) => {
  const [formData, setFormData] = useState(config);
  const [activeTab, setActiveTab] = useState('analytics');
  const [status, setStatus] = useState('');
  const [analytics, setAnalytics] = useState<any>(null);
  const [editingPost, setEditingPost] = useState<any>(null);
  

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      navigate('/login');
    }

    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/api/analytics`);
        const data = await res.json();
        setAnalytics(data);
      } catch { /* ignore error */ }
    };
    fetchAnalytics();
  }, [navigate]);

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    const val = type === 'checkbox' ? checked : value;

    if (name.includes('.')) {
      const parts = name.split('.');
      if (parts.length === 2) {
        const [parent, child] = parts;
        setFormData({
          ...formData,
          [parent]: { ...formData[parent], [child]: val }
        });
      }
    } else {
      setFormData({ ...formData, [name]: val });
    }
  };

  const handleFileUpload = async (e: any, type: 'hero' | 'gallery' | 'slider' | 'favicon') => {
    const file = e.target.files[0];
    if (!file) return;
    setStatus('Uploading...');
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

  const handleSave = async () => {
    setStatus('Saving...');
    const res = await updateConfig(formData);
    if (res.success) {
      setStatus('Saved Successfully!');
      refreshConfig();
      setTimeout(() => setStatus(''), 3000);
    }
  };

  // Blog CRUD
  const saveBlogPost = () => {
    let newBlog = [...formData.blog];
    if (editingPost.id) {
      newBlog = newBlog.map(p => p.id === editingPost.id ? editingPost : p);
    } else {
      const newId = Math.max(...newBlog.map(p => p.id), 0) + 1;
      newBlog.push({ ...editingPost, id: newId });
    }
    setFormData({ ...formData, blog: newBlog });
    setEditingPost(null);
  };

  const deleteBlogPost = (id: number) => {
    setFormData({ ...formData, blog: formData.blog.filter((p: any) => p.id !== id) });
  };

  const removeImage = (type: 'slider' | 'gallery', index: number) => {
    const key = type === 'slider' ? 'heroSlider' : 'gallery';
    const list = [...formData.images[key]];
    list.splice(index, 1);
    setFormData({ ...formData, images: { ...formData.images, [key]: list } });
  };

  const renderContent = () => {
    switch(activeTab) {
      case 'analytics':
        return (
          <div className="admin-form">
             <div style={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ width: '10px', height: '10px', background: '#22c55e', borderRadius: '50%', marginRight: '10px', animation: 'pulse 2s infinite' }}></div>
                <span style={{ fontSize: '0.9rem', color: '#666', fontWeight: 600 }}>System Live & Tracking</span>
             </div>
            <div className="analytics-grid">
              <div className="stat-card">
                <h3>Total Page Views</h3>
                <p>{analytics?.totalHits || 0}</p>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid #E1306C' }}>
                <h3>Instagram</h3>
                <p>{analytics?.referrers?.Instagram || 0}</p>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid #1DA1F2' }}>
                <h3>Twitter / X</h3>
                <p>{analytics?.referrers?.['Twitter/X'] || 0}</p>
              </div>
              <div className="stat-card" style={{ borderLeft: '4px solid #EE1D52' }}>
                <h3>TikTok</h3>
                <p>{analytics?.referrers?.TikTok || 0}</p>
              </div>
            </div>
            
            <div className="admin-card">
              <h3>Source Distribution</h3>
              <div style={{ marginTop: '20px' }}>
                {analytics && Object.entries(analytics.referrers).map(([source, count]: any) => {
                  const percent = Math.round((count / analytics.totalHits) * 100);
                  return (
                    <div key={source} style={{ marginBottom: '15px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.9rem' }}>
                        <span>{source}</span>
                        <span>{percent}% ({count})</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: '#edf2f7', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${percent}%`, height: '100%', background: '#4c51bf' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      case 'general':
        return (
          <div className="admin-form">
            <div className="admin-card">
              <h3>Site Identity</h3>
              <div className="form-group">
                <label>Website Name</label>
                <input name="siteTitle" value={formData.siteTitle} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Hero Headline</label>
                <input name="heroTitle" value={formData.heroTitle} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Hero Sub-headline</label>
                <input name="heroSubtitle" value={formData.heroSubtitle} onChange={handleChange} />
              </div>
            </div>
            <div className="admin-card">
              <h3>Bio Management</h3>
              <div className="form-group">
                <label>Homepage Intro (Short)</label>
                <textarea name="homeBio" value={formData.homeBio} onChange={handleChange} rows={3} />
              </div>
              <div className="form-group">
                <label>Full Story (About Page)</label>
                <textarea name="bio" value={formData.bio} onChange={handleChange} rows={6} />
              </div>
            </div>
          </div>
        );
      case 'blog':
        return (
          <div className="admin-form">
            <div className="admin-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                <h3>Blog Manager</h3>
                <button className="btn btn-primary" style={{ padding: '8px 15px', fontSize: '0.8rem' }} onClick={() => setEditingPost({ title: '', excerpt: '', content: '' })}>+ New Post</button>
              </div>
              {editingPost ? (
                <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4>{editingPost.id ? 'Edit Post' : 'New Post'}</h4>
                  <div className="form-group" style={{ marginTop: '15px' }}>
                    <label>Post Title</label>
                    <input value={editingPost.title} onChange={(e) => setEditingPost({...editingPost, title: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Excerpt (Teaser)</label>
                    <textarea value={editingPost.excerpt} onChange={(e) => setEditingPost({...editingPost, excerpt: e.target.value})} rows={2} />
                  </div>
                  <div className="form-group">
                    <label>Full Content</label>
                    <textarea value={editingPost.content} onChange={(e) => setEditingPost({...editingPost, content: e.target.value})} rows={5} />
                  </div>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveBlogPost}>Save Post</button>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setEditingPost(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="blog-admin-list">
                  {formData.blog.map((post: any) => (
                    <div key={post.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '15px', borderBottom: '1px solid #eee' }}>
                      <div>
                        <strong>{post.title}</strong>
                        <p style={{ fontSize: '0.8rem', color: '#666' }}>{post.excerpt.substring(0, 50)}...</p>
                      </div>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button onClick={() => setEditingPost(post)} style={{ background: 'none', border: 'none', color: '#4c51bf', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => deleteBlogPost(post.id)} style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer' }}>Delete</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      case 'seo':
        return (
          <div className="admin-form">
            <div className="admin-card">
              <h3>Search Engine Optimization (SEO)</h3>
              <p style={{ fontSize: '0.8rem', color: '#666', marginBottom: '20px' }}>Optimize how your site appears on Google and when shared on socials.</p>
              <div className="form-group">
                <label>Meta Title (Browser Tab)</label>
                <input name="seo.metaTitle" value={formData.seo?.metaTitle} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Meta Description</label>
                <textarea name="seo.metaDescription" value={formData.seo?.metaDescription} onChange={handleChange} rows={3} />
              </div>
              <div className="form-group">
                <label>Favicon (Site Icon)</label>
                <input type="file" onChange={(e) => handleFileUpload(e, 'favicon')} />
                {formData.seo?.favicon && <img src={formData.seo.favicon} style={{ width: '32px', marginTop: '10px', display: 'block' }} alt="Favicon" />}
              </div>
            </div>
          </div>
        );
      case 'theme':
        return (
          <div className="admin-form">
            <div className="admin-card">
              <h3>Appearance & Theme</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div className="form-group">
                  <label>Primary Accent Color</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="color" name="theme.primaryColor" value={formData.theme?.primaryColor} onChange={handleChange} style={{ width: '50px', padding: '2px', height: '40px' }} />
                    <input value={formData.theme?.primaryColor} name="theme.primaryColor" onChange={handleChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label>Background Color</label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input type="color" name="theme.backgroundColor" value={formData.theme?.backgroundColor} onChange={handleChange} style={{ width: '50px', padding: '2px', height: '40px' }} />
                    <input value={formData.theme?.backgroundColor} name="theme.backgroundColor" onChange={handleChange} />
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Font Family</label>
                <select name="theme.fontFamily" value={formData.theme?.fontFamily} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <option value="'Didot', serif">Luxury (Didot)</option>
                  <option value="'Inter', sans-serif">Modern (Inter)</option>
                  <option value="'Playfair Display', serif">Classic (Playfair)</option>
                  <option value="'System-UI', sans-serif">Minimalist (System)</option>
                </select>
              </div>
            </div>
          </div>
        );
      case 'social':
        return (
          <div className="admin-form">
             <div className="admin-card">
              <h3>Social Media & Monetization</h3>
              <div className="form-group"><label>Fanvue Profile (VIP)</label><input name="links.fanvue" value={formData.links.fanvue} onChange={handleChange} placeholder="https://fanvue.com/..." /></div>
              <div className="form-group"><label>Instagram Profile</label><input name="links.instagram" value={formData.links.instagram} onChange={handleChange} /></div>
              <div className="form-group"><label>Twitter / X Profile</label><input name="links.twitter" value={formData.links.twitter} onChange={handleChange} /></div>
              <div className="form-group"><label>TikTok Profile</label><input name="links.tiktok" value={formData.links.tiktok} onChange={handleChange} /></div>
            </div>
          </div>
        );
      case 'media':
        return (
          <div className="admin-form">
            <div className="admin-card">
              <h3>Hero Slider Images</h3>
              <input type="file" onChange={(e) => handleFileUpload(e, 'slider')} />
              <div className="gallery-grid" style={{ marginTop: '20px' }}>
                {formData.images.heroSlider?.map((img: string, idx: number) => (
                  <div key={idx} className="gallery-item" style={{ position: 'relative' }}>
                    <img src={img} alt="Slider" />
                    <button onClick={() => removeImage('slider', idx)} style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px' }}>X</button>
                  </div>
                ))}
              </div>
            </div>
            <div className="admin-card">
              <h3>Gallery Manager</h3>
              <input type="file" onChange={(e) => handleFileUpload(e, 'gallery')} />
              <div className="gallery-grid" style={{ marginTop: '20px' }}>
                {formData.images.gallery?.map((img: string, idx: number) => (
                  <div key={idx} className="gallery-item" style={{ position: 'relative' }}>
                    <img src={img} alt="Gallery" />
                    <button onClick={() => removeImage('gallery', idx)} style={{ position: 'absolute', top: 5, right: 5, background: 'rgba(239, 68, 68, 0.9)', color: 'white', border: 'none', borderRadius: '50%', width: '20px', height: '20px', cursor: 'pointer', fontSize: '10px' }}>X</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      case 'settings':
        return (
          <div className="admin-form">
            <div className="admin-card">
              <h3>Security</h3>
              <div className="form-group">
                <label>Update Admin Password</label>
                <input type="password" name="newPassword" placeholder="Enter new password" onChange={handleChange} />
                <p style={{ fontSize: '0.7rem', color: '#666' }}>Leave blank to keep current password.</p>
              </div>
            </div>
            <div className="admin-card" style={{ borderLeft: formData.settings?.maintenanceMode ? '4px solid #f59e0b' : '4px solid #10b981' }}>
              <h3>Site Maintenance</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                   <strong>Maintenance Mode</strong>
                   <p style={{ fontSize: '0.8rem', color: '#666' }}>When active, public visitors will see a "Coming Soon" screen.</p>
                </div>
                <input 
                  type="checkbox" 
                  name="settings.maintenanceMode" 
                  checked={formData.settings?.maintenanceMode} 
                  onChange={handleChange}
                  style={{ width: '40px', height: '20px', cursor: 'pointer' }}
                />
              </div>
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="admin-layout">
      <div className="admin-sidebar">
        <div style={{ padding: '0 20px 20px' }}>
           <h2 style={{ border: 'none', padding: 0, margin: 0 }}>PRO PANEL</h2>
           <span style={{ fontSize: '0.7rem', color: '#4c51bf', fontWeight: 800 }}>V2.0 ULTIMATE</span>
        </div>
        <div className="sidebar-nav">
          <div className={`sidebar-link ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>📊 Overview</div>
          <div className={`sidebar-link ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>📝 Content</div>
          <div className={`sidebar-link ${activeTab === 'blog' ? 'active' : ''}`} onClick={() => setActiveTab('blog')}>📰 Blog Manager</div>
          <div className={`sidebar-link ${activeTab === 'media' ? 'active' : ''}`} onClick={() => setActiveTab('media')}>🖼️ Media Library</div>
          <div className={`sidebar-link ${activeTab === 'social' ? 'active' : ''}`} onClick={() => setActiveTab('social')}>🔗 Socials & VIP</div>
          <div className={`sidebar-link ${activeTab === 'seo' ? 'active' : ''}`} onClick={() => setActiveTab('seo')}>🔍 SEO & Meta</div>
          <div className={`sidebar-link ${activeTab === 'theme' ? 'active' : ''}`} onClick={() => setActiveTab('theme')}>🎨 Appearance</div>
          <div className={`sidebar-link ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>⚙️ Site Settings</div>
        </div>
        <div style={{ marginTop: 'auto', padding: '20px' }}>
          <button onClick={() => window.open('/', '_blank')} className="btn btn-secondary" style={{ width: '100%', fontSize: '0.7rem', color: '#fff', borderColor: '#444' }}>Preview Site ↗</button>
        </div>
      </div>
      
      <div className="admin-main">
        <div className="admin-header">
          <div>
             <h1 style={{ textTransform: 'capitalize' }}>{activeTab} Management</h1>
             <p style={{ fontSize: '0.8rem', color: '#666' }}>Manage your creator brand identity</p>
          </div>
          <button onClick={() => { localStorage.removeItem('adminToken'); navigate('/login'); }} className="btn btn-secondary" style={{ padding: '8px 20px', fontSize: '0.8rem', color: '#333' }}>Logout</button>
        </div>

        {renderContent()}

        {activeTab !== 'analytics' && (
          <div className="admin-save-bar">
            {status && <span style={{ marginRight: '20px', alignSelf: 'center', color: status.includes('Uploaded') ? '#4c51bf' : 'green', fontWeight: 600 }}>{status}</span>}
            <button onClick={handleSave} className="btn btn-primary" style={{ padding: '12px 40px', borderRadius: '6px' }}>Save Changes</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
