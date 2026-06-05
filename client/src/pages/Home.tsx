import { Link } from 'react-router-dom';
import { SERVER_URL } from '../api';
import HeroSlider from '../components/HeroSlider';
import InstagramFeed from '../components/InstagramFeed';
import { isMembersDomain, crossDomainUrl } from '../lib/hostname';

const fullUrl = (p?: string) => (!p ? '' : (p.startsWith('http') ? p : `${SERVER_URL}${p}`));

const DEFAULT_FAVORITES = ['☕ Iced lattes', '🌿 Vintage finds', '📷 Film cameras', '🌅 Sunsets', '✈️ Solo travel'];
const DEFAULT_PRESS = ['VOGUE', 'BAZAAR', 'ELLE', 'REFINERY29', 'GRAZIA'];

// Editorial 2×2 "Featured Content" cards. Bot-safe, neutral captions; each
// links into an internal page (Gallery / Journal). Images are sourced from
// the creator's gallery, falling back to hero shots so the grid is never bare.
const FEATURED_DEFS = [
  { cat: 'Lifestyle',   ttl: 'Everyday moments', href: '/gallery' },
  { cat: 'Travel',      ttl: 'Places I wander',  href: '/gallery' },
  { cat: 'Photography', ttl: 'Through my lens',   href: '/gallery' },
  { cat: 'Journal',     ttl: 'Stories & notes',   href: '/blog' },
];

const Home = ({ config }: { config: any }) => {
  const heroImages: string[] = config?.images?.heroSlider?.length
    ? config.images.heroSlider
    : (config?.images?.hero ? [config.images.hero] : []);
  // Per-index mobile overrides; empty array if creator hasn't uploaded any.
  const heroImagesMobile: string[] = config?.images?.heroSliderMobile || [];

  const bio = config?.homeBio || config?.heroSubtitle || '';
  const fullBio = config?.bio || 'Tell your story here. Edit your bio from Admin → Bio Builder.';
  const displayName = config?.siteTitle || 'Cristina';
  const name = displayName.toUpperCase();
  const firstName = name.split(' ')[0];

  // Portrait for the About section.
  const portrait =
    config?.images?.aboutPortrait ||
    config?.images?.hero ||
    config?.images?.heroSlider?.[0] ||
    config?.images?.gallery?.[0] ||
    '';

  const gallery: string[] = config?.images?.gallery || [];

  // Featured Content image pool: gallery first, hero shots as backup.
  const featurePool: string[] = [...gallery, ...heroImages].filter(Boolean);
  const featured = FEATURED_DEFS
    .map((d, i) => ({ ...d, img: featurePool[i] || (featurePool.length ? featurePool[i % featurePool.length] : '') }))
    .filter((c) => c.img);

  // Journey: 4 milestones, each editable in admin (year + label + img).
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
  const galleryUrl = isMembersDomain() ? '/gallery' : '/gallery';

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

      {/* ── Hero with editorial typography overlay ──────────────── */}
      <section className="v3-hero">
        <div className="v3-hero-frame">
          <HeroSlider images={heroImages} mobileImages={heroImagesMobile} alt={config?.siteTitle} />

          {/* Overlay: name + tagline + neutral subline + 2 CTAs. Bot-safe copy.
              Staggered fade-up on load for an elegant reveal. */}
          <div className="v3-hero-overlay">
            <p className="v3-hero-eyebrow v3-anim" style={{ animationDelay: '0.05s' }}>Welcome</p>
            <h1 className="v3-hero-name v3-anim" style={{ animationDelay: '0.15s' }}>{displayName}</h1>
            <p className="v3-hero-tagline v3-anim" style={{ animationDelay: '0.28s' }}>
              Lifestyle · Photography · Travel
            </p>
            <p className="v3-hero-sub v3-anim" style={{ animationDelay: '0.4s' }}>
              A little corner of lifestyle, travel &amp; creative work.
            </p>
            <div className="v3-hero-cta v3-anim" style={{ animationDelay: '0.55s' }}>
              <Link to={galleryUrl} className="v3-btn v3-btn-ghost">View Gallery</Link>
              <a href={membersLoginUrl} className="v3-btn v3-btn-primary">Members</a>
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured Content — editorial 2×2 grid ───────────────── */}
      {featured.length > 0 && (
        <section className="v3-featured">
          <div className="v3-ed-head">
            <p className="eyebrow">Explore</p>
            <h2>{bio ? 'Lifestyle, travel & creative work' : `Inside ${firstName}'s world`}</h2>
            {bio && <p>{bio}</p>}
          </div>
          <div className="v3-featured-grid">
            {featured.map((c, i) => (
              <Link key={i} to={c.href} className="v3-featured-card">
                <img src={fullUrl(c.img)} alt={c.ttl} loading="lazy" />
                <div className="v3-featured-cap">
                  <p className="cat">{c.cat}</p>
                  <p className="ttl">{c.ttl}</p>
                  <span className="arrow">View →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── About ───────────────────────────────────────────────── */}
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
        </div>
      </div>

      {/* ── Members band — premium, neutral, bot-safe ───────────── */}
      <section className="v3-members-band">
        <p className="eyebrow">Members</p>
        <h2>There's more, if you want it.</h2>
        <p>More photos, stories, and the little moments — for the people who actually show up.</p>
        <a href={membersLoginUrl} className="v3-btn">Come in →</a>
      </section>

      {/* ── Instagram feed — full-width closing section ─────────── */}
      <section className="v3-ig-section">
        <InstagramFeed
          gallery={config?.images?.gallery || []}
          instagramUrl={config?.links?.instagram || ''}
        />
      </section>
    </div>
  );
};

export default Home;
