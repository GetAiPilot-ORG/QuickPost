import axios from 'axios';
import dotenv from 'dotenv';
import supabase from './supabase.js';

dotenv.config();

const API_URL = process.env.TELESMM_API_URL || 'https://api.telesmm.in/api/v1';

let servicesCache = null;
let servicesCacheTime = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes in-memory cache

function getApiKey() {
  if (!process.env.TELESMM_API_KEY) {
    dotenv.config();
  }
  return process.env.TELESMM_API_KEY;
}

/**
 * Execute POST request with form-data to TeleSMM API
 */
export async function callSmmApi(params = {}) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('TeleSMM API key (TELESMM_API_KEY) is not configured in server environment.');
  }

  const formData = new URLSearchParams();
  formData.append('key', apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) {
      formData.append(k, String(v));
    }
  }

  try {
    const response = await axios.post(API_URL, formData.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 15000,
    });
    return response.data;
  } catch (error) {
    const errorDetails = error.response?.data || error.message;
    console.error('[SMM Service] API call failed:', errorDetails);
    throw new Error(
      typeof errorDetails === 'object' ? JSON.stringify(errorDetails) : errorDetails
    );
  }
}

/**
 * Parse platform and bucket helper
 */
function parseServiceMeta(svc) {
  const cat = (svc.category || '').toLowerCase();
  const name = (svc.name || '').toLowerCase();
  const text = `${name} ${cat}`;

  if (cat.includes('private not for you') || name.startsWith('xxx-')) return null;
  if (cat.includes('telegram')) return null;

  let platform = null;
  let category = 'other';

  if (text.includes('instagram') || text.includes('ig ') || cat.includes('instagram')) {
    platform = 'instagram';
    if (name.includes('auto') || cat.includes('auto') || name.includes('sub') || cat.includes('sub') || cat.includes('subscription')) {
      category = 'subscriptions';
    } else if (name.includes('follower') || cat.includes('follower')) {
      category = 'followers';
    } else if (name.includes('like') || cat.includes('like')) {
      category = 'likes';
    } else if (name.includes('view') || cat.includes('view')) {
      category = 'views';
    } else if (name.includes('comment') || cat.includes('comment')) {
      category = 'comments';
    }
  } else if (text.includes('youtube') || text.includes('yt ') || cat.includes('youtube')) {
    platform = 'youtube';
    if (name.includes('auto') || cat.includes('auto') || cat.includes('subscription')) {
      category = 'subscriptions';
    } else if (name.includes('subscriber')) {
      category = 'subscribers';
    } else if (name.includes('like')) {
      category = 'likes';
    } else if (name.includes('view')) {
      category = 'views';
    } else if (name.includes('comment')) {
      category = 'comments';
    }
  } else if (text.includes('twitter') || text.includes('x |') || cat.includes('twitter') || cat.includes('x |')) {
    platform = 'x';
    if (name.includes('auto') || cat.includes('auto')) {
      category = 'subscriptions';
    } else if (name.includes('follower')) {
      category = 'followers';
    } else if (name.includes('like')) {
      category = 'likes';
    } else if (name.includes('view')) {
      category = 'views';
    } else if (name.includes('retweet')) {
      category = 'retweets';
    }
  } else if (text.includes('tiktok') || cat.includes('tiktok')) {
    platform = 'tiktok';
    if (name.includes('auto') || cat.includes('auto')) {
      category = 'subscriptions';
    } else if (name.includes('follower')) {
      category = 'followers';
    } else if (name.includes('view')) {
      category = 'views';
    } else if (name.includes('like')) {
      category = 'likes';
    }
  }

  if (!platform) return null;

  return {
    platform,
    category,
  };
}

const USD_TO_INR_RATE = parseFloat(process.env.USD_TO_INR_RATE) || 85.0;

/**
 * Sync TeleSMM Services into Supabase sg_services table with custom markup and USD->INR conversion
 */
export async function syncServicesToSupabase({ markupPercentage = 0, fixedMarkup = 0, usdToInr = USD_TO_INR_RATE } = {}) {
  const rawServices = await callSmmApi({ action: 'services' });
  if (!Array.isArray(rawServices)) {
    throw new Error('Failed to fetch services list from TeleSMM');
  }

  const upsertRows = [];

  for (const svc of rawServices) {
    const meta = parseServiceMeta(svc);
    if (!meta) continue;

    const costPerK_USD = parseFloat(svc.rate) || 0;
    // 1. Convert TeleSMM USD cost per 1k into INR cost per 1k
    const costPerK_INR = Number((costPerK_USD * usdToInr).toFixed(2));
    // 2. Calculate selling price in INR with configured markup%
    const calculatedPrice_INR = Number(
      Math.max(0.01, costPerK_INR * (1 + markupPercentage / 100) + fixedMarkup).toFixed(2)
    );

    upsertRows.push({
      service_id: String(svc.service),
      name: svc.name,
      platform: meta.platform,
      category: meta.category,
      min_quantity: parseInt(svc.min, 10) || 10,
      max_quantity: parseInt(svc.max, 10) || 100000,
      cost_per_k: costPerK_INR,
      price_per_k: calculatedPrice_INR,
      is_active: true,
      updated_at: new Date().toISOString(),
    });
  }

  if (upsertRows.length > 0) {
    const { error } = await supabase
      .from('sg_services')
      .upsert(upsertRows, { onConflict: 'service_id' });

    if (error) {
      console.error('[SMM Service] Error syncing to sg_services:', error);
      throw error;
    }
  }

  // Clear cache so next fetch reads updated rows from database immediately
  servicesCache = null;
  return { syncedCount: upsertRows.length, usdToInr };
}

