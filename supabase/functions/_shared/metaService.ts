import { logError, logInfo, requireEnv } from './db.ts';

const GRAPH_VERSION = 'v19.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const IG_GRAPH_BASE_URL = 'https://graph.instagram.com';
const IG_GRAPH_VERSION = 'v24.0';
const IG_GRAPH_API_BASE_URL = `${IG_GRAPH_BASE_URL}/${IG_GRAPH_VERSION}`;
const IG_API_BASE_URL = 'https://api.instagram.com';

interface GraphErrorResponse {
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export interface MetaPage {
  id: string;
  access_token: string;
  instagram_business_account?: {
    id: string;
    username?: string;
  };
}

export interface ShortTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

export interface LongTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

const buildGraphUrl = (path: string, params: Record<string, string>) => {
  const url = new URL(`${GRAPH_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url;
};

const withAccessToken = (url: string, accessToken: string): string => {
  const parsed = new URL(url);
  parsed.searchParams.set('access_token', accessToken);
  return parsed.toString();
};

const parseGraphResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const json = text ? (JSON.parse(text) as T & GraphErrorResponse) : ({} as T & GraphErrorResponse);

  if (!response.ok) {
    const errorMessage =
      json?.error?.message ?? `Graph API request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  if ((json as GraphErrorResponse).error) {
    throw new Error((json as GraphErrorResponse).error?.message ?? 'Unknown Graph API error');
  }

  return json;
};

const fetchFirstInstagramResponse = async <T>(
  endpoints: string[],
  accessToken: string,
  fieldsList: string[],
  extraParams: Record<string, string> = {}
): Promise<T> => {
  let lastError: unknown;

  for (const fields of fieldsList) {
    for (const endpoint of endpoints) {
      const url = new URL(endpoint);
      url.searchParams.set('access_token', accessToken);
      url.searchParams.set('fields', fields);
      for (const [key, value] of Object.entries(extraParams)) {
        url.searchParams.set(key, value);
      }

      try {
        return await parseGraphResponse<T>(await fetch(url.toString()));
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Instagram Graph API request failed');
};

export const exchangeCodeForShortLivedToken = async (code: string, redirectUri: string) => {
  const clientId = requireEnv('META_APP_ID');
  const clientSecret = requireEnv('META_APP_SECRET');

  const url = buildGraphUrl('/oauth/access_token', {
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(url);
  return parseGraphResponse<ShortTokenResponse>(response);
};

export const exchangeForLongLivedUserToken = async (shortLivedToken: string) => {
  const clientId = requireEnv('META_APP_ID');
  const clientSecret = requireEnv('META_APP_SECRET');

  const url = buildGraphUrl('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(url);
  return parseGraphResponse<LongTokenResponse>(response);
};

export const inspectToken = async (userToken: string) => {
  const appId = requireEnv('META_APP_ID');
  const appSecret = requireEnv('META_APP_SECRET');
  const url = buildGraphUrl('/debug_token', {
    input_token: userToken,
    access_token: `${appId}|${appSecret}`,
  });

  const response = await fetch(url);
  return parseGraphResponse<{ data: { scopes: string[]; expires_at: number; is_valid: boolean } }>(
    response
  );
};

// ─── Instagram Business Login API (New Flow) ───────────────────────────────

export const exchangeIGCodeForShortLivedToken = async (code: string, redirectUri: string) => {
  const clientId = requireEnv('IG_APP_ID');
  const clientSecret = requireEnv('IG_APP_SECRET');

  const formData = new URLSearchParams();
  formData.append('client_id', clientId);
  formData.append('client_secret', clientSecret);
  formData.append('grant_type', 'authorization_code');
  formData.append('redirect_uri', redirectUri);
  formData.append('code', code);

  const response = await fetch(`${IG_API_BASE_URL}/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  return parseGraphResponse<{
    access_token: string;
    token_type: string;
    expires_in?: number;
    user_id: string;
  }>(response);
};

export const exchangeIGForLongLivedToken = async (shortLivedToken: string) => {
  const clientSecret = requireEnv('IG_APP_SECRET');

  const url = new URL(`${IG_GRAPH_BASE_URL}/access_token`);
  url.searchParams.set('grant_type', 'ig_exchange_token');
  url.searchParams.set('client_secret', clientSecret);
  url.searchParams.set('access_token', shortLivedToken);

  try {
    const getResponse = await fetch(url.toString());
    return await parseGraphResponse<{ access_token: string; token_type: string; expires_in: number }>(
      getResponse
    );
  } catch (getError) {
    const getMessage = getError instanceof Error ? getError.message : String(getError);
    logInfo('Instagram long-lived token exchange via GET failed, trying POST fallback...', { error: getMessage });

    const formData = new URLSearchParams();
    formData.append('grant_type', 'ig_exchange_token');
    formData.append('client_secret', clientSecret);
    formData.append('access_token', shortLivedToken);

    try {
      const postResponse = await fetch(`${IG_GRAPH_BASE_URL}/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      });
      return await parseGraphResponse<{ access_token: string; token_type: string; expires_in: number }>(
        postResponse
      );
    } catch (postError) {
      const postMessage = postError instanceof Error ? postError.message : String(postError);
      throw new Error(`Instagram long-lived token exchange failed. GET: ${getMessage}; POST: ${postMessage}`);
    }
  }
};

export const refreshIGLongLivedToken = async (currentToken: string) => {
  const url = new URL(`${IG_GRAPH_BASE_URL}/refresh_access_token`);
  url.searchParams.set('grant_type', 'ig_refresh_token');
  url.searchParams.set('access_token', currentToken);

  const response = await fetch(url.toString());
  return parseGraphResponse<{ access_token: string; token_type: string; expires_in: number }>(
    response
  );
};

export const fetchIGUserInfo = async (accessToken: string) => {
  let userId = '';
  try {
    const meJson = await fetchFirstInstagramResponse<{
      user_id?: string;
      id?: string;
      username?: string;
    }>(
      [`${IG_GRAPH_API_BASE_URL}/me`, `${IG_GRAPH_BASE_URL}/me`],
      accessToken,
      ['user_id,username', 'id,username']
    );
    userId = meJson.user_id || meJson.id || '';
  } catch (meError) {
    console.error('[OAuth Callback] Fetch /me failed:', meError instanceof Error ? meError.message : String(meError));
    throw meError;
  }

  if (!userId) {
    throw new Error('Failed to retrieve Instagram User ID from token');
  }

  const json = await fetchFirstInstagramResponse<{
    id: string;
    username: string;
    name?: string;
    profile_picture_url?: string;
    followers_count?: number;
    media_count?: number;
    account_type?: string;
  }>(
    [`${IG_GRAPH_API_BASE_URL}/${userId}`, `${IG_GRAPH_BASE_URL}/${userId}`],
    accessToken,
    [
      'id,username,name,profile_picture_url,followers_count,media_count,account_type',
      'id,username,name,profile_picture_url',
      'id,username',
    ]
  );

  return {
    ...json,
    id: json.id || userId,
  };
};

export const refreshLongLivedUserToken = async (currentUserToken: string) => {
  try {
    return await exchangeForLongLivedUserToken(currentUserToken);
  } catch (error) {
    logError('Failed to refresh long-lived token', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const sendInstagramPrivateReply = async (
  igId: string,
  commentId: string,
  messageText: string,
  accessToken: string,
  requestId?: string
) => {
  const url = `${IG_GRAPH_API_BASE_URL}/${igId}/messages`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient: { comment_id: commentId },
          message: { text: messageText },
        }),
      });

      const result = await parseGraphResponse<{
        recipient_id?: string;
        message_id?: string;
      }>(response);

      logInfo('Instagram private reply sent', {
        requestId,
        igId,
        commentId,
        attempt,
        hasMessageId: Boolean(result.message_id),
      });

      return { ok: true as const, result };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      logError('Failed sending Instagram private reply', {
        requestId,
        commentId,
        attempt,
        error: message,
      });

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }
  }

  return {
    ok: false as const,
    error: lastError instanceof Error ? lastError.message : 'Failed to send private reply',
  };
};

export const debugIGToken = async (accessToken: string) => {
  const url = new URL(`${IG_GRAPH_API_BASE_URL}/debug_token`);
  url.searchParams.set('input_token', accessToken);
  url.searchParams.set('access_token', accessToken);

  const response = await fetch(url.toString());
  return parseGraphResponse<{
    data?: {
      app_id?: string;
      type?: string;
      application?: string;
      data_access_expires_at?: number;
      expires_at?: number;
      is_valid?: boolean;
      scopes?: string[];
      user_id?: string;
    };
  }>(response);
};

export const sendInstagramCommentReply = async (
  commentId: string,
  messageText: string,
  accessToken: string,
  requestId?: string
) => {
  const url = `${IG_GRAPH_API_BASE_URL}/${commentId}/replies`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: messageText,
        }),
      });

      const result = await parseGraphResponse<{ id?: string }>(response);

      logInfo('Instagram comment reply sent', {
        requestId,
        commentId,
        attempt,
        hasId: Boolean(result.id),
      });

      return { ok: true as const, result };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      logError('Failed sending Instagram comment reply', {
        requestId,
        commentId,
        attempt,
        error: message,
      });

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }
  }

  return {
    ok: false as const,
    error: lastError instanceof Error ? lastError.message : 'Failed to send comment reply',
  };
};

