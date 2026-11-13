import cron from 'node-cron';
import supabase from '../services/supabase.js';
import { persistInboxItems, batchRecordInboxSyncStates } from '../services/unifiedInbox.js';
import { ensureInstagramWebhookSubscription } from '../services/unifiedInboxWebhook.js';
import {
  fetchBlueskyComments,
  fetchFacebookComments,
  fetchInstagramComments,
  fetchMastodonComments,
  fetchYouTubeComments,
} from '../routes/inbox.js';

const schedule = process.env.INBOX_SYNC_CRON || '*/15 * * * *';
const authErrorCooldownMs = Number(process.env.INBOX_AUTH_ERROR_COOLDOWN_HOURS || 24) * 60 * 60 * 1000;
const generalErrorCooldownMs = Number(process.env.INBOX_GENERAL_ERROR_COOLDOWN_MINUTES || 30) * 60 * 1000;
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
  if (!state?.last_error) return false;
  const attemptedAt = Date.parse(state.last_attempt_at || 0);
  const credentialsUpdatedAt = Date.parse(row.updated_at || row.created_at || 0);
  if (credentialsUpdatedAt > attemptedAt) return false;
  const cooldown = isAuthorizationError(state.last_error) ? authErrorCooldownMs : generalErrorCooldownMs;
  return Date.now() - attemptedAt < cooldown;
}

async function syncAccount(row) {
  const provider = String(row.provider || '').toLowerCase();
  
  // Webhook-First: Instagram & Facebook are pushed via real-time webhooks.
  // We skip passive polling unless explicitly forced via INBOX_POLL_META=true.
  if (['instagram', 'facebook'].includes(provider) && process.env.INBOX_POLL_META !== 'true') {
    return null;
  }

  const adapter = adapters[provider];
  if (!adapter) return null;
  if (isMetaTokenExpired(row) || shouldCoolDown(row, row._syncState)) return null;

  const targetPlatform = provider === 'google' ? 'youtube' : provider;
  const targetAccountId = accountId(row);

  try {
    const result = await adapter(row);
    if (result.status === 'ok') await persistInboxItems(row.user_id, result.items || []);
    return {
      userId: row.user_id,
      platform: targetPlatform,
      accountId: targetAccountId,
      result: {
        ok: result.status === 'ok',
        error: result.error,
      },
    };
  } catch (error) {
    return {
      userId: row.user_id,
      platform: targetPlatform,
      accountId: targetAccountId,
      result: { ok: false, error: error.message },
    };
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

    const syncResults = [];
    for (let index = 0; index < uniqueAccounts.length; index += 5) {
      const settled = await Promise.allSettled(uniqueAccounts.slice(index, index + 5).map(syncAccount));
      settled.forEach((item) => {
        if (item.status === 'fulfilled' && item.value) {
          syncResults.push(item.value);
        }
      });
    }

    // Single Batch Upsert (1 query instead of 63 individual queries)
    if (syncResults.length > 0) {
      await batchRecordInboxSyncStates(syncResults);
    }
  } finally {
    running = false;
  }
}

await runUnifiedInboxSync().catch((error) => console.error('[INBOX-WORKER] Initial sync failed:', error.message));
cron.schedule(schedule, () => {
  void runUnifiedInboxSync().catch((error) => console.error('[INBOX-WORKER] Sync failed:', error.message));
});
