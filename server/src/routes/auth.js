import express from "express";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import googleOAuth from "../services/googleOAuth.js";
import googleBusinessOAuth from "../services/googleBusinessOAuth.js";
import pinterestOAuth from "../services/pinterestOAuth.js";
import facebookOAuth from "../services/facebookOAuth.js";
import blueskyAuth from "../services/blueskyAuth.js";
import linkedinOAuth from "../services/linkedinOAuth.js";
import mastodonOAuth from "../services/mastodonOAuth.js";

import threadsOAuth from "../services/threadsOAuth.js";
import xOAuth from "../services/xOAuth.js";
import redditOAuth from "../services/redditOAuth.js";
import { startAutoDMInstagramOAuth } from "../services/autodm.js";
import { supermailbox } from "../services/supermailbox.js";

import supabase, {
  createOrUpdateUser,
  getConnectedAccounts,
} from "../services/supabase.js";
import { getEntitlements } from "../services/entitlements.js";
import {
  authenticateUser,
  generateToken,
} from "../middleware/authenticateUser.js";

async function notifyAccountConnected(userId, platformName, accountUsername) {
  try {
    const { data: user } = await supabase
      .from("users")
      .select("email, name")
      .eq("id", userId)
      .maybeSingle();

    if (user?.email) {
      const platformDisplay = accountUsername
        ? `${platformName} (@${accountUsername})`
        : platformName;

      supermailbox
        .sendEmail({
          to: user.email,
          templateKey: "account_connected",
          variables: {
            platform: platformDisplay,
            name: user.name || user.email.split("@")[0],
          },
        })
        .catch((err) =>
          console.warn(
            "[SupermailBox SDK] Account connected email failed:",
            err?.message,
          ),
        );
    }
  } catch (err) {
    console.warn("⚠️ [AUTH] notifyAccountConnected error:", err?.message);
  }
}

const router = express.Router();
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
const pendingOAuthSelections = new Map();

function decodeState(state) {
  try {
    return JSON.parse(Buffer.from(state, "base64url").toString("utf-8"));
  } catch (e) {
    return null;
  }
}

function dashboardRedirect(params) {
  const url = new URL("/dashboard", CLIENT_URL);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return url.toString();
}

function requireJwtSecret() {
  if (!process.env.JWT_SECRET) {
    console.error("❌ JWT_SECRET missing in env");
  }
}
requireJwtSecret();

async function getConnectedTargetCount(userId) {
  const [{ data: socialRows, error: socialError }, { data: instagramRows, error: instagramError }] = await Promise.all([
    supabase
      .from("social_tokens")
      .select("provider, account_id, page_id, instagram_business_id, username")
      .eq("user_id", userId)
      .neq("provider", "instagram"),
    supabase
      .from("instagram_accounts")
      .select("instagram_business_account_id")
      .eq("user_id", userId)
      .eq("is_connected", true),
  ]);
  if (socialError) throw socialError;
  if (instagramError) throw instagramError;

  const targets = new Set();
  for (const row of socialRows || []) {
    targets.add([
      row.provider,
      row.account_id || row.page_id || row.instagram_business_id || row.username,
    ].filter(Boolean).join(":"));
  }
  for (const row of instagramRows || []) {
    targets.add(`instagram:${row.instagram_business_account_id}`);
  }
  return targets.size;
}

async function assertCanConnectTarget({ user, provider, accountId }) {
  const userId = user.userId;
  const entitlementUserId = user.authUserId || userId;
  let email = user.email;
  if (!email) {
    const { data, error } = await supabase
      .from("users")
      .select("email")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    email = data?.email || null;
  }
  const entitlements = await getEntitlements(entitlementUserId, email, user.token);
  const limit = entitlements.limits.social_accounts;

  if (!Number.isFinite(limit)) return;

  if (accountId) {
    const { data: existingToken, error: existingTokenError } = await supabase
      .from("social_tokens")
      .select("id")
      .eq("user_id", userId)
      .eq("provider", provider)
      .eq("account_id", accountId)
      .maybeSingle();
    if (existingTokenError) throw existingTokenError;
    if (existingToken) return;
  }

  const used = await getConnectedTargetCount(userId);
  if (used >= limit) {
    const error = new Error(`Your plan allows ${limit} connected social account${limit === 1 ? "" : "s"}. Disconnect one account or upgrade to connect more.`);
    error.code = "PLAN_LIMIT_REACHED";
    throw error;
  }
}

/* ---------------- GOOGLE ---------------- */

router.get("/google", (req, res) => {
  try {
    const authUrl = googleOAuth.getAuthorizationUrl();
    res.redirect(authUrl);
  } catch (error) {
    console.error("Google OAuth init error:", error);
    res.redirect(`${CLIENT_URL}/login?error=google_oauth_failed`);
  }
});

router.get("/youtube", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res.redirect(`${CLIENT_URL}/dashboard?error=missing_token`);

    let userId;
    try {
      console.log(
        `\n🔵 [AUTH] YouTube init for token: ${token?.substring(0, 20)}...`,
      );
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (error || !user) throw error || new Error("User not found");

      // Sync user and get consistent ID
      const dbUser = await createOrUpdateUser(
        user.email,
        user.user_metadata?.full_name || user.email?.split("@")[0],
        user.id,
        user.user_metadata?.avatar_url,
      );
      userId = dbUser.id;

      console.log(`✅ [AUTH] Token verified and synced for user: ${userId}`);
    } catch (e) {
      console.error("❌ [AUTH] Token verification failed:", e.message);
      return res.redirect(
        `${CLIENT_URL}/dashboard?error=invalid_token&details=${encodeURIComponent(e.message)}`,
      );
    }

    const state = googleOAuth.makeState(userId);
    const authUrl = googleOAuth.getAuthorizationUrl(state);
    res.redirect(authUrl);
  } catch (error) {
    console.error("YouTube OAuth init error:", error);
    res.redirect(`${CLIENT_URL}/dashboard?error=youtube_oauth_failed`);
  }
});

