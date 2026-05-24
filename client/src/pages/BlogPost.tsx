import { useParams, Link } from 'react-router-dom';
import { SERVER_URL } from '../api';

const fullUrl = (p?: string) => (!p ? '' : (p.startsWith('http') ? p : `${SERVER_URL}${p}`));

const formatDate = (iso?: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
};

const readMinutes = (text: string) => {
  const words = (text || '').split(/\s+/).length;
  return Math.max(2, Math.round(words / 200));
};

/**
 * Render content with paragraph breaks (\n\n) and **bold** inline markdown.
 * Kept dependency-free — a heavier markdown lib would balloon the bundle for
 * what is essentially three formatting cases (paragraph, bold, line break).
 */
function renderContent(content: string) {
  const paragraphs = (content || '').split(/\n\n+/).filter(p => p.trim());
  return paragraphs.map((para, i) => {
    // Split on **bold** while preserving the delimiters in capture groups
    const parts = para.split(/(\*\*[^*]+\*\*)/g);
    const rendered = parts.map((part, j) => {
      const m = part.match(/^\*\*(.+)\*\*$/);
      if (m) return <strong key={j}>{m[1]}</strong>;
      // Preserve single newlines within a paragraph as line breaks
      const lines = part.split('\n');
      return lines.flatMap((line, k) => k === 0 ? [line] : [<br key={`${j}-${k}`} />, line]);
    });
    return <p key={i}>{rendered}</p>;
  });
}

const BlogPost = ({ blog }: { blog: any[] }) => {
  const { id } = useParams<{ id: string }>();
  const posts = blog || [];
  const post = posts.find(p => String(p.id) === String(id));

  if (!post) {
    return (
      <div className="v3-blog">
        <div className="v3-blog-inner" style={{ textAlign: 'center', padding: '80px 20px' }}>
          <p style={{ fontSize: '0.8rem', letterSpacing: 2, color: 'var(--v3-terracotta)', fontWeight: 700, marginBottom: 10 }}>
            404 · POST NOT FOUND
          </p>
          <h1 style={{ fontFamily: 'var(--v3-heading)', fontSize: '2rem', margin: '0 0 14px' }}>
            That story doesn't exist
          </h1>
          <p style={{ color: 'var(--v3-ink-soft)', marginBottom: 24 }}>
            It might have moved — head back to the journal for the latest.
          </p>
          <Link
            to="/blog"
            style={{
              display: 'inline-block',
              padding: '10px 22px',
              background: 'var(--v3-terracotta)',
              color: '#fff',
              borderRadius: 10,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: '0.9rem',
            }}>
            ← Back to Journal
          </Link>
        </div>
      </div>
    );
  }

  const dateStr = formatDate(post.date || post.createdAt);
  const minutes = readMinutes((post.excerpt || '') + (post.content || ''));

  // Related: up to 2 other posts (newest first, exclude current)
  const related = posts
    .filter(p => String(p.id) !== String(id))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .slice(0, 2);

  return (
    <div className="v3-blog">
      <article className="v3-blog-post">
        <Link to="/blog" className="v3-blog-back">← Back to Journal</Link>

        <header className="v3-blog-post-head">
          <span className="v3-blog-chip">{post.category || 'Travel'}</span>
          <h1 className="v3-blog-post-h1">{post.title}</h1>
          <p className="v3-blog-post-meta">
            {dateStr}{dateStr && ' · '}{minutes} min read
          </p>
        </header>

        {post.image && (
          <div
            className="v3-blog-post-hero"
            style={{ backgroundImage: `url("${fullUrl(post.image)}")` }}
            role="img"
            aria-label={post.title}
          />
        )}

        <div className="v3-blog-post-body">
          {post.excerpt && (
            <p className="v3-blog-post-lede">{post.excerpt}</p>
          )}
          {renderContent(post.content || '')}
        </div>

        {related.length > 0 && (
          <aside className="v3-blog-related">
            <h3>More from the Journal</h3>
            <div className="v3-blog-related-grid">
              {related.map(p => (
                <Link key={p.id} to={`/blog/${p.id}`} className="v3-blog-related-card">
                  <div className="img" style={{ backgroundImage: p.image ? `url("${fullUrl(p.image)}")` : undefined }} />
                  <div className="body">
                    <span className="v3-blog-chip">{p.category || 'Travel'}</span>
                    <h4>{p.title}</h4>
                    <p className="meta">{formatDate(p.date || p.createdAt)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        )}
      </article>
    </div>
  );
};

export default BlogPost;
