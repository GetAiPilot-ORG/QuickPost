import supabase from './supabase.js';
import { persistInboxItems } from './unifiedInbox.js';
import { decryptToken as decryptTokenEncryption } from './tokenEncryption.js';
import { decryptToken as decryptInstaPilotToken } from './instapilot.js';
import { invalidateInboxCache } from '../routes/inbox.js';

const GRAPH_VERSION = process.env.IG_GRAPH_VERSION || process.env.META_GRAPH_VERSION || 'v24.0';

function cleanId(value) {
  const id = String(value || '').trim();
  return /^\d+$/.test(id) ? id : '';
}

function safeDecrypt(encToken) {
  if (!encToken) return null;
  let decrypted = null;
  if (typeof encToken === 'string' && encToken.startsWith('enc:v1:')) {
    try {
      decrypted = decryptInstaPilotToken(encToken);
    } catch {
      try {
        decrypted = decryptTokenEncryption(encToken);
      } catch {
        decrypted = encToken;
      }
    }
  } else {
    try {
      decrypted = decryptTokenEncryption(encToken);
    } catch {
      decrypted = encToken;
    }
  }
  if (typeof decrypted === 'object' && decrypted !== null) {
    return decrypted.pageAccessToken || decrypted.userAccessToken || decrypted.accessToken || null;
  }
  if (typeof decrypted === 'string' && decrypted.startsWith('{')) {
    try {
      const parsed = JSON.parse(decrypted);
      return parsed.pageAccessToken || parsed.userAccessToken || parsed.accessToken || decrypted;
    } catch {}
  }
  return decrypted;
}