export const sendInstagramMessage = async (
  igId: string,
  recipientId: string,
  messageText: string,
  accessToken: string,
  requestId?: string
) => {
  const url = `${IG_GRAPH_API_BASE_URL}/${igId}/messages`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: messageText },
          messaging_type: 'RESPONSE',
        }),
      });

      const result = await parseGraphResponse<{
        message_id?: string;
        error?: { code?: number; message?: string };
      }>(response);

      logInfo('Instagram message sent', {
        requestId,
        igId,
        recipientId,
        attempt,
        hasMessageId: Boolean(result.message_id),
      });

      return { ok: true as const, result };
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      logError('Failed sending Instagram message', {
        requestId,
        igId,
        recipientId,
        attempt,
        error: message,
      });

      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }
  }

  return {
    ok: false as const,
    error: lastError instanceof Error ? lastError.message : 'Failed to send message',
  };
};

type InstagramMessagePayload = Record<string, unknown>;

export interface InstagramGenericTemplateButton {
  type: 'web_url' | 'postback';
  title: string;
  url?: string;
  payload?: string;
}

export interface InstagramGenericTemplateElement {
  title: string;
  subtitle?: string;
  image_url?: string;
  buttons?: InstagramGenericTemplateButton[];
}

export const isInstagramOutsideAllowedWindowError = (errorMessage: string): boolean => {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes('outside of allowed window') ||
    normalized.includes('outside the allowed window') ||
    normalized.includes('not allow new message requests') ||
    normalized.includes("doesn't allow new message requests")
  );
};

