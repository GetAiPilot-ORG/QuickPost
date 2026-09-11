import express from "express";
import { upload, handleUploadError } from "../middleware/upload.js";
import { getTokensForUser } from "../services/supabase.js";
import {
  postToInstagram,
  postImageToInstagram,
  postCarouselToInstagram,
  postStoryToInstagram,
} from "../services/instagram.js";
import { postToYouTube, setVideoThumbnail } from "../services/youtube.js";
import { postToPinterest } from "../services/pinterest.js";
import { postFacebookReel, postFacebookStory, postToFacebook, postVideoToFacebook } from "../services/facebook.js";
import { postToBluesky } from "../services/bluesky.js";
import { postToLinkedIn } from "../services/linkedin.js";
import mastodon from "../services/mastodon.js";

import { postToThreads } from "../services/threads.js";
import { broadcastToX } from "../services/x.js";
import { postToReddit } from "../services/reddit.js";
import { authenticateUser } from "../middleware/authenticateUser.js";
import { assertScheduledQueueCapacity, saveBroadcast } from "../services/broadcasts.js";
import {
  uploadToCloudinary,
  isCloudinaryConfigured,
} from "../services/cloudinary.js";
import googleOAuth from "../services/googleOAuth.js";
import googleBusinessOAuth from "../services/googleBusinessOAuth.js";
import { postToGoogleBusiness } from "../services/googleBusiness.js";
import blueskyAuth from "../services/blueskyAuth.js";
import { createJob, updateJob, failJob, getJob } from "../services/jobQueue.js";
import fs from "fs";
import { resolveMentions } from "../services/mentions.js";
import { createOrUpdateComposerAutomation } from "../services/autodm.js";
import { getValidInstagramTokensForPosting } from "../services/instagramToken.js";
import { decryptToken } from "../services/instapilot.js";
import { enqueueBroadcastJob, isBroadcastQueueEnabled } from "../services/broadcastQueue.js";
import { requireFeature, reserveUsage } from "../middleware/entitlements.js";
import { supermailbox } from "../services/supermailbox.js";
import { resolveInstagramPublishChannels } from "../utils/instagramChannels.js";
import { resolvePublishPostType } from "../utils/postType.js";
import { resolveSocialPublishChannels, setAggregateResult } from "../utils/socialChannels.js";

const router = express.Router();

/**
 * POST /api/broadcast
 * Accepts media files + metadata, creates an async job, responds immediately.
 * The actual upload & publishing runs in the background.
 * @protected Requires authentication
 */
