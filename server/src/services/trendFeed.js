import IORedis from "ioredis";
import crypto from "crypto";
import {
  fetchYouTubeTrends,
  fetchGoogleTrends,
  fetchTrendingNews,
  fetchUnsplashTrends,
  fetchPexelsTrends,
} from "./trends/trendSources.js";

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
        (params.seenIds || []).join(","),
        (params.interests || []).join(","),
        params.type || "all",
        params.category || "all",
        params.region || "US",
        params.search || "",
        params.page || 1,
      ].join("|")
    )
    .digest("hex")
    .slice(0, 12);
  return `trend:feed:${params.limit || DEFAULT_LIMIT}:${params.cursor || "first"}:${seenHash}`;
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
    .slice(0, 12);
}

function getInterestMatches(post, interests) {
  if (!interests.length) return 0;
  const haystack = [
    post.caption,
    post.title,
    post.source_platform,
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

// Fetch live external posts based on active type / category & page number
async function fetchLiveExternalPosts({ type = "all", category = "all", region = "US", search = "", page = 1 }) {
  const promises = [];

  if (type === "all" || type === "videos") {
    promises.push(fetchYouTubeTrends({ region, category, maxResults: 25, page }));
    promises.push(fetchPexelsTrends({ category, query: search, perPage: 25, page }));
  }

  if (type === "all" || type === "visuals") {
    promises.push(fetchUnsplashTrends({ category, query: search, perPage: 25, page }));
  }

  if (type === "all" || type === "news") {
    promises.push(fetchTrendingNews({ category, region, query: search, page }));
  }

  if (type === "searches") {
    promises.push(fetchGoogleTrends({ geo: region, page }));
  } else if (type === "all" && page === 1) {
    // Include only top 2 breakout search queries in page 1 so visual pins dominate the feed
    promises.push(
      fetchGoogleTrends({ geo: region, page: 1 })
        .then((items) => (Array.isArray(items) ? items.slice(0, 2) : []))
        .catch(() => [])
    );
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

export async function getTrendFeedPage(params = {}, options = {}) {
  const limit = toLimit(params.limit);
  const supabase = options.supabase || (await defaultSupabase());
  const now = options.now || new Date();
  const seenIds = parseSeenPostIds(params.seen);
  const interests = parseTrendInterests(params.interests || params.topics);
  const type = params.type || "all";
  const category = params.category || "all";
  const region = params.region || params.geo || "US";
  const search = (params.search || params.q || "").trim().toLowerCase();

  const decodedCursor = decodeTrendCursor(params.cursor);
  const pageNumber = Number(params.page || decodedCursor?.page || 1);

  const seen = new Set(seenIds);
  const cache = options.cache === undefined ? getTrendFeedCache() : options.cache;
  const key = cacheKey({
    limit,
    cursor: params.cursor,
    seenIds,
    interests,
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
      .select("id,source_platform,source_url,embed_html,thumbnail_url,caption,engagement_score,niche_tags,published_at,ingested_at")
      .order("ingested_at", { ascending: false });

    if (type === "social") {
      query = query.in("source_platform", ["reddit", "bluesky"]);
    } else if (type === "videos") {
      query = query.eq("source_platform", "youtube");
    }

    const { data, error } = await query.limit(CANDIDATE_LIMIT);
    if (!error && data) {
      dbRows = data;
    }
  } catch (err) {
    console.warn("[TREND-FEED] DB query notice:", err?.message);
  }

  // 2. Fetch live external items for current page
  let externalRows = [];
  if (options.skipExternal !== true) {
    try {
      externalRows = await fetchLiveExternalPosts({
        type,
        category,
        region,
        search,
        page: pageNumber,
      });
    } catch (e) {
      console.warn("[TREND-FEED] External items skipped:", e.message);
    }
  }

  // Merge items
  let allCandidates = [...externalRows, ...dbRows];

  // Apply search keyword filter if provided
  if (search) {
    allCandidates = allCandidates.filter((item) => {
      const text = [item.title, item.caption, item.creator, ...(item.niche_tags || [])]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(search);
    });
  }

  // Apply type filter if not 'all'
  if (type === "videos") {
    allCandidates = allCandidates.filter(
      (item) =>
        item.source_platform === "youtube" ||
        item.source_platform === "pexels" ||
        item.content_type === "video" ||
        item.content_type === "reel_video"
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
      (item) => item.source_platform === "unsplash" || item.content_type === "visual"
    );
  } else if (type === "social") {
    allCandidates = allCandidates.filter(
      (item) => item.source_platform === "reddit" || item.source_platform === "bluesky"
    );
  }

  // Rank posts
  const rankPosts = (posts) =>
    applyRankCursor(
      posts
        .map((post) => {
          const matches = getInterestMatches(post, interests);
          const score = scoreTrendPost(post, now);
          return {
            ...post,
            interest_match_count: matches,
            rank_score: Number((score * (matches ? 1 + matches * 2 : 1)).toFixed(6)),
          };
        })
        .sort(compareRankedPosts),
      params.cursor
    );

  // Interleave different media formats in authentic Pinterest waterfall fashion
  function interleavePinterestFeed(posts, targetLimit) {
    const reels = [];
    const visuals = [];
    const videos = [];
    const news = [];
    const others = [];

    posts.forEach((p) => {
      if (p.source_platform === "pexels" || p.content_type === "short" || p.content_type === "reel_video") {
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
    const pattern = [visuals, reels, videos, visuals, reels, news, videos, visuals, others];
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
    const remaining = [...visuals, ...reels, ...videos, ...news, ...others];
    for (const item of remaining) {
      if (result.length >= targetLimit) break;
      if (!result.some((r) => r.id === item.id)) {
        result.push(item);
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
  };

  await writeCache(cache, key, page);
  return page;
}

// Hot topics radar
export async function getHotTopicsRadar({ geo = "US" } = {}) {
  try {
    const googleTrends = await fetchGoogleTrends({ geo, page: 1 });
    const topKeywords = googleTrends.slice(0, 16).map((t) => ({
      query: t.title,
      volume: t.metrics?.searchVolume || "200K+",
      related: t.related_queries || [],
      url: t.source_url,
    }));
    return {
      success: true,
      hotTopics: topKeywords,
    };
  } catch (err) {
    return {
      success: true,
      hotTopics: [
        { query: "Artificial Intelligence", volume: "1M+" },
        { query: "Social Media Growth", volume: "500K+" },
        { query: "Viral Reels Strategy", volume: "350K+" },
        { query: "AI Content Creation", volume: "250K+" },
      ],
    };
  }
}