const shouldRetryInstagramMessageError = (errorMessage: string): boolean => {
  const normalized = errorMessage.toLowerCase();
  return (
    !isInstagramOutsideAllowedWindowError(errorMessage) &&
    !normalized.includes('unsupported post request') &&
    !normalized.includes('recipient is not available') &&
    !normalized.includes('invalid parameter')
  );
};

const sendInstagramMessagePayload = async (
  igId: string,
  recipient: Record<string, string>,
  message: InstagramMessagePayload,
  accessToken: string,
  requestId?: string,
  messagingType = 'RESPONSE',
  maxAttempts = 3
) => {
  const url = `${IG_GRAPH_API_BASE_URL}/me/messages`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const body: Record<string, unknown> = {
        recipient,
        message,
      };

      if (recipient.id) {
        body.messaging_type = messagingType;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      const result = await parseGraphResponse<{
        recipient_id?: string;
        message_id?: string;
      }>(response);

      logInfo('Instagram message payload sent', {
        requestId,
        igId,
        attempt,
        recipientType: recipient.comment_id ? 'comment' : 'user',
        messageKeys: Object.keys(message),
        hasMessageId: Boolean(result.message_id),
      });

      return { ok: true as const, result };
    } catch (error) {
      lastError = error;
      const messageText = error instanceof Error ? error.message : String(error);
      const canRetry = shouldRetryInstagramMessageError(messageText);
      const logPayload = {
        requestId,
        igId,
        attempt,
        maxAttempts,
        error: messageText,
      };

      if (canRetry) {
        logError('Failed sending Instagram message payload', logPayload);
      } else {
        logInfo('Instagram message payload rejected without retry', logPayload);
      }

      if (!canRetry) {
        break;
      }

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
      }
    }
  }

  return {
    ok: false as const,
    error: lastError instanceof Error ? lastError.message : 'Failed to send message payload',
  };
};

export const splitMessageIntoChunks = (text: string, maxChunkLength = 950): string[] => {
  if (!text || text.length <= maxChunkLength) return [text || ''];
  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkLength) {
      chunks.push(remaining);
      break;
    }

    let splitIdx = remaining.lastIndexOf('\n', maxChunkLength);
    if (splitIdx < maxChunkLength * 0.4) {
      splitIdx = remaining.lastIndexOf(' ', maxChunkLength);
    }
    if (splitIdx <= 0) {
      splitIdx = maxChunkLength;
    }

    const chunk = remaining.slice(0, splitIdx).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(splitIdx).trim();
  }

  return chunks.filter(Boolean);
};

export const sendInstagramTextPayload = async (
  igId: string,
  recipientId: string,
  messageText: string,
  accessToken: string,
  requestId?: string,
  quickReplies?: Array<{ content_type: 'text'; title: string; payload: string }>,
  maxAttempts = 3
) => {
  const chunks = splitMessageIntoChunks(messageText, 950);
  let lastResult: any = null;

  for (let i = 0; i < chunks.length; i++) {
    const isLastChunk = i === chunks.length - 1;
    const chunkReplies = isLastChunk ? quickReplies : undefined;

    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    const result = await sendInstagramMessagePayload(
      igId,
      { id: recipientId },
      {
        text: chunks[i],
        ...(chunkReplies?.length ? { quick_replies: chunkReplies } : {}),
      },
      accessToken,
      requestId,
      'RESPONSE',
      maxAttempts
    );

    if (!result.ok) {
      return result;
    }
    lastResult = result;
  }

  return lastResult ?? { ok: true, result: {} };
};

