/**
 * PostIntelligenceEngine.js
 * ─────────────────────────────────────────────────────────────────
 * Pure functions — no React, no side effects.
 * Analyzes the full post context and returns structured output.
 *
 * Output shape:
 * {
 *   valid: boolean,
 *   errors:    [{ id, platform, title, message, blocking: true }],
 *   warnings:  [{ id, platform, title, message }],
 *   behaviors: [{ id, platform, title, message }],  // "what will happen"
 *   suggestions: [{ id, title, message, action? }],
 *   autoFixes: [{ id, description, apply: fn }],
 * }
 */

import { PLATFORM_META } from "../data/platforms.js";

/* ── Internal rule IDs ── */
const RULE = {
  YT_IMAGE_ONLY:        "yt_image_only",
  YT_IMAGE_IGNORED:     "yt_image_ignored",
  YT_THUMB_UNVERIFIED:  "yt_thumb_unverified",
  YT_THUMB_MISSING:     "yt_thumb_missing",
  YT_TITLE_MISSING:     "yt_title_missing",
  REEL_FORMAT_MISMATCH: "reel_format_mismatch",
  PINTEREST_TITLE:      "pinterest_title",
  PINTEREST_BOARD:      "pinterest_board",
  REDDIT_SUBREDDIT:     "reddit_subreddit",
  SCHEDULE_PAST:        "schedule_past",
  BLUESKY_VIDEO:        "bluesky_video",
  MASTODON_VIDEO:       "mastodon_video",
  MULTI_PLATFORM_INFO:  "multi_platform_info",
  MEDIA_ORDER_TIP:      "media_order_tip",
  CHAR_LIMIT:           "char_limit",
};

/**
 * Main engine — call this with the full post state.
 *
 * @param {object} ctx
 * @param {string[]}  ctx.selectedChannels
 * @param {Array}     ctx.mediaFiles        — [{ id, file: File }]
 * @param {object}    ctx.platformData      — { youtube: {title}, pinterest: {title,boardId}, reddit: {subreddit} }
 * @param {File|null} ctx.youtubeThumbnail
 * @param {string}    ctx.postType          — "post" | "reel" | "story"
 * @param {string}    ctx.caption
 * @param {string}    ctx.scheduledAt       — ISO string or ""
 * @param {boolean}   ctx.isScheduled
 * @param {object}    ctx.connectedAccounts — { youtube: { verified: bool }, ... }
 * @returns {IntelligenceResult}
 */
