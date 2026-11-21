import axios from "axios";
import {
  searchPinterestPins,
  fetchPinterestTrendingPins,
  getPinterestRssFeed,
  getPinterestOEmbed,
  PINTEREST_CURATED_FEEDS,
} from "./trendPinterestSource.js";
import {
  searchBlueskyPosts,
  getBlueskyTrendingPosts,
  getBlueskyTrendingTopics,
} from "./trendBlueskySource.js";
import { filterAndRankPosts, calculateRelevance } from "./trendRelevance.js";

// Cache expiry durations in seconds
const CACHE_SHORT = 300; // 5 min
const CACHE_MEDIUM = 900; // 15 min
const CACHE_LONG = 3600; // 1 hour

// In-memory fallback cache
const memoryCache = new Map();

// SerpApi Circuit Breaker to avoid repeated 429 delays when monthly searches run out
let serpApiDisabledUntil = 0;

export function isSerpApiAvailable() {
  return !!process.env.SERPAPI_KEY && Date.now() > serpApiDisabledUntil;
}

export function handleSerpApiError(err, context = "") {
  const status = err?.response?.status;
  const msg = err?.response?.data?.error || err?.message || "";
  if (status === 429 || msg.includes("run out of searches") || msg.includes("exceeded")) {
    serpApiDisabledUntil = Date.now() + 30 * 60 * 1000;
    console.warn(`[TREND-SOURCES] SerpApi quota exhausted (status ${status}). Disabling SerpApi calls for 30 minutes.`);
  } else {
    console.warn(`[TREND-SOURCES] SerpApi ${context} notice:`, msg);
  }
}

function getMemCache(key) {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return item.data;
}

