import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import apiClient from "../utils/apiClient";
import { supabase } from "../lib/supabase";

const AuthContext = createContext(null);

const FREE_ENTITLEMENTS = Object.freeze({
  plan: { id: 'free', name: 'Free' },
  subscription: { source: 'standalone', status: 'active' },
  features: { publishing: true, scheduling: true, analytics: true, autodm: true },
  limits: {
    social_accounts: 3,
    scheduled_queue: 10,
    team_members: 1,
    history_days: 7,
    autodm_accounts: 3,
    autodm_automations: 1,
    autodm_replies_per_month: 50,
    contacts: 100,
  },
  usage: {},
});

// ── Secure Server-Side Sync ──────────────────────────────────────────────────
// Disabling browser-side sync to prevent CORS errors and protect sensitive env vars
// (VITE_SOCIAL_SYNC_SECRET) from being exposed in production.
// The Express backend server already handles this securely on the server-to-server layer.
const EMPTY_CONNECTED_ACCOUNTS = Object.freeze({
  instagram: { connected: false },
  youtube: { connected: false },
  pinterest: { connected: false },
  facebook: { connected: false },
  bluesky: { connected: false },
  linkedin: { connected: false },
  mastodon: { connected: false },
  threads: { connected: false },
  x: { connected: false },
  reddit: { connected: false },
  googleBusiness: { connected: false },
  instagramAccounts: [],
  youtubeAccounts: [],
  pinterestAccounts: [],
  facebookAccounts: [],
  blueskyAccounts: [],
  linkedinAccounts: [],
  mastodonAccounts: [],
  threadsAccounts: [],
  xAccounts: [],
  redditAccounts: [],
  googleBusinessAccounts: [],
});

function buildAuthenticatedUser(sessionUser, entitlements) {
  return {
    userId: sessionUser.id,
    email: sessionUser.email,
    name:
      sessionUser.user_metadata?.full_name ||
      sessionUser.email?.split("@")[0],
    plan: entitlements?.plan?.name || null,
    subscription_status: entitlements?.subscription?.status || null,
    entitlements,
    picture: sessionUser.user_metadata?.avatar_url || sessionUser.user_metadata?.picture,
  };
}

function buildSessionUser(sessionUser, previousUser) {
  const previousEntitlements =
    previousUser?.userId === sessionUser.id ? previousUser.entitlements : null;
  const entitlements = previousEntitlements || FREE_ENTITLEMENTS;

  return {
    userId: sessionUser.id,
    email: sessionUser.email,
    name:
      sessionUser.user_metadata?.full_name ||
      sessionUser.email?.split("@")[0],
    plan: entitlements?.plan?.name || null,
    subscription_status: entitlements?.subscription?.status || null,
    entitlements,
    picture: sessionUser.user_metadata?.avatar_url || sessionUser.user_metadata?.picture,
  };
}

async function syncUserToHub(sessionUser) {
  console.info("[HUB-SYNC] Skipping browser-side hub sync (handled securely by backend)");
  return;
}


export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [connectedAccounts, setConnectedAccounts] = useState(EMPTY_CONNECTED_ACCOUNTS);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  const fetchConnectedAccounts = useCallback(async () => {
    try {
      const response = await apiClient.get(`/api/auth/accounts?t=${Date.now()}`);
      if (response.data.success) {
        const accounts = response.data.accounts;
        setConnectedAccounts(accounts);
      }
    } catch (error) {
      console.error("💥 Error fetching connected accounts:", error.message || error);
    }
  }, []);

  const fetchUserProfile = useCallback(async (sessionUser) => {
    setProfileLoading(true);
    try {
      // Load standalone entitlements and legacy records in parallel. Standalone
      // entitlements are authoritative once a paid app subscription exists.
      const { data } = await apiClient.get('/api/billing/entitlements');
      const entitlements = data?.entitlements || FREE_ENTITLEMENTS;

      setUser(prev => prev ? {
        ...prev,
        plan: entitlements.plan.name,
        subscription_status: entitlements.subscription.status,
        entitlements,
      } : null);
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setUser(prev => prev?.userId === sessionUser.id ? prev : buildAuthenticatedUser(sessionUser, FREE_ENTITLEMENTS));
      return FREE_ENTITLEMENTS;
    } finally {
      setProfileLoading(false);
    }
  }, []);


  useEffect(() => {
    let isMounted = true;
    // ── Stale Session Prevention ─────────────────────────────────────────────
    // If the Supabase URL has changed (e.g. unified to a new instance), clear 
    // old local storage auth keys to prevent "Invalid Refresh Token" loops.
    const currentSupabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const storedSupabaseUrl = localStorage.getItem("last_supabase_url");
    
    if (storedSupabaseUrl && storedSupabaseUrl !== currentSupabaseUrl) {
      console.warn("🔄 [AUTH] Supabase URL changed. Clearing stale session tokens...");
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith("sb-") || key.includes("supabase") || key.includes("token")) {
          localStorage.removeItem(key);
        }
      });
      localStorage.setItem("last_supabase_url", currentSupabaseUrl);
      window.location.reload();
      return;
    } else if (!storedSupabaseUrl) {
      localStorage.setItem("last_supabase_url", currentSupabaseUrl);
    }

    const hydrateSession = async (session) => {
      setSession(session);
      if (session) {
        setUser(prev => buildSessionUser(session.user, prev));
        localStorage.setItem("quickpost_token", session.access_token);
        await Promise.all([
          fetchUserProfile(session.user),
          fetchConnectedAccounts()
        ]);
      } else {
        setUser(null);
        localStorage.removeItem("quickpost_token");
        setProfileLoading(false);
        setConnectedAccounts(EMPTY_CONNECTED_ACCOUNTS);
      }
    };

    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      hydrateSession(session).finally(() => {
        if (isMounted) setLoading(false);
      });
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrateSession(session).finally(() => {
        if (isMounted) setLoading(false);
      });
      if (session) {
        // Sync to hub — only on SIGNED_IN event to avoid spamming on every token refresh
        if (_event === "SIGNED_IN" || _event === "USER_UPDATED") {
          syncUserToHub(session.user);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchConnectedAccounts, fetchUserProfile]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signUp = async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });
    if (error) throw error;
    return data;
  };

  const googleSignIn = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin + "/auth/callback",
      },
    });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  const refreshAccounts = useCallback(async () => {
    await fetchConnectedAccounts();
  }, [fetchConnectedAccounts]);

  // Call this after payment to immediately reflect new plan in UI
  const refreshProfile = useCallback(async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    if (currentSession?.user) {
      // Force refresh the session to get latest user_metadata
      await supabase.auth.refreshSession();
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      if (freshSession?.user) {
        await fetchUserProfile(freshSession.user);
      }
    }
  }, [fetchUserProfile]);

  const value = useMemo(
    () => ({
      user,
      session,
      connectedAccounts,
      loading,
      profileLoading,
      login,
      signUp,
      googleSignIn,
      logout,
      refreshAccounts,
      refreshProfile,
      isAuthenticated: !!user,
    }),
    [user, session, connectedAccounts, loading, profileLoading, refreshAccounts, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