router.get("/google/callback", async (req, res) => {
  const { code, error, state } = req.query;

  if (error) return res.redirect(`${CLIENT_URL}/login?error=access_denied`);
  if (!code) return res.redirect(`${CLIENT_URL}/login?error=no_code`);

  try {
    const decodedState = decodeState(state);
    const tokenData = await googleOAuth.exchangeCodeForTokens(code);

    if (decodedState && decodedState.userId) {
      // This is a CONNECTION flow
      console.log(
        "🔗 [AUTH] Connecting YouTube account for user:",
        decodedState.userId,
      );
      await googleOAuth.storeTokens(decodedState.userId, tokenData);
      notifyAccountConnected(
        decodedState.userId,
        "YouTube",
        tokenData.userInfo?.username || tokenData.userInfo?.name,
      );
      return res.redirect(`${CLIENT_URL}/dashboard?success=youtube`);
    }

    // This is a LOGIN flow
    const user = await createOrUpdateUser(
      tokenData.userInfo.email,
      tokenData.userInfo.name,
      tokenData.userInfo.googleId,
      tokenData.userInfo.picture,
    );

    await googleOAuth.storeTokens(user.id, tokenData);

    const jwtToken = generateToken({
      userId: user.id,
      email: user.email,
      name: user.name,
    });

    res.redirect(
      `${CLIENT_URL}/auth/callback?token=${jwtToken}&provider=google`,
    );
  } catch (err) {
    console.error("Google callback error:", err);
    res.redirect(`${CLIENT_URL}/login?error=authentication_failed`);
  }
});

/* ---------------- GOOGLE BUSINESS PROFILE ---------------- */

router.get("/googleBusiness", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res.redirect(`${CLIENT_URL}/dashboard?error=missing_token`);

    let userId;
    try {
      console.log(
        `\n🔵 [AUTH] Google Business init for token: ${token?.substring(0, 20)}...`,
      );
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (error || !user) throw error || new Error("User not found");

      // Sync user and get consistent ID
      const dbUser = await createOrUpdateUser(
        user.email,
        user.user_metadata?.full_name || user.email?.split("@")[0],
        user.id,
        user.user_metadata?.avatar_url,
      );
      userId = dbUser.id;

      console.log(`✅ [AUTH] Token verified and synced for user: ${userId}`);
    } catch (e) {
      console.error("❌ [AUTH] Token verification failed:", e.message);
      return res.redirect(
        `${CLIENT_URL}/dashboard?error=invalid_token&details=${encodeURIComponent(e.message)}`,
      );
    }

    const state = googleBusinessOAuth.makeState(userId);
    const authUrl = googleBusinessOAuth.getAuthorizationUrl(state);
    res.redirect(authUrl);
  } catch (error) {
    console.error("Google Business OAuth init error:", error);
    res.redirect(`${CLIENT_URL}/dashboard?error=googleBusiness_oauth_failed`);
  }
});

router.get("/googleBusiness/callback", async (req, res) => {
  const { code, error, state } = req.query;

  if (error) return res.redirect(`${CLIENT_URL}/dashboard?error=access_denied`);
  if (!code) return res.redirect(`${CLIENT_URL}/dashboard?error=no_code`);

  try {
    const decodedState = decodeState(state);
    const tokenData = await googleBusinessOAuth.exchangeCodeForTokens(code);

    if (decodedState && decodedState.userId) {
      console.log(
        "🔗 [AUTH] Connecting Google Business account for user:",
        decodedState.userId,
      );
      await googleBusinessOAuth.storeTokens(decodedState.userId, tokenData);
      notifyAccountConnected(
        decodedState.userId,
        "Google Business",
        tokenData.userInfo?.name,
      );
      return res.redirect(`${CLIENT_URL}/dashboard?success=googleBusiness_connected`);
    }

    res.redirect(`${CLIENT_URL}/dashboard?error=invalid_state`);
  } catch (err) {
    console.error("Google Business callback error:", err);
    res.redirect(`${CLIENT_URL}/dashboard?error=googleBusiness_connection_failed`);
  }
});

/* ---------------- INSTAGRAM ---------------- */

router.get("/instagram", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res.redirect(`${CLIENT_URL}/dashboard?error=missing_token`);

    let userId;
    try {
      console.log(
        `\n🔵 [AUTH] Instagram init for token: ${token?.substring(0, 20)}...`,
      );
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (error || !user) throw error || new Error("User not found");

      const dbUser = await createOrUpdateUser(
        user.email,
        user.user_metadata?.full_name || user.email?.split("@")[0],
        user.id,
        user.user_metadata?.avatar_url,
      );
      userId = dbUser.id;
      console.log(`✅ [AUTH] Token verified and synced for user: ${userId}`);
    } catch (e) {
      console.error("❌ [AUTH] Token verification failed:", e.message);
      return res.redirect(
        `${CLIENT_URL}/dashboard?error=invalid_token&details=${encodeURIComponent(e.message)}`,
      );
    }

    const redirectTo = await startAutoDMInstagramOAuth(
      { userId },
      CLIENT_URL,
      `Bearer ${token}`,
      false,
    );
    return res.redirect(redirectTo);
  } catch (error) {
    console.error("Instagram init error:", error);
    res.redirect(`${CLIENT_URL}/dashboard?error=instagram_oauth_failed`);
  }
});