export function PostIntelligenceEngine(ctx) {
  const {
    selectedChannels = [],
    mediaFiles = [],
    platformData = {},
    youtubeThumbnail = null,
    postType = "post",
    caption = "",
    scheduledAt = "",
    isScheduled = false,
    connectedAccounts = {},
  } = ctx;

  const errors      = [];
  const warnings    = [];
  const behaviors   = [];
  const suggestions = [];
  const autoFixes   = [];

  // Nothing selected yet — return early, no noise
  if (selectedChannels.length === 0 || mediaFiles.length === 0) {
    return { valid: true, errors, warnings, behaviors, suggestions, autoFixes };
  }

  const hasImage = mediaFiles.some((m) => m.file?.type?.startsWith("image/"));
  const hasVideo = mediaFiles.some((m) => m.file?.type?.startsWith("video/"));
  const hasBoth  = hasImage && hasVideo;

  const hasPlatform = (p) =>
    (selectedChannels || []).some((c) => c === p || String(c).startsWith(p + ":"));

  /* ────────────────────────────────────────────────────────────
     YOUTUBE RULES
     ──────────────────────────────────────────────────────────── */
  if (hasPlatform("youtube")) {

    // BLOCKING: YouTube cannot accept image-only posts (including GIFs)
    if (hasImage && !hasVideo) {
      errors.push({
        id: RULE.YT_IMAGE_ONLY,
        platform: "youtube",
        title: "YouTube doesn't support image or GIF posts",
        message: "YouTube only supports video uploads (.mp4, .mov, .webm). GIFs and images cannot be uploaded. Please upload a video file or deselect YouTube.",
        blocking: true,
      });
    }

    // WARNING: mixed media — images will be silently ignored by YouTube
    if (hasBoth) {
      warnings.push({
        id: RULE.YT_IMAGE_IGNORED,
        platform: "youtube",
        title: "Images will be ignored on YouTube",
        message: "YouTube par sirf video publish hoga. Upload ki gayi images automatically ignore ho jayengi.",
      });
    }

    // WARNING: custom thumbnail requires verified account
    if (youtubeThumbnail && connectedAccounts?.youtube && !connectedAccounts.youtube.verified) {
      warnings.push({
        id: RULE.YT_THUMB_UNVERIFIED,
        platform: "youtube",
        title: "YouTube account not verified",
        message: "Custom thumbnail set karne ke liye YouTube channel verify hona zaroori hai. Thumbnail set nahi hogi.",
      });
    }

    // SUGGESTION: no thumbnail on a video → mention it's optional but helpful
    if (hasVideo && !youtubeThumbnail && !errors.find((e) => e.id === RULE.YT_IMAGE_ONLY)) {
      suggestions.push({
        id: RULE.YT_THUMB_MISSING,
        title: "Add a YouTube thumbnail",
        message: "Custom thumbnail add karne se CTR significantly badhta hai. Platform Customization section mein set karein.",
      });
    }

    // WARNING: YouTube title is mandatory
    if (!platformData?.youtube?.title?.trim()) {
      warnings.push({
        id: RULE.YT_TITLE_MISSING,
        platform: "youtube",
        title: "YouTube title required",
        message: "YouTube par video publish hone ke liye ek title add karna zaroori hai.",
      });
    }
  }

  /* ────────────────────────────────────────────────────────────
     REEL vs SHORTS FORMAT
     ──────────────────────────────────────────────────────────── */
  if (
    postType === "reel" &&
    hasPlatform("instagram") &&
    hasPlatform("youtube")
  ) {
    warnings.push({
      id: RULE.REEL_FORMAT_MISMATCH,
      platform: null,
      title: "Reel vs Shorts format check",
      message: "Instagram Reel aur YouTube Shorts ka optimal format alag hota hai. Best results ke liye ensure karein ki video vertical (9:16) ho.",
    });
  }

  /* ────────────────────────────────────────────────────────────
     PINTEREST RULES
     ──────────────────────────────────────────────────────────── */
  if (hasPlatform("pinterest")) {
    if (!platformData?.pinterest?.title?.trim()) {
      warnings.push({
        id: RULE.PINTEREST_TITLE,
        platform: "pinterest",
        title: "Pinterest title required",
        message: "Pinterest par Pin ke liye ek descriptive title add karna zaroori hai.",
      });
    }
    if (!platformData?.pinterest?.boardId) {
      warnings.push({
        id: RULE.PINTEREST_BOARD,
        platform: "pinterest",
        title: "Pinterest board not selected",
        message: "Pinterest board select karna required hai. Platform Customization mein board choose karein.",
      });
    }
  }

  /* ────────────────────────────────────────────────────────────
     REDDIT RULES
     ──────────────────────────────────────────────────────────── */
  if (hasPlatform("reddit") && !platformData?.reddit?.subreddit?.trim()) {
    warnings.push({
      id: RULE.REDDIT_SUBREDDIT,
      platform: "reddit",
      title: "Subreddit required",
      message: "Reddit par post karne ke liye ek subreddit specify karna zaroori hai.",
    });
  }

  /* ────────────────────────────────────────────────────────────
     VIDEO-ONLY PLATFORMS with a video upload
     ──────────────────────────────────────────────────────────── */
  if (hasVideo) {
    const videoUnsupported = selectedChannels.filter(
      (p) => PLATFORM_META[p] && !PLATFORM_META[p].supportsVideo
    );
    videoUnsupported.forEach((p) => {
      warnings.push({
        id: `${p}_video_unsupported`,
        platform: p,
        title: `${PLATFORM_META[p].label} doesn't support video`,
        message: `${PLATFORM_META[p].label} par video post nahi hogi — sirf image supported hai.`,
      });
    });
  }

  /* ────────────────────────────────────────────────────────────
     SCHEDULING RULES
     ──────────────────────────────────────────────────────────── */
  if (isScheduled && scheduledAt) {
    const schedTime = new Date(scheduledAt).getTime();
    if (schedTime < Date.now() + 2 * 60 * 1000) {
      errors.push({
        id: RULE.SCHEDULE_PAST,
        platform: null,
        title: "Scheduled time is in the past",
        message: "Selected time past mein hai ya bahut kareeb hai. Please future time select karein (minimum 2 minutes ahead).",
        blocking: true,
      });
    }
  }

  /* ────────────────────────────────────────────────────────────
     CHARACTER LIMIT WARNINGS
     ──────────────────────────────────────────────────────────── */
  if (caption.length > 0) {
    selectedChannels.forEach((p) => {
      const limit = PLATFORM_META[p]?.charLimit;
      if (limit && caption.length > limit) {
        warnings.push({
          id: `${p}_char_limit`,
          platform: p,
          title: `Caption too long for ${PLATFORM_META[p]?.label}`,
          message: `${PLATFORM_META[p]?.label} ka limit ${limit} characters hai. Aapka caption ${caption.length} characters ka hai — truncate ho sakta hai.`,
        });
      }
    });
  }

  /* ────────────────────────────────────────────────────────────
     MULTI-PLATFORM BEHAVIOR INFO (positive scenarios)
     ──────────────────────────────────────────────────────────── */
  if (selectedChannels.length > 1 && errors.length === 0) {
    if (hasBoth) {
      // Tell which platforms get image-only vs video-only
      const imageOnly = selectedChannels.filter(
        (p) => PLATFORM_META[p]?.supportsImage && !PLATFORM_META[p]?.supportsVideo
      );
      const videoOnly = selectedChannels.filter(
        (p) => !PLATFORM_META[p]?.supportsImage && PLATFORM_META[p]?.supportsVideo
      );

      if (imageOnly.length > 0) {
        behaviors.push({
          id: `behavior_image_only_${imageOnly.join("_")}`,
          platform: null,
          title: `${imageOnly.map((p) => PLATFORM_META[p]?.label).join(", ")}: Image only`,
          message: `${imageOnly.map((p) => PLATFORM_META[p]?.label).join(" aur ")} par sirf images publish hongi. Videos ignore ho jayenge.`,
        });
      }
      if (videoOnly.length > 0) {
        behaviors.push({
          id: `behavior_video_only_${videoOnly.join("_")}`,
          platform: null,
          title: `${videoOnly.map((p) => PLATFORM_META[p]?.label).join(", ")}: Video only`,
          message: `${videoOnly.map((p) => PLATFORM_META[p]?.label).join(" aur ")} par sirf video publish hoga. Images ignore ho jayenge.`,
        });
      }
    }

    // All green — positive summary
    if (behaviors.length === 0 && warnings.length === 0) {
      behaviors.push({
        id: RULE.MULTI_PLATFORM_INFO,
        platform: null,
        title: `Ready to publish on ${selectedChannels.length} platforms`,
        message: `Aapka ${hasVideo ? "video" : "post"} ${selectedChannels.map((p) => PLATFORM_META[p]?.label).filter(Boolean).join(", ")} par publish hoga.`,
        positive: true,
      });
    }
  }

  /* ────────────────────────────────────────────────────────────
     MEDIA ORDER TIP
     ──────────────────────────────────────────────────────────── */
  if (mediaFiles.length > 1) {
    suggestions.push({
      id: RULE.MEDIA_ORDER_TIP,
      title: "Media order matters",
      message: "Pehli image/video cover ke roop mein use hogi. Drag karke reorder karein.",
    });
  }

  const valid = errors.filter((e) => e.blocking).length === 0;

  return { valid, errors, warnings, behaviors, suggestions, autoFixes };
}
