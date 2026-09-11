import express from 'express';
import { authenticateUser } from '../middleware/authenticateUser.js';
import { getEntitlements } from '../services/entitlements.js';
import {
  getBroadcasts,
  cancelBroadcast,
  updateScheduledBroadcast,
  retryFailedBroadcast,
  getScheduledBroadcasts,
  getScheduledStats,
} from '../services/broadcasts.js';

const router = express.Router();

/**
 * @route   GET /api/broadcasts
 * @desc    Get user's broadcast history (optionally filter by status)
 * @access  Protected
 * @query   status - optional: 'sent' | 'scheduled' | 'failed' | 'cancelled' | 'processing'
 */
router.get('/broadcasts', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status } = req.query;

    const entitlements = await getEntitlements(req.user.authUserId || userId);
    let broadcasts = await getBroadcasts(
      userId,
      status || null,
      entitlements.limits.history_days,
    );

    // ── Live YouTube API Post Sync ──
    try {
      const { getConnectedAccounts } = await import('../services/supabase.js');
      const googleOAuth = (await import('../services/googleOAuth.js')).default;
      const connected = await getConnectedAccounts(req.user);
      const ytAccounts = connected?.youtubeAccounts || [];

      for (const account of ytAccounts) {
        try {
          const accessToken = await googleOAuth.getValidAccessToken(userId, account.id);
          const health = await googleOAuth.getChannelHealth(accessToken);
          if (health?.uploadsPlaylistId) {
            const liveVideos = await googleOAuth.listChannelUploads(accessToken, health.uploadsPlaylistId, 20);
            
            // Map live YouTube videos into normalized broadcast posts
            const livePosts = liveVideos.map((video) => ({
              id: `yt_live_${video.id}`,
              user_id: userId,
              caption: video.title + (video.description ? `\n\n${video.description}` : ''),
              media_type: 'video',
              media_url: video.url,
              thumbnail_url: video.thumbnail,
              status: 'sent',
              posted_at: video.publishedAt,
              created_at: video.publishedAt,
              selected_channels: [`youtube:${account.id}`, 'youtube'],
              youtube_success: true,
              youtube_video_id: video.id,
              youtube_url: video.url,
              youtube_views: video.views,
              youtube_comments: video.comments,
              youtube_likes: video.likes,
              metrics: {
                views: video.views,
                comments: video.comments,
                likes: video.likes,
              },
              platform_data: {
                youtube: {
                  videoId: video.id,
                  url: video.url,
                  views: video.views,
                  comments: video.comments,
                  likes: video.likes,
                }
              }
            }));

            // Merge live posts, deduplicating with existing broadcasts by video ID or URL
            const existingVideoIds = new Set(broadcasts.map(b => b.youtube_video_id).filter(Boolean));
            const newLive = livePosts.filter(p => !existingVideoIds.has(p.youtube_video_id));

            // Enrich existing broadcasts with fresh live YouTube metrics & thumbnails
            broadcasts = broadcasts.map(b => {
              if (b.youtube_video_id) {
                const liveMatch = livePosts.find(p => p.youtube_video_id === b.youtube_video_id);
                if (liveMatch) {
                  return {
                    ...b,
                    thumbnail_url: liveMatch.thumbnail_url || b.thumbnail_url,
                    caption: b.caption || liveMatch.caption,
                    youtube_views: liveMatch.youtube_views,
                    youtube_comments: liveMatch.youtube_comments,
                    youtube_likes: liveMatch.youtube_likes,
                    metrics: liveMatch.metrics,
                  };
                }
              }
              return b;
            });

            if (status !== 'scheduled') {
              broadcasts = [...newLive, ...broadcasts];
            }
          }
        } catch (ytErr) {
          console.warn(`[BROADCASTS] Could not sync live YouTube posts for account ${account.id}:`, ytErr.message);
        }
      }
    } catch (ytSyncErr) {
      console.warn('[BROADCASTS] Live YouTube sync error:', ytSyncErr.message);
    }

    // ── Live Meta API (Instagram & Facebook) Post Sync ──
    try {
      const { getConnectedAccounts } = await import('../services/supabase.js');
      const connected = await getConnectedAccounts(req.user);
      const igAccounts = connected?.instagramAccounts || [];
      const fbAccounts = connected?.facebookAccounts || [];
      const axios = (await import('axios')).default;

      // 1. Live Sync for connected Instagram accounts via Meta Graph API
      for (const account of igAccounts) {
        if (!account.id) continue;
        try {
          // Fetch token from social_tokens
          const { data: tokenRow } = await supabase
            .from('social_tokens')
            .select('access_token')
            .eq('user_id', userId)
            .eq('provider', 'instagram')
            .eq('account_id', account.id)
            .maybeSingle();

          const accessToken = tokenRow?.access_token || process.env.INSTAGRAM_ACCESS_TOKEN;
          if (accessToken) {
            const igRes = await axios.get(
              `https://graph.facebook.com/v19.0/${account.id}/media`,
              {
                params: {
                  access_token: accessToken,
                  fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count',
                  limit: 20
                }
              }
            );

            const liveIgMedia = igRes.data?.data || [];
            const liveIgPosts = liveIgMedia.map(item => ({
              id: `ig_live_${item.id}`,
              user_id: userId,
              caption: item.caption || '',
              media_type: item.media_type === 'VIDEO' ? 'video' : 'image',
              media_url: item.media_url || item.permalink,
              thumbnail_url: item.thumbnail_url || item.media_url,
              status: 'sent',
              posted_at: item.timestamp,
              created_at: item.timestamp,
              selected_channels: [`instagram:${account.id}`, 'instagram'],
              instagram_success: true,
              instagram_post_id: item.id,
              instagram_url: item.permalink,
              metrics: {
                likes: item.like_count || 0,
                comments: item.comments_count || 0,
              },
              platform_data: {
                instagram: {
                  mediaId: item.id,
                  url: item.permalink,
                  likes: item.like_count || 0,
                  comments: item.comments_count || 0,
                }
              }
            }));

            const existingIgIds = new Set(broadcasts.map(b => b.instagram_post_id).filter(Boolean));
            const newIgLive = liveIgPosts.filter(p => !existingIgIds.has(p.instagram_post_id));

            // Enrich existing broadcasts with fresh live Meta metrics & media URLs
            broadcasts = broadcasts.map(b => {
              if (b.instagram_post_id) {
                const match = liveIgPosts.find(p => p.instagram_post_id === b.instagram_post_id);
                if (match) {
                  return {
                    ...b,
                    thumbnail_url: match.thumbnail_url || b.thumbnail_url,
                    media_url: match.media_url || b.media_url,
                    caption: b.caption || match.caption,
                    metrics: match.metrics,
                  };
                }
              }
              return b;
            });

            if (status !== 'scheduled') {
              broadcasts = [...newIgLive, ...broadcasts];
            }
          }
        } catch (igErr) {
          console.warn(`[BROADCASTS] Could not sync live Instagram posts for account ${account.id}:`, igErr.message);
        }
      }

      // 2. Live Sync for connected Facebook Pages via Meta Graph API
      for (const account of fbAccounts) {
        if (!account.id) continue;
        try {
          const { data: tokenRow } = await supabase
            .from('social_tokens')
            .select('access_token')
            .eq('user_id', userId)
            .eq('provider', 'facebook')
            .eq('account_id', account.id)
            .maybeSingle();

          const accessToken = tokenRow?.access_token || process.env.FACEBOOK_ACCESS_TOKEN;
          if (accessToken) {
            const fbRes = await axios.get(
              `https://graph.facebook.com/v19.0/${account.id}/published_posts`,
              {
                params: {
                  access_token: accessToken,
                  fields: 'id,message,created_time,permalink_url,full_picture,reactions.summary(true),comments.summary(true)',
                  limit: 20
                }
              }
            );

            const liveFbPosts = (fbRes.data?.data || []).map(item => ({
              id: `fb_live_${item.id}`,
              user_id: userId,
              caption: item.message || '',
              media_type: item.full_picture ? 'image' : 'text',
              media_url: item.full_picture || null,
              thumbnail_url: item.full_picture || null,
              status: 'sent',
              posted_at: item.created_time,
              created_at: item.created_time,
              selected_channels: [`facebook:${account.id}`, 'facebook'],
              facebook_success: true,
              facebook_post_id: item.id,
              facebook_url: item.permalink_url,
              metrics: {
                reactions: item.reactions?.summary?.total_count || 0,
                comments: item.comments?.summary?.total_count || 0,
              },
              platform_data: {
                facebook: {
                  postId: item.id,
                  url: item.permalink_url,
                }
              }
            }));

            const existingFbIds = new Set(broadcasts.map(b => b.facebook_post_id).filter(Boolean));
            const newFbLive = liveFbPosts.filter(p => !existingFbIds.has(p.facebook_post_id));

            broadcasts = broadcasts.map(b => {
              if (b.facebook_post_id) {
                const match = liveFbPosts.find(p => p.facebook_post_id === b.facebook_post_id);
                if (match) {
                  return {
                    ...b,
                    thumbnail_url: match.thumbnail_url || b.thumbnail_url,
                    caption: b.caption || match.caption,
                    metrics: match.metrics,
                  };
                }
              }
              return b;
            });

            if (status !== 'scheduled') {
              broadcasts = [...newFbLive, ...broadcasts];
            }
          }
        } catch (fbErr) {
          console.warn(`[BROADCASTS] Could not sync live Facebook posts for account ${account.id}:`, fbErr.message);
        }
      }
    } catch (metaErr) {
      console.warn('[BROADCASTS] Live Meta API sync error:', metaErr.message);
    }

    res.json({
      success: true,
      broadcasts,
      count: broadcasts.length,
    });
  } catch (error) {
    console.error('Get broadcasts error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch broadcast history' });
  }
});

