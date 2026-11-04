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

const isTokenValid = (token, marginSeconds = 30) => {
  if (!token || typeof token !== 'string') return false;
  const trimmed = token.trim();
  if (trimmed === 'null' || trimmed === 'undefined') return false;
  const parts = trimmed.split('.');
  if (parts.length !== 3) return false;

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);
    if (!decoded || typeof decoded.exp !== 'number') {
      return true; // No expiration claim, consider usable
    }
    const now = Math.floor(Date.now() / 1000);
    return decoded.exp - now > marginSeconds;
  } catch {
    return false;
  }
};

// In-memory token cache to avoid hammering Supabase Auth on every HTTP request
let cachedToken = null;
let refreshPromise = null;

async function getOrRefreshValidToken() {
  if (isTokenValid(cachedToken, 30)) {
    return cachedToken;
  }

  if (refreshPromise) {
    return await refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (!sessionError && session?.access_token && isTokenValid(session.access_token, 30)) {
        cachedToken = session.access_token;
        localStorage.setItem('quickpost_token', session.access_token);
        return session.access_token;
      }

      // If session is expired or within margin, refresh it proactively
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError && refreshed?.session?.access_token && isTokenValid(refreshed.session.access_token, 10)) {
        const token = refreshed.session.access_token;
        cachedToken = token;
        localStorage.setItem('quickpost_token', token);
        return token;
      }

      const fallback = localStorage.getItem('quickpost_token');
      if (isTokenValid(fallback, 10)) {
        cachedToken = fallback;
        return fallback;
      }

      cachedToken = null;
      return null;
    } catch (err) {
      console.warn('[apiClient] Error resolving session:', err);
      const fallback = localStorage.getItem('quickpost_token');
      if (isTokenValid(fallback, 10)) {
        cachedToken = fallback;
        return fallback;
      }
      cachedToken = null;
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return await refreshPromise;
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
        cachedToken = null;
        if (!refreshPromise) {
          refreshPromise = (async () => {
            try {
              const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
              if (!refreshErr && refreshed?.session?.access_token && isTokenValid(refreshed.session.access_token, 10)) {
                return refreshed.session.access_token;
              }
              return null;
            } catch (err) {
              return null;
            } finally {
              refreshPromise = null;
            }
          })();
        }

        const newToken = await refreshPromise;
        if (newToken) {
          cachedToken = newToken;
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
