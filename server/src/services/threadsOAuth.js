import axios from 'axios';
import crypto from 'crypto';
import supabase from './supabase.js';

const THREADS_GRAPH_URL = 'https://graph.threads.net/v1.0';
const THREADS_AUTH_URL = 'https://www.threads.net/oauth/authorize';

const THREADS_SCOPES = [
  'threads_basic',
  'threads_content_publish'
];

function base64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

class ThreadsOAuth {
  get appId() {
    return process.env.THREADS_APP_ID;
  }
  get appSecret() {
    return process.env.THREADS_APP_SECRET;
  }
  get redirectUri() {
    return (
      process.env.THREADS_REDIRECT_URI ||
      'http://localhost:5000/api/auth/threads/callback'
    ).trim();
  }

  makeState(user) {
    const payload = typeof user === 'string' ? { userId: user } : user;
    return base64urlEncode({
      userId: payload.userId,
      authUserId: payload.authUserId,
      provider: 'threads',
      nonce: crypto.randomUUID(),
      ts: Date.now()
    });
  }

  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      scope: THREADS_SCOPES.join(','),
      response_type: 'code',
      state
    });

    console.log(`\n🧵 Generated Threads Auth URL:`);
    console.log(`   Client ID: ${this.appId}`);
    console.log(`   Redirect URI: ${this.redirectUri}`);

    return `${THREADS_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCodeForToken(code) {
    try {
      console.log('\n🧵 Threads: Starting token exchange...');

      // 1. Code -> Short-lived token
      const shortRes = await axios.post('https://graph.threads.net/oauth/access_token', new URLSearchParams({
        client_id: this.appId,
        client_secret: this.appSecret,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
        code
      }));

      const shortAccessToken = shortRes.data.access_token;
      const threadsUserId = shortRes.data.user_id;
      console.log('✅ Threads: short-lived token obtained');

      // 2. Short-lived -> Long-lived token
      const longRes = await axios.get('https://graph.threads.net/access_token', {
        params: {
          grant_type: 'th_exchange_token',
          client_secret: this.appSecret,
          access_token: shortAccessToken
        }
      });

      const longAccessToken = longRes.data.access_token;
      console.log('✅ Threads: long-lived token obtained');

      // 3. Get user profile info
      const meRes = await axios.get(`${THREADS_GRAPH_URL}/me`, {
        params: {
          access_token: longAccessToken,
          fields: 'id,username,threads_profile_picture_url'
        }
      });

      console.log('\n👤 Threads User Info:');
      console.log('  Username:', meRes.data.username);
      console.log('  ID:', meRes.data.id);

      return {
        accessToken: longAccessToken,
        threadsUserId: meRes.data.id,
        userInfo: {
          username: meRes.data.username,
          profilePicture: meRes.data.threads_profile_picture_url
        }
      };
    } catch (error) {
      console.error('❌ Threads token exchange error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.error?.message || error.message || 'Failed to exchange Threads authorization code');
    }
  }

  async storeTokens(userId, tokenData) {
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 60); // Long-lived tokens last 60 days

      const payload = {
        user_id: userId,
        provider: 'threads',
        access_token: tokenData.accessToken,
        token_expiry: expiryDate.toISOString(),
        account_id: tokenData.threadsUserId,
        username: tokenData.userInfo?.username,
        profile_data: tokenData.userInfo,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('social_tokens')
        .upsert(payload, { onConflict: 'user_id,provider,account_id' })
        .select();

      if (error) {
        console.error('💥 [SUPABASE] storeTokens error:', error.message);
        throw error;
      }

      console.log('✅ Threads tokens stored in database');
      return data;

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error storing Threads tokens:', error);
      throw new Error('Failed to store Threads authentication');
    }
  }
}

export default new ThreadsOAuth();