/**
 * @route   GET /api/broadcasts/queue
 * @desc    Get all scheduled/processing/failed/cancelled posts for the queue page
 * @access  Protected
 */
router.get('/broadcasts/queue', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const [broadcasts, stats] = await Promise.all([
      getScheduledBroadcasts(userId),
      getScheduledStats(userId),
    ]);
    res.json({ success: true, broadcasts, stats });
  } catch (error) {
    console.error('Get queue error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch queue' });
  }
});

/**
 * @route   GET /api/broadcasts/stats
 * @desc    Get queue stats (pending count) for dashboard badge
 * @access  Protected
 */
router.get('/broadcasts/stats', authenticateUser, async (req, res) => {
  try {
    const stats = await getScheduledStats(req.user.userId);
    res.json({ success: true, ...stats });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

/**
 * @route   PATCH /api/broadcasts/:id
 * @desc    Edit a scheduled broadcast (caption, time, timezone, channels)
 * @access  Protected
 * @body    { caption?, scheduledFor?, userTimezone?, selectedChannels? }
 */
router.patch('/broadcasts/:id', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { caption, scheduledFor, userTimezone, selectedChannels } = req.body;

    if (!caption && !scheduledFor && !userTimezone && !selectedChannels) {
      return res.status(400).json({ success: false, error: 'No fields to update provided.' });
    }

    const updated = await updateScheduledBroadcast(id, userId, {
      caption,
      scheduledFor,
      userTimezone,
      selectedChannels,
    });

    res.json({ success: true, broadcast: updated });
  } catch (error) {
    const isClientError = error.message?.includes('Cannot edit') || error.message?.includes('future');
    res.status(isClientError ? 400 : 500).json({
      success: false,
      error: error.message || 'Failed to update broadcast',
    });
  }
});

/**
 * @route   POST /api/broadcasts/:id/cancel
 * @desc    Cancel a scheduled or failed broadcast
 * @access  Protected
 */
router.post('/broadcasts/:id/cancel', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const cancelled = await cancelBroadcast(id, req.user.userId);
    res.json({ success: true, broadcast: cancelled });
  } catch (error) {
    const isClientError = error.message?.includes('Cannot cancel') || error.message?.includes('not found');
    res.status(isClientError ? 400 : 500).json({
      success: false,
      error: error.message || 'Failed to cancel broadcast',
    });
  }
});

