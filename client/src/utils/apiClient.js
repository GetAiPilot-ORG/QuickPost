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

export const isUsableAuthToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  return trimmed !== 'null' && trimmed !== 'undefined' && trimmed.split('.').length === 3;
};

export function getTokenExp(token) {
  try {
    if (!isUsableAuthToken(token)) return 0;
    const parts = token.split('.');
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(json);
    return payload.exp ? Number(payload.exp) : 0;
  } catch {
    try {
      const parts = token.split('.');
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return payload.exp ? Number(payload.exp) : 0;
    } catch {
      return 0;
    }
  }
}

// In-memory token cache to avoid hammering Supabase Auth on every HTTP request
let cachedToken = null;
let cachedExpiresAt = 0;
let refreshPromise = null;

export function clearTokenCache() {
  cachedToken = null;
  cachedExpiresAt = 0;
}

export function setCachedToken(token, expiresAt = null) {
  if (isUsableAuthToken(token)) {
    cachedToken = token;
    cachedExpiresAt = expiresAt || getTokenExp(token) || (Math.floor(Date.now() / 1000) + 3600);
    localStorage.setItem('quickpost_token', token);
  } else {
    clearTokenCache();
  }
}

async function getOrRefreshValidToken() {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if it has at least 60 seconds of valid life left
  if (cachedToken && (cachedExpiresAt - now > 60)) {
    const local = localStorage.getItem('quickpost_token');
    // Invalidate in-memory cache if localStorage was cleared or swapped out
    if (!local || local === cachedToken) {
      return cachedToken;
    }
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      const localToken = localStorage.getItem('quickpost_token');
      if (isUsableAuthToken(localToken)) {
        const exp = getTokenExp(localToken);
        if (!exp || exp - now > 30) {
          setCachedToken(localToken, exp || (now + 300));
          return localToken;
        }
      }
      clearTokenCache();
      return null;
    }

    const sessionExp = session.expires_at || getTokenExp(session.access_token);

    // If token is expired or within 60 seconds of expiring, refresh proactively
    if (sessionExp && (sessionExp - now < 60)) {
      if (!refreshPromise) {
        refreshPromise = supabase.auth.refreshSession().finally(() => {
          refreshPromise = null;
        });
      }
      const { data: refreshed, error: refreshError } = await refreshPromise;
      if (!refreshError && refreshed?.session?.access_token) {
        const token = refreshed.session.access_token;
        const exp = refreshed.session.expires_at || getTokenExp(token) || (now + 3600);
        setCachedToken(token, exp);
        return token;
      }
    }

    if (isUsableAuthToken(session.access_token)) {
      setCachedToken(session.access_token, sessionExp || (now + 3600));
      return session.access_token;
    }
  } catch (err) {
    console.warn('[apiClient] Error resolving session:', err);
  }

  const fallback = localStorage.getItem('quickpost_token');
  if (isUsableAuthToken(fallback)) {
    const exp = getTokenExp(fallback);
    if (!exp || exp - now > 30) {
      setCachedToken(fallback, exp || (now + 60));
      return fallback;
    }
  }

  clearTokenCache();
  return null;
}

// Request interceptor to add auth token dynamically from Supabase session
apiClient.interceptors.request.use(
  async (config) => {
    // If request already has an explicitly refreshed Authorization header, don't overwrite it
    if (config._skipTokenInterceptor && config.headers?.Authorization) {
      return config;
    }

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
      // Immediately clear stale in-memory token so subsequent calls don't resend it
      clearTokenCache();

      try {
        if (!refreshPromise) {
          refreshPromise = supabase.auth.refreshSession().finally(() => {
            refreshPromise = null;
          });
        }
        const { data: refreshed, error: refreshErr } = await refreshPromise;

        if (!refreshErr && refreshed?.session?.access_token) {
          const newToken = refreshed.session.access_token;
          const exp = refreshed.session.expires_at || getTokenExp(newToken) || (Math.floor(Date.now() / 1000) + 3600);
          setCachedToken(newToken, exp);

          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          originalRequest._skipTokenInterceptor = true;
          return apiClient(originalRequest);
        }
      } catch (retryErr) {
        console.warn('[apiClient] Session refresh retry failed:', retryErr);
      }

      // If refresh failed completely
      clearTokenCache();
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
