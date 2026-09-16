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
