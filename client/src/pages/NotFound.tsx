import { Link } from 'react-router-dom';

/**
 * 404 page. Previously the catch-all silently redirected to '/' which made
 * mistyped links + dead bookmarks invisible — and bots see only 200s, which
 * is bad for SEO hygiene even on a noindex site.
 */
export default function NotFound() {
  return (
    <div style={{
      minHeight: 'calc(100vh - 200px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px', textAlign: 'center',
    }}>
      <div style={{ maxWidth: 440 }}>
        <p style={{
          fontSize: '0.66rem', letterSpacing: 3, color: 'var(--v3-terracotta)',
          fontWeight: 700, margin: '0 0 8px',
        }}>
          404 · LOST IN THE VAULT
        </p>
        <h1 style={{
          fontFamily: 'var(--v3-heading)', fontSize: '2.4rem',
          color: 'var(--v3-ink)', margin: '0 0 12px', lineHeight: 1.1,
        }}>
          This page <span style={{ fontFamily: 'var(--v3-display)', fontStyle: 'italic', color: 'var(--v3-terracotta)' }}>doesn't exist</span>
        </h1>
        <p style={{
          fontSize: '0.96rem', color: 'var(--v3-ink-soft)',
          margin: '0 0 28px', lineHeight: 1.5,
        }}>
          Either the link is wrong, the content was removed, or you wandered somewhere private. Let's get you back.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <Link to="/" className="v3-btn v3-btn-primary" style={{ minWidth: 200, display: 'inline-block' }}>
            Back to home →
          </Link>
          <Link to="/vault" style={{
            fontSize: '0.84rem', color: 'var(--v3-terracotta)',
            textDecoration: 'none', fontWeight: 700, marginTop: 8,
          }}>
            Or browse the Vault
          </Link>
        </div>
      </div>
    </div>
  );
}
