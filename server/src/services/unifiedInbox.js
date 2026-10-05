import supabase from './supabase.js';

const DEFAULT_PAGE_SIZE = 30;
const MAX_PAGE_SIZE = 100;

function pageSize(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
}

export function encodeInboxCursor(row, timestampField) {
  if (!row?.id || !row?.[timestampField]) return null;
  return Buffer.from(JSON.stringify({ at: row[timestampField], id: row.id })).toString('base64url');
}

export function decodeInboxCursor(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (!parsed?.at || !/^[0-9a-f-]{36}$/i.test(parsed?.id) || Number.isNaN(Date.parse(parsed.at))) return null;
    return { at: new Date(parsed.at).toISOString(), id: parsed.id };
  } catch {
    return null;
  }
}

function externalConversationId(item) {
  return String(item.externalConversationId || item.commentId || item.topLevelCommentId || item.id || '').replace(/^(ig|fb|yt|bsky|masto):/, '');
}

function threadType(item) {
  return ['instagram', 'facebook'].includes(item.platform) ? 'direct_message' : 'post_comment';
}

function conversationPayload(userId, item) {
  const createdAt = item.createdAt && !Number.isNaN(Date.parse(item.createdAt))
    ? new Date(item.createdAt).toISOString()
    : new Date().toISOString();
  return {
    user_id: userId,
    platform: item.platform,
    account_id: String(item.accountId),
    account_name: item.accountName || null,
    external_conversation_id: externalConversationId(item),
    thread_type: threadType(item),
    external_post_id: item.postId ? String(item.postId) : null,
    post_title: item.postTitle || null,
    post_thumbnail_url: item.postThumbnail || null,
    contact_external_id: item.authorId ? String(item.authorId) : null,
    contact_name: item.authorName || null,
    contact_handle: item.authorHandle || null,
    contact_avatar_url: item.authorAvatar || null,
    last_message_text: item.text || '',
    last_message_at: createdAt,
    last_inbound_at: item.replied ? null : createdAt,
    last_outbound_at: item.replied ? createdAt : null,
    unread_count: item.unread ? 1 : 0,
    is_replied: Boolean(item.replied),
    is_starred: Boolean(item.starred),
    metadata: {
      source: item.ingestionSource || 'legacy_aggregator',
      reply_target_id: item.commentId || null,
      recipient_id: item.replyRecipientId || null,
      thread_complete: Boolean(item.threadLoaded || !['instagram', 'facebook'].includes(item.platform)),
    },
  };
}

function messagePayload(userId, conversation, item, message) {
  const sentAt = message.createdAt && !Number.isNaN(Date.parse(message.createdAt))
    ? new Date(message.createdAt).toISOString()
    : conversation.last_message_at;
  return {
    user_id: userId,
    conversation_id: conversation.id,
    platform: item.platform,
    account_id: String(item.accountId),
    external_message_id: message.id ? String(message.id) : null,
    direction: message.isSelf ? 'outbound' : 'inbound',
    body: message.text || '',
    delivery_status: message.isSelf ? 'sent' : 'received',
    sent_at: sentAt,
    raw_payload: {
      ...(message.raw_payload || {}),
      imageUrl: message.imageUrl || null,
      videoUrl: message.videoUrl || null,
      shareUrl: message.shareUrl || null,
      buttons: message.buttons || [],
      isInteractiveCard: Boolean(message.isInteractiveCard),
    },
  };
}

export async function persistInboxItems(userId, items) {
  if (!userId || !Array.isArray(items) || items.length === 0) return;
  for (const item of items) {
    if (!item?.platform || !item?.accountId || !externalConversationId(item)) continue;
    const payload = conversationPayload(userId, item);
    const { data: conversation, error } = await supabase
      .from('inbox_conversations')
      .upsert(payload, { onConflict: 'user_id,platform,account_id,external_conversation_id' })
      .select('id,last_message_at')
      .single();
    if (error) throw error;

    const replies = item.replies?.length ? item.replies : [{
      id: item.id,
      text: item.text,
      imageUrl: item.imageUrl,
      createdAt: item.createdAt,
      isSelf: Boolean(item.replied),
    }];
    const messages = replies.map((message) => messagePayload(userId, conversation, item, message));
    const withExternalIds = messages.filter((message) => message.external_message_id);
    if (withExternalIds.length) {
      const { error: messageError } = await supabase
        .from('inbox_messages')
        .upsert(withExternalIds, { onConflict: 'user_id,platform,account_id,external_message_id' });
      if (messageError) throw messageError;
    }
  }
}