/**
 * Fetch and categorize all Social Growth Services with Dynamic Pricing from Supabase sg_services
 */
export async function getAllSocialGrowthServices({ forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && servicesCache && now - servicesCacheTime < CACHE_TTL_MS) {
    return servicesCache;
  }

  // 1. Fetch from Supabase sg_services
  const { data: dbServices, error } = await supabase
    .from('sg_services')
    .select('*')
    .eq('is_active', true)
    .order('price_per_k', { ascending: true });

  if (error) {
    console.error('[SMM Service] Error fetching from sg_services:', error);
  }

  // If table is empty on first run, auto-sync from TeleSMM
  if (!dbServices || dbServices.length === 0) {
    console.log('[SMM Service] sg_services table is empty. Auto-syncing from TeleSMM...');
    try {
      await syncServicesToSupabase({ markupPercentage: 30 });
      const { data: synced } = await supabase
        .from('sg_services')
        .select('*')
        .eq('is_active', true)
        .order('price_per_k', { ascending: true });
      return formatServicesByPlatform(synced || []);
    } catch (syncErr) {
      console.error('[SMM Service] Auto-sync failed:', syncErr);
    }
  }

  return formatServicesByPlatform(dbServices || []);
}

function formatServicesByPlatform(servicesList) {
  const categorized = {
    instagram: [],
    youtube: [],
    x: [],
    tiktok: [],
  };

  for (const svc of servicesList) {
    const p = (svc.platform || '').toLowerCase();
    if (categorized[p]) {
      categorized[p].push({
        service: svc.service_id,
        name: svc.name,
        category: svc.category,
        rate: parseFloat(svc.price_per_k), // Dynamic selling price shown to user
        cost_per_k: parseFloat(svc.cost_per_k),
        min: svc.min_quantity,
        max: svc.max_quantity,
        platform: svc.platform,
        bucket: svc.category,
      });
    }
  }

  servicesCache = categorized;
  servicesCacheTime = Date.now();
  return categorized;
}

/**
 * Fetch Instagram services (backward compat)
 */
export async function getInstagramServices({ forceRefresh = false } = {}) {
  const all = await getAllSocialGrowthServices({ forceRefresh });
  return all.instagram || [];
}

/**
 * Get Provider Balance
 */
export async function getBalance() {
  return await callSmmApi({ action: 'balance' });
}

/**
 * Check Order Status
 */
export async function getOrderStatus(orderId) {
  if (!orderId) {
    throw new Error('Order ID is required.');
  }
  return await callSmmApi({ action: 'status', order: orderId });
}

/**
 * Place a single Order on TeleSMM
 */
export async function createOrder({ service, link, quantity, comments, runs, interval }) {
  if (!service) throw new Error('Service ID is required.');
  if (!link) throw new Error('Target link / username is required.');
  if (!quantity) throw new Error('Quantity is required.');

  const payload = {
    action: 'add',
    service: String(service),
    link: String(link).trim(),
    quantity: Number(quantity),
  };

  if (comments) payload.comments = comments;
  if (runs) payload.runs = runs;
  if (interval) payload.interval = interval;

  const result = await callSmmApi(payload);

  if (result && result.error) {
    throw new Error(result.error);
  }

  return result;
}

/**
 * Place an Instagram Auto-Likes / Auto-Views Subscription on TeleSMM
 */
export async function createSubscription({
  service,
  username,
  min,
  max,
  posts,
  quantity,
  delay = 0,
  expiry = '',
}) {
  if (!service) throw new Error('Service ID is required.');
  if (!username) throw new Error('Instagram username is required.');

  const cleanUsername = username
    .replace(/^@/, '')
    .replace(/.*instagram\.com\//, '')
    .replace(/\/.*$/, '')
    .trim();

  const profileLink = `https://instagram.com/${cleanUsername}`;
  const totalQty = Number(quantity || (Number(posts || 5) * Number(max || min || 100)));

  // 1. Standard format for TeleSMM Auto services (profile link + total quantity)
  const defaultPayload = {
    action: 'add',
    service: String(service),
    link: profileLink,
    quantity: totalQty,
  };

  try {
    const result = await callSmmApi(defaultPayload);
    if (result && !result.error) {
      return result;
    }
    if (result?.error) {
      throw new Error(result.error);
    }
  } catch (err) {
    // If provider explicitly requires username/min/max format, try fallback
    if (err.message.includes('username') || err.message.includes('link')) {
      const subPayload = {
        action: 'add',
        service: String(service),
        username: cleanUsername,
        min: Number(min || 100),
        max: Number(max || 200),
        posts: Number(posts || 5),
      };
      if (delay && Number(delay) > 0) subPayload.delay = Number(delay);
      if (expiry) subPayload.expiry = expiry;

      const subResult = await callSmmApi(subPayload);
      if (subResult && subResult.error) {
        throw new Error(subResult.error);
      }
      return subResult;
    }
    throw err;
  }
}

