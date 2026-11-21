import { communityFeedPost } from "../services/socialpilotPublishing.js";
import express from "express";
import axios from "axios";
import { authenticateUser } from "../middleware/authenticateUser.js";
import { getTrendFeedPage, getHotTopicsRadar } from "../services/trendFeed.js";
import { generateTrendRemix } from "../services/trends/trendRemixService.js";
import {
  searchPinterestPins,
  searchBlueskyPosts,
  getBlueskyTrendingTopics,
  PINTEREST_CURATED_FEEDS,
} from "../services/trends/trendSources.js";
import {
  getUserTrendPreferences,
  saveUserTrendPreferences,
  recordUserSearch,
  getUserRecentSearches,
  deleteUserSearch,
  addSearchQueryToUserInterests,
} from "../services/trends/userTrendPreferencesService.js";

const router = express.Router();

// 1. Unified paginated trend feed with rich multi-source filtering
router.get("/trends/feed", authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.authUserId || req.user?.userId || req.user?.id || null;
    const page = await getTrendFeedPage(req.query, { userId });
    res.json(page);
  } catch (error) {
    console.error("[TREND-FEED] Feed error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load trend feed",
    });
  }
});

router.get('/trends/posts/:id', authenticateUser, async (req, res) => {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) return res.status(400).json({ success: false, error: 'Invalid post ID' });
  try {
    const { default: db } = await import('../services/supabase.js');
    const { data, error } = await db.from('posts').select('id,source_platform,source_url,thumbnail_url,caption,creator,creator_avatar_url,author_id,media_urls,media_type,published_at,ingested_at,engagement_score,niche_tags').eq('id', req.params.id).eq('source_platform', 'socialpilot').maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Post not found' });
    res.json({ success: true, post: communityFeedPost(data) });
  } catch (error) {
    console.error('[SOCIALPILOT] Post read failed:', error.message);
    res.status(500).json({ success: false, error: 'Unable to load this post' });
  }
});

// 2. Real-time hot topics and rising searches radar
router.get("/trends/hot-topics", authenticateUser, async (req, res) => {
  try {
    const data = await getHotTopicsRadar(req.query);
    res.json(data);
  } catch (error) {
    console.error("[TREND-FEED] Hot topics error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load hot topics radar",
    });
  }
});

// 3. AI Creative Spark & Remix Studio endpoint
router.post("/trends/remix", authenticateUser, async (req, res) => {
  try {
    const { title, caption, source_platform, source_url, niche, target_platform } = req.body;
    if (!title && !caption) {
      return res.status(400).json({
        success: false,
        error: "Title or caption is required for AI remixing.",
      });
    }

    const remix = await generateTrendRemix({
      title,
      caption,
      source_platform,
      source_url,
      niche,
      target_platform,
    });

    res.json({
      success: true,
      remix,
    });
  } catch (error) {
    console.error("[TREND-FEED] Remix error:", error);
    res.status(500).json({
      success: false,
      error: error?.message || "Failed to generate AI remix suggestions",
    });
  }
});

// 4. Media Proxy for external images / video thumbnails to bypass browser CORS
router.get("/trends/proxy-media", async (req, res) => {
  try {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res.status(400).json({ error: "Invalid protocol" });
    }

    const response = await axios.get(url, {
      responseType: "stream",
      timeout: 15000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "image/*,video/*,*/*",
      },
    });

    const contentType = response.headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");

    response.data.pipe(res);
  } catch (error) {
    console.error("[TREND-FEED] Proxy media error:", error?.message);
    res.status(502).json({ error: "Failed to fetch media from upstream" });
  }
});

