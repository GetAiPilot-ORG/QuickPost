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

// -----------------------------------------------------------------------------
// 1. YOUTUBE DATA API (Trending Videos & Shorts with 25+ items)
// -----------------------------------------------------------------------------
export async function fetchYouTubeTrends({ region = "IN", category = "all", query = "", maxResults = 25, page = 1 } = {}) {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) return [];

  const cleanQuery = (query || "").trim();
  const cacheKey = `trends:yt:${region}:${category}:${cleanQuery}:${maxResults}:${page}`;
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

    // For page > 1, explicit query, or specific niche queries, use YouTube Search API or trending chart
    if (cleanQuery || page > 1 || (category !== "all" && !videoCategoryId)) {
      const q = cleanQuery || NICHE_KEYWORDS[category] || "trending viral shorts podcast interview";
      const searchRes = await axios.get("https://www.googleapis.com/youtube/v3/search", {
        params: {
          part: "snippet",
          q,
          type: "video",
          order: "viewCount",
          videoCategoryId: videoCategoryId || undefined,
          regionCode: region.toUpperCase() === "GLOBAL" ? "US" : region.toUpperCase(),
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
    } else {
      const params = {
        part: "snippet,statistics,contentDetails",
        chart: "mostPopular",
        regionCode: region.toUpperCase() === "GLOBAL" ? "US" : region.toUpperCase(),
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
        engagement_score: views + likes * 2 + comments * 3,
        metrics: {
          views,
          likes,
          comments,
        },
        niche_tags: video.snippet?.tags ? video.snippet.tags.slice(0, 5) : [category],
        published_at: video.snippet?.publishedAt || new Date().toISOString(),
        ingested_at: new Date().toISOString(),
      };
    });

    setMemCache(cacheKey, normalized, CACHE_MEDIUM);
    return normalized;
  } catch (error) {
    console.error("[TREND-SOURCES] YouTube fetch error:", error?.message);
    return [];
  }
}