function setMemCache(key, data, ttlSeconds) {
  memoryCache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

// Map category to niche keywords for external APIs
export const NICHE_KEYWORDS = {
  all: "",
  tech_ai: "AI artificial intelligence technology software coding startups",
  business_finance: "business finance investing stock market crypto economy",
  marketing_creators: "content creator digital marketing social media viral growth branding",
  entertainment: "movies cinema pop culture music gaming viral entertainment",
  health_fitness: "fitness workout health nutrition wellness longevity",
  design_art: "graphic design UI UX architecture 3D digital art photography",
  gaming: "gaming esports video games PlayStation Xbox Nintendo PC gaming",
  science_space: "science space NASA astrophysics discovery climate tech",
};

export const REGION_NAMES = {
  IN: "India",
  US: "USA",
  GB: "UK",
  CA: "Canada",
  AU: "Australia",
  GLOBAL: "",
};

export function normalizeRegionCode(region) {
  const code = String(region || "IN").trim().toUpperCase();
  if (code === "GLOBAL" || code === "WORLD" || code === "ALL") return "GLOBAL";
  if (["IN", "US", "GB", "CA", "AU"].includes(code)) return code;
  return "IN";
}

// -----------------------------------------------------------------------------
// 1. YOUTUBE DATA API (Trending Videos & Shorts with 25+ items)
// -----------------------------------------------------------------------------
export async function fetchYouTubeTrends({ region = "IN", category = "all", query = "", maxResults = 25, page = 1 } = {}) {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) return [];

  const cleanQuery = (query || "").trim();
  const regionCode = normalizeRegionCode(region);
  const effectiveRegion = regionCode === "GLOBAL" ? "US" : regionCode;
  const countryName = REGION_NAMES[regionCode] || "";
  const cacheKey = `trends:yt:${regionCode}:${category}:${cleanQuery}:${maxResults}:${page}`;
  const cached = getMemCache(cacheKey);
  if (cached) return cached;

  try {
    const categoryMapping = {
      entertainment: "24",
      gaming: "20",
      science_space: "28",
      tech_ai: "28",
    };

    const videoCategoryId = categoryMapping[category];
    let items = [];

    // For page > 1, explicit query, or specific niche queries, use YouTube Search API or direct scraper
    if (cleanQuery || page > 1 || (category !== "all" && !videoCategoryId)) {
      const q = cleanQuery
        ? (countryName ? `${cleanQuery} ${countryName}` : cleanQuery)
        : NICHE_KEYWORDS[category]
        ? `${NICHE_KEYWORDS[category]}${countryName ? ` ${countryName}` : ""}`
        : (countryName ? `trending viral shorts ${countryName}` : "trending viral shorts podcast interview");

      try {
        const searchRes = await axios.get("https://www.googleapis.com/youtube/v3/search", {
          params: {
            part: "snippet",
            q,
            type: "video",
            order: "viewCount",
            videoCategoryId: videoCategoryId || undefined,
            regionCode: effectiveRegion,
            maxResults: Math.min(maxResults, 50),
            key: apiKey,
          },
          timeout: 8000,
        });

        const videoIds = (searchRes.data?.items || []).map((it) => it.id?.videoId).filter(Boolean).join(",");
        if (videoIds) {
          const detailRes = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
            params: {
              part: "snippet,statistics,contentDetails",
              id: videoIds,
              key: apiKey,
            },
            timeout: 8000,
          });
          items = detailRes.data?.items || [];
        }
      } catch (searchErr) {
        // Search API quota exceeded (status 429) - try direct extraction first, then popular videos chart
        try {
          const direct = await fetchYouTubeDirectVideos({ query: cleanQuery, region: regionCode, maxResults });
          if (direct.length > 0) {
            setMemCache(cacheKey, direct, CACHE_MEDIUM);
            return direct;
          }
        } catch (_) {}

        try {
          const params = {
            part: "snippet,statistics,contentDetails",
            chart: "mostPopular",
            regionCode: effectiveRegion,
            maxResults: Math.min(maxResults, 50),
            key: apiKey,
          };
          if (videoCategoryId) params.videoCategoryId = videoCategoryId;
          const fallbackRes = await axios.get("https://www.googleapis.com/youtube/v3/videos", { params, timeout: 8000 });
          items = fallbackRes.data?.items || [];
        } catch (_) {}
      }
    } else {
      const params = {
        part: "snippet,statistics,contentDetails",
        chart: "mostPopular",
        regionCode: effectiveRegion,
        maxResults: Math.min(maxResults, 50),
        key: apiKey,
      };
      if (videoCategoryId) params.videoCategoryId = videoCategoryId;

      const response = await axios.get("https://www.googleapis.com/youtube/v3/videos", {
        params,
        timeout: 8000,
      });
      items = response.data?.items || [];
    }

    const normalized = items.map((video) => {
      const views = Number.parseInt(video.statistics?.viewCount || "0", 10);
      const likes = Number.parseInt(video.statistics?.likeCount || "0", 10);
      const comments = Number.parseInt(video.statistics?.commentCount || "0", 10);
      const title = video.snippet?.title || "Trending YouTube Video";
      const channelTitle = video.snippet?.channelTitle || "YouTube Creator";
      const duration = video.contentDetails?.duration || "";
      const isShort = duration.includes("M") ? false : duration.includes("S");

      return {
        id: `yt_${video.id}`,
        source_platform: "youtube",
        source_url: `https://www.youtube.com/watch?v=${video.id}`,
        embed_html: `<iframe src="https://www.youtube.com/embed/${video.id}" title="${title.replace(/"/g, "&quot;")}" allowfullscreen></iframe>`,
        thumbnail_url:
          video.snippet?.thumbnails?.maxres?.url ||
          video.snippet?.thumbnails?.high?.url ||
          video.snippet?.thumbnails?.medium?.url ||
          video.snippet?.thumbnails?.default?.url,
        caption: `${title}\n\nBy ${channelTitle} • ${video.snippet?.description?.slice(0, 240) || ""}`,
        title,
        creator: channelTitle,
        content_type: isShort ? "short" : "video",
        region: regionCode,
        country: regionCode,
        engagement_score: views + likes * 2 + comments * 3,
        metrics: {
          views,
          likes,
          comments,
        },
        niche_tags: video.snippet?.tags
          ? [...video.snippet.tags.slice(0, 5), `region:${regionCode}`]
          : [category, `region:${regionCode}`],
        published_at: video.snippet?.publishedAt || new Date().toISOString(),
        ingested_at: new Date().toISOString(),
      };
    });

    setMemCache(cacheKey, normalized, CACHE_MEDIUM);
    return normalized;
  } catch (error) {
    // Outer catch: try Direct YouTube Extraction before checking SerpApi
    try {
      const direct = await fetchYouTubeDirectVideos({ query: cleanQuery, region: regionCode, maxResults });
      if (direct.length > 0) {
        setMemCache(cacheKey, direct, CACHE_MEDIUM);
        return direct;
      }
    } catch (_) {}

    if (isSerpApiAvailable()) {
      try {
        const fallbackQuery = cleanQuery || (countryName ? `trending viral ${countryName}` : "trending viral");
        const sRes = await axios.get("https://serpapi.com/search.json", {
          params: {
            engine: "youtube",
            search_query: fallbackQuery,
            gl: effectiveRegion === "GLOBAL" ? "us" : effectiveRegion.toLowerCase(),
            hl: "en",
            api_key: process.env.SERPAPI_KEY,
          },
          timeout: 9000,
        });
        const vResults = sRes.data?.video_results || [];
        if (vResults.length > 0) {
          const serpNormalized = vResults.slice(0, maxResults).map((vr, index) => {
            const vIdMatch = vr.link?.match(/(?:shorts\/|v=)([\w-]{11})/i);
            const videoId = vIdMatch?.[1] || vr.id || `serp_v_${index}`;
            const channelName = vr.channel?.name || "YouTube Creator";
            const cleanTitle = vr.title || "Trending Video";
            const views = vr.views ? Number.parseInt(String(vr.views).replace(/[^0-9]/g, ""), 10) : 50000;
            return {
              id: `yt_${videoId}`,
              source_platform: "youtube",
              source_url: vr.link || `https://www.youtube.com/watch?v=${videoId}`,
              embed_html: `<iframe src="https://www.youtube.com/embed/${videoId}" title="${cleanTitle.replace(/"/g, "&quot;")}" allowfullscreen></iframe>`,
              thumbnail_url: vr.thumbnail?.static || vr.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              caption: `${cleanTitle}\n\nBy ${channelName} • ${vr.description || ""}`,
              title: cleanTitle,
              creator: channelName,
              content_type: "video",
              region: regionCode,
              country: regionCode,
              engagement_score: views + 10000,
              metrics: { views, likes: Math.floor(views * 0.05), comments: Math.floor(views * 0.01) },
              niche_tags: [category, `region:${regionCode}`],
              published_at: new Date().toISOString(),
              ingested_at: new Date().toISOString(),
            };
          });
          setMemCache(cacheKey, serpNormalized, CACHE_MEDIUM);
          return serpNormalized;
        }
      } catch (sErr) {
        handleSerpApiError(sErr, "YouTube video fallback");
      }
    }
    return [];
  }
}

