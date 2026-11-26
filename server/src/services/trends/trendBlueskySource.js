/**
 * Bluesky Official AT Protocol XRPC Service (Ported from TrendPulse)
 * Uses official public AppView endpoints:
 * - https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrends
 * - https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed
 * - https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts
 */

import { filterAndRankPosts } from "./trendRelevance.js";

const BSKY_PUBLIC_API = "https://api.bsky.app/xrpc";
const BSKY_SEARCH_API = "https://api.bsky.app/xrpc";

// In-memory pagination caches for seamless infinite scroll on Bluesky
const bskyUntilCache = new Map();
const bskyFeedCursorCache = new Map();

/**
 * Extract media embeds from post record / embed
 */
export function extractMedia(embed) {
  if (!embed) return { type: "none", items: [] };

  const type = embed.$type || "";

  // Images embed
  if (type.includes("app.bsky.embed.images")) {
    return {
      type: "images",
      items: (embed.images || []).map((img) => ({
        thumb: img.thumb,
        fullsize: img.fullsize,
        alt: img.alt || "",
        aspectRatio: img.aspectRatio || null,
      })),
    };
  }

  // External card embed (e.g. article link with thumbnail)
  if (type.includes("app.bsky.embed.external")) {
    const ext = embed.external || {};
    return {
      type: "external",
      items: [
        {
          title: ext.title || "",
          description: ext.description || "",
          uri: ext.uri || "",
          thumb: ext.thumb || "",
        },
      ],
    };
  }

  // Record with media (composite)
  if (type.includes("app.bsky.embed.recordWithMedia")) {
    return extractMedia(embed.media);
  }

  // Video embed
  if (type.includes("app.bsky.embed.video")) {
    return {
      type: "video",
      items: [
        {
          thumb: embed.thumbnail || "",
          alt: embed.alt || "",
          aspectRatio: embed.aspectRatio || null,
        },
      ],
    };
  }

  return { type: "none", items: [] };
}

/**
 * Normalize Bluesky post into QuickPost standard feed post
 */
function normalizeBlueskyPost(post, feedContext = "trending") {
  if (!post || !post.record) return null;

  // Filter out replies so we don't display out-of-context conversational fragments
  if (post.record.reply) return null;

  const rkey = post.uri ? post.uri.split("/").pop() : "";
  const handle = post.author?.handle || "unknown";
  const authorName = post.author?.displayName || handle;
  const text = post.record?.text || "";

  // If post starts with @ mention (conversational reply), skip
  if (/^@[\w.-]+/.test(text.trim())) return null;

  const media = extractMedia(post.embed);

  const images = media.type === "images" ? media.items : [];
  const external = media.type === "external" ? media.items[0] : null;
  const video = media.type === "video" ? media.items[0] : null;

  // Filter out ultra-short noise without media
  const trimmed = text.trim();
  if (trimmed.length < 15 && images.length === 0 && !external && !video) {
    return null;
  }
  // Filter out pure link spam without description
  if (/^https?:\/\/\S+$/.test(trimmed)) {
    return null;
  }

  const thumbnail = images[0]?.thumb || images[0]?.fullsize || external?.thumb || video?.thumb || null;
  const fullImage = images[0]?.fullsize || images[0]?.thumb || external?.thumb || null;

  const likes = Number(post.likeCount || 0);
  const reposts = Number(post.repostCount || 0);
  const replies = Number(post.replyCount || 0);
  const quotes = Number(post.quoteCount || 0);

  // Derive title from text (first sentence or up to 90 chars)
  const firstSentence = text.split("\n")[0] || text;
  const title = firstSentence.length > 90 ? `${firstSentence.slice(0, 90)}...` : firstSentence || "Bluesky Trend";

  return {
    id: `bsky_${post.cid || rkey || Math.random().toString(36).slice(2)}`,
    source_platform: "bluesky",
    source_url: `https://bsky.app/profile/${handle}/post/${rkey}`,
    embed_html: null,
    thumbnail_url: thumbnail,
    full_image_url: fullImage,
    media_urls: images.map((img) => img.fullsize || img.thumb).filter(Boolean),
    title,
    caption: text,
    creator: authorName,
    creator_url: `https://bsky.app/profile/${handle}`,
    creator_avatar_url: post.author?.avatar || null,
    content_type: images.length > 0 || fullImage ? "visual" : "social",
    engagement_score: likes * 3 + reposts * 5 + replies * 2 + 500,
    metrics: {
      likes,
      reposts,
      replies,
      quotes,
    },
    niche_tags: ["bluesky", feedContext].filter(Boolean),
    published_at: post.record?.createdAt || post.indexedAt || new Date().toISOString(),
    ingested_at: new Date().toISOString(),
  };
}