router.get("/instagram/callback", async (req, res) => {
  const message = encodeURIComponent(
    "This legacy Instagram callback is disabled. Use Instagram Login for Business.",
  );
  return res.redirect(
    `${CLIENT_URL}/dashboard?error=legacy_instagram_callback_disabled&message=${message}`,
  );
});

/* ---------------- FACEBOOK ---------------- */

router.get("/facebook", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res.redirect(`${CLIENT_URL}/dashboard?error=missing_token`);

    let userId;
    try {
      console.log(
        `\n🔵 [AUTH] Facebook init for token: ${token?.substring(0, 20)}...`,
      );
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (error || !user) throw error || new Error("User not found");

      const dbUser = await createOrUpdateUser(
        user.email,
        user.user_metadata?.full_name || user.email?.split("@")[0],
        user.id,
        user.user_metadata?.avatar_url,
      );
      userId = dbUser.id;
      console.log(`✅ [AUTH] Token verified and synced for user: ${userId}`);
    } catch (e) {
      console.error("❌ [AUTH] Token verification failed:", e.message);
      return res.redirect(
        `${CLIENT_URL}/dashboard?error=invalid_token&details=${encodeURIComponent(e.message)}`,
      );
    }

    const state = facebookOAuth.makeState(userId);
    const authUrl = facebookOAuth.getAuthorizationUrl(state);
    return res.redirect(authUrl);
  } catch (error) {
    console.error("Facebook init error:", error);
    res.redirect(dashboardRedirect({
      error: "facebook_oauth_failed",
      message: error.message,
    }));
  }
});

router.get("/facebook/callback", async (req, res) => {
  const { code, error, error_description: errorDescription, error_reason: errorReason, state } = req.query;

  console.log("\n🔵 Facebook OAuth Callback Received");
  console.log("Query params:", {
    code: code ? "present" : "missing",
    error,
    state: state ? "present" : "missing",
  });

  if (error) {
    return res.redirect(dashboardRedirect({
      error: "facebook_access_denied",
      message: errorDescription || errorReason || error,
    }));
  }
  if (!code || !state)
    return res.redirect(`${CLIENT_URL}/dashboard?error=invalid_callback`);

  const parsed = decodeState(state);
  if (!parsed?.userId)
    return res.redirect(`${CLIENT_URL}/dashboard?error=invalid_state`);

  try {
    const tokenData = await facebookOAuth.exchangeCodeForToken(code);
    const pendingId = crypto.randomUUID();
    pendingOAuthSelections.set(pendingId, {
      provider: "facebook",
      userId: parsed.userId,
      tokenData,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    console.log(`FB: pending page selection created (${tokenData.pages?.length || 0} pages): ${pendingId}`);
    return res.redirect(`${CLIENT_URL}/connect/select?provider=facebook&pending=${pendingId}`);
  } catch (err) {
    console.error("❌ FB callback error:", err.message);
    res.redirect(dashboardRedirect({
      error: "facebook_connection_failed",
      message: err.message,
    }));
  }
});

/* ---------------- PINTEREST ---------------- */

router.get("/pinterest", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res.redirect(`${CLIENT_URL}/dashboard?error=missing_token`);

    let userId;
    try {
      console.log(
        `\n🔵 [AUTH] Pinterest init for token: ${token?.substring(0, 20)}...`,
      );
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (error || !user) throw error || new Error("User not found");

      const dbUser = await createOrUpdateUser(
        user.email,
        user.user_metadata?.full_name || user.email?.split("@")[0],
        user.id,
        user.user_metadata?.avatar_url,
      );
      userId = dbUser.id;
      console.log(`✅ [AUTH] Token verified and synced for user: ${userId}`);
    } catch (e) {
      console.error("❌ [AUTH] Token verification failed:", e.message);
      return res.redirect(
        `${CLIENT_URL}/dashboard?error=invalid_token&details=${encodeURIComponent(e.message)}`,
      );
    }

    const state = Buffer.from(
      JSON.stringify({
        userId,
        provider: "pinterest",
        nonce: crypto.randomUUID(),
        ts: Date.now(),
      }),
    ).toString("base64url");
    const authUrl = pinterestOAuth.getAuthorizationUrl(state);
    res.redirect(authUrl);
  } catch (error) {
    console.error("Pinterest init error:", error);
    res.redirect(`${CLIENT_URL}/dashboard?error=pinterest_oauth_failed`);
  }
});

