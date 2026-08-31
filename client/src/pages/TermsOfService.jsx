import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LandingNav } from '../features/landing';
import { 
  CheckCircle2,
  Zap,
  UserCheck,
  Youtube,
  Trash2,
  Scale,
  Mail,
  RefreshCw,
  Info,
  AlertCircle
} from 'lucide-react';
import logo from '/logo.png';

const SECTIONS = [
  { id: 'acceptance', title: '1. Acceptance', icon: <CheckCircle2 size={16} strokeWidth={2.5} /> },
  { id: 'service', title: '2. Service Description', icon: <Zap size={16} strokeWidth={2.5} /> },
  { id: 'responsibilities', title: '3. User Responsibilities', icon: <UserCheck size={16} strokeWidth={2.5} /> },
  { id: 'platforms', title: '4. API & Platform Terms', icon: <Youtube size={16} strokeWidth={2.5} /> },
  { id: 'termination', title: '5. Account Termination', icon: <Trash2 size={16} strokeWidth={2.5} /> },
  { id: 'liability', title: '6. Limitation of Liability', icon: <Scale size={16} strokeWidth={2.5} /> },
  { id: 'contact', title: '7. Contact Us', icon: <Mail size={16} strokeWidth={2.5} /> },
];

export default function TermsOfService() {
  const [activeSection, setActiveSection] = useState('acceptance');

  useEffect(() => {
    window.scrollTo(0, 0);

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { threshold: 0.2, rootMargin: '-10% 0px -70% 0px' }
    );

    SECTIONS.forEach((section) => {
      const el = document.getElementById(section.id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 100;
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--canvas)', fontFamily: 'var(--font)', display: 'flex', flexDirection: 'column' }}>
      <LandingNav />
      
      <main style={{ flexGrow: 1, padding: '48px 24px', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* Sidebar */}
          <aside className="hidden lg:block w-full max-w-[300px] shrink-0">
            <div className="custom-scrollbar" style={{ position: 'sticky', top: 100, display: 'flex', flexDirection: 'column', gap: 24, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
              <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--slate)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--ink)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--slate)'}>
                ← Back to Home
              </Link>

              <nav style={{ background: 'var(--canvas-lifted)', borderRadius: 'var(--r-btn)', border: '1px solid rgba(20,20,19,0.08)', overflow: 'hidden' }}>
                <p style={{ padding: '12px 16px', margin: 0, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--slate)', borderBottom: '1px solid rgba(20,20,19,0.08)', background: 'rgba(20,20,19,0.02)' }}>
                  Legal Contents
                </p>
                <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {SECTIONS.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px',
                        borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer', textAlign: 'left',
                        fontSize: 13, fontWeight: 600, fontFamily: 'var(--font)', transition: 'all 0.15s',
                        background: activeSection === section.id ? 'var(--ink)' : 'transparent',
                        color: activeSection === section.id ? 'var(--canvas)' : 'var(--slate)',
                      }}
                      onMouseEnter={e => { if (activeSection !== section.id) { e.currentTarget.style.background = 'rgba(20,20,19,0.04)'; e.currentTarget.style.color = 'var(--ink)'; } }}
                      onMouseLeave={e => { if (activeSection !== section.id) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--slate)'; } }}
                    >
                      {section.title}
                    </button>
                  ))}
                </div>
              </nav>

              <div style={{ padding: 24, background: 'var(--ink)', borderRadius: 'var(--r-btn)', color: 'var(--canvas)', position: 'relative', overflow: 'hidden' }}>
                 <svg aria-hidden="true" style={{ position: 'absolute', bottom: -20, left: -20, opacity: 0.15, pointerEvents: 'none' }} width="150" height="150" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" stroke="#FF5600" strokeWidth="2" fill="none" />
                 </svg>
                 <div style={{ position: 'relative', zIndex: 1 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--arc)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 8px' }}>Legal Affairs</p>
                  <p style={{ fontSize: 14, fontWeight: 450, color: 'rgba(243,240,238,0.7)', margin: '0 0 20px', lineHeight: 1.5 }}>Need clarification on our terms? Our team is available.</p>
                  <a href="mailto:getaipilot@gmail.com" style={{ display: 'block', textAlign: 'center', background: 'var(--canvas)', color: 'var(--ink)', fontWeight: 600, fontSize: 13, padding: '12px', borderRadius: 'var(--r-sm)', textDecoration: 'none', transition: 'opacity 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                  >
                    Contact Legal
                  </a>
                 </div>
              </div>
            </div>
          </aside>

          {/* Content */}
          <article style={{ flex: 1, background: 'var(--canvas-lifted)', border: '1px solid rgba(20,20,19,0.08)', borderRadius: 'var(--r-hero)', padding: 'clamp(32px, 5vw, 64px)', position: 'relative', overflow: 'hidden' }}>
            
             <div style={{ position: 'absolute', top: -40, right: -40, opacity: 0.03, pointerEvents: 'none' }}>
              <Scale size={400} strokeWidth={1} />
            </div>
            
            <header style={{ marginBottom: 64, paddingBottom: 48, borderBottom: '1px solid rgba(20,20,19,0.08)', position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <img src={logo} alt="GAP Social-pilot" style={{ width: 48, height: 48, objectFit: 'contain' }} />
                <div style={{ padding: '6px 12px', background: 'rgba(20,20,19,0.06)', borderRadius: 'var(--r-pill)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--ink)' }}>
                  Service Terms
                </div>
              </div>
              <h1 style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.02em', margin: '0 0 24px', lineHeight: 1.1 }}>Terms of Service</h1>
              <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--slate)', margin: 0, fontWeight: 500 }}>
                <RefreshCw size={14} />
                Last updated: <span style={{ color: 'var(--ink)', fontWeight: 700 }}>April 18, 2026</span>
              </p>
            </header>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 64, position: 'relative', zIndex: 1 }}>
              
              <section id="acceptance" style={{ scrollMarginTop: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 40, height: 40, background: 'var(--ink)', borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--canvas)' }}>
                    <CheckCircle2 size={20} />
                  </div>
                  <h2 style={{ fontSize: 28, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>1. Acceptance of Terms</h2>
                </div>
                <div style={{ color: 'var(--Charcoal)', fontSize: 16, lineHeight: 1.6, fontWeight: 450, display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ margin: 0 }}>By accessing or using <strong style={{ fontWeight: 600 }}>GAP Social-pilot</strong>, you agree to be bound by these Terms of Service. If you do not agree to all of these terms, you are prohibited from using the service.</p>
                  <p style={{ margin: 0 }}>We reserve the right to modify these terms at any time. Your continued use of the service after changes are posted constitutes your acceptance of the new terms.</p>
                </div>
              </section>

              <section id="service" style={{ scrollMarginTop: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 40, height: 40, background: 'var(--ink)', borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--canvas)' }}>
                    <Zap size={20} />
                  </div>
                  <h2 style={{ fontSize: 28, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>2. Service Description</h2>
                </div>
                <div style={{ padding: 32, background: 'var(--canvas)', border: '1px solid rgba(20,20,19,0.08)', borderRadius: 'var(--r-hero)', fontSize: 16, fontStyle: 'italic', color: 'var(--slate)', fontWeight: 500, lineHeight: 1.6 }}>
                   "GAP Social-pilot provides a unified platform for multi-channel social media broadcasting, automation, and management across supported platforms including YouTube, Meta, Pinterest, and Bluesky."
                </div>
              </section>

              <section id="responsibilities" style={{ scrollMarginTop: 120 }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 40, height: 40, background: 'var(--ink)', borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--canvas)' }}>
                    <UserCheck size={20} />
                  </div>
                  <h2 style={{ fontSize: 28, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>3. User Responsibilities</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
                  {[
                    { title: 'Account Security', desc: 'Maintaining the confidentiality of your login credentials.' },
                    { title: 'Content Legality', desc: 'Ensuring broadcasted content complies with all applicable laws.' },
                    { title: 'API Compliance', desc: 'Following the terms of connected third-party social platforms.' },
                    { title: 'Authorized Use', desc: 'Not using the service for spam or unauthorized automation.' }
                  ].map((item, i) => (
                    <div key={i} style={{ padding: 24, background: 'var(--canvas)', border: '1px solid rgba(20,20,19,0.08)', borderRadius: 'var(--r-btn)', transition: 'border-color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(20,20,19,0.2)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(20,20,19,0.08)'}
                    >
                      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>{item.title}</h3>
                      <p style={{ fontSize: 14, color: 'var(--slate)', fontWeight: 450, margin: 0, lineHeight: 1.5 }}>{item.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section id="platforms" style={{ scrollMarginTop: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 40, height: 40, background: 'var(--ink)', borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--canvas)' }}>
                    <Youtube size={20} />
                  </div>
                  <h2 style={{ fontSize: 28, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>4. API & Platform Terms</h2>
                </div>
                <p style={{ fontSize: 16, color: 'var(--Charcoal)', margin: '0 0 32px' }}>GAP Social-pilot integrates with third-party APIs. By using these integrations, you agree to their respective terms:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: 24, background: 'rgba(207,69,0,0.04)', borderRadius: 'var(--r-btn)', border: '1px solid rgba(207,69,0,0.15)' }}>
                    <Info size={20} color="var(--signal)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', margin: 0, lineHeight: 1.6 }}>
                      <strong style={{ fontWeight: 700 }}>YouTube:</strong> By using YouTube broadcasting, you agree to the <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--signal)', textDecoration: 'underline' }}>YouTube Terms of Service</a>.
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: 24, background: 'rgba(255,86,0,0.05)', borderRadius: 'var(--r-btn)', border: '1px solid rgba(255,86,0,0.2)' }}>
                    <Info size={20} color="var(--arc)" style={{ marginTop: 2, flexShrink: 0 }} />
                    <p style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', margin: 0, lineHeight: 1.6 }}>
                      <strong style={{ fontWeight: 700 }}>Meta:</strong> Access to Facebook and Instagram is subject to <a href="https://www.facebook.com/terms.php" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--arc)', textDecoration: 'underline' }}>Meta's Terms</a> and Developer Policies.
                    </p>
                  </div>
                </div>
              </section>

              <section id="termination" style={{ scrollMarginTop: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 40, height: 40, background: 'var(--signal)', borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                    <Trash2 size={20} />
                  </div>
                  <h2 style={{ fontSize: 28, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>5. Account Termination</h2>
                </div>
                <div style={{ padding: 40, background: 'var(--ink)', borderRadius: 'var(--r-hero)', color: 'var(--canvas)', display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <p style={{ fontSize: 16, fontWeight: 450, lineHeight: 1.6, margin: 0, color: 'rgba(243,240,238,0.85)' }}>
                    We reserve the right to suspend or terminate your access to GAP Social-pilot at any time, without notice, for conduct that we believe violates these Terms or is harmful to our business interests.
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--signal)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    <AlertCircle size={16} /> Policy Enforcement active
                  </div>
                </div>
              </section>

               <section id="liability" style={{ scrollMarginTop: 120 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                  <div style={{ width: 40, height: 40, background: 'var(--ink)', borderRadius: 'var(--r-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--canvas)' }}>
                    <Scale size={20} />
                  </div>
                  <h2 style={{ fontSize: 28, fontWeight: 500, color: 'var(--ink)', letterSpacing: '-0.02em', margin: 0 }}>6. Limitation of Liability</h2>
                </div>
                <div style={{ padding: 32, border: '2px dashed rgba(20,20,19,0.15)', borderRadius: 'var(--r-hero)' }}>
                  <p style={{ fontSize: 16, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.6, margin: 0 }}>
                     GAP Social-pilot shall not be liable for any indirect, incidental, special, or consequential damages resulting from the use or the inability to use the service, including but not limited to damages for loss of profits or data.
                  </p>
                </div>
              </section>

              <section id="contact" style={{ scrollMarginTop: 120, paddingTop: 48, borderTop: '1px solid rgba(20,20,19,0.08)' }}>
                 <div style={{ background: 'var(--ink)', borderRadius: 'var(--r-hero)', padding: 64, textAlign: 'center', color: 'var(--canvas)', position: 'relative', overflow: 'hidden' }}>
                    {/* Orbital Arc Background */}
                   <svg aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.4 }} viewBox="0 0 1000 400" preserveAspectRatio="none">
                     <path d="M -50 320 Q 250 60 600 280 Q 800 400 1100 150" stroke="#FF5600" strokeWidth="1.5" fill="none" />
                   </svg>
                   
                   <div style={{ position: 'relative', zIndex: 1 }}>
                     <h2 style={{ fontSize: 'clamp(32px, 5vw, 44px)', fontWeight: 500, letterSpacing: '-0.02em', margin: '0 0 24px' }}>Legal Questions?</h2>
                     <p style={{ fontSize: 16, fontWeight: 450, color: 'rgba(243,240,238,0.7)', margin: '0 auto 40px', maxWidth: 500, lineHeight: 1.5 }}>
                       If you have any questions regarding these terms, please reach out to our legal department.
                     </p>
                     <a href="mailto:getaipilot@gmail.com" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '16px 40px', background: 'var(--canvas)', color: 'var(--ink)', borderRadius: 'var(--r-btn)', fontSize: 15, fontWeight: 600, textDecoration: 'none', transition: 'opacity 0.2s' }}
                       onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                       onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                     >
                       <Mail size={18} />
                       Contact Legal
                     </a>
                   </div>
                 </div>
               </section>

            </div>
          </article>
        </div>
      </main>

      {/* Footer matches LandingPage */}
      <footer style={{ background: 'var(--canvas)', borderTop: '1px solid rgba(20,20,19,0.08)', padding: '32px 32px' }}>
        <div className="landing-container" style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 450, color: 'var(--slate)' }}>
              © 2026 GAP Social-pilot. All rights reserved.
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <Link to="/dashboard/docs" style={{ fontSize: 13, fontWeight: 500, color: 'var(--slate)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--ink)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--slate)'}>
                Docs & Guide
              </Link>
              <Link to="/privacy" style={{ fontSize: 13, fontWeight: 500, color: 'var(--slate)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--ink)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--slate)'}>
                Privacy Policy
              </Link>
              <Link to="/terms" style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)', textDecoration: 'none' }}>
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
