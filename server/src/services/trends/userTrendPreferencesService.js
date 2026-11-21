/**
 * User Trend Preferences & Search History Service
 * Persists creator niche topics and search queries strictly per-user to Supabase,
 * and personalizes the live trend feed based on both topics and search history.
 */

import supabase from "../supabase.js";
import { getTopicDefinition } from "./trendTopics.js";

// Fast in-memory cache to prevent redundant DB hits on rapid infinite-scroll triggers
const preferencesCache = new Map();
const PREF_CACHE_TTL_MS = 30 * 1000; // 30 seconds

const searchHistoryCache = new Map();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id) {
  return typeof id === "string" && UUID_REGEX.test(id.trim());
}

/**
 * Get user's saved trend preferences & recent searches from Supabase
 */
export async function getUserTrendPreferences(userId) {
  if (!userId) return null;

  const now = Date.now();
  const cached = preferencesCache.get(String(userId));
  if (cached && now - cached._cachedAt < PREF_CACHE_TTL_MS) {
    return cached.data;
  }

  let preferences = {
    selectedTopicIds: [],
    interests: "",
    work: "",
    goal: "",
    recentSearches: [],
    onboarded: false,
    isCustomized: false,
  };

  try {
    // 1. Primary & direct: Read from Supabase Auth user_metadata for this specific user
    if (isValidUUID(userId)) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(String(userId));
        const meta = authUser?.user?.user_metadata?.trend_preferences;
        if (meta) {
          preferences.selectedTopicIds = Array.isArray(meta.selectedTopicIds) ? meta.selectedTopicIds : [];
          preferences.interests = typeof meta.interests === "string" ? meta.interests : "";
          preferences.work = typeof meta.work === "string" ? meta.work : "";
          preferences.goal = typeof meta.goal === "string" ? meta.goal : "";
          preferences.recentSearches = Array.isArray(meta.recentSearches) ? meta.recentSearches : [];
          
          const hasSavedInterests =
            preferences.selectedTopicIds.length > 0 ||
            Boolean(preferences.interests.trim());

          preferences.hasInterests = hasSavedInterests;
          // Only truly onboarded if user has at least one topic or custom interest saved in DB
          preferences.onboarded = Boolean(meta.onboarded) && hasSavedInterests;
          preferences.isCustomized = hasSavedInterests;
        }
      } catch (authErr) {
        console.warn("[USER-TRENDS] Auth metadata read notice:", authErr.message);
      }
    }

    // 2. Also check public.user_trend_preferences table if it exists
    try {
      const { data, error } = await supabase
        .from("user_trend_preferences")
        .select("selected_topic_ids, interests, work, goal, updated_at")
        .eq("user_id", String(userId))
        .maybeSingle();

      if (!error && data) {
        if (Array.isArray(data.selected_topic_ids) && data.selected_topic_ids.length > 0) {
          preferences.selectedTopicIds = data.selected_topic_ids;
        }
        if (data.interests) preferences.interests = data.interests;
        if (data.work) preferences.work = data.work;
        if (data.goal) preferences.goal = data.goal;
        preferences.isCustomized = true;
      }
    } catch {
      // Table may not exist yet, user_metadata is authoritative
    }

    // 3. Fallback for recent searches if not in metadata
    if (preferences.recentSearches.length === 0) {
      try {
        const dbSearches = await getUserRecentSearchesFromTable(userId, 10);
        if (dbSearches.length > 0) {
          preferences.recentSearches = dbSearches;
        }
      } catch { }
    }

    preferencesCache.set(String(userId), { data: preferences, _cachedAt: now });
    return preferences;
  } catch (err) {
    console.warn("[USER-TRENDS] Error fetching user preferences:", err.message);
    return preferences;
  }
}

/**
 * Save user's selected trend topics & profile strictly for that specific user
 */