export async function persistInboxThreadMessages(userId, platform, accountId, externalId, replies) {
  if (!externalId || !Array.isArray(replies) || replies.length === 0) return;

  const { data: conversation, error } = await supabase
    .from('inbox_conversations')
    .select('id,last_message_at,metadata,account_id,contact_handle')
    .eq('user_id', userId)
    .eq('platform', platform)
    .or(`external_conversation_id.eq.${externalId},contact_external_id.eq.${externalId}`)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!conversation) return;

  const item = { platform, accountId: conversation.account_id || accountId };
  const messages = replies
    .map((message) => messagePayload(userId, conversation, item, message))
    .filter((message) => message.external_message_id);
  if (!messages.length) return;
  const { error: messageError } = await supabase
    .from('inbox_messages')
    .upsert(messages, { onConflict: 'user_id,platform,account_id,external_message_id' });
  if (messageError) throw messageError;
  const inboundWithAvatar = replies.find((r) => !r.isSelf && r.authorAvatar);
  const convUpdates = {
    metadata: { ...(conversation.metadata || {}), thread_complete: true },
  };
  if (inboundWithAvatar?.authorAvatar) {
    convUpdates.contact_avatar_url = inboundWithAvatar.authorAvatar;
  }
  if (inboundWithAvatar?.authorName && inboundWithAvatar.authorName !== 'Instagram User' && inboundWithAvatar.authorName !== 'Facebook User') {
    convUpdates.contact_name = inboundWithAvatar.authorName;
  }
  const { error: conversationError } = await supabase
    .from('inbox_conversations')
    .update(convUpdates)
    .eq('user_id', userId)
    .eq('id', conversation.id);
  if (conversationError) throw conversationError;
}

function toInboxItem(row) {
  return {
    id: `${row.platform}:${row.external_conversation_id}`,
    databaseId: row.id,
    externalConversationId: row.external_conversation_id,
    platform: row.platform,
    accountId: row.account_id,
    accountName: row.account_name,
    postId: row.external_post_id,
    postTitle: row.post_title,
    postThumbnail: row.post_thumbnail_url,
    commentId: row.metadata?.reply_target_id || row.external_conversation_id,
    topLevelCommentId: row.metadata?.reply_target_id || row.external_conversation_id,
    replyRecipientId: row.metadata?.recipient_id || null,
    threadComplete: Boolean(row.metadata?.thread_complete),
    authorName: row.contact_name || 'Social user',
    authorAvatar: row.contact_avatar_url,
    authorHandle: row.contact_handle || '',
    text: row.last_message_text || '',
    createdAt: row.last_message_at,
    replied: row.is_replied,
    starred: row.is_starred,
    unread: row.unread_count > 0,
    replyCount: row.unread_count,
    replies: [],
    persisted: true,
  };
}

