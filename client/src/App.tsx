import { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getCreator } from './api';
import './styles/main.css';
import './styles/theme-v3.css';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AgeGate from './components/AgeGate';

// Eager — small + likely visited (home, login flow, footer pages)
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import NotFound from './pages/NotFound';
import ShortlinkRedirect from './components/ShortlinkRedirect';
import { isMembersDomain } from './lib/hostname';

// Lazy — heavy or behind-login pages. Saves ~150KB from the initial bundle.
// Fans browsing Home → Vault don't download Admin's 1800-line component
// until they actually visit /admin (which most never will).
const Gallery        = lazy(() => import('./pages/Gallery'));
const Vault          = lazy(() => import('./pages/Vault'));
const Blog           = lazy(() => import('./pages/Blog'));
const BlogPost       = lazy(() => import('./pages/BlogPost'));
const Admin          = lazy(() => import('./pages/Admin'));
const FanDashboard   = lazy(() => import('./pages/FanDashboard'));
const Chat           = lazy(() => import('./pages/Chat'));
const Terms          = lazy(() => import('./pages/Terms'));
const Privacy        = lazy(() => import('./pages/Privacy'));
const Compliance2257 = lazy(() => import('./pages/Compliance2257'));
// Members conversion CTA — lazy-loaded so its strings never ship in the
// main bundle. Only mounted on the marketing root domain (see below).
const MembersScrollCta = lazy(() => import('./components/MembersScrollCta'));
const FanvueFloat      = lazy(() => import('./components/FanvueFloat'));
const PaymentReturn  = lazy(() => import('./pages/PaymentReturn'));
const FanSettings    = lazy(() => import('./pages/FanSettings'));
const DMCA           = lazy(() => import('./pages/DMCA'));

const Maintenance = () => (
  <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: '#000', color: '#fff' }}>
    <h1>Coming Soon</h1>
    <p>We are currently updating our digital experience. Please check back later.</p>
  </div>
);

const RouteLoader = () => (
  <div className="loading" style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--v3-muted)' }}>
    Loading…
  </div>
);

