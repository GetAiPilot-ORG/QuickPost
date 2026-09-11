import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import supabase from './supabase.js';

const autodmTokenEncryptionKey = process.env.AUTODM_TOKEN_ENCRYPTION_KEY_BASE64;
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const IG_GRAPH_ORIGIN = (process.env.IG_GRAPH_BASE_URL || 'https://graph.instagram.com').replace(/\/$/, '');
const IG_GRAPH_VERSION = process.env.IG_GRAPH_VERSION || 'v24.0';
const IG_GRAPH_BASE = /\/v\d+\.\d+$/.test(IG_GRAPH_ORIGIN)
  ? IG_GRAPH_ORIGIN
  : `${IG_GRAPH_ORIGIN}/${IG_GRAPH_VERSION}`;
const IG_GRAPH_ROOT = IG_GRAPH_BASE.replace(/\/v\d+\.\d+$/, '');

function decryptTokenBundle(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string') return null;
  const parts = ciphertext.split(':');
  if (parts.length !== 4) return null;
  const [prefix, version, ivBase64, payloadBase64] = parts;
  if (prefix !== 'enc' || version !== 'v1') return null;

  try {
    const iv = Buffer.from(ivBase64, 'base64');
    const encrypted = Buffer.from(payloadBase64, 'base64');
    const tag = encrypted.subarray(encrypted.length - 16);
    const data = encrypted.subarray(0, encrypted.length - 16);

    const keys = [
      process.env.TOKEN_ENCRYPTION_KEY_BASE64,
      process.env.INSTAPILOT_TOKEN_ENCRYPTION_KEY_BASE64,
      process.env.AUTODM_TOKEN_ENCRYPTION_KEY_BASE64
    ].filter(Boolean);

    for (const keyBase64 of keys) {
      try {
        const key = Buffer.from(keyBase64, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        let decrypted = decipher.update(data, null, 'utf8');
        decrypted += decipher.final('utf8');
        return JSON.parse(decrypted);
      } catch (e) {
        // Try next key
      }
    }
  } catch (err) {
    console.warn('[AutoDM] Token decryption error:', err.message);
  }
  return null;
}

async function getDecryptedInstagramToken(userIds, targetInstagramAccountId = null) {
  let query = supabase
    .from('social_tokens')
    .select('access_token, instagram_business_id, page_id, username, profile_data')
    .in('user_id', userIds)
    .eq('provider', 'instagram')
    .order('updated_at', { ascending: false });

  if (targetInstagramAccountId) {
    query = query.or(`instagram_business_id.eq.${targetInstagramAccountId},page_id.eq.${targetInstagramAccountId}`);
  }

  const { data: token } = await query.limit(1).maybeSingle();

  let accessToken = token?.access_token;
  let instagramBusinessId = token?.instagram_business_id || token?.page_id || targetInstagramAccountId;
  let profileData = token?.profile_data || {};
  let originalTokenData = token || null;

  if (!accessToken) {
    if (!targetInstagramAccountId) {
      throw new Error('Instagram is not connected in Social Pilot.');
    }
    const { data: accountRows, error: accErr } = await supabase
      .from('instagram_accounts')
      .select('id, access_token_encrypted, username, instagram_business_account_id, instagram_user_id, page_id')
      .in('user_id', userIds)
      .limit(25);

    const requested = String(targetInstagramAccountId);
    const account = (accountRows || []).find((row) =>
      [
        row.id,
        row.instagram_business_account_id,
        row.instagram_user_id,
        row.page_id,
      ]
        .filter(Boolean)
        .map(String)
        .includes(requested)
    );

    if (accErr || !account?.access_token_encrypted) {
      throw new Error('Instagram is not connected in Social Pilot.');
    }

    const decrypted = decryptTokenBundle(account.access_token_encrypted);
    if (!decrypted?.pageAccessToken) {
      throw new Error('Failed to decrypt Instagram token for background sync.');
    }

    accessToken = decrypted.pageAccessToken;
    profileData = { username: account.username };
    originalTokenData = null;
  }

  if (accessToken.startsWith('enc:')) {
    const decrypted = decryptTokenBundle(accessToken);
    if (!decrypted?.pageAccessToken) {
      throw new Error('Instagram media sync needs a fresh Instagram connection.');
    }
    accessToken = decrypted.pageAccessToken;
  }

  return { accessToken, instagramBusinessId, profileData, originalTokenData };
}

function isDirectInstagramToken(accessToken) {
  return accessToken?.startsWith('IG') || accessToken?.startsWith('IGA');
}

function isPlaceholderInstagramUsername(username) {
  return /^ig_\d+$/i.test(String(username || '').trim());
}

function getGraphBaseForToken(accessToken) {
  return isDirectInstagramToken(accessToken) ? IG_GRAPH_BASE : GRAPH_BASE;
}

const getAutoDMSupabaseAdmin = () => {
  return supabase;
};

async function readGraphJson(url) {
  const res = await fetch(url.toString());
  const json = await res.json().catch(() => ({}));

  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `Instagram Graph API error (${res.status})`);
  }

  return json;
}

async function postGraphJson(url) {
  const res = await fetch(url.toString(), { method: 'POST' });
  const json = await res.json().catch(() => ({}));

  if (!res.ok || json?.error) {
    throw new Error(json?.error?.message || `Instagram Graph API error (${res.status})`);
  }

  return json;
}

function getAutoDMSubscribedFields() {
  return (
    process.env.AUTODM_SUBSCRIBED_FIELDS ||
    process.env.INSTAPILOT_SUBSCRIBED_FIELDS ||
    'messages,messaging_postbacks,comments'
  );
}

function getInstagramAccountGraphIds(account = {}) {
  return [
    account.instagram_user_id,
    account.instagram_business_account_id,
    account.page_id,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index);
}

async function markWebhookStatus(autoDMSupabase, accountId, status) {
  if (!accountId) return;

  const { error } = await autoDMSupabase
    .from('instagram_accounts')
    .update({ webhook_status: status, updated_at: new Date().toISOString() })
    .eq('id', accountId);

  const missingColumn =
    error &&
    (error.code === '42703' ||
      error.code === 'PGRST204' ||
      String(error.message || '').includes('webhook_status'));

  if (error && !missingColumn) {
    console.warn('[AUTODM-WEBHOOK] Failed updating webhook status:', error.message);
  }
}

async function ensureAutoDMWebhookSubscription(autoDMSupabase, account, accessToken, reason = 'autodm') {
  if (!account?.id || !accessToken || accessToken.startsWith('enc:')) {
    return { ok: false, skipped: true, reason: 'missing_plain_access_token' };
  }

  const subscribedFields = getAutoDMSubscribedFields();
  const graphIds = getInstagramAccountGraphIds(account);
  const endpoints = [];

  for (const graphId of graphIds) {
    endpoints.push(`${IG_GRAPH_BASE}/${graphId}/subscribed_apps`);
    endpoints.push(`${GRAPH_BASE}/${graphId}/subscribed_apps`);
  }

  let lastError = null;
  for (const endpoint of [...new Set(endpoints)]) {
    const url = new URL(endpoint);
    url.searchParams.set('access_token', accessToken);
    url.searchParams.set('subscribed_fields', subscribedFields);

    try {
      const response = await postGraphJson(url);
      await markWebhookStatus(autoDMSupabase, account.id, 'active');
      console.log('[AUTODM-WEBHOOK] Instagram webhook subscription active', {
        accountId: account.id,
        endpoint: endpoint.replace(/\/\d+\/subscribed_apps$/, '/<id>/subscribed_apps'),
        subscribedFields,
        reason,
      });
      return { ok: true, response, subscribedFields };
    } catch (error) {
      lastError = error;
    }
  }

  await markWebhookStatus(autoDMSupabase, account.id, 'configure_in_meta');
  console.warn('[AUTODM-WEBHOOK] Could not subscribe Instagram account to webhooks:', {
    accountId: account.id,
    graphIds,
    subscribedFields,
    reason,
    error: lastError?.message || 'Unknown error',
  });

  return {
    ok: false,
    skipped: false,
    reason: lastError?.message || 'subscription_failed',
  };
}

