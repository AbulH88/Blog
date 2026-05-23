import { Link } from 'react-router-dom';
import { SERVER_URL } from '../api';
import SocialIcons from '../components/SocialIcons';
import HeroSlider from '../components/HeroSlider';
import InstagramFeed from '../components/InstagramFeed';
import { isMembersDomain, crossDomainUrl } from '../lib/hostname';

interface Tile {
  kind: 'terracotta' | 'navy';
  icon: string;
  title: string;
  subtitle?: string;
  extra?: string;
  href: string;
}

const fullUrl = (p?: string) => (!p ? '' : (p.startsWith('http') ? p : `${SERVER_URL}${p}`));

const DEFAULT_FAVORITES = ['☕ Iced lattes', '🌿 Vintage finds', '📷 Film cameras', '🌅 Sunsets', '✈️ Solo travel'];
const DEFAULT_PRESS = ['VOGUE', 'BAZAAR', 'ELLE', 'REFINERY29', 'GRAZIA'];

const Home = ({ config }: { config: any }) => {
  const ig = config?.links?.instagram || '';
  const tk = config?.links?.tiktok || '';
  const yt = config?.links?.youtube || '';

  // Default tiles fall back if creator hasn't customised in Bio Builder
  const defaultTiles: Tile[] = [
    { kind: 'terracotta', icon: 'instagram', title: 'INSTAGRAM', subtitle: 'Follow', href: ig },
    { kind: 'navy',       icon: 'tiktok',    title: 'TIKTOK',    subtitle: 'Watch',  href: tk },
    { kind: 'terracotta', icon: 'youtube',   title: 'YOUTUBE',   subtitle: 'Latest videos', href: yt },
    { kind: 'navy',       icon: 'shopping',  title: 'SHOP',      subtitle: 'My favorites',  href: '' },
    { kind: 'navy',       icon: 'document',  title: 'BLOG',      subtitle: 'Stories', href: '/blog' },
    { kind: 'terracotta', icon: 'handshake', title: 'COLLABS',   subtitle: 'Work with me', href: '' },
  ];

  const tiles: Tile[] = (config?.featuredLinks?.length ? config.featuredLinks : defaultTiles)
    .filter((t: Tile) => !!t.title && !!t.href);

  const heroImages: string[] = config?.images?.heroSlider?.length
    ? config.images.heroSlider
    : (config?.images?.hero ? [config.images.hero] : []);
  // Per-index mobile overrides; empty array if creator hasn't uploaded any.
  // HeroSlider falls back to the desktop image when mobileImages[i] is empty.
  const heroImagesMobile: string[] = config?.images?.heroSliderMobile || [];

  const bio = config?.homeBio || config?.heroSubtitle || '';
  const fullBio = config?.bio || 'Tell your story here. Edit your bio from Admin → Bio Builder.';
  const name = (config?.siteTitle || 'Cristina').toUpperCase();
  const firstName = name.split(' ')[0];

  // Portrait for the About section — prefers a dedicated upload, falls
  // back through hero → gallery so existing installs keep working.
  const portrait =
    config?.images?.aboutPortrait ||
    config?.images?.hero ||
    config?.images?.heroSlider?.[0] ||
    config?.images?.gallery?.[0] ||
    '';

  // Journey: 4 milestones, each fully editable in admin (year + label + img).
  // Falls back to gallery-derived defaults when the creator hasn't set them
  // yet so the section is never empty on a new install.
  const gallery = config?.images?.gallery || [];
  const journeyFromConfig: Array<{ year?: string; label?: string; img?: string }> =
    Array.isArray(config?.journey) ? config.journey : [];
  const journeyDefaults = [
    { year: '2019', label: 'Started the blog', img: gallery[0] },
    { year: '2021', label: 'First brand collab', img: gallery[1] },
    { year: '2023', label: 'Featured in Vogue', img: gallery[2] },
    { year: '2024', label: 'Built this little corner of the internet', img: gallery[3] },
  ];
  const journey = journeyDefaults.map((d, i) => ({
    year: journeyFromConfig[i]?.year ?? d.year,
    label: journeyFromConfig[i]?.label ?? d.label,
    img: journeyFromConfig[i]?.img ?? d.img,
  }));

  // Members CTA destination — cross-domain on root, internal on members.
  const membersLoginUrl = isMembersDomain() ? '/login' : crossDomainUrl('/login', 'members');

  return (
    <div style={{ background: 'var(--v3-cream)', minHeight: '100vh', position: 'relative', overflow: 'hidden' }}>

      {/* Decorative leaves */}
      <svg className="v3-leaf" style={{ left: -20, top: 720, width: 180 }} viewBox="0 0 100 200" fill="none" aria-hidden>
        <path d="M30 10 Q60 60 30 120 Q0 60 30 10 Z" fill="#B8924F" opacity="0.35"/>
        <path d="M50 60 Q80 110 50 170 Q20 110 50 60 Z" fill="#B8924F" opacity="0.25"/>
      </svg>
      <svg className="v3-leaf" style={{ right: 10, top: 700, width: 200 }} viewBox="0 0 200 200" fill="none" aria-hidden>
        <path d="M180 20 Q90 80 100 180 Q180 130 180 20 Z" fill="#2C3E5C" opacity="0.25"/>
      </svg>
      <svg className="v3-leaf" style={{ left: -10, bottom: 80, width: 160 }} viewBox="0 0 100 200" fill="none" aria-hidden>
        <path d="M40 30 Q70 90 40 170 Q10 90 40 30 Z" fill="#B8924F" opacity="0.25"/>
      </svg>

      {/* Hero */}
      <section className="v3-hero">
        <div className="v3-hero-frame">
          <HeroSlider images={heroImages} mobileImages={heroImagesMobile} alt={config?.siteTitle} />
        </div>
      </section>

      {/* Welcome + Featured links | Instagram feed */}
      <section className="v3-content-grid">
        <div className="v3-welcome">
          <h1>WELCOME TO MY WORLD!</h1>
          <p className="tagline">LIFESTYLE • TRAVEL • FASHION • CREATIVITY</p>
          <p className="bio">
            {bio || `Hi, I'm ${config?.siteTitle || 'Cristina'}! 🌿 Sharing my journey, favorite moments, style finds, and travel adventures with you. Let's connect and inspire each other! ✨`}
          </p>

          <p className="v3-section-label">FEATURED LINKS</p>

          {tiles.length === 0 ? (
            <p style={{ color: 'var(--v3-muted)', fontSize: '0.86rem' }}>
              No featured links yet — set them in Admin → Bio Builder.
            </p>
          ) : (
            <div className="v3-link-grid">
              {tiles.map((t, i) => {
                const isExternal = t.href?.startsWith('http');
                const inner = (
                  <>
                    <span className="icon" aria-hidden>
                      <SocialIcons name={t.icon} size={28} />
                    </span>
                    <span className="title">{t.title}</span>
                    {t.subtitle && <span className="subtitle">{t.subtitle}</span>}
                    {t.extra && <span className="subtitle" style={{ fontWeight: 700, marginTop: -2 }}>{t.extra}</span>}
                  </>
                );
                return isExternal ? (
                  <a key={i} href={t.href} target="_blank" rel="noreferrer" className={`v3-link-tile ${t.kind}`}>
                    {inner}
                  </a>
                ) : (
                  <Link key={i} to={t.href || '#'} className={`v3-link-tile ${t.kind}`}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        <InstagramFeed
          gallery={config?.images?.gallery || []}
          instagramUrl={config?.links?.instagram || ''}
        />
      </section>

      {/* About section — merged from former /about page */}
      <div className="v3-about">
        <div className="v3-about-inner">
          <section className="v3-about-hero">
            <div className="v3-about-portrait">
              {portrait
                ? <img src={fullUrl(portrait)} alt={name} />
                : <div style={{ width: '100%', height: '100%', background: 'var(--v3-cream-deep)' }} />}
            </div>
            <div>
              <p className="v3-about-sub">About {name}</p>
              <h1 className="v3-about-h1">HELLO, I'M {firstName}.</h1>
              <p className="v3-about-body">{fullBio}</p>

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

          {/* Press strip */}
          <section className="v3-press">
            <p className="v3-press-label">Featured In</p>
            <div className="v3-press-row">
              {DEFAULT_PRESS.map((p) => (
                <span key={p}>{p}</span>
              ))}
            </div>
          </section>

          {/* Members CTA — replaces the old newsletter signup. The copy is
              intentionally bot-safe (no subscribe/premium/exclusive/adult
              language) while still being emotionally compelling for humans.
              "People who actually show up" is the conversion hook — fans
              self-identify as the kind of person this is for. */}
          <section className="v3-cta-strip">
            <p style={{
              fontSize: '0.78rem', letterSpacing: 1.2, fontWeight: 700,
              opacity: 0.7, margin: '0 0 8px', textTransform: 'uppercase',
            }}>
              P.S.
            </p>
            <h3 style={{ margin: '0 0 10px' }}>There's more, if you want it.</h3>
            <p style={{ margin: 0, opacity: 0.92, fontSize: '0.94rem', lineHeight: 1.6 }}>
              Photos, stories, and the little moments I share with people who actually show up.
            </p>
            <a
              href={membersLoginUrl}
              className="v3-btn v3-btn-primary"
              style={{
                display: 'inline-block',
                textDecoration: 'none',
                marginTop: 18,
                padding: '12px 28px',
                background: '#fff',
                color: 'var(--v3-ink)',
                borderRadius: 999,
                fontWeight: 700,
                letterSpacing: 0.5,
              }}
            >
              Come in →
            </a>

            <div className="icons" style={{ marginTop: 22 }}>
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
    </div>
  );
};

export default Home;