// -----------------------------------------------------------------------------
// 1B. YOUTUBE SHORTS (Dedicated Vertical Short-Form Video Feed)
// -----------------------------------------------------------------------------
export async function fetchYouTubeShorts({ region = "IN", category = "all", query = "", maxResults = 25, page = 1 } = {}) {
  const cleanQuery = (query || "").trim();
  const cacheKey = `trends:yt:shorts:${region}:${category}:${cleanQuery}:${maxResults}:${page}`;
  const cached = getMemCache(cacheKey);
  if (cached) return cached;

  const serpApiKey = process.env.SERPAPI_KEY;
  const ytApiKey = process.env.YOUTUBE_DATA_API_KEY;
  let items = [];

  const effectiveGl = region.toLowerCase() === "global" ? "us" : region.toLowerCase();

  // 1. Primary: SerpApi YouTube Engine (Reliable, dedicated shorts_results with vertical covers & views)
  if (serpApiKey) {
    try {
      const searchQuery = cleanQuery ? `${cleanQuery} shorts` : "trending #shorts viral";
      const res = await axios.get("https://serpapi.com/search.json", {
        params: {
          engine: "youtube",
          search_query: searchQuery,
          gl: effectiveGl,
          api_key: serpApiKey,
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
              engagement_score: 9500 + (30 - index) * 150 + Math.min(views, 500000) * 0.05,
              metrics: {
                views: s.views_original || `${Math.floor(views / 1000)}K`,
                platform: "YouTube Shorts",
              },
              niche_tags: ["shorts", "reel", "youtube_shorts", category].filter(Boolean),
              published_at: new Date(Date.now() - index * 3600000).toISOString(),
              ingested_at: new Date().toISOString(),
            };
          });
      }
    } catch (err) {
      console.warn("[TREND-SOURCES] SerpApi YouTube Shorts notice:", err?.message);
    }
  }

  // 2. Fallback: YouTube Data API mostPopular videos filtered to shorts (< 60s)
  if (items.length === 0 && ytApiKey) {
    try {
      const regularYt = await fetchYouTubeTrends({ region, category, query: cleanQuery, maxResults: 50, page });
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
  if (!apiKey) return [];

  const cacheKey = `trends:serpapi:google_trends:${geo}:${page}`;
  const cached = getMemCache(cacheKey);
  if (cached) return cached;

  try {
    const response = await axios.get("https://serpapi.com/search.json", {
      params: {
        engine: "google_trends_trending_now",
        geo: geo.toUpperCase() === "GLOBAL" ? "US" : geo.toUpperCase(),
        api_key: apiKey,
      },
      timeout: 9000,
    });

    const trendingSearches = response.data?.trending_searches || [];
    const startIndex = ((page - 1) * 20) % Math.max(trendingSearches.length, 1);
    const pageItems = trendingSearches.slice(startIndex, startIndex + 25);
    const pool = pageItems.length > 0 ? pageItems : trendingSearches.slice(0, 25);

    const items = pool.map((trend, index) => {
      const query = trend.query || trend.title || "Trending Search";
      const searchVolume = trend.search_volume || trend.traffic || "200K+";
      const articles = trend.articles || [];
      const topArticle = articles[0] || {};
      const relatedQueries = (trend.related_queries || []).map((q) => (typeof q === "string" ? q : q.query)).filter(Boolean);

      return {
        id: `gt_${page}_${index}_${Buffer.from(query).toString("hex").slice(0, 10)}`,
        source_platform: "google_trends",
        source_url: topArticle.link || `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        embed_html: null,
        thumbnail_url: topArticle.snippet_thumbnail || trend.thumbnail || null,
        title: query,
        caption: `🔥 Google Trending Search: "${query}" (${searchVolume} searches today)\n\n${topArticle.title ? `Top Story: ${topArticle.title}` : ""}\n\nRelated queries: ${relatedQueries.join(", ")}`,
        content_type: "trend_query",
        engagement_score: 2800 + (30 - index) * 50,
        metrics: {
          searchVolume,
          rank: startIndex + index + 1,
          newsCount: articles.length,
        },
        related_queries: relatedQueries,
        niche_tags: ["google_trends", "breaking_surge", ...relatedQueries.slice(0, 3)],
        published_at: trend.published_date || new Date().toISOString(),
        ingested_at: new Date().toISOString(),
      };
    });

    setMemCache(cacheKey, items, CACHE_SHORT);
    return items;
  } catch (error) {
    console.error("[TREND-SOURCES] SerpApi Google Trends fetch error:", error?.message);
    return [];
  }
}

// -----------------------------------------------------------------------------
// 3. GNEWS & NEWSAPI (Global & Niche Breaking News)
// -----------------------------------------------------------------------------
export async function fetchTrendingNews({ category = "all", region = "IN", query = "", page = 1 } = {}) {
  const gnewsKey = process.env.GNEWS_KEY;
  const newsApiKey = process.env.NEWSAPI_KEY;

  const cacheKey = `trends:news:${category}:${region}:${query}:${page}`;
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
      const q = query || (category === "tech_ai" ? "AI OR technology" : "");
      const params = {
        lang: "en",
        country: region.toLowerCase() === "global" ? "us" : region.toLowerCase(),
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
          id: `gn_${page}_${idx}_${Buffer.from(art.url || art.title).toString("hex").slice(0, 10)}`,
          source_platform: "gnews",
          source_url: art.url,
          embed_html: null,
          thumbnail_url: art.image || null,
          title: art.title,
          caption: `${art.title}\n\n${art.description || ""}\n\nSource: ${art.source?.name || "Global Media"}`,
          creator: art.source?.name || "Global Media",
          content_type: "news",
          engagement_score: 5000 + (25 - idx) * 120,
          metrics: {
            source: art.source?.name,
          },
          niche_tags: [category, "breaking_news", art.source?.name].filter(Boolean),
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
      const q = query || (category === "tech_ai" ? "AI" : "");
      const res = await axios.get(q ? "https://newsapi.org/v2/everything" : "https://newsapi.org/v2/top-headlines", {
        params: {
          category: q ? undefined : nCategory,
          q: q || undefined,
          country: q ? undefined : (region.toLowerCase() === "global" ? "us" : region.toLowerCase()),
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
            id: `na_${page}_${idx}_${Buffer.from(art.url || art.title).toString("hex").slice(0, 10)}`,
            source_platform: "newsapi",
            source_url: art.url,
            embed_html: null,
            thumbnail_url: art.urlToImage || null,
            title: art.title,
            caption: `${art.title}\n\n${art.description || ""}\n\nSource: ${art.source?.name || "News Network"}`,
            creator: art.source?.name || "News Network",
            content_type: "news",
            engagement_score: 4000 + (25 - idx) * 100,
            metrics: {
              source: art.source?.name,
            },
            niche_tags: [category, "news", art.source?.name].filter(Boolean),
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

  const cacheKey = `trends:unsplash:${category}:${query}:${perPage}:${page}:${region}`;
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

    const regionUpper = String(region || "IN").toUpperCase();
    const regionTerm =
      regionUpper === "IN"
        ? " India"
        : regionUpper === "GB"
        ? " UK"
        : regionUpper === "CA"
        ? " Canada"
        : regionUpper === "AU"
        ? " Australia"
        : regionUpper === "US" || regionUpper === "GLOBAL"
        ? " USA"
        : "";

    const q = query
      ? query
      : searchTerms[category]
      ? `${searchTerms[category]}${regionTerm}`
      : regionUpper === "IN"
      ? "India aesthetic architecture culture design"
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
        color: photo.color,
        aspect_ratio: photo.width && photo.height ? (photo.width / photo.height).toFixed(2) : "1",
        engagement_score: (photo.likes || 0) * 10 + 600,
        metrics: {
          likes: photo.likes || 0,
          color: photo.color,
        },
        niche_tags: [category, "aesthetic", "visual_inspiration", ...(photo.tags || []).map((t) => t.title).slice(0, 3)],
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

  const cacheKey = `trends:pexels:${category}:${query}:${perPage}:${page}:${region}`;
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

    const regionUpper = String(region || "IN").toUpperCase();
    const regionTerm =
      regionUpper === "IN"
        ? " India"
        : regionUpper === "GB"
        ? " UK"
        : regionUpper === "CA"
        ? " Canada"
        : regionUpper === "AU"
        ? " Australia"
        : regionUpper === "US" || regionUpper === "GLOBAL"
        ? " USA"
        : "";

    const q = query
      ? query
      : searchTerms[category]
      ? `${searchTerms[category]}${regionTerm}`
      : regionUpper === "IN"
      ? "India travel culture aesthetic"
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
        engagement_score: 6000 + (video.duration || 10) * 80,
        metrics: {
          duration: `${video.duration || 15}s`,
          quality: bestFile?.quality || "HD",
        },
        niche_tags: [category, "reel", "short", "broll", "vertical_video", ...(video.tags || []).slice(0, 3)],
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
  const cacheKey = `trends:pinterest:${category}:${query}:${limit}:${page}:${region}`;
  const cached = getMemCache(cacheKey);
  if (cached) return cached;

  try {
    let items = [];
    if (query && String(query).trim()) {
      const result = await searchPinterestPins({ query: String(query).trim(), token, limit, page });
      items = result.pins || [];
    } else {
      items = await fetchPinterestTrendingPins({ category, limit, page, region });
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

