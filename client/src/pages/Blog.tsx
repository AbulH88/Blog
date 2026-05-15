import { useState } from 'react';
import { SERVER_URL } from '../api';

const CATEGORIES = ['Travel', 'Lifestyle', 'Fashion', 'Style', 'Beauty'];

const fullUrl = (p?: string) => (!p ? '' : (p.startsWith('http') ? p : `${SERVER_URL}${p}`));

const readMinutes = (text: string) => {
  const words = (text || '').split(/\s+/).length;
  return Math.max(2, Math.round(words / 200));
};

const formatDate = (iso?: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
};

const Blog = ({ blog }: { blog: any[] }) => {
  const [email, setEmail] = useState('');
  const [signupStatus, setSignupStatus] = useState('');

  const posts = blog || [];
  const featured = posts[0];
  const rest = posts.slice(1);

  const onSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSignupStatus("Thanks! We'll send you a note when there's something new.");
    setEmail('');
    setTimeout(() => setSignupStatus(''), 4000);
  };

  return (
    <div className="v3-blog">
      <div className="v3-blog-inner">
        <header className="v3-blog-head">
          <h1 className="v3-blog-title">Journal</h1>
          <p className="v3-blog-sub">Stories of wanderlust, style, and living well</p>
        </header>

        <div className="v3-blog-layout">
          <div>
            {featured && (
              <article className="v3-blog-hero">
                <div className="v3-blog-hero-img" style={{ backgroundImage: featured.image ? `url("${fullUrl(featured.image)}")` : undefined }} />
                <div className="v3-blog-hero-body">
                  <span className="v3-blog-chip">{featured.category || CATEGORIES[0]}</span>
                  <h2 className="v3-blog-h2">{featured.title}</h2>
                  <p className="v3-blog-excerpt">{featured.excerpt}</p>
                  <p className="v3-blog-meta">{formatDate(featured.date || featured.createdAt)} · {readMinutes((featured.excerpt || '') + (featured.content || ''))} min read</p>
                  <a href="#" className="v3-blog-readlink">Read story →</a>
                </div>
              </article>
            )}

            {rest.length === 0 ? (
              <p style={{ color: 'var(--v3-muted)', textAlign: 'center', padding: '40px 0', fontStyle: 'italic' }}>
                {featured ? 'More stories coming soon ✨' : 'No blog posts yet — add some in Admin → Settings → Blog'}
              </p>
            ) : (
              <div className="v3-blog-grid">
                {rest.map((post) => (
                  <article key={post.id} className="v3-blog-card">
                    <div className="img" style={{ backgroundImage: post.image ? `url("${fullUrl(post.image)}")` : undefined }} />
                    <div className="body">
                      <span className="v3-blog-chip">{post.category || CATEGORIES[0]}</span>
                      <h2 className="v3-blog-h2">{post.title}</h2>
                      <p className="v3-blog-excerpt" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{post.excerpt}</p>
                      <p className="v3-blog-meta">{formatDate(post.date || post.createdAt)}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="v3-blog-side">
            <div className="v3-card">
              <h3 style={{ fontFamily: 'var(--v3-heading)', fontStyle: 'italic', fontSize: '1.25rem', margin: '0 0 14px', color: 'var(--v3-ink)' }}>Categories</h3>
              <div className="v3-blog-cats">
                {CATEGORIES.map((c) => (
                  <a key={c} href="#">{c}</a>
                ))}
              </div>
            </div>

            <div className="v3-newsletter">
              <h4>Newsletter Signup</h4>
              <p>Sign up for new stories and living well notes.</p>
              <form onSubmit={onSignup}>
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button type="submit">Subscribe</button>
              </form>
              {signupStatus && <p style={{ fontSize: '0.8rem', marginTop: 10, opacity: 0.95 }}>{signupStatus}</p>}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Blog;