// -----------------------------------------------------------------------------
// 1C. DIRECT YOUTUBE EXTRACTION (Fast, Zero-Quota Scraper for Shorts & Videos)
// -----------------------------------------------------------------------------
export async function fetchYouTubeDirectShorts({ query = "", region = "IN", maxResults = 25 } = {}) {
  const cleanQuery = (query || "").trim();
  const regionCode = normalizeRegionCode(region);
  const countryName = REGION_NAMES[regionCode] || "";

  let searchQuery;
  if (cleanQuery) {
    searchQuery = cleanQuery.toLowerCase().includes("short") ? cleanQuery : `${cleanQuery} shorts`;
  } else {
    searchQuery = countryName ? `trending shorts viral ${countryName}` : "trending shorts viral";
  }

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
  const res = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    timeout: 7000,
  });

  const html = typeof res.data === "string" ? res.data : "";
  const idx = html.indexOf("ytInitialData = ");
  if (idx === -1) return [];
  const endIdx = html.indexOf(";</script>", idx);
  if (endIdx === -1) return [];

  const jsonStr = html.slice(idx + "ytInitialData = ".length, endIdx);
  const data = JSON.parse(jsonStr);

  const shorts = [];
  const seenIds = new Set();

  function walk(obj) {
    if (!obj || typeof obj !== "object") return;
    if (obj.shortsLockupViewModel) {
      const s = obj.shortsLockupViewModel;
      const videoId =
        s.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId ||
        (s.entityId && s.entityId.replace("shorts-shelf-item-", ""));
      const title =
        s.overlayMetadata?.primaryText?.content ||
        s.accessibilityText?.split(",")?.[0] ||
        "Trending YouTube Short";
      const viewsStr =
        s.overlayMetadata?.secondaryText?.content ||
        s.accessibilityText?.match(/([0-9.]+\s*(?:million|views|M|K))/i)?.[1] ||
        "Trending";
      const thumb =
        s.thumbnailViewModel?.thumbnailViewModel?.image?.sources?.[0]?.url ||
        s.thumbnailViewModel?.image?.sources?.slice(-1)[0]?.url ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      if (videoId && !seenIds.has(videoId)) {
        seenIds.add(videoId);
        shorts.push({ videoId, title, viewsStr, thumb });
      }
    }
    if (obj.reelItemRenderer) {
      const r = obj.reelItemRenderer;
      const videoId = r.videoId;
      const title = r.headline?.simpleText || "Trending YouTube Short";
      const viewsStr = r.viewCountText?.simpleText || "Trending";
      const thumb =
        r.thumbnail?.thumbnails?.slice(-1)[0]?.url ||
        `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      if (videoId && !seenIds.has(videoId)) {
        seenIds.add(videoId);
        shorts.push({ videoId, title, viewsStr, thumb });
      }
    }
    if (Array.isArray(obj)) {
      for (const it of obj) walk(it);
    } else {
      for (const k of Object.keys(obj)) walk(obj[k]);
    }
  }
  walk(data);

  return shorts.slice(0, maxResults).map((s, index) => {
    const rawViews = s.viewsStr.replace(/[^0-9.]/g, "");
    let multiplier = 1;
    if (/M|million/i.test(s.viewsStr)) multiplier = 1000000;
    else if (/K/i.test(s.viewsStr)) multiplier = 1000;
    const views = Math.round((parseFloat(rawViews) || 50) * multiplier);
    const cleanTitle = s.title.replace(/"/g, "&quot;");

    return {
      id: `yt_short_${s.videoId}`,
      source_platform: "youtube",
      source_url: `https://www.youtube.com/shorts/${s.videoId}`,
      video_id: s.videoId,
      embed_html: `<iframe src="https://www.youtube-nocookie.com/embed/${s.videoId}?autoplay=1&loop=1" title="${cleanTitle}" allowfullscreen></iframe>`,
      thumbnail_url: s.thumb,
      full_image_url: `https://i.ytimg.com/vi/${s.videoId}/maxresdefault.jpg`,
      title: s.title,
      caption: `⚡ YouTube Short (${s.viewsStr})\n\n${s.title}\n\nWatch on YouTube Shorts: https://www.youtube.com/shorts/${s.videoId}`,
      creator: cleanQuery || "YouTube Creator",
      content_type: "short",
      media_type: "video",
      is_short: true,
      region: regionCode,
      country: regionCode,
      engagement_score: 9500 + (30 - index) * 150 + Math.min(views, 500000) * 0.05,
      metrics: {
        views: s.viewsStr,
        platform: "YouTube Shorts",
      },
      niche_tags: ["shorts", "reel", "youtube_shorts", `region:${regionCode}`, cleanQuery].filter(Boolean),
      published_at: new Date(Date.now() - index * 3600000).toISOString(),
      ingested_at: new Date().toISOString(),
    };
  });
}

export async function fetchYouTubeDirectVideos({ query = "", region = "IN", maxResults = 25 } = {}) {
  const cleanQuery = (query || "").trim();
  const regionCode = normalizeRegionCode(region);
  const countryName = REGION_NAMES[regionCode] || "";
  const searchQuery = cleanQuery ? (countryName ? `${cleanQuery} ${countryName}` : cleanQuery) : "trending viral video";

  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
  const res = await axios.get(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    timeout: 7000,
  });

  const html = typeof res.data === "string" ? res.data : "";
  const idx = html.indexOf("ytInitialData = ");
  if (idx === -1) return [];
  const endIdx = html.indexOf(";</script>", idx);
  if (endIdx === -1) return [];

  const jsonStr = html.slice(idx + "ytInitialData = ".length, endIdx);
  const data = JSON.parse(jsonStr);

  const videos = [];
  const seenIds = new Set();

  function walk(obj) {
    if (!obj || typeof obj !== "object") return;
    if (obj.videoRenderer) {
      const v = obj.videoRenderer;
      const videoId = v.videoId;
      const title = v.title?.runs?.[0]?.text || "YouTube Video";
      const channel = v.ownerText?.runs?.[0]?.text || v.shortBylineText?.runs?.[0]?.text || "YouTube Creator";
      const viewsStr = v.viewCountText?.simpleText || "Trending";
      const thumb = v.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
      const isShort =
        (v.thumbnailOverlays || []).some((o) => o.thumbnailOverlayTimeStatusRenderer?.style === "SHORTS") ||
        title.toLowerCase().includes("#short") ||
        (v.navigationEndpoint?.commandMetadata?.webCommandMetadata?.url || "").includes("/shorts/");
      if (videoId && !seenIds.has(videoId)) {
        seenIds.add(videoId);
        videos.push({ videoId, title, channel, viewsStr, thumb, isShort });
      }
    }
    if (Array.isArray(obj)) {
      for (const it of obj) walk(it);
    } else {
      for (const k of Object.keys(obj)) walk(obj[k]);
    }
  }
  walk(data);

  return videos.slice(0, maxResults).map((v, index) => {
    const rawViews = v.viewsStr.replace(/[^0-9.]/g, "");
    let multiplier = 1;
    if (/M|million/i.test(v.viewsStr)) multiplier = 1000000;
    else if (/K/i.test(v.viewsStr)) multiplier = 1000;
    const views = Math.round((parseFloat(rawViews) || 50) * multiplier);
    const cleanTitle = v.title.replace(/"/g, "&quot;");

    return {
      id: v.isShort ? `yt_short_${v.videoId}` : `yt_${v.videoId}`,
      source_platform: "youtube",
      source_url: v.isShort ? `https://www.youtube.com/shorts/${v.videoId}` : `https://www.youtube.com/watch?v=${v.videoId}`,
      video_id: v.videoId,
      embed_html: `<iframe src="https://www.youtube.com/embed/${v.videoId}" title="${cleanTitle}" allowfullscreen></iframe>`,
      thumbnail_url: v.thumb,
      caption: `${v.title}\n\nBy ${v.channel} • ${v.viewsStr}`,
      title: v.title,
      creator: v.channel,
      content_type: v.isShort ? "short" : "video",
      media_type: "video",
      is_short: v.isShort,
      region: regionCode,
      country: regionCode,
      engagement_score: views + 10000,
      metrics: { views, likes: Math.floor(views * 0.05), comments: Math.floor(views * 0.01) },
      niche_tags: [v.isShort ? "shorts" : "video", `region:${regionCode}`, cleanQuery].filter(Boolean),
      published_at: new Date().toISOString(),
      ingested_at: new Date().toISOString(),
    };
  });
}

