import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getCreator } from './api';
import './styles/main.css';
import './styles/theme-v3.css';

import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AgeGate from './components/AgeGate';

import Home from './pages/Home';
import Gallery from './pages/Gallery';
import Vault from './pages/Vault';
import Blog from './pages/Blog';
import About from './pages/About';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Register from './pages/Register';
import FanDashboard from './pages/FanDashboard';
import Chat from './pages/Chat';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import Compliance2257 from './pages/Compliance2257';
import PaymentReturn from './pages/PaymentReturn';
import PaymentMethods from './pages/PaymentMethods';

const Maintenance = () => (
  <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: '#000', color: '#fff' }}>
    <h1>Coming Soon</h1>
    <p>We are currently updating our digital experience. Please check back later.</p>
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
    };
    fetchConfig();
  }, []);

  if (!config) return <div className="loading">Loading...</div>;

  const isMaintenance = config.settings?.maintenanceMode;

  return (
    <Router>
      {!isVerified && !isMaintenance && <AgeGate onVerify={() => setIsVerified(true)} />}
      <div className="app">
        {isMaintenance ? (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<Admin config={config} refreshConfig={refreshConfig} />} />
            <Route path="*" element={<Maintenance />} />
          </Routes>
        ) : (
          <>
            <Navbar siteTitle={config.siteTitle} fanvueUrl={config.fanvueUrl} logoUrl={config.logoUrl} />
            <main className="container">
              <Routes>
                <Route path="/" element={<Home config={config} />} />
                <Route path="/gallery" element={<Gallery images={config.images.gallery} />} />
                <Route path="/vault" element={<Vault config={config} />} />
                <Route path="/blog" element={<Blog blog={config.blog} />} />
                <Route path="/about" element={<About config={config} />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register config={config} />} />
                <Route path="/dashboard" element={<FanDashboard />} />
                <Route path="/chat" element={<Chat config={config} />} />
                <Route path="/terms" element={<Terms config={config} />} />
                <Route path="/privacy" element={<Privacy config={config} />} />
                <Route path="/2257" element={<Compliance2257 config={config} />} />
                <Route path="/payment/return" element={<PaymentReturn />} />
                <Route path="/dashboard/payment-methods" element={<PaymentMethods />} />
                <Route path="/admin" element={<Admin config={config} refreshConfig={refreshConfig} />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </main>
            <Footer config={config} />
          </>
        )}
      </div>
    </Router>
  );
}

export default App;
