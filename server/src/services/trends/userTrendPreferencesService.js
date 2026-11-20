/**
 * User Trend Preferences & Search History Service
 * Persists creator niche topics and search queries to Supabase database,
 * and personalizes the live trend feed based on both topics and search history.
 */

import supabase from "../supabase.js";
import { getTopicDefinition } from "./trendTopics.js";

// Fast in-memory cache to prevent redundant DB hits on rapid infinite-scroll triggers
const preferencesCache = new Map();
const PREF_CACHE_TTL_MS = 45 * 1000; // 45 seconds

const searchHistoryCache = new Map();
const SEARCH_CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Get user's saved trend preferences & recent searches from Supabase DB
 */
export async function getUserTrendPreferences(userId) {
  if (!userId) return null;

  const now = Date.now();
  const cached = preferencesCache.get(userId);
  if (cached && now - cached._cachedAt < PREF_CACHE_TTL_MS) {
    return cached.data;
  }

  let preferences = {
    selectedTopicIds: [],
    interests: "",
    work: "",
    goal: "",
    recentSearches: [],
    isCustomized: false,
  };

  try {
    // 1. Query user_trend_preferences table
    const { data, error } = await supabase
      .from("user_trend_preferences")
      .select("selected_topic_ids, interests, work, goal, updated_at")
      .eq("user_id", String(userId))
      .maybeSingle();

    if (!error && data) {
      preferences.selectedTopicIds = Array.isArray(data.selected_topic_ids) ? data.selected_topic_ids : [];
      let loadedInterests = data.interests || "";
      // Clean legacy search query accumulation bug if present
      if (loadedInterests.includes("gta6") && loadedInterests.includes("footbal")) {
        loadedInterests = "";
        supabase
          .from("user_trend_preferences")
          .update({ interests: "" })
          .eq("user_id", String(userId))
          .then(() => {})
          .catch(() => {});
      }
      preferences.interests = loadedInterests;
      preferences.work = data.work || "";
      preferences.goal = data.goal || "";
      preferences.isCustomized = preferences.selectedTopicIds.length > 0 || Boolean(preferences.interests);
    } else if (error && error.code !== "PGRST116") {
      // If table doesn't exist yet, fallback to Supabase Auth metadata
      try {
        const { data: authUser } = await supabase.auth.admin.getUserById(userId);
        const meta = authUser?.user?.user_metadata?.trend_preferences;
        if (meta) {
          preferences.selectedTopicIds = Array.isArray(meta.selectedTopicIds) ? meta.selectedTopicIds : [];
          preferences.interests = meta.interests || "";
          preferences.work = meta.work || "";
          preferences.goal = meta.goal || "";
          preferences.isCustomized = preferences.selectedTopicIds.length > 0 || Boolean(preferences.interests);
        }
      } catch {}
    }

    // 2. Fetch user's recent trend searches
    const recentSearches = await getUserRecentSearches(userId, 10);
    preferences.recentSearches = recentSearches;

    preferencesCache.set(userId, { data: preferences, _cachedAt: now });
    return preferences;
  } catch (err) {
    console.warn("[USER-TRENDS] Error fetching user preferences:", err.message);
    return preferences;
  }
}

/**
 * Save user's selected trend topics & profile to Supabase DB
 */
export async function saveUserTrendPreferences(userId, { selectedTopicIds = [], interests = "", work = "", goal = "" } = {}) {
  if (!userId) throw new Error("userId is required to save preferences");

  const cleanTopicIds = Array.isArray(selectedTopicIds) ? selectedTopicIds.filter(Boolean) : [];
  const cleanInterests = String(interests || "").trim();
  const cleanWork = String(work || "").trim();
  const cleanGoal = String(goal || "").trim();

  const payload = {
    user_id: String(userId),
    selected_topic_ids: cleanTopicIds,
    interests: cleanInterests,
    work: cleanWork,
    goal: cleanGoal,
    updated_at: new Date().toISOString(),
  };

  try {
    // 1. Upsert into public.user_trend_preferences table
    const { data, error } = await supabase
      .from("user_trend_preferences")
      .upsert(payload, { onConflict: "user_id" })
      .select()
      .maybeSingle();

    if (error) {
      console.warn("[USER-TRENDS] Table upsert notice:", error.message);
      // Fallback: save into Supabase auth user_metadata for persistence
      try {
        await supabase.auth.admin.updateUserById(userId, {
          user_metadata: {
            trend_preferences: {
              selectedTopicIds: cleanTopicIds,
              interests: cleanInterests,
              work: cleanWork,
              goal: cleanGoal,
              updatedAt: payload.updated_at,
            },
          },
        });
      } catch (authErr) {
        console.warn("[USER-TRENDS] Auth metadata fallback notice:", authErr.message);
      }
    }

    // Invalidate local in-memory cache
    preferencesCache.delete(userId);

    return {
      success: true,
      preferences: {
        selectedTopicIds: cleanTopicIds,
        interests: cleanInterests,
        work: cleanWork,
        goal: cleanGoal,
        isCustomized: cleanTopicIds.length > 0 || Boolean(cleanInterests),
      },
    };
  } catch (err) {
    console.error("[USER-TRENDS] Error saving preferences:", err.message);
    throw err;
  }
}