async function fetchFirstInstagramGraphJson({ urls, token, fieldsList, limit }) {
  let lastError = null;

  for (const fields of fieldsList) {
    for (const endpoint of urls) {
      const url = new URL(endpoint);
      url.searchParams.set('access_token', token);
      url.searchParams.set('fields', fields);
      if (limit) url.searchParams.set('limit', String(limit));

      try {
        return await readGraphJson(url);
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError || new Error('Instagram Graph API request failed');
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '')
  );
}

function getUserIds(userOrId) {
  const ids = typeof userOrId === 'string'
    ? [userOrId]
    : [userOrId?.userId, userOrId?.authUserId];

  return [...new Set(ids.filter(isUuid))];
}

function getPrimaryUserId(user) {
  return user?.userId || user?.authUserId;
}

function sortByCreatedAtDesc(rows = []) {
  return [...rows].sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );
}

function sortByMetricDateDesc(rows = []) {
  return [...rows].sort((a, b) => {
    const dateDiff = new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
    if (dateDiff !== 0) return dateDiff;
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
  });
}

async function getOwnedInstagramAccountIds(autoDMSupabase, user, { includeDisconnected = true } = {}) {
  let query = autoDMSupabase
    .from('instagram_accounts')
    .select('id')
    .in('user_id', getUserIds(user));

  if (!includeDisconnected) {
    query = query.eq('is_connected', true);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed loading owned Instagram accounts: ${error.message}`);
  }

  return (data || []).map((account) => account.id).filter(Boolean);
}

async function isAutomationAccessible(autoDMSupabase, user, automation) {
  if (!automation) return false;
  const userIds = getUserIds(user);
  if (userIds.includes(automation.user_id)) return true;
  if (!automation.instagram_account_id) return false;

  const ownedAccountIds = await getOwnedInstagramAccountIds(autoDMSupabase, user);
  return ownedAccountIds.includes(automation.instagram_account_id);
}

function getFirstResponseFlowText(responseFlow) {
  const nodes = Array.isArray(responseFlow?.nodes) ? responseFlow.nodes : [];
  const firstTextNode = nodes.find((node) =>
    ['text', 'quick_reply', 'button', 'template'].includes(String(node?.type || '').toLowerCase())
  );

  return (
    firstTextNode?.content ||
    firstTextNode?.text ||
    responseFlow?.opening_message ||
    ''
  );
}

function getLegacyAutomationMirrors(payload) {
  const keywords = Array.isArray(payload.keywords) ? payload.keywords : [];
  const keyword = keywords[0] ? String(keywords[0]).trim() : payload.keyword;
  const replyText =
    payload.reply_text ||
    payload.comment_reply_text ||
    getFirstResponseFlowText(payload.response_flow);

  return {
    keyword: keyword || '',
    reply_text: replyText ? String(replyText).trim() : '',
  };
}

const base64Url = (value) =>
  Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const bytesToBase64 = (buffer) => Buffer.from(buffer).toString('base64');

const getTokenEncryptionKey = () => {
  const primary =
    process.env.INSTAPILOT_TOKEN_ENCRYPTION_KEY_BASE64 ||
    process.env.AUTODM_TOKEN_ENCRYPTION_KEY_BASE64 ||
    process.env.TOKEN_ENCRYPTION_KEY_BASE64;
  if (!primary) {
    throw new Error('Missing INSTAPILOT_TOKEN_ENCRYPTION_KEY_BASE64 or TOKEN_ENCRYPTION_KEY_BASE64.');
  }

  const key = Buffer.from(primary, 'base64');
  if (key.length !== 32) {
    throw new Error('Token encryption key must decode to 32 bytes.');
  }

  return key;
};

export function signAutoDMBridgeToken(user) {
  return {
    token: 'dummy',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };
}

export async function startAutoDMInstagramOAuth(user, frontendUrl, authHeader, forceReconnect = true) {
  const supabaseUrl = process.env.SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error('Missing SUPABASE_URL in env.');
  }

  // Ensure we pass the active user auth token
  const token = authHeader || `Bearer ${process.env.SUPABASE_ANON_KEY}`;

  console.log(`🔗 [AUTODM-OAUTH] Invoking oauth-start Edge Function on Social Pilot Supabase: ${supabaseUrl}`);
  const response = await fetch(`${supabaseUrl}/functions/v1/oauth-start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
    },
    body: JSON.stringify({ frontendUrl, forceReconnect }),
  });

  const payload = await response.json().catch(async () => {
    const text = await response.text().catch(() => '');
    return text ? { error: text } : {};
  });

  if (!response.ok) {
    throw new Error(
      payload.details ||
        payload.error ||
        payload.message ||
        `AutoDM OAuth function failed with status ${response.status}`
    );
  }

  if (!payload?.redirectTo || typeof payload.redirectTo !== 'string') {
    throw new Error('AutoDM OAuth URL not returned by server');
  }

  return payload.redirectTo;
}

export async function encryptAutoDMTokenBundle(bundle) {
  const iv = crypto.randomBytes(12);
  const key = getTokenEncryptionKey();
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(JSON.stringify(bundle), 'utf8')),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([encrypted, authTag]);

  return `enc:v1:${bytesToBase64(iv)}:${bytesToBase64(payload)}`;
}

async function ensureAutoDMUser(user) {
  return;
}

async function fetchInstagramBusinessProfile({ accessToken, instagramBusinessId }) {
  const directToken = isDirectInstagramToken(accessToken);

  if (directToken) {
    let userId = instagramBusinessId;
    try {
      const meJson = await fetchFirstInstagramGraphJson({
        urls: [`${IG_GRAPH_BASE}/me`, `${IG_GRAPH_ROOT}/me`],
        token: accessToken,
        fieldsList: ['user_id,username', 'id,username'],
      });
      userId = meJson.user_id || meJson.id || instagramBusinessId;
    } catch (meError) {
      console.warn('[AUTODM] Fetch /me failed, falling back to instagramBusinessId:', meError.message);
    }

    const json = await fetchFirstInstagramGraphJson({
      urls: [`${IG_GRAPH_BASE}/${userId}`, `${IG_GRAPH_ROOT}/${userId}`],
      token: accessToken,
      fieldsList: [
        'id,username,name,profile_picture_url,followers_count,media_count,account_type',
        'id,username,name,profile_picture_url',
        'id,username',
      ],
    });

    return {
      id: json.id || userId,
      username: json.username,
      name: json.name,
      profile_picture_url: json.profile_picture_url,
      followers_count: json.followers_count,
      media_count: json.media_count,
      account_type: json.account_type,
    };
  } else {
    const json = await fetchFirstInstagramGraphJson({
      urls: [`${GRAPH_BASE}/${instagramBusinessId}`],
      token: accessToken,
      fieldsList: [
        'id,username,name,profile_picture_url,followers_count,media_count,account_type',
        'id,username,name,profile_picture_url',
        'id,username',
      ],
    });

    return {
      id: json.id || instagramBusinessId,
      username: json.username,
      name: json.name,
      profile_picture_url: json.profile_picture_url,
      followers_count: json.followers_count,
      media_count: json.media_count,
      account_type: json.account_type,
    };
  }
}