router.get("/pinterest/callback", async (req, res) => {
  const { code, error, state } = req.query;

  if (error) return res.redirect(`${CLIENT_URL}/dashboard?error=access_denied`);
  if (!code || !state)
    return res.redirect(`${CLIENT_URL}/dashboard?error=invalid_callback`);

  const parsed = decodeState(state);

  // Strict State & Nonce Validation
  const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
  if (
    !parsed?.userId ||
    parsed.provider !== "pinterest" ||
    !parsed.ts ||
    Date.now() - parsed.ts > FIFTEEN_MINUTES_MS
  ) {
    console.error("❌ [PINTEREST-OAUTH] State validation failed (expired state, invalid provider, or user mismatch)");
    return res.redirect(`${CLIENT_URL}/dashboard?error=invalid_state`);
  }

  try {
    const tokenData = await pinterestOAuth.exchangeCodeForToken(code);
    await pinterestOAuth.storeTokens(parsed.userId, tokenData);
    notifyAccountConnected(parsed.userId, "Pinterest", tokenData.username);

    res.redirect(`${CLIENT_URL}/dashboard?success=pinterest_connected`);
  } catch (err) {
    console.error("❌ [PINTEREST-OAUTH] Callback error:", err.message || err);
    res.redirect(`${CLIENT_URL}/dashboard?error=pinterest_connection_failed`);
  }
});

/* ---------------- BLUESKY ---------------- */

// Bluesky uses a different auth flow - handle and app password
router.post("/bluesky/connect", authenticateUser, async (req, res) => {
  try {
    const { handle, appPassword } = req.body;
    const userId = req.user.userId;

    if (!handle || !appPassword) {
      return res.status(400).json({
        success: false,
        error: "Bluesky handle and app password are required",
      });
    }

    console.log("\n🔵 Bluesky: Connecting account...");
    console.log("User ID:", userId);
    console.log("Handle:", handle);

    // Authenticate with Bluesky
    const sessionData = await blueskyAuth.authenticate(handle, appPassword);

    // Fetch profile
    try {
      const profile = await blueskyAuth.getProfile(sessionData.accessJwt, sessionData.did);
      sessionData.profile = profile;
    } catch (err) {
      console.warn("Could not fetch Bluesky profile", err);
    }

    // Store credentials
    await blueskyAuth.storeCredentials(userId, sessionData);

    res.json({
      success: true,
      message: "Bluesky account connected successfully",
      handle: sessionData.handle,
    });
  } catch (error) {
    console.error("❌ Bluesky connect error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to connect Bluesky account",
    });
  }
});

/* ---------------- LINKEDIN ---------------- */

router.get("/linkedin", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res.redirect(`${CLIENT_URL}/dashboard?error=missing_token`);

    let userId;
    try {
      console.log(
        `\n🔵 [AUTH] LinkedIn init for token: ${token?.substring(0, 20)}...`,
      );
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (error || !user) throw error || new Error("User not found");

      const dbUser = await createOrUpdateUser(
        user.email,
        user.user_metadata?.full_name || user.email?.split("@")[0],
        user.id,
        user.user_metadata?.avatar_url,
      );
      userId = dbUser.id;
      console.log(`✅ [AUTH] Token verified and synced for user: ${userId}`);
    } catch (e) {
      console.error("❌ [AUTH] Token verification failed:", e.message);
      return res.redirect(
        `${CLIENT_URL}/dashboard?error=invalid_token&details=${encodeURIComponent(e.message)}`,
      );
    }

    const state = linkedinOAuth.makeState(userId);
    const authUrl = linkedinOAuth.getAuthorizationUrl(state);
    return res.redirect(authUrl);
  } catch (error) {
    console.error("LinkedIn init error:", error);
    res.redirect(`${CLIENT_URL}/dashboard?error=linkedin_oauth_failed`);
  }
});

router.get("/linkedin/callback", async (req, res) => {
  const { code, error, state } = req.query;

  console.log("\n🔵 LinkedIn OAuth Callback Received");
  console.log("Query params:", {
    code: code ? "present" : "missing",
    error,
    state: state ? "present" : "missing",
  });

  if (error) return res.redirect(`${CLIENT_URL}/dashboard?error=access_denied`);
  if (!code || !state)
    return res.redirect(`${CLIENT_URL}/dashboard?error=invalid_callback`);

  const parsed = decodeState(state);
  if (!parsed?.userId)
    return res.redirect(`${CLIENT_URL}/dashboard?error=invalid_state`);

  try {
    const tokenData = await linkedinOAuth.exchangeCodeForToken(code);
    await linkedinOAuth.storeTokens(parsed.userId, tokenData);
    notifyAccountConnected(parsed.userId, "LinkedIn", tokenData.name);

    res.redirect(`${CLIENT_URL}/dashboard?success=linkedin_connected`);
  } catch (err) {
    console.error("❌ LinkedIn callback error:", err.message);
    res.redirect(`${CLIENT_URL}/dashboard?error=linkedin_connection_failed`);
  }
});

/* ---------------- MASTODON ---------------- */

