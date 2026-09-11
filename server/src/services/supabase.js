import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { supermailbox } from './supermailbox.js';

dotenv.config();

// ✅ Server-side should use SERVICE ROLE key (recommended)
// Fallback to ANON for local dev only (may fail with RLS)
const supabaseUrl = process.env.SUPABASE_URL;
let supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey || supabaseKey.startsWith('ROTATE_ME')) {
  supabaseKey = process.env.SUPABASE_ANON_KEY;
}

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase credentials. Required: SUPABASE_URL and SUPABASE_SERVICE_KEY (recommended) or SUPABASE_ANON_KEY (dev only).'
  );
}

if ((!process.env.SUPABASE_SERVICE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) || (supabaseKey === process.env.SUPABASE_ANON_KEY)) {
  console.warn(
    '⚠️ You are using SUPABASE_ANON_KEY on the server. Some writes may fail due to RLS. Prefer SUPABASE_SERVICE_KEY.'
  );
}

const supabase = createClient(supabaseUrl, supabaseKey);

const MULTI_ACCOUNT_PROVIDERS = [
  'youtube',
  'facebook',
  'pinterest',
  'bluesky',
  'linkedin',
  'mastodon',
  'threads',
  'x',
  'reddit',
  'googleBusiness',
];

const accountArrayKey = (provider) => `${provider}Accounts`;

function getProfilePicture(row) {
  const pd = row.profile_data || {};
  return (
    pd.picture?.data?.url ||
    pd.profile_picture_url ||
    pd.threads_profile_picture_url ||
    pd.picture ||
    pd.profilePicture ||
    pd.profileImage ||
    pd.avatar_url ||
    pd.avatar ||
    pd.profile_image_url ||
    pd.profileImageUrl ||
    null
  );
}

function normalizeProviderKey(provider) {
  return provider === 'google-business' ? 'googleBusiness' : provider;
}

