/**
 * Bluesky Official AT Protocol XRPC Service (Ported from TrendPulse)
 * Uses official public AppView endpoints:
 * - https://public.api.bsky.app/xrpc/app.bsky.unspecced.getTrends
 * - https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed
 * - https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts
 */

import { filterAndRankPosts } from "./trendRelevance.js";

const BSKY_PUBLIC_API = "https://public.api.bsky.app/xrpc";
const BSKY_SEARCH_API = "https://api.bsky.app/xrpc";

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
  const rkey = post.uri ? post.uri.split("/").pop() : "";
  const handle = post.author?.handle || "unknown";
  const authorName = post.author?.displayName || handle;
  const text = post.record?.text || "";
  const media = extractMedia(post.embed);

  const images = media.type === "images" ? media.items : [];
  const external = media.type === "external" ? media.items[0] : null;
  const video = media.type === "video" ? media.items[0] : null;

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
 * Fetch posts from a Bluesky feed (either a topic feed or what's hot)
 */
export async function getBlueskyTrendingPosts({ topic = null, feedUri = null, limit = 25, cursor = null } = {}) {
  try {
    let targetFeed = feedUri;
    if (!targetFeed) {
      if (topic) {
        targetFeed = `at://did:plc:qrz3lhbyuxbeilrc6nekdqme/app.bsky.feed.generator/${topic}`;
      } else {
        targetFeed = "at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot";
      }
    }

    const params = new URLSearchParams({
      feed: targetFeed,
      limit: String(limit),
    });
    if (cursor) {
      params.append("cursor", cursor);
    }

    const res = await fetch(`${BSKY_PUBLIC_API}/app.bsky.feed.getFeed?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "TrendFeed/1.0",
      },
    });

    if (!res.ok) {
      throw new Error(`Bluesky getFeed error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const rawFeed = data.feed || [];
    const posts = rawFeed.map(({ post, feedContext }) => normalizeBlueskyPost(post, feedContext || "trending"));

    return {
      posts,
      cursor: data.cursor,
      feedUri: targetFeed,
    };
  } catch (err) {
    console.warn("[BLUESKY-SOURCE] Error fetching Bluesky posts:", err.message);
    return { posts: [] };
  }
}

/**
 * Search posts on Bluesky by keyword sorted by top engagement or latest
 */
export async function searchBlueskyPosts({ query, sort = "top", limit = 25, cursor = null } = {}) {
  if (!query || !String(query).trim()) return { posts: [] };
  const cleanQ = String(query).trim();

  try {
    const sortParam = sort === "recent" || sort === "latest" ? "latest" : "top";
    const fetchLimit = Math.min(Math.max(limit * 2, 40), 100);
    const params = new URLSearchParams({
      q: cleanQ,
      sort: sortParam,
      limit: String(fetchLimit),
    });
    if (cursor) {
      params.append("cursor", cursor);
    }

    // Try api.bsky.app first (public unauthenticated search endpoint), fallback to public.api.bsky.app
    let res = await fetch(`${BSKY_SEARCH_API}/app.bsky.feed.searchPosts?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!res.ok) {
      res = await fetch(`${BSKY_PUBLIC_API}/app.bsky.feed.searchPosts?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "TrendFeed/1.0",
        },
      });
    }

    if (!res.ok) {
      throw new Error(`Bluesky searchPosts error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const rawPosts = (data.posts || []).map((post) => normalizeBlueskyPost(post, "search"));

    // Apply precision relevance scoring & spam filtering
    const rankedPosts = filterAndRankPosts(rawPosts, cleanQ).slice(0, limit);

    return {
      posts: rankedPosts,
      cursor: data.cursor,
    };
  } catch (err) {
    console.warn("[BLUESKY-SOURCE] Error searching Bluesky posts:", err.message);
    return { posts: [] };
  }
}
