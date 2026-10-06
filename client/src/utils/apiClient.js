import axios from 'axios';
import { supabase } from '../lib/supabase';

// In dev, use empty base URL so requests go through Vite's proxy (avoids ngrok CORS/interstitial).
// In production, use the full API URL from the env.
const API_BASE_URL = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_URL || '');

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

const isUsableAuthToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  return trimmed !== 'null' && trimmed !== 'undefined' && trimmed.split('.').length === 3;
};

// Singleton in-flight session refresh promise to prevent duplicate concurrent refresh requests
let refreshPromise = null;

async function getOrRefreshValidToken() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      const localToken = localStorage.getItem('quickpost_token');
      return isUsableAuthToken(localToken) ? localToken : null;
    }

    const now = Math.floor(Date.now() / 1000);
    // If token is expired or within 60 seconds of expiring, refresh proactively
    if (session.expires_at && session.expires_at - now < 60) {
      if (!refreshPromise) {
        refreshPromise = supabase.auth.refreshSession().finally(() => {
          refreshPromise = null;
        });
      }
      const { data: refreshed, error: refreshError } = await refreshPromise;
      if (!refreshError && refreshed?.session?.access_token) {
        localStorage.setItem('quickpost_token', refreshed.session.access_token);
        return refreshed.session.access_token;
      }
    }

    if (isUsableAuthToken(session.access_token)) {
      localStorage.setItem('quickpost_token', session.access_token);
      return session.access_token;
    }
  } catch (err) {
    console.warn('[apiClient] Error resolving session:', err);
  }

  const fallback = localStorage.getItem('quickpost_token');
  return isUsableAuthToken(fallback) ? fallback : null;
}

// Request interceptor to add auth token dynamically from Supabase session
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const token = await getOrRefreshValidToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        delete config.headers.Authorization;
      }
    } catch (err) {
      console.error('[apiClient] Error attaching auth header:', err);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors and auto-recover on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = supabase.auth.refreshSession().finally(() => {
            refreshPromise = null;
          });
        }
        const { data: refreshed, error: refreshErr } = await refreshPromise;

        if (!refreshErr && refreshed?.session?.access_token) {
          const newToken = refreshed.session.access_token;
          localStorage.setItem('quickpost_token', newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (retryErr) {
        console.warn('[apiClient] Session refresh retry failed:', retryErr);
      }

      console.warn('[apiClient] 401 Unauthorized received:', originalRequest.url);
      const isPublicPage = window.location.pathname === '/login' || 
                           window.location.pathname === '/register' || 
                           window.location.pathname === '/' ||
                           window.location.pathname.startsWith('/auth/callback');

      if (!isPublicPage) {
        localStorage.removeItem('quickpost_token');
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