export async function importInstagramAccountToAutoDM(user, targetInstagramAccountId) {
  const autoDMSupabase = getAutoDMSupabaseAdmin();
  const userIds = getUserIds(user);
  const primaryUserId = getPrimaryUserId(user);
  let targetSocialInstagramId = targetInstagramAccountId;

  // Ensure user exists in AutoDM auth.users (required by FK constraint)
  await ensureAutoDMUser(user);

  if (targetInstagramAccountId && isUuid(targetInstagramAccountId)) {
    const { data: targetAccount, error: targetAccountError } = await autoDMSupabase
      .from('instagram_accounts')
      .select('instagram_business_account_id, instagram_user_id, page_id')
      .eq('id', targetInstagramAccountId)
      .in('user_id', userIds)
      .maybeSingle();

    if (targetAccountError) {
      throw new Error(`Failed to resolve selected Instagram account: ${targetAccountError.message}`);
    }

    targetSocialInstagramId =
      targetAccount?.instagram_business_account_id ||
      targetAccount?.instagram_user_id ||
      targetAccount?.page_id ||
      targetInstagramAccountId;
  }

  let query = supabase
    .from('social_tokens')
    .select('access_token, token_expiry, instagram_business_id, page_id, username, profile_data')
    .in('user_id', userIds)
    .eq('provider', 'instagram')
    .order('updated_at', { ascending: false });

  if (targetSocialInstagramId) {
    query = query.or(`instagram_business_id.eq.${targetSocialInstagramId},page_id.eq.${targetSocialInstagramId}`);
  }

  const { data: socialInstagram, error: socialError } = await query
    .limit(1)
    .maybeSingle();

  if (socialError) {
    throw new Error(`Failed to read Social Pilot Instagram connection: ${socialError.message}`);
  }

  if (!socialInstagram?.access_token || !socialInstagram?.instagram_business_id) {
    throw new Error('Instagram is not connected in Social Pilot.');
  }

  const profile = socialInstagram.profile_data || {};
  const tokenExpiryMs = socialInstagram.token_expiry
    ? new Date(socialInstagram.token_expiry).getTime()
    : null;
  const tokenExpired =
    profile.token_status === 'expired' ||
    (Number.isFinite(tokenExpiryMs) && tokenExpiryMs - Date.now() <= 60 * 1000);

  if (tokenExpired) {
    await autoDMSupabase
      .from('instagram_accounts')
      .update({
        is_connected: false,
        token_status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .in('user_id', userIds)
      .eq('instagram_user_id', socialInstagram.instagram_business_id);

    throw new Error('Instagram token expired. Please reconnect Instagram before syncing AutoDM.');
  }

  const liveProfile = await fetchInstagramBusinessProfile({
    accessToken: socialInstagram.access_token,
    instagramBusinessId: socialInstagram.instagram_business_id,
  }).catch((error) => {
    console.warn('[AUTODM] Live Instagram profile fetch failed:', error.message);
    return null;
  });
  const encryptedTokenBundle = await encryptAutoDMTokenBundle({
    pageAccessToken: socialInstagram.access_token,
    userAccessToken: socialInstagram.access_token,
  });

  const upsertPayload = {
    user_id: primaryUserId,
    instagram_user_id: socialInstagram.instagram_business_id,
    instagram_business_account_id: socialInstagram.instagram_business_id,
    username: liveProfile?.username || socialInstagram.username || profile.username || `ig_${socialInstagram.instagram_business_id}`,
    full_name: liveProfile?.name || profile.name || profile.full_name || null,
    profile_picture_url:
      liveProfile?.profile_picture_url ||
      profile.profile_picture_url ||
      profile.profilePicture ||
      profile.picture?.data?.url ||
      profile.picture ||
      null,
    account_type: 'BUSINESS',
    access_token_encrypted: encryptedTokenBundle,
    token_expires_at:
      socialInstagram.token_expiry || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
    is_connected: true,
    followers_count: liveProfile?.followers_count || profile.followers_count || null,
    media_count: liveProfile?.media_count || profile.media_count || null,
    page_id: socialInstagram.page_id || socialInstagram.instagram_business_id,
    webhook_status: 'configure_in_meta',
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await autoDMSupabase
    .from('instagram_accounts')
    .upsert(upsertPayload, { onConflict: 'user_id,instagram_business_account_id' })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to import Instagram account into AutoDM: ${error.message}`);
  }

  await ensureAutoDMWebhookSubscription(
    autoDMSupabase,
    data,
    socialInstagram.access_token,
    'import_instagram_account'
  );

  const { error: userSyncError } = await autoDMSupabase.from('users').upsert(
    {
      id: primaryUserId,
      email: user.email,
      name: user.name || user.email?.split('@')[0] || null,
      profile_picture: user.profilePicture || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (userSyncError) {
    console.warn('[AUTODM] Failed to sync user:', userSyncError.message);
  }

  return data;
}

export async function getAutoDMStatus(user) {
  const autoDMSupabase = getAutoDMSupabaseAdmin();
  const userIds = getUserIds(user);

  let [{ data: accounts, error: accountsError }, { data: socialTokens, error: socialError }] =
    await Promise.all([
      autoDMSupabase
        .from('instagram_accounts')
        .select('*')
        .in('user_id', userIds)
        .eq('is_connected', true)
        .order('created_at', { ascending: false }),
      supabase
        .from('social_tokens')
        .select('access_token, token_expiry, instagram_business_id, page_id, username, profile_data, provider')
        .in('user_id', userIds)
        .eq('provider', 'instagram')
        .order('updated_at', { ascending: false })
    ]);

  if (accountsError) {
    throw new Error(`Failed to load AutoDM accounts: ${accountsError.message}`);
  }
  if (socialError) {
    throw new Error(`Failed to load Social Pilot Instagram state: ${socialError.message}`);
  }

  const validSocialTokens = (socialTokens || []).filter(token => {
    const expiryMs = token.token_expiry ? new Date(token.token_expiry).getTime() : null;
    const isExpired = token.profile_data?.token_status === 'expired' ||
      (Number.isFinite(expiryMs) && expiryMs - Date.now() <= 60 * 1000);
    return !isExpired && (token.instagram_business_id || token.page_id);
  });

  const activeInstagramIds = validSocialTokens.map(t => t.instagram_business_id || t.page_id);
  const hasSocialInstagramConnection = activeInstagramIds.length > 0;
  
  // Filter removed so all connected accounts are returned

  // Auto-sync existing Social Pilot Instagram connection to AutoDM if not already imported
  for (const token of validSocialTokens) {
    const igId = token.instagram_business_id || token.page_id;
    const isImported = accounts.some(a => 
      a.instagram_user_id === igId || a.instagram_business_account_id === igId || a.page_id === igId
    );
    
    if (!isImported && token.access_token) {
      try {
        console.log(`🔄 [AUTODM-AUTO-SYNC] Auto-importing connected Instagram account ${igId} for user ${user.userId}...`);
        await importInstagramAccountToAutoDM(user, igId);
      } catch (syncErr) {
        console.warn(`⚠️ [AUTODM-AUTO-SYNC] On-the-fly AutoDM sync failed for ${igId}:`, syncErr.message);
      }
    }
  }

  // Reload accounts after potential auto-imports
  const { data: refreshedAccounts, error: refreshError } = await autoDMSupabase
    .from('instagram_accounts')
    .select('*')
    .in('user_id', userIds)
    .eq('is_connected', true)
    .order('created_at', { ascending: false });
    
  if (!refreshError && refreshedAccounts) {
    accounts = refreshedAccounts;
  }

  const hasPlaceholderAccount = (accounts || []).some((account) =>
    isPlaceholderInstagramUsername(account.username || account.instagram_username)
  );

  if (hasPlaceholderAccount) {
    try {
      console.log('[AUTODM-AUTO-SYNC] Repairing placeholder Instagram profile data...');
      // Re-import the primary one for safety if we find a placeholder
      const primaryToken = validSocialTokens[0];
      if (primaryToken) {
        await importInstagramAccountToAutoDM(user, primaryToken.instagram_business_id || primaryToken.page_id);
        
        const { data: repairedAccounts, error: repairError } = await autoDMSupabase
          .from('instagram_accounts')
          .select('*')
          .in('user_id', userIds)
          .eq('is_connected', true)
          .order('updated_at', { ascending: false });

        if (!repairError && repairedAccounts) {
          accounts = repairedAccounts;
        }
      }
    } catch (repairError) {
      console.warn('[AUTODM-AUTO-SYNC] Placeholder profile repair failed:', repairError.message);
    }
  }

  return {
    autodmAccounts: accounts || [],
    hasSocialInstagramConnection,
    socialInstagram: validSocialTokens[0] || null, // For backwards compatibility
    autoDMStorageReady: true,
    autoDMStorageError: null,
  };
}

function getAutoDMSupabaseForUserMutation() {
  return getAutoDMSupabaseAdmin();
}

function isForeignKeyViolation(error, constraintName) {
  return (
    error?.code === '23503' &&
    (!constraintName || String(error.message || '').includes(constraintName))
  );
}

function cleanAutomationPayload(payload = {}, user, { includeUserId = true } = {}) {
  const {
    id,
    created_at,
    updated_at,
    user_id,
    ...rest
  } = payload;

  const normalizedKeywords = Array.isArray(rest.keywords)
    ? [
        ...new Set(
          rest.keywords
            .map((keyword) => String(keyword || '').trim())
            .filter(Boolean)
        ),
      ]
    : undefined;
  const triggerType = String(rest.trigger_type || 'comment_on_post').trim();
  const mediaId = rest.media_id ? String(rest.media_id).trim() : null;
  const isCommentMediaTrigger = ['comment_on_post', 'comment_on_reel'].includes(triggerType);

  const normalizedPayload = {
    ...rest,
    trigger_type: triggerType,
    ...(normalizedKeywords ? { keywords: normalizedKeywords } : {}),
    ...(Object.prototype.hasOwnProperty.call(rest, 'media_id')
      ? { media_id: isCommentMediaTrigger ? mediaId : null }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(rest, 'comment_reply_text')
      ? { comment_reply_text: rest.comment_reply_text ? String(rest.comment_reply_text).trim() : null }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(rest, 'response_flow')
      ? {
          response_flow:
            rest.response_flow && typeof rest.response_flow === 'object'
              ? rest.response_flow
              : { nodes: [], opening_message_enabled: false, opening_message: '' },
        }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(rest, 'require_follow')
      ? { require_follow: Boolean(rest.require_follow) }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(rest, 'fallback_comment_reply')
      ? { fallback_comment_reply: rest.fallback_comment_reply ? String(rest.fallback_comment_reply).trim() : null }
      : {}),
    ...(includeUserId ? { user_id: getPrimaryUserId(user) } : {}),
    updated_at: new Date().toISOString(),
  };

  return {
    ...normalizedPayload,
    ...getLegacyAutomationMirrors(normalizedPayload),
  };
}

async function insertAutomationWithUserFallback(autoDMSupabase, payload, user) {
  const { user_id, ...basePayload } = payload;
  const candidateUserIds = [...new Set([user_id, ...getUserIds(user)].filter(Boolean))];
  let lastError = null;

  for (const candidateUserId of candidateUserIds) {
    const { data, error } = await autoDMSupabase
      .from('automations')
      .insert({ ...basePayload, user_id: candidateUserId })
      .select('*')
      .single();

    if (!error) return data;

    lastError = error;
    if (!isForeignKeyViolation(error, 'automations_user_id_fkey')) {
      break;
    }
  }

  throw lastError || new Error('Unknown automation insert error');
}

export async function listAutomationsForUser(user, { instagramAccountId } = {}) {
  const autoDMSupabase = getAutoDMSupabaseForUserMutation();
  const ownedAccountIds = await getOwnedInstagramAccountIds(autoDMSupabase, user, {
    includeDisconnected: false,
  });

  if (instagramAccountId) {
    if (!ownedAccountIds.includes(instagramAccountId)) return [];
    const { data, error } = await autoDMSupabase
      .from('automations')
      .select('*')
      .eq('instagram_account_id', instagramAccountId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to load Auto DM automations: ${error.message}`);
    return hydrateAutomationMetrics(autoDMSupabase, data || []);
  }

  if (ownedAccountIds.length === 0) return [];

  const accountResult = await autoDMSupabase
    .from('automations')
    .select('*')
    .in('instagram_account_id', ownedAccountIds)
    .order('created_at', { ascending: false });

  if (accountResult.error) {
    throw new Error(`Failed to load Auto DM account automations: ${accountResult.error.message}`);
  }

  const rowMap = new Map();
  for (const row of accountResult.data || []) {
    rowMap.set(row.id, row);
  }
  const data = Array.from(rowMap.values()).sort(
    (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  );

  return hydrateAutomationMetrics(autoDMSupabase, data);
}

async function hydrateAutomationMetrics(autoDMSupabase, data) {
  if (!data || data.length === 0) return [];

  const automationIds = data.map((a) => a.id);
  const mediaIds = data.map((a) => a.media_id).filter(Boolean);

  const [ { data: messages }, { data: webhooks } ] = await Promise.all([
    autoDMSupabase
      .from('messages')
      .select('automation_id, direction')
      .in('automation_id', automationIds),
    mediaIds.length > 0 
      ? autoDMSupabase
          .from('webhook_logs')
          .select('payload')
          .eq('event_type', 'comments')
          .in('payload->value->media->>id', mediaIds)
          .limit(1000)
      : { data: [] }
  ]);

  const metrics = {};
  automationIds.forEach(id => { metrics[id] = { inbound: 0, dmsSent: 0, webhookComments: 0 }; });

  for (const m of messages || []) {
    if (m.direction === 'outbound') metrics[m.automation_id].dmsSent++;
    if (m.direction === 'inbound') metrics[m.automation_id].inbound++;
  }

  for (const w of webhooks || []) {
    const mediaId = w.payload?.value?.media?.id;
    if (mediaId) {
      const automationsForMedia = data.filter(a => a.media_id === mediaId);
      automationsForMedia.forEach(a => { metrics[a.id].webhookComments++; });
    }
  }

  return data.map(automation => {
    const m = metrics[automation.id];
    return {
      ...automation,
      comments: Math.max(m.inbound, m.webhookComments),
      dms_sent: m.dmsSent,
    };
  });
}

export async function getAutomationForUser(user, automationId) {
  const autoDMSupabase = getAutoDMSupabaseForUserMutation();
  const { data, error } = await autoDMSupabase
    .from('automations')
    .select('*')
    .eq('id', automationId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load Auto DM automation: ${error.message}`);
  if (!(await isAutomationAccessible(autoDMSupabase, user, data))) {
    throw new Error('Automation not found');
  }
  return data;
}

const STORED_BRANDING_PATTERN =
  /\n*\s*_?(?:⚡\s*)?(?:Automation is powered by @Getaipilot|This automation powered by @getaipilot|This automation is from SocialPilot \(social\.getaipilot\.in\)|Automated via QuickPost\.co \(Get it Free\))_?\s*$/i;

function removeStoredBranding(value) {
  if (typeof value === 'string') return value.replace(STORED_BRANDING_PATTERN, '').trimEnd();
  if (Array.isArray(value)) return value.map(removeStoredBranding);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, removeStoredBranding(child)]),
    );
  }
  return value;
}

/**
 * Checks if any OTHER automation on the same account+post scope already uses
 * one of the given keywords. Returns the first conflicting automation found, or null.
 */
async function findKeywordConflict(autoDMSupabase, { instagramAccountId, mediaId, keywords, excludeAutomationId = null }) {
  if (!instagramAccountId || !Array.isArray(keywords) || keywords.length === 0) return null;

  let query = autoDMSupabase
    .from('automations')
    .select('id, name, keywords, media_id')
    .eq('instagram_account_id', instagramAccountId)
    .eq('is_active', true);

  if (excludeAutomationId) {
    query = query.neq('id', excludeAutomationId);
  }

  const { data: otherAutomations, error } = await query;
  if (error || !otherAutomations) return null;

  const incomingMediaId = mediaId ? String(mediaId).trim() : null;
  const incomingKeywordsLower = keywords.map((k) => String(k).trim().toLowerCase()).filter(Boolean);

  for (const other of otherAutomations) {
    const otherMediaId = other.media_id ? String(other.media_id).trim() : null;

    // Scope match: same specific post, or either one is "all posts" (null media_id)
    const sameScope =
      incomingMediaId === otherMediaId ||
      incomingMediaId === null ||
      otherMediaId === null;

    if (!sameScope) continue;

    const otherKeywordsLower = (other.keywords || []).map((k) => String(k).trim().toLowerCase());
    const overlap = incomingKeywordsLower.find((k) => otherKeywordsLower.includes(k));

    if (overlap) {
      return { automationId: other.id, automationName: other.name || 'Unnamed Automation', conflictKeyword: overlap };
    }
  }

  return null;
}

export async function createAutomationForUser(user, payload) {
  const autoDMSupabase = getAutoDMSupabaseForUserMutation();
  const cleanPayload = removeStoredBranding(cleanAutomationPayload(payload, user));

  // Server-side keyword conflict guard
  const conflict = await findKeywordConflict(autoDMSupabase, {
    instagramAccountId: cleanPayload.instagram_account_id,
    mediaId: cleanPayload.media_id,
    keywords: cleanPayload.keywords || [],
  });
  if (conflict) {
    throw new Error(
      `Keyword "${conflict.conflictKeyword}" is already used by automation "${conflict.automationName}". Each automation on the same post must have unique keywords.`
    );
  }

  try {
    const automation = await insertAutomationWithUserFallback(autoDMSupabase, cleanPayload, user);
    await ensureWebhookSubscriptionForAutomationPayload(
      autoDMSupabase,
      user,
      automation,
      'manual_automation_create'
    );
    return automation;
  } catch (error) {
    throw new Error(`Failed to create Auto DM automation: ${error?.message || 'Unknown error'}`);
  }
}

export async function updateAutomationForUser(user, automationId, payload) {
  const autoDMSupabase = getAutoDMSupabaseForUserMutation();
  const existing = await getAutomationForUser(user, automationId);
  if (!existing) throw new Error('Automation not found');

  const cleanPayload = removeStoredBranding(
    cleanAutomationPayload(payload, user, { includeUserId: false }),
  );

  // Server-side keyword conflict guard (exclude self)
  const conflict = await findKeywordConflict(autoDMSupabase, {
    instagramAccountId: cleanPayload.instagram_account_id || existing.instagram_account_id,
    mediaId: cleanPayload.media_id !== undefined ? cleanPayload.media_id : existing.media_id,
    keywords: cleanPayload.keywords || existing.keywords || [],
    excludeAutomationId: automationId,
  });
  if (conflict) {
    throw new Error(
      `Keyword "${conflict.conflictKeyword}" is already used by automation "${conflict.automationName}". Each automation on the same post must have unique keywords.`
    );
  }

  const { data, error } = await autoDMSupabase
    .from('automations')
    .update(cleanPayload)
    .eq('id', automationId)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update Auto DM automation: ${error.message}`);
  await ensureWebhookSubscriptionForAutomationPayload(
    autoDMSupabase,
    user,
    data,
    'manual_automation_update'
  );
  return data;
}

export async function deleteAutomationForUser(user, automationId) {
  const autoDMSupabase = getAutoDMSupabaseForUserMutation();
  const existing = await getAutomationForUser(user, automationId);
  if (!existing) throw new Error('Automation not found');

  const { error } = await autoDMSupabase
    .from('automations')
    .delete()
    .eq('id', automationId);

  if (error) throw new Error(`Failed to delete Auto DM automation: ${error.message}`);
  return true;
}

export async function fetchInstagramMediaForUser(user, limit = 30, targetInstagramAccountId = null) {
  const userIds = getUserIds(user);
  let resolvedTargetInstagramAccountId = targetInstagramAccountId;

  if (targetInstagramAccountId) {
    const { data: accounts, error: accountLookupError } = await getAutoDMSupabaseAdmin()
      .from('instagram_accounts')
      .select('id, instagram_business_account_id, instagram_user_id, page_id')
      .in('user_id', userIds);

    if (accountLookupError) {
      throw new Error(`Failed to resolve Instagram account: ${accountLookupError.message}`);
    }

    const requested = String(targetInstagramAccountId);
    const matchedAccount = (accounts || []).find((account) =>
      [
        account.id,
        account.instagram_business_account_id,
        account.instagram_user_id,
        account.page_id,
      ]
        .filter(Boolean)
        .map(String)
        .includes(requested)
    );

    resolvedTargetInstagramAccountId =
      matchedAccount?.instagram_business_account_id ||
      matchedAccount?.instagram_user_id ||
      matchedAccount?.page_id ||
      targetInstagramAccountId;
  }
  
  let accessToken, instagramBusinessId, profileData, originalTokenData;
  try {
    const res = await getDecryptedInstagramToken(userIds, resolvedTargetInstagramAccountId);
    accessToken = res.accessToken;
    instagramBusinessId = res.instagramBusinessId;
    profileData = res.profileData;
    originalTokenData = res.originalTokenData;
  } catch (e) {
    if (e.message.includes('needs a fresh Instagram connection')) {
      return {
        media: [],
        account: null,
        warning: e.message,
      };
    }
    throw e;
  }

  try {
    const directToken = isDirectInstagramToken(accessToken);
    const profile = await fetchInstagramBusinessProfile({
      accessToken: accessToken,
      instagramBusinessId: instagramBusinessId,
    }).catch((profileError) => {
      console.warn('[AUTODM] Instagram profile refresh before media failed:', profileError.message);
      return null;
    });

    let refreshedAccount = null;
    if (profile?.username) {
      const profileData = {
        ...(originalTokenData?.profile_data || {}),
        username: profile.username,
        name: profile.name || null,
        profile_picture_url: profile.profile_picture_url || null,
        followers_count: profile.followers_count ?? null,
        media_count: profile.media_count ?? null,
        account_type: profile.account_type || null,
      };

      const updates = [];
      if (originalTokenData) {
        updates.push(
          supabase
            .from('social_tokens')
            .update({
              username: profile.username,
              instagram_business_id: profile.id || instagramBusinessId,
              account_id: profile.id || instagramBusinessId,
              profile_data: profileData,
              updated_at: new Date().toISOString(),
            })
            .in('user_id', userIds)
            .eq('provider', 'instagram')
            .or(`instagram_business_id.eq.${instagramBusinessId},page_id.eq.${instagramBusinessId}`)
        );
      }

      updates.push(
        getAutoDMSupabaseAdmin()
          .from('instagram_accounts')
          .update({
            page_id: profile.id || instagramBusinessId,
            page_name: profile.name || profile.username,
            instagram_business_account_id: profile.id || instagramBusinessId,
            instagram_user_id: profile.id || instagramBusinessId,
            instagram_username: profile.username,
            username: profile.username,
            full_name: profile.name || null,
            profile_picture_url: profile.profile_picture_url || null,
            followers_count: profile.followers_count ?? null,
            media_count: profile.media_count ?? null,
            account_type: profile.account_type || null,
          })
          .in('user_id', userIds)
          .eq('instagram_business_account_id', instagramBusinessId)
      );

      await Promise.all(updates);

      const { data: accountAfterRefresh } = await getAutoDMSupabaseAdmin()
        .from('instagram_accounts')
        .select('*')
        .in('user_id', userIds)
        .eq('instagram_business_account_id', instagramBusinessId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      refreshedAccount = accountAfterRefresh || null;
    }

    const mediaUrls = directToken
      ? [
          `${IG_GRAPH_BASE}/${instagramBusinessId}/media`,
          `${IG_GRAPH_ROOT}/${instagramBusinessId}/media`,
          `${IG_GRAPH_BASE}/me/media`,
          `${IG_GRAPH_ROOT}/me/media`
        ]
      : [`${getGraphBaseForToken(accessToken)}/${instagramBusinessId}/media`];
    const json = await fetchFirstInstagramGraphJson({
      urls: mediaUrls,
      token: accessToken,
      fieldsList: [
        'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username,like_count,comments_count',
        'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username',
        'id,caption,media_type,permalink,timestamp',
      ],
      limit,
    });

    return { media: json.data || [], account: refreshedAccount };
  } catch (mediaError) {
    const message = mediaError?.message || 'Instagram Graph API error';
    console.warn('[AUTODM] Instagram media unavailable:', message);
    return { media: [], account: null, warning: message };
  }
}

function isAutoDMComposerEnabled(config) {
  return Boolean(config?.enabled && Array.isArray(config.keywords) && config.keywords.length);
}

function buildComposerAutomationPayload({ user, account, config, publication, sourceBroadcastId, sourceJobId }) {
  const triggerType =
    config.triggerType ||
    (publication?.mediaType === 'video' ? 'comment_on_reel' : 'comment_on_post');
  const responseFlow = config.responseFlow || { nodes: [], opening_message_enabled: false, opening_message: '' };
  const commentReplyText = config.commentReplyEnabled ? config.commentReplyText || null : null;
  const keywords = config.keywords || [];

  return {
    user_id: getPrimaryUserId(user),
    instagram_account_id: account.id,
    name: config.name || `Auto DM for ${publication?.mediaId || 'Instagram post'}`,
    trigger_type: triggerType,
    media_id: publication?.mediaId || null,
    media_url: publication?.permalink || publication?.mediaUrl || null,
    media_thumbnail: publication?.thumbnailUrl || publication?.mediaUrl || null,
    keywords,
    keyword: keywords[0] || '',
    is_case_sensitive: Boolean(config.isCaseSensitive),
    comment_reply_enabled: Boolean(config.commentReplyEnabled),
    comment_reply_text: commentReplyText,
    reply_text: commentReplyText || getFirstResponseFlowText(responseFlow),
    require_follow: Boolean(config.requireFollow),
    fallback_comment_reply: config.requireFollow ? (config.fallbackCommentReply || null) : null,
    response_flow: responseFlow,
    is_active: true,
    source: 'social_pilot_composer',
    source_broadcast_id: sourceBroadcastId || null,
    source_job_id: sourceJobId || null,
    updated_at: new Date().toISOString(),
  };
}

async function resolveImportedAutoDMInstagramAccount(autoDMSupabase, user) {
  const userIds = getUserIds(user);
  const { data: socialInstagram, error: socialError } = await supabase
    .from('social_tokens')
    .select('instagram_business_id, page_id')
    .in('user_id', userIds)
    .eq('provider', 'instagram')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (socialError) {
    throw new Error(`Failed to resolve Social Pilot Instagram account: ${socialError.message}`);
  }

  const instagramBusinessId = socialInstagram?.instagram_business_id;
  if (!instagramBusinessId) {
    throw new Error('Instagram is not connected in Social Pilot.');
  }

  let { data: account, error: accountError } = await autoDMSupabase
    .from('instagram_accounts')
    .select('*')
    .in('user_id', userIds)
    .eq('instagram_user_id', instagramBusinessId)
    .eq('is_connected', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (accountError) {
    throw new Error(`Failed to resolve Auto DM Instagram account: ${accountError.message}`);
  }

  if (!account) {
    account = await importInstagramAccountToAutoDM(user);
  }

  return account;
}

async function getLatestSocialInstagramToken(user) {
  const { data, error } = await supabase
    .from('social_tokens')
    .select('access_token')
    .in('user_id', getUserIds(user))
    .eq('provider', 'instagram')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read Instagram token for webhook subscription: ${error.message}`);
  }

  return data?.access_token || null;
}

async function ensureWebhookSubscriptionForAutomationPayload(autoDMSupabase, user, payload, reason) {
  const triggerType = String(payload?.trigger_type || '');
  if (!triggerType.startsWith('comment_') && triggerType !== 'live_comment') return;
  if (!payload?.instagram_account_id) return;

  try {
    const { data: account, error: accountError } = await autoDMSupabase
      .from('instagram_accounts')
      .select('*')
      .eq('id', payload.instagram_account_id)
      .in('user_id', getUserIds(user))
      .maybeSingle();

    if (accountError || !account) {
      console.warn('[AUTODM-WEBHOOK] Could not resolve automation account for subscription:', {
        accountId: payload.instagram_account_id,
        reason,
        error: accountError?.message || 'Account not found',
      });
      return;
    }

    const accessToken = await getLatestSocialInstagramToken(user);
    await ensureAutoDMWebhookSubscription(autoDMSupabase, account, accessToken, reason);
  } catch (error) {
    console.warn('[AUTODM-WEBHOOK] Subscription check failed:', {
      accountId: payload.instagram_account_id,
      reason,
      error: error?.message || String(error),
    });
  }
}

export async function createOrUpdateComposerAutomation({
  user,
  config,
  publication,
  sourceBroadcastId,
  sourceJobId,
}) {
  if (!isAutoDMComposerEnabled(config)) {
    return { skipped: true, reason: 'disabled' };
  }

  if (!publication?.success || !publication?.mediaId) {
    return { skipped: true, reason: 'instagram_not_published' };
  }

  const autoDMSupabase = getAutoDMSupabaseAdmin();
  await ensureAutoDMUser(user);
  const account = await resolveImportedAutoDMInstagramAccount(autoDMSupabase, user);
  const subscriptionToken = await getLatestSocialInstagramToken(user);
  await ensureAutoDMWebhookSubscription(
    autoDMSupabase,
    account,
    subscriptionToken,
    'composer_automation_binding'
  );
  const payload = buildComposerAutomationPayload({
    user,
    account,
    config,
    publication,
    sourceBroadcastId,
    sourceJobId,
  });

  if (sourceBroadcastId) {
    const { data: existing, error: findError } = await autoDMSupabase
      .from('automations')
      .select('id')
      .in('user_id', getUserIds(user))
      .eq('source_broadcast_id', sourceBroadcastId)
      .maybeSingle();

    const sourceColumnMissing =
      findError &&
      (findError.code === '42703' ||
        findError.code === 'PGRST204' ||
        String(findError.message || '').includes('source_broadcast_id'));

    if (findError && !sourceColumnMissing) {
      throw new Error(`Failed to check existing Auto DM automation: ${findError.message}`);
    }

    if (existing?.id) {
      const { user_id, ...updatePayload } = payload;
      const { data, error } = await autoDMSupabase
        .from('automations')
        .update(updatePayload)
        .eq('id', existing.id)
        .in('user_id', getUserIds(user))
        .select('*')
        .single();

      if (error) throw new Error(`Failed to update Auto DM automation: ${error.message}`);
      return { skipped: false, automation: data, updated: true };
    }
  }

  let data, error;
  try {
    data = await insertAutomationWithUserFallback(autoDMSupabase, payload, user);
    error = null;
  } catch (insertError) {
    data = null;
    error = insertError;
  }

  if (!error) {
    return { skipped: false, automation: data, updated: false };
  }

  if (error.code === '42703' || String(error.message || '').includes('source_')) {
    const { source, source_broadcast_id, source_job_id, ...legacyPayload } = payload;
    let legacyData, legacyError;
    try {
      legacyData = await insertAutomationWithUserFallback(autoDMSupabase, legacyPayload, user);
      legacyError = null;
    } catch (insertError) {
      legacyData = null;
      legacyError = insertError;
    }

    if (legacyError) {
      throw new Error(`Failed to create Auto DM automation: ${legacyError.message}`);
    }

    return {
      skipped: false,
      automation: legacyData,
      updated: false,
      warning: 'Auto DM source columns are missing; idempotency migration should be applied.',
    };
  }

  if (error.code === '23505' && sourceBroadcastId) {
    const { data: existing, error: existingError } = await autoDMSupabase
      .from('automations')
      .select('id')
      .in('user_id', getUserIds(user))
      .eq('source_broadcast_id', sourceBroadcastId)
      .maybeSingle();

    if (existingError || !existing?.id) {
      throw new Error(`Failed to recover duplicate Auto DM automation: ${existingError?.message || error.message}`);
    }

    const { user_id, ...updatePayload } = payload;
    const { data: updated, error: updateError } = await autoDMSupabase
      .from('automations')
      .update(updatePayload)
      .eq('id', existing.id)
      .in('user_id', getUserIds(user))
      .select('*')
      .single();

    if (updateError) throw new Error(`Failed to update Auto DM automation: ${updateError.message}`);
    return { skipped: false, automation: updated, updated: true };
  }

  throw new Error(`Failed to create Auto DM automation: ${error.message}`);
}

export async function listContactsForUser(user, { instagramAccountId } = {}) {
  const autoDMSupabase = getAutoDMSupabaseAdmin();
  const userIds = getUserIds(user);
  let query = autoDMSupabase
    .from('contacts')
    .select('*')
    .order('last_interaction_at', { ascending: false });

  if (instagramAccountId) {
    const ownedAccountIds = await getOwnedInstagramAccountIds(autoDMSupabase, user, { includeDisconnected: true });
    if (!ownedAccountIds.includes(instagramAccountId)) {
      throw new Error('Instagram account is not connected to this user.');
    }
    query = query.eq('instagram_account_id', instagramAccountId);
  } else {
    query = query.in('user_id', userIds);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load contacts: ${error.message}`);
  const contacts = data || [];
  if (contacts.length === 0) return contacts;

  const accountIds = [...new Set(contacts.map((contact) => contact.instagram_account_id).filter(Boolean))];
  const instagramUserIds = [...new Set(contacts.map((contact) => contact.instagram_user_id).filter(Boolean))];

  if (accountIds.length === 0 || instagramUserIds.length === 0) return contacts;

  const { data: conversations, error: conversationsError } = await autoDMSupabase
    .from('instagram_conversations')
    .select('instagram_account_id,instagram_user_id,instagram_username,instagram_name,profile_pic_url')
    .in('instagram_account_id', accountIds)
    .in('instagram_user_id', instagramUserIds);

  if (conversationsError) {
    console.warn('[AUTODM] Failed loading conversation profile data:', conversationsError.message);
    return contacts;
  }

  const profileByContactKey = new Map(
    (conversations || []).map((conversation) => [
      `${conversation.instagram_account_id}:${conversation.instagram_user_id}`,
      conversation,
    ])
  );

  return contacts.map((contact) => {
    const conversation = profileByContactKey.get(`${contact.instagram_account_id}:${contact.instagram_user_id}`);
    if (!conversation) return contact;

    return {
      ...contact,
      username: contact.username || conversation.instagram_username,
      full_name: contact.full_name || conversation.instagram_name,
      profile_picture_url: contact.profile_picture_url || conversation.profile_pic_url,
    };
  });
}

export async function listMessagesForContact(user, contactId) {
  const autoDMSupabase = getAutoDMSupabaseAdmin();
  const userIds = getUserIds(user);
  const ownedAccountIds = await getOwnedInstagramAccountIds(autoDMSupabase, user, { includeDisconnected: true });
  const { data: contact, error: contactError } = await autoDMSupabase
    .from('contacts')
    .select('id,user_id,instagram_account_id')
    .eq('id', contactId)
    .maybeSingle();

  if (contactError) throw new Error(`Failed to verify contact: ${contactError.message}`);
  if (!contact || (!userIds.includes(contact.user_id) && !ownedAccountIds.includes(contact.instagram_account_id))) {
    throw new Error('Contact is not accessible to this user.');
  }

  const { data, error } = await autoDMSupabase
    .from('messages')
    .select('*')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to load messages: ${error.message}`);
  return data || [];
}

export async function getDailyMetrics(user, { instagramAccountId, startDate } = {}) {
  const autoDMSupabase = getAutoDMSupabaseAdmin();
  const ownedAccountIds = await getOwnedInstagramAccountIds(autoDMSupabase, user, { includeDisconnected: true });

  const targetAccountIds = instagramAccountId
    ? (ownedAccountIds.includes(instagramAccountId) ? [instagramAccountId] : [])
    : ownedAccountIds;

  if (instagramAccountId && targetAccountIds.length === 0) {
    throw new Error('Instagram account is not connected to this user.');
  }

  // 1. Fetch from daily_metrics table
  let query = autoDMSupabase.from('daily_metrics').select('*');
  if (instagramAccountId) {
    query = query.eq('instagram_account_id', instagramAccountId);
  } else if (targetAccountIds.length > 0) {
    query = query.in('instagram_account_id', targetAccountIds);
  }
  if (startDate) {
    query = query.gte('date', startDate);
  }

  const { data: dbRows, error: dbError } = await query;
  if (dbError) {
    console.error('[AUTODM] Error fetching daily_metrics table:', dbError);
  }

  const rowMap = new Map();
  for (const row of dbRows || []) {
    rowMap.set(`${row.instagram_account_id}:${row.date}`, { ...row });
  }

  // 2. Fetch live aggregations from messages table to supplement/fallback
  if (targetAccountIds.length > 0) {
    let msgQuery = autoDMSupabase
      .from('messages')
      .select('instagram_account_id, direction, status, created_at')
      .in('instagram_account_id', targetAccountIds);

    if (startDate) {
      msgQuery = msgQuery.gte('created_at', `${startDate}T00:00:00Z`);
    }

    const { data: msgRows } = await msgQuery;
    for (const msg of msgRows || []) {
      const date = (msg.created_at || '').split('T')[0];
      if (!date) continue;
      const key = `${msg.instagram_account_id}:${date}`;
      const existing = rowMap.get(key) || {
        instagram_account_id: msg.instagram_account_id,
        date,
        messages_sent: 0,
        messages_seen: 0,
        total_clicks: 0,
        followers_gained: 0,
        leads_captured: 0,
      };

      if (!rowMap.has(key)) {
        if (msg.direction === 'outbound') {
          existing.messages_sent += 1;
          existing.messages_seen += 1;
        } else if (msg.direction === 'inbound') {
          existing.total_clicks += 1;
        }
        rowMap.set(key, existing);
      }
    }
  }

  return sortByMetricDateDesc(Array.from(rowMap.values()));
}

export async function getAutomationAnalytics(user, automationId) {
  const autoDMSupabase = getAutoDMSupabaseAdmin();

  // Verify ownership
  const { data: automation, error: automationError } = await autoDMSupabase
    .from('automations')
    .select('*')
    .eq('id', automationId)
    .maybeSingle();

  if (automationError) throw new Error(`Failed to verify automation: ${automationError.message}`);
  if (!(await isAutomationAccessible(autoDMSupabase, user, automation))) {
    throw new Error('Automation not found');
  }

  // Fetch account status to filter out stale connection errors and self-comments
  const { data: account } = await autoDMSupabase
    .from('instagram_accounts')
    .select('is_connected, instagram_user_id, instagram_business_account_id, page_id, username')
    .eq('id', automation.instagram_account_id)
    .maybeSingle();
  const isConnected = account?.is_connected !== false;

  const accountGraphIds = new Set(getInstagramAccountGraphIds(account || {}));
  const accountUsername = (account?.username || '').toLowerCase().trim();

  const [
    { data: messageRows },
    { data: sessionRows },
    { data: webhookRows },
  ] = await Promise.all([
    autoDMSupabase
      .from('messages')
      .select('direction, status, message_type, contact_id, created_at')
      .eq('instagram_account_id', automation.instagram_account_id)
      .eq('automation_id', automationId)
      .order('created_at', { ascending: false }),
    autoDMSupabase
      .from('automation_sessions')
      .select('status, created_at, updated_at')
      .eq('instagram_account_id', automation.instagram_account_id)
      .eq('automation_id', automationId),
    automation.media_id
      ? autoDMSupabase
          .from('webhook_logs')
          .select('payload, sender_id, ig_id, processing_error, message_text, created_at')
          .eq('event_type', 'comments')
          .order('created_at', { ascending: false })
          .limit(300)
      : { data: [] },
  ]);

  const contactIds = [...new Set((messageRows || []).map((r) => r.contact_id).filter(Boolean))];
  const { data: contactRows } =
    contactIds.length > 0
      ? await autoDMSupabase
          .from('contacts')
          .select('id, username, full_name, total_messages_sent, total_messages_received')
          .in('id', contactIds)
          .order('updated_at', { ascending: false })
          .limit(8)
      : { data: [] };

  let webhookCommentCount = 0;
  let followGateBlockedCount = 0;
  const recentErrors = [];
  for (const row of webhookRows || []) {
    if (row.payload?.value?.media?.id === automation.media_id) {
      const value = row.payload?.value || {};
      const senderId = String(row.sender_id || value?.from?.id || '').trim();
      const senderUsername = String(value?.from?.username || value?.from?.name || '').toLowerCase().trim();
      const igId = String(row.ig_id || value?.instagram_business_account_id || '').trim();

      // Skip self-comments / automated replies posted by the page itself
      if (
        (senderId && (accountGraphIds.has(senderId) || senderId === igId)) ||
        (accountUsername && senderUsername === accountUsername)
      ) {
        continue;
      }

      webhookCommentCount += 1;
      const legacyCrash = typeof row.message_text === 'string' && row.message_text.startsWith('CRASH:')
        ? row.message_text.replace(/^CRASH:\s*/, '')
        : null;
      const errorText = row.processing_error || legacyCrash;
      if (errorText) {
        if (errorText === 'follow_gate_blocked') {
          followGateBlockedCount += 1;
          continue;
        }
        if (errorText === 'account_not_connected' && isConnected) {
          continue;
        }
        recentErrors.push(String(errorText));
      }
    }
  }

  const outbound = (messageRows || []).filter((r) => r.direction === 'outbound');
  const inbound = (messageRows || []).filter((r) => r.direction === 'inbound');
  const successful = outbound.filter((r) => ['sent', 'delivered', 'seen'].includes(String(r.status || 'sent'))).length;
  const failed = outbound.filter((r) => r.status === 'failed').length;
  const dmsSent = outbound.length;
  const comments = Math.max(inbound.length, webhookCommentCount);
  const followersCommented = Math.max(0, comments - followGateBlockedCount);

  return {
    automation,
    comments,
    followGateBlockedCount,
    followersCommented,
    dmsSent,
    dms_sent: dmsSent,
    messagesSent: dmsSent,
    inboundMessages: inbound.length,
    uniqueContacts: contactIds.length,
    unique_contacts: contactIds.length,
    people: contactIds.length,
    successfulMessages: successful,
    successful_messages: successful,
    failedMessages: failed,
    failed: failed,
    successRate: dmsSent > 0 ? Math.round((successful / dmsSent) * 100) : 0,
    success_rate: dmsSent > 0 ? Math.round((successful / dmsSent) * 100) : 0,
    lastUsedAt: (messageRows || [])[0]?.created_at ?? null,
    pendingSessions: (sessionRows || []).filter((r) => r.status === 'pending').length,
    completedSessions: (sessionRows || []).filter((r) => r.status === 'completed').length,
    expiredSessions: (sessionRows || []).filter((r) => r.status === 'expired').length,
    recentContacts: contactRows || [],
    recentErrors: [...new Set(recentErrors)].slice(0, 4),
    followersBefore: automation.follower_count_at_create ?? null,
    followersNow: automation.latest_followers_count ?? null,
    followerGrowth:
      automation.follower_count_at_create != null && automation.latest_followers_count != null
        ? automation.latest_followers_count - automation.follower_count_at_create
        : null,
    postLikes: automation.media_like_count ?? null,
    postComments: automation.media_comments_count ?? null,
    postViews: automation.media_view_count ?? null,
    postCaption: automation.media_caption ?? null,
    postPermalink: automation.media_permalink ?? null,
    insightsSyncedAt: automation.media_insights_synced_at ?? null,
  };
}

export async function listAutomationComments(user, automationId, { limit = 100 } = {}) {
  const autoDMSupabase = getAutoDMSupabaseAdmin();
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 200);

  const { data: automation, error: automationError } = await autoDMSupabase
    .from('automations')
    .select('*')
    .eq('id', automationId)
    .maybeSingle();

  if (automationError) throw new Error(`Failed to verify automation: ${automationError.message}`);
  if (!(await isAutomationAccessible(autoDMSupabase, user, automation))) {
    throw new Error('Automation not found');
  }

  const accountGraphIds = new Set();
  let accountUsername = '';
  if (automation?.instagram_account_id) {
    const { data: account, error: accountError } = await autoDMSupabase
      .from('instagram_accounts')
      .select('instagram_user_id, instagram_business_account_id, page_id, username')
      .eq('id', automation.instagram_account_id)
      .maybeSingle();

    if (accountError) {
      throw new Error(`Failed loading Instagram account: ${accountError.message}`);
    }

    accountUsername = (account?.username || '').toLowerCase().trim();
    for (const id of getInstagramAccountGraphIds(account || {})) {
      accountGraphIds.add(String(id));
    }
  }

  const { data: rows, error } = await autoDMSupabase
    .from('webhook_logs')
    .select('id, ig_id, sender_id, message_text, processed, processing_error, event_id, payload, created_at')
    .eq('event_type', 'comments')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) throw new Error(`Failed to load comments: ${error.message}`);

  const comments = [];
  for (const row of rows || []) {
    const value = row.payload?.value || {};
    const mediaId = String(value?.media?.id || '').trim();
    const igId = String(row.ig_id || value?.instagram_business_account_id || '').trim();

    if (automation.media_id && mediaId !== String(automation.media_id)) continue;
    if (!automation.media_id && accountGraphIds.size > 0 && !accountGraphIds.has(igId)) continue;

    const senderId = String(row.sender_id || value?.from?.id || '').trim();
    const senderUsername = String(value?.from?.username || value?.from?.name || '').toLowerCase().trim();

    // Skip self-comments / automated replies posted by the account itself
    if (
      (senderId && (accountGraphIds.has(senderId) || senderId === igId)) ||
      (accountUsername && senderUsername === accountUsername)
    ) {
      continue;
    }

    comments.push({
      id: row.id,
      eventId: row.event_id || value?.id || null,
      mediaId: mediaId || null,
      senderId: row.sender_id || value?.from?.id || null,
      username: value?.from?.username || value?.from?.name || null,
      text: row.message_text || value?.text || '',
      createdAt: row.created_at,
      processed: Boolean(row.processed),
      processingError: row.processing_error || null,
      permalink: value?.permalink || null,
    });

    if (comments.length >= safeLimit) break;
  }

  return {
    automationId,
    mediaId: automation.media_id || null,
    comments,
    totalVisible: comments.length,
  };
}

export async function syncAutomationInsights(user, automationId) {
  const autoDMSupabase = getAutoDMSupabaseAdmin();

  const { data: automation, error: automationError } = await autoDMSupabase
    .from('automations')
    .select('*')
    .eq('id', automationId)
    .maybeSingle();

  if (automationError) throw new Error(`Failed to verify automation: ${automationError.message}`);
  if (!(await isAutomationAccessible(autoDMSupabase, user, automation))) {
    throw new Error('Automation not found');
  }

  const userIds = getUserIds(user);
  const { data: automations } = await autoDMSupabase
    .from('automations')
    .select('instagram_account_id')
    .eq('id', automationId)
    .maybeSingle();

  const targetInstagramAccountId = automations?.instagram_account_id;

  const { accessToken, instagramBusinessId } = await getDecryptedInstagramToken(userIds, targetInstagramAccountId);

  // Fetch account followers
  const graphBase = getGraphBaseForToken(accessToken);
  const accountUrl = new URL(`${graphBase}/${instagramBusinessId}`);
  accountUrl.searchParams.set('access_token', accessToken);
  accountUrl.searchParams.set('fields', 'followers_count');
  const accountRes = await fetch(accountUrl.toString());
  const accountJson = await accountRes.json();
  const followersNow = accountJson.followers_count ?? null;

  let matchedMedia = null;
  if (automation.media_id) {
    const mediaUrl = new URL(`${graphBase}/${automation.media_id}`);
    mediaUrl.searchParams.set('access_token', accessToken);
    mediaUrl.searchParams.set('fields', 'like_count,comments_count,permalink,caption');
    const mediaRes = await fetch(mediaUrl.toString());
    if (mediaRes.ok) matchedMedia = await mediaRes.json();
  }

  const updates = {
    ...(automation.follower_count_at_create == null && followersNow != null
      ? { follower_count_at_create: followersNow }
      : {}),
    latest_followers_count: followersNow,
    media_like_count: matchedMedia?.like_count ?? automation.media_like_count ?? null,
    media_comments_count: matchedMedia?.comments_count ?? automation.media_comments_count ?? null,
    media_caption: matchedMedia?.caption ?? automation.media_caption ?? null,
    media_permalink: matchedMedia?.permalink ?? automation.media_permalink ?? null,
    media_insights_synced_at: new Date().toISOString(),
  };

  const { data: updated, error: updateError } = await autoDMSupabase
    .from('automations')
    .update(updates)
    .eq('id', automationId)
    .select('*')
    .single();

  if (updateError) throw new Error(`Failed to update automation: ${updateError.message}`);
  return { automation: updated };
}