function socialTokenToAccount(row) {
  const longUploadsStatus = row.profile_data?.youtubeStatus?.longUploadsStatus || null;
  return {
    id: row.id,
    provider: normalizeProviderKey(row.provider),
    connected: true,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiry: row.token_expiry || row.expires_at || null,
    token_expiry: row.token_expiry || row.expires_at || null,
    expires_at: row.expires_at || null,
    pageId: row.page_id || row.facebook_page_id || row.account_id || null,
    page_id: row.page_id || row.facebook_page_id || row.account_id || null,
    businessId: row.instagram_business_id || null,
    instagram_business_id: row.instagram_business_id || null,
    accountId: row.account_id || row.page_id || row.instagram_business_id || row.bluesky_did || row.username || row.id,
    account_id: row.account_id || row.page_id || row.instagram_business_id || row.bluesky_did || row.username || row.id,
    did: row.bluesky_did || null,
    bluesky_did: row.bluesky_did || null,
    handle: row.bluesky_handle || row.username || null,
    bluesky_handle: row.bluesky_handle || null,
    instanceUrl: row.mastodon_instance || null,
    mastodon_instance: row.mastodon_instance || null,
    profileData: row.profile_data || null,
    profile_data: row.profile_data || null,
    username: row.username || row.account_name || row.profile_data?.username || row.profile_data?.name || null,
    profilePicture: getProfilePicture(row),
    boardId: row.pinterest_board_id || row.profile_data?.boardId || null,
    verified: row.provider === 'youtube' ? longUploadsStatus === 'allowed' : undefined,
    longUploadsStatus,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hub Sync Helper
// Syncs this user to getaipilot.in (hub) database — fire-and-forget.
// Called after every createOrUpdateUser() success.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string} opts.email
 * @param {string} [opts.name]
 * @param {string} [opts.google_id]   numeric Google ID string
 * @param {string} [opts.profile_picture]
 * @param {string} opts.social_user_id  UUID from social DB
 * @param {object} [opts.subscription]
 */
async function syncUserToHub(opts) {
  const hubFnUrl    = process.env.HUB_SYNC_FUNCTION_URL;  // e.g. https://uklxlappjcuvdqjvecfh.supabase.co/functions/v1/sync-from-social
  const syncSecret  = process.env.SOCIAL_SYNC_SECRET;

  if (!hubFnUrl || !syncSecret) {
    // Not configured — skip silently in dev
    return;
  }

  try {
    const res = await fetch(hubFnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-sync-secret': syncSecret,
      },
      body: JSON.stringify(opts),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      console.log(`✅ [HUB-SYNC] User synced to hub: ${opts.email} → hub_user_id=${data.hub_user_id}`);
    } else {
      console.warn(`⚠️ [HUB-SYNC] Sync returned ${res.status}:`, data);
    }
  } catch (err) {
    console.warn('⚠️ [HUB-SYNC] Fire-and-forget sync failed (non-fatal):', err.message);
  }
}

const tokensCache = new Map();
const TOKENS_CACHE_TTL_MS = 60 * 1000; // 60 seconds

export function clearTokensCache(userId) {
  if (userId) tokensCache.delete(userId);
  else tokensCache.clear();
}

/**
 * Fetch social media tokens for a user (all providers)
 * @param {string} userId
 * @returns {Object} { instagram, facebook, youtube, pinterest }
 */
export async function getTokensForUser(userId) {
  try {
    const now = Date.now();
    const cached = tokensCache.get(userId);
    if (cached && (now - cached._cachedAt < TOKENS_CACHE_TTL_MS)) {
      return cached.data;
    }

    const { data, error } = await supabase
      .from('social_tokens')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No tokens found for this user');

    const tokens = {
      instagram: null,
      facebook: null,
      youtube: null,
      pinterest: null,
      bluesky: null,
      linkedin: null,
      mastodon: null,
      x: null,
      googleBusiness: null,
      threads: null,
    };
    for (const provider of MULTI_ACCOUNT_PROVIDERS) {
      tokens[accountArrayKey(provider)] = [];
    }

    for (const row of data) {
      const providerKey = normalizeProviderKey(row.provider);
      if (MULTI_ACCOUNT_PROVIDERS.includes(providerKey)) {
        const account = socialTokenToAccount(row);
        tokens[accountArrayKey(providerKey)].push(account);
        if (!tokens[providerKey]) tokens[providerKey] = account;
        continue;
      }

      if (row.provider === 'instagram') {
        tokens.instagram = {
          id: row.id,
          accessToken: row.access_token,
          businessId: row.instagram_business_id,
          pageId: row.page_id,
          accountId: row.account_id,
          tokenExpiry: row.token_expiry,
          username: row.username
        };
      }
    } // End of for loop

    // Also fetch from instagram_accounts to support multiple IG accounts
    const { data: igData, error: igError } = await supabase
      .from('instagram_accounts')
      .select('*')
      .eq('user_id', userId)
      .eq('is_connected', true);
      
    if (!igError && igData) {
      tokens.instagramAccounts = igData;
    } else {
      tokens.instagramAccounts = [];
    }

    tokensCache.set(userId, { data: tokens, _cachedAt: Date.now() });
    return tokens;
  } catch (err) {
    console.error('💥 [SUPABASE] getTokensForUser error:', err?.message || err);
    throw new Error(`Failed to fetch tokens: ${err.message || err}`);
  }
}

/**
 * Get user by email
 */
export async function getUserByEmail(email) {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('User not found');
  return data;
}

/**
 * Create or update user
 * @param {string} email
 * @param {string} name
 * @param {string} externalId - Can be Google ID or Supabase UUID
 * @param {string} profilePicture
 */
export async function createOrUpdateUser(email, name, externalId = null, profilePicture = null) {
  try {
    let existingUser = null;

    // Try find by externalId (which we now store as id or google_id)
    if (externalId) {
      // First try to match the ID directly (for Supabase UUIDs)
      const { data: byId } = await supabase
        .from('users')
        .select('*')
        .eq('id', externalId)
        .maybeSingle();
      
      if (byId) {
        existingUser = byId;
      } else {
        // Then try by google_id (legacy)
        const { data: byGoogleId } = await supabase
          .from('users')
          .select('*')
          .eq('google_id', externalId)
          .maybeSingle();
        existingUser = byGoogleId;
      }
    }

    // Fallback by email
    if (!existingUser && email) {
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .maybeSingle();
      existingUser = data;
    }

    const updates = {
      email,
      name,
      updated_at: new Date().toISOString()
    };

    if (profilePicture) updates.profile_picture = profilePicture;
    
    // If it looks like a Google ID (numeric string), put it in google_id
    if (externalId && /^\d+$/.test(externalId)) {
      updates.google_id = externalId;
    }

    if (existingUser) {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', existingUser.id)
        .select()
        .single();

      if (error) throw error;

      // Sync updated profile with SupermailBox central contact repository
      supermailbox.syncUser({
        id: data.id,
        email: data.email,
        fullName: data.name,
        attributes: { project: 'QuickPost' }
      }).catch(err => console.warn('[SupermailBox SDK] Contact sync failed:', err?.message));

      return data;
    }

    // New user
    const newUser = { ...updates, created_at: new Date().toISOString() };
    
    // If we have a UUID from Supabase, use it as the primary key
    if (externalId && externalId.length > 20 && externalId.includes('-')) {
      newUser.id = externalId;
    }

    const { data, error } = await supabase
      .from('users')
      .insert([newUser])
      .select()
      .single();

    if (error) throw error;

    // 1. Sync new user profile with SupermailBox
    supermailbox.syncUser({
      id: data.id,
      email: data.email,
      fullName: data.name,
      attributes: { project: 'QuickPost', new_user: true }
    }).catch(err => console.warn('[SupermailBox SDK] Contact sync failed:', err?.message));

    // 2. Send Welcome Email via SupermailBox
    supermailbox.sendEmail({
      to: data.email,
      templateKey: 'auth_welcome',
      variables: {
        name: data.name || data.email,
        otp_code: 'VERIFIED'
      }
    }).catch(err => console.warn('[SupermailBox SDK] Send welcome email failed:', err?.message));

    return data;
  } catch (err) {
    console.error('💥 [SUPABASE] createOrUpdateUser error:', err?.message || err);
    throw new Error(`Failed to create/update user: ${err.message || err}`);
  }
}

/**
 * Get connected accounts for a user (returns metadata)
 * Compatible with your /auth/accounts endpoint
 */
export async function getConnectedAccounts(userOrId) {
  try {
    const userIds = typeof userOrId === 'string'
      ? [userOrId].filter(Boolean)
      : [...new Set([userOrId?.userId, userOrId?.authUserId].filter(Boolean))];

    const { data, error } = await supabase
      .from('social_tokens')
      .select('id, provider, updated_at, token_expiry, expires_at, page_id, instagram_business_id, account_id, bluesky_did, bluesky_handle, profile_data, mastodon_instance, username, pinterest_board_id')
      .in('user_id', userIds);

    console.log(`\n📊 [SUPABASE] Raw social_tokens for user ${userIds.join(',')}:`, data?.map(d => d.provider));

    if (error) {
       console.error('💥 [SUPABASE] getConnectedAccounts query error:', error.message);
       // If it's a "column does not exist" error, we still want to return what we have (nothing) 
       // but we shouldn't throw a generic error that hides everything else if we can help it.
    }

    const providers = ['youtube', 'instagram', 'facebook', 'pinterest', 'bluesky', 'linkedin', 'mastodon', 'threads', 'x', 'reddit', 'googleBusiness'];
    const result = {};
    for (const p of providers) result[p] = { connected: false };
    for (const p of MULTI_ACCOUNT_PROVIDERS) result[accountArrayKey(p)] = [];

    for (const row of data || []) {
      const providerKey = normalizeProviderKey(row.provider);
      const account = socialTokenToAccount(row);

      result[providerKey] = {
        connected: true,
        updated_at: row.updated_at,
        token_expiry: row.token_expiry || row.expires_at || null,
        page_id: row.page_id || null,
        instagram_business_id: row.instagram_business_id || null,
        account_id: row.account_id || null,
        bluesky_did: row.bluesky_did || null,
        bluesky_handle: row.bluesky_handle || null,
        username: row.username || null,
        profilePicture: account.profilePicture,
        verified: account.verified,
        longUploadsStatus: account.longUploadsStatus,
      };

      if (MULTI_ACCOUNT_PROVIDERS.includes(providerKey)) {
        result[accountArrayKey(providerKey)].push(account);
      }
    }

    // Fetch multiple instagram accounts
    const { data: igData } = await supabase
      .from('instagram_accounts')
      .select('id, instagram_business_account_id, instagram_username, profile_picture_url, token_expires_at, updated_at')
      .in('user_id', userIds)
      .eq('is_connected', true);

    if (igData && igData.length > 0) {
      result.instagramAccounts = igData.map(acc => ({
        id: acc.id,
        connected: true,
        instagram_business_id: acc.instagram_business_account_id,
        username: acc.instagram_username,
        profilePicture: acc.profile_picture_url,
        token_expiry: acc.token_expires_at,
        updated_at: acc.updated_at
      }));
      // Ensure 'instagram' key shows connected if there's at least one
      result.instagram.connected = true;
    } else {
      result.instagramAccounts = [];
    }

    console.log(`✅ [SUPABASE] Final connected status:`, Object.keys(result).filter(k => result[k].connected));
    return result;
  } catch (err) {
    console.error('💥 [SUPABASE] getConnectedAccounts unexpected error:', err?.message || err);
    // return safe default only on catastrophic failure
    return {
      instagram: { connected: false },
      facebook: { connected: false },
      youtube: { connected: false },
      pinterest: { connected: false },
      bluesky: { connected: false },
      linkedin: { connected: false },
      mastodon: { connected: false },

      threads: { connected: false },
      x: { connected: false },
      reddit: { connected: false }
    };
  }
}

export default supabase;
