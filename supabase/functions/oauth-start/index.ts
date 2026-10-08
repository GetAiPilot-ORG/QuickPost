import { getAuthenticatedUser, json, logError, logInfo, requireEnv, corsHeaders } from '../_shared/db.ts';

const SCOPES = [
  'instagram_business_basic',
  'instagram_business_manage_messages',
  'instagram_business_manage_comments',
  'instagram_business_content_publish',
  'instagram_business_manage_insights',
  'instagram_manage_engagement',
].join(',');

const getInstagramOAuthCallbackUrl = (): string => {
  const callbackUrl =
    Deno.env.get('IG_OAUTH_CALLBACK_URL') ||
    Deno.env.get('META_OAUTH_CALLBACK_URL');

  if (!callbackUrl?.trim()) {
    throw new Error('Missing required environment variable: IG_OAUTH_CALLBACK_URL');
  }

  return callbackUrl.trim();
};

const getFrontendUrlFromEnv = (): string | null => {
  const frontendUrl = Deno.env.get('FRONTEND_URL') || Deno.env.get('SITE_URL');
  return frontendUrl?.trim() || null;
};

const DEFAULT_FRONTEND_URL = 'https://social.getaipilot.in';

const normalizeFrontendUrl = (value: string | null | undefined): string | null => {
  if (!value?.trim()) return null;

  try {
    const parsed = new URL(value.trim());
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
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

const toBase64Url = (input: string): string =>
  btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

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

Deno.serve(async (request: Request) => {
  const requestId = crypto.randomUUID();

  try {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (!['GET', 'POST'].includes(request.method)) {
      return json(405, { error: 'Method not allowed' }, corsHeaders);
    }

    const authHeader = request.headers.get('Authorization');
    const jwtSecretOverride = request.headers.get('x-jwt-secret');
    const { user, error } = await getAuthenticatedUser(authHeader, jwtSecretOverride);
    if (error || !user) {
      return json(401, { error: error ?? 'Unauthorized' }, corsHeaders);
    }

    const callbackUrl = getInstagramOAuthCallbackUrl();
    const appId = requireEnv('IG_APP_ID');
    const stateSecret = getOAuthStateSecret();

    // Prefer the frontend URL sent by the browser (supports both live & ngrok).
    // Fall back to the environment variable if not provided.
    let bodyFrontendUrl: string | undefined;
    let forceReconnect = false;
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        if (body?.frontendUrl && typeof body.frontendUrl === 'string') {
          bodyFrontendUrl = body.frontendUrl;
        }
        forceReconnect = body?.forceReconnect === true;
      } catch {
        // ignore JSON parse errors — body is optional
      }
    }
    const frontendUrl =
      normalizeFrontendUrl(bodyFrontendUrl) ||
      normalizeFrontendUrl(getFrontendUrlFromEnv()) ||
      DEFAULT_FRONTEND_URL;

    const statePayload = {
      uid: user.id,
      email: user.email ?? null,
      iat: Date.now(),
      nonce: crypto.randomUUID(),
      redirect: frontendUrl,
    };

    const payloadEncoded = toBase64Url(JSON.stringify(statePayload));
    const signature = await hmacSign(payloadEncoded, stateSecret);
    const state = `${payloadEncoded}.${signature}`;

    const authUrl = new URL('https://www.instagram.com/oauth/authorize');
    authUrl.searchParams.set('enable_fb_login', '0');
    if (forceReconnect) {
      authUrl.searchParams.set('force_authentication', '1');
      authUrl.searchParams.set('force_reauth', 'true');
    }
    authUrl.searchParams.set('client_id', appId);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', SCOPES);

    logInfo('OAuth start generated', {
      requestId,
      userId: user.id,
    });

    if (request.method === 'GET') {
      return Response.redirect(authUrl.toString(), 302);
    }

    return json(
      200,
      {
        redirectTo: authUrl.toString(),
        state,
      },
      corsHeaders
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError('OAuth start failed', {
      requestId,
      error: message,
    });
    return json(
      500,
      {
        error: 'Unable to start OAuth flow',
        details: message,
        requestId,
      },
      corsHeaders
    );
  }
});