export async function listInboxConversations(userId, params = {}) {
  const limit = pageSize(params.limit);
  const cursor = decodeInboxCursor(params.cursor);

  // Fetch connected account identifiers for the user
  const [{ data: activeIg }, { data: activeSocial }] = await Promise.all([
    supabase
      .from('instagram_accounts')
      .select('id, instagram_business_account_id, page_id')
      .eq('user_id', userId)
      .eq('is_connected', true),
    supabase
      .from('social_tokens')
      .select('provider, account_id, page_id, instagram_business_id')
      .eq('user_id', userId)
  ]);

  const activeAccountSet = new Set();
  (activeIg || []).forEach(a => {
    if (a.id) activeAccountSet.add(String(a.id));
    if (a.instagram_business_account_id) activeAccountSet.add(String(a.instagram_business_account_id));
    if (a.page_id) activeAccountSet.add(String(a.page_id));
  });
  (activeSocial || []).forEach(s => {
    if (s.account_id) activeAccountSet.add(String(s.account_id));
    if (s.page_id) activeAccountSet.add(String(s.page_id));
    if (s.instagram_business_id) activeAccountSet.add(String(s.instagram_business_id));
  });

  const [{ data, error }, { data: userContacts }, { data: globalContacts }] = await Promise.all([
    (() => {
      let q = supabase
        .from('inbox_conversations')
        .select('*')
        .eq('user_id', userId)
        .order('last_message_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(limit + 1);
      if (params.platform && params.platform !== 'all') q = q.eq('platform', params.platform);
      if (params.accountId && params.accountId !== 'all') q = q.eq('account_id', params.accountId);
      if (cursor) {
        q = q.or(`last_message_at.lt.${cursor.at},and(last_message_at.eq.${cursor.at},id.lt.${cursor.id})`);
      }
      return q;
    })(),
    supabase
      .from('contacts')
      .select('username, full_name, profile_picture_url, instagram_user_id')
      .eq('user_id', userId),
    supabase
      .from('contacts')
      .select('username, full_name, profile_picture_url, instagram_user_id')
      .not('profile_picture_url', 'is', null)
  ]);

  if (error) throw error;

  const contactMap = new Map();
  (globalContacts || []).forEach(c => {
    if (c.username) contactMap.set(c.username.toLowerCase().replace(/^@/, ''), c);
    if (c.instagram_user_id) contactMap.set(String(c.instagram_user_id), c);
  });
  (userContacts || []).forEach(c => {
    if (c.username) contactMap.set(c.username.toLowerCase().replace(/^@/, ''), c);
    if (c.instagram_user_id) contactMap.set(String(c.instagram_user_id), c);
  });

  const hasMore = (data || []).length > limit;
  const rows = (data || []).slice(0, limit);
  return {
    items: rows.map((r) => {
      const handle = (r.contact_handle || r.contact_name || '').toLowerCase().replace(/^@/, '');
      const extId = String(r.contact_external_id || r.external_conversation_id || '');
      const contact = contactMap.get(handle) || contactMap.get(extId);
      if (contact) {
        if (!r.contact_avatar_url && contact.profile_picture_url) r.contact_avatar_url = contact.profile_picture_url;
        if ((!r.contact_name || r.contact_name === r.contact_handle) && contact.full_name) r.contact_name = contact.full_name;
      }
      const item = toInboxItem(r);
      const isConnected = activeAccountSet.has(String(r.account_id));
      return { ...item, accountConnected: isConnected };
    }),
    nextCursor: hasMore ? encodeInboxCursor(rows.at(-1), 'last_message_at') : null,
  };
}

export async function listInboxMessages(userId, conversationId, params = {}) {
  const limit = pageSize(params.limit);
  const cursor = decodeInboxCursor(params.before);
  let query = supabase
    .from('inbox_messages')
    .select('*')
    .eq('user_id', userId)
    .eq('conversation_id', conversationId)
    .order('sent_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);
  if (cursor) query = query.or(`sent_at.lt.${cursor.at},and(sent_at.eq.${cursor.at},id.lt.${cursor.id})`);
  const { data, error } = await query;
  if (error) throw error;
  const hasMore = (data || []).length > limit;
  const rows = (data || []).slice(0, limit);
  const nextCursor = hasMore ? encodeInboxCursor(rows.at(-1), 'sent_at') : null;
  return {
    messages: rows.reverse().map((row) => {
      let imageUrl = row.raw_payload?.imageUrl || row.raw_payload?.image_url || null;
      if (!imageUrl && row.body) {
        const imgMatch = row.body.match(/(https?:\/\/[^\s]+(?:\.(?:png|jpg|jpeg|webp|gif)|res\.cloudinary\.com\/[^\s]+)[^\s]*)/i);
        if (imgMatch) imageUrl = imgMatch[0];
      }
      return {
        id: row.external_message_id || row.id,
        text: row.body,
        imageUrl,
        videoUrl: row.raw_payload?.videoUrl || row.raw_payload?.video_url || null,
        shareUrl: row.raw_payload?.shareUrl || row.raw_payload?.share_url || null,
        buttons: row.raw_payload?.buttons || [],
        isInteractiveCard: Boolean(row.raw_payload?.isInteractiveCard),
        createdAt: row.sent_at,
        isSelf: row.direction === 'outbound',
        status: row.delivery_status,
      };
    }),
    nextCursor,
  };
}

export async function markInboxConversationRead(userId, conversationId) {
  const { data, error } = await supabase
    .from('inbox_conversations')
    .update({ unread_count: 0, last_read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', conversationId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function recordInboxOutboundMessage(userId, details) {
  const externalId = String(details.externalConversationId || details.conversationId || '').replace(/^(ig|fb|yt|bsky|masto):/, '');
  const { data: conversation, error } = await supabase
    .from('inbox_conversations')
    .select('id')
    .eq('user_id', userId)
    .eq('platform', details.platform)
    .eq('account_id', String(details.accountId))
    .eq('external_conversation_id', externalId)
    .maybeSingle();
  if (error) throw error;
  if (!conversation) return;

  const sentAt = new Date().toISOString();
  const { error: messageError } = await supabase.from('inbox_messages').upsert({
    user_id: userId,
    conversation_id: conversation.id,
    platform: details.platform,
    account_id: String(details.accountId),
    external_message_id: String(details.messageId),
    direction: 'outbound',
    body: details.text,
    delivery_status: 'sent',
    sent_at: sentAt,
  }, { onConflict: 'user_id,platform,account_id,external_message_id' });
  if (messageError) throw messageError;

  const { error: conversationError } = await supabase
    .from('inbox_conversations')
    .update({
      last_message_text: details.text,
      last_message_at: sentAt,
      last_outbound_at: sentAt,
      is_replied: true,
    })
    .eq('user_id', userId)
    .eq('id', conversation.id);
  if (conversationError) throw conversationError;
}

export async function recordInboxSyncState(userId, platform, accountId, result) {
  const now = new Date().toISOString();
  const payload = {
    user_id: userId,
    platform,
    account_id: String(accountId),
    last_attempt_at: now,
    last_success_at: result.ok ? now : null,
    last_error: result.ok ? null : String(result.error || 'Unknown synchronization error').slice(0, 1000),
  };
  const { error } = await supabase
    .from('inbox_sync_state')
    .upsert(payload, { onConflict: 'user_id,platform,account_id' });
  if (error) throw error;
}
