import axios from 'axios';
import dotenv from 'dotenv';
import IORedis from 'ioredis';
import supabase from './supabase.js';
import { encryptToken, decryptToken } from './tokenEncryption.js';

dotenv.config();

// Shared Redis client for distributed lock across multiple Node.js instances & BullMQ workers
let redisClient = null;
function getRedisLockClient() {
  const url = process.env.REDIS_URL || process.env.BULLMQ_REDIS_URL;
  if (!url) return null;
  if (!redisClient) {
    redisClient = new IORedis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 1000,
      enableReadyCheck: false,
      retryStrategy: () => null
    });
    redisClient.on('error', () => {});
  }
  return redisClient;
}

// In-memory fallback mutex map if Redis is not configured
const activeRefreshMutexes = new Map();

/**
 * Acquire distributed lock across processes/instances
 */
async function acquireDistributedLock(lockKey, ttlMs = 15000) {
  const redis = getRedisLockClient();
  const lockId = Math.random().toString(36).substring(2);

  if (redis) {
    const key = `lock:pinterest:refresh:${lockKey}`;
    try {
      const acquired = await redis.set(key, lockId, 'PX', ttlMs, 'NX');
      if (acquired === 'OK') {
        return async () => {
          try {
            const val = await redis.get(key);
            if (val === lockId) await redis.del(key);
          } catch (e) {}
        };
      }
      return null;
    } catch (err) {
      console.warn('⚠️ [PINTEREST-REFRESH] Redis lock check failed, falling back to process mutex:', err.message);
    }
  }

  // Process-level fallback mutex
  if (activeRefreshMutexes.has(lockKey)) {
    return null;
  }
  let resolveLock;
  const promise = new Promise((res) => { resolveLock = res; });
  activeRefreshMutexes.set(lockKey, promise);
  return async () => {
    activeRefreshMutexes.delete(lockKey);
    resolveLock();
  };
}

class PinterestOAuth {
  get clientId() {
    return process.env.PINTEREST_APP_ID;
  }
  get clientSecret() {
    return process.env.PINTEREST_APP_SECRET;
  }
  get redirectUri() {
    const serverUrl = process.env.SERVER_PUBLIC_URL || 'http://localhost:5000';
    return (
      process.env.PINTEREST_REDIRECT_URI ||
      `${serverUrl.replace(/\/$/, '')}/api/auth/pinterest/callback`
    );
  }
  get scopes() {
    return 'boards:read,boards:write,pins:read,pins:write,user_accounts:read';
  }
  get baseUrl() {
    return process.env.PINTEREST_API_BASE_URL || 'https://api.pinterest.com/v5';
  }

