import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import dotenv from 'dotenv';
import IORedis from 'ioredis';
import supabase from './supabase.js';
import { decryptToken } from './tokenEncryption.js';

dotenv.config();

// Redis client for shared idempotency caching across Node.js instances & BullMQ workers
let redisClient = null;
function getRedisClient() {
  const url = process.env.REDIS_URL || process.env.BULLMQ_REDIS_URL;
  if (!url) return null;
  if (!redisClient) {
    redisClient = new IORedis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      enableReadyCheck: false,
      retryStrategy: () => null
    });
    redisClient.on('error', () => {});
  }
  return redisClient;
}

// In-memory fallback map if Redis is disabled
const completedPublishIds = new Map();

/**
 * Check shared idempotency store (PostgreSQL + Redis + process memory)
 */
async function checkIdempotency(broadcastId) {
  if (!broadcastId) return null;
  const key = String(broadcastId).trim();

  // 1. Process Memory Fallback Check
  if (completedPublishIds.has(key)) {
    return completedPublishIds.get(key);
  }

  // 2. Redis Shared Cache Check
  const redis = getRedisClient();
  if (redis) {
    try {
      const cachedStr = await redis.get(`idempotency:pinterest:${key}`);
      if (cachedStr) {
        const parsed = JSON.parse(cachedStr);
        completedPublishIds.set(key, parsed);
        return parsed;
      }
    } catch (e) {}
  }

  // 3. PostgreSQL Database Persistence Check
  try {
    const { data } = await supabase
      .from('broadcasts')
      .select('pinterest_pin_id, pinterest_url, pinterest_success')
      .eq('id', key)
      .maybeSingle();

    if (data && data.pinterest_success && data.pinterest_pin_id) {
      const res = {
        success: true,
        pinId: data.pinterest_pin_id,
        url: data.pinterest_url,
        platform: 'Pinterest',
        message: 'Pin already published for this broadcast'
      };
      completedPublishIds.set(key, res);
      return res;
    }
  } catch (dbErr) {}

  return null;
}

/**
 * Save shared idempotency record to Redis and process memory
 */
async function saveIdempotency(broadcastId, result) {
  if (!broadcastId || !result?.pinId) return;
  const key = String(broadcastId).trim();
  completedPublishIds.set(key, result);

  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(`idempotency:pinterest:${key}`, JSON.stringify(result), 'EX', 86400);
    } catch (e) {}
  }
}

/**
 * Post image to Pinterest as a Pin with Rate-Limit Handling and Shared Idempotency Guard
 * @param {string} imageUrl - Public URL to image
 * @param {string} title - Pin title
 * @param {Object} tokens - Pinterest tokens object with accessToken and boardId
 * @param {string} link - Optional link URL
 * @param {string} boardId - Optional board ID (overrides tokens.boardId)
 * @param {string} broadcastId - Optional unique broadcast or job identifier for idempotency
 * @returns {Object} Result with pin ID and URL
 */