// -----------------------------------------------------------------------------
// 1B. YOUTUBE SHORTS (Dedicated Vertical Short-Form Video Feed)
// -----------------------------------------------------------------------------
export async function fetchYouTubeShorts({ region = "IN", category = "all", query = "", maxResults = 25, page = 1 } = {}) {
  const cleanQuery = (query || "").trim();
  const regionCode = normalizeRegionCode(region);
  const cacheKey = `trends:yt:shorts:${regionCode}:${category}:${cleanQuery}:${maxResults}:${page}`;
  const cached = getMemCache(cacheKey);
  if (cached) return cached;

  const ytApiKey = process.env.YOUTUBE_DATA_API_KEY;
  let items = [];

  // 1. Direct YouTube Shorts Extraction (Primary - fast, zero-quota cost, exact targeted shorts)
  try {
    items = await fetchYouTubeDirectShorts({ query: cleanQuery, region: regionCode, maxResults });
  } catch (dErr) {
    console.warn("[TREND-SOURCES] Direct YouTube Shorts notice:", dErr?.message);
  }

  // 2. SerpApi YouTube Engine (if direct returned empty and SerpApi is not disabled)
  if (items.length === 0 && isSerpApiAvailable()) {
    try {
      const countryName = REGION_NAMES[regionCode] || "";
      const effectiveGl = regionCode === "GLOBAL" ? "us" : regionCode.toLowerCase();
      let searchQuery;
      if (cleanQuery) {
        searchQuery = `${cleanQuery} shorts`;
      } else {
        searchQuery = countryName ? `trending #shorts viral ${countryName}` : "trending #shorts viral";
      }

      const res = await axios.get("https://serpapi.com/search.json", {
        params: {
          engine: "youtube",
          search_query: searchQuery,
          gl: effectiveGl,
          api_key: process.env.SERPAPI_KEY,
        },
        timeout: 9000,
      });

      const shortsGroups = res.data?.shorts_results || [];
      const extractedShorts = [];

      for (const group of shortsGroups) {
        if (Array.isArray(group.shorts)) {
          extractedShorts.push(...group.shorts);
        }
      }

      // Also check video_results if they link to /shorts/ or have #shorts in title
      const videoResults = res.data?.video_results || [];
      for (const vr of videoResults) {
        const isShortLink = vr.link?.includes("/shorts/");
        const hasShortTag = (vr.title || "").toLowerCase().includes("#short");
        if ((isShortLink || hasShortTag) && vr.link) {
          const vIdMatch = vr.link.match(/(?:shorts\/|v=)([\w-]{11})/i);
          if (vIdMatch?.[1]) {
            extractedShorts.push({
              video_id: vIdMatch[1],
              title: vr.title,
              link: `https://www.youtube.com/shorts/${vIdMatch[1]}`,
              thumbnail: vr.thumbnail?.static || vr.thumbnail || `https://i.ytimg.com/vi/${vIdMatch[1]}/hqdefault.jpg`,
              views_original: vr.views || vr.views_original || "100K+ views",
              views: vr.views ? Number.parseInt(String(vr.views).replace(/[^0-9]/g, ""), 10) : 100000,
              channel: vr.channel,
            });
          }
        }
      }

      if (extractedShorts.length > 0) {
        const seenIds = new Set();
        items = extractedShorts
          .filter((s) => {
            if (!s.video_id || seenIds.has(s.video_id)) return false;
            seenIds.add(s.video_id);
            return true;
          })
          .map((s, index) => {
            const views = s.views || 50000 + (30 - index) * 5000;
            const channelName = s.channel?.name || "YouTube Creator";
            const cleanTitle = s.title || "Trending YouTube Short";
            return {
              id: `yt_short_${s.video_id}`,
              source_platform: "youtube",
              source_url: `https://www.youtube.com/shorts/${s.video_id}`,
              video_id: s.video_id,
              embed_html: `<iframe src="https://www.youtube-nocookie.com/embed/${s.video_id}?autoplay=1&loop=1" title="${cleanTitle.replace(/"/g, "&quot;")}" allowfullscreen></iframe>`,
              thumbnail_url: s.thumbnail || `https://i.ytimg.com/vi/${s.video_id}/hqdefault.jpg`,
              full_image_url: `https://i.ytimg.com/vi/${s.video_id}/maxresdefault.jpg`,
              title: cleanTitle,
              caption: `⚡ YouTube Short by ${channelName} (${s.views_original || "Trending"})\n\n${cleanTitle}\n\nWatch on YouTube Shorts: https://www.youtube.com/shorts/${s.video_id}`,
              creator: channelName,
              content_type: "short",
              media_type: "video",
              is_short: true,
              region: regionCode,
              country: regionCode,
              engagement_score: 9500 + (30 - index) * 150 + Math.min(views, 500000) * 0.05,
              metrics: {
                views: s.views_original || `${Math.floor(views / 1000)}K`,
                platform: "YouTube Shorts",
              },
              niche_tags: ["shorts", "reel", "youtube_shorts", `region:${regionCode}`, category].filter(Boolean),
              published_at: new Date(Date.now() - index * 3600000).toISOString(),
              ingested_at: new Date().toISOString(),
            };
          });
      }
    } catch (err) {
      handleSerpApiError(err, "YouTube Shorts");
    }
  }

  // 3. Fallback: YouTube Data API mostPopular videos filtered to shorts (< 60s)
  if (items.length === 0 && ytApiKey) {
    try {
      const regularYt = await fetchYouTubeTrends({ region: regionCode, category, query: cleanQuery, maxResults: 50, page });
      items = regularYt.filter((v) => v.content_type === "short" || (v.title || "").toLowerCase().includes("#short"));
    } catch (err) {
      console.warn("[TREND-SOURCES] YouTube Data API Shorts fallback notice:", err?.message);
    }
  }

  setMemCache(cacheKey, items, CACHE_SHORT);
  return items;
}