// 5. Unified Trends Search (queries official Bluesky & Pinterest search with relevance ranking)
router.get("/trends/search", authenticateUser, async (req, res) => {
  try {
    const { q, query, sort = "top", limit = 25 } = req.query;
    const searchTerm = q || query;
    if (!searchTerm || !String(searchTerm).trim()) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    const token = req.headers["x-pinterest-token"] || process.env.PINTEREST_ACCESS_TOKEN || null;

    const [bskyResult, pinterestResult] = await Promise.allSettled([
      searchBlueskyPosts({ query: searchTerm, sort, limit: parseInt(limit, 10) }),
      searchPinterestPins({ query: searchTerm, token, limit: parseInt(limit, 10) }),
    ]);

    const bskyPosts = bskyResult.status === "fulfilled" ? bskyResult.value.posts || [] : [];
    const pinterestPins = pinterestResult.status === "fulfilled" ? pinterestResult.value.pins || [] : [];

    // Interleave search results
    const combined = [];
    const maxLen = Math.max(bskyPosts.length, pinterestPins.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < pinterestPins.length) combined.push(pinterestPins[i]);
      if (i < bskyPosts.length) combined.push(bskyPosts[i]);
    }

    res.json({
      success: true,
      query: searchTerm,
      results: combined,
      stats: {
        total: combined.length,
        blueskyCount: bskyPosts.length,
        pinterestCount: pinterestPins.length,
      },
      sources: {
        bluesky: "Official ATProto searchPosts",
        pinterest: pinterestResult.status === "fulfilled" ? pinterestResult.value.source : "None",
      },
    });
  } catch (err) {
    console.error("[TREND-FEED] Unified search error:", err);
    res.status(500).json({ success: false, error: "Failed to search trends" });
  }
});

// 6. Bluesky Search
router.get("/trends/bluesky/search", authenticateUser, async (req, res) => {
  try {
    const { q, query, sort = "top", limit = 25 } = req.query;
    const searchTerm = q || query;
    if (!searchTerm) return res.status(400).json({ error: 'Query parameter "q" is required' });
    const data = await searchBlueskyPosts({ query: searchTerm, sort, limit: parseInt(limit, 10) });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Pinterest Search
router.get("/trends/pinterest/search", authenticateUser, async (req, res) => {
  try {
    const { q, query, limit = 25 } = req.query;
    const searchTerm = q || query;
    if (!searchTerm) return res.status(400).json({ error: 'Query parameter "q" is required' });
    const token = req.headers["x-pinterest-token"] || process.env.PINTEREST_ACCESS_TOKEN || null;
    const data = await searchPinterestPins({ query: searchTerm, token, limit: parseInt(limit, 10) });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Bluesky Official Trends
router.get("/trends/bluesky/trends", authenticateUser, async (req, res) => {
  try {
    const data = await getBlueskyTrendingTopics();
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Pinterest Channels & Curated Boards
router.get("/trends/pinterest/channels", authenticateUser, (req, res) => {
  res.json({ success: true, channels: PINTEREST_CURATED_FEEDS });
});

// 10. User Trend Preferences (Read/Save to Supabase DB)
router.get("/trends/preferences", authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const preferences = await getUserTrendPreferences(userId);
    res.json({ success: true, preferences });
  } catch (err) {
    console.error("[TREND-FEED] Get preferences error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/trends/preferences", authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const { selectedTopicIds, interests, work, goal, onboarded } = req.body || {};
    const result = await saveUserTrendPreferences(userId, { selectedTopicIds, interests, work, goal, onboarded });
    res.json(result);
  } catch (err) {
    console.error("[TREND-FEED] Save preferences error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/trends/preferences", authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Unauthorized" });
    }
    const result = await saveUserTrendPreferences(userId, {
      selectedTopicIds: [],
      interests: "",
      work: "",
      goal: "",
      recentSearches: [],
      onboarded: false,
    });
    res.json({ success: true, preferences: result?.preferences || null });
  } catch (err) {
    console.error("[TREND-FEED] Reset preferences error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 11. User Search History & Auto-Add to Interests
router.post("/trends/search-history", authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { query } = req.body || {};
    let updatedPrefs = null;
    if (userId && query) {
      await recordUserSearch(userId, query);
      updatedPrefs = await addSearchQueryToUserInterests(userId, query);
    }
    res.json({ success: true, preferences: updatedPrefs?.preferences || null });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/trends/search-history", authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const searches = await getUserRecentSearches(userId, 10);
    res.json({ success: true, searches });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/trends/search-history", authenticateUser, async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const query = req.body?.query || req.query?.query;
    if (userId && query) {
      await deleteUserSearch(userId, query);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
