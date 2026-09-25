import { default as supabase } from "./supabase.js";
import { findFullScheduledChannel } from '../config/queuePolicy.js';

export async function assertScheduledQueueCapacity(userId, channels, perChannelLimit) {
  if (!Number.isFinite(perChannelLimit) || perChannelLimit >= 1_000_000) return;
  const requestedChannels = [...new Set((channels || []).map(String).filter(Boolean))];
  if (requestedChannels.length === 0) throw new Error('Select at least one channel');

  const { data, error } = await supabase
    .from('broadcasts')
    .select('selected_channels')
    .eq('user_id', userId)
    .in('status', ['scheduled', 'queued', 'processing']);
  if (error) throw new Error(`Failed to check scheduled queue capacity: ${error.message}`);

  const fullChannel = findFullScheduledChannel(
    requestedChannels,
    data || [],
    perChannelLimit,
  );
  if (fullChannel) {
    const error = new Error(`Your scheduled queue limit for ${fullChannel} has been reached`);
    error.code = 'PLAN_LIMIT_REACHED';
    error.metric = 'scheduled_queue';
    throw error;
  }
}


/**
 * Save broadcast record to database
 */
export async function saveBroadcast(
  userId,
  caption,
  mediaFilenames,
  results,
  mediaType = "image",
  platformData = {},
  status = "sent",
  scheduledFor = null,
) {
  try {
    const thumbnailUrl = results.thumbnailUrl || null;
    // Handle both single string and array for filenames
    const filenames = Array.isArray(mediaFilenames)
      ? mediaFilenames
      : [mediaFilenames].filter(Boolean);
    const mediaUrls = Array.isArray(results.mediaUrls)
      ? results.mediaUrls
      : [results.mediaUrl].filter(Boolean);

    const broadcastData = {
      user_id: userId,
      caption: caption,
      video_filename: filenames[0] || null, // Primary file
      status: status,
      posted_at: status === "sent" ? new Date().toISOString() : null,
      scheduled_for: scheduledFor,
      user_timezone: platformData.userTimezone || 'UTC',
      media_type: mediaType,
      media_url: mediaUrls[0] || null, // Primary public URL
      media_urls: mediaUrls,           // Store all URLs
      thumbnail_url: thumbnailUrl,     // Preview thumbnail URL
      selected_channels: platformData.selectedChannels || [],
      platform_data: { ...platformData, results },

      // Instagram results
      instagram_success: results.instagram?.success || false,
      instagram_post_id: results.instagram?.mediaId || null,
      instagram_url:
        results.instagram?.url || results.instagram?.permalink || null,
      instagram_error: results.instagram?.error || null,

      // YouTube results
      youtube_success: results.youtube?.success || false,
      youtube_video_id: results.youtube?.videoId || null,
      youtube_url: results.youtube?.videoUrl || null,
      youtube_shorts_url: results.youtube?.shortsUrl || null,
      youtube_error: results.youtube?.error || null,

      // Pinterest results
      pinterest_success: results.pinterest?.success || false,
      pinterest_pin_id: results.pinterest?.pinId || null,
      pinterest_url: results.pinterest?.url || null,
      pinterest_error: results.pinterest?.error || null,

      // Facebook results
      facebook_success: results.facebook?.success || false,
      facebook_post_id: results.facebook?.postId || null,
      facebook_url: results.facebook?.postUrl || null,
      facebook_error: results.facebook?.error || null,

      // LinkedIn results
      linkedin_success: results.linkedin?.success || false,
      linkedin_post_id: results.linkedin?.postId || null,
      linkedin_url: results.linkedin?.url || null,
      linkedin_error: results.linkedin?.error || null,

      // Mastodon results
      mastodon_success: results.mastodon?.success || false,
      mastodon_post_id: results.mastodon?.id || null,
      mastodon_url: results.mastodon?.url || null,
      mastodon_error: results.mastodon?.error || null,



      // Bluesky results
      bluesky_success: results.bluesky?.success || false,
      bluesky_post_id: results.bluesky?.uri || results.bluesky?.id || null,
      bluesky_url: results.bluesky?.url || null,
      bluesky_error: results.bluesky?.error || null,

      // Threads results
      threads_success: results.threads?.success || false,
      threads_post_id: results.threads?.postId || null,
      threads_url: results.threads?.url || null,
      threads_error: results.threads?.error || null,

      // X results
      x_success: results.x?.success || false,
      x_post_id: results.x?.postId || null,
      x_url: results.x?.url || null,
      x_error: results.x?.error || null,
    };

    const { data, error } = await supabase
      .from("broadcasts")
      .insert([broadcastData])
      .select();

    if (error) {
      console.error(
        "❌ [SUPABASE] Error saving broadcast record:",
        error.message,
      );
      return null;
    }

    const savedRecord = data?.[0];
    if (savedRecord) {
      console.log(
        "✅ Broadcast saved to database:",
        savedRecord.id,
        `Status: ${status}`,
      );
      return savedRecord;
    }

    return null;
  } catch (error) {
    console.error("💥 Failed to save broadcast:", error.message || error);
    return null;
  }
}