router.post("/mastodon/init", authenticateUser, async (req, res) => {
  try {
    const { instanceUrl } = req.body;
    const userId = req.user.userId;

    if (!instanceUrl) {
      return res
        .status(400)
        .json({ success: false, error: "Instance URL is required" });
    }

    // 1. Register app on the instance
    const registration = await mastodonOAuth.registerApp(instanceUrl);

    // 2. Create state with all needed info
    const state = mastodonOAuth.makeState(
      userId,
      instanceUrl,
      registration.clientId,
      registration.clientSecret,
    );

    // 3. Return the auth URL
    const authUrl = mastodonOAuth.getAuthorizationUrl(
      instanceUrl,
      registration.clientId,
      state,
    );

    res.json({ success: true, authUrl });
  } catch (error) {
    console.error("Mastodon init error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/mastodon/callback", async (req, res) => {
  const { code, error, state } = req.query;

  if (error) return res.redirect(`${CLIENT_URL}/dashboard?error=access_denied`);
  if (!code || !state)
    return res.redirect(`${CLIENT_URL}/dashboard?error=invalid_callback`);

  const parsed = decodeState(state);
  if (
    !parsed?.userId ||
    !parsed?.instanceUrl ||
    !parsed?.clientId ||
    !parsed?.clientSecret
  ) {
    return res.redirect(`${CLIENT_URL}/dashboard?error=invalid_state`);
  }

  try {
    const tokenData = await mastodonOAuth.exchangeCodeForToken(
      parsed.instanceUrl,
      parsed.clientId,
      parsed.clientSecret,
      code,
    );

    await mastodonOAuth.storeTokens(
      parsed.userId,
      parsed.instanceUrl,
      tokenData,
    );
    notifyAccountConnected(parsed.userId, "Mastodon", tokenData.username);

    res.redirect(`${CLIENT_URL}/dashboard?success=mastodon_connected`);
  } catch (err) {
    console.error("❌ Mastodon callback error:", err.message);
    res.redirect(`${CLIENT_URL}/dashboard?error=mastodon_connection_failed`);
  }
});



/* ---------------- THREADS ---------------- */

router.get("/threads", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res.redirect(`${CLIENT_URL}/dashboard?error=missing_token`);

    let userId;
    try {
      console.log(
        `\n🔵 [AUTH] Threads init for token: ${token?.substring(0, 20)}...`,
      );
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (error || !user) throw error || new Error("User not found");

      const dbUser = await createOrUpdateUser(
        user.email,
        user.user_metadata?.full_name || user.email?.split("@")[0],
        user.id,
        user.user_metadata?.avatar_url,
      );
      userId = dbUser.id;
      console.log(`✅ [AUTH] Token verified and synced for user: ${userId}`);
    } catch (e) {
      console.error("❌ [AUTH] Token verification failed:", e.message);
      return res.redirect(
        `${CLIENT_URL}/dashboard?error=invalid_token&details=${encodeURIComponent(e.message)}`,
      );
    }

    const state = threadsOAuth.makeState({
      userId,
      authUserId: jwt.decode(String(token))?.sub,
    });
    const authUrl = threadsOAuth.getAuthorizationUrl(state);
    return res.redirect(authUrl);
  } catch (error) {
    console.error("Threads init error:", error);
    res.redirect(`${CLIENT_URL}/dashboard?error=threads_oauth_failed`);
  }
});

router.get("/threads/callback", async (req, res) => {
  const { code, error, state } = req.query;

  if (error) return res.redirect(`${CLIENT_URL}/dashboard?error=access_denied`);
  if (!code || !state)
    return res.redirect(`${CLIENT_URL}/dashboard?error=invalid_callback`);

  const parsed = decodeState(state);
  if (!parsed?.userId)
    return res.redirect(`${CLIENT_URL}/dashboard?error=invalid_state`);

  try {
    const tokenData = await threadsOAuth.exchangeCodeForToken(code);
    await assertCanConnectTarget({
      user: { userId: parsed.userId, authUserId: parsed.authUserId },
      provider: "threads",
      accountId: tokenData.threadsUserId,
    });
    await threadsOAuth.storeTokens(parsed.userId, tokenData);
    notifyAccountConnected(parsed.userId, "Threads", tokenData.username);

    console.log(
      `✅ [AUTH] Threads connected successfully for user ${parsed.userId}`,
    );
    res.redirect(`${CLIENT_URL}/dashboard?success=threads_connected`);
  } catch (err) {
    console.error("❌ Threads callback error:", err.message);
    res.redirect(
      `${CLIENT_URL}/dashboard?error=threads_connection_failed&message=${encodeURIComponent(err.message)}`,
    );
  }
});

/* ---------------- 𝕏 (TWITTER) ---------------- */

router.get("/x", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res.redirect(`${CLIENT_URL}/dashboard?error=missing_token`);

    let userId;
    try {
      console.log(
        `\n🔵 [AUTH] X init for token: ${token?.substring(0, 20)}...`,
      );
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (error || !user) throw error || new Error("User not found");

      const dbUser = await createOrUpdateUser(
        user.email,
        user.user_metadata?.full_name || user.email?.split("@")[0],
        user.id,
        user.user_metadata?.avatar_url,
      );
      userId = dbUser.id;
      console.log(`✅ [AUTH] Token verified and synced for user: ${userId}`);
    } catch (e) {
      console.error("❌ [AUTH] Token verification failed:", e.message);
      return res.redirect(
        `${CLIENT_URL}/dashboard?error=invalid_token&details=${encodeURIComponent(e.message)}`,
      );
    }

    // X requires PKCE. We'll generate a verifier and challenge.
    // Since we don't have sessions, we'll encode the verifier into the state.
    const { verifier, challenge } = xOAuth.generatePKCE();

    // Create state object with verifier
    const stateObj = {
      userId,
      provider: "x",
      codeVerifier: verifier, // Store verifier here to use in callback
      nonce: crypto.randomUUID(),
      ts: Date.now(),
    };

    const state = Buffer.from(JSON.stringify(stateObj)).toString("base64url");
    const authUrl = xOAuth.getAuthorizationUrl(state, challenge);

    return res.redirect(authUrl);
  } catch (error) {
    console.error("X init error:", error);
    res.redirect(`${CLIENT_URL}/dashboard?error=x_oauth_failed`);
  }
});

