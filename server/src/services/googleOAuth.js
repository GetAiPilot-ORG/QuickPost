import axios from "axios";
import { google } from "googleapis";
import supabase from "./supabase.js";

const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

/**
 * Google OAuth Service
 * Handles YouTube authentication via Google OAuth 2.0
 */
function base64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

class GoogleOAuthService {
  constructor() { }

  createClient() {
    return new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI ||
      "http://localhost:5000/api/auth/google/callback",
    );
  }

  makeState(userId) {
    return base64urlEncode({
      userId,
      provider: "youtube",
      nonce: Math.random().toString(36).substring(7),
      ts: Date.now(),
    });
  }

  /**
   * Generate Google OAuth authorization URL
   * @param {string} state - Base64 encoded state object
   */
  getAuthorizationUrl(state) {
    const client = this.createClient();
    const authUrl = client.generateAuthUrl({
      access_type: "offline", // Request refresh token
      scope: YOUTUBE_SCOPES,
      prompt: "consent", // Force consent screen to get refresh token
      state,
    });
    return authUrl;
  }

  /**
   * Exchange authorization code for tokens
   * @param {string} code - Authorization code from OAuth callback
   * @returns {Promise<Object>} User info and tokens
   */
  async exchangeCodeForTokens(code) {
    try {
      const client = this.createClient();
      // Exchange code for tokens
      const { tokens } = await client.getToken(code);
      client.setCredentials(tokens);

      // Get user info
      const oauth2 = google.oauth2({ version: "v2", auth: client });
      const { data: userInfo } = await oauth2.userinfo.get();

      // Get YouTube Channel info (to get the channel name/handle)
      const youtube = google.youtube({
        version: "v3",
        auth: client,
      });
      let channelTitle = userInfo.name; // Fallback to Google name
      let channelId = userInfo.id;
      let channelStatus = null;
      let channelStats = null;
      let channelThumbnail = null;
      try {
        const channelRes = await youtube.channels.list({
          part: "snippet,status,statistics",
          mine: true,
        });
        if (channelRes.data.items && channelRes.data.items.length > 0) {
          const channel = channelRes.data.items[0];
          channelId = channel.id || channelId;
          channelTitle = channel.snippet.title;
          channelStatus = channel.status || null;
          channelStats = channel.statistics || null;
          channelThumbnail = channel.snippet?.thumbnails?.default?.url || channel.snippet?.thumbnails?.medium?.url || null;
        }
      } catch (err) {
        console.warn(
          "⚠️ [GOOGLE_OAUTH] Failed to fetch YT channel info:",
          err.message,
        );
      }

      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        userInfo: {
          email: userInfo.email,
          name: userInfo.name,
          picture: channelThumbnail || userInfo.picture,
          googleId: userInfo.id,
          channelId,
          username: channelTitle,
          youtubeStatus: channelStatus,
          youtubeStats: channelStats,
        },
      };
    } catch (error) {
      console.error("Error exchanging code for tokens:", error);
      throw new Error("Failed to authenticate with Google");
    }
  }

  /**
   * Store or update Google/YouTube tokens in Supabase
   * @param {string} userId - User's UUID
   * @param {Object} tokenData - Token information
   */
  async storeTokens(userId, tokenData) {
    try {
      const { data: existingRow, error: existingError } = await supabase
        .from("social_tokens")
        .select("refresh_token, username, profile_data, token_expiry")
        .eq("user_id", userId)
        .eq("provider", "youtube")
        .eq("account_id", tokenData.userInfo?.channelId || tokenData.userInfo?.googleId)
        .maybeSingle();

      if (existingError) {
        console.warn(
          "⚠️ [GOOGLE_OAUTH] Failed to read existing YouTube token row:",
          existingError.message,
        );
      }

      const expiryDate = tokenData.expiryDate
        ? new Date(tokenData.expiryDate)
        : null;
      const resolvedRefreshToken =
        tokenData.refreshToken ?? existingRow?.refresh_token ?? null;
      const resolvedUsername =
        tokenData.userInfo?.username ?? existingRow?.username ?? null;
      const resolvedProfileData =
        tokenData.userInfo ?? existingRow?.profile_data ?? null;
      const resolvedExpiry =
        expiryDate && !Number.isNaN(expiryDate.getTime())
          ? expiryDate.toISOString()
          : existingRow?.token_expiry ?? null;

      const { data, error } = await supabase
        .from("social_tokens")
        .upsert(
          {
            user_id: userId,
            provider: "youtube",
            access_token: tokenData.accessToken,
            refresh_token: resolvedRefreshToken,
            token_expiry: resolvedExpiry,
            account_id: tokenData.userInfo?.channelId || tokenData.userInfo?.googleId,
            username: resolvedUsername,
            profile_data: resolvedProfileData,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "user_id,provider,account_id",
          },
        )
        .select();

      if (error) {
        console.error("Supabase error storing tokens:", error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error("Error storing tokens:", error);
      throw new Error("Failed to store authentication tokens");
    }
  }

  /**
   * Refresh expired access token
   * @param {string} refreshToken - Google refresh token
   * @returns {Promise<Object>} New access token and expiry
   */
  async refreshAccessToken(refreshToken) {
    try {
      console.log("🔄 [GOOGLE_OAUTH] Refreshing access token...");
      const client = this.createClient();
      client.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await client.refreshAccessToken();
      console.log("✅ [GOOGLE_OAUTH] Access token refreshed");

      return {
        accessToken: credentials.access_token,
        expiryDate: credentials.expiry_date,
      };
    } catch (error) {
      console.error("Error refreshing token:", error);
      // Detailed error for the user
      const isInvalidGrant = error.response?.data?.error === 'invalid_grant' || error.message?.includes('invalid_grant');
      const message = isInvalidGrant
        ? "YouTube connection expired. Please reconnect your YouTube account."
        : `Failed to refresh YouTube access token: ${error.message}`;
      throw new Error(message);
    }
  }

  /**
   * Get valid access token (refresh if expired)
   * @param {string} userId - User's UUID
   * @returns {Promise<string>} Valid access token
   */
  async getValidAccessToken(userId, accountId = null) {
    try {
      console.log(
        `🔍 [GOOGLE_OAUTH] Fetching tokens for user ${userId} from DB...`,
      );
      let query = supabase
        .from("social_tokens")
        .select("*")
        .eq("user_id", userId)
        .in("provider", ["youtube", "google"]);
      if (accountId) {
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(accountId);
        if (isUUID) {
          query = query.or(`id.eq.${accountId},account_id.eq.${accountId}`);
        } else {
          query = query.eq("account_id", accountId);
        }
      }
      const { data, error } = await query.limit(1).maybeSingle();
      console.log("✅ [GOOGLE_OAUTH] DB fetch complete. Token found:", !!data);

      if (error || !data) {
        throw new Error("YouTube account not connected");
      }

      const now = new Date();
      const expiry = data.token_expiry ? new Date(data.token_expiry) : null;
      const hasUsableAccessToken = Boolean(data.access_token);
      const hasRefreshToken = Boolean(data.refresh_token);
      const isExpiryValid = expiry && !Number.isNaN(expiry.getTime());

      // If token expires in less than 5 minutes, refresh it
      if (!hasUsableAccessToken) {
        throw new Error("YouTube account not connected");
      }

      const shouldRefresh = (!isExpiryValid && hasRefreshToken) || (isExpiryValid && (expiry - now < 5 * 60 * 1000));

      if (shouldRefresh) {
        if (!hasRefreshToken) {
          throw new Error(
            "YouTube connection expired. Please reconnect your YouTube account.",
          );
        }

        console.log("Token expired or expiring soon, refreshing...");
        const refreshed = await this.refreshAccessToken(data.refresh_token);

        await supabase
          .from("social_tokens")
          .update({
            access_token: refreshed.accessToken,
            token_expiry: refreshed.expiryDate
              ? new Date(refreshed.expiryDate).toISOString()
              : data.token_expiry,
            updated_at: new Date().toISOString(),
          })
          .eq("id", data.id)
          .eq("user_id", userId);

        return refreshed.accessToken;
      }

      return data.access_token;
    } catch (error) {
      console.error("Error getting valid access token:", error);
      throw error;
    }
  }

  async getChannelHealth(accessToken) {
    const client = this.createClient();
    client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: "v3", auth: client });
    const { data } = await youtube.channels.list({
      part: "snippet,status,statistics,contentDetails",
      mine: true,
    });
    const channel = data.items?.[0];
    if (!channel) throw new Error("No YouTube channel found for this account");
    const longUploadsStatus = channel.status?.longUploadsStatus || "unknown";
    return {
      id: channel.id,
      title: channel.snippet?.title,
      description: channel.snippet?.description,
      thumbnail: channel.snippet?.thumbnails?.default?.url || channel.snippet?.thumbnails?.medium?.url,
      customUrl: channel.snippet?.customUrl,
      publishedAt: channel.snippet?.publishedAt,
      status: channel.status || {},
      statistics: channel.statistics || {},
      uploadsPlaylistId: channel.contentDetails?.relatedPlaylists?.uploads || null,
      capabilities: {
        longUploadsStatus,
        longUploadsAllowed: longUploadsStatus === "allowed",
        needsPhoneVerification: longUploadsStatus === "eligible",
        blockedFromLongUploads: longUploadsStatus === "disallowed",
        madeForKids: Boolean(channel.status?.madeForKids || channel.status?.selfDeclaredMadeForKids),
      },
      requiredActions: longUploadsStatus === "allowed" ? [] : [{
        id: "youtube-feature-eligibility",
        label: longUploadsStatus === "eligible" ? "Enable intermediate features" : "Review YouTube feature eligibility",
        description: longUploadsStatus === "eligible"
          ? "Phone verification is required before this channel can use every upload feature."
          : "This channel is not currently eligible for long uploads. Check YouTube Studio for policy or verification steps.",
        url: "https://studio.youtube.com/channel/UC/features",
      }],
    };
  }

  async listChannelUploads(accessToken, uploadsPlaylistId, maxResults = 25) {
    if (!uploadsPlaylistId) return [];
    const client = this.createClient();
    client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: "v3", auth: client });
    const { data: playlistData } = await youtube.playlistItems.list({
      part: "snippet,contentDetails",
      playlistId: uploadsPlaylistId,
      maxResults,
    });
    const items = playlistData.items || [];
    const ids = items.map((item) => item.contentDetails?.videoId).filter(Boolean);
    if (ids.length === 0) return [];

    const { data: videoData } = await youtube.videos.list({
      part: "snippet,status,statistics,contentDetails",
      id: ids.join(","),
      maxResults,
    });
    const byId = new Map((videoData.items || []).map((video) => [video.id, video]));
    return ids.map((id) => {
      const video = byId.get(id);
      if (!video) return null;
      const thumbnails = video.snippet?.thumbnails || {};
      const bestThumbnail =
        thumbnails.maxres?.url ||
        thumbnails.standard?.url ||
        thumbnails.high?.url ||
        thumbnails.medium?.url ||
        thumbnails.default?.url ||
        `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

      return {
        id,
        title: video.snippet?.title || "Untitled video",
        description: video.snippet?.description || "",
        thumbnail: bestThumbnail,
        publishedAt: video.snippet?.publishedAt,
        privacyStatus: video.status?.privacyStatus || "unknown",
        uploadStatus: video.status?.uploadStatus || "uploaded",
        duration: video.contentDetails?.duration || "",
        views: video.statistics?.viewCount || "0",
        comments: video.statistics?.commentCount || "0",
        likes: video.statistics?.likeCount || "0",
        url: `https://www.youtube.com/watch?v=${id}`,
      };
    }).filter(Boolean);
  }

  async updateVideoVisibility(accessToken, videoId, privacyStatus) {
    const client = this.createClient();
    client.setCredentials({ access_token: accessToken });
    const youtube = google.youtube({ version: "v3", auth: client });
    const { data } = await youtube.videos.update({
      part: "status",
      requestBody: {
        id: videoId,
        status: { privacyStatus },
      },
    });
    return data.status?.privacyStatus || privacyStatus;
  }
}

export default new GoogleOAuthService();