export async function postToPinterest(imageUrl, title, tokens, link = '', boardId = null, broadcastId = null) {
  const startTime = Date.now();

  // Shared Persistent Idempotency Check across DB, Redis, and memory
  const existingResult = await checkIdempotency(broadcastId);
  if (existingResult) {
    console.log(`ℹ️ [PINTEREST-PUBLISH] Duplicate publish prevented via shared store for broadcast ID ${broadcastId}. Reusing Pin ID: ${existingResult.pinId}`);
    return {
      ...existingResult,
      duplicatedPrevented: true
    };
  }

  try {
    if (!tokens || !tokens.accessToken) {
      throw new Error('Missing Pinterest credentials');
    }

    const decryptedAccessToken = decryptToken(tokens.accessToken);
    const targetBoardId = (boardId && boardId !== 'default' ? boardId : null) || (tokens.boardId !== 'default' ? tokens.boardId : null);

    if (!targetBoardId) {
      throw new Error('No valid Pinterest board selected. Please choose a board in Platform Customization.');
    }

    if (!imageUrl || typeof imageUrl !== 'string') {
      throw new Error('Pinterest requires a publicly accessible image URL to create a Pin.');
    }

    // Check if URL is publicly accessible
    if (imageUrl.includes('localhost') || imageUrl.includes('127.0.0.1')) {
      throw new Error('Pinterest requires a publicly accessible HTTPS URL. Localhost URLs are not supported.');
    }

    console.log(`📌 [PINTEREST-PUBLISH] Publishing Pin to Board ID: ${targetBoardId}...`);

    const baseUrl = process.env.PINTEREST_API_BASE_URL || 'https://api.pinterest.com/v5';
    const response = await axios.post(`${baseUrl}/pins`, {
      board_id: targetBoardId,
      title: (title || 'QuickPost Pin').substring(0, 100),
      description: (title || '').substring(0, 800),
      link: link || imageUrl,
      media_source: {
        source_type: 'image_url',
        url: imageUrl
      }
    }, {
      headers: {
        'Authorization': `Bearer ${decryptedAccessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const pinId = response.data.id;
    const pinUrl = `https://www.pinterest.com/pin/${pinId}/`;
    const duration = Date.now() - startTime;

    console.log(`✅ [PINTEREST-PUBLISH] Pin published successfully (Pin ID: ${pinId}, HTTP ${response.status}, ${duration}ms)`);

    const result = {
      success: true,
      pinId: pinId,
      url: pinUrl,
      platform: 'Pinterest',
      message: 'Successfully uploaded to Pinterest'
    };

    if (broadcastId) {
      await saveIdempotency(broadcastId, result);
    }

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;
    const httpStatus = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || error.message;
    const errorCode = error.response?.data?.code;

    // Parse rate limiting headers (HTTP 429)
    const retryAfterHeader = error.response?.headers?.['retry-after'];
    const isRateLimited = httpStatus === 429 || error.response?.headers?.['x-user-ratelimit-remaining'] === '0';
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) : (isRateLimited ? 60 : null);

    if (isRateLimited) {
      console.warn(`⚠️ [PINTEREST-ERROR] Rate limit reached (HTTP 429). Retry after ${retryAfterSeconds} seconds.`);
    } else {
      console.error(`❌ [PINTEREST-ERROR] Pin publication failed (HTTP ${httpStatus}, ${duration}ms):`, errorMessage);
    }

    return {
      success: false,
      platform: 'Pinterest',
      error: errorMessage,
      errorCode: errorCode,
      isRateLimited: isRateLimited,
      retryAfter: retryAfterSeconds,
      details: error.response?.data
    };
  }
}

/**
 * Upload image directly to Pinterest (alternative media upload)
 */
export async function uploadImageToPinterest(imagePath, caption, tokens) {
  const startTime = Date.now();
  try {
    const decryptedAccessToken = decryptToken(tokens.accessToken);
    const form = new FormData();
    form.append('image', fs.createReadStream(imagePath));

    const baseUrl = 'https://api.pinterest.com/v5';
    const uploadResponse = await axios.post(`${baseUrl}/media`, form, {
      headers: {
        'Authorization': `Bearer ${decryptedAccessToken}`,
        ...form.getHeaders()
      },
      timeout: 30000
    });

    const mediaId = uploadResponse.data.media_id;

    const pinResponse = await axios.post(`${baseUrl}/pins`, {
      board_id: tokens.boardId,
      title: (caption || 'QuickPost Pin').substring(0, 100),
      description: caption || '',
      media_source: {
        source_type: 'image_upload',
        media_id: mediaId
      }
    }, {
      headers: {
        'Authorization': `Bearer ${decryptedAccessToken}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const pinId = pinResponse.data.id;
    const pinUrl = `https://www.pinterest.com/pin/${pinId}/`;
    const duration = Date.now() - startTime;

    console.log(`✅ [PINTEREST-PUBLISH] Direct media Pin created (Pin ID: ${pinId}, ${duration}ms)`);

    return {
      success: true,
      pinId: pinId,
      pinUrl: pinUrl,
      platform: 'Pinterest',
      message: 'Successfully uploaded to Pinterest'
    };

  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`❌ [PINTEREST-ERROR] Direct media upload failed (${duration}ms):`, error.response?.data?.message || error.message);
    return {
      success: false,
      platform: 'Pinterest',
      error: error.response?.data?.message || error.message
    };
  }
}
