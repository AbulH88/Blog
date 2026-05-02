import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { getConfig } from './api';
import './styles/main.css';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import AgeGate from './components/AgeGate';

// Pages
import Home from './pages/Home';
import Gallery from './pages/Gallery';
import VIP from './pages/VIP';
import Blog from './pages/Blog';
import About from './pages/About';
import Admin from './pages/Admin';
import Login from './pages/Login';

const Maintenance = () => (
  <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', background: '#000', color: '#fff' }}>
    <h1>Coming Soon</h1>
    <p>We are currently updating our digital experience. Please check back later.</p>
  </div>
);

function App() {
  const [config, setConfig] = useState<any>(null);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    const fetchConfig = async () => {
      const data = await getConfig();
      setConfig(data);
      
      // Apply Theme
      if (data.theme) {
        const root = document.documentElement;
        root.style.setProperty('--primary', data.theme.primaryColor || '#ffffff');
        root.style.setProperty('--bg', data.theme.backgroundColor || '#0a0a0a');
        root.style.setProperty('--accent', data.theme.accentColor || '#ffffff');
        document.body.style.fontFamily = data.theme.fontFamily || "'Didot', serif";
      }

      // Apply SEO
      if (data.seo) {
        document.title = data.seo.metaTitle || data.siteTitle;
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
          metaDesc.setAttribute('content', data.seo.metaDescription);
        } else {
          const meta = document.createElement('meta');
          meta.name = "description";
          meta.content = data.seo.metaDescription;
          document.head.appendChild(meta);
        }
        
        // Favicon
        if (data.seo.favicon) {
          let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = data.seo.favicon;
        }
      }
    };
    fetchConfig();
    
    if (localStorage.getItem('ageVerified') === 'true') {
      setIsVerified(true);
    }
  }, []);

  if (!config) return <div className="loading">Loading...</div>;

  // Maintenance Mode Check (except for Admin/Login)
  const isMaintenance = config.settings?.maintenanceMode;

  return (
    <Router>
      {!isVerified && !isMaintenance && <AgeGate onVerify={() => setIsVerified(true)} />}
      <div className="app">
        {isMaintenance ? (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<Admin config={config} refreshConfig={async () => setConfig(await getConfig())} />} />
            <Route path="*" element={<Maintenance />} />
          </Routes>
        ) : (
          <>
            <Navbar siteTitle={config.siteTitle} />
            <main className="container">
              <Routes>
                <Route path="/" element={<Home config={config} />} />
                <Route path="/gallery" element={<Gallery images={config.images.gallery} />} />
                <Route path="/vip" element={<VIP config={config} />} />
                <Route path="/blog" element={<Blog blog={config.blog} />} />
                <Route path="/about" element={<About bio={config.bio} />} />
                <Route path="/login" element={<Login />} />
                <Route path="/admin" element={<Admin config={config} refreshConfig={async () => setConfig(await getConfig())} />} />
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