// -----------------------------------------------------------------------------
// 2. SERPAPI (Google Trends & Real-Time Rising Searches)
// -----------------------------------------------------------------------------
export async function fetchGoogleTrends({ geo = "IN", page = 1 } = {}) {
  const apiKey = process.env.SERPAPI_KEY;
  const regionCode = normalizeRegionCode(geo);
  const targetGeo = regionCode === "GLOBAL" ? "US" : regionCode;
  const cacheKey = `trends:serpapi:google_trends:${regionCode}:${page}`;
  const cached = getMemCache(cacheKey);
  if (cached) return cached;

  if (isSerpApiAvailable()) {
    try {
      const response = await axios.get("https://serpapi.com/search.json", {
        params: {
          engine: "google_trends_trending_now",
          geo: targetGeo,
          api_key: apiKey,
        },
        timeout: 9000,
      });

      const trendingSearches = response.data?.trending_searches || [];
      const startIndex = ((page - 1) * 20) % Math.max(trendingSearches.length, 1);
      const pageItems = trendingSearches.slice(startIndex, startIndex + 25);
      const pool = pageItems.length > 0 ? pageItems : trendingSearches.slice(0, 25);

      if (pool.length > 0) {
        const items = pool.map((trend, index) => {
          const query = trend.query || trend.title || "Trending Search";
          const searchVolume = trend.search_volume || trend.traffic || "200K+";
          const articles = trend.articles || [];
          const topArticle = articles[0] || {};
          const relatedQueries = (trend.related_queries || []).map((q) => (typeof q === "string" ? q : q.query)).filter(Boolean);

          return {
            id: `gt_${regionCode}_${page}_${index}_${Buffer.from(query).toString("hex").slice(0, 10)}`,
            source_platform: "google_trends",
            source_url: topArticle.link || `https://www.google.com/search?q=${encodeURIComponent(query)}`,
            embed_html: null,
            thumbnail_url: topArticle.snippet_thumbnail || trend.thumbnail || null,
            title: query,
            caption: `🔥 Google Trending (${regionCode}): "${query}" (${searchVolume} searches today)\n\n${topArticle.title ? `Top Story: ${topArticle.title}` : ""}\n\nRelated queries: ${relatedQueries.join(", ")}`,
            content_type: "trend_query",
            region: regionCode,
            country: regionCode,
            engagement_score: 2800 + (30 - index) * 50,
            metrics: {
              searchVolume,
              rank: startIndex + index + 1,
              newsCount: articles.length,
            },
            related_queries: relatedQueries,
            niche_tags: ["google_trends", `region:${regionCode}`, "breaking_surge", ...relatedQueries.slice(0, 3)],
            published_at: trend.published_date || new Date().toISOString(),
            ingested_at: new Date().toISOString(),
          };
        });

        setMemCache(cacheKey, items, CACHE_SHORT);
        return items;
      }
    } catch (error) {
      handleSerpApiError(error, "Google Trends");
    }
  }

  // Country-specific fallback topics when SerpApi key is missing or rate limited
  const FALLBACK_TRENDS_BY_GEO = {
    IN: [
      { query: "IPL & Cricket Live Score", volume: "3M+", title: "IPL 2026 Season Matches" },
      { query: "India AI Mission", volume: "1.5M+", title: "India expanding domestic compute & AI infrastructure" },
      { query: "Bollywood Box Office Trends", volume: "900K+", title: "Latest theatrical releases top box office charts" },
      { query: "BCCI Selection Updates", volume: "800K+", title: "Indian cricket squad announcements and captaincy" },
      { query: "UPI & Digital India Payments", volume: "600K+", title: "Digital payments cross new monthly peak in India" },
    ],
    US: [
      { query: "Super Bowl & NFL Playoff Highlights", volume: "4M+", title: "NFL championship season and viral plays" },
      { query: "OpenAI & Silicon Valley Tech Wave", volume: "2.5M+", title: "New frontier AI models launch in San Francisco" },
      { query: "Hollywood Box Office & Oscars", volume: "1.8M+", title: "Academy awards race and viral blockbuster films" },
      { query: "US Wall Street Stock Surge", volume: "1.2M+", title: "Tech equities push S&P 500 to historic highs" },
      { query: "NBA Tonight Live Highlights", volume: "950K+", title: "Lakers and Celtics battle in primetime matchup" },
    ],
    GB: [
      { query: "Premier League Weekend Matches", volume: "2.5M+", title: "Arsenal, Man City & Liverpool battle for title" },
      { query: "BBC Breaking UK News", volume: "1.2M+", title: "UK government outlines autumn fiscal budget" },
      { query: "London Tech Week & Startups", volume: "700K+", title: "UK tech ecosystem surges in European funding" },
      { query: "British Film & BAFTA Awards", volume: "650K+", title: "UK cinema and top television drama releases" },
      { query: "Glastonbury & UK Music Festival", volume: "500K+", title: "Headline music tours announced across Britain" },
    ],
    CA: [
      { query: "NHL Stanley Cup Hockey Tonight", volume: "1.8M+", title: "Toronto Maple Leafs & Oilers in high-stakes matchup" },
      { query: "Toronto & Vancouver Tech Hub", volume: "800K+", title: "Canadian AI institutes unveil new research hubs" },
      { query: "Bank of Canada Interest Rate Decision", volume: "600K+", title: "Canada central bank updates mortgage & rate policies" },
      { query: "TIFF & Canadian Cinema News", volume: "450K+", title: "Toronto International Film Festival announcements" },
      { query: "Canadian Rockies & Nature Viral Shots", volume: "400K+", title: "Viral drone cinematography of Banff and Alberta" },
    ],
    AU: [
      { query: "AFL & Cricket Australia Ashes", volume: "2M+", title: "Australian cricket test team battles on home pitch" },
      { query: "Sydney & Melbourne Tech Ecosystem", volume: "750K+", title: "Australian tech startups secure Series B funding" },
      { query: "Great Barrier Reef & Wildlife Conservation", volume: "550K+", title: "Marine biology discovery on Queensland coast" },
      { query: "Australian Open Tennis Highlights", volume: "900K+", title: "Grand Slam action underway at Melbourne Park" },
      { query: "Bondi Beach & Coastal Lifestyle Reels", volume: "400K+", title: "Viral Australian summer photography & reels" },
    ],
    GLOBAL: [
      { query: "Frontier Artificial Intelligence 2026", volume: "5M+", title: "Breakthrough autonomous agents transform productivity" },
      { query: "SpaceX Starship Orbital Launch", volume: "3M+", title: "Starship completes deep-space orbital trajectory test" },
      { query: "Global Creator Economy & Viral Video", volume: "1.5M+", title: "Top creator studios expand worldwide distribution" },
      { query: "World Technology Summit", volume: "1.2M+", title: "Global tech leaders meet to discuss open science & energy" },
      { query: "International Cinema & Streaming Wave", volume: "1M+", title: "Cross-border global hit series shatters streaming records" },
    ],
  };

  const fallbacks = FALLBACK_TRENDS_BY_GEO[regionCode] || FALLBACK_TRENDS_BY_GEO.GLOBAL;
  const items = fallbacks.map((f, idx) => ({
    id: `gt_fb_${regionCode}_${idx}_${Buffer.from(f.query).toString("hex").slice(0, 8)}`,
    source_platform: "google_trends",
    source_url: `https://www.google.com/search?q=${encodeURIComponent(f.query)}`,
    embed_html: null,
    thumbnail_url: null,
    title: f.query,
    caption: `🔥 Trending in ${REGION_NAMES[regionCode] || "Global"}: "${f.query}" (${f.volume} searches)\n\n${f.title}`,
    content_type: "trend_query",
    region: regionCode,
    country: regionCode,
    engagement_score: 2500 + (10 - idx) * 100,
    metrics: { searchVolume: f.volume, rank: idx + 1, newsCount: 3 },
    related_queries: [f.query, regionCode],
    niche_tags: ["google_trends", `region:${regionCode}`, "breaking_surge"],
    published_at: new Date(Date.now() - idx * 3600000).toISOString(),
    ingested_at: new Date().toISOString(),
  }));

  setMemCache(cacheKey, items, CACHE_SHORT);
  return items;
}

