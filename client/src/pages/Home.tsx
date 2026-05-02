import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { SERVER_URL } from '../api';

const Home = ({ config }: { config: any }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const revealRefs = useRef<HTMLDivElement[]>([]);
  
  const getFullUrl = (path: string) => path.startsWith('http') ? path : `${SERVER_URL}${path}`;

  const slides = config.images.heroSlider && config.images.heroSlider.length > 0 
    ? config.images.heroSlider 
    : ['https://via.placeholder.com/1200x1920'];

  const previewImages = config.images.gallery?.slice(0, 3) || [];
  const featuredPosts = config.blog?.slice(0, 2) || [];

  useEffect(() => {
    if (slides.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [slides]);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('active');
        }
      });
    }, { threshold: 0.1 });

    const currentRefs = revealRefs.current;
    currentRefs.forEach(ref => {
      if (ref) observer.observe(ref);
    });

    return () => {
      currentRefs.forEach(ref => {
        if (ref) observer.unobserve(ref);
      });
    };
  }, []);

  const addToRefs = (el: HTMLDivElement | null) => {
    if (el && !revealRefs.current.includes(el)) {
      revealRefs.current.push(el);
    }
  };

  return (
    <div className="home-content">
      
      {/* 1. Cinematic Hero Slider */}
      <div className="full-page-slider">
        {slides.map((slide: string, index: number) => (
          <img 
            key={index}
            src={getFullUrl(slide)} 
            className={`slider-image ${index === currentSlide ? 'active' : ''}`}
            loading={index === 0 ? 'eager' : 'lazy'}
            alt=""
          />
        ))}
        
        <div className="slider-overlay">
          <h1 style={{ fontFamily: '"Playfair Display", serif', letterSpacing: '12px' }}>{config.heroTitle}</h1>
          <p style={{ fontStyle: 'italic', opacity: 0.8 }}>{config.heroSubtitle}</p>
          <div className="cta-group">
            <Link to="/gallery" className="btn btn-primary" style={{ border: 'none' }}>Explore My World</Link>
          </div>
        </div>

        <div className="scroll-indicator">
           <div className="mouse"><div className="wheel"></div></div>
           <span style={{ fontSize: '0.6rem', letterSpacing: '3px', textTransform: 'uppercase' }}>Scroll</span>
        </div>

        {slides.length > 1 && (
          <div className="slider-dots">
            {slides.map((_: any, index: number) => (
              <div 
                key={index} 
                className={`dot ${index === currentSlide ? 'active' : ''}`}
                onClick={() => setCurrentSlide(index)}
              ></div>
            ))}
          </div>
        )}
      </div>

      <div className="container">
        
        {/* 2. Bio Section */}
        <div className="reveal home-bio" ref={addToRefs}>
          <div style={{ width: '40px', height: '1px', background: 'var(--primary)', margin: '0 auto 30px' }}></div>
          <p>{config.homeBio}</p>
          <div style={{ width: '40px', height: '1px', background: 'var(--primary)', margin: '30px auto 0' }}></div>
        </div>

        {/* 3. Latest Visuals */}
        <section className="reveal featured-preview" ref={addToRefs}>
          <h2 className="section-title">Latest Visuals</h2>
          <div className="gallery-grid">
            {previewImages.map((img: string, idx: number) => (
              <div key={idx} className="gallery-item">
                <img src={getFullUrl(img)} alt={`Visual ${idx}`} loading="lazy" />
              </div>
            ))}
          </div>
        </section>

        {/* 4. Must Haves (Influencer Gear) */}
        {config.settings?.showMustHaves && config.mustHaves && (
          <section className="reveal" ref={addToRefs} style={{ marginTop: '100px' }}>
            <h2 className="section-title">My Essentials</h2>
            <div className="must-haves-grid">
              {config.mustHaves.map((item: any, idx: number) => (
                <div key={idx} className="product-card">
                  <img src={item.image} alt={item.name} />
                  <h5>{item.name}</h5>
                  <a href={item.link} className="btn-link" style={{ fontSize: '0.7rem', textDecoration: 'underline', marginTop: '10px', display: 'block' }}>Shop Item</a>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. FAQ (Engagement) */}
        {config.settings?.showFaq && config.faq && (
          <section className="reveal" ref={addToRefs} style={{ marginTop: '100px' }}>
            <h2 className="section-title">Common Questions</h2>
            <div className="faq-container">
              {config.faq.map((item: any, idx: number) => (
                <div key={idx} className="faq-item">
                  <h4>{item.q}</h4>
                  <p>{item.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 6. Featured Blog Posts */}
        {featuredPosts.length > 0 && (
          <section className="reveal featured-blog" ref={addToRefs}>
             <h2 className="section-title">Personal Diaries</h2>
             <div className="blog-grid">
                {featuredPosts.map((post: any) => (
                  <div key={post.id} className="blog-mini-card">
                     <h4>{post.title}</h4>
                     <p style={{ fontSize: '0.9rem', color: 'var(--secondary)', marginBottom: '20px' }}>{post.excerpt}</p>
                     <Link to="/blog" style={{ fontSize: '0.7rem', letterSpacing: '2px', textTransform: 'uppercase', textDecoration: 'underline' }}>Read Entry</Link>
                  </div>
                ))}
             </div>
          </section>
        )}

        {/* 7. Main Funnel CTA */}
        <div className="reveal cta-group" ref={addToRefs} style={{ margin: '120px 0' }}>
           <div style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: '2rem', letterSpacing: '5px', marginBottom: '30px' }}>JOIN THE CLUB</h2>
              <Link to="/vip" className="btn btn-primary">Get Exclusive Access 🔒</Link>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
