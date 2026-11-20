import { communityFeedPost } from "./socialpilotPublishing.js";
import IORedis from "ioredis";
import crypto from "crypto";
import {
  fetchYouTubeTrends,
  fetchGoogleTrends,
  fetchTrendingNews,
  fetchUnsplashTrends,
  fetchPexelsTrends,
  fetchPinterestTrends,
  fetchBlueskyTrends,
  filterAndRankPosts,
  getBlueskyTrendingTopics,
} from "./trends/trendSources.js";
import {
  resolveTargetTopics,
  calculateItemTopicMatch,
  getTopicDefinition,
  getPinterestTopicQuery,
  getBlueskyTopicQuery,
  isItemRelevantToTopic,
} from "./trends/trendTopics.js";
import { getUserTrendPreferences } from "./trends/userTrendPreferencesService.js";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 60;
const CANDIDATE_LIMIT = 500;
const HALF_LIFE_HOURS = 72;
const CACHE_TTL_SECONDS = Number(process.env.TREND_FEED_CACHE_TTL_SECONDS || 60);

let redisClient;

function toLimit(value) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

export function encodeTrendCursor(post, page) {
  if (!post?.rank_score || !post?.id) {
    return Buffer.from(JSON.stringify({ page: (page || 1) + 1, rank_score: 1, id: "next" })).toString("base64url");
  }
  const payload = { rank_score: post.rank_score, id: post.id };
  if (page !== undefined && page !== null) payload.page = page;
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function decodeTrendCursor(cursor) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
    if (!Number.isFinite(Number(parsed?.rank_score)) || !parsed?.id) return null;
    parsed.rank_score = Number(parsed.rank_score);
    if (parsed.page !== undefined) parsed.page = Number(parsed.page);
    return parsed;
  } catch {
    return null;
  }
}

async function defaultSupabase() {
  const { default: supabase } = await import("./supabase.js");
  return supabase;
}

function getRedisUrl() {
  return process.env.REDIS_URL || process.env.BULLMQ_REDIS_URL || null;
}

export function getTrendFeedCache() {
  const url = getRedisUrl();
  if (!url) return null;
  if (!redisClient) {
    redisClient = new IORedis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    redisClient.on("error", () => {});
  }
  return redisClient;
}

function cacheKey(params) {
  const seenHash = crypto
    .createHash("sha1")
    .update(
      [
        params.userId || "anon",
        (params.seenIds || []).join(","),
        (params.interests || []).join(","),
        (params.topics || []).join(","),
        params.topic || "",
        params.type || "all",
        params.category || "all",
        params.region || "IN",
        params.search || "",
        params.page || 1,
      ].join("|")
    )
    .digest("hex")
    .slice(0, 12);
  return `trend:feed:v2:${params.limit || DEFAULT_LIMIT}:${params.cursor || "first"}:${seenHash}`;
}

