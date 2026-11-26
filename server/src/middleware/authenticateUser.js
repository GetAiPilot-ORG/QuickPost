import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import { createOrUpdateUser } from '../services/supabase.js';

dotenv.config();
if (!process.env.SUPABASE_URL || !process.env.JWT_SECRET) {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

let _supabaseAdmin = null;

function getSupabaseAdmin() {
  if (_supabaseAdmin) return _supabaseAdmin;

  const supabaseUrl = process.env.SUPABASE_URL || process.env.AUTODM_SUPABASE_URL;
  let supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.AUTODM_SUPABASE_SERVICE_KEY;

  if (!supabaseKey || supabaseKey.startsWith('ROTATE_ME')) {
    supabaseKey = process.env.SUPABASE_ANON_KEY;
  }

  if (supabaseUrl && supabaseKey) {
    _supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _supabaseAdmin;
}

const userSyncCache = new Map();

function isUsableBearerToken(token) {
  return (
    typeof token === 'string' &&
    token.trim() &&
    token !== 'null' &&
    token !== 'undefined' &&
    token.split('.').length === 3
  );
}

/**
 * Verify JWT token locally against candidate Supabase JWT secrets.
 * Handles both base64-encoded secret buffers (standard for Supabase HS256) and raw strings.
 */
function verifyTokenLocally(token) {
  const candidateSecrets = [
    process.env.JWT_SECRET,
    process.env.AUTODM_SUPABASE_JWT_SECRET,
    process.env.SUPABASE_JWT_SECRET,
  ].filter(Boolean);

  let caughtExpiredError = null;
  let caughtOtherError = null;

  for (const secret of candidateSecrets) {
    // 1. Try decoding as base64 Buffer (standard Supabase 64-byte secret)
    try {
      const buf = Buffer.from(secret, 'base64');
      if (buf.length >= 32) {
        const decoded = jwt.verify(token, buf);
        return { decoded, error: null };
      }
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        caughtExpiredError = err;
      } else {
        caughtOtherError = err;
      }
    }

    // 2. Try raw UTF-8 string
    try {
      const decoded = jwt.verify(token, secret);
      return { decoded, error: null };
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        caughtExpiredError = err;
      } else {
        caughtOtherError = err;
      }
    }
  }

  return { decoded: null, error: caughtExpiredError || caughtOtherError };
}

/**
 * Authentication middleware
 * Verifies Supabase JWT via supabaseAdmin.auth.getUser() or fallback local verification.
 */
export async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No authentication token provided',
      });
    }

    const token = authHeader.substring(7).trim();
    if (!isUsableBearerToken(token)) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'No valid authentication token provided',
      });
    }

    // Check token expiration via unverified claims
    let tokenExpSeconds = null;
    let isTokenExpiredByClaim = false;
    try {
      const decodedUnverified = jwt.decode(token);
      if (decodedUnverified?.exp) {
        tokenExpSeconds = Number(decodedUnverified.exp);
        if (!Number.isNaN(tokenExpSeconds) && tokenExpSeconds * 1000 < Date.now()) {
          isTokenExpiredByClaim = true;
        }
      }
    } catch (decodeErr) {
      // Ignore unverified decode error
    }

    if (isTokenExpiredByClaim) {
      console.warn('❌ [AUTH] Token rejected: claims indicate token has expired');
      return res.status(401).json({
        success: false,
        error: 'TOKEN_EXPIRED',
        message: 'Authentication token is expired',
      });
    }

    // 1. Verify token via Supabase Admin API
    let user = null;
    let authError = null;
    const admin = getSupabaseAdmin();

    if (admin) {
      try {
        const { data, error } = await admin.auth.getUser(token);
        if (!error && data?.user) {
          user = data.user;
        } else if (error) {
          authError = error;
        }
      } catch (sbErr) {
        authError = sbErr;
      }
    }

    // 2. Fallback to local JWT verification with Supabase JWT secrets (supporting base64 buffer)
    if (!user) {
      const localResult = verifyTokenLocally(token);
      if (localResult.decoded) {
        const dec = localResult.decoded;
        user = {
          id: dec.sub || dec.userId || dec.id,
          email: dec.email,
          user_metadata: {
            full_name:
              dec.user_metadata?.full_name ||
              dec.name ||
              dec.full_name ||
              dec.email?.split('@')[0],
            avatar_url:
              dec.user_metadata?.avatar_url ||
              dec.picture ||
              dec.avatar_url ||
              null,
          },
        };
        authError = null;
      } else if (localResult.error) {
        authError = localResult.error;
      }
    }

    if (!user) {
      const isExpired =
        isTokenExpiredByClaim ||
        authError?.name === 'TokenExpiredError' ||
        /expired/i.test(authError?.message || '');

      console.warn(`❌ [AUTH] Token verification failed: ${authError?.message || (isExpired ? 'jwt expired' : 'invalid token')}`);
      return res.status(401).json({
        success: false,
        error: isExpired ? 'TOKEN_EXPIRED' : 'Invalid token',
        message: isExpired ? 'Authentication token is expired' : (authError?.message || 'Authentication token is invalid or expired'),
      });
    }

    // Build user info from Supabase or decoded user object
    const userInfo = {
      id: user.id,
      userId: user.id,
      authUserId: user.id,
      email: user.email,
      name: user.user_metadata?.full_name || user.email?.split('@')[0],
      profilePicture: user.user_metadata?.avatar_url || null,
    };

    // Cache for user DB sync (60 second TTL per user) to avoid excessive DB queries
    const now = Date.now();
    const cacheKey = user.id || user.email;
    let dbUser = userSyncCache.get(cacheKey);

    if (!dbUser || now - dbUser._cachedAt > 60000) {
      try {
        const synced = await createOrUpdateUser(
          userInfo.email,
          userInfo.name,
          userInfo.userId,
          userInfo.profilePicture
        );
        if (synced && synced.id) {
          synced._cachedAt = now;
          userSyncCache.set(cacheKey, synced);
          dbUser = synced;
        }
      } catch (syncError) {
        console.warn('⚠️ [AUTH] Failed to sync user to public.users:', syncError.message);
      }
    }

    if (dbUser && dbUser.id) {
      userInfo.userId = dbUser.id;
    }

    userInfo.id = userInfo.authUserId || userInfo.userId || user.id;

    req.user = userInfo;
    req.token = token;
    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication error',
      message: 'An error occurred during authentication',
    });
  }
}

/**
 * Generate JWT token (Legacy support)
 */
export function generateToken(payload, expiresIn = '7d') {
  const secret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
  try {
    const buf = Buffer.from(secret, 'base64');
    if (buf.length >= 32) {
      return jwt.sign(payload, buf, { expiresIn, algorithm: 'HS256' });
    }
  } catch (e) {}
  return jwt.sign(payload, secret, { expiresIn });
}
