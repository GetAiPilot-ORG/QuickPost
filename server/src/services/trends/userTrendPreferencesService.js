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
    hasInterests: false,
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

    preferences.recentSearches = sanitizeRecentSearchesList(preferences.recentSearches);

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

      // Automatically add tuned role (work) and custom keywords (interests) into recentSearches / interest topics!
      const tunedItemsToAdd = [];
      if (cleanWork && cleanWork.length > 1) {
        tunedItemsToAdd.push(cleanWork);
      }
      if (cleanInterests) {
        cleanInterests.split(",").forEach((item) => {
          const t = item.trim();
          if (t.length > 1) tunedItemsToAdd.push(t);
        });
      }

      if (tunedItemsToAdd.length > 0) {
        nextRecentSearches = Array.from(new Set([...tunedItemsToAdd, ...nextRecentSearches]));
      }

      nextRecentSearches = sanitizeRecentSearchesList(nextRecentSearches);

      const hasSavedInterests = cleanTopicIds.length > 0 || Boolean(cleanInterests) || Boolean(cleanWork);
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

    const hasSavedInterests = cleanTopicIds.length > 0 || Boolean(cleanInterests) || Boolean(cleanWork);
    const isActuallyOnboarded = hasSavedInterests ? Boolean(onboarded) : false;

    const savedPreferences = {
      selectedTopicIds: cleanTopicIds,
      interests: cleanInterests,
      work: cleanWork,
      goal: cleanGoal,
      recentSearches: nextRecentSearches,
      onboarded: isActuallyOnboarded,
      hasInterests: hasSavedInterests,
      isCustomized: hasSavedInterests,
    };

    preferencesCache.set(cleanUserId, { data: savedPreferences, _cachedAt: Date.now() });

    return {
      success: true,
      preferences: savedPreferences,
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
 * Prune partial word fragments, prefixes, and typos so only complete words remain
 */
export function sanitizeRecentSearchesList(searches) {
  if (!Array.isArray(searches)) return [];
  const cleaned = searches
    .map((s) => String(s || "").trim().replace(/^#/, ""))
    .filter((s) => s.length >= 2);

  const result = [];
  for (const term of cleaned) {
    const lower = term.toLowerCase();
    // Drop if another term in the list is a fuller version of this term
    const isFragment = cleaned.some((other) => {
      const otherLower = other.toLowerCase();
      if (otherLower === lower) return false;
      // 1. Strict prefix: e.g. 'sp', 'spider', 'spiderma' when 'spiderman' exists
      if (otherLower.length > lower.length && otherLower.startsWith(lower)) return true;
      // 2. Substring root for short queries: e.g. 'spid' in 'spiderman'
      if (otherLower.length > lower.length && otherLower.includes(lower) && lower.length <= 4) return true;
      // 3. Typo/fragment sharing initial 4 chars and length difference <= 3: e.g. 'spidrm', 'spidrman' when 'spiderman' exists
      if (
        otherLower.length > lower.length &&
        lower.length >= 4 &&
        otherLower.startsWith(lower.slice(0, 4)) &&
        otherLower.length - lower.length <= 3
      ) {
        return true;
      }
      return false;
    });

    if (!isFragment && !result.some((x) => x.toLowerCase() === lower)) {
      result.push(term);
    }
  }
  return result.slice(0, 15);
}

function addTermToInterestsString(existingInterestsStr, newTerm) {
  const cleanTerm = String(newTerm || "").trim().replace(/^#/, "");
  if (!cleanTerm || cleanTerm.length < 2) return existingInterestsStr || "";

  const cleanLower = cleanTerm.toLowerCase();
  const list = typeof existingInterestsStr === "string"
    ? existingInterestsStr.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  const filtered = list.filter((item) => {
    const itemLower = item.toLowerCase();
    if (itemLower === cleanLower) return false;
    // Remove if this item is a prefix/fragment of cleanTerm (e.g. remove 'spiderma', 'sp', 'spidrm' when 'spiderman' is added)
    if (cleanLower.startsWith(itemLower)) return false;
    if (cleanLower.length > itemLower.length && cleanLower.includes(itemLower) && itemLower.length <= 4) return false;
    if (
      cleanLower.length > itemLower.length &&
      itemLower.length >= 4 &&
      cleanLower.startsWith(itemLower.slice(0, 4)) &&
      cleanLower.length - itemLower.length <= 3
    ) {
      return false;
    }
    return true;
  });

  return [cleanTerm, ...filtered].join(", ");
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

    // 1. Check if the query matches a predefined registered topic ID/label/keywords
    const matched = getTopicDefinition(cleanQuery);
    if (matched && matched.id) {
      if (!selectedTopicIds.includes(matched.id)) {
        selectedTopicIds.push(matched.id);
      }
    }

    // 2. Add searched topic to user's saved interests keywords string
    const nextInterests = addTermToInterestsString(currentPrefs?.interests, cleanQuery);

    // 3. Update recent searches array with strict fragment pruning
    let recentSearches = Array.isArray(currentPrefs?.recentSearches) ? [...currentPrefs.recentSearches] : [];
    const updatedSearches = sanitizeRecentSearchesList([cleanQuery, ...recentSearches]);

    const saved = await saveUserTrendPreferences(cleanUserId, {
      selectedTopicIds,
      interests: nextInterests,
      work: currentPrefs?.work || "",
      goal: currentPrefs?.goal || "",
      recentSearches: updatedSearches,
      onboarded: true,
    });

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

        // Also remove from interests keywords if present
        const existingInterests = typeof currentTrend.interests === "string"
          ? currentTrend.interests.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
        const updatedInterests = existingInterests.filter((s) => s.toLowerCase() !== cleanQuery).join(", ");

        await supabase.auth.admin.updateUserById(cleanUserId, {
          user_metadata: {
            ...currentMeta,
            trend_preferences: {
              ...currentTrend,
              recentSearches: updated,
              interests: updatedInterests,
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

    const cached = preferencesCache.get(cleanUserId);
    if (cached && cached.data) {
      const curSearches = Array.isArray(cached.data.recentSearches) ? cached.data.recentSearches : [];
      const nextSearches = curSearches.filter((q) => q.toLowerCase() !== cleanQuery);
      const curInterests = typeof cached.data.interests === "string"
        ? cached.data.interests.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      const nextInterests = curInterests.filter((s) => s.toLowerCase() !== cleanQuery).join(", ");
      cached.data.recentSearches = nextSearches;
      cached.data.interests = nextInterests;
      cached.data.hasInterests = (Array.isArray(cached.data.selectedTopicIds) && cached.data.selectedTopicIds.length > 0) || Boolean(nextInterests);
      cached.data.onboarded = cached.data.hasInterests;
      cached.data.isCustomized = cached.data.hasInterests;
    } else {
      preferencesCache.delete(cleanUserId);
    }
    return true;
  } catch (err) {
    console.warn("[USER-TRENDS] Error deleting search:", err.message);
    return false;
  }
}