  /**
   * Generate official Pinterest OAuth authorization URL
   */
  getAuthorizationUrl(state = '') {
    if (!this.clientId) {
      console.warn('⚠️ [PINTEREST-OAUTH] PINTEREST_APP_ID is not configured in environment variables');
    }

    console.log(`📌 [PINTEREST-OAUTH] Generating Auth URL with redirect_uri: ${this.redirectUri}`);

    const params = new URLSearchParams({
      client_id: this.clientId || '',
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: this.scopes,
      state: state
    });

    return `https://www.pinterest.com/oauth/?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access & refresh tokens
   */
  async exchangeCodeForToken(code) {
    const startTime = Date.now();
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('PINTEREST_APP_ID or PINTEREST_APP_SECRET missing in environment');
      }

      console.log(`📌 [PINTEREST-OAUTH] Exchanging auth code for token using client_id: ${this.clientId}, redirect_uri: ${this.redirectUri}...`);

      const params = new URLSearchParams();
      params.append('grant_type', 'authorization_code');
      params.append('code', code);
      params.append('redirect_uri', this.redirectUri);

      const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post(`${this.baseUrl}/oauth/token`, params.toString(), {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      });

      const duration = Date.now() - startTime;
      console.log(`✅ [PINTEREST-OAUTH] Token exchange successful (HTTP ${response.status}, ${duration}ms)`);

      const { access_token, refresh_token, token_type, expires_in, scope } = response.data;

      // Get user profile info safely
      let userInfo = {};
      try {
        userInfo = await this.getUserInfo(access_token);
      } catch (userErr) {
        console.warn('⚠️ [PINTEREST-OAUTH] Could not fetch user profile details:', userErr.message);
      }
      
      // Get user boards safely
      let boards = [];
      try {
        boards = await this.getBoards(access_token);
      } catch (boardErr) {
        console.warn('⚠️ [PINTEREST-OAUTH] Could not fetch user boards:', boardErr.message);
      }
      const defaultBoard = boards[0];
      const username = userInfo?.username || 'Pinterest User';

      return {
        accessToken: access_token,
        refreshToken: refresh_token || null,
        tokenType: token_type || 'bearer',
        expiresIn: expires_in || null,
        scope: scope || this.scopes,
        username: username,
        userInfo: {
          username: username,
          id: userInfo?.id || userInfo?.username || username,
          profileImage: userInfo?.profile_image || userInfo?.profile_image_url || null,
          accountType: userInfo?.account_type || null
        },
        boards: boards.map(b => ({ id: b.id, name: b.name })),
        boardId: defaultBoard?.id || null,
        boardName: defaultBoard?.name || null
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const httpStatus = error.response?.status || 500;
      const errorData = error.response?.data;
      const errorMsg = errorData?.message || errorData?.error_description || errorData?.error || error.message;
      console.error(`❌ [PINTEREST-OAUTH] Token exchange failed (HTTP ${httpStatus}, ${duration}ms):`, JSON.stringify(errorData || errorMsg));
      try {
        fs.appendFileSync('/tmp/pinterest_oauth.log', `[${new Date().toISOString()}] Token exchange failed HTTP ${httpStatus}: ${JSON.stringify(errorData || errorMsg)}\n`);
      } catch (e) {}
      throw new Error(`Pinterest OAuth token exchange failed: ${errorMsg}`);
    }
  }

  /**
   * Official Pinterest API v5 Token Refresh
   */
  async refreshAccessToken(rawRefreshToken) {
    const startTime = Date.now();
    try {
      if (!this.clientId || !this.clientSecret) {
        throw new Error('PINTEREST_APP_ID or PINTEREST_APP_SECRET missing');
      }

      const decryptedRefresh = decryptToken(rawRefreshToken);
      if (!decryptedRefresh) {
        throw new Error('Missing or invalid refresh token');
      }

      console.log('🔄 [PINTEREST-REFRESH] Initiating token refresh via Pinterest API v5...');

      const params = new URLSearchParams();
      params.append('grant_type', 'refresh_token');
      params.append('refresh_token', decryptedRefresh);

      const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post(`${this.baseUrl}/oauth/token`, params.toString(), {
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 10000
      });

      const duration = Date.now() - startTime;
      console.log(`✅ [PINTEREST-REFRESH] Token refreshed successfully (HTTP ${response.status}, ${duration}ms)`);

      const { access_token, refresh_token, token_type, expires_in, scope } = response.data;

      return {
        accessToken: access_token,
        refreshToken: refresh_token || decryptedRefresh,
        expiresIn: expires_in || 30 * 24 * 60 * 60,
        scope: scope || this.scopes
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const httpStatus = error.response?.status || 500;
      console.error(`❌ [PINTEREST-ERROR] Refresh token failed (HTTP ${httpStatus}, ${duration}ms):`, error.response?.data?.message || error.message);
      throw error;
    }
  }

  /**
   * Get valid access token with Account Lookup and Shared Distributed Lock across instances & workers.
   */
  async getValidAccessToken(userId, accountId = null) {
    const lookupAccount = async () => {
      let query = supabase
        .from('social_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'pinterest');

      if (accountId) {
        const cleanId = String(accountId).trim();
        query = query.or(`id.eq.${cleanId},account_id.eq.${cleanId},username.eq.${cleanId}`);
      }

      const { data, error } = await query;
      if (error || !data || data.length === 0) {
        const { data: fallbackData } = await supabase
          .from('social_tokens')
          .select('*')
          .eq('user_id', userId)
          .eq('provider', 'pinterest')
          .maybeSingle();

        if (fallbackData) return fallbackData;
        throw new Error('Pinterest account not connected');
      }

      return data[0];
    };

    let row = await lookupAccount();

    if (row.token_status === 'reconnect_required' || row.profile_data?.token_status === 'reconnect_required') {
      throw new Error('Pinterest account connection expired. Please reconnect.');
    }

    const now = Date.now();
    const tokenExpiry = row.token_expiry || row.expires_at ? new Date(row.token_expiry || row.expires_at).getTime() : null;
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const isNearExpiry = tokenExpiry && (tokenExpiry - now < FIVE_MINUTES_MS);

    if (isNearExpiry && row.refresh_token) {
      const lockKey = `${userId}:${row.account_id || row.id}`;
      const maxLockWaitAttempts = 25;

      for (let attempt = 0; attempt < maxLockWaitAttempts; attempt++) {
        const unlock = await acquireDistributedLock(lockKey, 15000);
        if (unlock) {
          try {
            // Re-read account to check if another instance/worker refreshed it while we were acquiring lock
            row = await lookupAccount();
            const freshExpiry = row.token_expiry || row.expires_at ? new Date(row.token_expiry || row.expires_at).getTime() : null;

            if (freshExpiry && (freshExpiry - Date.now() >= FIVE_MINUTES_MS)) {
              console.log(`✅ [PINTEREST-REFRESH] Reusing token refreshed by concurrent worker for ${lockKey}`);
              return {
                accessToken: decryptToken(row.access_token),
                boardId: row.pinterest_board_id || row.profile_data?.boardId,
                username: row.username
              };
            }

            console.log(`⏰ [PINTEREST-REFRESH] Access token near expiry for user ${userId}. Executing distributed refresh...`);
            const refreshed = await this.refreshAccessToken(row.refresh_token);

            const newExpiry = new Date(Date.now() + refreshed.expiresIn * 1000).toISOString();
            const encryptedAccess = encryptToken(refreshed.accessToken);
            const encryptedRefresh = refreshed.refreshToken ? encryptToken(refreshed.refreshToken) : row.refresh_token;

            await supabase
              .from('social_tokens')
              .update({
                access_token: encryptedAccess,
                refresh_token: encryptedRefresh,
                token_expiry: newExpiry,
                expires_at: newExpiry,
                profile_data: {
                  ...(row.profile_data || {}),
                  token_status: 'active'
                },
                updated_at: new Date().toISOString()
              })
              .eq('id', row.id);

            return {
              accessToken: refreshed.accessToken,
              boardId: row.pinterest_board_id || row.profile_data?.boardId,
              username: row.username
            };
          } catch (refreshErr) {
            console.error(`❌ [PINTEREST-ERROR] Failed to auto-refresh token for user ${userId}:`, refreshErr.message);
            await supabase
              .from('social_tokens')
              .update({
                profile_data: {
                  ...(row.profile_data || {}),
                  token_status: 'reconnect_required'
                },
                updated_at: new Date().toISOString()
              })
              .eq('id', row.id);

            throw new Error('Pinterest authorization expired. Please reconnect your Pinterest account.');
          } finally {
            await unlock();
          }
        }

        // Lock held by another process: wait 300ms and poll DB
        console.log(`⏳ [PINTEREST-REFRESH] Distributed lock busy for ${lockKey} (attempt ${attempt + 1}). Waiting...`);
        await new Promise((r) => setTimeout(r, 300));

        row = await lookupAccount();
        const freshExpiry = row.token_expiry || row.expires_at ? new Date(row.token_expiry || row.expires_at).getTime() : null;
        if (freshExpiry && (freshExpiry - Date.now() >= FIVE_MINUTES_MS)) {
          return {
            accessToken: decryptToken(row.access_token),
            boardId: row.pinterest_board_id || row.profile_data?.boardId,
            username: row.username
          };
        }
      }
    }

    return {
      accessToken: decryptToken(row.access_token),
      boardId: row.pinterest_board_id || row.profile_data?.boardId,
      username: row.username
    };
  }

  /**
   * Get Pinterest user info
   */
  async getUserInfo(accessToken) {
    const startTime = Date.now();
    try {
      const response = await axios.get(`${this.baseUrl}/user_account`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 10000
      });
      const duration = Date.now() - startTime;
      console.log(`✅ [PINTEREST-OAUTH] Profile fetched for @${response.data?.username} (HTTP ${response.status}, ${duration}ms)`);
      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [PINTEREST-ERROR] getUserInfo failed (HTTP ${error.response?.status || 500}, ${duration}ms):`, error.response?.data?.message || error.message);
      throw error;
    }
  }

  /**
   * Get user's Pinterest boards
   */
  async getBoards(accessToken) {
    const startTime = Date.now();
    try {
      const response = await axios.get(`${this.baseUrl}/boards`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        timeout: 10000
      });
      const duration = Date.now() - startTime;
      const count = response.data.items?.length || 0;
      console.log(`✅ [PINTEREST-OAUTH] Fetched ${count} boards (HTTP ${response.status}, ${duration}ms)`);
      return response.data.items || [];
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [PINTEREST-ERROR] getBoards failed (HTTP ${error.response?.status || 500}, ${duration}ms):`, error.response?.data?.message || error.message);
      throw new Error(`Failed to fetch Pinterest boards: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create a new Pinterest board for user
   */
  async createBoard(accessToken, name, description = '') {
    const startTime = Date.now();
    try {
      const response = await axios.post(`${this.baseUrl}/boards`, {
        name,
        description: description || undefined
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      const duration = Date.now() - startTime;
      console.log(`✅ [PINTEREST-OAUTH] Board created "${name}" (ID: ${response.data.id}, ${duration}ms)`);
      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [PINTEREST-ERROR] createBoard failed (${duration}ms):`, error.response?.data?.message || error.message);
      throw new Error(`Failed to create board: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Store Pinterest tokens securely in database (Encrypted)
   */
  async storeTokens(userId, tokenData) {
    try {
      const encryptedAccess = encryptToken(tokenData.accessToken);
      const encryptedRefresh = tokenData.refreshToken ? encryptToken(tokenData.refreshToken) : null;

      const expiryDate = tokenData.expiresIn
        ? new Date(Date.now() + tokenData.expiresIn * 1000).toISOString()
        : null;

      const payload = {
        user_id: userId,
        provider: 'pinterest',
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        account_id: tokenData.userInfo?.id || tokenData.userInfo?.username || tokenData.username || `pinterest_${userId.slice(0, 8)}`,
        pinterest_board_id: tokenData.boardId || null,
        username: tokenData.userInfo?.username || tokenData.username || 'Pinterest User',
        profile_data: {
          ...tokenData.userInfo,
          token_status: 'active',
          boardId: tokenData.boardId,
          boardName: tokenData.boardName,
          boards: tokenData.boards || [],
          scope: tokenData.scope
        },
        token_expiry: expiryDate,
        expires_at: expiryDate,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('social_tokens')
        .upsert(payload, {
          onConflict: 'user_id,provider,account_id'
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`✅ [PINTEREST-OAUTH] Encrypted tokens stored in DB for user ${userId} (@${tokenData.userInfo?.username})`);
      return data;
    } catch (error) {
      console.error('❌ [PINTEREST-ERROR] Error storing tokens:', error.message);
      throw error;
    }
  }
}

export default new PinterestOAuth();