/**
 * Record a search query made by the user to Supabase DB
 */
export async function recordUserSearch(userId, query) {
  if (!userId || !query || typeof query !== "string") return null;

  const cleanQuery = query.trim().slice(0, 150);
  if (cleanQuery.length < 2) return null;

  const now = Date.now();

  // Avoid spamming identical search query within 2 minutes
  const userRecent = searchHistoryCache.get(userId);
  if (userRecent && userRecent.lastQuery === cleanQuery.toLowerCase() && now - userRecent.timestamp < 120000) {
    return null;
  }

  try {
    // 1. Insert into public.user_trend_searches
    const { error } = await supabase.from("user_trend_searches").insert({
      user_id: String(userId),
      query: cleanQuery,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.warn("[USER-TRENDS] Search history table insert notice:", error.message);
    }

    // Update in-memory search cache
    searchHistoryCache.set(userId, {
      lastQuery: cleanQuery.toLowerCase(),
      timestamp: now,
    });

    // Invalidate preferences cache so recent searches refresh
    preferencesCache.delete(userId);

    return { success: true, query: cleanQuery };
  } catch (err) {
    console.warn("[USER-TRENDS] Error recording search:", err.message);
    return null;
  }
}

/**
 * Automatically add a searched topic to user's saved interests in Supabase DB
 * and update their selected_topic_ids if it matches a registered topic.
 */
export async function addSearchQueryToUserInterests(userId, query) {
  if (!userId || !query || typeof query !== "string") return null;

  const cleanQuery = query.trim().replace(/^#/, "");
  if (cleanQuery.length < 2) return null;

  try {
    const currentPrefs = await getUserTrendPreferences(userId);
    let selectedTopicIds = Array.isArray(currentPrefs?.selectedTopicIds) ? [...currentPrefs.selectedTopicIds] : [];
    let interestsList = currentPrefs?.interests
      ? currentPrefs.interests.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    // Check if the query matches a predefined registered topic
    const matched = getTopicDefinition(cleanQuery);
    if (matched && matched.id && !selectedTopicIds.includes(matched.id)) {
      selectedTopicIds.push(matched.id);
    }

    const saved = await saveUserTrendPreferences(userId, {
      selectedTopicIds,
      interests: currentPrefs?.interests || "",
      work: currentPrefs?.work || "",
      goal: currentPrefs?.goal || "",
    });

    preferencesCache.delete(userId);
    return saved;
  } catch (err) {
    console.warn("[USER-TRENDS] Error adding search to interests:", err.message);
    return null;
  }
}

/**
 * Get recent search terms for a user
 */
export async function getUserRecentSearches(userId, limit = 6) {
  if (!userId) return [];

  try {
    const { data, error } = await supabase
      .from("user_trend_searches")
      .select("query, created_at")
      .eq("user_id", String(userId))
      .order("created_at", { ascending: false })
      .limit(limit * 2);

    if (!error && Array.isArray(data)) {
      // Deduplicate queries while preserving recency order
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
  } catch (err) {
    console.warn("[USER-TRENDS] Error reading recent searches:", err.message);
    return [];
  }
}

/**
 * Delete a search query for a user from Supabase DB
 */
export async function deleteUserSearch(userId, query) {
  if (!userId || !query || typeof query !== "string") return false;
  try {
    const cleanQuery = query.trim();
    await supabase
      .from("user_trend_searches")
      .delete()
      .eq("user_id", String(userId))
      .ilike("query", cleanQuery);

    preferencesCache.delete(userId);
    return true;
  } catch (err) {
    console.warn("[USER-TRENDS] Error deleting search:", err.message);
    return false;
  }
}