/**
 * Fetch official trending topics
 */
export async function getBlueskyTrendingTopics() {
  try {
    const res = await fetch(`${BSKY_PUBLIC_API}/app.bsky.unspecced.getTrends`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "TrendFeed/1.0",
      },
    });

    if (!res.ok) {
      throw new Error(`Bluesky trends API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    return {
      recIdStr: data.recIdStr,
      trends: (data.trends || []).map((t) => ({
        topic: t.topic,
        displayName: t.displayName,
        description: t.description,
        postCount: t.postCount,
        status: t.status,
        category: t.category,
        startedAt: t.startedAt,
        link: t.link,
      })),
    };
  } catch (err) {
    console.warn("[BLUESKY-SOURCE] Error fetching Bluesky trends:", err.message);
    return { trends: [] };
  }
}

/**
 * Fetch posts from a Bluesky feed (either a category search or official what's hot)
 * with robust multi-page pagination.
 */
export async function getBlueskyTrendingPosts({ category = "all", topic = null, feedUri = null, limit = 30, page = 1 } = {}) {
  const cat = category || topic || "all";

  // Category-specific or creator-curated search on Bluesky for high quality niche posts
  const categoryKeywords = {
    all: "creative OR design OR tech OR photography OR ai",
    tech_ai: "AI OR tech OR software OR programming",
    business_finance: "business OR startup OR finance OR saas",
    marketing_creators: "creator OR marketing OR youtube OR contentcreator",
    entertainment: "cinema OR movies OR filmmaking OR music",
    health_fitness: "fitness OR workout OR health OR wellness",
    design_art: "design OR architecture OR digitalart OR illustration",
    gaming: "gaming OR gamedev OR videogames",
    science_space: "science OR space OR astronomy OR physics",
  };
  const query = categoryKeywords[cat] || (cat !== "all" ? cat.replace(/_/g, " ") : "creative OR tech OR design");
  const result = await searchBlueskyPosts({ query, limit, page });
  if (result.posts && result.posts.length > 0) {
    return result;
  }

  // Fallback to official feed generator with quality filtering
  try {
    const targetFeed = feedUri || "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot";
    const pageSize = Math.min(Math.max(limit, 25), 50);

    let cursor = null;
    if (page > 1) {
      cursor = bskyFeedCursorCache.get(`whats-hot:${page}`) || null;
      if (!cursor) {
        let cur = null;
        const maxWalk = Math.min(page - 1, 4);
        for (let p = 1; p <= maxWalk; p++) {
          const stepParams = new URLSearchParams({ feed: targetFeed, limit: String(pageSize) });
          if (cur) stepParams.append("cursor", cur);
          const stepRes = await fetch(`${BSKY_PUBLIC_API}/app.bsky.feed.getFeed?${stepParams.toString()}`, {
            headers: {
              Accept: "application/json",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
          });
          if (!stepRes.ok) break;
          const stepData = await stepRes.json();
          cur = stepData.cursor || null;
          if (cur) bskyFeedCursorCache.set(`whats-hot:${p + 1}`, cur);
        }
        cursor = cur;
      }
    }

    const params = new URLSearchParams({
      feed: targetFeed,
      limit: String(pageSize),
    });
    if (cursor) {
      params.append("cursor", cursor);
    }

    const res = await fetch(`${BSKY_PUBLIC_API}/app.bsky.feed.getFeed?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`Bluesky getFeed error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const rawFeed = data.feed || [];
    const posts = rawFeed
      .map(({ post, feedContext }) => normalizeBlueskyPost(post, feedContext || "trending"))
      .filter(Boolean);

    if (data.cursor) {
      bskyFeedCursorCache.set(`whats-hot:${page + 1}`, data.cursor);
    }

    return {
      posts: posts.slice(0, limit),
      cursor: data.cursor,
      feedUri: targetFeed,
    };
  } catch (err) {
    console.warn("[BLUESKY-SOURCE] Error fetching Bluesky posts:", err.message);
    return { posts: [] };
  }
}

/**
 * Search posts on Bluesky by keyword with date-based cursor pagination
 * Returns authentic, high-engagement discussion posts across multiple pages.
 */
export async function searchBlueskyPosts({ query, sort = "top", limit = 30, page = 1 } = {}) {
  if (!query || !String(query).trim()) return { posts: [] };
  let cleanQ = String(query).trim();

  // If query is multi-word without boolean OR or quotes, convert top 3 words to OR query for Bluesky
  if (!cleanQ.includes(" OR ") && !cleanQ.includes('"') && cleanQ.split(/\s+/).length > 2) {
    const terms = cleanQ.split(/\s+/).slice(0, 3);
    cleanQ = terms.join(" OR ");
  }

  const lowerQ = cleanQ.toLowerCase();

  try {
    const fetchLimit = Math.min(Math.max(limit, 25), 50);

    // Date-based pagination cursor (`until`) to bypass Cloudflare WAF restrictions on base64 cursors
    let until = null;
    if (page > 1) {
      until = bskyUntilCache.get(`${lowerQ}:${page}`) || null;

      if (!until) {
        let curUntil = null;
        const maxWalk = Math.min(page - 1, 4);
        for (let p = 1; p <= maxWalk; p++) {
          const stepSort = p === 1 ? "top" : "latest";
          const stepParams = new URLSearchParams({
            q: cleanQ,
            sort: stepSort,
            limit: String(fetchLimit),
          });
          if (curUntil) stepParams.append("until", curUntil);

          const stepRes = await fetch(`${BSKY_SEARCH_API}/app.bsky.feed.searchPosts?${stepParams.toString()}`, {
            headers: {
              Accept: "application/json",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
          });
          if (!stepRes.ok) break;
          const stepData = await stepRes.json();
          const stepPosts = stepData.posts || [];
          if (!stepPosts.length) break;
          const last = stepPosts[stepPosts.length - 1];
          curUntil = last.record?.createdAt || last.indexedAt || null;
          if (curUntil) bskyUntilCache.set(`${lowerQ}:${p + 1}`, curUntil);
        }
        until = curUntil;
      }
    }

    // Page 1 prioritizes top viral engagement, subsequent pages stream chronological discussions with `until`
    const sortParam = page === 1 ? (sort === "recent" || sort === "latest" ? "latest" : "top") : "latest";
    const params = new URLSearchParams({
      q: cleanQ,
      sort: sortParam,
      limit: String(fetchLimit),
    });
    if (until) {
      params.append("until", until);
    }

    const res = await fetch(`${BSKY_SEARCH_API}/app.bsky.feed.searchPosts?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      throw new Error(`Bluesky searchPosts error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const rawPosts = (data.posts || [])
      .map((post) => normalizeBlueskyPost(post, "search"))
      .filter(Boolean);

    if (rawPosts.length > 0) {
      const last = data.posts[data.posts.length - 1];
      const nextUntil = last.record?.createdAt || last.indexedAt || null;
      if (nextUntil) {
        bskyUntilCache.set(`${lowerQ}:${page + 1}`, nextUntil);
      }
    }

    return {
      posts: rawPosts.slice(0, limit),
      cursor: data.cursor,
    };
  } catch (err) {
    console.warn("[BLUESKY-SOURCE] Error searching Bluesky posts:", err.message);
    return { posts: [] };
  }
}