export async function ensureInstagramWebhookSubscription(tokenRow) {
  const rawToken = tokenRow?.access_token_encrypted || tokenRow?.access_token;
  const accessToken = String(safeDecrypt(rawToken) || rawToken || '').trim();
  const accountIds = [
    tokenRow?.instagram_business_id,
    tokenRow?.account_id,
    tokenRow?.page_id,
  ].map(cleanId).filter((value, index, values) => value && values.indexOf(value) === index);
  if (!accessToken || !accountIds.length) return { ok: false, skipped: true, reason: 'missing_credentials' };

  let lastError = 'subscription_failed';

  for (const accountId of accountIds) {
    for (const origin of ['https://graph.instagram.com', 'https://graph.facebook.com']) {
      const isFb = origin.includes('facebook.com');
      const fields = isFb
        ? (process.env.INBOX_FACEBOOK_SUBSCRIBED_FIELDS || 'messages,messaging_postbacks,message_echoes,feed')
        : (process.env.INBOX_INSTAGRAM_SUBSCRIBED_FIELDS || 'messages,messaging_postbacks,message_echoes,comments');

      const url = new URL(`${origin}/${GRAPH_VERSION}/${accountId}/subscribed_apps`);
      url.searchParams.set('access_token', accessToken);
      url.searchParams.set('subscribed_fields', fields);
      try {
        const response = await fetch(url, { method: 'POST' });
        const body = await response.json().catch(() => ({}));
        if (response.ok && body?.success !== false && !body?.error) {
          return { ok: true, accountId, fields, origin };
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
    .select('user_id,account_id,page_id,instagram_business_id,username,account_name,access_token')
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
    .select('user_id,instagram_business_account_id,instagram_username,page_id,access_token_encrypted')
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
    access_token_encrypted: legacy.access_token_encrypted,
  };
}

export async function persistInstagramWebhookToUnifiedInbox(payload) {
  const results = [];

  for (const entry of payload?.entry || []) {
    const entryId = cleanId(entry?.id);
    for (const messaging of entry?.messaging || []) {
      const message = messaging?.message;
      if (!message) continue;

      const isEcho = Boolean(message.is_echo);
      const rawSenderId = cleanId(messaging?.sender?.id);
      const rawRecipientId = cleanId(messaging?.recipient?.id) || entryId;
      if (!rawSenderId || !rawRecipientId || rawSenderId === rawRecipientId) continue;

      // In an echo event, sender is the business account, recipient is the customer/contact.
      // In an inbound event, sender is the customer/contact, recipient is the business account.
      const businessTargetId = isEcho ? rawSenderId : rawRecipientId;
      const contactTargetId = isEcho ? rawRecipientId : rawSenderId;

      const attachments = message.attachments || [];
      const firstAttachment = attachments[0] || {};
      let imageUrl = null;
      let videoUrl = null;
      let shareUrl = null;

      if (firstAttachment.type === 'image' || firstAttachment.type === 'sticker') {
        imageUrl = firstAttachment.payload?.url || firstAttachment.image_data?.url || firstAttachment.file_url || null;
      } else if (firstAttachment.type === 'video' || firstAttachment.type === 'audio') {
        videoUrl = firstAttachment.payload?.url || firstAttachment.video_data?.url || firstAttachment.file_url || null;
      } else if (firstAttachment.type === 'share' || firstAttachment.type === 'story_mention' || firstAttachment.type === 'ig_reel') {
        shareUrl = firstAttachment.payload?.url || firstAttachment.link || null;
      }

      let text = String(message.text || '').trim();
      if (!text && (imageUrl || videoUrl || shareUrl)) {
        text = imageUrl ? '📸 Photo' : videoUrl ? '🎥 Video' : shareUrl ? '🎬 Shared Media' : '📎 Attachment';
      } else if (!text && message.quick_reply?.payload) {
        text = String(message.quick_reply.payload).trim();
      }

      if (!text && !imageUrl && !videoUrl && !shareUrl) continue;

      const account = await findSocialInboxAccount(businessTargetId);
      if (!account?.user_id) {
        results.push({ persisted: false, reason: 'account_not_found', businessTargetId });
        continue;
      }

      const accountId = account.instagram_business_id || account.account_id || account.page_id || businessTargetId;
      const createdAt = Number.isFinite(Number(messaging.timestamp))
        ? new Date(Number(messaging.timestamp)).toISOString()
        : new Date().toISOString();
      const messageId = String(message.mid || `${businessTargetId}-${contactTargetId}-${messaging.timestamp || Date.now()}`);

      let authorName = `Instagram user ${contactTargetId}`;
      let authorHandle = null;
      let authorAvatar = null;

      try {
        const { data: contact } = await supabase
          .from('contacts')
          .select('username, full_name, profile_picture_url')
          .eq('user_id', account.user_id)
          .eq('instagram_user_id', String(contactTargetId))
          .maybeSingle();

        if (contact) {
          if (contact.username) {
            authorHandle = `@${contact.username.replace(/^@/, '')}`;
            authorName = contact.username;
          }
          if (contact.full_name) {
            authorName = contact.full_name;
          }
          if (contact.profile_picture_url) {
            authorAvatar = contact.profile_picture_url;
          }
        } else {
          const { data: existingConv } = await supabase
            .from('inbox_conversations')
            .select('contact_name, contact_handle, contact_avatar_url')
            .eq('user_id', account.user_id)
            .eq('platform', 'instagram')
            .eq('external_conversation_id', String(contactTargetId))
            .maybeSingle();

          if (existingConv) {
            if (existingConv.contact_name && !existingConv.contact_name.startsWith('Instagram user')) {
              authorName = existingConv.contact_name;
            }
            if (existingConv.contact_handle) {
              authorHandle = existingConv.contact_handle;
            }
            if (existingConv.contact_avatar_url) {
              authorAvatar = existingConv.contact_avatar_url;
            }
          }
        }
        if (!authorAvatar || !authorHandle || authorName.startsWith('Instagram user')) {
          // Attempt on-demand resolution from Instagram Graph API
          const rawToken = account.access_token || account.access_token_encrypted;
          const token = safeDecrypt(rawToken) || rawToken;
          if (token && contactTargetId) {
            const isIgToken = typeof token === 'string' && token.startsWith('IG');
            const graphBase = isIgToken ? 'https://graph.instagram.com/v24.0' : 'https://graph.facebook.com/v18.0';
            try {
              const res = await fetch(`${graphBase}/${contactTargetId}?fields=id,username,name,profile_pic&access_token=${token}`);
              if (res.ok) {
                const igUser = await res.json();
                if (igUser.name) authorName = igUser.name;
                else if (igUser.username) authorName = igUser.username;
                if (igUser.username) authorHandle = `@${igUser.username.replace(/^@/, '')}`;
                if (igUser.profile_pic) authorAvatar = igUser.profile_pic;

                // Persist into contacts directory for future instant hits
                void supabase.from('contacts').upsert({
                  user_id: account.user_id,
                  username: igUser.username || null,
                  full_name: igUser.name || igUser.username || null,
                  profile_picture_url: igUser.profile_pic || null,
                  instagram_user_id: String(contactTargetId),
                }, { onConflict: 'user_id,instagram_user_id' }).catch(() => {});
              }
            } catch {}
          }
        }
      } catch (e) {
        // ignore
      }

      await persistInboxItems(account.user_id, [{
        id: `ig:${contactTargetId}`,
        platform: 'instagram',
        accountId,
        accountName: account.account_name || account.username || 'Instagram Account',
        externalConversationId: contactTargetId,
        commentId: contactTargetId,
        replyRecipientId: contactTargetId,
        authorName,
        authorHandle,
        authorAvatar,
        text,
        imageUrl,
        videoUrl,
        shareUrl,
        replied: isEcho,
        unread: !isEcho,
        replies: [{ id: messageId, text, imageUrl, videoUrl, shareUrl, createdAt, isSelf: isEcho }],
      }]);

      await invalidateInboxCache(account.user_id).catch(() => {});

      results.push({ persisted: true, userId: account.user_id, accountId, contactTargetId, isEcho });
    }
  }

  return results;
}
