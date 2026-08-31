import axios from 'axios';
import crypto from 'crypto';
import supabase from './supabase.js';

const GRAPH_VERSION = 'v21.0';

const FACEBOOK_SCOPES = [
  'public_profile',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
  'pages_manage_posts'
];

function base64urlEncode(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

class FacebookOAuth {
  get appId() {
    return process.env.FACEBOOK_APP_ID;
  }
  get appSecret() {
    return process.env.FACEBOOK_APP_SECRET;
  }
  get loginConfigId() {
    return process.env.FACEBOOK_LOGIN_CONFIG_ID;
  }
  get redirectUri() {
    return (
      process.env.FACEBOOK_REDIRECT_URI ||
      'http://localhost:5000/api/auth/facebook/callback'
    ).trim();
  }

  assertConfigured({ requireSecret = false } = {}) {
    const missing = [];
    if (!this.appId) missing.push('FACEBOOK_APP_ID');
    if (requireSecret && !this.appSecret) missing.push('FACEBOOK_APP_SECRET');
    if (!this.redirectUri) missing.push('FACEBOOK_REDIRECT_URI');
    if (missing.length) {
      throw new Error(`Facebook OAuth is not configured. Missing: ${missing.join(', ')}`);
    }
    try {
      new URL(this.redirectUri);
    } catch {
      throw new Error('FACEBOOK_REDIRECT_URI must be an absolute URL that matches Meta App settings.');
    }
  }

  makeState(userId) {
    return base64urlEncode({
      userId,
      provider: 'facebook',
      nonce: crypto.randomUUID(),
      ts: Date.now()
    });
  }

  getAuthorizationUrl(state) {
    this.assertConfigured();
    const params = new URLSearchParams({
      client_id: this.appId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      auth_type: 'rerequest',
      state
    });

    if (this.loginConfigId) {
      params.set('config_id', this.loginConfigId);
      params.set('override_default_response_type', 'true');
    } else {
      params.set('scope', FACEBOOK_SCOPES.join(','));
      params.set('prompt', 'consent');
    }

    return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
  }

  async debugToken(accessToken) {
    const permsRes = await axios.get(
      `https://graph.facebook.com/${GRAPH_VERSION}/me/permissions`,
      { params: { access_token: accessToken } }
    );

    const debugRes = await axios.get(
      `https://graph.facebook.com/${GRAPH_VERSION}/debug_token`,
      {
        params: {
          input_token: accessToken,
          access_token: `${this.appId}|${this.appSecret}`
        }
      }
    );

    const granted = (permsRes.data?.data || [])
      .filter((permission) => permission.status === 'granted')
      .map((permission) => permission.permission);

    const scopes = debugRes.data?.data?.scopes || [];

    return {
      granted,
      scopes,
      rawPermissions: permsRes.data,
      rawDebug: debugRes.data
    };
  }

  extractPageIdsFromDebug(debugData) {
    const granular = debugData?.data?.granular_scopes || [];
    const pageScope = granular.find((entry) => entry.scope === 'pages_show_list');
    return pageScope?.target_ids || [];
  }

  async exchangeCodeForToken(code) {
    try {
      this.assertConfigured({ requireSecret: true });
      console.log('\n🔵 FB: Starting token exchange...');

      const shortRes = await axios.get(
        `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
        {
          params: {
            client_id: this.appId,
            client_secret: this.appSecret,
            redirect_uri: this.redirectUri,
            code
          }
        }
      );
      const shortUserToken = shortRes.data.access_token;
      console.log('✅ FB: short-lived token obtained');

      const longRes = await axios.get(
        `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`,
        {
          params: {
            grant_type: 'fb_exchange_token',
            client_id: this.appId,
            client_secret: this.appSecret,
            fb_exchange_token: shortUserToken
          }
        }
      );

      const longUserToken = longRes.data.access_token;
      console.log('✅ FB: long-lived token obtained');

      const meRes = await axios.get(
        `https://graph.facebook.com/${GRAPH_VERSION}/me`,
        { params: { access_token: longUserToken, fields: 'id,name' } }
      );

      console.log('\n👤 Facebook User Info:');
      console.log('  Name:', meRes.data.name);
      console.log('  ID:', meRes.data.id);

      const dbg = await this.debugToken(longUserToken);

      console.log('\n🔐 FB Permissions (granted):', dbg.granted);
      console.log('🧪 FB Token scopes:', dbg.scopes);

      const requiredScopes = [
        'pages_show_list',
        'pages_read_engagement',
        'pages_manage_metadata',
        'pages_manage_posts'
      ];

      const missingScopes = requiredScopes.filter(
        (scope) => !dbg.granted.includes(scope) && !dbg.scopes.includes(scope)
      );

      if (missingScopes.length) {
        throw new Error(
          `Missing required permissions: ${missingScopes.join(', ')}. ` +
          'Remove the app from Facebook (Settings -> Apps and Websites and Business Integrations) and connect again, then approve the Pages permissions during consent.'
        );
      }

      let pages = [];
      try {
        const pagesRes = await axios.get(
          `https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`,
          {
            params: { access_token: longUserToken, fields: 'id,name,access_token,picture', limit: 100 }
          }
        );
        pages = pagesRes.data?.data || [];
      } catch (e) {}

      const pageIds = this.extractPageIdsFromDebug(dbg.rawDebug);
      console.log('FB: Page IDs from granular scopes:', pageIds);
      const foundPageIds = new Set(pages.map((page) => String(page.id)));

      for (const pid of pageIds) {
        if (!foundPageIds.has(String(pid))) {
          const pageDetails = await axios.get(
            `https://graph.facebook.com/${GRAPH_VERSION}/${pid}`,
            {
              params: { access_token: longUserToken, fields: 'id,name,access_token,picture' }
            }
          );
          pages.push(pageDetails.data);
          foundPageIds.add(String(pid));
        }
      }

      console.log('\n📄 Found pages:', pages.length);

      if (!pages.length) {
        throw new Error(
          'No Facebook Pages found for this token. During consent, select your Page (Pages selection screen) and try again.'
        );
      }

      return {
        userAccessToken: longUserToken,
        pages: pages.map((page) => ({
          pageAccessToken: page.access_token || longUserToken,
          pageId: page.id,
          userInfo: {
            pageName: page.name,
            pageId: page.id,
            picture: page.picture
          }
        }))
      };
    } catch (error) {
      console.error('❌ FB token exchange error:', error.response?.data || error.message);
      throw new Error(
        error.response?.data?.error?.message ||
          error.message ||
          'Failed to exchange Facebook authorization code'
      );
    }
  }

  async storeTokens(userId, tokenData) {
    try {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + 60);

      const targets = tokenData.pages?.length ? tokenData.pages : [tokenData];
      const rows = targets.map((target) => ({
        user_id: userId,
        provider: 'facebook',
        access_token: target.pageAccessToken,
        token_expiry: expiryDate.toISOString(),
        page_id: target.pageId,
        account_id: target.pageId,
        username: target.userInfo?.pageName,
        profile_data: target.userInfo,
        updated_at: new Date().toISOString()
      }));

      const { data, error } = await supabase
        .from('social_tokens')
        .upsert(rows, { onConflict: 'user_id,provider,account_id' })
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error storing FB tokens:', error);
      throw new Error('Failed to store Facebook authentication');
    }
  }
}

export default new FacebookOAuth();