// -----------------------------------------------------------------------------
// 3. GNEWS & NEWSAPI (Global & Niche Breaking News)
// -----------------------------------------------------------------------------
export async function fetchTrendingNews({ category = "all", region = "IN", query = "", page = 1 } = {}) {
  const gnewsKey = process.env.GNEWS_KEY;
  const newsApiKey = process.env.NEWSAPI_KEY;

  const regionCode = normalizeRegionCode(region);
  const countryName = REGION_NAMES[regionCode] || "";
  const effectiveCountry = regionCode === "GLOBAL" ? "us" : regionCode.toLowerCase();

  const cacheKey = `trends:news:${category}:${regionCode}:${query}:${page}`;
  const cached = getMemCache(cacheKey);
  if (cached) return cached;

  let articles = [];

  // 1. Try GNews
  if (gnewsKey) {
    try {
      const gnewsCategoryMap = {
        all: "general",
        tech_ai: "technology",
        business_finance: "business",
        entertainment: "entertainment",
        health_fitness: "health",
        science_space: "science",
        gaming: "technology",
        marketing_creators: "business",
      };

      const gCategory = gnewsCategoryMap[category] || "general";
      const q = query ? (countryName ? `${query} ${countryName}` : query) : (category === "tech_ai" ? "AI OR technology" : "");
      const params = {
        lang: "en",
        country: effectiveCountry,
        max: 25,
        page,
        apikey: gnewsKey,
      };
      if (gCategory && !q) params.category = gCategory;
      if (q) params.q = q;

      const url = q ? "https://gnews.io/api/v4/search" : "https://gnews.io/api/v4/top-headlines";
      const res = await axios.get(url, { params, timeout: 8000 });

      if (res.data?.articles?.length) {
        articles = res.data.articles.map((art, idx) => ({
          id: `gn_${regionCode}_${page}_${idx}_${Buffer.from(art.url || art.title).toString("hex").slice(0, 10)}`,
          source_platform: "gnews",
          source_url: art.url,
          embed_html: null,
          thumbnail_url: art.image || null,
          title: art.title,
          caption: `${art.title}\n\n${art.description || ""}\n\nSource: ${art.source?.name || "Global Media"}`,
          creator: art.source?.name || "Global Media",
          content_type: "news",
          region: regionCode,
          country: regionCode,
          engagement_score: 5000 + (25 - idx) * 120,
          metrics: {
            source: art.source?.name,
          },
          niche_tags: [category, "breaking_news", `region:${regionCode}`, art.source?.name].filter(Boolean),
          published_at: art.publishedAt || new Date().toISOString(),
          ingested_at: new Date().toISOString(),
        }));
      }
    } catch (err) {
      console.warn("[TREND-SOURCES] GNews notice:", err?.message);
    }
  }

  // 2. Try NewsAPI
  if (articles.length < 25 && newsApiKey) {
    try {
      const newsApiCategoryMap = {
        all: "general",
        tech_ai: "technology",
        business_finance: "business",
        entertainment: "entertainment",
        health_fitness: "health",
        science_space: "science",
        gaming: "technology",
      };

      const nCategory = newsApiCategoryMap[category] || "general";
      const q = query ? (countryName ? `${query} ${countryName}` : query) : (category === "tech_ai" ? "AI" : "");
      const res = await axios.get(q ? "https://newsapi.org/v2/everything" : "https://newsapi.org/v2/top-headlines", {
        params: {
          category: q ? undefined : nCategory,
          q: q || undefined,
          country: q ? undefined : effectiveCountry,
          language: "en",
          pageSize: 25,
          page,
          apiKey: newsApiKey,
        },
        timeout: 8000,
      });

      if (res.data?.articles?.length) {
        const additional = res.data.articles
          .filter((art) => art.title && art.title !== "[Removed]")
          .map((art, idx) => ({
            id: `na_${regionCode}_${page}_${idx}_${Buffer.from(art.url || art.title).toString("hex").slice(0, 10)}`,
            source_platform: "newsapi",
            source_url: art.url,
            embed_html: null,
            thumbnail_url: art.urlToImage || null,
            title: art.title,
            caption: `${art.title}\n\n${art.description || ""}\n\nSource: ${art.source?.name || "News Network"}`,
            creator: art.source?.name || "News Network",
            content_type: "news",
            region: regionCode,
            country: regionCode,
            engagement_score: 4000 + (25 - idx) * 100,
            metrics: {
              source: art.source?.name,
            },
            niche_tags: [category, "news", `region:${regionCode}`, art.source?.name].filter(Boolean),
            published_at: art.publishedAt || new Date().toISOString(),
            ingested_at: new Date().toISOString(),
          }));
        articles = [...articles, ...additional];
      }
    } catch (err) {
      console.warn("[TREND-SOURCES] NewsAPI notice:", err?.message);
    }
  }

  setMemCache(cacheKey, articles, CACHE_MEDIUM);
  return articles;
}

