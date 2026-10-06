import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class MastodonOAuth {
  constructor() {
    this.clientName = 'QuickPost';
    this.scopes = 'read write:statuses write:media';
  }

  getRedirectUri() {
    if (process.env.MASTODON_REDIRECT_URI) {
      return process.env.MASTODON_REDIRECT_URI.trim();
    }
    const serverUrl = process.env.SERVER_PUBLIC_URL || process.env.API_URL || 'http://localhost:5000';
    return `${serverUrl.replace(/\/$/, '')}/api/auth/mastodon/callback`;
  }

  cleanInstanceUrl(instanceUrl) {
    let raw = (instanceUrl || '').trim();

    // If full URL with protocol or path (e.g. https://mastodon.social/@user)
    try {
      const withProto = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
      const parsed = new URL(withProto);
      raw = parsed.host || parsed.hostname;
    } catch (e) {}

    // If user entered handle format: @username@instance.social or username@instance.social
    if (raw.includes('@')) {
      const parts = raw.split('@').filter(Boolean);
      raw = parts[parts.length - 1]; // Host is always the last segment
    }

    // Remove any remaining paths or slashes
    raw = raw.split('/')[0].trim();

    if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
      raw = `https://${raw}`;
    }
    return raw.replace(/\/+$/, '');
  }

  /**
   * Register the app on a specific instance
   * Mastodon requires app registration per instance
   */
  async registerApp(instanceUrl) {
    try {
      const baseUrl = this.cleanInstanceUrl(instanceUrl);
      const redirectUri = this.getRedirectUri();
      console.log(`🦣 [MASTODON-OAUTH] Registering app on ${baseUrl} with redirect: ${redirectUri}`);
      const response = await axios.post(`${baseUrl}/api/v1/apps`, {
        client_name: this.clientName,
        redirect_uris: redirectUri,
        scopes: this.scopes,
        website: 'https://quick-post-livid.vercel.app'
      });

      return {
        clientId: response.data.client_id,
        clientSecret: response.data.client_secret,
        baseUrl
      };
    } catch (error) {
      console.error('Mastodon app registration error:', error.response?.data || error.message);
      throw new Error(`Failed to register app on instance ${instanceUrl}: ${error.response?.data?.error || error.message}`);
    }
  }

  /**
   * Generate Mastodon authorization URL
   */
  getAuthorizationUrl(instanceUrl, clientId, state = '') {
    const baseUrl = this.cleanInstanceUrl(instanceUrl);
    const redirectUri = this.getRedirectUri();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: this.scopes,
      state: state
    });

    return `${baseUrl}/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange code for token
   */
  async exchangeCodeForToken(instanceUrl, clientId, clientSecret, code) {
    const baseUrl = this.cleanInstanceUrl(instanceUrl);
    const redirectUri = this.getRedirectUri();

    console.log(`🦣 [MASTODON-OAUTH] Exchanging code on ${baseUrl}`);
    console.log(`🦣 [MASTODON-OAUTH] redirectUri: ${redirectUri}, clientId: ${clientId?.slice(0, 10)}...`);

    let response;
    let lastError;

    // Strategy 1: Standard Body parameters (form-urlencoded, No Authorization header)
    try {
      const bodyParams = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        scope: this.scopes
      });

      response = await axios.post(`${baseUrl}/oauth/token`, bodyParams.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });
    } catch (err1) {
      lastError = err1;
      console.warn('⚠️ [MASTODON-OAUTH] Body params token exchange failed:', err1.response?.data || err1.message);

      // Strategy 2: RFC 6749 Basic Authentication header fallback
      try {
        const authHeader = Buffer.from(`${encodeURIComponent(clientId)}:${encodeURIComponent(clientSecret)}`).toString('base64');
        const basicParams = new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
          scope: this.scopes
        });

        response = await axios.post(`${baseUrl}/oauth/token`, basicParams.toString(), {
          headers: {
            'Authorization': `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        });
      } catch (err2) {
        console.error('❌ [MASTODON-OAUTH] Basic auth token exchange fallback also failed:', err2.response?.data || err2.message);
        throw new Error(
          err2.response?.data?.error_description ||
          err2.response?.data?.error ||
          err1.response?.data?.error_description ||
          err1.response?.data?.error ||
          err2.message
        );
      }
    }

    try {
      const { access_token } = response.data;
      const userInfo = await this.getUserProfile(baseUrl, access_token);

      return {
        accessToken: access_token,
        username: userInfo.username,
        userInfo: {
          id: userInfo.id,
          username: userInfo.username,
          displayName: userInfo.display_name,
          avatar: userInfo.avatar,
          url: userInfo.url
        }
      };
    } catch (profileErr) {
      console.error('❌ Mastodon get profile error after token exchange:', profileErr.response?.data || profileErr.message);
      throw profileErr;
    }
  }

  /**
   * Get Mastodon user profile
   */
  async getUserProfile(baseUrl, accessToken) {
    try {
      const response = await axios.get(`${baseUrl}/api/v1/accounts/verify_credentials`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get Mastodon profile error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create state for OAuth
   */
  makeState(userId, instanceUrl, clientId, clientSecret) {
    return Buffer.from(JSON.stringify({ 
      userId, 
      provider: 'mastodon',
      instanceUrl,
      clientId,
      clientSecret,
      nonce: Math.random().toString(36),
      ts: Date.now() 
    })).toString('base64url');
  }

  /**
   * Store tokens in DB
   */
  async storeTokens(userId, instanceUrl, tokenData) {
    try {
      const { default: supabase } = await import('./supabase.js');

      const { data, error } = await supabase
        .from('social_tokens')
        .upsert({
          user_id: userId,
          provider: 'mastodon',
          access_token: tokenData.accessToken,
          refresh_token: null,
          account_id: `${instanceUrl}:${tokenData.userInfo?.id || tokenData.userInfo?.username}`,
          mastodon_instance: instanceUrl,
          profile_data: tokenData.userInfo,
          username: tokenData.userInfo?.username,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,provider,account_id'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error storing Mastodon tokens:', error);
      throw error;
    }
  }
}

export default new MastodonOAuth();
