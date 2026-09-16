import { corsHeaders, getSupabaseAdmin, logError, logInfo, requireEnv } from '../_shared/db.ts';
import {
  exchangeIGCodeForShortLivedToken,
  exchangeIGForLongLivedToken,
  fetchIGUserInfo,
} from '../_shared/metaService.ts';
import { encryptTokenBundle } from '../_shared/tokenService.ts';

interface OAuthStatePayload {
  uid: string;
  email?: string | null;
  iat: number;
  nonce: string;
  redirect: string;
}

interface InstagramProfile {
  id: string;
  username: string;
  name?: string | null;
  profile_picture_url?: string | null;
  followers_count?: number | null;
  media_count?: number | null;
  account_type?: string | null;
}

const DEFAULT_FRONTEND_URL = 'https://social.getaipilot.in';

const fromBase64Url = (input: string): string => {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return atob(padded);
};

const toBase64Url = (input: string): string =>
  btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

const hmacSign = async (message: string, secret: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return toBase64Url(String.fromCharCode(...new Uint8Array(signature)));
};

const getOAuthStateSecret = (): string => {
  const stateSecret =
    Deno.env.get('OAUTH_STATE_SECRET') ||
    Deno.env.get('IG_APP_SECRET') ||
    Deno.env.get('META_APP_SECRET');

  if (!stateSecret?.trim()) {
    throw new Error(
      'Missing required environment variable: OAUTH_STATE_SECRET or IG_APP_SECRET'
    );
  }

  return stateSecret.trim();
};

const verifyState = async (state: string): Promise<OAuthStatePayload> => {
  const [payloadEncoded, signature] = state.split('.');
  if (!payloadEncoded || !signature) {
    throw new Error('Invalid OAuth state');
  }

  const expected = await hmacSign(payloadEncoded, getOAuthStateSecret());
  if (!timingSafeEqual(expected, signature)) {
    throw new Error('OAuth state signature mismatch');
  }

  const payload = JSON.parse(fromBase64Url(payloadEncoded)) as OAuthStatePayload;
  if (!payload.uid || !payload.redirect || !payload.iat) {
    throw new Error('OAuth state missing required fields');
  }

  const maxAgeMs = 10 * 60 * 1000;
  if (Date.now() - payload.iat > maxAgeMs) {
    throw new Error('OAuth state expired');
  }

  return payload;
};

const redirectWithError = (frontendUrl: string, message: string) => {
  const url = new URL('/connect', frontendUrl);
  url.searchParams.set('error', message);
  return Response.redirect(url.toString(), 302);
};

const getInstagramOAuthCallbackUrl = (): string => {
  const callbackUrl =
    Deno.env.get('IG_OAUTH_CALLBACK_URL') ||
    Deno.env.get('META_OAUTH_CALLBACK_URL');

  if (!callbackUrl?.trim()) {
    throw new Error('Missing required environment variable: IG_OAUTH_CALLBACK_URL');
  }

  return callbackUrl.trim();
};

const getFallbackFrontendUrl = (): string => {
  const frontendUrl = Deno.env.get('FRONTEND_URL') || Deno.env.get('SITE_URL');
  return frontendUrl?.trim() || DEFAULT_FRONTEND_URL;
};

const buildFallbackInstagramProfile = (userId: string): InstagramProfile => ({
  id: userId,
  username: `ig_${userId}`,
  name: null,
  profile_picture_url: null,
  followers_count: 0,
  media_count: 0,
  account_type: 'BUSINESS',
});