export async function saveUserTrendPreferences(
  userId,
  { selectedTopicIds = [], interests = "", work = "", goal = "", recentSearches = null, onboarded = true } = {}
) {
  if (!userId) throw new Error("userId is required to save preferences");

  const cleanUserId = String(userId);
  const cleanTopicIds = Array.isArray(selectedTopicIds) ? selectedTopicIds.filter(Boolean) : [];
  const cleanInterests = String(interests || "").trim();
  const cleanWork = String(work || "").trim();
  const cleanGoal = String(goal || "").trim();
  const nowIso = new Date().toISOString();

  try {
    let currentMeta = {};
    let existingTrend = {};
    let nextRecentSearches = Array.isArray(recentSearches) ? recentSearches : [];

    if (isValidUUID(cleanUserId)) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(cleanUserId);
        currentMeta = authUser?.user?.user_metadata || {};
        existingTrend = currentMeta.trend_preferences || {};
      } catch { }

      if (!Array.isArray(recentSearches) && Array.isArray(existingTrend.recentSearches)) {
        nextRecentSearches = existingTrend.recentSearches;
      }

      const hasSavedInterests = cleanTopicIds.length > 0 || Boolean(cleanInterests);
      const isActuallyOnboarded = hasSavedInterests ? Boolean(onboarded) : false;

      const updatedTrend = {
        ...existingTrend,
        selectedTopicIds: cleanTopicIds,
        interests: cleanInterests,
        work: cleanWork,
        goal: cleanGoal,
        recentSearches: nextRecentSearches,
        onboarded: isActuallyOnboarded,
        updatedAt: nowIso,
      };

      // Save directly into Supabase Auth user_metadata for this specific user
      await supabase.auth.admin.updateUserById(cleanUserId, {
        user_metadata: {
          ...currentMeta,
          trend_preferences: updatedTrend,
        },
      });
    }

    // 3. Also upsert into public.user_trend_preferences table if available
    try {
      await supabase.from("user_trend_preferences").upsert(
        {
          user_id: cleanUserId,
          selected_topic_ids: cleanTopicIds,
          interests: cleanInterests,
          work: cleanWork,
          goal: cleanGoal,
          updated_at: nowIso,
        },
        { onConflict: "user_id" }
      );
    } catch {
      // Ignore if table does not exist
    }

    // Invalidate local in-memory cache
    preferencesCache.delete(cleanUserId);

    const hasSavedInterests = cleanTopicIds.length > 0 || Boolean(cleanInterests);
    const isActuallyOnboarded = hasSavedInterests ? Boolean(onboarded) : false;

    return {
      success: true,
      preferences: {
        selectedTopicIds: cleanTopicIds,
        interests: cleanInterests,
        work: cleanWork,
        goal: cleanGoal,
        recentSearches: nextRecentSearches,
        onboarded: isActuallyOnboarded,
        hasInterests: hasSavedInterests,
        isCustomized: hasSavedInterests,
      },
    };
  } catch (err) {
    console.error("[USER-TRENDS] Error saving preferences for user:", cleanUserId, err.message);
    throw err;
  }
}

/**
 * Record a search query made by the user
 */
export async function recordUserSearch(userId, query) {
  if (!userId || !query || typeof query !== "string") return null;

  const cleanUserId = String(userId);
  const cleanQuery = query.trim().slice(0, 150);
  if (cleanQuery.length < 2) return null;

  const now = Date.now();
  const userRecent = searchHistoryCache.get(cleanUserId);
  if (userRecent && userRecent.lastQuery === cleanQuery.toLowerCase() && now - userRecent.timestamp < 30000) {
    return null;
  }

  try {
    let updatedSearches = [];

    // 1. Update user_metadata.trend_preferences.recentSearches if valid UUID
    if (isValidUUID(cleanUserId)) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(cleanUserId);
        const currentMeta = authUser?.user?.user_metadata || {};
        const currentTrend = currentMeta.trend_preferences || {};
        const existingSearches = Array.isArray(currentTrend.recentSearches) ? currentTrend.recentSearches : [];

        const lowerQuery = cleanQuery.toLowerCase();
        const filtered = existingSearches.filter((q) => q.toLowerCase() !== lowerQuery);
        updatedSearches = [cleanQuery, ...filtered].slice(0, 15);

        await supabase.auth.admin.updateUserById(cleanUserId, {
          user_metadata: {
            ...currentMeta,
            trend_preferences: {
              ...currentTrend,
              recentSearches: updatedSearches,
              updatedAt: new Date().toISOString(),
            },
          },
        });
      } catch { }
    }

    // 2. Also try insert into table if exists
    try {
      await supabase.from("user_trend_searches").insert({
        user_id: cleanUserId,
        query: cleanQuery,
        created_at: new Date().toISOString(),
      });
    } catch { }

    searchHistoryCache.set(cleanUserId, {
      lastQuery: lowerQuery,
      timestamp: now,
    });
    preferencesCache.delete(cleanUserId);

    return { success: true, query: cleanQuery, recentSearches: updatedSearches };
  } catch (err) {
    console.warn("[USER-TRENDS] Error recording search:", err.message);
    return null;
  }
}

