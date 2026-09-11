import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

class LinkedInOAuth {
  constructor() {
    this.clientId = process.env.LINKEDIN_CLIENT_ID;
    this.clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    this.redirectUri = process.env.LINKEDIN_REDIRECT_URI || 'http://localhost:5000/api/auth/linkedin/callback';
    this.scopes = ['openid', 'profile', 'email', 'w_member_social'];
  }

  /**
   * Generate LinkedIn OAuth authorization URL
   */
  getAuthorizationUrl(state = '') {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scopes.join(' '),
      state: state
    });

    if (process.env.LINKEDIN_ENABLE_EXTENDED_LOGIN === 'true') {
      params.set('enable_extended_login', 'true');
    }

    return `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code) {
    try {
      const response = await axios.post(
        'https://www.linkedin.com/oauth/v2/accessToken',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          client_id: this.clientId,
          client_secret: this.clientSecret,
          redirect_uri: this.redirectUri
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const { access_token, expires_in } = response.data;

      // Get user profile
      const userInfo = await this.getUserProfile(access_token);

      return {
        accessToken: access_token,
        expiresIn: expires_in,
        userInfo: {
          id: userInfo.sub,
          name: userInfo.name,
          email: userInfo.email,
          picture: userInfo.picture
        }
      };
    } catch (error) {
      console.error('LinkedIn token exchange error:', error.response?.data || error.message);
      throw new Error(`LinkedIn authentication failed: ${error.response?.data?.error_description || error.message}`);
    }
  }

  /**
   * Get LinkedIn user profile using OpenID Connect
   */
  async getUserProfile(accessToken) {
    try {
      const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data;
    } catch (error) {
      console.error('Get LinkedIn profile error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Get LinkedIn user ID (URN format)
   */
  async getUserId(accessToken) {
    try {
      const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return response.data.sub; // This is the user's URN
    } catch (error) {
      console.error('Get LinkedIn user ID error:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Create state for OAuth with user info
   */
  makeState(userId) {
    return Buffer.from(JSON.stringify({ 
      userId, 
      provider: 'linkedin',
      nonce: Math.random().toString(36),
      ts: Date.now() 
    })).toString('base64url');
  }

  /**
   * Store LinkedIn tokens in database
   */
  async storeTokens(userId, tokenData) {
    try {
      const { default: supabase } = await import('./supabase.js');

      const expiresAt = new Date(Date.now() + (tokenData.expiresIn * 1000));
      
      const { data, error } = await supabase
        .from('social_tokens')
        .upsert({
          user_id: userId,
          provider: 'linkedin',
          access_token: tokenData.accessToken,
          refresh_token: null, // LinkedIn tokens don't have refresh tokens in v2
          expires_at: expiresAt.toISOString(),
          account_id: tokenData.userInfo?.id,
          profile_data: tokenData.userInfo,
          username: tokenData.userInfo?.name,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,provider,account_id'
        })
        .select()
        .single();

      if (error) throw error;

      console.log('✅ LinkedIn tokens stored for user:', userId);
      return data;
    } catch (error) {
      console.error('Error storing LinkedIn tokens:', error);
      throw error;
    }
  }

  /**
   * Refresh LinkedIn access token (if needed in future)
   */
  async refreshAccessToken(refreshToken) {
    // Note: LinkedIn OAuth 2.0 doesn't provide refresh tokens by default
    // Tokens expire after 60 days and users need to re-authenticate
    throw new Error('LinkedIn tokens cannot be refreshed. User must re-authenticate.');
  }
}

export default new LinkedInOAuth();