router.post(
  "/broadcast",
  authenticateUser,
  requireFeature("publishing"),
  (req, res, next) => {
    upload.fields([
      { name: "media", maxCount: 10 },
      { name: "youtubeThumbnail", maxCount: 1 },
    ])(req, res, (err) => {
      if (err) return handleUploadError(err, req, res, next);
      next();
    });
  },
  (req, res, next) => {
    if (!req.files || (!req.files.media && !req.files.youtubeThumbnail)) {
      return res.status(400).json({ success: false, error: "No media files uploaded" });
    }
    next();
  },
  async (req, res) => {
    console.log("📥 [BROADCAST] Sync job request received");

    try {
      // ── Validate request ──────────────────────────────────────────────────
    const { 
      caption, 
      selectedChannels, 
      platformData, 
      platformPresets,
      scheduledAt, 
      isScheduled: isScheduledField, 
      userTimezone,
      selectedAspectRatio = '1:1',
      selectedPostSizePreset,
      postType = 'post',
      autoDMConfig: autoDMConfigField,
    } = req.body;
    
    const userId = req.user.userId;

      const channels =
        typeof selectedChannels === "string"
          ? JSON.parse(selectedChannels)
          : selectedChannels;
      if (!Array.isArray(channels) || channels.length === 0) {
        return res.status(400).json({ success: false, error: "Please select at least one platform." });
      }
      const platData =
        typeof platformData === "string"
          ? JSON.parse(platformData)
          : platformData;
      const parsedPresets =
        typeof platformPresets === "string"
          ? JSON.parse(platformPresets)
          : platformPresets || {};
            
      // Save the chosen format presets to platformData so it persists in the database
      platData.parsedPresets = parsedPresets;
      platData.selectedPostSizePreset = selectedPostSizePreset;
      const hasInstagramChannel = (channels || []).some((channel) =>
        channel === "instagram" || String(channel).startsWith("instagram:")
      );
      const selectedPostType = resolvePublishPostType({
        hasInstagramChannel,
        postType,
        platformData: platData,
      });
      console.log("🚨 [DEBUG] Evaluated Post Type:", selectedPostType, "| Raw body postType:", postType, "| platData:", JSON.stringify(platData));
      if (hasInstagramChannel) {
        platData.instagram = { ...(platData.instagram || {}), type: selectedPostType };
      }
      platData.postType = selectedPostType;
        
      const isScheduled = isScheduledField === "true" || !!scheduledAt;
      const autoDMConfig =
        typeof autoDMConfigField === "string"
          ? JSON.parse(autoDMConfigField)
          : autoDMConfigField;
      const canUseAutoDM = selectedPostType !== "story";

    // ── Validate scheduled time ───────────────────────────────────────────
    if (isScheduled && scheduledAt) {
      const schedTime = new Date(scheduledAt).getTime();
      const minAllowed = Date.now() + 2 * 60 * 1000; // 2-minute buffer
      if (isNaN(schedTime)) {
        return res.status(400).json({ success: false, error: 'Invalid scheduledAt date format.' });
      }
      if (schedTime < minAllowed) {
        return res.status(400).json({ success: false, error: 'Scheduled time must be at least 2 minutes in the future.' });
      }
    }

    const uploadedFiles = req.files['media'] || [];
    const thumbnailFile = req.files['youtubeThumbnail'] ? req.files['youtubeThumbnail'][0] : null;

      const filePaths = uploadedFiles.map((f) => f.path);
      const filenames = uploadedFiles.map((f) => f.filename);

      if (isScheduled) {
        try {
          await assertScheduledQueueCapacity(
            userId,
            channels,
            req.entitlements?.limits?.scheduled_queue,
          );
        } catch (queueError) {
          cleanupFiles(filePaths, thumbnailFile);
          return res.status(queueError.code === 'PLAN_LIMIT_REACHED' ? 403 : 500).json({
            success: false,
            error: queueError.message,
            code: queueError.code || 'QUEUE_CAPACITY_CHECK_FAILED',
            metric: queueError.metric,
          });
        }
      }

      // ── Detect media type ─────────────────────────────────────────────────
      const videos = uploadedFiles.filter((f) =>
        f.mimetype.startsWith("video/"),
      );
      const isVideo = videos.length > 0;
      const mediaType = isVideo ? "video" : "image";
      const primaryVideoPath = videos.length > 0 ? videos[0].path : null;
      const primaryInputPath = uploadedFiles.length > 0 ? uploadedFiles[0].path : null;

      if (selectedPostType === "reel" && !isVideo) {
        cleanupFiles(filePaths, thumbnailFile);
        return res.status(400).json({ success: false, error: "Reels require a video file." });
      }
      if (selectedPostType === "story" && uploadedFiles.length > 1) {
        cleanupFiles(filePaths, thumbnailFile);
        return res.status(400).json({ success: false, error: "Stories support one image or video at a time." });
      }

    // ── Detect Job ID early for variants ─────────────────────────────────
    const jobId = createJob(userId, {
      caption,
      channels,
      mediaType,
      postType: selectedPostType,
      filenames,
      fileCount: uploadedFiles.length,
      hasThumbnail: !!thumbnailFile,
      isScheduled,
      scheduledAt,
      selectedAspectRatio,
      selectedPostSizePreset,
      autoDMEnabled: Boolean(autoDMConfig?.enabled),
    });

    let platformVariants = {};
    let generatedVariantPaths = [];

    console.log(`🚀 Broadcast job queued. Type: ${mediaType}, User: ${userId}, Scheduled: ${isScheduled ? scheduledAt : 'Immediate'}`);

    // ── Respond immediately — UI unblocked ────────────────────────────────
    res.status(202).json({ success: true, jobId });

    // ── Background processing (fire-and-forget) ───────────────────────────
    processBroadcastJob({
      jobId,
      userId,
      user: req.user,
      caption,
      channels,
      platData,
      uploadedFiles,
      filePaths,
      filenames,
      thumbnailFile,
      isVideo,
      mediaType,
      postType: selectedPostType,
      primaryVideoPath,
      platformVariants,
      generatedVariantPaths,
      selectedAspectRatio,
      selectedPostSizePreset,
      parsedPresets,
      isScheduled,
      scheduledAt,
      userTimezone,
      autoDMConfig
    }).catch(err => {
      console.error(`❌ [BROADCAST_JOB] Unhandled error in job ${jobId}:`, err);
      failJob(jobId, err.message || 'Unknown error');
    });

  } catch (error) {
    console.error('❌ [BROADCAST] Failed to create job:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: 'Failed to queue broadcast job',
        message: error.message
      });
    }
  }
});

// ── Background Worker ──────────────────────────────────────────────────────

/**
 * The actual broadcast processing logic, now running asynchronously.
 * Updates job progress as it advances through each phase.
 */
