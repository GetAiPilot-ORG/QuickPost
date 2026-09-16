import cron from 'node-cron';
import supabase from '../services/supabase.js';
import { persistInboxItems, recordInboxSyncState } from '../services/unifiedInbox.js';
import { ensureInstagramWebhookSubscription } from '../services/unifiedInboxWebhook.js';
import {
  fetchBlueskyComments,
  fetchFacebookComments,
  fetchInstagramComments,
  fetchMastodonComments,
  fetchYouTubeComments,
} from '../routes/inbox.js';

const schedule = process.env.INBOX_SYNC_CRON || '*/3 * * * *';
const authErrorCooldownMs = Number(process.env.INBOX_AUTH_ERROR_COOLDOWN_HOURS || 24) * 60 * 60 * 1000;
let running = false;
const webhookSubscriptionCredentials = new Set();

const adapters = {
  instagram: fetchInstagramComments,
  facebook: fetchFacebookComments,
  youtube: fetchYouTubeComments,
  google: fetchYouTubeComments,
  bluesky: fetchBlueskyComments,
  mastodon: fetchMastodonComments,
};

function accountId(row) {
  return row.account_id || row.page_id || row.instagram_business_account_id || row.id;
}

function isMetaTokenExpired(row) {
  const provider = String(row.provider || '').toLowerCase();
  const expiry = row.token_expiry || row.expires_at || row.token_expires_at;
  return ['instagram', 'facebook'].includes(provider) && expiry && Date.parse(expiry) <= Date.now();
}

function isAuthorizationError(message) {
  return /session has expired|session has been invalidated|requires .*manage_messages|requires permission|insufficient authentication scopes|unsupported request - method type/i.test(String(message || ''));
}

function shouldCoolDown(row, state) {
  if (!state?.last_error || !isAuthorizationError(state.last_error)) return false;
  const attemptedAt = Date.parse(state.last_attempt_at || 0);
  const credentialsUpdatedAt = Date.parse(row.updated_at || row.created_at || 0);
  if (credentialsUpdatedAt > attemptedAt) return false;
  return Date.now() - attemptedAt < authErrorCooldownMs;
}

async function syncAccount(row) {
  const provider = String(row.provider || '').toLowerCase();
  const adapter = adapters[provider];
  if (!adapter) return;
  if (isMetaTokenExpired(row) || shouldCoolDown(row, row._syncState)) return;

  if (provider === 'instagram' && row.access_token) {
    const subscriptionKey = `${row.user_id}:${accountId(row)}:${row.updated_at || row.token_expiry || ''}`;
    if (!webhookSubscriptionCredentials.has(subscriptionKey)) {
      webhookSubscriptionCredentials.add(subscriptionKey);
      const subscription = await ensureInstagramWebhookSubscription(row);
      if (!subscription.ok && !subscription.skipped) {
        console.warn(`⚠️ [INBOX-IG] Webhook subscription unavailable for @${row.username || accountId(row)}: ${subscription.reason}`);
      }
    }
  }

  try {
    const result = await adapter(row);
    if (result.status === 'ok') await persistInboxItems(row.user_id, result.items || []);
    await recordInboxSyncState(row.user_id, provider === 'google' ? 'youtube' : provider, accountId(row), {
      ok: result.status === 'ok',
      error: result.error,
    });
  } catch (error) {
    await recordInboxSyncState(row.user_id, provider, accountId(row), { ok: false, error: error.message })
      .catch(() => {});
  }
}

export async function runUnifiedInboxSync() {
  if (running) return;
  running = true;
  try {
    const [
      { data: socialTokens, error: tokenError },
      { data: instagramAccounts, error: accountError },
      { data: syncStates, error: syncStateError },
    ] = await Promise.all([
      supabase.from('social_tokens').select('*'),
      supabase.from('instagram_accounts').select('*').eq('is_connected', true),
      supabase.from('inbox_sync_state').select('user_id,platform,account_id,last_attempt_at,last_error'),
    ]);
    if (tokenError) throw tokenError;
    if (accountError) throw accountError;
    if (syncStateError) throw syncStateError;

    const accounts = [...(socialTokens || [])];
    for (const account of instagramAccounts || []) {
      accounts.push({
        ...account,
        provider: 'instagram',
        account_id: account.instagram_business_account_id,
        access_token_encrypted: account.access_token_encrypted,
        username: account.instagram_username,
        account_name: account.instagram_username,
      });
    }
    const statesByAccount = new Map((syncStates || []).map((state) => [
      `${state.user_id}:${state.platform}:${state.account_id}`,
      state,
    ]));
    const uniqueAccounts = [...new Map(accounts.map((account) => {
      const provider = String(account.provider || '').toLowerCase();
      const normalizedProvider = provider === 'google' ? 'youtube' : provider;
      const key = `${account.user_id}:${provider}:${accountId(account)}`;
      return [key, {
        ...account,
        _syncState: statesByAccount.get(`${account.user_id}:${normalizedProvider}:${accountId(account)}`),
      }];
    })).values()];
    for (let index = 0; index < uniqueAccounts.length; index += 5) {
      await Promise.allSettled(uniqueAccounts.slice(index, index + 5).map(syncAccount));
    }
  } finally {
    running = false;
  }
}

await runUnifiedInboxSync().catch((error) => console.error('[INBOX-WORKER] Initial sync failed:', error.message));
cron.schedule(schedule, () => {
  void runUnifiedInboxSync().catch((error) => console.error('[INBOX-WORKER] Sync failed:', error.message));
});