/**
 * Update broadcast status and results
 */
export async function updateBroadcastResults(
  broadcastId,
  results,
  status = "sent",
) {
  try {
    const updateData = {
      status: status,
      posted_at: status === "sent" ? new Date().toISOString() : null,
      processing_started_at: null,
    };

    if (status === 'sent') updateData.last_error = null;

    const resultMappings = {
      instagram: { id: 'mediaId', idColumn: 'instagram_post_id', url: ['url', 'permalink'], urlColumn: 'instagram_url' },
      youtube: { id: 'videoId', idColumn: 'youtube_video_id', url: ['videoUrl'], urlColumn: 'youtube_url', shortsUrl: 'shortsUrl' },
      pinterest: { id: 'pinId', idColumn: 'pinterest_pin_id', url: ['url'], urlColumn: 'pinterest_url' },
      facebook: { id: 'postId', idColumn: 'facebook_post_id', url: ['postUrl', 'url'], urlColumn: 'facebook_url' },
      linkedin: { id: 'postId', idColumn: 'linkedin_post_id', url: ['url'], urlColumn: 'linkedin_url' },
      mastodon: { id: 'id', idColumn: 'mastodon_post_id', url: ['url'], urlColumn: 'mastodon_url' },
      bluesky: { id: ['uri', 'id'], idColumn: 'bluesky_post_id', url: ['url'], urlColumn: 'bluesky_url' },
      threads: { id: 'postId', idColumn: 'threads_post_id', url: ['url'], urlColumn: 'threads_url' },
      x: { id: 'postId', idColumn: 'x_post_id', url: ['url'], urlColumn: 'x_url' },
    };

    const firstValue = (result, keys) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        if (result?.[key] != null) return result[key];
      }
      return null;
    };

    for (const [provider, mapping] of Object.entries(resultMappings)) {
      if (!Object.prototype.hasOwnProperty.call(results, provider)) continue;
      const result = results[provider] || {};
      updateData[`${provider}_success`] = Boolean(result.success);
      updateData[mapping.idColumn] = firstValue(result, mapping.id);
      updateData[mapping.urlColumn] = firstValue(result, mapping.url);
      updateData[`${provider}_error`] = result.error || null;
      if (mapping.shortsUrl) updateData.youtube_shorts_url = result[mapping.shortsUrl] || null;
    }

    const { data, error } = await supabase
      .from("broadcasts")
      .update(updateData)
      .eq("id", broadcastId)
      .select();

    if (error) throw error;
    return data?.[0];
  } catch (error) {
    console.error(
      `❌ Failed to update broadcast ${broadcastId}:`,
      error.message,
    );
    return null;
  }
}

export async function checkpointBroadcastChannels(broadcastId, channelResults = {}) {
  const { data: current, error: readError } = await supabase
    .from('broadcasts')
    .select('platform_data')
    .eq('id', broadcastId)
    .single();
  if (readError) throw readError;

  const platformData = current?.platform_data || {};
  const previousResults = platformData.channelResults || {};
  const completedChannels = new Set(platformData.completedChannels || []);
  for (const [channel, result] of Object.entries(channelResults)) {
    if (result?.success) completedChannels.add(channel);
  }

  const { error: updateError } = await supabase
    .from('broadcasts')
    .update({
      platform_data: {
        ...platformData,
        channelResults: { ...previousResults, ...channelResults },
        completedChannels: [...completedChannels],
      },
    })
    .eq('id', broadcastId);
  if (updateError) throw updateError;
}

/**
 * Get broadcasts for a user
 */
