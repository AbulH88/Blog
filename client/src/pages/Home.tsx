import { Link } from 'react-router-dom';
import { SERVER_URL } from '../api';
import SocialIcons from '../components/SocialIcons';
import HeroSlider from '../components/HeroSlider';
import InstagramFeed from '../components/InstagramFeed';

interface Tile {
  kind: 'terracotta' | 'navy';
  icon: string;
  title: string;
  subtitle?: string;
  extra?: string;
  href: string;
}

const Home = ({ config }: { config: any }) => {
  const fullUrl = (p: string) => (p?.startsWith('http') ? p : `${SERVER_URL}${p}`);
  void fullUrl;

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

  const bio = config?.homeBio || config?.heroSubtitle || '';

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
          <HeroSlider images={heroImages} alt={config?.siteTitle} />
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
    </div>
  );
};

export default Home;