async function processBroadcastJob({
  jobId, userId, user, caption, channels, platData,
  uploadedFiles, filePaths, filenames,
  thumbnailFile, isVideo, mediaType, postType, primaryVideoPath,
  platformVariants, generatedVariantPaths,
  selectedAspectRatio, selectedPostSizePreset, parsedPresets,
  isScheduled, scheduledAt, userTimezone, autoDMConfig
}) {
  console.log(
    `\n🚀 [JOB:${jobId}] Starting background broadcast for user: ${userId}`,
  );
  const canUseAutoDM = postType !== "story";

  // ── Phase 1: Uploading to cloud (0 → 30%) ──────────────────────────────
  updateJob(jobId, {
    status: "processing",
    progress: 5,
    step: "Uploading to cloud storage…",
  });

  let mediaUrls = [];
  let finalThumbnailUrl = null;
  let autoCoverImageUrl = null;

  try {
    const nonYoutubeChannels = (channels || []).filter((c) => !String(c).startsWith("youtube"));
    const needsCloudinary = isScheduled || nonYoutubeChannels.length > 0;

    if (isCloudinaryConfigured() && needsCloudinary) {
      console.log(
        `☁️  [JOB:${jobId}] Uploading ${uploadedFiles.length} file(s) to Cloudinary...`,
      );

      const uploadPromises = filePaths.map((p, i) => {
        const mime = uploadedFiles[i]?.mimetype || '';
        const fileResourceType = mime.startsWith('video/') ? 'video' : 'image';
        
        return uploadToCloudinary(p, fileResourceType, (prog) => {
          const maxPhaseProgress = 25; // Phase 1 is roughly 5% -> 30%
          const perFileWeight = maxPhaseProgress / filePaths.length;
          
          let currentProgress = 5 + (i * perFileWeight);
          if (prog.phase === 'compressing') {
            // Compression is part of the per-file work
            currentProgress += (prog.percent / 100) * perFileWeight * 0.8;
          }

          updateJob(jobId, {
            progress: Math.floor(currentProgress),
            step: prog.phase === 'compressing' 
              ? `Compressing file ${i + 1} of ${filePaths.length} (${prog.percent}%)…`
              : `Uploading file ${i + 1} of ${filePaths.length}…`,
          });
          }).then((r) => {
            // Convert Cloudinary URL to request MP4 conversion for animated GIFs
            if (mime === 'image/gif') {
              r.url = r.url.replace(/\.gif$/i, '.mp4');
            }
            // Update progress incrementally as each file finishes
            updateJob(jobId, {
              progress: 5 + (i + 1) * Math.floor(25 / filePaths.length),
              step: `Uploading file ${i + 1} of ${filePaths.length}…`,
            });
            return r;
          });
      });

      const uploadResults = await Promise.all(uploadPromises);
      mediaUrls = uploadResults.map((r) => r.url);
      
      // Calculate optimal Instagram Aspect Ratio
      let targetAr = null;
      if (parsedPresets['instagram']) {
        const presetId = parsedPresets['instagram'];
        if (presetId.includes('square')) targetAr = 1.0;
        else if (presetId.includes('portrait')) targetAr = 0.8;
        else if (presetId.includes('reel') || presetId.includes('story')) targetAr = 0.5625;
        else if (presetId.includes('landscape')) targetAr = 1.7778;
      }
      
      // If no preset selected, fallback to dynamic calculation from first item (only for carousels)
      if (!targetAr && mediaUrls.length > 1 && uploadResults[0] && uploadResults[0].width && uploadResults[0].height) {
         targetAr = uploadResults[0].width / uploadResults[0].height;
         // Clamp to Instagram's allowed range for carousels (4:5 to 1.91:1) -> 0.8 to 1.91
         if (targetAr < 0.8) targetAr = 0.8;
         if (targetAr > 1.91) targetAr = 1.91;
      }
      
      if (targetAr) {
         platData.instagramAspectRatio = targetAr.toFixed(4);
      }

      // Auto cover: first image in set
      const firstImageIdx = uploadedFiles.findIndex((f) =>
        f.mimetype.startsWith("image/"),
      );
      if (firstImageIdx !== -1) {
        autoCoverImageUrl = mediaUrls[firstImageIdx];
      }

      // Thumbnail logic
      finalThumbnailUrl = autoCoverImageUrl;
      if (thumbnailFile && isCloudinaryConfigured()) {
        updateJob(jobId, { step: "Uploading thumbnail…", progress: 28 });
        const thumbUpload = await uploadToCloudinary(
          thumbnailFile.path,
          "image",
        );
        finalThumbnailUrl = thumbUpload.url;
      } else if (mediaType === "video" && !finalThumbnailUrl && mediaUrls[0]) {
        finalThumbnailUrl = mediaUrls[0].replace(/\.[^/.]+$/, ".jpg");
        console.log(
          `🎬 [JOB:${jobId}] Generated auto-thumbnail for video:`,
          finalThumbnailUrl,
        );
      }

      updateJob(jobId, {
        progress: 30,
        step: isScheduled
          ? "Media ready. Scheduling..."
          : "Cloud upload complete. Publishing...",
        meta: {
          ...(getJob(jobId)?.meta || {}),
          previewUrl: finalThumbnailUrl || mediaUrls[0] || null,
        },
      });

      console.log(`✓ [JOB:${jobId}] All files uploaded. URLs:`, mediaUrls);
    } else if (isCloudinaryConfigured() && !needsCloudinary) {
      console.log(`⚡ [JOB:${jobId}] Direct YouTube route: Bypassing Cloudinary video upload for immediate publishing.`);
      const serverPublicUrl = process.env.SERVER_PUBLIC_URL || "http://localhost:5000";
      mediaUrls = filenames.map((name) => `${serverPublicUrl}/uploads/${name}`);

      if (thumbnailFile) {
        updateJob(jobId, { step: "Uploading custom thumbnail…", progress: 28 });
        const thumbUpload = await uploadToCloudinary(thumbnailFile.path, "image");
        finalThumbnailUrl = thumbUpload.url;
      }

      updateJob(jobId, {
        progress: 30,
        step: "Direct streaming to YouTube…",
        meta: {
          ...(getJob(jobId)?.meta || {}),
          previewUrl: finalThumbnailUrl || null,
        },
      });
    } else {
      // Fallback to local URLs if No Cloudinary
      const serverPublicUrl =
        process.env.SERVER_PUBLIC_URL || "http://localhost:5000";
      mediaUrls = filenames.map((name) => `${serverPublicUrl}/uploads/${name}`);
      const firstImageIdx = uploadedFiles.findIndex((f) =>
        f.mimetype.startsWith("image/"),
      );
      if (firstImageIdx !== -1) autoCoverImageUrl = mediaUrls[firstImageIdx];
      finalThumbnailUrl = autoCoverImageUrl;
      updateJob(jobId, { progress: 30, step: "Publishing to platforms…" });
    }
  } catch (uploadErr) {
    console.error(`❌ [JOB:${jobId}] Cloud upload failed:`, uploadErr.message);
    failJob(jobId, `Cloud upload failed: ${uploadErr.message}`);
    cleanupFiles(filePaths, thumbnailFile);
    return;
  }

  // ── Phase 2: Decision - Schedule or Broadcast ───────────────────────────
  if (isScheduled) {
    updateJob(jobId, { progress: 80, step: "Saving schedule to database…" });
    try {
      await saveBroadcast(
        userId, 
        caption, 
        filenames, 
        { mediaUrls, thumbnailUrl: finalThumbnailUrl }, 
        mediaType, 
        { 
          ...platData, 
          sourceJobId: jobId,
          source_job_id: jobId,
          postType,
          autoDMConfig: canUseAutoDM && autoDMConfig?.enabled ? autoDMConfig : null,
          selectedChannels: channels, 
          filePaths, 
          userTimezone: userTimezone || 'UTC',
          selectedAspectRatio,
          selectedPostSizePreset
        }, // Store filePaths for scheduler
        'scheduled', 
        scheduledAt
      );

      updateJob(jobId, {
        status: "completed",
        progress: 100,
        step: `Post scheduled for ${new Date(scheduledAt).toLocaleString()}!`,
      });
      console.log(`📅 [JOB:${jobId}] Broadcast successfully scheduled. Cleaning up local files to save space.`);
      if (isCloudinaryConfigured()) {
        cleanupFiles(filePaths, thumbnailFile);
      }
      return;
    } catch (dbErr) {
      failJob(jobId, `Scheduling failed: ${dbErr.message}`);
      cleanupFiles(filePaths, thumbnailFile);
      return;
    }
  }

  // ── Phase 3: Immediate Broadcast (Platform APIs) ────────────────────────
  if (isBroadcastQueueEnabled()) {
    updateJob(jobId, { progress: 80, step: "Queueing broadcast worker..." });
    try {
      const savedBroadcast = await saveBroadcast(
        userId,
        caption,
        filenames,
        { mediaUrls, thumbnailUrl: finalThumbnailUrl },
        mediaType,
        {
          ...platData,
          sourceJobId: jobId,
          source_job_id: jobId,
          postType,
          autoDMConfig: canUseAutoDM && autoDMConfig?.enabled ? autoDMConfig : null,
          selectedChannels: channels,
          filePaths,
          userTimezone: userTimezone || 'UTC',
          selectedAspectRatio,
          selectedPostSizePreset
        },
        'queued',
        new Date().toISOString()
      );

      if (!savedBroadcast?.id) {
        throw new Error('Failed to save queued broadcast record');
      }

      await enqueueBroadcastJob(savedBroadcast.id);
      if (isCloudinaryConfigured()) {
        cleanupFiles(filePaths, thumbnailFile);
      }
      updateJob(jobId, {
        status: "completed",
        progress: 100,
        step: "Broadcast queued for publishing.",
        meta: {
          ...(getJob(jobId)?.meta || {}),
          broadcastId: savedBroadcast.id,
          queued: true,
        },
      });
      console.log(`📨 [JOB:${jobId}] Broadcast queued in BullMQ: ${savedBroadcast.id}`);
      return;
    } catch (queueErr) {
      console.error(`❌ [JOB:${jobId}] Queue handoff failed:`, queueErr.message);
      failJob(jobId, `Queue handoff failed: ${queueErr.message}`);
      return;
    }
  }

  const primaryMediaUrl = mediaUrls[0];
  const youtubeThumbnailPath = thumbnailFile
    ? thumbnailFile.path
    : uploadedFiles.findIndex((f) => f.mimetype.startsWith("image/")) !== -1
      ? filePaths[
          uploadedFiles.findIndex((f) => f.mimetype.startsWith("image/"))
        ]
      : null;

  let tokens;
  try {
    tokens = await getTokensForUser(userId);
  } catch (tokenErr) {
    failJob(jobId, `Failed to fetch tokens: ${tokenErr.message}`);
    cleanupFiles(filePaths, thumbnailFile, generatedVariantPaths);
    return;
  }

  const results = {
    mediaUrl: primaryMediaUrl,
    mediaUrls,
    thumbnailUrl: finalThumbnailUrl,
  };

  let platformPromises = [];
  const selectedChannelCount = channels.length;
  let completedChannels = 0;

  const onChannelComplete = (platform, result) => {
    completedChannels++;
    const pct =
      30 + Math.floor((completedChannels / selectedChannelCount) * 55);
    updateJob(jobId, {
      progress: Math.min(pct, 85),
      step: `Published to ${platform}… (${completedChannels}/${selectedChannelCount})`,
    });
    return { platform, result };
  };

  for (const account of resolveSocialPublishChannels("pinterest", channels, tokens.pinterestAccounts || [])) {
    const resolvedCaption = resolveMentions(platData?.pinterest?.title || caption, 'pinterest', account);
    const targetAccountId = account.accountId || account.account_id || account.id;
    platformPromises.push(
      (async () => {
        try {
          const validTokenInfo = await pinterestOAuth.getValidAccessToken(req.user.userId, targetAccountId);
          const activeAccount = {
            ...account,
            accessToken: validTokenInfo.accessToken,
            boardId: platData?.pinterest?.boardId || validTokenInfo.boardId || account.boardId
          };
          const result = await postToPinterest(
            primaryMediaUrl,
            resolvedCaption,
            activeAccount,
            platData?.pinterest?.link,
            activeAccount.boardId,
            broadcastId || null
          );
          onChannelComplete(account.channel, result);
          return result;
        } catch (err) {
          const errRes = { success: false, platform: 'Pinterest', error: err.message };
          onChannelComplete(account.channel, errRes);
          return errRes;
        }
      })()
    );
  }

  // Instagram
  const instagramChannels = resolveInstagramPublishChannels(channels, tokens.instagramAccounts || []);
  if (instagramChannels.length > 0 && (tokens.instagram || tokens.instagramAccounts?.length > 0)) {
    const postedBusinessIds = new Set();
    
    for (const igChannel of instagramChannels) {
      let currentTokens;
      let platformKey = igChannel;
      
      if (igChannel === "instagram") {
        currentTokens = tokens.instagram;
      } else {
        const accountId = igChannel.split(":")[1];
        const igAccount = tokens.instagramAccounts?.find(acc => acc.id === accountId);
        if (igAccount && igAccount.access_token_encrypted) {
          try {
            const decrypted = decryptToken(igAccount.access_token_encrypted);
            currentTokens = {
              accessToken: decrypted.pageAccessToken || decrypted.userAccessToken,
              businessId: igAccount.instagram_business_account_id,
              pageId: igAccount.page_id,
              tokenExpiry: igAccount.token_expires_at,
              username: igAccount.instagram_username
            };
          } catch (err) {
            console.error(`Failed to decrypt token for IG account ${accountId}:`, err);
          }
        }
      }

      if (currentTokens) {
        if (currentTokens.businessId) {
          if (postedBusinessIds.has(currentTokens.businessId)) continue;
          postedBusinessIds.add(currentTokens.businessId);
        }
        platformPromises.push(
          (async () => {
            try {
              const instagramTokens = await getValidInstagramTokensForPosting(userId, currentTokens);
              // We don't overwrite tokens.instagram here because there might be multiple
              const resolvedCaption = resolveMentions(caption, 'instagram', instagramTokens);
              let result;
              if (postType === "story") {
                const storyUrl = isVideo
                  ? mediaUrls[uploadedFiles.findIndex((f) => f.mimetype?.startsWith("video/"))] || primaryMediaUrl
                  : primaryMediaUrl;
                result = await postStoryToInstagram(storyUrl, resolvedCaption, instagramTokens, mediaType, isVideo ? (pct) => {
                  const base = 30 + Math.floor((completedChannels / selectedChannelCount) * 55);
                  const slice = Math.floor((1 / selectedChannelCount) * 55);
                  const currentPct = base + Math.floor((pct / 100) * slice);
                  updateJob(jobId, {
                    progress: Math.min(currentPct, 85),
                    step: `Processing story on Instagram (${pct}%).`,
                  });
                } : null, platData.instagramAspectRatio);
              } else if (mediaUrls.length > 1) {
                result = await postCarouselToInstagram(mediaUrls, resolvedCaption, instagramTokens, platData.instagramAspectRatio);
              } else if (isVideo) {
                const igTokens = { ...instagramTokens, coverUrl: autoCoverImageUrl };
                result = await postToInstagram(primaryMediaUrl, resolvedCaption, igTokens, (pct) => {
                  const base = 30 + Math.floor((completedChannels / selectedChannelCount) * 55);
                  const slice = Math.floor((1 / selectedChannelCount) * 55);
                  const currentPct = base + Math.floor((pct / 100) * slice);
                  updateJob(jobId, {
                    progress: Math.min(currentPct, 85),
                    step: `Processing video on Instagram (${pct}%).`,
                  });
                }, platData.instagramAspectRatio);
              } else {
                result = await postImageToInstagram(primaryMediaUrl, resolvedCaption, instagramTokens, platData.instagramAspectRatio);
              }
              return onChannelComplete(platformKey, result);
            } catch (error) {
              return onChannelComplete(platformKey, {
                success: false,
                platform: platformKey,
                error: error.message || "Instagram token expired. Please reconnect Instagram.",
                errorCode: error.code || error.statusCode || null,
                requiresReconnect: Boolean(error.requiresReconnect || error.code === "REAUTH_REQUIRED"),
              });
            }
          })(),
        );
      }
    }
  }

  for (const account of resolveSocialPublishChannels("facebook", channels, tokens.facebookAccounts || [])) {
    const resolvedCaption = resolveMentions(caption, 'facebook', account);
    const facebookVideoUrl = mediaUrls[uploadedFiles.findIndex((f) => f.mimetype?.startsWith("video/"))] || primaryMediaUrl;
    const fbAction = postType === "story"
      ? postFacebookStory(
          account.accessToken,
          account.pageId,
          resolvedCaption,
          isVideo ? facebookVideoUrl : primaryMediaUrl,
          mediaType,
        )
      : postType === "reel"
        ? postFacebookReel(
            account.accessToken,
            account.pageId,
            resolvedCaption,
            facebookVideoUrl,
          )
        : isVideo
          ? postVideoToFacebook(
              account.accessToken,
              account.pageId,
              resolvedCaption,
              primaryMediaUrl,
              autoCoverImageUrl,
            )
          : postToFacebook(
              account.accessToken,
              account.pageId,
              resolvedCaption,
              mediaUrls,
            );
    platformPromises.push(
      fbAction.then((r) => onChannelComplete(account.channel, r)),
    );
  }

  for (const account of resolveSocialPublishChannels("linkedin", channels, tokens.linkedinAccounts || [])) {
    const resolvedCaption = resolveMentions(caption, 'linkedin', account);
    platformPromises.push(
      postToLinkedIn(mediaUrls, resolvedCaption, account).then((r) =>
        onChannelComplete(account.channel, r),
      ),
    );
  }

  for (const account of resolveSocialPublishChannels("bluesky", channels, tokens.blueskyAccounts || [])) {
    const bskyTokens = { ...account };
    let canPostToBluesky = true;
    // Refresh the Bluesky session — access tokens expire every ~2 hours
    try {
      const refreshed = await blueskyAuth.refreshSession(bskyTokens.refreshToken);
      bskyTokens.accessToken = refreshed.accessJwt;
      bskyTokens.refreshToken = refreshed.refreshJwt;
      await blueskyAuth.storeCredentials(userId, {
        accessJwt: refreshed.accessJwt,
        refreshJwt: refreshed.refreshJwt,
        did: bskyTokens.did,
        handle: bskyTokens.handle,
      });
      console.log(`✅ [JOB:${jobId}] Bluesky token refreshed`);
    } catch (refreshErr) {
      console.warn(`⚠️ [JOB:${jobId}] Bluesky token refresh failed, using stored token:`, refreshErr.message);
      const hasValidStoredSession = bskyTokens.accessToken
        ? await blueskyAuth.verifyCredentials(bskyTokens.accessToken)
        : false;

      if (!hasValidStoredSession) {
        canPostToBluesky = false;
        platformPromises.push(
          Promise.resolve(
            onChannelComplete(account.channel, {
              success: false,
              platform: "Bluesky",
              error:
                "Bluesky session expired. Please reconnect your Bluesky account.",
            }),
          ),
        );
      }
    }

    const resolvedCaption = resolveMentions(caption, 'bluesky', bskyTokens);
    const stats = filePaths.map((p) => {
      try {
        return fs.statSync(p).size;
      } catch {
        return 0;
      }
    });

    const totalSize = stats.reduce((a, b) => a + b, 0);
    if (canPostToBluesky && totalSize <= 30 * 1024 * 1024) {
      const blobs = filePaths
        .map((p) => {
          try {
            return fs.readFileSync(p);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      platformPromises.push(
        postToBluesky(
          bskyTokens.accessToken,
          bskyTokens.did,
          resolvedCaption,
          mediaUrls,
          blobs,
          isVideo,
        )
          .then((r) => onChannelComplete(account.channel, r))
          .catch((error) =>
            onChannelComplete(account.channel, {
              success: false,
              platform: "Bluesky",
              error: error.message || "Failed to post to Bluesky",
            }),
          ),
      );
    } else if (!canPostToBluesky) {
      console.warn(
        `⚠️ [JOB:${jobId}] Bluesky skipped because the stored session is no longer valid.`,
      );
    } else {
      console.warn(`⚠️ [JOB:${jobId}] Media too large for Bluesky, skipping.`);
    }
  }

  for (const account of resolveSocialPublishChannels("x", channels, tokens.xAccounts || [])) {
    const resolvedCaption = resolveMentions(caption, 'x', account);
    platformPromises.push(
      broadcastToX(resolvedCaption, mediaUrls, account, userId)
        .then((r) => (typeof r === "object" ? r : { success: true, result: r })) // ensure object response
        .then((r) => onChannelComplete(account.channel, r)),
    );
  }

  // YouTube
  for (const account of resolveSocialPublishChannels("youtube", channels, tokens.youtubeAccounts || [])) {
    if (!isVideo || !primaryVideoPath) continue;
    platformPromises.push(
      (async () => {
        try {
          const validAccessToken = await googleOAuth.getValidAccessToken(userId, account.id);
          const ytTokens = { ...account, accessToken: validAccessToken };
          const resolvedCaption = resolveMentions(caption, 'youtube', ytTokens);
          updateJob(jobId, { step: "Uploading video to YouTube…" });
          const visibility = platData?.youtube?.visibility || "public";
          const isShort = (platData?.youtube?.type === "short");
          const description = platData?.youtube?.description || "";
          const result = await postToYouTube(primaryVideoPath, resolvedCaption, ytTokens, (pct) => {
            const base = 30 + Math.floor((completedChannels / selectedChannelCount) * 55);
            const slice = Math.floor((1 / selectedChannelCount) * 55);
            const currentPct = base + Math.floor((pct / 100) * slice);
            updateJob(jobId, {
              progress: Math.min(currentPct, 85),
              step: `Uploading video to YouTube (${pct}%)…`,
            });
          }, visibility, isShort, description);

          if (result.success && result.videoId && youtubeThumbnailPath) {
            const thumbResult = await setVideoThumbnail(
              result.videoId,
              youtubeThumbnailPath,
              ytTokens,
            );
            result.thumbnailSuccess = thumbResult.success;
          }
          return onChannelComplete(account.channel, {
            ...result,
            accountId: account.id,
            channelId: account.accountId || account.account_id,
            username: account.username,
            profilePicture: account.profilePicture || account.profile_picture,
          });
        } catch (error) {
          return onChannelComplete(account.channel, {
            success: false,
            platform: "YouTube",
            accountId: account.id,
            channelId: account.accountId || account.account_id,
            username: account.username,
            profilePicture: account.profilePicture || account.profile_picture,
            error: error.message || "Failed to upload to YouTube",
          });
        }
      })(),
    );
  }

  // TikTok, Mastodon, Reddit, Threads...

  for (const account of resolveSocialPublishChannels("mastodon", channels, tokens.mastodonAccounts || [])) {
    const resolvedCaption = resolveMentions(caption, 'mastodon', account);
    platformPromises.push(
      mastodon
        .postStatus(
          account.accessToken,
          account.instanceUrl,
          resolvedCaption,
          filePaths,
        )
        .then((r) => onChannelComplete(account.channel, r)),
    );
  }
  for (const account of resolveSocialPublishChannels("reddit", channels, tokens.redditAccounts || [])) {
    const resolvedCaption = resolveMentions(caption, 'reddit', account);
    platformPromises.push(
      postToReddit(
        userId,
        resolvedCaption,
        primaryMediaUrl,
        account,
        platData?.reddit,
      ).then((r) => onChannelComplete(account.channel, r)),
    );
  }
  for (const account of resolveSocialPublishChannels("googleBusiness", channels, tokens.googleBusinessAccounts || [])) {
    const resolvedCaption = resolveMentions(caption, 'googleBusiness', account);
    platformPromises.push(
      (async () => {
        let gbpTokens = account;
        try {
          const freshAccessToken = await googleBusinessOAuth.getValidAccessToken(userId, account.id);
          gbpTokens = { ...account, accessToken: freshAccessToken };
        } catch (tokenErr) {
          console.warn(`Warning: could not refresh Google Business token: ${tokenErr.message}. Using stored token.`);
        }
        return postToGoogleBusiness(resolvedCaption, mediaUrls, gbpTokens, platData?.googleBusiness);
      })().then((r) => onChannelComplete(account.channel, r)),
    );
  }
  for (const account of resolveSocialPublishChannels("threads", channels, tokens.threadsAccounts || [])) {
    const resolvedCaption = resolveMentions(caption, 'threads', account);
    // Build mediaItems with per-file type for carousel support
    const threadsMediaItems = mediaUrls.map((url, idx) => ({
      url,
      type: uploadedFiles[idx]?.mimetype?.startsWith('video/') ? 'video' : 'image',
    }));
    platformPromises.push(
      postToThreads(
        account.accessToken,
        account.account_id,
        resolvedCaption,
        mediaUrls[0],
        mediaType,
        threadsMediaItems,
      ).then((r) => onChannelComplete(account.channel, r)),
    );
  }

  updateJob(jobId, {
    progress: 31,
    step: `Publishing to ${selectedChannelCount} platform(s)…`,
  });
  if (platformPromises.length === 0) {
    const message = "No publishable platforms were resolved. Reconnect/select the target account and try again.";
    failJob(jobId, message);
    await saveBroadcast(userId, caption, filenames, results, mediaType, {
      ...platData,
      sourceJobId: jobId,
      source_job_id: jobId,
      postType,
      selectedChannels: channels,
      selected_aspect_ratio: selectedAspectRatio,
      selected_post_size_preset: selectedPostSizePreset,
    }, 'failed');
    return;
  }

  const platformResults = await Promise.allSettled(platformPromises);

  const failedPlatforms = [];
  for (const promiseResult of platformResults) {
    if (promiseResult.status === "fulfilled") {
      const { platform, result } = promiseResult.value;
      const resultKey = String(platform).includes(":") ? platform : String(platform).toLowerCase();
      results[resultKey] = result;
      if (result && result.success === false) {
        failedPlatforms.push({
          platform,
          error: result.error || "Unknown error",
          errorCode: result.errorCode || null,
          requiresReconnect: Boolean(result.requiresReconnect),
        });
        console.error(`❌ [JOB:${jobId}] ${platform} failed:`, result.error);
      }
    } else {
      // Promise rejected — extract platform name from reason if possible
      console.error(`❌ [JOB:${jobId}] Platform promise rejected:`, promiseResult.reason);
      failedPlatforms.push({
        platform: "Unknown",
        error: promiseResult.reason?.message || String(promiseResult.reason),
        errorCode: promiseResult.reason?.code || null,
        requiresReconnect: Boolean(promiseResult.reason?.requiresReconnect),
      });
    }
  }

  const instagramResults = Object.entries(results)
    .filter(([platform]) => platform === "instagram" || platform.startsWith("instagram:"))
    .map(([, result]) => result);
  if (instagramResults.length > 0) {
    results.instagram = instagramResults.find((result) => result?.success) || instagramResults[0];
    results.instagramAccounts = instagramResults;
  }
  for (const provider of ['facebook', 'youtube', 'pinterest', 'bluesky', 'linkedin', 'mastodon', 'threads', 'x', 'reddit', 'googleBusiness']) {
    setAggregateResult(results, provider);
  }

  const hasPlatformFailures = failedPlatforms.length > 0;

  // ── Phase 4: Save to DB (85 → 95%) ────────────────────────────────────
  updateJob(jobId, { progress: 87, step: "Saving broadcast record…" });
  try {
    const savedBroadcast = await saveBroadcast(userId, caption, filenames, results, mediaType, {
      ...platData,
      sourceJobId: jobId,
      source_job_id: jobId,
      postType,
      selectedChannels: channels,
      autoDMConfig: canUseAutoDM && autoDMConfig?.enabled ? autoDMConfig : null,
      selected_aspect_ratio: selectedAspectRatio,
      selected_post_size_preset: selectedPostSizePreset
    }, hasPlatformFailures ? 'failed' : 'sent');
    if (canUseAutoDM && autoDMConfig?.enabled && results.instagram?.success) {
      try {
        await createOrUpdateComposerAutomation({
          user,
          config: autoDMConfig,
          publication: {
            success: true,
            mediaId: results.instagram.mediaId,
            permalink: results.instagram.url || results.instagram.permalink,
            mediaUrl: primaryMediaUrl,
            thumbnailUrl: finalThumbnailUrl,
            mediaType,
          },
          sourceBroadcastId: savedBroadcast?.id || null,
          sourceJobId: jobId,
        });
        updateJob(jobId, { progress: 94, step: "Broadcast saved and Auto DM linked." });
      } catch (autoDMError) {
        console.error(`⚠️ [JOB:${jobId}] Auto DM binding failed:`, autoDMError.message);
        updateJob(jobId, {
          step: `Broadcast saved. Auto DM linking failed: ${autoDMError.message}`,
          meta: { ...(getJob(jobId)?.meta || {}), autoDMError: autoDMError.message },
        });
      }
    }
    console.log(`✅ [JOB:${jobId}] Broadcast saved to database`);
  } catch (dbErr) {
    console.error(`⚠️ [JOB:${jobId}] DB save failed:`, dbErr.message);
  }

  // ── Phase 5: Cleanup (95 → 100%) ──────────────────────────────────────
  updateJob(jobId, { progress: 95, step: "Cleaning up…" });
  setTimeout(() => cleanupFiles(filePaths, thumbnailFile), 10000);

  const successCount = platformPromises.length - failedPlatforms.length;
  const anyFailed = hasPlatformFailures;
  const failedStr = failedPlatforms.map(f => {
    let pName = f.platform.split(':')[0];
    pName = pName.charAt(0).toUpperCase() + pName.slice(1);
    return `${pName}: ${f.error}`;
  }).join(" | ");

  const finalStatus = anyFailed ? "failed" : "completed";
  const finalStep = anyFailed ? "Some platforms failed." : "Broadcast complete!";
  const finalError = anyFailed
    ? (successCount > 0
        ? `${successCount}/${platformPromises.length} posted. Failed — ${failedStr}`
        : `Failed — ${failedStr}`)
    : null;

  updateJob(jobId, {
    status: finalStatus,
    progress: 100,
    step: finalStep,
    error: finalError,
    meta: {
      ...(getJob(jobId)?.meta || {}),
      failedPlatforms,
      requiresReconnect: failedPlatforms.some((failure) => failure.requiresReconnect),
      retryDisabled: failedPlatforms.some((failure) => failure.requiresReconnect),
    },
    result: results,
  });
  console.log(`🎉 [JOB:${jobId}] Broadcast job finished. Success: ${successCount}/${platformPromises.length}${anyFailed ? ` | Errors: ${failedStr}` : ''}`);

  // Dispatch broadcast summary email via SupermailBox
  if (user?.email) {
    supermailbox.sendEmail({
      to: user.email,
      templateKey: 'broadcast_notification',
      idempotencyKey: `broadcast_${jobId}`,
      variables: {
        campaign_name: 'Broadcast Published successfully',
        full_name: user.name || user.email,
        email: user.email,
        caption: caption?.substring(0, 100) || 'New post published',
        platforms: channels?.join(', ') || 'Connected channels'
      }
    }).catch(err => console.warn('[SupermailBox SDK] Broadcast notification email failed:', err?.message));
  }
}

function getJob_internal(jobId) {
  return getJob(jobId);
}

function cleanupFiles(filePaths, thumbnailFile) {
  try {
    filePaths?.forEach((p) => {
      if (p && fs.existsSync(p)) fs.unlinkSync(p);
    });
    if (thumbnailFile?.path && fs.existsSync(thumbnailFile.path))
      fs.unlinkSync(thumbnailFile.path);
    console.log("✅ [CLEANUP] Temp files removed.");
  } catch (err) {
    console.error("❌ [CLEANUP] Error:", err);
  }
}

export default router;
