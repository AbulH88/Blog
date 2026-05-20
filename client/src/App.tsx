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

// Lazy — heavy or behind-login pages. Saves ~150KB from the initial bundle.
// Fans browsing Home → Vault don't download Admin's 1800-line component
// until they actually visit /admin (which most never will).
const Gallery        = lazy(() => import('./pages/Gallery'));
const Vault          = lazy(() => import('./pages/Vault'));
const Blog           = lazy(() => import('./pages/Blog'));
const About          = lazy(() => import('./pages/About'));
const Admin          = lazy(() => import('./pages/Admin'));
const FanDashboard   = lazy(() => import('./pages/FanDashboard'));
const Chat           = lazy(() => import('./pages/Chat'));
const Terms          = lazy(() => import('./pages/Terms'));
const Privacy        = lazy(() => import('./pages/Privacy'));
const Compliance2257 = lazy(() => import('./pages/Compliance2257'));
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
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute('content', data.seo.metaDescription || '');
        } else {
          const meta = document.createElement('meta');
          meta.name = 'description';
          meta.content = data.seo.metaDescription || '';
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
      setOg('og:title', data.seo?.metaTitle || data.siteTitle);
      setOg('og:description', data.seo?.metaDescription || data.homeBio?.slice(0, 200));
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
              fanvueUrl={config.fanvueUrl}
              logoUrl={config.logoUrl}
              avatarUrl={config.chatAvatarUrl || config.images?.hero || config.images?.heroSlider?.[0] || config.logoUrl}
            />
            <main className="container">
              <Suspense fallback={<RouteLoader />}>
                <Routes>
                  <Route path="/" element={<Home config={config} />} />
                  <Route path="/gallery" element={<Gallery images={config.images.gallery} />} />
                  <Route path="/vault" element={<Vault config={config} />} />
                  <Route path="/blog" element={<Blog blog={config.blog} />} />
                  <Route path="/about" element={<About config={config} />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register config={config} />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/verify-email" element={<VerifyEmail />} />
                  <Route path="/dashboard" element={<FanDashboard />} />
                  <Route path="/chat" element={<Chat config={config} />} />
                  <Route path="/terms" element={<Terms config={config} />} />
                  <Route path="/privacy" element={<Privacy config={config} />} />
                  <Route path="/2257" element={<Compliance2257 config={config} />} />
                  <Route path="/dmca" element={<DMCA />} />
                  <Route path="/payment/return" element={<PaymentReturn />} />
                  <Route path="/dashboard/payment-methods" element={<Navigate to="/dashboard/settings/payments" replace />} />
                  <Route path="/dashboard/settings" element={<FanSettings />} />
                  <Route path="/dashboard/settings/:section" element={<FanSettings />} />
                  <Route path="/admin" element={<Admin config={config} refreshConfig={refreshConfig} />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
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
