import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import logo from '/logo.png';
import { Loader2, Mail, Lock, User, ArrowRight, Github } from 'lucide-react';

function Login() {
  const { login, signUp, googleSignIn } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signUp(email, password, name);
        // Supabase might require email confirmation depending on settings
        setError('Check your email for the confirmation link!');
      }
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await googleSignIn();
    } catch (err) {
      setError(err.message || 'Google login failed');
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--canvas)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
        fontFamily: 'var(--font)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Ghost watermark ── */}
      <div
        className="watermark"
        style={{
          position: 'absolute',
          top: '8%',
          left: '50%',
          transform: 'translateX(-50%)',
          whiteSpace: 'nowrap',
          fontFamily: 'var(--font-logo)',
          letterSpacing: '-0.04em',
          fontWeight: 800,
          userSelect: 'none',
          pointerEvents: 'none',
          opacity: 0.04
        }}
      >
        GAP Social‑pilot
      </div>

      {/* ── Orbital arc SVG ── */}
      <svg
        aria-hidden="true"
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
        viewBox="0 0 1200 800"
        preserveAspectRatio="none"
      >
        <path
          d="M -100 500 Q 350 150 800 480 Q 1050 680 1350 300"
          stroke="#FF5600"
          strokeWidth="1.5"
          fill="none"
          opacity="0.5"
        />
        <path
          d="M 50 700 Q 400 300 900 600"
          stroke="#FF5600"
          strokeWidth="1"
          fill="none"
          opacity="0.3"
        />
      </svg>

      {/* ── Card ── */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        style={{
          width: '100%',
          maxWidth: 440,
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Logo + brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.4 }}
            style={{
              width: 70,
              height: 70,
              borderRadius: '50%',
              background: 'var(--ink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              boxShadow: '0 12px 40px rgba(20,20,19,0.18)',
            }}
          >
            <img src={logo} alt="GAP Social-pilot" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          </motion.div>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: 'var(--ink)',
              lineHeight: 1.1,
              margin: '0 0 8px',
            }}
          >
            {mode === 'login' ? 'Broadcast everywhere.' : 'Join the pilot.'}
          </h1>
          <p
            style={{
              fontSize: 15,
              fontWeight: 450,
              color: 'var(--slate)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {mode === 'login' ? 'Welcome back! Sign in to continue.' : 'Create an account to get started.'}
          </p>
        </div>

        {/* Auth Card */}
        <div
          style={{
            background: 'var(--canvas-lifted)',
            borderRadius: 'var(--r-hero)',
            padding: 'clamp(24px, 8vw, 36px) clamp(20px, 8vw, 32px)',
            boxShadow: 'var(--shadow-card)',
            border: '1px solid rgba(20,20,19,0.07)',
          }}
        >
          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  color: '#ef4444',
                  padding: '12px 16px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 500,
                  marginBottom: 20,
                  border: '1px solid rgba(239,68,68,0.12)',
                }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {mode === 'signup' && (
              <div className="input-group" style={{ position: 'relative' }}>
                <User size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate)' }} />
                <input
                  type="text"
                  placeholder="Full Name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 14px 12px 42px',
                    borderRadius: 'var(--r-btn)',
                    border: '1.5px solid rgba(20,20,19,0.1)',
                    background: 'var(--white)',
                    fontSize: 14,
                    fontWeight: 500,
                    outline: 'none',
                    transition: 'border-color 0.2s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = 'var(--ink)')}
                  onBlur={(e) => (e.target.style.borderColor = 'rgba(20,20,19,0.1)')}
                />
              </div>
            )}

            <div className="input-group" style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate)' }} />
              <input
                type="email"
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  borderRadius: 'var(--r-btn)',
                  border: '1.5px solid rgba(20,20,19,0.1)',
                  background: 'var(--white)',
                  fontSize: 14,
                  fontWeight: 500,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--ink)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(20,20,19,0.1)')}
              />
            </div>

            <div className="input-group" style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--slate)' }} />
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  borderRadius: 'var(--r-btn)',
                  border: '1.5px solid rgba(20,20,19,0.1)',
                  background: 'var(--white)',
                  fontSize: 14,
                  fontWeight: 500,
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--ink)')}
                onBlur={(e) => (e.target.style.borderColor = 'rgba(20,20,19,0.1)')}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-ink"
              style={{
                width: '100%',
                fontSize: 15,
                padding: '12px 24px',
                marginTop: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div style={{ position: 'relative', margin: '24px 0', textAlign: 'center' }}>
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(20,20,19,0.08)' }} />
            <span style={{ position: 'relative', background: 'var(--canvas-lifted)', padding: '0 12px', fontSize: 12, fontWeight: 600, color: 'var(--dust)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Or continue with
            </span>
          </div>

          {/* OAuth / SSO buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* GetAiPilot Hub SSO button */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                const hubUrl = 'https://getaipilot.in';
                window.location.href = `${hubUrl}/login?sso=social`;
              }}
              disabled={loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                padding: '12px 24px',
                background: 'linear-gradient(135deg, #031b4e 0%, #0d3880 100%)',
                border: '1px solid rgba(3,27,78,0.2)',
                borderRadius: 'var(--r-btn)',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                fontSize: 14,
                fontWeight: 600,
                color: '#ffffff',
                letterSpacing: '-0.01em',
                boxShadow: '0 2px 8px rgba(3,27,78,0.15)',
                transition: 'all 0.2s',
              }}
            >
              <img
                src="/logo.png"
                alt="GetAiPilot Logo"
                style={{ width: 18, height: 18, borderRadius: 4, objectFit: 'contain' }}
              />
              <span>Continue with GetAiPilot</span>
            </motion.button>

            {/* Google button */}
            <motion.button
              type="button"
              whileHover={{ opacity: 0.88 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleGoogleLogin}
              disabled={loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: '12px 24px',
                background: 'var(--white)',
                border: '1.5px solid rgba(20,20,19,0.1)',
                borderRadius: 'var(--r-btn)',
                cursor: 'pointer',
                fontFamily: 'var(--font)',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--ink)',
                letterSpacing: '-0.01em',
                transition: 'all 0.2s',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>Continue with Google</span>
            </motion.button>
          </div>

          {/* Toggle Mode */}
          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              style={{
                background: 'none',
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--arc)',
                cursor: 'pointer',
                padding: 4,
              }}
            >
              {mode === 'login' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--dust)', marginTop: 20, lineHeight: 1.5 }}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}

export default Login;
