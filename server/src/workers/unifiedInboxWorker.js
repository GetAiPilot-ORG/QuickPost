import cron from 'node-cron';
import supabase from '../services/supabase.js';
import { persistInboxItems, recordInboxSyncState } from '../services/unifiedInbox.js';
import {
  fetchBlueskyComments,
  fetchFacebookComments,
  fetchInstagramComments,
  fetchMastodonComments,
  fetchYouTubeComments,
} from '../routes/inbox.js';

const schedule = process.env.INBOX_SYNC_CRON || '*/3 * * * *';
let running = false;

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

async function syncAccount(row) {
  const provider = String(row.provider || '').toLowerCase();
  const adapter = adapters[provider];
  if (!adapter) return;
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
    const [{ data: socialTokens, error: tokenError }, { data: instagramAccounts, error: accountError }] = await Promise.all([
      supabase.from('social_tokens').select('*'),
      supabase.from('instagram_accounts').select('*').eq('is_connected', true),
    ]);
    if (tokenError) throw tokenError;
    if (accountError) throw accountError;

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
    const uniqueAccounts = [...new Map(accounts.map((account) => [
      `${account.user_id}:${String(account.provider || '').toLowerCase()}:${accountId(account)}`,
      account,
    ])).values()];
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