function App() {
  const [config, setConfig] = useState<any>(null);
  const [isVerified, setIsVerified] = useState(() => localStorage.getItem('ageVerified') === 'true');

  const refreshConfig = async () => {
    const data = await getCreator();
    setConfig(data);
  };

  useEffect(() => {
    // V3 theme — apply globally
    document.body.classList.add('v3');

    const fetchConfig = async () => {
      const data = await getCreator();
      setConfig(data);

      // V3 ignores creator-supplied colors so the brand stays consistent.
      // (Future: re-introduce per-creator color overrides as CSS var sets.)


      if (data.seo) {
        document.title = data.seo.metaTitle || data.siteTitle;
        // Same safety: on the marketing root, force a lifestyle description
        // even if admin has set something racier in seo.metaDescription.
        const onRootDomain = !window.location.hostname.startsWith('members.');
        const safeRootDesc =
          `${data.siteTitle || 'Cristina'} — NYC lifestyle, travel, fashion, creative work.`;
        const descContent = onRootDomain ? safeRootDesc : (data.seo.metaDescription || '');
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute('content', descContent);
        } else {
          const meta = document.createElement('meta');
          meta.name = 'description';
          meta.content = descContent;
          document.head.appendChild(meta);
        }
        if (data.seo.favicon) {
          let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
          if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
          link.href = data.seo.favicon;
        }
        if (data.seo.ogImage) {
          let og: HTMLMetaElement | null = document.querySelector('meta[property="og:image"]');
          if (!og) { og = document.createElement('meta'); og.setAttribute('property', 'og:image'); document.head.appendChild(og); }
          og.setAttribute('content', data.seo.ogImage);
        }
      }

      // OG title / description / url — kept in sync with siteTitle even when
      // seo.* fields aren't filled in. Logo is a safe fallback for og:image.
      const setOg = (prop: string, value?: string | null) => {
        if (!value) return;
        let el: HTMLMetaElement | null = document.querySelector(`meta[property="${prop}"]`);
        if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
        el.setAttribute('content', value);
      };
      // Hostname-aware OG tags. On the marketing root, we hard-code a
      // lifestyle-neutral description regardless of what admin has set in seo.* —
      // social-preview bots that scan the bio link must never see monetization
      // language. On members.* (paywall side) we use the admin-supplied copy.
      const onMembers = window.location.hostname.startsWith('members.');
      const safeRootDescription =
        `${data.siteTitle || 'Cristina'} — NYC lifestyle, travel, fashion, creative work.`;
      setOg('og:title', data.seo?.metaTitle || data.siteTitle);
      setOg(
        'og:description',
        onMembers
          ? (data.seo?.metaDescription || data.homeBio?.slice(0, 200))
          : safeRootDescription,
      );
      setOg('og:url', window.location.origin);
      // Fall back to logoUrl → hero image → favicon
      const ogImg = data.seo?.ogImage || data.logoUrl || data.images?.hero || data.images?.heroSlider?.[0];
      if (ogImg) {
        const fullOgImg = ogImg.startsWith('http') ? ogImg : `${window.location.origin}${ogImg}`;
        setOg('og:image', fullOgImg);
      }

      // Respect the search-indexable toggle — inject/remove <meta robots>
      const existingRobots = document.querySelector('meta[name="robots"]');
      if (!data.searchIndexable) {
        if (existingRobots) {
          existingRobots.setAttribute('content', 'noindex, nofollow, noarchive, nosnippet');
        } else {
          const m = document.createElement('meta');
          m.name = 'robots';
          m.content = 'noindex, nofollow, noarchive, nosnippet';
          document.head.appendChild(m);
        }
      } else if (existingRobots) {
        existingRobots.remove();
      }
    };
    fetchConfig();
  }, []);

  if (!config) return <div className="loading">Loading...</div>;

  const isMaintenance = config.settings?.maintenanceMode;

  return (
    <Router>
      {!isVerified && !isMaintenance && config?.ageGateEnabled !== false && (
        <AgeGate onVerify={() => setIsVerified(true)} />
      )}
      <div className="app">
        {isMaintenance ? (
          <Suspense fallback={<RouteLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={<Admin config={config} refreshConfig={refreshConfig} />} />
              <Route path="*" element={<Maintenance />} />
            </Routes>
          </Suspense>
        ) : (
          <>
            <Navbar
              siteTitle={config.siteTitle}
              fanvue={config.fanvue}
              logoUrl={config.logoUrl}
              avatarUrl={config.chatAvatarUrl || config.images?.hero || config.images?.heroSlider?.[0] || config.logoUrl}
            />
            <main className="container">
              <Suspense fallback={<RouteLoader />}>
                {isMembersDomain() ? (
                  // ── members.* subdomain — age-gated paywall + dashboard ──
                  <Routes>
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/register" element={<Register config={config} />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/verify-email" element={<VerifyEmail />} />
                    <Route path="/dashboard" element={<FanDashboard />} />
                    <Route path="/dashboard/payment-methods" element={<Navigate to="/dashboard/settings/payments" replace />} />
                    <Route path="/dashboard/settings" element={<FanSettings />} />
                    <Route path="/dashboard/settings/:section" element={<FanSettings />} />
                    <Route path="/vault" element={<Vault config={config} />} />
                    <Route path="/chat" element={<Chat config={config} />} />
                    <Route path="/payment/return" element={<PaymentReturn />} />
                    <Route path="/admin" element={<Admin config={config} refreshConfig={refreshConfig} />} />
                    {/* Legal pages mirrored — card processor wants to see them from members.* */}
                    <Route path="/terms" element={<Terms config={config} />} />
                    <Route path="/privacy" element={<Privacy config={config} />} />
                    <Route path="/2257" element={<Compliance2257 config={config} />} />
                    <Route path="/dmca" element={<DMCA />} />
                    {/* Public pages also available on members.* for completeness
                        (/about merged into Home page, no longer a standalone route) */}
                    <Route path="/gallery" element={<Gallery images={config.images.gallery} />} />
                    <Route path="/blog" element={<Blog blog={config.blog} />} />
                    <Route path="/blog/:id" element={<BlogPost blog={config.blog} />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                ) : (
                  // ── marketing root domain — public-safe, scrubbed of monetization language ──
                  <Routes>
                    <Route path="/" element={<Home config={config} />} />
                    {/* /about merged into Home — no standalone route */}
                    <Route path="/gallery" element={<Gallery images={config.images.gallery} />} />
                    <Route path="/blog" element={<Blog blog={config.blog} />} />
                    <Route path="/blog/:id" element={<BlogPost blog={config.blog} />} />
                    {/* Legal pages — kept on root for compliance + SEO */}
                    <Route path="/terms" element={<Terms config={config} />} />
                    <Route path="/privacy" element={<Privacy config={config} />} />
                    <Route path="/2257" element={<Compliance2257 config={config} />} />
                    <Route path="/dmca" element={<DMCA />} />
                    {/* Tracked bio-link shortlink → 302 to members subdomain /register?via=:character */}
                    <Route path="/r/:character" element={<ShortlinkRedirect />} />
                    {/* All fan-facing routes (register/login/dashboard/vault/chat/admin/...)
                        are intentionally NOT mounted on root — they live on members.* */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                )}
                {/* Scroll-triggered members CTA — root domain only. Lazy
                    chunk + scroll detection means bots that download the
                    HTML and leave never trigger it. */}
                {!isMembersDomain() && <MembersScrollCta config={config} />}
                {/* Floating "Support with a card" pill — root domain only, always
                    visible while scrolling. Bot-safe (neutral copy + /f/ link). */}
                {!isMembersDomain() && <FanvueFloat fanvue={config.fanvue} />}
              </Suspense>
            </main>
            <Footer config={config} />
          </>
        )}
      </div>
    </Router>
  );
}

export default App;