/**
 * Automatically add a searched topic to user's saved interests in Supabase
 * and update their selected_topic_ids if it matches a registered topic.
 */
export async function addSearchQueryToUserInterests(userId, query) {
  if (!userId || !query || typeof query !== "string") return null;

  const cleanUserId = String(userId);
  const cleanQuery = query.trim().replace(/^#/, "");
  if (cleanQuery.length < 2) return null;

  try {
    const currentPrefs = await getUserTrendPreferences(cleanUserId);
    let selectedTopicIds = Array.isArray(currentPrefs?.selectedTopicIds) ? [...currentPrefs.selectedTopicIds] : [];
    let interestsList = currentPrefs?.interests
      ? currentPrefs.interests.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // Check if the query matches a predefined registered topic
    const matched = getTopicDefinition(cleanQuery);
    if (matched && matched.id) {
      if (!selectedTopicIds.includes(matched.id)) {
        selectedTopicIds.push(matched.id);
      }
    } else {
      // Add custom search query to user's custom interests keywords!
      const lowerQuery = cleanQuery.toLowerCase();
      const alreadyHas = interestsList.some((item) => item.toLowerCase() === lowerQuery);
      if (!alreadyHas) {
        interestsList.push(cleanQuery);
      }
    }

    const nextInterests = interestsList.join(", ");
    const saved = await saveUserTrendPreferences(cleanUserId, {
      selectedTopicIds,
      interests: nextInterests,
      work: currentPrefs?.work || "",
      goal: currentPrefs?.goal || "",
      onboarded: true,
    });

    preferencesCache.delete(cleanUserId);
    return saved;
  } catch (err) {
    console.warn("[USER-TRENDS] Error adding search to interests:", err.message);
    return null;
  }
}

/**
 * Get recent search terms for a user
 */
export async function getUserRecentSearches(userId, limit = 10) {
  if (!userId) return [];
  const prefs = await getUserTrendPreferences(userId);
  return Array.isArray(prefs?.recentSearches) ? prefs.recentSearches.slice(0, limit) : [];
}

async function getUserRecentSearchesFromTable(userId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from("user_trend_searches")
      .select("query, created_at")
      .eq("user_id", String(userId))
      .order("created_at", { ascending: false })
      .limit(limit * 2);

    if (!error && Array.isArray(data)) {
      const seen = new Set();
      const unique = [];
      for (const row of data) {
        const q = (row.query || "").trim();
        const lower = q.toLowerCase();
        if (q && !seen.has(lower)) {
          seen.add(lower);
          unique.push(q);
        }
        if (unique.length >= limit) break;
      }
      return unique;
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Delete a search query for a user from Supabase
 */
export async function deleteUserSearch(userId, query) {
  if (!userId || !query || typeof query !== "string") return false;
  const cleanUserId = String(userId);
  const cleanQuery = query.trim().toLowerCase();

  try {
    if (isValidUUID(cleanUserId)) {
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(cleanUserId);
        const currentMeta = authUser?.user?.user_metadata || {};
        const currentTrend = currentMeta.trend_preferences || {};
        const existingSearches = Array.isArray(currentTrend.recentSearches) ? currentTrend.recentSearches : [];

        const updated = existingSearches.filter((q) => q.toLowerCase() !== cleanQuery);

        await supabase.auth.admin.updateUserById(cleanUserId, {
          user_metadata: {
            ...currentMeta,
            trend_preferences: {
              ...currentTrend,
              recentSearches: updated,
              updatedAt: new Date().toISOString(),
            },
          },
        });
      } catch { }
    }

    try {
      await supabase
        .from("user_trend_searches")
        .delete()
        .eq("user_id", cleanUserId)
        .ilike("query", query.trim());
    } catch { }

    preferencesCache.delete(cleanUserId);
    return true;
  } catch (err) {
    console.warn("[USER-TRENDS] Error deleting search:", err.message);
    return false;
  }
}
