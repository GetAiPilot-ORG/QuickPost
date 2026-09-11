/**
 * SSO receiver — gap_social_pilot server (trigger reload)
 *
 * POST /api/auth/sso
 * Body: { token: "<encoded>.<hmac_signature>" }
 *
 * Verifies the HMAC-SHA256 signed token issued by getaipilot.in's
 * `social-sso` edge function, prevents replay via the sso_nonces table,
 * then generates a Supabase Project B magic-link so the browser can
 * establish a real auth session without sharing cross-project secrets.
 *
 * Shared secret:  SOCIAL_PILOT_SSO_SECRET  (same value on both sides)
 * Required:       SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY
 *                 (anon key is NOT sufficient for auth.admin.generateLink)
 */

import express from 'express';
import crypto  from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { clearEntitlementsCache } from '../services/entitlements.js';

const router = express.Router();

console.log('[SSO-EVAL] env check:', {
  SOCIAL_PILOT_SSO_SECRET: process.env.SOCIAL_PILOT_SSO_SECRET,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing'
});

// ── Admin client (service role required for auth.admin + RLS bypass) ──────
const SUPABASE_URL        = process.env.SUPABASE_URL;
let SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (SUPABASE_SERVICE_KEY && SUPABASE_SERVICE_KEY.startsWith('ROTATE_ME')) {
  SUPABASE_SERVICE_KEY = undefined;
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SSO_SECRET = process.env.SOCIAL_PILOT_SSO_SECRET;

if (!SSO_SECRET) {
  console.warn('[SSO] ⚠️  SOCIAL_PILOT_SSO_SECRET is not set — /api/auth/sso will reject all requests');
}
if (!SUPABASE_SERVICE_KEY) {
  console.warn('[SSO] ⚠️  No service role key found — auth.admin.generateLink will fail');
}

// ── Helpers ───────────────────────────────────────────────────────────────

function hmacSign(message, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(message, 'utf8')
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodePayload(encoded) {
  try {
    return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

function constantTimeEqual(a, b) {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  
  let mismatch = bufA.length !== bufB.length ? 1 : 0;
  
  // Use a dummy comparison buffer if lengths differ to ensure timingSafeEqual still runs
  const compareBuf = mismatch ? bufA : bufB;
  
  return crypto.timingSafeEqual(bufA, compareBuf) && !mismatch;
}

// ── Route ─────────────────────────────────────────────────────────────────

router.post('/sso', async (req, res) => {
  if (!SSO_SECRET) {
    return res.status(503).json({ success: false, error: 'SSO not configured on this server' });
  }

  try {
    const { token } = req.body ?? {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ success: false, error: 'Missing SSO token' });
    }

    // ── Split at last dot: "<encoded>.<signature>" ───────────────────────
    const lastDot = token.lastIndexOf('.');
    if (lastDot < 1 || lastDot === token.length - 1) {
      return res.status(400).json({ success: false, error: 'Malformed SSO token' });
    }
    const encoded   = token.slice(0, lastDot);
    const signature = token.slice(lastDot + 1);

    // ── Verify HMAC (constant-time) ──────────────────────────────────────
    const expected = hmacSign(encoded, SSO_SECRET);
    console.log('[SSO-DEBUG] Verify:', {
      tokenLength: token.length,
      encoded,
      signature,
      expected,
      secretLen: SSO_SECRET?.length,
      secretStart: SSO_SECRET?.substring(0, 10),
      match: constantTimeEqual(signature, expected)
    });
    if (!constantTimeEqual(signature, expected)) {
      console.warn('[SSO] Signature mismatch — rejected');
      return res.status(401).json({ success: false, error: 'Invalid SSO token' });
    }

    // ── Decode and validate claims ───────────────────────────────────────
    const payload = decodePayload(encoded);
    if (!payload) {
      return res.status(400).json({ success: false, error: 'Unreadable SSO payload' });
    }

    const { email, aud, iss, exp, jti } = payload;

    if (aud !== 'dmpilot') {
      return res.status(401).json({ success: false, error: 'Invalid token audience' });
    }
    if (iss !== 'getaipilot.in') {
      return res.status(401).json({ success: false, error: 'Invalid token issuer' });
    }
    if (!email) {
      return res.status(400).json({ success: false, error: 'Token missing email' });
    }
    if (!jti) {
      return res.status(400).json({ success: false, error: 'Token missing nonce' });
    }
    if (typeof exp !== 'number' || Date.now() > exp) {
      return res.status(401).json({ success: false, error: 'SSO token has expired' });
    }

    // ── Replay prevention: insert JTI ────────────────────────────────────
    // A unique-constraint violation means the token was already used.
    const { error: nonceError } = await supabaseAdmin
      .from('sso_nonces')
      .insert({ jti, email, expires_at: new Date(exp).toISOString() });

    if (nonceError) {
      if (nonceError.code === '23505') {
        console.warn(`[SSO] Replay detected for jti=${jti} email=${email}`);
        return res.status(401).json({ success: false, error: 'SSO token already used' });
      }
      console.error('[SSO] Nonce insert error:', nonceError.message);
      return res.status(500).json({ success: false, error: 'Nonce check failed' });
    }

    // ── Generate Supabase Project B magic-link ───────────────────────────
    // This creates the user in auth.users if they don't exist yet,
    // and produces a one-time login URL the browser can visit.
    const redirectTo = (process.env.CLIENT_URL || 'http://localhost:5173') + '/auth/callback';

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo },
    });

    if (linkError || !linkData?.properties?.action_link) {
      console.error('[SSO] generateLink error:', linkError?.message);
      return res.status(500).json({ success: false, error: 'Failed to generate login link' });
    }

    clearEntitlementsCache(); // Refresh entitlement cache on SSO login
    console.log(`[SSO] ✅ Issued magic link for ${email}`);
    return res.json({ success: true, magic_link_url: linkData.properties.action_link });

  } catch (err) {
    console.error('[SSO] Unexpected error:', err.message);
    return res.status(500).json({ success: false, error: 'Unexpected server error' });
  }
});

export default router;