router.get("/x/callback", async (req, res) => {
  const { code, error, state } = req.query;

  console.log("\n🔵 X OAuth Callback Received");
  console.log(
    " - Code:",
    code ? "***" + code.substring(code.length - 5) : "MISSING",
  );
  console.log(" - State:", state ? "PRESENT" : "MISSING");
  console.log(" - Error:", error || "NONE");

  if (error) {
    console.error("❌ X OAuth Error from provider:", error);
    return res.redirect(
      `${CLIENT_URL}/dashboard?error=access_denied&details=${error}`,
    );
  }
  if (!code || !state)
    return res.redirect(`${CLIENT_URL}/dashboard?error=invalid_callback`);

  const parsed = decodeState(state);
  if (!parsed?.userId || !parsed?.codeVerifier) {
    console.error("❌ X callback error: invalid state or missing verifier");
    console.log(" - Parsed State:", parsed);
    return res.redirect(`${CLIENT_URL}/dashboard?error=invalid_state`);
  }

  console.log(" - Verifier retrieved:", parsed.codeVerifier ? "YES" : "NO");

  try {
    const tokenData = await xOAuth.exchangeCodeForTokens(
      code,
      parsed.codeVerifier,
    );
    console.log(" - Token exchange success!");
    await xOAuth.storeTokens(parsed.userId, tokenData);
    notifyAccountConnected(parsed.userId, "X (Twitter)", tokenData.username);

    console.log(`✅ [AUTH] X connected successfully for user ${parsed.userId}`);
    res.redirect(`${CLIENT_URL}/dashboard?success=x_connected`);
  } catch (err) {
    console.error("❌ X callback error:", err.message);
    res.redirect(
      `${CLIENT_URL}/dashboard?error=x_connection_failed&message=${encodeURIComponent(err.message)}`,
    );
  }
});

/* ---------------- REDDIT ---------------- */

router.get("/reddit", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token)
      return res.redirect(`${CLIENT_URL}/dashboard?error=missing_token`);

    let userId;
    try {
      console.log(
        `\n🔵 [AUTH] Reddit init for token: ${token?.substring(0, 20)}...`,
      );
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);
      if (error || !user) throw error || new Error("User not found");

      const dbUser = await createOrUpdateUser(
        user.email,
        user.user_metadata?.full_name || user.email?.split("@")[0],
        user.id,
        user.user_metadata?.avatar_url,
      );
      userId = dbUser.id;
      console.log(`✅ [AUTH] Token verified and synced for user: ${userId}`);
    } catch (e) {
      console.error("❌ [AUTH] Token verification failed:", e.message);
      return res.redirect(
        `${CLIENT_URL}/dashboard?error=invalid_token&details=${encodeURIComponent(e.message)}`,
      );
    }

    const state = redditOAuth.makeState(userId);
    const authUrl = redditOAuth.getAuthorizationUrl(state);
    return res.redirect(authUrl);
  } catch (error) {
    console.error("Reddit init error:", error);
    res.redirect(`${CLIENT_URL}/dashboard?error=reddit_oauth_failed`);
  }
});

router.get("/reddit/callback", async (req, res) => {
  const { code, error, state } = req.query;

  if (error) return res.redirect(`${CLIENT_URL}/dashboard?error=access_denied`);
  if (!code || !state)
    return res.redirect(`${CLIENT_URL}/dashboard?error=invalid_callback`);

  const parsed = decodeState(state);
  if (!parsed?.userId)
    return res.redirect(`${CLIENT_URL}/dashboard?error=invalid_state`);

  try {
    const tokenData = await redditOAuth.exchangeCodeForToken(code);
    await redditOAuth.storeTokens(parsed.userId, tokenData);

    console.log(
      `✅ [AUTH] Reddit connected successfully for user ${parsed.userId}`,
    );
    res.redirect(`${CLIENT_URL}/dashboard?success=reddit_connected`);
  } catch (err) {
    console.error("❌ Reddit callback error:", err.message);
    res.redirect(
      `${CLIENT_URL}/dashboard?error=reddit_connection_failed&message=${encodeURIComponent(err.message)}`,
    );
  }
});

// LinkedIn manual connection with access token
router.post("/linkedin/connect", authenticateUser, async (req, res) => {
  try {
    const { accessToken } = req.body;
    const userId = req.user.userId;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: "LinkedIn access token is required",
      });
    }

    console.log("\n🔵 LinkedIn: Connecting account with manual token...");
    console.log("User ID:", userId);

    // Get user info from LinkedIn API
    const userInfo = await linkedinOAuth.getUserProfile(accessToken);

    // Store tokens
    await linkedinOAuth.storeTokens(userId, {
      accessToken,
      expiresIn: 5184000, // 60 days default
      userInfo,
    });

    res.json({
      success: true,
      message: "LinkedIn account connected successfully",
      name: userInfo.name,
    });
  } catch (error) {
    console.error("❌ LinkedIn connect error:", error);
    res.status(500).json({
      success: false,
      error:
        error.response?.data?.message ||
        error.message ||
        "Failed to connect LinkedIn account",
    });
  }
});

/* ---------------- PINTEREST MANUAL CONNECT ---------------- */