export const sendInstagramPrivateReplyPayload = async (
  igId: string,
  commentId: string,
  messageText: string,
  accessToken: string,
  requestId?: string,
  quickReplies?: Array<{ content_type: 'text'; title: string; payload: string }>,
  maxAttempts = 3
) => {
  const chunks = splitMessageIntoChunks(messageText, 950);
  return sendInstagramMessagePayload(
    igId,
    { comment_id: commentId },
    {
      text: chunks[0] || messageText,
      ...(quickReplies?.length ? { quick_replies: quickReplies } : {}),
    },
    accessToken,
    requestId,
    'RESPONSE',
    maxAttempts
  );
};

export const sendInstagramImage = async (
  igId: string,
  recipientId: string,
  imageUrl: string,
  accessToken: string,
  requestId?: string
) =>
  sendInstagramMessagePayload(
    igId,
    { id: recipientId },
    {
      attachment: {
        type: 'image',
        payload: {
          url: imageUrl,
          is_reusable: true,
        },
      },
    },
    accessToken,
    requestId
  );

export const sendInstagramPrivateReplyImage = async (
  igId: string,
  commentId: string,
  imageUrl: string,
  accessToken: string,
  requestId?: string
) =>
  sendInstagramMessagePayload(
    igId,
    { comment_id: commentId },
    {
      attachment: {
        type: 'image',
        payload: {
          url: imageUrl,
          is_reusable: true,
        },
      },
    },
    accessToken,
    requestId
  );

export const sendInstagramGenericTemplate = async (
  igId: string,
  recipientId: string,
  elements: InstagramGenericTemplateElement[],
  accessToken: string,
  requestId?: string
) =>
  sendInstagramMessagePayload(
    igId,
    { id: recipientId },
    {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements,
        },
      },
    },
    accessToken,
    requestId
  );

export const sendInstagramPrivateReplyGenericTemplate = async (
  igId: string,
  commentId: string,
  elements: InstagramGenericTemplateElement[],
  accessToken: string,
  requestId?: string
) =>
  sendInstagramMessagePayload(
    igId,
    { comment_id: commentId },
    {
      attachment: {
        type: 'template',
        payload: {
          template_type: 'generic',
          elements,
        },
      },
    },
    accessToken,
    requestId
  );

export const fetchInstagramMedia = async (igId: string, pageAccessToken: string, limit = 30) => {
  return fetchFirstInstagramResponse<{ data: InstagramMedia[] }>(
    [
      `${IG_GRAPH_API_BASE_URL}/${igId}/media`,
      `${IG_GRAPH_BASE_URL}/${igId}/media`,
      `${IG_GRAPH_API_BASE_URL}/me/media`,
      `${IG_GRAPH_BASE_URL}/me/media`,
    ],
    pageAccessToken,
    [
      'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username,like_count,comments_count',
      'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,username',
      'id,caption,media_type,permalink,timestamp',
    ],
    { limit: limit.toString() }
  );
};

export interface InstagramMedia {
  id: string;
  media_type: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | 'REELS';
  media_url: string;
  thumbnail_url?: string;
  caption?: string;
  permalink: string;
  timestamp: string;
  like_count?: number;
  comments_count?: number;
}

export const fetchInstagramMediaInsights = async (mediaId: string, accessToken: string) => {
  const metrics = ['views', 'video_views', 'plays', 'reach', 'impressions'];
  const results: Record<string, number> = {};

  for (const metric of metrics) {
    try {
      const url = new URL(`${IG_GRAPH_API_BASE_URL}/${mediaId}/insights`);
      url.searchParams.set('metric', metric);
      url.searchParams.set('access_token', accessToken);

      const response = await fetch(url.toString());
      const parsed = await parseGraphResponse<{
        data?: Array<{
          name?: string;
          values?: Array<{ value?: number }>;
        }>;
      }>(response);

      const value = parsed.data?.[0]?.values?.[0]?.value;
      if (typeof value === 'number') {
        results[metric] = value;
      }
    } catch (error) {
      logInfo('Instagram media insight metric unavailable', {
        mediaId,
        metric,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    views:
      results.views ??
      results.video_views ??
      results.plays ??
      results.reach ??
      results.impressions ??
      null,
    metrics: results,
  };
};

export const isTokenExpiredError = (errorMessage: string): boolean => {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes('expired') ||
    normalized.includes('invalid oauth') ||
    normalized.includes('error validating access token')
  );
};
