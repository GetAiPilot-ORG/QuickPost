import { google } from 'googleapis';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Post video to YouTube Shorts
 * @param {string} videoPath - Local path to video file
 * @param {string} caption - Video title/description
 * @param {Object} tokens - YouTube tokens object
 * @returns {Object} Result with video ID and URL
 */
/**
 * Post video to YouTube Shorts
 * @param {string} videoPath - Local path to video file
 * @param {string} caption - Video title/description
 * @param {Object} tokens - YouTube tokens object
 * @param {Function} onProgress - Optional callback for upload progress (0-100)
 * @param {string} visibility - Privacy status ('public', 'unlisted', 'private')
 * @param {string} description - Optional YouTube description override
 * @returns {Object} Result with video ID and URL
 */
export async function postToYouTube(videoPath, caption, tokens, onProgress, visibility = 'public', isShort = false, description = '') {
  try {
    if (!tokens || !tokens.accessToken) {
      throw new Error('Missing YouTube credentials');
    }

    console.log('📺 Starting YouTube upload...');

    // Set up OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken
    });

    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });

    // Prepare video metadata
    const videoTitle = caption.substring(0, 100) || (isShort ? 'QuickPost Short' : 'QuickPost Video');
    const baseDescription = description?.trim() || caption;
    const videoDescription = isShort && !/#shorts/i.test(baseDescription)
      ? `${baseDescription}\n\n#Shorts`
      : baseDescription;
    const tags = isShort ? ['Shorts', 'QuickPost'] : ['QuickPost'];

    console.log(`Uploading ${isShort ? 'Short' : 'Video'} to YouTube...`);

    // Get file size for progress tracking
    const fileSize = fs.statSync(videoPath).size;

    // Upload video
    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: videoTitle,
          description: videoDescription,
          categoryId: '22', // People & Blogs
          tags: tags
        },
        status: {
          privacyStatus: visibility, // Can be 'private', 'unlisted', or 'public'
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        body: fs.createReadStream(videoPath)
      }
    }, {
      // Axios-style progress tracking provided by googleapis
      onUploadProgress: (evt) => {
        if (onProgress && fileSize > 0) {
          const percent = Math.round((evt.bytesRead / fileSize) * 100);
          onProgress(percent);
        }
      }
    });

    const videoId = response.data.id;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const shortsUrl = `https://www.youtube.com/shorts/${videoId}`;
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    const embedHtml = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>`;

    console.log(`✓ Video uploaded: ${videoId}`);
    console.log(`URL: ${shortsUrl}`);
    console.log(`Embed: ${embedUrl}`);

    return {
      success: true,
      videoId: videoId,
      videoUrl: videoUrl,
      shortsUrl: shortsUrl,
      embedUrl: embedUrl,
      embedHtml: embedHtml,
      platform: 'YouTube',
      message: 'Successfully uploaded to YouTube'
    };

  } catch (error) {
    console.error('❌ YouTube upload failed:', error.message);

    // Extract detailed error from YouTube API
    let errorMessage = error.response?.data?.error?.message || error.message;
    const errorCode = error.response?.data?.error?.code || (error.message?.includes('Unauthorized') ? 401 : undefined);
    const errorDetails = error.response?.data?.error?.errors;

    if (errorCode === 401 || /unauthorized|channelnotfound|youtubesignuprequired|no youtube channel/i.test(errorMessage) || errorCode === 404) {
      errorMessage = 'No YouTube channel found for this Google account. Please create a channel at youtube.com/create_channel and reconnect your YouTube account.';
    } else if (errorCode === 403 && /quota/i.test(errorMessage)) {
      errorMessage = 'YouTube API daily upload quota exceeded. Please try again tomorrow.';
    }

    return {
      success: false,
      platform: 'YouTube',
      error: errorMessage,
      errorCode: errorCode,
      details: errorDetails
    };
  }
}

/**
 * Delete a video from YouTube
 * @param {string} videoId - YouTube video ID
 * @param {Object|string} tokensOrAccessToken - YouTube tokens object or access token string
 * @returns {Promise<Object>} Deletion result
 */
export async function deleteFromYouTube(videoId, tokensOrAccessToken) {
  try {
    if (!videoId) {
      throw new Error('Video ID is required for YouTube deletion');
    }

    const accessToken = typeof tokensOrAccessToken === 'string'
      ? tokensOrAccessToken
      : tokensOrAccessToken?.accessToken || tokensOrAccessToken?.access_token;

    const refreshToken = typeof tokensOrAccessToken === 'object'
      ? tokensOrAccessToken?.refreshToken || tokensOrAccessToken?.refresh_token
      : null;

    if (!accessToken) {
      throw new Error('Missing YouTube credentials for deletion');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    const credentials = { access_token: accessToken };
    if (refreshToken) credentials.refresh_token = refreshToken;
    oauth2Client.setCredentials(credentials);

    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });

    console.log(`🗑️ [YOUTUBE] Deleting video ${videoId} from YouTube...`);
    await youtube.videos.delete({
      id: videoId
    });

    console.log(`✅ [YOUTUBE] Successfully deleted video ${videoId} from YouTube`);
    return {
      success: true,
      videoId,
      message: 'Successfully deleted video from YouTube'
    };
  } catch (error) {
    const errorMsg = error.response?.data?.error?.message || error.message;
    console.error(`❌ [YOUTUBE] Failed to delete video ${videoId}:`, errorMsg);
    // If video not found (404), it was already deleted on YouTube
    if (error.response?.status === 404 || /not found/i.test(errorMsg)) {
      console.log(`ℹ️ [YOUTUBE] Video ${videoId} was already removed on YouTube.`);
      return { success: true, message: 'Video already removed from YouTube' };
    }
    return {
      success: false,
      error: errorMsg,
      errorCode: error.response?.data?.error?.code || error.response?.status
    };
  }
}

/**
 * Set custom thumbnail for a YouTube video
 * @param {string} videoId - YouTube video ID
 * @param {string} imagePath - Local path to the thumbnail image
 * @param {Object} tokens - YouTube tokens object
 */
export async function setVideoThumbnail(videoId, imagePath, tokens) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken
    });

    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });

    console.log(`🖼️ Setting custom thumbnail for video ${videoId}...`);

    await youtube.thumbnails.set({
      videoId: videoId,
      media: {
        body: fs.createReadStream(imagePath)
      }
    });

    console.log('✓ Thumbnail set successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Failed to set YouTube thumbnail:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Get video details from YouTube
 * @param {string} videoId - YouTube video ID
 * @param {string} accessToken - Access token
 * @returns {Object} Video details
 */
export async function getYouTubeVideoDetails(videoId, accessToken) {
  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken
    });

    const youtube = google.youtube({
      version: 'v3',
      auth: oauth2Client
    });

    const response = await youtube.videos.list({
      part: ['snippet', 'status', 'statistics'],
      id: [videoId]
    });

    return response.data.items[0];
  } catch (error) {
    throw new Error(`Failed to fetch video details: ${error.message}`);
  }
}