// Pinterest manual connection with access token
router.post("/pinterest/connect", authenticateUser, async (req, res) => {
  try {
    const isManualAllowed = process.env.NODE_ENV !== 'production' || process.env.ALLOW_MANUAL_PINTEREST_TOKEN === 'true';
    if (!isManualAllowed) {
      return res.status(403).json({
        success: false,
        error: "Manual token connection is disabled in production. Please use official Pinterest OAuth.",
      });
    }

    const { accessToken, boardId } = req.body;
    const userId = req.user.userId;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: "Pinterest access token is required",
      });
    }

    console.log("\n📌 Pinterest: Connecting account with manual token...");
    console.log("User ID:", userId);
    console.log("Token preview:", accessToken.substring(0, 20) + "...");

    // Get user info from Pinterest API
    const userInfo = await pinterestOAuth.getUserInfo(accessToken);

    // Get boards
    let boards = [];
    try {
      boards = await pinterestOAuth.getBoards(accessToken);
    } catch (boardError) {
      console.warn(
        "⚠️ Could not fetch Pinterest boards during connect:",
        boardError.message,
      );
    }

    // Use provided boardId or first board
    let targetBoardId = boardId;
    let targetBoardName = null;

    if (!targetBoardId && boards && boards.length > 0) {
      targetBoardId = boards[0].id;
      targetBoardName = boards[0].name;
    } else if (targetBoardId && boards && boards.length > 0) {
      const foundBoard = boards.find((b) => b.id === targetBoardId);
      targetBoardName = foundBoard?.name || null;
    }

    // Store tokens
    await pinterestOAuth.storeTokens(userId, {
      accessToken,
      refreshToken: null, // Manual tokens don't have refresh
      boardId: targetBoardId,
      boardName: targetBoardName,
      userInfo: {
        username: userInfo.username || userInfo.account_type || "User",
        profileImage:
          userInfo.profile_image || userInfo.profile_image_url || null,
      },
    });

    res.json({
      success: true,
      message: "Pinterest account connected successfully",
      username: userInfo.username,
      boardId: targetBoardId,
      boardName: targetBoardName,
    });
  } catch (error) {
    console.error("❌ Pinterest connect error:", error);
    console.error("Full error response:", error.response?.data);

    // Provide more detailed error messages
    let errorMessage = error.message || "Failed to connect Pinterest account";

    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }

    if (error.response?.data?.code === 1) {
      errorMessage =
        "Consumer app type not supported. Please create a Business or Creator+Advertiser app on Pinterest Developers Console and regenerate your access token.";
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.response?.data,
    });
  }
});

/* ---------------- ME + ACCOUNTS ---------------- */

router.get("/me", authenticateUser, (req, res) => {
  res.json({
    success: true,
    user: {
      userId: req.user.userId,
      email: req.user.email,
      name: req.user.name,
    },
  });
});

router.get("/accounts", authenticateUser, async (req, res) => {
  try {
    const accounts = await getConnectedAccounts(req.user);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({
      success: true,
      accounts,
    });
  } catch (error) {
    console.error("Get accounts error:", error);
    res
      .status(500)
      .json({ success: false, error: "Failed to get connected accounts" });
  }
});

router.get("/pending-selection/:id", authenticateUser, async (req, res) => {
  try {
    const pending = pendingOAuthSelections.get(req.params.id);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingOAuthSelections.delete(req.params.id);
      return res.status(404).json({ success: false, error: "Selection expired. Please reconnect." });
    }
    if (pending.userId !== req.user.userId) {
      return res.status(403).json({ success: false, error: "Selection does not belong to this user." });
    }
    console.log(`FB: pending page selection fetched: ${req.params.id}`);

    const userIds = [...new Set([req.user.userId, req.user.authUserId].filter(Boolean))];
    const { data: existingRows, error: existingError } = await supabase
      .from("social_tokens")
      .select("account_id,page_id")
      .in("user_id", userIds)
      .eq("provider", pending.provider);

    if (existingError) {
      console.warn("Error fetching existing social tokens:", existingError);
    }

    let accountLimit = Infinity;
    let connectedCount = 0;
    let availableSlots = Number.MAX_SAFE_INTEGER;

    try {
      const entitlements = await getEntitlements(req.user.authUserId || req.user.userId, req.user.email, req.token);
      accountLimit = entitlements?.limits?.social_accounts ?? Infinity;
      connectedCount = await getConnectedTargetCount(req.user.userId);
      availableSlots = Number.isFinite(accountLimit)
        ? Math.max(0, accountLimit - connectedCount)
        : Number.MAX_SAFE_INTEGER;
    } catch (entErr) {
      console.warn("Could not fetch entitlements for pending selection, defaulting to unlimited:", entErr);
    }

    const connectedIds = new Set(
      (existingRows || [])
        .flatMap((row) => [row.account_id, row.page_id])
        .filter(Boolean)
        .map(String),
    );

    res.json({
      success: true,
      provider: pending.provider,
      accountLimit,
      connectedCount,
      availableSlots,
      accounts: (pending.tokenData.pages || []).map((page) => ({
        id: page.pageId,
        name: page.userInfo?.pageName,
        picture: page.userInfo?.picture?.data?.url || page.userInfo?.picture?.url || null,
        alreadyConnected: connectedIds.has(String(page.pageId)),
      })),
    });
  } catch (err) {
    console.error("Error in pending-selection GET route:", err);
    res.status(500).json({ success: false, error: err.message || "Failed to retrieve pending accounts." });
  }
});

