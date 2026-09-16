import supabase from './supabase.js';
import { persistInboxItems } from './unifiedInbox.js';

const GRAPH_VERSION = process.env.IG_GRAPH_VERSION || process.env.META_GRAPH_VERSION || 'v24.0';

function cleanId(value) {
  const id = String(value || '').trim();
  return /^\d+$/.test(id) ? id : '';
}

export async function ensureInstagramWebhookSubscription(tokenRow) {
  const accessToken = String(tokenRow?.access_token || '').trim();
  const accountIds = [
    tokenRow?.instagram_business_id,
    tokenRow?.account_id,
    tokenRow?.page_id,
  ].map(cleanId).filter((value, index, values) => value && values.indexOf(value) === index);
  if (!accessToken || !accountIds.length) return { ok: false, skipped: true, reason: 'missing_credentials' };

  const fields = process.env.INBOX_INSTAGRAM_SUBSCRIBED_FIELDS
    || process.env.INSTAPILOT_SUBSCRIBED_FIELDS
    || 'messages,messaging_postbacks,comments';
  let lastError = 'subscription_failed';

  for (const accountId of accountIds) {
    for (const origin of ['https://graph.instagram.com', 'https://graph.facebook.com']) {
      const url = new URL(`${origin}/${GRAPH_VERSION}/${accountId}/subscribed_apps`);
      url.searchParams.set('access_token', accessToken);
      url.searchParams.set('subscribed_fields', fields);
      try {
        const response = await fetch(url, { method: 'POST' });
        const body = await response.json().catch(() => ({}));
        if (response.ok && body?.success !== false && !body?.error) {
          return { ok: true, accountId, fields };
        }
        lastError = body?.error?.message || `Meta subscription failed (${response.status})`;
      } catch (error) {
        lastError = error?.message || String(error);
      }
    }
  }

  return { ok: false, skipped: false, reason: lastError };
}

async function findSocialInboxAccount(recipientId) {
  const { data: direct, error: directError } = await supabase
    .from('social_tokens')
    .select('user_id,account_id,page_id,instagram_business_id,username,account_name')
    .eq('provider', 'instagram')
    .or(`account_id.eq.${recipientId},page_id.eq.${recipientId},instagram_business_id.eq.${recipientId}`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (directError) throw directError;
  if (direct) return direct;

  // Compatibility mapping only: older OAuth flows stored Meta's webhook-scoped
  // recipient id here. Inbox persistence itself does not depend on a bot.
  const { data: legacy, error: legacyError } = await supabase
    .from('instagram_accounts')
    .select('user_id,instagram_business_account_id,instagram_username,page_id')
    .eq('is_connected', true)
    .or(`webhook_instagram_user_id.eq.${recipientId},instagram_business_account_id.eq.${recipientId},page_id.eq.${recipientId}`)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (legacyError) throw legacyError;
  if (!legacy) return null;

  return {
    user_id: legacy.user_id,
    account_id: legacy.instagram_business_account_id || legacy.page_id,
    page_id: legacy.page_id,
    instagram_business_id: legacy.instagram_business_account_id,
    username: legacy.instagram_username,
    account_name: legacy.instagram_username,
  };
}

export async function persistInstagramWebhookToUnifiedInbox(payload) {
  const results = [];

  for (const entry of payload?.entry || []) {
    const entryId = cleanId(entry?.id);
    for (const messaging of entry?.messaging || []) {
      const message = messaging?.message;
      if (!message || message.is_echo) continue;

      const senderId = cleanId(messaging?.sender?.id);
      const recipientId = cleanId(messaging?.recipient?.id) || entryId;
      const text = String(message.text || message.quick_reply?.payload || '').trim();
      if (!senderId || !recipientId || !text || senderId === recipientId) continue;

      const account = await findSocialInboxAccount(recipientId);
      if (!account?.user_id) {
        results.push({ persisted: false, reason: 'account_not_found', recipientId });
        continue;
      }

      const accountId = account.instagram_business_id || account.account_id || account.page_id || recipientId;
      const createdAt = Number.isFinite(Number(messaging.timestamp))
        ? new Date(Number(messaging.timestamp)).toISOString()
        : new Date().toISOString();
      const messageId = String(message.mid || `${recipientId}-${senderId}-${messaging.timestamp || Date.now()}`);

      await persistInboxItems(account.user_id, [{
        id: `ig:${senderId}`,
        platform: 'instagram',
        accountId,
        accountName: account.account_name || account.username || 'Instagram Account',
        externalConversationId: senderId,
        commentId: senderId,
        replyRecipientId: senderId,
        authorName: `Instagram user ${senderId}`,
        text,
        createdAt,
        unread: true,
        replied: false,
        ingestionSource: 'instagram_webhook',
        replies: [{ id: messageId, text, createdAt, isSelf: false }],
      }]);

      results.push({ persisted: true, userId: account.user_id, accountId, senderId });
    }
  }

  return results;
}
