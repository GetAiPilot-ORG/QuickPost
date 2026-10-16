/**
 * SSOPage.jsx — /social-sso
 *
 * Landing page for inbound SSO from getaipilot.in.
 * Reads ?token= from the URL, sends it to the Express server for
 * verification, then follows the returned Supabase magic-link which
 * creates a real session and redirects to /auth/callback.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');

function SSOPage() {
  const navigate = useNavigate();
  const [status,  setStatus]  = useState('processing');
  const [message, setMessage] = useState('Signing you in from GetAiPilot…');

  useEffect(() => {
    const controller = new AbortController();

    const processSSO = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const token = searchParams.get('token');
      const requestedReturnTo = searchParams.get('returnTo');
      const returnTo = requestedReturnTo && /^\/dashboard(?:\/|$)/.test(requestedReturnTo)
        ? requestedReturnTo
        : '/dashboard';

      if (token) {
        try {
          const payloadPart = token.split('.')[0];
          const base64 = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
          const decodedPayload = JSON.parse(atob(base64));
          const ssoEmail = decodedPayload?.email;

          const { data: { session } } = await supabase.auth.getSession();
          if (session && session.user?.email === ssoEmail) {
            navigate(returnTo, { replace: true });
            return;
          }

          if (session) {
            await supabase.auth.signOut();
          }
        } catch (e) {
          console.error("SSO token parsing error:", e);
        }
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          navigate(returnTo, { replace: true });
          return;
        }

        setStatus('error');
        setMessage('No SSO token found. Please try launching Social Pilot again from GetAiPilot.');
        return;
      }

      try {
        const res  = await fetch(`${API_URL}/api/auth/sso`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ token }),
          signal:  controller.signal,
        });
        const data = await res.json().catch(() => ({}));

        if (controller.signal.aborted) return;

        if (!res.ok || !data.magic_link_url) {
          const msg = data.error === 'SSO token already used'
            ? 'This sign-in link has already been used. Please go back to GetAiPilot and click Launch Social Pilot again.'
            : (data.error || 'Authentication failed. Please try again.');
          setStatus('error');
          setMessage(msg);
          return;
        }

        sessionStorage.setItem('qp_sso_return_to', returnTo);
        setMessage('Redirecting to your workspace…');
        window.location.href = data.magic_link_url;

      } catch (err) {
        if (err.name === 'AbortError') return;
        setStatus('error');
        setMessage('Network error. Please check your connection and try again.');
      }
    };

    processSSO();
    return () => { controller.abort(); };
  }, []);

  return (
    <div
      style={{
        minHeight:      '100vh',
        background:     'var(--canvas)',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        padding:        '24px',
        fontFamily:     'var(--font-body)',
      }}
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          background:   'var(--canvas-lifted)',
          borderRadius: 'var(--r-xl)',
          padding:      '48px 40px',
          maxWidth:     380,
          width:        '100%',
          textAlign:    'center',
          boxShadow:    'var(--shadow-modal)',
          border:       '1px solid rgba(20,20,19,0.07)',
        }}
      >
        {status === 'processing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(255,86,0,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Loader2
                size={28}
                style={{ color: 'var(--arc)', animation: 'spin 0.8s linear infinite' }}
                aria-hidden="true"
              />
            </div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                Signing you in…
              </h2>
              <p style={{ fontSize: 14, color: 'var(--slate)', margin: 0 }}>
                {message}
              </p>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              background: 'rgba(220,38,38,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <AlertCircle size={28} style={{ color: 'var(--danger)' }} aria-hidden="true" />
            </div>
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
                Sign-in failed
              </h2>
              <p style={{ fontSize: 14, color: 'var(--slate)', margin: '0 0 20px' }}>
                {message}
              </p>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="btn-ghost"
                style={{ fontSize: 13 }}
              >
                <RefreshCw size={13} aria-hidden="true" />
                Sign in manually
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SSOPage;