const subscribeInstagramInboxWebhook = async (
  instagramUserId: string,
  accessToken: string,
  requestId: string
): Promise<boolean> => {
  const version = Deno.env.get('IG_GRAPH_VERSION') || 'v24.0';
  const fields =
    Deno.env.get('INBOX_INSTAGRAM_SUBSCRIBED_FIELDS') ||
    Deno.env.get('INSTAPILOT_SUBSCRIBED_FIELDS') ||
    'messages,messaging_postbacks,comments';
  const endpoints = [
    `https://graph.instagram.com/${version}/${instagramUserId}/subscribed_apps`,
    `https://graph.facebook.com/${version}/${instagramUserId}/subscribed_apps`,
  ];

  for (const endpoint of endpoints) {
    const target = new URL(endpoint);
    target.searchParams.set('access_token', accessToken);
    target.searchParams.set('subscribed_fields', fields);
    try {
      const response = await fetch(target, { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (response.ok && body?.success !== false && !body?.error) {
        logInfo('Unified inbox webhook subscription active', {
          requestId,
          instagramUserId,
          subscribedFields: fields,
        });
        return true;
      }
    } catch (error) {
      logError('Unified inbox webhook subscription attempt failed', {
        requestId,
        instagramUserId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return false;
};

const resolveAppUserId = async (
  supabase: ReturnType<typeof getSupabaseAdmin>,
  authUserId: string,
  email?: string | null
): Promise<string> => {
  const { data: byAuthId } = await supabase
    .from('users')
    .select('id')
    .eq('id', authUserId)
    .maybeSingle();

  if (byAuthId?.id) return byAuthId.id;

  if (email) {
    const { data: byEmail } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (byEmail?.id) return byEmail.id;
  }

  const fallbackEmail = email?.trim() || `${authUserId}@quickpost.local`;
  const { data: inserted, error: insertError } = await supabase
    .from('users')
    .insert({
      id: authUserId,
      email: fallbackEmail,
      name: fallbackEmail.split('@')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (!insertError && inserted?.id) return inserted.id;

  if (email) {
    const { data: afterRace } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (afterRace?.id) return afterRace.id;
  }

  throw new Error(`Failed resolving app user for Instagram OAuth: ${insertError?.message ?? 'user not found'}`);
};

Deno.serve(async (request: Request) => {
  const requestId = crypto.randomUUID();

  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error_description') || url.searchParams.get('error');

    const fallbackFrontendUrl = getFallbackFrontendUrl();
    if (oauthError) {
      return redirectWithError(fallbackFrontendUrl, oauthError);
    }
    if (!code || !state) {
      return redirectWithError(fallbackFrontendUrl, 'Instagram did not return an OAuth code');
    }

    const statePayload = await verifyState(state);
    const frontendUrl = statePayload.redirect || fallbackFrontendUrl;
    const callbackUrl = getInstagramOAuthCallbackUrl();

    const shortToken = await exchangeIGCodeForShortLivedToken(code, callbackUrl);
    const tokenForStorage = await exchangeIGForLongLivedToken(shortToken.access_token);
    const minLongLivedTtlSeconds = 24 * 60 * 60;

    if (!tokenForStorage.expires_in || tokenForStorage.expires_in < minLongLivedTtlSeconds) {
      throw new Error(
        'Instagram returned a short-lived token. Please reconnect; if this repeats, check IG_APP_SECRET and Instagram Login app settings.'
      );
    }

    let igUser: InstagramProfile;
    let profileSyncError: string | null = null;
    try {
      igUser = await fetchIGUserInfo(tokenForStorage.access_token);
    } catch (profileError) {
      profileSyncError = profileError instanceof Error ? profileError.message : String(profileError);
      logError('Instagram profile fetch failed after OAuth', {
        requestId,
        userId: shortToken.user_id,
        error: profileSyncError,
      });
      igUser = buildFallbackInstagramProfile(String(shortToken.user_id));
    }

    const encryptedToken = await encryptTokenBundle({
      pageAccessToken: tokenForStorage.access_token,
      userAccessToken: tokenForStorage.access_token,
    });
    const expiresAt = new Date(Date.now() + tokenForStorage.expires_in * 1000).toISOString();

    const supabase = getSupabaseAdmin();
    const appUserId = await resolveAppUserId(supabase, statePayload.uid, statePayload.email);
    const inboxWebhookActive = await subscribeInstagramInboxWebhook(
      igUser.id,
      tokenForStorage.access_token,
      requestId
    );
    const accountPayload = {
      user_id: appUserId,
      page_id: igUser.id,
      page_name: igUser.name ?? igUser.username ?? null,
      instagram_business_account_id: igUser.id,
      instagram_username: igUser.username,
      instagram_user_id: igUser.id,
      access_token_encrypted: encryptedToken,
      token_expires_at: expiresAt,
      username: igUser.username,
      full_name: igUser.name ?? null,
      profile_picture_url: igUser.profile_picture_url ?? null,
      account_type: igUser.account_type === 'CREATOR' ? 'CREATOR' : 'BUSINESS',
      followers_count: igUser.followers_count ?? 0,
      media_count: igUser.media_count ?? 0,
      is_connected: true,
      webhook_status: inboxWebhookActive ? 'active' : 'configure_in_meta',
      updated_at: new Date().toISOString(),
    };

    const { data: updatedAccount, error: updateError } = await supabase
      .from('instagram_accounts')
      .update(accountPayload)
      .eq('user_id', appUserId)
      .eq('instagram_business_account_id', igUser.id)
      .select('id')
      .maybeSingle();

    if (updateError) {
      throw new Error(`Failed updating Instagram account: ${updateError.message}`);
    }

    if (!updatedAccount) {
      const { error: insertError } = await supabase
        .from('instagram_accounts')
        .insert(accountPayload);

      if (insertError) {
        throw new Error(`Failed saving Instagram account: ${insertError.message}`);
      }
    }

    const { error: socialTokenError } = await supabase.from('social_tokens').upsert(
      {
        user_id: appUserId,
        provider: 'instagram',
        access_token: tokenForStorage.access_token,
        token_expiry: expiresAt,
        instagram_business_id: igUser.id,
        page_id: null,
        account_id: igUser.id,
        username: igUser.username,
        profile_data: {
          username: igUser.username,
          name: igUser.name ?? null,
          profile_picture_url: igUser.profile_picture_url ?? null,
          followers_count: igUser.followers_count ?? null,
          media_count: igUser.media_count ?? null,
          account_type: igUser.account_type ?? null,
          profile_sync_status: profileSyncError ? 'pending' : 'synced',
          profile_sync_error: profileSyncError,
          token_status: 'active',
          token_lifecycle: 'long_lived',
          token_expires_at: expiresAt,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider,account_id' }
    );

    if (socialTokenError) {
      throw new Error(`Failed saving Instagram social token: ${socialTokenError.message}`);
    }

    logInfo('Instagram OAuth callback completed', {
      requestId,
      userId: appUserId,
      authUserId: statePayload.uid,
      igId: igUser.id,
      username: igUser.username,
    });

    const successUrl = new URL('/connect/success', frontendUrl);
    successUrl.searchParams.set('username', igUser.username);
    return Response.redirect(successUrl.toString(), 302);
  } catch (error) {
    logError('OAuth callback failed', {
      requestId,
      error: error instanceof Error ? error.message : String(error),
    });

    let frontendUrl = getFallbackFrontendUrl();
    const rawState = new URL(request.url).searchParams.get('state');

    if (rawState) {
      try {
        const statePayload = await verifyState(rawState);
        frontendUrl = statePayload.redirect || frontendUrl;
      } catch (stateError) {
        logError('OAuth callback error redirect state unavailable', {
          requestId,
          error: stateError instanceof Error ? stateError.message : String(stateError),
        });
      }
    }

    return redirectWithError(
      frontendUrl,
      error instanceof Error ? error.message : 'Unable to connect Instagram'
    );
  }
});
