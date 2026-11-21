import { communityFeedPost } from "./socialpilotPublishing.js";
import IORedis from "ioredis";
import crypto from "crypto";
import {
  fetchYouTubeTrends,
  fetchYouTubeShorts,
  fetchGoogleTrends,
  fetchTrendingNews,
  fetchUnsplashTrends,
  fetchPexelsTrends,
  fetchPinterestTrends,
  filterAndRankPosts,
  calculateRelevance,
} from "./trends/trendSources.js";
import {
  resolveTargetTopics,
  calculateItemTopicMatch,
  getTopicDefinition,
  getPinterestTopicQuery,
  isItemRelevantToTopic,
} from "./trends/trendTopics.js";
import { getUserTrendPreferences } from "./trends/userTrendPreferencesService.js";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 60;
const CANDIDATE_LIMIT = 500;
const HALF_LIFE_HOURS = 72;
const CACHE_TTL_SECONDS = Number(process.env.TREND_FEED_CACHE_TTL_SECONDS || 60);

let redisClient;

export function getCanonicalPostKey(post) {
  if (!post) return "";
  if (post.video_id) {
    return `yt_${post.video_id}`;
  }
  const ytMatch = String(post.source_url || post.embed_html || "").match(/(?:shorts\/|v=|embed\/|youtu\.be\/)([\w-]{11})/i);
  if (ytMatch?.[1]) {
    return `yt_${ytMatch[1]}`;
  }
  const pinMatch = String(post.source_url || "").match(/pin\/(\d+)/i);
  if (pinMatch?.[1]) {
    return `pin_${pinMatch[1]}`;
  }
  const pxMatch = String(post.source_url || "").match(/video[s]?\/(\d+)/i);
  if (pxMatch?.[1]) {
    return `px_${pxMatch[1]}`;
  }
  if (typeof post.id === "string" && post.id.startsWith("un_")) {
    return post.id;
  }
  if (post.source_url) {
    const cleanUrl = post.source_url.split("?")[0].replace(/\/+$/, "").toLowerCase();
    if (cleanUrl.length > 10) return cleanUrl;
  }
  if (post.title) {
    const cleanTitle = post.title.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    if (cleanTitle.length > 6) {
      return `${post.source_platform || "post"}_${cleanTitle.slice(0, 40)}`;
    }
  }
  return String(post.id || "");
}