// -----------------------------------------------------------------------------
// 4. UNSPLASH API (Aesthetic Visuals)
// -----------------------------------------------------------------------------
export async function fetchUnsplashTrends({ category = "all", query = "", perPage = 25, page = 1, region = "IN" } = {}) {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return [];

  const regionCode = normalizeRegionCode(region);
  const cacheKey = `trends:unsplash:${category}:${query}:${perPage}:${page}:${regionCode}`;
  const cached = getMemCache(cacheKey);
  if (cached) return cached;

  try {
    const searchTerms = {
      tech_ai: "technology future artificial intelligence cyberpunk minimal neon",
      business_finance: "modern architecture workspace entrepreneur finance",
      marketing_creators: "creator photography studio lights aesthetic",
      entertainment: "cinema concert lights festival",
      health_fitness: "fitness athlete nutrition healthy lifestyle workout",
      design_art: "abstract 3d architecture modern design texture",
      gaming: "gaming setup neon lights cyber",
      science_space: "galaxy universe astronomy science space",
    };

    const regionTerm =
      regionCode === "IN"
        ? " India"
        : regionCode === "GB"
        ? " UK"
        : regionCode === "CA"
        ? " Canada"
        : regionCode === "AU"
        ? " Australia"
        : regionCode === "US"
        ? " USA"
        : "";

    const q = query
      ? `${query}${regionTerm}`
      : searchTerms[category]
      ? `${searchTerms[category]}${regionTerm}`
      : regionCode === "IN"
      ? "India aesthetic architecture culture design"
      : regionCode === "GB"
      ? "UK Britain aesthetic architecture design"
      : regionCode === "CA"
      ? "Canada nature aesthetic architecture"
      : regionCode === "AU"
      ? "Australia coastal aesthetic architecture"
      : "aesthetic architecture design";
    const url = q ? "https://api.unsplash.com/search/photos" : "https://api.unsplash.com/photos";
    const params = {
      page,
      per_page: Math.max(perPage, 25),
      order_by: "popular",
    };
    if (q) params.query = q;

    const res = await axios.get(url, {
      params,
      headers: { Authorization: `Client-ID ${accessKey}` },
      timeout: 8000,
    });

    const rawList = q ? res.data?.results || [] : res.data || [];
    const items = rawList.map((photo) => {
      const photographer = photo.user?.name || photo.user?.username || "Unsplash Artist";
      const photographerLink = photo.user?.links?.html || "https://unsplash.com";
      const title = photo.alt_description || photo.description || "Visual Inspiration";

      return {
        id: `un_${photo.id}`,
        source_platform: "unsplash",
        source_url: photo.links?.html || `https://unsplash.com/photos/${photo.id}`,
        embed_html: null,
        thumbnail_url: photo.urls?.regular || photo.urls?.small,
        full_image_url: photo.urls?.full || photo.urls?.regular,
        title: title.slice(0, 100),
        caption: `🎨 Visual Inspiration by ${photographer}: "${title}"\n\nColor Palette: ${photo.color || "#000000"} • Likes: ${photo.likes || 0}`,
        creator: photographer,
        creator_url: photographerLink,
        content_type: "visual",
        region: regionCode,
        country: regionCode,
        color: photo.color,
        aspect_ratio: photo.width && photo.height ? (photo.width / photo.height).toFixed(2) : "1",
        engagement_score: (photo.likes || 0) * 10 + 600,
        metrics: {
          likes: photo.likes || 0,
          color: photo.color,
        },
        niche_tags: [category, "aesthetic", `region:${regionCode}`, "visual_inspiration", ...(photo.tags || []).map((t) => t.title).slice(0, 3)],
        published_at: photo.created_at || new Date().toISOString(),
        ingested_at: new Date().toISOString(),
      };
    });

    setMemCache(cacheKey, items, CACHE_LONG);
    return items;
  } catch (error) {
    console.error("[TREND-SOURCES] Unsplash fetch error:", error?.message);
    return [];
  }
}

