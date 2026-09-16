/**
 * _shared/db.ts — Shared Supabase helpers for dmpilot edge functions
 *
 * Placed in supabase/functions/_shared/ so the Supabase bundler can
 * resolve it from any function via a relative import:
 *   import { ... } from '../_shared/db.ts';
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface AppLogContext {
  requestId?: string;
  functionName?: string;
  [key: string]: unknown;
}

export const requireEnv = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value.trim();
};

export const getSupabaseAdmin = (): SupabaseClient => {
  const supabaseUrl =
    Deno.env.get('SUPABASE_URL') || Deno.env.get('PUBLIC_SUPABASE_URL');
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY');

  if (!supabaseUrl) {
    throw new Error('Missing required environment variable: SUPABASE_URL');
  }
  if (!serviceRoleKey) {
    throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const fromBase64Url = (input: string): string => {
  let str = input.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  return atob(str);
};

const base64UrlToBytes = (base64url: string): Uint8Array => {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const toArrayBuffer = (bytes: Uint8Array): ArrayBuffer => {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
};

const verifyLocalJWT = async (token: string, secret: string) => {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('[JWT] Token does not have 3 parts');
      return null;
    }

    const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
    const message = `${headerEncoded}.${payloadEncoded}`;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureBytes = toArrayBuffer(base64UrlToBytes(signatureEncoded));
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBytes,
      new TextEncoder().encode(message)
    );

    if (!isValid) {
      console.warn('[JWT] Signature is invalid!');
      return null;
    }

    const payload = JSON.parse(fromBase64Url(payloadEncoded));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.warn('[JWT] Token has expired!');
      return null;
    }

    return payload;
  } catch (e) {
    console.error('Local JWT verification error:', e);
    return null;
  }
};

export const getAuthenticatedUser = async (authHeader: string | null, jwtSecretOverride?: string | null) => {
  console.log('[AUTH] Received jwtSecretOverride:', jwtSecretOverride ? 'PRESENT (Length: ' + jwtSecretOverride.length + ')' : 'MISSING');
  if (!authHeader?.startsWith('Bearer ')) {
    return { user: null, error: 'Missing bearer token' };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return { user: null, error: 'Missing bearer token' };
  }

  // 1. Try stateless local JWT verification first (bypasses GoTrue limits)
  const jwtSecret = jwtSecretOverride || Deno.env.get('JWT_SECRET');
  if (jwtSecret) {
    console.log('[AUTH] Attempting local JWT verification...');
    const payload = await verifyLocalJWT(token, jwtSecret);
    if (payload) {
      console.log('[AUTH] Local JWT verification succeeded for user:', payload.sub);
      return {
        user: {
          id: payload.sub,
          email: payload.email,
          user_metadata: payload.user_metadata || {},
          app_metadata: payload.app_metadata || {},
        } as any,
        error: null,
      };
    }
  } else {
    console.warn('[AUTH] No JWT secret available for local verification.');
  }

  // 2. Fallback to Supabase GoTrue API check
  console.log('[AUTH] Falling back to GoTrue getUser API check...');
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    return { user: null, error: error?.message ?? 'Invalid auth token' };
  }

  return { user: data.user, error: null };
};

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const json = (
  status: number,
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers,
    },
  });

export const logInfo = (message: string, context: AppLogContext = {}) => {
  console.log(JSON.stringify({ level: 'info', message, ...context }));
};

export const logError = (message: string, context: AppLogContext = {}) => {
  console.error(JSON.stringify({ level: 'error', message, ...context }));
};

export const getInstagramAccount = async (
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
) => {
  const { data, error } = await supabase
    .from('instagram_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('id', accountId)
    .single();

  if (error || !data) {
    return { account: null, error: error?.message ?? 'Account not found' };
  }

  return { account: data, error: null };
};
