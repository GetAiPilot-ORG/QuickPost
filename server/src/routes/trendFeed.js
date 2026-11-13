import { communityFeedPost } from "../services/socialpilotPublishing.js";
import express from "express";
import { authenticateUser } from "../middleware/authenticateUser.js";
import { getTrendFeedPage, getHotTopicsRadar } from "../services/trendFeed.js";
import { generateTrendRemix } from "../services/trends/trendRemixService.js";

const router = express.Router();

// 1. Unified paginated trend feed with rich multi-source filtering
router.get("/trends/feed", authenticateUser, async (req, res) => {
  try {
    const page = await getTrendFeedPage(req.query);
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

export default router;