async function readCache(cache, key) {
  if (!cache) return null;
  try {
    const cached = await cache.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

async function writeCache(cache, key, value) {
  if (!cache) return;
  try {
    await cache.set(key, JSON.stringify(value), "EX", CACHE_TTL_SECONDS);
  } catch {}
}

export function scoreTrendPost(post, now = new Date()) {
  const publishedAt = new Date(post.published_at || post.ingested_at || now);
  const ageHours = Math.max((now - publishedAt) / 36e5, 1);
  const recencyDecay = Math.pow(0.5, ageHours / HALF_LIFE_HOURS);
  const engagementVelocity = Number(post.engagement_score || 0) / ageHours;
  return Number((recencyDecay * engagementVelocity).toFixed(6));
}

export function parseTrendInterests(value) {
  return String(value || "")
    .split(",")
    .map((interest) => interest.trim().toLowerCase())
    .filter((interest) => /^[a-z0-9][a-z0-9 _-]{0,38}$/i.test(interest))
    .slice(0, 50);
}

function getInterestMatches(post, interests) {
  if (!interests.length) return 0;
  const haystack = [
    post.caption,
    post.title,
    post.source_url,
    ...(Array.isArray(post.niche_tags) ? post.niche_tags : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return interests.filter((interest) => haystack.includes(interest)).length;
}

function compareRankedPosts(a, b) {
  if (b.rank_score !== a.rank_score) return b.rank_score - a.rank_score;
  return String(b.id).localeCompare(String(a.id));
}

function applyRankCursor(posts, cursor) {
  const decoded = decodeTrendCursor(cursor);
  if (!decoded) return posts;
  // If cursor has a page number and we are paginating external feeds by page,
  // do not drop items with higher scores than the previous page boundary.
  // Deduplication across pages is handled via seen IDs.
  if (decoded.page !== undefined && Number(decoded.page) > 1) {
    return posts;
  }
  return posts.filter(
    (post) =>
      post.rank_score < decoded.rank_score ||
      (post.rank_score === decoded.rank_score && String(post.id) < String(decoded.id))
  );
}

export function parseSeenPostIds(value) {
  return String(value || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .slice(0, 200);
}

// Fetch live external posts based on active type / category & page number & user onboarding topics
async function fetchLiveExternalPosts({
  type = "all",
  category = "all",
  region = "IN",
  search = "",
  targetTopics = [],
  searchQueries = [],
  searchTopicObjects = [],
  isFilteredToSingleTopic = false,
  activeTopic = null,
  page = 1,
  token = null,
}) {
  const promises = [];

  // Case 1: Explicit search term typed by user
  if (search && String(search).trim()) {
    const q = String(search).trim();
    if (type === "all" || type === "pinterest" || type === "visuals") {
      const pLimit = type === "pinterest" ? 40 : 25;
      promises.push(fetchPinterestTrends({ category, query: q, limit: pLimit, page, token, region }));
    }
    if (type === "all" || type === "bluesky" || type === "social") {
      const bLimit = type === "bluesky" ? 35 : 25;
      promises.push(fetchBlueskyTrends({ category, query: q, limit: bLimit, page }));
    }
    if (type === "all" || type === "videos") {
      promises.push(fetchYouTubeTrends({ region, category, query: q, maxResults: 25, page }));
      promises.push(fetchPexelsTrends({ category, query: q, perPage: 25, page, region }));
    }
    if (type === "all" || type === "visuals") {
      promises.push(fetchUnsplashTrends({ category, query: q, perPage: 25, page, region }));
    }
    if (type === "all" || type === "news") {
      promises.push(fetchTrendingNews({ category, region, query: q, page }));
    }
    if (type === "searches") {
      promises.push(fetchGoogleTrends({ geo: region, page }));
    }
  }
  // Case 2: Specific category selected by user from category pills (e.g. Gaming, Tech & AI, Design & Art)
  else if (category && category !== "all") {
    const pLimit = type === "pinterest" ? 40 : 25;
    const bLimit = type === "bluesky" ? 35 : 25;

    if (type === "all" || type === "pinterest" || type === "visuals") {
      promises.push(fetchPinterestTrends({ category, query: "", limit: pLimit, page, token, region }));
    }
    if (type === "all" || type === "bluesky" || type === "social") {
      promises.push(fetchBlueskyTrends({ category, query: "", limit: bLimit, page }));
    }
    if (type === "all" || type === "videos") {
      promises.push(fetchYouTubeTrends({ region, category, maxResults: 25, page }));
      promises.push(fetchPexelsTrends({ category, query: "", perPage: 25, page, region }));
    }
    if (type === "all" || type === "visuals") {
      promises.push(fetchUnsplashTrends({ category, query: "", perPage: 25, page, region }));
    }
    if (type === "all" || type === "news") {
      promises.push(fetchTrendingNews({ category, region, query: "", page }));
    }
    if (type === "searches") {
      promises.push(fetchGoogleTrends({ geo: region, page }));
    } else if (type === "all" && page === 1) {
      promises.push(
        fetchGoogleTrends({ geo: region, page: 1 })
          .then((items) => (Array.isArray(items) ? items.slice(0, 2) : []))
          .catch(() => [])
      );
    }
  }
  // Case 3: Personalized feed based on selected onboarding topics (when category is 'all')
  else if (targetTopics.length > 0 || searchQueries.length > 0) {
    if (isFilteredToSingleTopic && activeTopic) {
      const pinQ = getPinterestTopicQuery(activeTopic);
      const bskyQ = getBlueskyTopicQuery(activeTopic);
      const ytQ = activeTopic.searchQuery || activeTopic.label;
      const subCat = activeTopic.subCategory || "all";

      if (type === "all" || type === "pinterest" || type === "visuals") {
        promises.push(
          fetchPinterestTrends({ category: subCat, query: pinQ, limit: 25, page, token, region })
            .then((pins) =>
              Array.isArray(pins)
                ? pins
                    .filter((p) => isItemRelevantToTopic(p, activeTopic))
                    .map((p) => ({
                      ...p,
                      matched_topic: activeTopic.label,
                      interest_topic: activeTopic.id,
                      topic_emoji: activeTopic.emoji,
                    }))
                : []
            )
            .catch(() => [])
        );
      }
      if (type === "all" || type === "bluesky" || type === "social") {
        promises.push(
          fetchBlueskyTrends({ category: subCat, query: bskyQ, limit: 25, page })
            .then((posts) =>
              Array.isArray(posts)
                ? posts
                    .filter((p) => isItemRelevantToTopic(p, activeTopic))
                    .map((p) => ({
                      ...p,
                      matched_topic: activeTopic.label,
                      interest_topic: activeTopic.id,
                      topic_emoji: activeTopic.emoji,
                    }))
                : []
            )
            .catch(() => [])
        );
      }
      if (type === "all" || type === "videos") {
        promises.push(
          fetchYouTubeTrends({ region, category: subCat, query: ytQ, maxResults: 25, page })
            .then((videos) =>
              Array.isArray(videos)
                ? videos
                    .filter((v) => isItemRelevantToTopic(v, activeTopic))
                    .map((v) => ({
                      ...v,
                      matched_topic: activeTopic.label,
                      interest_topic: activeTopic.id,
                      topic_emoji: activeTopic.emoji,
                    }))
                : []
            )
            .catch(() => [])
        );
        promises.push(fetchPexelsTrends({ category: subCat, query: pinQ, perPage: 20, page, region }));
      }
      if (type === "all" || type === "visuals") {
        promises.push(fetchUnsplashTrends({ category: subCat, query: pinQ, perPage: 20, page, region }));
      }
      if (type === "all" || type === "news") {
        promises.push(fetchTrendingNews({ category: subCat, region, query: ytQ, page }));
      }
    } else {
      // MIXED FEED: Interleave onboarding selected topics AND searched topics
      const mixedPool = [];
      const maxLen = Math.max(targetTopics.length, searchTopicObjects.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < targetTopics.length) mixedPool.push(targetTopics[i]);
        if (i < searchTopicObjects.length) mixedPool.push(searchTopicObjects[i]);
      }

      const topicsPool =
        mixedPool.length > 0
          ? mixedPool
          : targetTopics.length > 0
          ? targetTopics
          : searchTopicObjects.length > 0
          ? searchTopicObjects
          : searchQueries.map((q) => ({
              label: q,
              searchQuery: q,
              subCategory: "all",
              emoji: "🔍",
              id: q,
              keywords: [q.toLowerCase()],
              isSearchedTopic: true,
            }));

      const startIndex = ((page - 1) * 3) % topicsPool.length;
      let topicsForPage = topicsPool.slice(startIndex, startIndex + 3);
      if (topicsForPage.length < 3 && topicsPool.length >= 3) {
        topicsForPage = [...topicsForPage, ...topicsPool.slice(0, 3 - topicsForPage.length)];
      }
      const limitPerTopic = Math.max(Math.floor(36 / topicsForPage.length), 12);

      for (const tDef of topicsForPage) {
        const pinQ = getPinterestTopicQuery(tDef);
        const bskyQ = getBlueskyTopicQuery(tDef);
        const ytQ = tDef.searchQuery || tDef.label;
        const subCat = tDef.subCategory || "all";

        if (type === "all" || type === "pinterest" || type === "visuals") {
          promises.push(
            fetchPinterestTrends({ category: subCat, query: pinQ, limit: limitPerTopic, page, token, region })
              .then((pins) =>
                Array.isArray(pins)
                  ? pins
                      .filter((p) => isItemRelevantToTopic(p, tDef))
                      .map((p) => ({
                        ...p,
                        matched_topic: tDef.label,
                        interest_topic: tDef.id,
                        topic_emoji: tDef.emoji,
                      }))
                  : []
              )
              .catch(() => [])
          );
        }
        if (type === "all" || type === "bluesky" || type === "social") {
          promises.push(
            fetchBlueskyTrends({ category: subCat, query: bskyQ, limit: limitPerTopic, page })
              .then((posts) =>
                Array.isArray(posts)
                  ? posts
                      .filter((p) => isItemRelevantToTopic(p, tDef))
                      .map((p) => ({
                        ...p,
                        matched_topic: tDef.label,
                        interest_topic: tDef.id,
                        topic_emoji: tDef.emoji,
                      }))
                  : []
              )
              .catch(() => [])
          );
        }
        if (type === "all" || type === "videos") {
          promises.push(
            fetchYouTubeTrends({ region, category: subCat, query: ytQ, maxResults: limitPerTopic, page })
              .then((videos) =>
                Array.isArray(videos)
                  ? videos
                      .filter((v) => isItemRelevantToTopic(v, tDef))
                      .map((v) => ({
                        ...v,
                        matched_topic: tDef.label,
                        interest_topic: tDef.id,
                        topic_emoji: tDef.emoji,
                      }))
                  : []
              )
              .catch(() => [])
          );
        }
      }

      // Visuals & News for primary topic of this page
      const primary = topicsForPage[0];
      if (primary) {
        const pQuery = getPinterestTopicQuery(primary);
        const pYt = primary.searchQuery || primary.label;
        const pCat = primary.subCategory || "all";
        if (type === "all" || type === "videos") {
          promises.push(fetchPexelsTrends({ category: pCat, query: pQuery, perPage: 15, page, region }));
        }
        if (type === "all" || type === "visuals") {
          promises.push(fetchUnsplashTrends({ category: pCat, query: pQuery, perPage: 15, page, region }));
        }
        if (type === "all" || type === "news") {
          promises.push(fetchTrendingNews({ category: pCat, region, query: pYt, page }));
        }
      }
    }
  }
  // Case 3: Global unpersonalized fallback
  else {
    if (type === "all" || type === "pinterest" || type === "visuals") {
      const pLimit = type === "pinterest" ? 40 : 25;
      promises.push(fetchPinterestTrends({ category, query: "", limit: pLimit, page, token, region }));
    }
    if (type === "all" || type === "bluesky" || type === "social") {
      const bLimit = type === "bluesky" ? 35 : 25;
      promises.push(fetchBlueskyTrends({ category, query: "", limit: bLimit, page }));
    }
    if (type === "all" || type === "videos") {
      promises.push(fetchYouTubeTrends({ region, category, maxResults: 25, page }));
      promises.push(fetchPexelsTrends({ category, query: "", perPage: 25, page, region }));
    }
    if (type === "all" || type === "visuals") {
      promises.push(fetchUnsplashTrends({ category, query: "", perPage: 25, page, region }));
    }
    if (type === "all" || type === "news") {
      promises.push(fetchTrendingNews({ category, region, query: "", page }));
    }
    if (type === "searches") {
      promises.push(fetchGoogleTrends({ geo: region, page }));
    } else if (type === "all" && page === 1) {
      promises.push(
        fetchGoogleTrends({ geo: region, page: 1 })
          .then((items) => (Array.isArray(items) ? items.slice(0, 2) : []))
          .catch(() => [])
      );
    }
  }

  try {
    const results = await Promise.allSettled(promises);
    return results
      .filter((r) => r.status === "fulfilled" && Array.isArray(r.value))
      .flatMap((r) => r.value);
  } catch (error) {
    console.error("[TREND-FEED] External source aggregation error:", error);
    return [];
  }
}

export async function getCommunityFeedPage(params = {}, options = {}) {
  const db = options.supabase || (await defaultSupabase());
  const limit = toLimit(params.limit);
  let query = db.from('posts').select('id,source_platform,source_url,thumbnail_url,caption,creator,creator_avatar_url,author_id,media_urls,media_type,published_at,ingested_at,engagement_score,niche_tags')
    .eq('source_platform', 'socialpilot').order('published_at', { ascending: false }).order('id', { ascending: false });
  if (params.cursor) {
    let cursor;
    try { cursor = JSON.parse(Buffer.from(String(params.cursor), 'base64url').toString('utf8')); } catch { throw new Error('Invalid community feed cursor'); }
    if (!/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(cursor.at || '') || !Number.isFinite(Date.parse(cursor.at)) || !/^[0-9a-f-]{36}$/i.test(cursor.id || '')) throw new Error('Invalid community feed cursor');
    query = query.or(`published_at.lt.${cursor.at},and(published_at.eq.${cursor.at},id.lt.${cursor.id})`);
  }
  const search = String(params.search || params.q || '').trim().slice(0, 200);
  if (search) query = query.ilike('caption', `%${search}%`);
  const { data, error } = await query.limit(limit + 1);
  if (error) throw error;
  const rows = (data || []).slice(0, limit);
  const hasMore = (data || []).length > limit;
  const last = rows.at(-1);
  return { success: true, items: rows.map(communityFeedPost), hasMore, nextCursor: hasMore ? Buffer.from(JSON.stringify({ at: new Date(last.published_at).toISOString(), id: last.id })).toString('base64url') : null, cached: false };
}

export async function getTrendFeedPage(params = {}, options = {}) {
  if (params.type === "community") return getCommunityFeedPage(params, options);
  const limit = toLimit(params.limit);
  const supabase = options.supabase || (await defaultSupabase());
  const now = options.now || new Date();
  const seenIds = parseSeenPostIds(params.seen);
  const interests = parseTrendInterests(params.interests || params.topics);
  const type = params.type || "all";
  const category = params.category || "all";
  const region = params.region || params.geo || "IN";
  const search = (params.search || params.q || "").trim().toLowerCase();

  const topicParam = params.topic || "";
  let topicsParam = params.topics || "";
  let rawInterests = params.interests || "";

  // Auto-load preferences & recent search history from database for authenticated user
  const userId = options.userId || params.userId || null;
  let recentSearches = [];
  const searchesParam = params.searches || null;
  if (searchesParam) {
    recentSearches = String(searchesParam)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  if (userId) {
    try {
      const dbPrefs = await getUserTrendPreferences(userId);
      if (dbPrefs) {
        if (!topicsParam && !topicParam && Array.isArray(dbPrefs.selectedTopicIds) && dbPrefs.selectedTopicIds.length > 0) {
          topicsParam = dbPrefs.selectedTopicIds.join(",");
        }
        if (dbPrefs.interests) {
          rawInterests = rawInterests ? `${rawInterests}, ${dbPrefs.interests}` : dbPrefs.interests;
        }
        if (Array.isArray(dbPrefs.recentSearches) && dbPrefs.recentSearches.length > 0) {
          recentSearches = Array.from(new Set([...recentSearches, ...dbPrefs.recentSearches]));
        }
      }
    } catch (e) {
      console.warn("[TREND-FEED] Could not load DB preferences:", e.message);
    }
  }

  const {
    targetTopics,
    searchQueries,
    keywords,
    isFilteredToSingleTopic,
    activeTopic,
  } = resolveTargetTopics({
    topics: topicsParam,
    topic: topicParam,
    interests: rawInterests,
    recentSearches,
  });

  // Build searchTopicObjects for searched topics not covered in targetTopics
  const searchTopicObjects = (recentSearches || [])
    .map((q) => String(q || "").trim())
    .filter((q) => {
      const cleanQ = q.toLowerCase().replace(/^#/, "");
      return (
        cleanQ.length > 1 &&
        !targetTopics.some(
          (t) =>
            t.label.toLowerCase() === cleanQ ||
            t.id.toLowerCase() === cleanQ ||
            (Array.isArray(t.keywords) && t.keywords.some((k) => k.toLowerCase() === cleanQ))
        )
      );
    })
    .map((q) => {
      const cleanQ = q.replace(/^#/, "").trim();
      return {
        id: `search_${cleanQ.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        label: cleanQ,
        searchQuery: cleanQ,
        pinterestQuery: cleanQ,
        blueskyQuery: cleanQ,
        keywords: cleanQ.toLowerCase().split(/\s+/).filter((w) => w.length > 1),
        subCategory: "all",
        emoji: "🔍",
        isSearchedTopic: true,
      };
    });

  const allTopicDefs = [...targetTopics, ...searchTopicObjects];
  const allKeywords = Array.from(new Set([...keywords, ...searchTopicObjects.flatMap((s) => s.keywords)]));

  const decodedCursor = decodeTrendCursor(params.cursor);
  const pageNumber = Number(params.page || decodedCursor?.page || 1);

  const seen = new Set(seenIds);
  const cache = options.cache === undefined ? getTrendFeedCache() : options.cache;
  const key = cacheKey({
    userId,
    limit,
    cursor: params.cursor,
    seenIds,
    interests,
    topics: targetTopics.map((t) => t.id),
    topic: topicParam,
    type,
    category,
    region,
    search,
    page: pageNumber,
  });

  const cached = await readCache(cache, key);
  if (cached) return { ...cached, cached: true };

  // 1. Fetch DB candidates
  let dbRows = [];
  try {
    let query = supabase
      .from("posts")
      .select("id,source_platform,source_url,embed_html,thumbnail_url,caption,engagement_score,niche_tags,published_at,ingested_at,creator,creator_avatar_url,author_id,media_urls,media_type")
      .order("ingested_at", { ascending: false });

    if (type === "social") {
      query = query.in("source_platform", ["reddit", "bluesky", "socialpilot"]);
    } else if (type === "videos") {
      query = query.in("source_platform", ["youtube", "socialpilot"]);
    } else if (type === "pinterest") {
      query = query.eq("source_platform", "pinterest");
    } else if (type === "bluesky") {
      query = query.eq("source_platform", "bluesky");
    }

    const { data, error } = await query.limit(CANDIDATE_LIMIT);
    if (!error && data) {
      dbRows = data.map(communityFeedPost);
    }
  } catch (err) {
    console.warn("[TREND-FEED] DB query notice:", err?.message);
  }

  // 2. Fetch live external items for current page
  let externalRows = [];
  if (options.skipExternal !== true && type !== "community") {
    try {
      const token = params.pinterestToken || options.pinterestToken || null;
      externalRows = await fetchLiveExternalPosts({
        type,
        category,
        region,
        search,
        targetTopics,
        searchQueries,
        searchTopicObjects,
        isFilteredToSingleTopic,
        activeTopic,
        page: pageNumber,
        token,
      });
    } catch (e) {
      console.warn("[TREND-FEED] External items skipped:", e.message);
    }
  }

  // Merge items
  let allCandidates = [...externalRows, ...dbRows];

  // Apply precision relevance scoring & spam filter when search keyword is provided
  if (search) {
    if (type === "pinterest") {
      // Retain direct live pins matching Pinterest's search results without artificial keyword dropping
      allCandidates = allCandidates.filter((item) => item.source_platform === "pinterest");
    } else if (type === "bluesky") {
      // Retain direct live Bluesky posts matching Bluesky search results
      allCandidates = allCandidates.filter((item) => item.source_platform === "bluesky");
    } else {
      allCandidates = filterAndRankPosts(allCandidates, search);
    }
  } else if (isFilteredToSingleTopic && activeTopic) {
    // When filtered to a single topic, prioritize/keep matching items
    const topicFiltered = allCandidates.filter((item) => {
      if (item.interest_topic === activeTopic.id || item.matched_topic === activeTopic.label) return true;
      const match = calculateItemTopicMatch(item, [activeTopic], activeTopic.keywords);
      return match.matchCount > 0;
    });
    if (topicFiltered.length > 0) {
      allCandidates = topicFiltered;
    }
  }

  // Apply type filter if not 'all'
  if (type === "videos") {
    allCandidates = allCandidates.filter(
      (item) =>
        item.source_platform === "youtube" ||
        item.source_platform === "pexels" ||
        item.content_type === "video" ||
        item.content_type === "reel_video" ||
        item.content_type === "short"
    );
  } else if (type === "news") {
    allCandidates = allCandidates.filter(
      (item) =>
        item.source_platform === "gnews" ||
        item.source_platform === "newsapi" ||
        item.content_type === "news"
    );
  } else if (type === "searches") {
    allCandidates = allCandidates.filter(
      (item) => item.source_platform === "google_trends" || item.content_type === "trend_query"
    );
  } else if (type === "visuals") {
    allCandidates = allCandidates.filter(
      (item) =>
        item.source_platform === "unsplash" ||
        item.source_platform === "pinterest" ||
        item.content_type === "visual"
    );
  } else if (type === "pinterest") {
    allCandidates = allCandidates.filter((item) => item.source_platform === "pinterest");
  } else if (type === "bluesky") {
    allCandidates = allCandidates.filter((item) => item.source_platform === "bluesky");
  } else if (type === "community") {
    allCandidates = allCandidates.filter((item) => item.source_platform === "socialpilot");
  } else if (type === "social") {
    allCandidates = allCandidates.filter(
      (item) => item.source_platform === "reddit" || item.source_platform === "bluesky" || item.source_platform === "socialpilot"
    );
  }

  // Rank posts
  const rankPosts = (posts) =>
    applyRankCursor(
      posts
        .map((post) => {
          const matchResult = calculateItemTopicMatch(post, allTopicDefs, allKeywords);
          const hasDirectTopic = Boolean(post.matched_topic || post.interest_topic);
          const matches = hasDirectTopic ? Math.max(matchResult.matchCount, 3) : matchResult.matchCount;
          const score = scoreTrendPost(post, now);

          let topicBoost = 1;
          if (allTopicDefs.length > 0 || allKeywords.length > 0) {
            topicBoost = matches > 0 ? 500 + matches * 150 : 0.05;
          }

          return {
            ...post,
            matched_topic: post.matched_topic || matchResult.matchedTopic?.label || null,
            interest_topic: post.interest_topic || matchResult.matchedTopic?.id || null,
            topic_emoji: post.topic_emoji || matchResult.matchedTopic?.emoji || null,
            interest_match_count: matches,
            rank_score: Number((score * topicBoost).toFixed(6)),
          };
        })
        .sort(compareRankedPosts),
      params.cursor
    );

  // Interleave different media formats and topics in authentic Pinterest waterfall fashion
  function interleavePinterestFeed(posts, targetLimit) {
    if (!posts || posts.length === 0) return [];

    const isPersonalized = targetTopics.length > 0 || searchTopicObjects.length > 0;

    // When personalized with multiple topics, interleave across topics for balanced representation
    if (isPersonalized && allTopicDefs.length > 1) {
      const topicBuckets = new Map();
      const otherPosts = [];

      allTopicDefs.forEach((t) => {
        topicBuckets.set(t.label.toLowerCase(), {
          def: t,
          items: [],
        });
      });

      posts.forEach((p) => {
        const topicName = (p.matched_topic || "").toLowerCase();
        let bucket = topicBuckets.get(topicName);
        if (!bucket && p.interest_topic) {
          const matchedDef = allTopicDefs.find(
            (t) => t.id === p.interest_topic || t.label.toLowerCase() === topicName
          );
          if (matchedDef) {
            bucket = topicBuckets.get(matchedDef.label.toLowerCase());
          }
        }
        if (bucket) {
          bucket.items.push(p);
        } else {
          otherPosts.push(p);
        }
      });

      const activeBuckets = Array.from(topicBuckets.values()).filter((b) => b.items.length > 0);

      if (activeBuckets.length > 0) {
        const result = [];
        const seenIds = new Set();
        let hasMore = true;

        while (result.length < targetLimit && hasMore) {
          hasMore = false;
          for (const b of activeBuckets) {
            if (b.items.length > 0 && result.length < targetLimit) {
              const item = b.items.shift();
              if (item && !seenIds.has(item.id)) {
                seenIds.add(item.id);
                result.push(item);
                hasMore = true;
              }
            }
          }
        }

        const leftover = [
          ...activeBuckets.flatMap((b) => b.items),
          ...otherPosts,
        ];
        for (const item of leftover) {
          if (result.length >= targetLimit) break;
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            result.push(item);
          }
        }

        if (result.length < targetLimit) {
          for (const item of posts) {
            if (result.length >= targetLimit) break;
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              result.push(item);
            }
          }
        }

        return result;
      }
    }

    // Default: Interleave across platforms for single topic or global trend feed
    const reels = [];
    const visuals = [];
    const videos = [];
    const news = [];
    const pinterest = [];
    const bluesky = [];
    const others = [];
    const community = [];

    posts.forEach((p) => {
      // If personalized feed, prevent zero-match items from taking high-priority rotation slots
      const isRelevant = !isPersonalized || (p.interest_match_count && p.interest_match_count > 0);
      if (!isRelevant) {
        others.push(p);
        return;
      }

      if (p.source_platform === "socialpilot") {
        community.push(p);
      } else if (p.source_platform === "pinterest") {
        pinterest.push(p);
      } else if (p.source_platform === "bluesky") {
        bluesky.push(p);
      } else if (p.source_platform === "pexels" || p.content_type === "short" || p.content_type === "reel_video") {
        reels.push(p);
      } else if (p.source_platform === "unsplash" || p.content_type === "visual") {
        visuals.push(p);
      } else if (p.source_platform === "youtube") {
        videos.push(p);
      } else if (p.source_platform === "gnews" || p.source_platform === "newsapi" || p.content_type === "news") {
        news.push(p);
      } else {
        others.push(p);
      }
    });

    const result = [];
    const pattern = [pinterest, visuals, reels, bluesky, videos, community, pinterest, visuals, reels, bluesky, news, videos, others];
    let hasMore = true;

    while (result.length < targetLimit && hasMore) {
      hasMore = false;
      for (const bucket of pattern) {
        if (bucket.length > 0 && result.length < targetLimit) {
          const item = bucket.shift();
          if (item && !result.some((r) => r.id === item.id)) {
            result.push(item);
            hasMore = true;
          }
        }
      }
    }

    // Append any remaining items if limit not reached
    const remaining = [...pinterest, ...bluesky, ...community, ...visuals, ...reels, ...videos, ...news, ...others];
    for (const item of remaining) {
      if (result.length >= targetLimit) break;
      if (!result.some((r) => r.id === item.id)) {
        result.push(item);
      }
    }

    if (result.length < targetLimit) {
      for (const item of posts) {
        if (result.length >= targetLimit) break;
        if (!result.some((r) => r.id === item.id)) {
          result.push(item);
        }
      }
    }

    return result;
  }

  const unseenRows = allCandidates.filter((post) => !seen.has(post.id));
  const candidatePool = unseenRows.length ? unseenRows : allCandidates;
  const ranked = rankPosts(candidatePool);

  // Take current page slice (Interleaved for 'all', ranked slice for filtered tabs)
  const items = type === "all" ? interleavePinterestFeed(ranked, limit) : ranked.slice(0, limit);
  const nextPage = pageNumber + 1;

  // Next cursor is always guaranteed for true infinite scroll
  const nextCursor =
    items.length > 0
      ? encodeTrendCursor(items[items.length - 1], nextPage)
      : encodeTrendCursor({ id: `page_${nextPage}`, rank_score: 0.1 }, nextPage);

  const page = {
    success: true,
    items,
    nextCursor,
    page: pageNumber,
    totalCandidateCount: ranked.length,
    cached: false,
    isPersonalized: Boolean(targetTopics.length > 0 || searchQueries.length > 0),
    activeTopic: activeTopic ? { id: activeTopic.id, label: activeTopic.label, emoji: activeTopic.emoji } : null,
    topics: targetTopics.map((t) => ({ id: t.id, label: t.label, emoji: t.emoji })),
    recentSearches: recentSearches.slice(0, 5),
  };

  await writeCache(cache, key, page);
  return page;
}

// Hot topics radar (combining Google Trends & Bluesky official trends)
export async function getHotTopicsRadar({ geo = "IN" } = {}) {
  try {
    const [googleRes, bskyRes] = await Promise.allSettled([
      fetchGoogleTrends({ geo, page: 1 }),
      getBlueskyTrendingTopics(),
    ]);

    const googleTrends = googleRes.status === "fulfilled" ? googleRes.value || [] : [];
    const bskyTrends = bskyRes.status === "fulfilled" ? bskyRes.value?.trends || [] : [];

    const topics = [];

    // Map Google Trends
    for (const t of googleTrends.slice(0, 10)) {
      topics.push({
        query: t.title,
        volume: t.metrics?.searchVolume || "200K+",
        related: t.related_queries || [],
        url: t.source_url,
        source: "Google Trends",
      });
    }

    // Map Bluesky Trends
    for (const bt of bskyTrends.slice(0, 8)) {
      topics.push({
        query: bt.displayName || bt.topic,
        volume: bt.postCount ? `${bt.postCount} posts` : "Rising",
        category: bt.category || "Social Buzz",
        source: "Bluesky",
      });
    }

    if (topics.length > 0) {
      return {
        success: true,
        hotTopics: topics,
      };
    }

    const isIndia = String(geo || "IN").toUpperCase() === "IN";
    return {
      success: true,
      hotTopics: isIndia
        ? [
            { query: "IPL & Cricket", volume: "2M+", source: "India Trends" },
            { query: "AI in India", volume: "1M+", source: "India Tech" },
            { query: "Bollywood & Music", volume: "800K+", source: "India Entertainment" },
            { query: "Indian Startups & SaaS", volume: "500K+", source: "India Business" },
            { query: "Viral Reels India", volume: "650K+", source: "India Creators" },
          ]
        : [
            { query: "Artificial Intelligence", volume: "1M+", source: "Global" },
            { query: "Social Media Growth", volume: "500K+", source: "Global" },
            { query: "Viral Reels Strategy", volume: "350K+", source: "Global" },
            { query: "AI Content Creation", volume: "250K+", source: "Global" },
          ],
    };
  } catch (err) {
    const isIndia = String(geo || "IN").toUpperCase() === "IN";
    return {
      success: true,
      hotTopics: isIndia
        ? [
            { query: "IPL & Cricket", volume: "2M+", source: "India Trends" },
            { query: "AI in India", volume: "1M+", source: "India Tech" },
            { query: "Bollywood & Music", volume: "800K+", source: "India Entertainment" },
            { query: "Indian Startups & SaaS", volume: "500K+", source: "India Business" },
            { query: "Viral Reels India", volume: "650K+", source: "India Creators" },
          ]
        : [
            { query: "Artificial Intelligence", volume: "1M+", source: "Global" },
            { query: "Social Media Growth", volume: "500K+", source: "Global" },
            { query: "Viral Reels Strategy", volume: "350K+", source: "Global" },
            { query: "AI Content Creation", volume: "250K+", source: "Global" },
          ],
    };
  }
}