// -----------------------------------------------------------------------------
// 5. PEXELS API (Vertical Reels & Shorts Stock)
// -----------------------------------------------------------------------------
export async function fetchPexelsTrends({ category = "all", query = "", perPage = 25, page = 1, region = "IN" } = {}) {
  const apiKey = process.env.PEXELS_KEY;
  if (!apiKey) return [];

  const regionCode = normalizeRegionCode(region);
  const cacheKey = `trends:pexels:${category}:${query}:${perPage}:${page}:${regionCode}`;
  const cached = getMemCache(cacheKey);
  if (cached) return cached;

  try {
    const searchTerms = {
      tech_ai: "technology coding artificial intelligence computer",
      business_finance: "business entrepreneur trading city office",
      marketing_creators: "content creator podcast vlogger camera",
      entertainment: "dance music party cinema",
      health_fitness: "workout gym fitness runner training",
      design_art: "abstract design timelapse neon art",
      gaming: "gaming gamer streaming",
      science_space: "space galaxy science nature drone drone footage",
    };

    const regionTerm =
      regionCode === "IN"
        ? " India"
        : regionCode === "GB"
        ? " UK"
        : regionCode === "CA"
        ? " Canada"
        : regionCode === "AU"
        ? " Australia"
        : regionCode === "US"
        ? " USA"
        : "";

    const q = query
      ? `${query}${regionTerm}`
      : searchTerms[category]
      ? `${searchTerms[category]}${regionTerm}`
      : regionCode === "IN"
      ? "India travel culture aesthetic"
      : regionCode === "GB"
      ? "London UK travel aesthetic"
      : regionCode === "CA"
      ? "Canada nature travel aesthetic"
      : regionCode === "AU"
      ? "Australia Sydney travel aesthetic"
      : "viral reel shorts aesthetic";
    const url = q ? "https://api.pexels.com/videos/search" : "https://api.pexels.com/videos/popular";
    const params = {
      page,
      per_page: Math.max(perPage, 25),
      orientation: "portrait",
    };
    if (q) params.query = q;

    const res = await axios.get(url, {
      params,
      headers: { Authorization: apiKey },
      timeout: 8000,
    });

    const videos = res.data?.videos || [];
    const items = videos.map((video) => {
      const bestFile =
        video.video_files?.find((f) => f.quality === "hd" && f.width <= 1080) ||
        video.video_files?.find((f) => f.quality === "sd") ||
        video.video_files?.[0];

      const photographer = video.user?.name || "Pexels Creator";
      const title = `Reel & B-Roll: ${video.tags?.slice(0, 3)?.join(", ") || "Vertical Video"}`;

      return {
        id: `px_${video.id}`,
        source_platform: "pexels",
        source_url: video.url,
        embed_html: null,
        thumbnail_url: video.image,
        video_url: bestFile?.link || null,
        duration: video.duration || 15,
        title,
        caption: `🎥 Reel & Short B-Roll by ${photographer} (${video.duration}s)\n\nFormat: 9:16 Vertical • Quality: ${bestFile?.quality || "HD"}\n\nTags: ${(video.tags || []).slice(0, 5).join(", ")}`,
        creator: photographer,
        creator_url: video.user?.url,
        content_type: "reel_video",
        region: regionCode,
        country: regionCode,
        engagement_score: 6000 + (video.duration || 10) * 80,
        metrics: {
          duration: `${video.duration || 15}s`,
          quality: bestFile?.quality || "HD",
        },
        niche_tags: [category, "reel", "short", "broll", `region:${regionCode}`, "vertical_video", ...(video.tags || []).slice(0, 3)],
        published_at: new Date().toISOString(),
        ingested_at: new Date().toISOString(),
      };
    });

    setMemCache(cacheKey, items, CACHE_LONG);
    return items;
  } catch (error) {
    console.error("[TREND-SOURCES] Pexels fetch error:", error?.message);
    return [];
  }
}

// -----------------------------------------------------------------------------
// 6. PINTEREST OFFICIAL SEARCH & TRENDS (Ported from TrendPulse)
// -----------------------------------------------------------------------------
export async function fetchPinterestTrends({ category = "all", query = "", limit = 30, page = 1, token = null, region = "IN" } = {}) {
  const regionCode = normalizeRegionCode(region);
  const cacheKey = `trends:pinterest:${category}:${query}:${limit}:${page}:${regionCode}`;
  const cached = getMemCache(cacheKey);
  if (cached) return cached;

  const regionSuffix =
    regionCode === "IN"
      ? " India"
      : regionCode === "GB"
      ? " UK"
      : regionCode === "CA"
      ? " Canada"
      : regionCode === "AU"
      ? " Australia"
      : regionCode === "US"
      ? " USA"
      : "";

  try {
    let items = [];
    if (query && String(query).trim()) {
      const q = regionSuffix ? `${String(query).trim()}${regionSuffix}` : String(query).trim();
      const result = await searchPinterestPins({ query: q, token, limit, page });
      items = (result.pins || []).map((p) => ({
        ...p,
        region: regionCode,
        country: regionCode,
      }));
    } else {
      const rawPins = await fetchPinterestTrendingPins({ category, limit, page, region: regionCode });
      items = (rawPins || []).map((p) => ({
        ...p,
        region: regionCode,
        country: regionCode,
      }));
    }
    setMemCache(cacheKey, items, CACHE_SHORT);
    return items;
  } catch (err) {
    console.warn("[TREND-SOURCES] Pinterest fetch notice:", err.message);
    return [];
  }
}

// -----------------------------------------------------------------------------
// 7. BLUESKY OFFICIAL XRPC SEARCH & TRENDS (Ported from TrendPulse)
// -----------------------------------------------------------------------------
export async function fetchBlueskyTrends({ category = "all", query = "", limit = 30, page = 1 } = {}) {
  const cacheKey = `trends:bluesky:${category}:${query}:${limit}:${page}`;
  const cached = getMemCache(cacheKey);
  if (cached) return cached;

  try {
    let items = [];
    if (query && String(query).trim()) {
      const result = await searchBlueskyPosts({ query: String(query).trim(), limit, page });
      items = result.posts || [];
    } else {
      const result = await getBlueskyTrendingPosts({ category, limit, page });
      items = result.posts || [];
    }
    setMemCache(cacheKey, items, CACHE_SHORT);
    return items;
  } catch (err) {
    console.warn("[TREND-SOURCES] Bluesky fetch notice:", err.message);
    return [];
  }
}

export {
  searchPinterestPins,
  fetchPinterestTrendingPins,
  getPinterestRssFeed,
  getPinterestOEmbed,
  PINTEREST_CURATED_FEEDS,
  searchBlueskyPosts,
  getBlueskyTrendingPosts,
  getBlueskyTrendingTopics,
  filterAndRankPosts,
  calculateRelevance,
};