export function dedupePostsByCanonicalKey(posts = []) {
  if (!Array.isArray(posts)) return [];
  const seenKeys = new Set();
  const seenIds = new Set();
  const result = [];

  for (const post of posts) {
    if (!post) continue;
    const id = post.id ? String(post.id) : null;
    const cKey = getCanonicalPostKey(post);

    if (id && seenIds.has(id)) continue;
    if (cKey && seenKeys.has(cKey)) continue;

    if (id) seenIds.add(id);
    if (cKey) seenKeys.add(cKey);
    result.push(post);
  }

  return result;
}

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
  return `trend:feed:v3:${params.limit || DEFAULT_LIMIT}:${params.cursor || "first"}:${seenHash}`;
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
  if (post.source_platform === "socialpilot") {
    // SocialPilot posts are original user uploads: keep base score high and fresh
    const publishedAt = new Date(post.published_at || post.ingested_at || now);
    const ageHours = Math.max((now - publishedAt) / 36e5, 0.1);
    return Number((50000 / Math.sqrt(ageHours)).toFixed(6));
  }
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
  if (a.is_user_post && !b.is_user_post) return -1;
  if (!a.is_user_post && b.is_user_post) return 1;
  if (a.source_platform === "socialpilot" && b.source_platform !== "socialpilot") return -1;
  if (a.source_platform !== "socialpilot" && b.source_platform === "socialpilot") return 1;

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
  tunedTopics = [],
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
    if (type === "all" || type === "shorts" || type === "videos") {
      promises.push(fetchYouTubeShorts({ region, category, query: q, maxResults: 25, page }));
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

    if (type === "all" || type === "pinterest" || type === "visuals") {
      promises.push(fetchPinterestTrends({ category, query: "", limit: pLimit, page, token, region }));
    }
    if (type === "all" || type === "shorts" || type === "videos") {
      promises.push(fetchYouTubeShorts({ region, category, query: "", maxResults: 25, page }));
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
      if (type === "all" || type === "shorts" || type === "videos") {
        promises.push(
          fetchYouTubeShorts({ region, category: subCat, query: ytQ, maxResults: 20, page })
            .then((shorts) =>
              Array.isArray(shorts)
                ? shorts
                    .filter((s) => isItemRelevantToTopic(s, activeTopic))
                    .map((s) => ({
                      ...s,
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
      }
      if (type === "visuals" || activeTopic.label.toLowerCase().includes("stock")) {
        promises.push(fetchPexelsTrends({ category: subCat, query: pinQ, perPage: 20, page, region }));
        promises.push(fetchUnsplashTrends({ category: subCat, query: pinQ, perPage: 20, page, region }));
      }
      if (type === "all" || type === "news") {
        promises.push(fetchTrendingNews({ category: subCat, region, query: ytQ, page }));
      }
    } else {
      // MIXED FEED: Prioritize user's searched topics and tuned topics at the very front of the pool!
      const topicsPool = [];
      const seenTopicKeys = new Set();

      const pushTopic = (t) => {
        if (!t) return;
        const key = (t.label || t.id || "").toLowerCase().trim();
        if (key && !seenTopicKeys.has(key)) {
          seenTopicKeys.add(key);
          topicsPool.push(t);
        }
      };

      // 1. Explicit tuned topics from "Tune Feed" modal (creator role, custom keywords) LEAD the feed!
      (tunedTopics || []).forEach(pushTopic);

      // 2. Searched topics lead next
      (searchTopicObjects || []).forEach(pushTopic);

      // 3. User onboarding selected topics
      (targetTopics || []).forEach(pushTopic);

      // 4. Any raw search queries
      (searchQueries || []).forEach((q) => {
        pushTopic({
          label: q,
          searchQuery: q,
          subCategory: "all",
          emoji: "🔍",
          id: `search_${q.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
          keywords: [q.toLowerCase()],
          isSearchedTopic: true,
        });
      });

      // If user is specifically on "searches" tab, include Google Trends
      if (page === 1 && type === "searches") {
        promises.push(
          fetchGoogleTrends({ geo: region, page: 1 })
            .then((items) => (Array.isArray(items) ? items.slice(0, 3) : []))
            .catch(() => [])
        );
      }

      // In personalized feed, fetch across user's topics (up to 6 topics on Page 1 for rich diverse niche coverage)
      const countForPage = page === 1 ? Math.min(topicsPool.length, 6) : Math.min(topicsPool.length, 4);
      const startIndex = ((page - 1) * countForPage) % topicsPool.length;
      let topicsForPage = topicsPool.slice(startIndex, startIndex + countForPage);
      if (topicsForPage.length < countForPage && topicsPool.length >= countForPage) {
        topicsForPage = [...topicsForPage, ...topicsPool.slice(0, countForPage - topicsForPage.length)];
      }
      const limitPerTopic = Math.max(Math.floor(36 / topicsForPage.length), 8);

      for (const tDef of topicsForPage) {
        const pinQ = getPinterestTopicQuery(tDef);
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
        if (type === "all" || type === "shorts" || type === "videos") {
          promises.push(
            fetchYouTubeShorts({ region, category: subCat, query: ytQ, maxResults: limitPerTopic, page })
              .then((shorts) =>
                Array.isArray(shorts)
                  ? shorts
                      .filter((s) => isItemRelevantToTopic(s, tDef))
                      .map((s) => ({
                        ...s,
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

      // Visuals & News for primary topic of this page (strictly verified against topic)
      const primary = topicsForPage[(page - 1) % topicsForPage.length] || topicsForPage[0];
      if (primary) {
        const pQuery = getPinterestTopicQuery(primary);
        const pYt = primary.searchQuery || primary.label;
        const pCat = primary.subCategory || "all";
        if (type === "visuals" || primary.label.toLowerCase().includes("stock")) {
          promises.push(
            fetchPexelsTrends({ category: pCat, query: pQuery, perPage: 12, page, region })
              .then((items) =>
                Array.isArray(items)
                  ? items
                      .filter((p) => isItemRelevantToTopic(p, primary))
                      .map((p) => ({
                        ...p,
                        matched_topic: primary.label,
                        interest_topic: primary.id,
                        topic_emoji: primary.emoji,
                      }))
                  : []
              )
              .catch(() => [])
          );
          promises.push(
            fetchUnsplashTrends({ category: pCat, query: pQuery, perPage: 12, page, region })
              .then((items) =>
                Array.isArray(items)
                  ? items
                      .filter((p) => isItemRelevantToTopic(p, primary))
                      .map((p) => ({
                        ...p,
                        matched_topic: primary.label,
                        interest_topic: primary.id,
                        topic_emoji: primary.emoji,
                      }))
                  : []
              )
              .catch(() => [])
          );
        }
        if (type === "all" || type === "news") {
          promises.push(
            fetchTrendingNews({ category: pCat, region, query: pYt, page })
              .then((items) =>
                Array.isArray(items)
                  ? items
                      .filter((p) => isItemRelevantToTopic(p, primary))
                      .map((p) => ({
                        ...p,
                        matched_topic: primary.label,
                        interest_topic: primary.id,
                        topic_emoji: primary.emoji,
                      }))
                  : []
              )
              .catch(() => [])
          );
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
    if (type === "all" || type === "shorts" || type === "videos") {
      promises.push(fetchYouTubeShorts({ region, category, maxResults: 25, page }));
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
    const rawList = results
      .filter((r) => r.status === "fulfilled" && Array.isArray(r.value))
      .flatMap((r) => r.value);
    return dedupePostsByCanonicalKey(rawList);
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

  // Auto-load preferences & recent search history strictly from database for authenticated user
  const userId = options.userId || params.userId || null;
  let recentSearches = [];

  if (userId) {
    try {
      const dbPrefs = await getUserTrendPreferences(userId);
      if (dbPrefs) {
        // Merge DB saved topics with client-passed topics for this authenticated user
        const dbTopicIds = Array.isArray(dbPrefs.selectedTopicIds) ? dbPrefs.selectedTopicIds : [];
        const clientTopicIds = String(topicsParam || "").split(",").map((t) => t.trim()).filter(Boolean);
        const mergedTopicIds = Array.from(new Set([...dbTopicIds, ...clientTopicIds]));
        topicsParam = mergedTopicIds.join(",");

        const dbInterests = [dbPrefs.work, dbPrefs.interests, dbPrefs.goal].filter(Boolean).join(", ");
        rawInterests = [dbInterests, rawInterests].filter(Boolean).join(", ");

        const dbSearches = Array.isArray(dbPrefs.recentSearches) ? dbPrefs.recentSearches : [];
        const clientSearches = String(params.searches || "").split(",").map((s) => s.trim()).filter(Boolean);
        recentSearches = Array.from(new Set([...dbSearches, ...clientSearches]));
      }
    } catch (e) {
      console.warn("[TREND-FEED] Could not load DB preferences:", e.message);
    }
  } else {
    // Only unauthenticated/anonymous visitors use query parameters
    const searchesParam = params.searches || null;
    if (searchesParam) {
      recentSearches = String(searchesParam)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }

  const {
    targetTopics,
    tunedTopics = [],
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

  // Build searchTopicObjects for searched topics (leads feed personalization)
  const rawSearchTopicObjects = (recentSearches || [])
    .map((q) => String(q || "").trim())
    .filter((q) => q.replace(/^#/, "").trim().length > 1)
    .map((q) => {
      const cleanQ = q.replace(/^#/, "").trim();
      const cleanLower = cleanQ.toLowerCase();
      // Check if there is an existing registry topic definition for this search
      const existingDef =
        getTopicDefinition(cleanQ) ||
        targetTopics.find(
          (t) => t.label.toLowerCase() === cleanLower || t.id.toLowerCase() === cleanLower
        );
      if (existingDef) {
        return {
          ...existingDef,
          isSearchedTopic: true,
        };
      }
      return {
        id: `search_${cleanLower.replace(/[^a-z0-9]+/g, "_")}`,
        label: cleanQ,
        searchQuery: cleanQ,
        pinterestQuery: cleanQ,
        blueskyQuery: cleanQ,
        keywords: cleanLower.split(/\s+/).filter((w) => w.length > 1),
        subCategory: "all",
        emoji: "🔍",
        isSearchedTopic: true,
      };
    });

  // Deduplicate searchTopicObjects
  const searchTopicObjects = [];
  const seenSearchKeys = new Set();
  for (const st of rawSearchTopicObjects) {
    const k = (st.label || st.id).toLowerCase();
    if (!seenSearchKeys.has(k)) {
      seenSearchKeys.add(k);
      searchTopicObjects.push(st);
    }
  }

  const uniqueTopicDefs = [];
  const seenTopicLabels = new Set();
  const rawDefs = (isFilteredToSingleTopic && activeTopic)
    ? [activeTopic]
    : [...tunedTopics, ...searchTopicObjects, ...targetTopics];
  for (const def of rawDefs) {
    const key = (def.label || def.id || "").toLowerCase().trim();
    if (key && !seenTopicLabels.has(key)) {
      seenTopicLabels.add(key);
      uniqueTopicDefs.push(def);
    }
  }
  const allTopicDefs = uniqueTopicDefs;
  const allKeywords = Array.from(new Set([...keywords, ...allTopicDefs.flatMap((s) => s.keywords || [])]));

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
    // Explicitly query all recent SocialPilot community posts so they never get crowded out
    const { data: spRows } = await supabase
      .from("posts")
      .select("id,source_platform,source_url,embed_html,thumbnail_url,caption,engagement_score,niche_tags,published_at,ingested_at,creator,creator_avatar_url,author_id,media_urls,media_type")
      .eq("source_platform", "socialpilot")
      .order("published_at", { ascending: false })
      .limit(50);

    let query = supabase
      .from("posts")
      .select("id,source_platform,source_url,embed_html,thumbnail_url,caption,engagement_score,niche_tags,published_at,ingested_at,creator,creator_avatar_url,author_id,media_urls,media_type")
      .order("ingested_at", { ascending: false });

    if (type === "social") {
      query = query.in("source_platform", ["reddit", "socialpilot"]);
    } else if (type === "videos" || type === "shorts") {
      query = query.in("source_platform", ["youtube", "socialpilot"]);
    } else if (type === "pinterest") {
      query = query.eq("source_platform", "pinterest");
    }

    const { data, error } = await query.limit(CANDIDATE_LIMIT);
    const combined = [...(spRows || []), ...(data || [])];
    const uniqueMap = new Map();
    for (const r of combined) {
      if (!uniqueMap.has(r.id)) uniqueMap.set(r.id, r);
    }
    dbRows = Array.from(uniqueMap.values()).map(communityFeedPost);
    // If a specific non-Indian country was chosen (e.g. US, GB, CA, AU), do not let ingested Indian YouTube posts drown out live items
    const targetRegionUpper = String(region || "IN").toUpperCase();
    if (targetRegionUpper !== "IN" && targetRegionUpper !== "GLOBAL") {
      dbRows = dbRows.filter((p) => {
        if (p.source_platform === "socialpilot") return true;
        if (p.region === targetRegionUpper || p.country === targetRegionUpper) return true;
        if (Array.isArray(p.niche_tags) && p.niche_tags.includes(`region:${targetRegionUpper}`)) return true;
        return false;
      });
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
        tunedTopics,
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

  // Merge items and deduplicate candidates by canonical key
  let allCandidates = dedupePostsByCanonicalKey([...externalRows, ...dbRows]);

  // Apply precision relevance scoring & spam filter when search keyword is provided
  if (search) {
    if (type === "pinterest") {
      // Retain direct live pins matching Pinterest's search results without artificial keyword dropping
      allCandidates = allCandidates.filter((item) => item.source_platform === "pinterest");
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
  } else if (allTopicDefs.length > 0) {
    // PERSONALIZED "ALL TOPICS" FEED:
    // Strictly retain ONLY items relevant to user's selected onboarding, searched, or tuned topics
    // (plus user's own uploads). Filter out any unrelated generic DB or external posts!
    const personalizedFiltered = allCandidates.filter((item) => {
      const isUserOwn = Boolean(
        options.userId && (
          item.author_id === options.userId ||
          (Array.isArray(item.niche_tags) && item.niche_tags.includes(`author:${options.userId}`))
        )
      );
      if (isUserOwn) return true;

      // Strictly verify relevance across active user topic definitions
      return allTopicDefs.some((tDef) => isItemRelevantToTopic(item, tDef));
    });

    if (personalizedFiltered.length > 0) {
      allCandidates = personalizedFiltered;
    }
  }

  // Apply type filter if not 'all'
  if (type === "shorts") {
    allCandidates = allCandidates.filter(
      (item) =>
        (item.source_platform === "youtube" || item.target_platform === "youtube") &&
        (item.content_type === "short" ||
          item.source_url?.includes("/shorts/") ||
          item.is_short ||
          Boolean(item.video_id))
    );
  } else if (type === "videos") {
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
  } else if (type === "community") {
    allCandidates = allCandidates.filter((item) => item.source_platform === "socialpilot");
  } else if (type === "social") {
    allCandidates = allCandidates.filter(
      (item) => item.source_platform === "reddit" || item.source_platform === "socialpilot"
    );
  }

  // Rank posts
  const rankPosts = (posts) =>
    applyRankCursor(
      posts
        .map((post) => {
          const isUserOwn = Boolean(
            options.userId && (
              post.author_id === options.userId ||
              (Array.isArray(post.niche_tags) && post.niche_tags.includes(`author:${options.userId}`))
            )
          );
          const isSocialpilot = post.source_platform === "socialpilot";

          const matchResult = calculateItemTopicMatch(post, allTopicDefs, allKeywords);
          const hasDirectTopic = Boolean(post.matched_topic || post.interest_topic);
          const matches = hasDirectTopic ? Math.max(matchResult.matchCount, 3) : matchResult.matchCount;
          const score = scoreTrendPost(post, now);

          let topicBoost = 1;
          if (allTopicDefs.length > 0 || allKeywords.length > 0) {
            topicBoost = matches > 0 ? 500 + matches * 150 : 0.05;
          }

          // Check match with explicit keywords configured in "Tune Feed" modal (role, custom keywords, formats)
          const isTunedMatch = (tunedTopics || []).some((tune) => {
            if (post.matched_topic && post.matched_topic.toLowerCase() === tune.label.toLowerCase()) return true;
            if (post.interest_topic && post.interest_topic === tune.id) return true;
            const textHaystack = `${post.title || ""} ${post.caption || ""}`.toLowerCase();
            return tune.keywords.some((kw) => kw.length > 2 && textHaystack.includes(kw));
          });

          // Check match with user's recent searches or searched topics
          const isSearchedMatch =
            (searchTopicObjects || []).some((sTopic) => {
              if (post.matched_topic && post.matched_topic.toLowerCase() === sTopic.label.toLowerCase()) return true;
              if (post.interest_topic && post.interest_topic === sTopic.id) return true;
              const textHaystack = `${post.title || ""} ${post.caption || ""} ${Array.isArray(post.niche_tags) ? post.niche_tags.join(" ") : ""}`.toLowerCase();
              return (sTopic.keywords || [sTopic.label.toLowerCase()]).some((kw) => kw.length > 1 && textHaystack.includes(kw));
            }) ||
            (recentSearches || []).some((term) => {
              const cleanTerm = String(term || "").trim().toLowerCase().replace(/^#/, "");
              if (cleanTerm.length < 2) return false;
              const textHaystack = `${post.title || ""} ${post.caption || ""} ${Array.isArray(post.niche_tags) ? post.niche_tags.join(" ") : ""}`.toLowerCase();
              return textHaystack.includes(cleanTerm);
            });

          const targetRegionUpper = String(region || "IN").toUpperCase();
          const isMatchingRegion =
            post.region === targetRegionUpper ||
            post.country === targetRegionUpper ||
            (Array.isArray(post.niche_tags) && post.niche_tags.includes(`region:${targetRegionUpper}`));

          const isCountryPulse =
            (post.source_platform === "google_trends" || post.content_type === "trend_query") &&
            (targetRegionUpper === "GLOBAL" || isMatchingRegion);

          // Prioritize user's own uploads at top, followed by user's searched, tuned, and interest topics!
          let rankScore;
          if (isUserOwn) {
            rankScore = 200000000 + score;
          } else if (search) {
            const relScore = calculateRelevance(post, search);
            rankScore = (relScore * 1000000) + score;
          } else if (isTunedMatch) {
            const regMultiplier = isMatchingRegion ? 1.4 : 1.0;
            rankScore = (95000000 * regMultiplier) + (score * 800) + matches * 30000;
          } else if (isSearchedMatch) {
            const regMultiplier = isMatchingRegion ? 1.4 : 1.0;
            rankScore = (90000000 * regMultiplier) + (score * 800) + matches * 25000;
          } else if (hasDirectTopic || matches > 0) {
            const regMultiplier = isMatchingRegion ? 1.4 : 1.0;
            rankScore = (70000000 * regMultiplier) + (score * 500) + matches * 10000;
          } else if (isCountryPulse) {
            rankScore = 30000000 + score;
          } else if (isSocialpilot) {
            rankScore = 20000000 + score;
          } else {
            const regMultiplier = isMatchingRegion ? 2.5 : 1.0;
            rankScore = Number((score * topicBoost * regMultiplier).toFixed(6));
          }

          return {
            ...post,
            matched_topic: post.matched_topic || matchResult.matchedTopic?.label || null,
            interest_topic: post.interest_topic || matchResult.matchedTopic?.id || null,
            topic_emoji: post.topic_emoji || matchResult.matchedTopic?.emoji || null,
            interest_match_count: matches,
            is_user_post: isUserOwn,
            is_country_pulse: isCountryPulse,
            rank_score: rankScore,
          };
        })
        .sort(compareRankedPosts),
      params.cursor
    );

  // Interleave different media formats and topics in authentic Pinterest waterfall fashion
  function interleavePinterestFeed(posts, targetLimit) {
    if (!posts || posts.length === 0) return [];

    const targetRegionUpper = String(region || "IN").toUpperCase();
    const result = [];
    const seenIds = new Set();
    const seenKeys = new Set();

    function isSeen(item) {
      if (!item) return true;
      if (item.id && seenIds.has(String(item.id))) return true;
      const cKey = getCanonicalPostKey(item);
      if (cKey && seenKeys.has(cKey)) return true;
      return false;
    }

    function recordSeen(item) {
      if (!item) return;
      if (item.id) seenIds.add(String(item.id));
      const cKey = getCanonicalPostKey(item);
      if (cKey) seenKeys.add(cKey);
    }

    // When searching, strictly preserve relevance ranking!
    if (search) {
      for (const post of posts) {
        if (result.length >= targetLimit) break;
        if (!isSeen(post)) {
          if (post.source_platform === "socialpilot" && calculateRelevance(post, search) === 0) {
            continue;
          }
          recordSeen(post);
          result.push(post);
        }
      }
      return dedupePostsByCanonicalKey(result);
    }

    const isPersonalized = allTopicDefs.length > 0;

    // 1. User's own uploads directly at the very top!
    const userOwnPosts = posts.filter((p) => p.is_user_post);
    for (const post of userOwnPosts) {
      if (result.length < targetLimit && !isSeen(post)) {
        result.push(post);
        recordSeen(post);
      }
    }

    // 2. Personalized Feed: Evenly mixed topic interleaving with ZERO unrelated leakage
    if (isPersonalized) {
      const topicBuckets = new Map();
      allTopicDefs.forEach((t) => {
        topicBuckets.set(t.label.toLowerCase(), {
          def: t,
          items: [],
        });
      });

      const candidatePosts = posts.filter((p) => !p.is_user_post);

      for (const p of candidatePosts) {
        let matchedBucket = null;

        // 1. Check direct matched_topic (verified against topic definition)
        if (p.matched_topic) {
          const b = topicBuckets.get(p.matched_topic.toLowerCase());
          if (b && isItemRelevantToTopic(p, b.def)) {
            matchedBucket = b;
          }
        }

        // 2. Check interest_topic ID (verified against topic definition)
        if (!matchedBucket && p.interest_topic) {
          const matchedDef = allTopicDefs.find(
            (t) => t.id && t.id.toLowerCase() === String(p.interest_topic).toLowerCase()
          );
          if (matchedDef) {
            const b = topicBuckets.get(matchedDef.label.toLowerCase());
            if (b && isItemRelevantToTopic(p, b.def)) {
              matchedBucket = b;
            }
          }
        }

        // 3. Fallback: match via isItemRelevantToTopic against allTopicDefs
        if (!matchedBucket) {
          for (const tDef of allTopicDefs) {
            if (isItemRelevantToTopic(p, tDef)) {
              matchedBucket = topicBuckets.get(tDef.label.toLowerCase());
              if (matchedBucket) {
                p.matched_topic = tDef.label;
                p.interest_topic = tDef.id;
                p.topic_emoji = tDef.emoji;
                break;
              }
            }
          }
        }

        if (matchedBucket) {
          matchedBucket.items.push(p);
        }
        // If not matched to any active user topic, it is DISCARDED! Strictly "uske alawa kuch nhi".
      }

      // Sort items within each bucket by rank_score descending
      for (const bucket of topicBuckets.values()) {
        bucket.items.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));
      }

      const activeBuckets = Array.from(topicBuckets.values()).filter((b) => b.items.length > 0);

      if (activeBuckets.length === 1) {
        // Single topic: interleave across formats (shorts, pins, videos, visuals)
        const singleItems = activeBuckets[0].items;
        const shorts = [];
        const pins = [];
        const others = [];
        for (const item of singleItems) {
          if (item.source_platform === "pinterest") pins.push(item);
          else if (item.content_type === "short" || item.source_url?.includes("/shorts/") || item.is_short) shorts.push(item);
          else others.push(item);
        }
        const formatBuckets = [shorts, pins, others].filter((f) => f.length > 0);
        let hasMoreFormats = true;
        while (result.length < targetLimit && hasMoreFormats) {
          hasMoreFormats = false;
          for (const fb of formatBuckets) {
            if (fb.length > 0 && result.length < targetLimit) {
              const item = fb.shift();
              if (item && !isSeen(item)) {
                recordSeen(item);
                result.push(item);
                hasMoreFormats = true;
              }
            }
          }
        }
        return dedupePostsByCanonicalKey(result);
      }

      if (activeBuckets.length > 1) {
        // Balanced Round-Robin interleaving across all user topics
        // Within each topic, balance formats (shorts, videos, pins) so user sees both shorts and full videos!
        const prefersShorts = allKeywords.some((k) => k === "short" || k === "shorts" || k === "video");
        const bucketQueues = activeBuckets.map((b) => {
          const shorts = [];
          const others = [];
          for (const it of b.items) {
            const isShort = it.content_type === "short" || it.source_url?.includes("/shorts/") || it.is_short;
            if (isShort) shorts.push(it);
            else others.push(it);
          }
          return {
            def: b.def,
            shorts,
            others,
            all: b.items,
            nextIsShort: prefersShorts,
          };
        });

        let round = 0;
        const n = bucketQueues.length;

        // Loop as long as targetLimit is not reached AND at least one queue has items
        while (
          result.length < targetLimit &&
          bucketQueues.some((bq) => bq.shorts.length > 0 || bq.others.length > 0)
        ) {
          let progressInRound = false;

          for (let step = 0; step < n && result.length < targetLimit; step++) {
            const bIndex = (round + step) % n;
            const bq = bucketQueues[bIndex];
            if (!bq) continue;

            // Find next unseen item in this bucket's format queues
            let item = null;
            while (bq.shorts.length > 0 || bq.others.length > 0) {
              let candidate = null;
              if (bq.nextIsShort && bq.shorts.length > 0) {
                candidate = bq.shorts.shift();
                bq.nextIsShort = false;
              } else if (!bq.nextIsShort && bq.others.length > 0) {
                candidate = bq.others.shift();
                bq.nextIsShort = true;
              } else if (bq.shorts.length > 0) {
                candidate = bq.shorts.shift();
              } else if (bq.others.length > 0) {
                candidate = bq.others.shift();
              }

              if (candidate && !isSeen(candidate)) {
                item = candidate;
                break;
              }
            }

            if (item) {
              recordSeen(item);
              result.push(item);
              progressInRound = true;
            }
          }

          round++;
          if (!progressInRound) break;
        }

        // Backfill from any remaining unseen candidate posts matching active topics if targetLimit not reached
        if (result.length < targetLimit) {
          for (const cand of candidatePosts) {
            if (result.length >= targetLimit) break;
            if (!isSeen(cand) && allTopicDefs.some((t) => isItemRelevantToTopic(cand, t))) {
              recordSeen(cand);
              result.push(cand);
            }
          }
        }

        return dedupePostsByCanonicalKey(result);
      }

      return dedupePostsByCanonicalKey(result);
    }

    // 3. Unpersonalized feed: showcase country breaking trends on Page 1
    if (pageNumber === 1 && !isPersonalized) {
      const countryPulsePosts = posts.filter(
        (p) =>
          !p.is_user_post &&
          (p.source_platform === "google_trends" ||
            p.content_type === "trend_query" ||
            p.is_country_pulse ||
            ((p.region === targetRegionUpper || p.country === targetRegionUpper) && (p.source_platform === "youtube" && !p.interest_topic)))
      );
      countryPulsePosts.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));
      for (const post of countryPulsePosts.slice(0, 3)) {
        if (result.length < targetLimit && !isSeen(post)) {
          result.push(post);
          recordSeen(post);
        }
      }
    }

    // 4. Unpersonalized priority posts & community sparks
    const priorityPosts = posts.filter((p) => !p.is_user_post && p.rank_score >= 70000000 && !isSeen(p));
    priorityPosts.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));
    const priorityCap = pageNumber === 1 && allTopicDefs.length > 1 ? 6 : targetLimit;
    let priCount = 0;
    for (const post of priorityPosts) {
      if (result.length < targetLimit && priCount < priorityCap && !isSeen(post)) {
        result.push(post);
        recordSeen(post);
        priCount++;
      }
    }

    const communityPosts = posts.filter(
      (p) =>
        p.source_platform === "socialpilot" &&
        !p.is_user_post &&
        (!isPersonalized || (p.interest_match_count && p.interest_match_count > 0)) &&
        !isSeen(p)
    );
    communityPosts.sort((a, b) => (b.rank_score || 0) - (a.rank_score || 0));
    const communityCap = pageNumber === 1 ? 2 : 1;
    let commCount = 0;
    for (const post of communityPosts) {
      if (result.length < targetLimit && commCount < communityCap && !isSeen(post)) {
        result.push(post);
        recordSeen(post);
        commCount++;
      }
    }

    const remainingLimit = targetLimit - result.length;
    if (remainingLimit <= 0) return dedupePostsByCanonicalKey(result);

    const nonCommunityPosts = posts.filter((p) => p.source_platform !== "socialpilot" && !p.is_user_post);

    // Default: Interleave across platforms for single topic or global trend feed
    const reels = [];
    const visuals = [];
    const videos = [];
    const news = [];
    const pinterest = [];
    const others = [];

    nonCommunityPosts.forEach((p) => {
      // If personalized feed, prevent zero-match items from taking high-priority rotation slots
      const isRelevant = !isPersonalized || (p.interest_match_count && p.interest_match_count > 0);
      if (!isRelevant) {
        others.push(p);
        return;
      }

      if (p.source_platform === "pinterest") {
        pinterest.push(p);
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

    const pattern = [pinterest, visuals, reels, videos, pinterest, visuals, reels, news, videos, others];
    let hasMore = true;

    while (result.length < targetLimit && hasMore) {
      hasMore = false;
      for (const bucket of pattern) {
        if (bucket.length > 0 && result.length < targetLimit) {
          const item = bucket.shift();
          if (item && !isSeen(item)) {
            result.push(item);
            recordSeen(item);
            hasMore = true;
          }
        }
      }
    }

    // Append any remaining items if limit not reached
    const remaining = [...pinterest, ...visuals, ...reels, ...videos, ...news, ...others];
    for (const item of remaining) {
      if (result.length >= targetLimit) break;
      if (!isSeen(item)) {
        recordSeen(item);
        result.push(item);
      }
    }

    if (result.length < targetLimit) {
      for (const item of nonCommunityPosts) {
        if (result.length >= targetLimit) break;
        if (!isSeen(item)) {
          recordSeen(item);
          result.push(item);
        }
      }
    }

    return dedupePostsByCanonicalKey(result);
  }

  const unseenRows = allCandidates.filter((post) => {
    if (pageNumber === 1 && (post.source_platform === "socialpilot" || post.is_user_post)) return true;
    const cKey = getCanonicalPostKey(post);
    return !seen.has(post.id) && (!cKey || !seen.has(cKey));
  });
  let ranked;
  if (unseenRows.length >= limit) {
    ranked = rankPosts(unseenRows);
  } else {
    // Put unseen items first, then backfill with previously seen items so the feed page is always dense and complete
    const seenRows = allCandidates.filter((post) => {
      const cKey = getCanonicalPostKey(post);
      return seen.has(post.id) || (cKey && seen.has(cKey));
    });
    const rankedUnseen = rankPosts(unseenRows);
    const rankedSeen = rankPosts(seenRows);
    const seenSet = new Set(rankedUnseen.map((p) => p.id));
    ranked = [...rankedUnseen, ...rankedSeen.filter((p) => !seenSet.has(p.id))];
  }

  const deduplicatedRanked = dedupePostsByCanonicalKey(ranked);

  // Take current page slice (Interleaved for 'all', ranked slice for filtered tabs)
  const items = dedupePostsByCanonicalKey(
    type === "all" ? interleavePinterestFeed(deduplicatedRanked, limit) : deduplicatedRanked.slice(0, limit)
  );
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

// Hot topics radar (using authentic Google Trends)
export async function getHotTopicsRadar({ geo = "IN", region } = {}) {
  const targetGeo = String(region || geo || "IN").trim().toUpperCase();
  const effectiveGeo = targetGeo === "GLOBAL" ? "US" : targetGeo;
  try {
    const googleTrends = await fetchGoogleTrends({ geo: effectiveGeo, page: 1 }).catch(() => []);
    const topics = [];

    // Map Google Trends
    for (const t of (googleTrends || []).slice(0, 12)) {
      topics.push({
        query: t.title,
        volume: t.metrics?.searchVolume || "200K+",
        related: t.related_queries || [],
        url: t.source_url,
        source: `Google Trends (${targetGeo})`,
      });
    }

    if (topics.length > 0) {
      return {
        success: true,
        hotTopics: topics,
      };
    }

    const HOT_TOPICS_BY_REGION = {
      IN: [
        { query: "IPL & Cricket", volume: "2M+", source: "India Trends" },
        { query: "AI in India", volume: "1M+", source: "India Tech" },
        { query: "Bollywood & Music", volume: "800K+", source: "India Entertainment" },
        { query: "Indian Startups & SaaS", volume: "500K+", source: "India Business" },
        { query: "Viral Reels India", volume: "650K+", source: "India Creators" },
      ],
      US: [
        { query: "Super Bowl & NFL Highlights", volume: "3.5M+", source: "US Sports" },
        { query: "Silicon Valley AI Models", volume: "2M+", source: "US Tech" },
        { query: "Hollywood & Box Office", volume: "1.2M+", source: "US Entertainment" },
        { query: "Wall Street Market Surge", volume: "900K+", source: "US Finance" },
        { query: "Viral TikTok & Reels USA", volume: "850K+", source: "US Creators" },
      ],
      GB: [
        { query: "Premier League Matches", volume: "2M+", source: "UK Sports" },
        { query: "BBC Breaking UK News", volume: "1.1M+", source: "UK News" },
        { query: "London Tech Startups", volume: "600K+", source: "UK Tech" },
        { query: "British Film & Arts", volume: "500K+", source: "UK Culture" },
        { query: "Viral UK Creators", volume: "450K+", source: "UK Viral" },
      ],
      CA: [
        { query: "NHL Hockey Tonight", volume: "1.5M+", source: "Canada Sports" },
        { query: "Toronto & Vancouver Tech", volume: "700K+", source: "Canada Tech" },
        { query: "Canadian Market News", volume: "500K+", source: "Canada Business" },
        { query: "TIFF & Film Canada", volume: "400K+", source: "Canada Arts" },
        { query: "Banff & Alberta Visuals", volume: "350K+", source: "Canada Travel" },
      ],
      AU: [
        { query: "AFL & Australian Cricket", volume: "1.8M+", source: "Australia Sports" },
        { query: "Sydney & Melbourne Tech", volume: "650K+", source: "Australia Tech" },
        { query: "Australian Open Action", volume: "800K+", source: "Australia Tennis" },
        { query: "Bondi & Coastal Lifestyle", volume: "400K+", source: "Australia Lifestyle" },
        { query: "Reef & Wildlife Discoveries", volume: "350K+", source: "Australia Nature" },
      ],
      GLOBAL: [
        { query: "Artificial Intelligence 2026", volume: "4M+", source: "Global Tech" },
        { query: "SpaceX Starship Orbital", volume: "2.5M+", source: "Global Science" },
        { query: "Global Creator Economy", volume: "1.2M+", source: "Global Creators" },
        { query: "World Technology Summit", volume: "900K+", source: "Global Innovation" },
        { query: "Viral Reels Strategy", volume: "750K+", source: "Global Viral" },
      ],
    };

    const fallbackList = HOT_TOPICS_BY_REGION[targetGeo] || HOT_TOPICS_BY_REGION.GLOBAL;
    return {
      success: true,
      hotTopics: fallbackList,
    };
  } catch (err) {
    const fallbackList = [
      { query: "Artificial Intelligence", volume: "1M+", source: "Global" },
      { query: "Social Media Growth", volume: "500K+", source: "Global" },
      { query: "Viral Reels Strategy", volume: "350K+", source: "Global" },
      { query: "AI Content Creation", volume: "250K+", source: "Global" },
    ];
    return {
      success: true,
      hotTopics: fallbackList,
    };
  }
}
