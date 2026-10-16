import axios from 'axios';

const FACEBOOK_GRAPH_API_URL = 'https://graph.facebook.com/v18.0';
const INSTAGRAM_GRAPH_API_URL = 'https://graph.instagram.com';

function getInstagramGraphBase(accessToken) {
  return accessToken?.startsWith('IGA') ? INSTAGRAM_GRAPH_API_URL : FACEBOOK_GRAPH_API_URL;
}

function getGraphErrorMessage(error) {
  return error.response?.data?.error?.message || error.message;
}

function assertCanPublishToInstagram(mediaUrl, tokens) {
  if (!tokens || !tokens.accessToken || !tokens.businessId) {
    throw new Error('Missing Instagram credentials');
  }

  if (mediaUrl.includes('localhost') || mediaUrl.includes('127.0.0.1')) {
    throw new Error('Instagram requires a publicly accessible HTTPS URL. Localhost URLs are not supported. Please use ngrok, Cloudinary, or another public hosting service.');
  }
}

function isVideoMediaUrl(url) {
  const cleanUrl = String(url || '').split('?')[0].toLowerCase();
  return /\.(mp4|m4v|mov|webm)$/.test(cleanUrl) || cleanUrl.includes('/video/upload/');
}

function applyCloudinaryPadding(url, targetAspectRatio) {
  if (!targetAspectRatio || !url.includes('res.cloudinary.com') || !url.includes('/upload/')) {
    return url;
  }
  
  let targetArFloat = parseFloat(targetAspectRatio);
  if (isNaN(targetArFloat) || targetArFloat <= 0) return url;

  let w = 1080;
  let h = Math.round(w / targetArFloat);
  
  // Instagram requires video dimensions to be even numbers
  if (h % 2 !== 0) h += 1;

  return url.replace(/\/upload\//, `/upload/w_${w},h_${h},c_pad,b_black/`);
}

export function buildInstagramStoryContainerPayload(mediaUrl, caption, mediaType = 'image', accessToken) {
  const isVideo = mediaType === 'video';
  return {
    media_type: 'STORIES',
    [isVideo ? 'video_url' : 'image_url']: mediaUrl,
    access_token: accessToken
  };
}

async function waitForInstagramContainer(graphBaseUrl, containerId, accessToken, onProgress = null, http = axios) {
  let isReady = false;
  let attempts = 0;
  const maxAttempts = 60; // Wait up to 300 seconds (5 minutes)

  while (!isReady && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;

    if (onProgress) {
      onProgress(Math.floor(10 + (attempts / maxAttempts) * 85));
    }

    try {
      const statusRes = await http.get(
        `${graphBaseUrl}/${containerId}`,
        {
          params: {
            fields: 'status_code',
            access_token: accessToken
          }
        }
      );
      const statusCode = statusRes.data.status_code;
      console.log(`Polling attempt ${attempts}: Status is ${statusCode}`);

      if (statusCode === 'FINISHED') {
        isReady = true;
      } else if (statusCode === 'ERROR') {
        throw new Error('Instagram failed to process the video container. Check video format requirements.');
      }
    } catch (err) {
      if (err.message.includes('Instagram failed')) throw err;
      console.warn(`Polling error at attempt ${attempts}:`, err.message);
    }
  }

  if (!isReady) {
    throw new Error('Video processing timed out on Instagram side. Please try again later.');
  }
}

/**
 * Post image to Instagram Feed using the Container workflow
 * @param {string} imageUrl - Publicly accessible URL of the image
 * @param {string} caption - Post caption
 * @param {Object} tokens - Instagram tokens object
 * @returns {Object} Result with media ID
 */
export async function postImageToInstagram(imageUrl, caption, tokens, targetAspectRatio = null) {
  try {
    if (!tokens || !tokens.accessToken || !tokens.businessId) {
      throw new Error('Missing Instagram credentials');
    }


    // Check if URL is publicly accessible
    if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
      throw new Error('Instagram requires a publicly accessible HTTPS URL. Localhost URLs are not supported. Please use ngrok, Cloudinary, or another public hosting service.');
    }

    let safeUrl = imageUrl;
    safeUrl = applyCloudinaryPadding(safeUrl, targetAspectRatio);

    const { accessToken, businessId } = tokens;
    const graphBaseUrl = getInstagramGraphBase(accessToken);

    console.log('📸 Starting Instagram Image Container workflow...');
    console.log('Image URL:', safeUrl);
    console.log('Business ID:', businessId);

    // Step 1: Create Media Container for Image
    console.log('Step 1: Creating image container...');
    const containerResponse = await axios.post(
      `${graphBaseUrl}/${businessId}/media`,
      {
        image_url: safeUrl,
        caption: caption,
        access_token: accessToken
      }
    );

    const containerId = containerResponse.data.id;
    console.log(`✓ Container created: ${containerId}`);

    // Step 2: Wait for Instagram to process the image
    console.log('Step 2: Waiting 3 seconds for image processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 3: Publish the container
    console.log('Step 3: Publishing media...');
    const publishResponse = await axios.post(
      `${graphBaseUrl}/${businessId}/media_publish`,
      {
        creation_id: containerId,
        access_token: accessToken
      }
    );

    const mediaId = publishResponse.data.id;
    console.log(`✓ Media published: ${mediaId}`);

    // Get the permalink for the published media
    let permalink = null;
    try {
      const mediaDetailsResponse = await axios.get(
        `${graphBaseUrl}/${mediaId}`,
        {
          params: {
            fields: 'permalink',
            access_token: accessToken
          }
        }
      );
      permalink = mediaDetailsResponse.data.permalink;
      console.log(`✓ Instagram URL: ${permalink}`);
    } catch (error) {
      console.warn('Could not fetch permalink:', error.message);
    }

    return {
      success: true,
      mediaId: mediaId,
      url: permalink,
      platform: 'Instagram',
      message: 'Successfully posted to Instagram Feed'
    };

  } catch (error) {
    console.error('❌ Instagram image posting failed:', error.message);
    
    // Extract detailed error from Instagram API
    const errorMessage = getGraphErrorMessage(error);
    const errorCode = error.response?.data?.error?.code;

    console.error('Full error details:', error.response?.data);

    return {
      success: false,
      platform: 'Instagram',
      error: errorMessage,
      errorCode: errorCode,
      details: error.response?.data
    };
  }
}

/**
 * Post video to Instagram Reels using the Container workflow
 * @param {string} videoUrl - Publicly accessible URL of the video
 * @param {string} caption - Post caption
 * @param {Object} tokens - Instagram tokens object
 * @returns {Object} Result with media ID
 */
export async function postToInstagram(videoUrl, caption, tokens, onProgress = null, targetAspectRatio = null) {
  try {
    assertCanPublishToInstagram(videoUrl, tokens);

    let safeUrl = videoUrl;
    safeUrl = applyCloudinaryPadding(safeUrl, targetAspectRatio);

    const { accessToken, businessId } = tokens;
    const graphBaseUrl = getInstagramGraphBase(accessToken);

    console.log('📸 Starting Instagram Reels Container workflow...');

    // Step 1: Create Media Container
    console.log('Step 1: Creating media container...');
    const containerPayload = {
      media_type: 'REELS',
      video_url: safeUrl,
      caption: caption,
      access_token: accessToken
    };

    if (tokens.coverUrl) {
      containerPayload.cover_url = tokens.coverUrl;
      console.log('🖼️  Setting Instagram Reel cover_url:', tokens.coverUrl);
    }

    const containerResponse = await axios.post(
      `${graphBaseUrl}/${businessId}/media`,
      containerPayload
    );

    const containerId = containerResponse.data.id;
    console.log(`✓ Container created: ${containerId}`);

    // Step 2: Poll for processing status
    console.log('Step 2: Polling for video processing status...');
    await waitForInstagramContainer(graphBaseUrl, containerId, accessToken, onProgress);

    // Step 3: Publish the container
    console.log('Step 3: Publishing media...');
    const publishResponse = await axios.post(
      `${graphBaseUrl}/${businessId}/media_publish`,
      {
        creation_id: containerId,
        access_token: accessToken
      }
    );

    const mediaId = publishResponse.data.id;
    console.log(`✓ Media published: ${mediaId}`);

    // Get the permalink for the published media
    let permalink = null;
    try {
      const mediaDetailsResponse = await axios.get(
        `${graphBaseUrl}/${mediaId}`,
        {
          params: {
            fields: 'permalink',
            access_token: accessToken
          }
        }
      );
      permalink = mediaDetailsResponse.data.permalink;
      console.log(`✓ Instagram URL: ${permalink}`);
    } catch (error) {
      console.warn('Could not fetch permalink:', error.message);
    }

    return {
      success: true,
      mediaId: mediaId,
      url: permalink,
      platform: 'Instagram',
      message: 'Successfully posted to Instagram Reels'
    };

  } catch (error) {
    console.error('❌ Instagram posting failed:', error.message);
    
    // Extract detailed error from Instagram API
    const errorMessage = getGraphErrorMessage(error);
    const errorCode = error.response?.data?.error?.code;

    return {
      success: false,
      platform: 'Instagram',
      error: errorMessage,
      errorCode: errorCode,
      details: error.response?.data
    };
  }
}

export async function postStoryToInstagram(mediaUrl, caption, tokens, mediaType = 'image', onProgress = null, targetAspectRatio = null, http = axios) {
  try {
    assertCanPublishToInstagram(mediaUrl, tokens);

    let safeUrl = mediaUrl;
    safeUrl = applyCloudinaryPadding(safeUrl, targetAspectRatio);

    const { accessToken, businessId } = tokens;
    const graphBaseUrl = getInstagramGraphBase(accessToken);
    const isVideo = mediaType === 'video';

    console.log('Starting Instagram Story Container workflow...');

    const containerResponse = await http.post(
      `${graphBaseUrl}/${businessId}/media`,
      buildInstagramStoryContainerPayload(safeUrl, caption, mediaType, accessToken)
    );

    const containerId = containerResponse.data.id;
    console.log(`Story container created: ${containerId}`);

    if (isVideo) {
      await waitForInstagramContainer(graphBaseUrl, containerId, accessToken, onProgress, http);
    } else {
      console.log('Step 2: Waiting 3 seconds for image processing...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    const publishResponse = await http.post(
      `${graphBaseUrl}/${businessId}/media_publish`,
      {
        creation_id: containerId,
        access_token: accessToken
      }
    );

    const mediaId = publishResponse.data.id;

    return {
      success: true,
      mediaId,
      url: null,
      platform: 'Instagram',
      message: 'Successfully posted to Instagram Story'
    };
  } catch (error) {
    console.error('Instagram Story posting failed:', error.message);
    return {
      success: false,
      platform: 'Instagram',
      error: getGraphErrorMessage(error),
      errorCode: error.response?.data?.error?.code,
      details: error.response?.data
    };
  }
}

/**
 * Post a Carousel (multiple images/videos) to Instagram
 * @param {string[]} mediaUrls - Array of public URLs
 * @param {string} caption - Post caption
 * @param {Object} tokens - Instagram tokens
 * @param {string|null} targetAspectRatio - Desired format padding
 * @returns {Object} Result
 */
export async function postCarouselToInstagram(mediaUrls, caption, tokens, targetAspectRatio = null, http = axios) {
  try {
    if (!tokens || !tokens.accessToken || !tokens.businessId) {
      throw new Error('Missing Instagram credentials');
    }

    for (const mediaUrl of mediaUrls) {
      assertCanPublishToInstagram(mediaUrl, tokens);
    }

    const { accessToken, businessId } = tokens;
    const graphBaseUrl = getInstagramGraphBase(accessToken);
    console.log(`📸 Starting Instagram Carousel workflow with ${mediaUrls.length} items...`);

    // Step 1: Create individual media containers for each item
    const childIds = [];
    for (const [index, url] of mediaUrls.entries()) {
      console.log(`Step 1.${index + 1}: Creating container for item ${index + 1}...`);
      
      let safeUrl = url;
      safeUrl = applyCloudinaryPadding(safeUrl, targetAspectRatio);

      const isVideo = isVideoMediaUrl(safeUrl);
      
      const containerRes = await http.post(
        `${graphBaseUrl}/${businessId}/media`,
        {
          media_type: isVideo ? 'VIDEO' : 'IMAGE',
          [isVideo ? 'video_url' : 'image_url']: safeUrl,
          is_carousel_item: true,
          access_token: accessToken
        }
      );
      childIds.push(containerRes.data.id);
      if (isVideo) {
        await waitForInstagramContainer(graphBaseUrl, containerRes.data.id, accessToken, null, http);
      }
      console.log(`✓ Child container created: ${containerRes.data.id}`);
    }

    // Step 3: Create the Carousel Container
    console.log('Step 3: Creating carousel container...');
    const carouselRes = await http.post(
      `${graphBaseUrl}/${businessId}/media`,
      {
        media_type: 'CAROUSEL',
        children: childIds,
        caption: caption,
        access_token: accessToken
      }
    );
    const creationId = carouselRes.data.id;
    console.log(`✓ Carousel container created: ${creationId}`);

    // Step 4: Publish
    console.log('Step 4: Publishing carousel...');
    const publishRes = await http.post(
      `${graphBaseUrl}/${businessId}/media_publish`,
      {
        creation_id: creationId,
        access_token: accessToken
      }
    );

    const mediaId = publishRes.data.id;
    console.log(`✓ Carousel published: ${mediaId}`);

    return {
      success: true,
      mediaId: mediaId,
      platform: 'Instagram',
      message: 'Successfully posted Carousel to Instagram'
    };

  } catch (error) {
    console.error('❌ Instagram Carousel failed:', error.response?.data || error.message);
    const errorMessage = getGraphErrorMessage(error);
    return {
      success: false,
      platform: 'Instagram',
      error: errorMessage,
      details: error.response?.data
    };
  }
}

/**
 * Get Instagram media details
 * @param {string} mediaId - Instagram media ID
 * @param {string} accessToken - Access token
 * @returns {Object} Media details
 */
export async function getInstagramMediaDetails(mediaId, accessToken) {
  try {
    const graphBaseUrl = getInstagramGraphBase(accessToken);
    const response = await axios.get(
      `${graphBaseUrl}/${mediaId}`,
      {
        params: {
          fields: 'id,media_type,media_url,permalink,timestamp',
          access_token: accessToken
        }
      }
    );

    return response.data;
  } catch (error) {
    throw new Error(`Failed to fetch media details: ${error.message}`);
  }
}