export async function getBroadcasts(userId, status = null, historyDays = null) {
  try {
    let query = supabase
      .from("broadcasts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }
    if (Number.isFinite(historyDays)) {
      const cutoff = new Date(Date.now() - historyDays * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", cutoff);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching broadcasts:", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    console.error("Failed to fetch broadcasts:", error);
    throw error;
  }
}

/**
 * Get all scheduled broadcasts that are due
 */
export async function getDueScheduledBroadcasts() {
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("broadcasts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_for", now);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error("Failed to fetch due scheduled broadcasts:", error);
    return [];
  }
}

/**
 * Get single broadcast by ID
 */
export async function getBroadcastById(broadcastId) {
  try {
    const { data, error } = await supabase
      .from("broadcasts")
      .select("*")
      .eq("id", broadcastId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Failed to fetch broadcast:", error);
    throw error;
  }
}

/**
 * Delete broadcast
 */
export async function deleteBroadcast(broadcastId) {
  try {
    const { error } = await supabase
      .from("broadcasts")
      .delete()
      .eq("id", broadcastId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error("Failed to delete broadcast:", error);
    throw error;
  }
}

/**
 * Cancel a scheduled broadcast.
 * Only works if status is 'scheduled' (not yet processing or sent).
 */
export async function cancelBroadcast(broadcastId, userId) {
  try {
    // First verify ownership and current status
    const { data: post, error: fetchErr } = await supabase
      .from('broadcasts')
      .select('id, status, user_id')
      .eq('id', broadcastId)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !post) throw new Error('Broadcast not found or access denied');

    if (!['scheduled', 'failed'].includes(post.status)) {
      throw new Error(`Cannot cancel a post with status '${post.status}'. Only scheduled or failed posts can be cancelled.`);
    }

    const { data, error } = await supabase
      .from('broadcasts')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', broadcastId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    console.log(`✅ [BROADCASTS] Cancelled broadcast ${broadcastId}`);
    return data;
  } catch (error) {
    console.error('Failed to cancel broadcast:', error.message);
    throw error;
  }
}

/**
 * Update a scheduled broadcast (caption, scheduled time, timezone, channels).
 * Only works if status is 'scheduled'.
 */
export async function updateScheduledBroadcast(broadcastId, userId, updates) {
  try {
    const { data: post, error: fetchErr } = await supabase
      .from('broadcasts')
      .select('id, status, user_id')
      .eq('id', broadcastId)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !post) throw new Error('Broadcast not found or access denied');
    if (post.status !== 'scheduled') {
      throw new Error(`Cannot edit a post with status '${post.status}'. Only scheduled posts can be edited.`);
    }

    const allowedFields = {};
    if (updates.caption !== undefined)       allowedFields.caption = updates.caption;
    if (updates.scheduledFor !== undefined) {
      // Validate new time is in the future (2 min buffer)
      const newTime = new Date(updates.scheduledFor);
      if (newTime.getTime() < Date.now() + 2 * 60 * 1000) {
        throw new Error('Scheduled time must be at least 2 minutes in the future.');
      }
      allowedFields.scheduled_for = newTime.toISOString();
    }
    if (updates.userTimezone !== undefined)  allowedFields.user_timezone = updates.userTimezone;
    if (updates.selectedChannels !== undefined) {
      allowedFields.selected_channels = updates.selectedChannels;
      allowedFields.platform_data = { ...((await getBroadcastById(broadcastId))?.platform_data || {}), selectedChannels: updates.selectedChannels };
    }
    allowedFields.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('broadcasts')
      .update(allowedFields)
      .eq('id', broadcastId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    console.log(`✅ [BROADCASTS] Updated scheduled broadcast ${broadcastId}`);
    return data;
  } catch (error) {
    console.error('Failed to update broadcast:', error.message);
    throw error;
  }
}

/**
 * Manually retry a failed broadcast.
 * Resets status to 'scheduled' and clears error state.
 */
export async function retryFailedBroadcast(broadcastId, userId) {
  try {
    const { data: post, error: fetchErr } = await supabase
      .from('broadcasts')
      .select('id, status, user_id, attempt_count')
      .eq('id', broadcastId)
      .eq('user_id', userId)
      .single();

    if (fetchErr || !post) throw new Error('Broadcast not found or access denied');
    if (post.status !== 'failed') {
      throw new Error(`Cannot retry a post with status '${post.status}'. Only failed posts can be retried.`);
    }

    const { data, error } = await supabase
      .from('broadcasts')
      .update({
        status: 'scheduled',
        attempt_count: 0,          // Reset retry counter for manual retry
        last_error: null,
        processing_started_at: null,
        scheduled_for: new Date(Date.now() + 30 * 1000).toISOString(), // 30s from now
        updated_at: new Date().toISOString(),
      })
      .eq('id', broadcastId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    console.log(`🔄 [BROADCASTS] Queued retry for broadcast ${broadcastId}`);
    return data;
  } catch (error) {
    console.error('Failed to retry broadcast:', error.message);
    throw error;
  }
}

/**
 * Get scheduled (and recently failed) broadcasts for a user.
 * Used by the Queue page.
 */
export async function getScheduledBroadcasts(userId) {
  try {
    const { data, error } = await supabase
      .from('broadcasts')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['scheduled', 'queued', 'processing', 'failed', 'cancelled', 'sent'])
      .order('scheduled_for', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Failed to fetch scheduled broadcasts:', error);
    throw error;
  }
}

/**
 * Get queue stats for the dashboard badge.
 */
export async function getScheduledStats(userId) {
  try {
    const { data, error } = await supabase
      .from('broadcasts')
      .select('status')
      .eq('user_id', userId)
      .in('status', ['scheduled', 'queued', 'processing']);

    if (error) throw error;
    return { pending: (data || []).length };
  } catch (error) {
    console.error('Failed to fetch scheduled stats:', error);
    return { pending: 0 };
  }
}
