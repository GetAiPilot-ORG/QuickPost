/**
 * AuthCallback.jsx — Fixed version
 * ─────────────────────────────────────────────────────────────────
 * Fixes:
 * 1. Race condition: cancelled flag prevents setState after unmount
 * 2. onboarding_done check before redirecting to /dashboard
 * 3. Accessible: role="status" on status message
 * 4. Button to retry on error
 *
 * Replace: client/src/components/AuthCallback.jsx
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Completing authentication…');

  useEffect(() => {
    let cancelled = false; // unmount guard

    const checkSession = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (cancelled) return; // component unmounted — bail out
        if (error) throw error;

        if (session) {
          const requestedDestination = sessionStorage.getItem('qp_sso_return_to');
          sessionStorage.removeItem('qp_sso_return_to');
          const safeDestination = requestedDestination && /^\/dashboard(?:\/|$)/.test(requestedDestination)
            ? requestedDestination
            : '/dashboard';
          const destination = localStorage.getItem('qp_onboarding_done')
            ? safeDestination
            : '/onboarding';

          if (!cancelled) navigate(destination, { replace: true });
        } else {
          // No session found after 5s — treat as error
          const timeout = setTimeout(() => {
            if (!cancelled) {
              setStatus('error');
              setMessage('Authentication failed or timed out. Please try again.');
              setTimeout(() => {
                if (!cancelled) navigate('/login', { replace: true });
              }, 3000);
            }
          }, 5000);
          return () => clearTimeout(timeout);
        }
      } catch (err) {
        if (cancelled) return;
        console.error('[AuthCallback]', err);
        setStatus('error');
        setMessage(err.message || 'An error occurred during authentication.');
        setTimeout(() => {
          if (!cancelled) navigate('/login', { replace: true });
        }, 3000);
      }
    };

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--canvas)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        style={{
          background: 'var(--canvas-lifted)',
          borderRadius: 'var(--r-xl)',
          padding: '48px 40px',
          maxWidth: 380,
          width: '100%',
          textAlign: 'center',
          boxShadow: 'var(--shadow-modal)',
          border: '1px solid rgba(20,20,19,0.07)',
        }}
      >
        {/* Processing */}
        {status === 'processing' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'rgba(255,86,0,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Loader2
                size={28}
                style={{ color: 'var(--arc)', animation: 'spin 0.8s linear infinite' }}
                aria-hidden="true"
              />
            </div>
            <div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  margin: '0 0 6px',
                  letterSpacing: '-0.02em',
                }}
              >
                Signing you in…
              </h2>
              <p style={{ fontSize: 14, color: 'var(--slate)', margin: 0 }}>
                {message}
              </p>
            </div>
          </div>
        )}

        {/* Success */}
        {status === 'success' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'rgba(5,150,105,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CheckCircle
                size={28}
                style={{ color: 'var(--success)' }}
                aria-hidden="true"
              />
            </div>
            <div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  margin: '0 0 6px',
                  letterSpacing: '-0.02em',
                }}
              >
                Welcome back!
              </h2>
              <p style={{ fontSize: 14, color: 'var(--slate)', margin: '0 0 12px' }}>
                {message}
              </p>
              <p
                style={{
                  fontSize: 12,
                  color: 'var(--dust)',
                  margin: 0,
                }}
              >
                Redirecting you now…
              </p>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: '50%',
                background: 'rgba(220,38,38,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AlertCircle
                size={28}
                style={{ color: 'var(--danger)' }}
                aria-hidden="true"
              />
            </div>
            <div>
              <h2
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  margin: '0 0 6px',
                  letterSpacing: '-0.02em',
                }}
              >
                Authentication failed
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
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthCallback;