router.post("/pending-selection/:id", authenticateUser, async (req, res) => {
  try {
    const pending = pendingOAuthSelections.get(req.params.id);
    if (!pending || pending.expiresAt < Date.now()) {
      pendingOAuthSelections.delete(req.params.id);
      return res.status(404).json({ success: false, error: "Selection expired. Please reconnect." });
    }
    if (pending.userId !== req.user.userId || pending.provider !== "facebook") {
      return res.status(403).json({ success: false, error: "Selection does not belong to this user." });
    }
    const selectedIds = new Set((req.body?.selectedIds || []).map(String));
    const pages = (pending.tokenData.pages || []).filter((page) => selectedIds.has(String(page.pageId)));
    if (!pages.length) {
      return res.status(400).json({ success: false, error: "Select at least one account." });
    }

    const { data: existingRows, error: existingError } = await supabase
      .from("social_tokens")
      .select("account_id,page_id")
      .eq("user_id", req.user.userId)
      .eq("provider", "facebook");
    if (existingError) throw existingError;

    const connectedIds = new Set(
      (existingRows || [])
        .flatMap((row) => [row.account_id, row.page_id])
        .filter(Boolean)
        .map(String),
    );
    const newPages = pages.filter((page) => !connectedIds.has(String(page.pageId)));
    const entitlements = await getEntitlements(req.user.authUserId || req.user.userId, req.user.email, req.token);
    const accountLimit = entitlements.limits.social_accounts;

    if (Number.isFinite(accountLimit)) {
      const used = await getConnectedTargetCount(req.user.userId);
      if (used + newPages.length > accountLimit) {
        const error = new Error(`Your plan allows ${accountLimit} connected social account${accountLimit === 1 ? "" : "s"}. Deselect accounts or upgrade to connect more.`);
        error.code = "PLAN_LIMIT_REACHED";
        throw error;
      }
    }

    for (const page of newPages) {
      await assertCanConnectTarget({
        user: req.user,
        provider: "facebook",
        accountId: page.pageId,
      });
    }
    await facebookOAuth.storeTokens(req.user.userId, { ...pending.tokenData, pages });
    pendingOAuthSelections.delete(req.params.id);
    console.log(`FB: saved selected pages: ${pages.map((page) => page.pageId).join(", ")}`);
    res.json({ success: true });
  } catch (error) {
    res.status(error.code === "PLAN_LIMIT_REACHED" ? 403 : 500).json({
      success: false,
      error: error.message,
      code: error.code,
    });
  }
});

/* ---------------- DISCONNECT (single clean route) ---------------- */
router.delete("/disconnect/:provider", authenticateUser, async (req, res) => {
  try {
    const { provider } = req.params;
    const validProviders = [
      "youtube",
      "instagram",
      "pinterest",
      "facebook",
      "bluesky",
      "linkedin",
      "mastodon",
      "tiktok",
      "threads",
      "x",
      "reddit",
      "googleBusiness",
    ];
    if (!validProviders.includes(provider)) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid provider" });
    }

    const { accountId } = req.query;
    console.log(`[DISCONNECT] provider=${provider}, accountId=${accountId}, userId=${req.user.userId}`);

    if (provider === "instagram") {
      // Soft-disconnect: preserve automations, contacts, sessions, metrics
      // (previously this was .delete() which triggered ON DELETE CASCADE
      //  and permanently destroyed all automations — see instapilot.js for the safe pattern)
      let igQuery = supabase
        .from("instagram_accounts")
        .update({
          is_connected: false,
          token_status: "disconnected",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", req.user.userId);

      if (accountId) {
        igQuery = igQuery.eq("id", accountId);
      }
      const { data: igData, error: igError } = await igQuery.select();
      console.log(`[DISCONNECT] igData=${JSON.stringify(igData)} error=${JSON.stringify(igError)}`);

      if (igError) throw igError;

      const disconnectedBusinessIds = (igData || [])
        .map((account) => account.instagram_business_account_id)
        .filter(Boolean);

      if (!accountId || disconnectedBusinessIds.length > 0) {
        let tokenQuery = supabase
          .from("social_tokens")
          .delete()
          .eq("user_id", req.user.userId)
          .eq("provider", "instagram");

        if (disconnectedBusinessIds.length > 0) {
          tokenQuery = tokenQuery.in("account_id", disconnectedBusinessIds);
        }

        const { error: tokenError } = await tokenQuery;
        if (tokenError) throw tokenError;
      }

      // Pause all active automations for disconnected account(s)
      // so they don't attempt to run with invalid/null tokens
      const disconnectedIds = (igData || []).map(a => a.id);
      if (disconnectedIds.length > 0) {
        const { error: pauseError } = await supabase
          .from("automations")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .in("instagram_account_id", disconnectedIds);
        if (pauseError) {
          console.warn(`[DISCONNECT] Failed to pause automations: ${pauseError.message}`);
        } else {
          console.log(`[DISCONNECT] Paused automations for account(s): ${disconnectedIds.join(", ")}`);
        }
      }

      if (accountId) {
        return res.json({
          success: true,
          message: `Instagram account disconnected successfully`,
        });
      }
    }

    let query = supabase
      .from("social_tokens")
      .delete()
      .eq("user_id", req.user.userId)
      .eq("provider", provider);

    if (accountId && provider !== "instagram") {
      query = query.eq("id", accountId);
    }

    const { error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      message: `${provider} disconnected successfully`,
    });
  } catch (err) {
    console.error("Disconnect error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