/**
 * @route   POST /api/broadcasts/:id/retry
 * @desc    Manually retry a failed broadcast
 * @access  Protected
 */
router.post('/broadcasts/:id/retry', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    const retried = await retryFailedBroadcast(id, req.user.userId);
    res.json({ success: true, broadcast: retried, message: 'Post queued for retry. It will publish within 30 seconds.' });
  } catch (error) {
    const isClientError = error.message?.includes('Cannot retry') || error.message?.includes('not found');
    res.status(isClientError ? 400 : 500).json({
      success: false,
      error: error.message || 'Failed to retry broadcast',
    });
  }
});

/**
 * @route   DELETE /api/broadcasts/:id
 * @desc    Delete a broadcast from history
 * @access  Protected
 */
router.delete('/broadcasts/:id', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;
    
    // First get the broadcast to verify ownership
    const { getBroadcastById, deleteBroadcast } = await import('../services/broadcasts.js');
    const broadcast = await getBroadcastById(id);
    
    if (!broadcast) {
      return res.status(404).json({ success: false, error: 'Broadcast not found' });
    }
    
    if (broadcast.user_id !== req.user.userId) {
      return res.status(403).json({ success: false, error: 'Unauthorized to delete this broadcast' });
    }
    
    await deleteBroadcast(id);
    res.json({ success: true, message: 'Broadcast deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete broadcast' });
  }
});

export default router;
