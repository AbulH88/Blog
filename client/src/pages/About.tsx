import { useState } from 'react';
import { SERVER_URL } from '../api';

const fullUrl = (p?: string) => (!p ? '' : (p.startsWith('http') ? p : `${SERVER_URL}${p}`));

const DEFAULT_FAVORITES = ['☕ Iced lattes', '🌿 Vintage finds', '📷 Film cameras', '🌅 Sunsets', '✈️ Solo travel'];
const DEFAULT_PRESS = ['VOGUE', 'BAZAAR', 'ELLE', 'REFINERY29', 'GRAZIA'];

const About = ({ config }: { config: any }) => {
  const [email, setEmail] = useState('');
  const [signupStatus, setSignupStatus] = useState('');

  const bio = config?.bio || 'Tell your story here. Edit your bio from Admin → Settings → Profile.';
  const name = (config?.siteTitle || 'Cristina').toUpperCase();
  const portrait =
    config?.images?.hero ||
    config?.images?.heroSlider?.[0] ||
    config?.images?.gallery?.[0] ||
    '';

  // Journey: synthesize 4 milestones from gallery photos (or empty placeholders)
  const gallery = config?.images?.gallery || [];
  const journey = [
    { year: '2019', label: 'Started the blog', img: gallery[0] },
    { year: '2021', label: 'First brand collab', img: gallery[1] },
    { year: '2023', label: 'Featured in Vogue', img: gallery[2] },
    { year: '2024', label: 'Launched my platform', img: gallery[3] },
  ];

  const onSignup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSignupStatus("Thanks — we'll be in touch!");
    setEmail('');
    setTimeout(() => setSignupStatus(''), 4000);
  };

  return (
    <div className="v3-about">
      <div className="v3-about-inner">
        {/* Hero */}
        <section className="v3-about-hero">
          <div className="v3-about-portrait">
            {portrait
              ? <img src={fullUrl(portrait)} alt={name} />
              : <div style={{ width: '100%', height: '100%', background: 'var(--v3-cream-deep)' }} />}
          </div>
          <div>
            <p className="v3-about-sub">About {name}</p>
            <h1 className="v3-about-h1">HELLO, I'M {name.split(' ')[0]}.</h1>
            <p className="v3-about-body">{bio}</p>

            <p className="v3-about-sub" style={{ marginTop: 20 }}>A few things I love</p>
            <div className="v3-favorites">
              {DEFAULT_FAVORITES.map((f) => (
                <span key={f} className="v3-favorite-chip">{f}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Journey */}
        <section className="v3-about-section">
          <h2>The Journey</h2>
          <div className="v3-journey">
            {journey.map((j, i) => (
              <div key={i} className="v3-journey-item">
                <div className="img" style={{ backgroundImage: j.img ? `url("${fullUrl(j.img)}")` : undefined }} />
                <p className="year">{j.year}</p>
                <p className="label">{j.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Press */}
        <section className="v3-press">
          <p className="v3-press-label">Featured In</p>
          <div className="v3-press-row">
            {DEFAULT_PRESS.map((p) => (
              <span key={p}>{p}</span>
            ))}
          </div>
        </section>

        {/* Connect CTA */}
        <section className="v3-cta-strip">
          <h3>Let's connect</h3>
          <p style={{ margin: 0, opacity: 0.92, fontSize: '0.94rem' }}>
            Get notified when I post something new — no spam, just stories.
          </p>
          <form onSubmit={onSignup} style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 18, flexWrap: 'wrap', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                flex: 1, minWidth: 200,
                background: 'rgba(255,255,255,0.95)', border: 'none',
                padding: '11px 14px', borderRadius: 7,
                fontFamily: 'inherit', fontSize: '0.9rem',
                color: 'var(--v3-ink)', outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                background: 'var(--v3-ink)', color: '#fff', border: 'none',
                padding: '11px 22px', borderRadius: 7,
                fontFamily: 'inherit', fontWeight: 700, fontSize: '0.88rem',
                cursor: 'pointer', letterSpacing: 1,
              }}>
              JOIN
            </button>
          </form>
          {signupStatus && <p style={{ fontSize: '0.84rem', marginTop: 10, opacity: 0.95 }}>{signupStatus}</p>}

          <div className="icons">
            {config?.links?.instagram && (
              <a href={config.links.instagram} target="_blank" rel="noreferrer" aria-label="Instagram">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-5.838 2.435-5.838 5.838s2.435 5.838 5.838 5.838 5.838-2.435 5.838-5.838-2.435-5.838-5.838-5.838zm0 9.674c-2.09 0-3.836-1.746-3.836-3.836s1.746-3.836 3.836-3.836 3.836 1.746 3.836 3.836-1.746 3.836-3.836 3.836zm5.838-10.499c.742 0 1.344.603 1.344 1.344s-.603 1.344-1.344 1.344-1.344-.603-1.344-1.344.603-1.344 1.344-1.344z"/></svg>
              </a>
            )}
            {config?.links?.tiktok && (
              <a href={config.links.tiktok} target="_blank" rel="noreferrer" aria-label="TikTok">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.83 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/></svg>
              </a>
            )}
            {config?.links?.twitter && (
              <a href={config.links.twitter} target="_blank" rel="noreferrer" aria-label="X">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 7.719 8.502 11.231h-6.653l-5.208-6.817-5.964 6.817H1.614l7.737-8.854L.813 2.25h6.823l4.707 6.227L18.244 2.25z"/></svg>
              </a>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default About;
