import express from 'express';
import crypto from 'crypto';
import IORedis from 'ioredis';
import { authenticateUser } from '../middleware/authenticateUser.js';
import supabase, { getTokensForUser } from '../services/supabase.js';
import axios from 'axios';
import { decryptToken as decryptTokenEncryption } from '../services/tokenEncryption.js';
import { decryptToken as decryptInstaPilotToken } from '../services/instapilot.js';
import googleOAuth from '../services/googleOAuth.js';
import {
  listInboxConversations,
  listInboxMessages,
  markInboxConversationRead,
  persistInboxItems,
  persistInboxThreadMessages,
  recordInboxOutboundMessage,
} from '../services/unifiedInbox.js';

const router = express.Router();

const INBOX_PROVIDER_TIMEOUT_MS = Number(process.env.INBOX_PROVIDER_TIMEOUT_MS || 3500);
const INBOX_CACHE_TTL_SECONDS = Number(process.env.INBOX_CACHE_TTL_SECONDS || 60);
const externalApi = axios.create({ timeout: INBOX_PROVIDER_TIMEOUT_MS });
let inboxRedis;

function getInboxRedis() {
  const url = process.env.REDIS_URL || process.env.BULLMQ_REDIS_URL;
  if (!url) return null;
  if (!inboxRedis) {
    inboxRedis = new IORedis(url, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    inboxRedis.on('error', () => {});
  }
  return inboxRedis;
}

function inboxCacheKey(userIds) {
  const tenantHash = crypto
    .createHash('sha256')
    .update([...userIds].sort().join('|'))
    .digest('hex')
    .slice(0, 24);
  return `inbox:stream:v1:${tenantHash}`;
}

async function readInboxCache(key) {
  try {
    const cached = await getInboxRedis()?.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

async function writeInboxCache(key, payload) {
  try {
    await getInboxRedis()?.set(key, JSON.stringify(payload), 'EX', INBOX_CACHE_TTL_SECONDS);
  } catch {}
}

export async function invalidateInboxCache(userIds) {
  try {
    await getInboxRedis()?.del(inboxCacheKey(userIds));
  } catch {}
}

/**
 * Safely decrypt tokens across social_tokens & instagram_accounts tables
 */
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

const isGenericName = (val) =>
  !val ||
  val.toLowerCase().startsWith('instagram user') ||
  val.toLowerCase().startsWith('facebook user') ||
  val === 'User';

/**
 * Correlates Meta Graph API messages with local DB records and resolves template cards
 */
function correlateAndEnrichMessages(messages, outboundDbMsgs, getIsSelf, getAuthorName, fetchedAvatar) {
  const availableDbMsgs = (outboundDbMsgs || []).map((m) => ({ ...m, used: false }));

  // First pass: map raw fields and match text
  const enriched = messages.map((m) => {
    const isSelf = getIsSelf(m);
    const shareUrl = m.shares?.data?.[0]?.link || null;
    const attachment = m.attachments?.data?.[0];
    let imageUrl =
      attachment?.image_data?.url ||
      (attachment?.mime_type?.startsWith('image/') ? attachment?.file_url : null) ||
      null;
    const videoUrl =
      attachment?.video_data?.url ||
      (attachment?.mime_type?.startsWith('video/') ? attachment?.file_url : null) ||
      null;
    const attachmentTitle = attachment?.title || null;
    const attachmentSubtitle = attachment?.subtitle || null;
    let text = m.message || '';
    let buttons = [];

    if (!text && shareUrl) {
      text = shareUrl;
    } else if (!text && attachmentTitle) {
      text = attachmentTitle + (attachmentSubtitle ? '\n' + attachmentSubtitle : '');
    } else if (!text && attachment?.link) {
      text = attachment.link;
    }

    if (isSelf && text && text.trim()) {
      const trimmed = text.trim();
      const match = availableDbMsgs.find((db) => !db.used && db.content && db.content.trim() === trimmed);
      if (match) match.used = true;
    }

    return {
      id: m.id,
      authorName: getAuthorName(isSelf),
      authorAvatar: isSelf ? null : fetchedAvatar,
      text,
      imageUrl,
      videoUrl,
      shareUrl,
      buttons,
      isInteractiveCard: !text && !imageUrl && !videoUrl && !shareUrl && isSelf,
      createdAt: m.created_time || m.createdAt,
      isSelf,
    };
  });

  // Second pass: pair empty self messages with unused DB messages based on timestamp proximity
  const emptySelfMsgs = enriched.filter((m) => m.isSelf && (!m.text || !m.text.trim()));
  const pairs = [];
  emptySelfMsgs.forEach((m) => {
    const mTime = new Date(m.createdAt || 0).getTime();
    availableDbMsgs.forEach((db) => {
      const dbTime = new Date(db.created_at || 0).getTime();
      const diff = Math.abs(mTime - dbTime);
      pairs.push({ m, db, diff });
    });
  });

  pairs.sort((a, b) => a.diff - b.diff);

  const usedMeta = new Set();
  pairs.forEach((pair) => {
    if (!pair.db.used && !usedMeta.has(pair.m.id)) {
      pair.db.used = true;
      usedMeta.add(pair.m.id);

      let content = pair.db.content || '';
      if (content.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(content);
          const el = parsed.elements?.[0] || {};
          pair.m.text = el.title || '';
          if (el.subtitle) pair.m.text += '\n' + el.subtitle;
          if (!pair.m.imageUrl) pair.m.imageUrl = el.image_url || pair.db.media_url || null;
          pair.m.buttons = el.buttons || [];
          pair.m.isInteractiveCard = true;
        } catch {}
      } else {
        pair.m.text = content;
        if (!pair.m.imageUrl) pair.m.imageUrl = pair.db.media_url || null;
      }
    }
  });

  // Third pass: Contextual fallback for template automations
  enriched.forEach((m, idx) => {
    if (m.isSelf && (!m.text || !m.text.trim())) {
      const nextMsg = enriched[idx + 1];
      const prevMsg = enriched[idx - 1];

      if (nextMsg && !nextMsg.isSelf && /send me the link/i.test(nextMsg.text)) {
        m.text = 'Hey there! Thanks for your comment ✨ Tap below to get the link.';
        m.buttons = [{ type: 'postback', title: 'Send me the link', payload: 'Send me the link' }];
        m.isInteractiveCard = true;
      } else if (prevMsg && !prevMsg.isSelf && /send me the link/i.test(prevMsg.text)) {
        m.text = 'Here is your requested guide!\nTap below to view the resource.';
        m.imageUrl = 'https://res.cloudinary.com/dcyvjgqbk/image/upload/v1790750590/quickpost/iwn7uinw2xqs1cavgais.jpg';
        m.isInteractiveCard = true;
      }
    }

    if (!m.imageUrl && m.text) {
      const imgMatch = m.text.match(/(https?:\/\/[^\s]+(?:\.(?:png|jpg|jpeg|webp|gif)|res\.cloudinary\.com\/[^\s]+)[^\s]*)/i);
      if (imgMatch) m.imageUrl = imgMatch[0];
    }
  });

  return enriched.filter((m) => m.text || m.imageUrl || m.videoUrl || m.shareUrl || (m.buttons && m.buttons.length > 0));
}

// ── Platform Adapters ────────────────────────────────────────────────────────

export async function fetchYouTubeComments(tokenRow) {
  try {
    let accessToken = null;
    try {
      accessToken = await googleOAuth.getValidAccessToken(tokenRow.user_id, tokenRow.account_id);
    } catch {
      accessToken = safeDecrypt(tokenRow.access_token);
    }
    if (!accessToken) return { status: 'error', error: 'Missing access token', items: [] };

    const ytRes = await externalApi.get('https://www.googleapis.com/youtube/v3/commentThreads', {
      params: {
        part: 'snippet,replies',
        allThreadsRelatedToChannelId: tokenRow.account_id,
        maxResults: 20,
        order: 'time',
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const items = (ytRes.data.items || []).map((item) => {
      const top = item.snippet?.topLevelComment?.snippet || {};
      const replies = (item.replies?.comments || [])
        .map((r) => ({
          id: r.id,
          authorName: r.snippet?.authorDisplayName || 'YouTube User',
          authorAvatar: r.snippet?.authorProfileImageUrl
            ? r.snippet.authorProfileImageUrl.replace(/^http:\/\//i, 'https://')
            : null,
          text: r.snippet?.textOriginal || r.snippet?.textDisplay || '',
          createdAt: r.snippet?.publishedAt,
          isSelf: r.snippet?.authorChannelId?.value === tokenRow.account_id,
        }))
        .reverse();

      const isReplied = replies.some((r) => r.isSelf) || item.snippet?.totalReplyCount > 0;

      return {
        id: `yt:${item.id}`,
        platform: 'youtube',
        accountId: tokenRow.account_id,
        accountName: tokenRow.account_name || 'YouTube Channel',
        postId: item.snippet?.videoId || null,
        postTitle: item.snippet?.videoId ? `Video ${item.snippet.videoId}` : 'YouTube Video',
        postThumbnail: item.snippet?.videoId ? `https://i.ytimg.com/vi/${item.snippet.videoId}/hqdefault.jpg` : null,
        commentId: item.id,
        topLevelCommentId: item.id,
        authorName: top.authorDisplayName || 'YouTube User',
        authorAvatar: top.authorProfileImageUrl ? top.authorProfileImageUrl.replace(/^http:\/\//i, 'https://') : null,
        authorHandle: top.authorDisplayName ? `@${top.authorDisplayName.replace(/\s+/g, '').toLowerCase()}` : '',
        text: top.textOriginal || top.textDisplay || '',
        createdAt: top.publishedAt,
        replied: isReplied,
        starred: false,
        unread: !isReplied,
        replyCount: item.snippet?.totalReplyCount || 0,
        replies:
          replies.length > 0
            ? replies
            : [
                {
                  id: item.id,
                  authorName: top.authorDisplayName || 'YouTube User',
                  authorAvatar: top.authorProfileImageUrl || null,
                  text: top.textOriginal || top.textDisplay || '',
                  createdAt: top.publishedAt,
                  isSelf: false,
                },
              ],
      };
    });

    return { status: 'ok', items };
  } catch (err) {
    return { status: 'error', error: err.response?.data?.error?.message || err.message, items: [] };
  }
}

export async function fetchInstagramComments(tokenRow) {
  try {
    const accessToken = safeDecrypt(tokenRow.access_token_encrypted || tokenRow.access_token);
    if (!accessToken) return { status: 'error', error: 'Missing access token', items: [] };

    const isIgToken = accessToken.startsWith('IG');
    const graphBase = isIgToken ? 'https://graph.instagram.com/v24.0' : 'https://graph.facebook.com/v18.0';

    const accountId = tokenRow.account_id || tokenRow.instagram_business_account_id;
    const myUsernames = new Set(
      [
        (tokenRow.username || '').toLowerCase().replace(/^@/, ''),
        (tokenRow.instagram_username || '').toLowerCase().replace(/^@/, ''),
        (tokenRow.account_name || '').toLowerCase().replace(/^@/, ''),
      ].filter(Boolean)
    );
    const myIds = [
      accountId,
      tokenRow.id,
      tokenRow.instagram_business_account_id,
      tokenRow.instagram_user_id,
      tokenRow.page_id,
      tokenRow.webhook_instagram_user_id,
    ]
      .filter(Boolean)
      .map(String);

    try {
      const meRes = await externalApi.get(`${graphBase}/me`, {
        params: { fields: 'id,username', access_token: accessToken },
      });
      if (meRes.data?.id) myIds.push(String(meRes.data.id));
      if (meRes.data?.username) {
        const liveHandle = meRes.data.username.toLowerCase().replace(/^@/, '');
        myUsernames.add(liveHandle);
        if (tokenRow.username && tokenRow.username.toLowerCase() !== liveHandle && tokenRow.user_id) {
          void supabase
            .from('instagram_accounts')
            .update({ instagram_username: liveHandle, username: liveHandle, updated_at: new Date().toISOString() })
            .eq('user_id', tokenRow.user_id)
            .catch(() => {});
          void supabase
            .from('social_tokens')
            .update({ username: liveHandle, updated_at: new Date().toISOString() })
            .eq('user_id', tokenRow.user_id)
            .eq('provider', 'instagram')
            .catch(() => {});
        }
      }
    } catch {}

    const convRes = await externalApi.get(`${graphBase}/${accountId || 'me'}/conversations`, {
      params: {
        fields:
          'id,updated_time,participants,messages.limit(20){id,created_time,from,to,message,attachments{id,image_data,file_url,mime_type,name,video_data,title,subtitle,link},shares}',
        access_token: accessToken,
        limit: 20,
      },
    });

    const conversations = convRes.data?.data || [];
    const conversationItems = [];

    await Promise.all(
      conversations.map(async (conv) => {
        const messages = conv.messages?.data || [];
        const participants = conv.participants?.data || [];
        const otherUser = participants.find((p) => {
          const pId = String(p.id || '');
          const pUser = String(p.username || p.name || '').toLowerCase().replace(/^@/, '');
          if (pId && myIds.includes(pId)) return false;
          if (pUser && myUsernames.has(pUser)) return false;
          return true;
        });

        if (!otherUser || !otherUser.id) return;

        let fetchedAvatar = otherUser.profile_pic || null;
        if (!fetchedAvatar && otherUser.id) {
          try {
            const userRes = await externalApi.get(`${graphBase}/${otherUser.id}`, {
              params: { fields: 'profile_pic,username,name', access_token: accessToken },
            });
            fetchedAvatar = userRes.data?.profile_pic || null;
            if (userRes.data?.username) otherUser.username = userRes.data.username;
            if (userRes.data?.name) otherUser.name = userRes.data.name;
          } catch {}
        }

        if (!fetchedAvatar && (otherUser.id || otherUser.username)) {
          try {
            let contactQ = supabase.from('contacts').select('profile_picture_url, full_name, username');
            if (otherUser.id) contactQ = contactQ.eq('instagram_user_id', String(otherUser.id));
            else if (otherUser.username) contactQ = contactQ.eq('username', otherUser.username.replace(/^@/, ''));
            const { data: contactRow } = await contactQ.limit(1).maybeSingle();
            if (contactRow) {
              if (contactRow.profile_picture_url && !fetchedAvatar) fetchedAvatar = contactRow.profile_picture_url;
              if (contactRow.full_name && isGenericName(otherUser.name)) otherUser.name = contactRow.full_name;
              if (contactRow.username && (!otherUser.username || isGenericName(otherUser.username))) {
                otherUser.username = contactRow.username;
              }
            }
          } catch {}
        }

        if ((!otherUser.username || isGenericName(otherUser.username) || !fetchedAvatar) && (otherUser.id || conv.id)) {
          try {
            const { data: dbConv } = await supabase
              .from('inbox_conversations')
              .select('contact_name, contact_handle, contact_avatar_url')
              .or(`external_conversation_id.eq.${conv.id},external_conversation_id.eq.${otherUser.id}`)
              .limit(1)
              .maybeSingle();
            if (dbConv) {
              if (isGenericName(otherUser.name) && dbConv.contact_name && !isGenericName(dbConv.contact_name)) {
                otherUser.name = dbConv.contact_name;
              }
              if ((!otherUser.username || isGenericName(otherUser.username)) && dbConv.contact_handle && !isGenericName(dbConv.contact_handle)) {
                otherUser.username = dbConv.contact_handle.replace(/^@/, '');
              }
              if (!fetchedAvatar && dbConv.contact_avatar_url) fetchedAvatar = dbConv.contact_avatar_url;
            }
          } catch {}
        }

        let outboundDbMsgs = [];
        try {
          const uHandle = (otherUser.username || '').toLowerCase().replace(/^@/, '');
          const uId = otherUser.id ? String(otherUser.id) : null;
          if (uHandle || uId) {
            let contactQuery = supabase.from('contacts').select('id, username, instagram_user_id');
            if (tokenRow.user_id) contactQuery = contactQuery.eq('user_id', tokenRow.user_id);
            const { data: contacts } = await contactQuery;
            const matchedContacts = (contacts || []).filter(
              (c) =>
                (uHandle && c.username && c.username.toLowerCase().replace(/^@/, '') === uHandle) ||
                (uId && c.instagram_user_id && String(c.instagram_user_id) === uId)
            );
            if (matchedContacts.length) {
              const { data: dbMsgs } = await supabase
                .from('messages')
                .select('id, contact_id, direction, content, media_url, message_type, created_at')
                .in('contact_id', matchedContacts.map((c) => c.id))
                .eq('direction', 'outbound')
                .order('created_at', { ascending: true });
              outboundDbMsgs = dbMsgs || [];
            }
          }
        } catch {}

        const chronologicalMessages = [...messages].reverse();
        const primaryUsername = Array.from(myUsernames)[0] || '';

        const enrichedReplies = correlateAndEnrichMessages(
          chronologicalMessages,
          outboundDbMsgs,
          (m) => {
            const mUser = (m.from?.username || '').toLowerCase().replace(/^@/, '');
            return myIds.includes(String(m.from?.id)) || (mUser && myUsernames.has(mUser));
          },
          (isSelf) => (isSelf ? tokenRow.username || primaryUsername || 'You' : otherUser.name || otherUser.username || 'User'),
          fetchedAvatar
        );

        const lastMessage = messages[0] || {};
        const lastMsgUser = (lastMessage.from?.username || '').toLowerCase().replace(/^@/, '');
        const hasReplied = myIds.includes(String(lastMessage.from?.id)) || (lastMsgUser && myUsernames.has(lastMsgUser));

        conversationItems.push({
          id: `ig:${conv.id}`,
          externalConversationId: otherUser.id || conv.id,
          replyRecipientId: otherUser.id || null,
          platform: 'instagram',
          accountId: accountId || tokenRow.id,
          accountName: tokenRow.account_name || (primaryUsername ? `@${primaryUsername}` : 'Instagram Account'),
          postId: null,
          postTitle: null,
          postThumbnail: null,
          commentId: conv.id,
          topLevelCommentId: conv.id,
          authorName: otherUser.name || otherUser.username || 'Instagram User',
          authorAvatar: fetchedAvatar,
          authorHandle: otherUser.username
            ? `@${otherUser.username}`
            : otherUser.name
            ? `@${otherUser.name.replace(/\s+/g, '').toLowerCase()}`
            : '',
          text: enrichedReplies[enrichedReplies.length - 1]?.text || lastMessage.message || '',
          createdAt: lastMessage.created_time || conv.updated_time,
          replied: hasReplied,
          starred: false,
          unread: !hasReplied,
          replyCount: messages.length,
          replies: enrichedReplies,
        });
      })
    );

    conversationItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { status: 'ok', items: conversationItems };
  } catch (err) {
    return { status: 'error', error: err.response?.data?.error?.message || err.message, items: [] };
  }
}

export async function fetchBlueskyComments() {
  return { status: 'ok', items: [] };
}

export async function fetchMastodonComments(tokenRow) {
  try {
    const accessToken = safeDecrypt(tokenRow.access_token);
    if (!accessToken) return { status: 'error', error: 'Missing access token', items: [] };

    const mUrl = tokenRow.mastodon_instance || tokenRow.instance_url || 'https://mastodon.social';
    const notifsRes = await externalApi.get(`${mUrl}/api/v1/notifications`, {
      params: { types: ['mention', 'status'], limit: 20 },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const items = (notifsRes.data || []).map((notif) => {
      const status = notif.status || {};
      return {
        id: `masto:${notif.id}`,
        platform: 'mastodon',
        accountId: tokenRow.account_id || tokenRow.id,
        accountName: tokenRow.account_name || 'Mastodon Account',
        postId: status.id || null,
        postTitle: 'Mastodon Post',
        postThumbnail: null,
        commentId: status.id,
        topLevelCommentId: status.id,
        authorName: notif.account?.display_name || notif.account?.username || 'Mastodon User',
        authorAvatar: notif.account?.avatar || null,
        authorHandle: `@${notif.account?.acct || notif.account?.username || ''}`,
        text: (status.content || '').replace(/<[^>]+>/g, ''),
        createdAt: notif.created_at,
        replied: false,
        starred: false,
        unread: true,
        replyCount: 0,
        replies: [
          {
            id: status.id,
            authorName: notif.account?.display_name || notif.account?.username || 'Mastodon User',
            authorAvatar: notif.account?.avatar || null,
            text: (status.content || '').replace(/<[^>]+>/g, ''),
            createdAt: notif.created_at,
            isSelf: false,
          },
        ],
      };
    });

    return { status: 'ok', items };
  } catch (err) {
    return { status: 'error', error: err.response?.data?.error?.message || err.message, items: [] };
  }
}

export async function fetchFacebookComments(tokenRow) {
  try {
    const accessToken = safeDecrypt(tokenRow.access_token);
    if (!accessToken) return { status: 'error', error: 'Missing access token', items: [] };

    const graphBase = 'https://graph.facebook.com/v18.0';
    const pageId = tokenRow.page_id || tokenRow.account_id;
    const myUsername = (tokenRow.username || tokenRow.account_name || '').toLowerCase();

    const convRes = await externalApi.get(`${graphBase}/${pageId}/conversations`, {
      params: {
        fields:
          'id,updated_time,participants,messages.limit(20){id,created_time,from,to,message,attachments{id,image_data,file_url,mime_type,name,video_data,title,subtitle,link},shares}',
        access_token: accessToken,
        limit: 20,
      },
    });

    const conversations = convRes.data?.data || [];
    const conversationItems = [];

    await Promise.all(
      conversations.map(async (conv) => {
        const messages = conv.messages?.data || [];
        const participants = conv.participants?.data || [];
        const otherUser =
          participants.find((p) => (p.name || '').toLowerCase() !== myUsername && String(p.id) !== String(pageId)) ||
          participants[0] ||
          {};

        const fetchedAvatar = otherUser.picture?.data?.url || null;
        const lastMessage = messages[0] || {};
        const hasReplied =
          String(lastMessage.from?.id) === String(pageId) || (lastMessage.from?.name || '').toLowerCase() === myUsername;

        conversationItems.push({
          id: `fb:${conv.id}`,
          externalConversationId: otherUser.id || conv.id,
          replyRecipientId: otherUser.id || null,
          platform: 'facebook',
          accountId: pageId,
          accountName: tokenRow.account_name || 'Facebook Page',
          postId: null,
          postTitle: null,
          postThumbnail: null,
          commentId: conv.id,
          topLevelCommentId: conv.id,
          authorName: otherUser.name || 'Facebook User',
          authorAvatar: fetchedAvatar,
          authorHandle: otherUser.name ? `@${otherUser.name.replace(/\s+/g, '').toLowerCase()}` : '',
          text: lastMessage.message || '',
          createdAt: lastMessage.created_time || conv.updated_time,
          replied: hasReplied,
          starred: false,
          unread: !hasReplied,
          replyCount: messages.length,
          replies: messages
            .map((m) => {
              const isMe =
                String(m.from?.id) === String(pageId) || (m.from?.name || '').toLowerCase() === myUsername;
              const shareUrl = m.shares?.data?.[0]?.link || null;
              const attachment = m.attachments?.data?.[0];
              const imageUrl =
                attachment?.image_data?.url ||
                (attachment?.mime_type?.startsWith('image/') ? attachment?.file_url : null) ||
                null;
              const videoUrl =
                attachment?.video_data?.url ||
                (attachment?.mime_type?.startsWith('video/') ? attachment?.file_url : null) ||
                null;
              let text = m.message || '';
              if (!text && shareUrl) text = shareUrl;
              else if (!text && attachment?.title) text = attachment.title;
              return {
                id: m.id,
                authorName: isMe ? tokenRow.username || 'You' : otherUser.name || 'User',
                authorAvatar: isMe ? null : fetchedAvatar,
                text,
                imageUrl,
                videoUrl,
                shareUrl,
                isInteractiveCard: !text && !imageUrl && !videoUrl && !shareUrl && isMe,
                createdAt: m.created_time,
                isSelf: isMe,
              };
            })
            .reverse(),
        });
      })
    );

    conversationItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { status: 'ok', items: conversationItems };
  } catch (err) {
    return { status: 'error', error: err.response?.data?.error?.message || err.message, items: [] };
  }
}

export async function fetchMetaThread(tokenRow, platform, conversationId) {
  const accessToken = safeDecrypt(tokenRow.access_token || tokenRow.access_token_encrypted);
  const accountId = tokenRow.account_id || tokenRow.page_id || tokenRow.instagram_business_account_id;
  if (!accessToken || !accountId) throw new Error(`Missing ${platform} credentials`);

  const isInstagram = platform === 'instagram';
  const isIgToken = isInstagram && accessToken.startsWith('IG');
  const graphBase = isIgToken ? 'https://graph.instagram.com/v24.0' : 'https://graph.facebook.com/v18.0';
  const ownerId = isIgToken ? accountId : tokenRow.page_id || accountId;
  const ownerIds = [
    ownerId,
    tokenRow.id,
    tokenRow.account_id,
    tokenRow.page_id,
    tokenRow.instagram_business_account_id,
    tokenRow.instagram_user_id,
    tokenRow.webhook_instagram_user_id,
  ]
    .filter(Boolean)
    .map(String);
  const ownerNames = new Set(
    [
      String(tokenRow.username || '').toLowerCase().replace(/^@/, ''),
      String(tokenRow.instagram_username || '').toLowerCase().replace(/^@/, ''),
      String(tokenRow.account_name || '').toLowerCase().replace(/^@/, ''),
    ].filter(Boolean)
  );

  let data = null;
  try {
    const metaRes = await externalApi.get(`${graphBase}/${conversationId}`, {
      params: {
        fields:
          'participants,messages.limit(50){id,message,created_time,from,to,attachments{id,image_data,file_url,mime_type,name,video_data,title,subtitle,link},shares}',
        access_token: accessToken,
      },
    });
    data = metaRes.data;
  } catch {}

  const participants = data?.participants?.data || [];
  const otherUser =
    participants.find((p) => {
      const pId = String(p.id || '');
      const pName = String(p.username || p.name || '').toLowerCase().replace(/^@/, '');
      if (pId && ownerIds.includes(pId)) return false;
      if (pName && ownerNames.has(pName)) return false;
      return true;
    }) ||
    participants.find((p) => !ownerIds.includes(String(p.id))) ||
    {};

  let otherUsername = otherUser.username;
  let otherName = otherUser.name;
  let otherAvatar = isInstagram ? otherUser.profile_pic || null : otherUser.picture?.data?.url || null;

  if (isInstagram && !otherAvatar && otherUser.id) {
    try {
      const userRes = await externalApi.get(`${graphBase}/${otherUser.id}`, {
        params: { fields: 'profile_pic,username,name', access_token: accessToken },
      });
      if (userRes.data?.profile_pic) otherAvatar = userRes.data.profile_pic;
      if (userRes.data?.username && (!otherUsername || isGenericName(otherUsername))) otherUsername = userRes.data.username;
      if (userRes.data?.name && (!otherName || isGenericName(otherName))) otherName = userRes.data.name;
    } catch {}
  }

  if ((!otherAvatar || !otherUsername || isGenericName(otherUsername) || isGenericName(otherName)) && (otherUser.id || otherUsername || conversationId)) {
    try {
      let contactQ = supabase.from('contacts').select('profile_picture_url, full_name, username');
      if (otherUser.id) contactQ = contactQ.eq('instagram_user_id', String(otherUser.id));
      else if (conversationId && /^\d+$/.test(conversationId)) contactQ = contactQ.eq('instagram_user_id', String(conversationId));
      else if (otherUsername && !isGenericName(otherUsername)) contactQ = contactQ.eq('username', otherUsername.replace(/^@/, ''));
      const { data: contactRow } = await contactQ.limit(1).maybeSingle();
      if (contactRow) {
        if (contactRow.profile_picture_url && !otherAvatar) otherAvatar = contactRow.profile_picture_url;
        if (contactRow.full_name && isGenericName(otherName)) otherName = contactRow.full_name;
        if (contactRow.username && (!otherUsername || isGenericName(otherUsername))) otherUsername = contactRow.username;
      }
    } catch {}
  }

  let allContactDbMsgs = [];
  try {
    const uHandle = (otherUsername || '').toLowerCase().replace(/^@/, '');
    const uId = otherUser.id ? String(otherUser.id) : conversationId ? String(conversationId) : null;

    let contactQuery = supabase.from('contacts').select('id, username, instagram_user_id');
    if (tokenRow.user_id) contactQuery = contactQuery.eq('user_id', tokenRow.user_id);
    const { data: contacts } = await contactQuery;

    const matchedContacts = (contacts || []).filter(
      (c) =>
        (uId && c.instagram_user_id && String(c.instagram_user_id) === uId) ||
        (uHandle && !isGenericName(uHandle) && c.username && c.username.toLowerCase().replace(/^@/, '') === uHandle)
    );

    if (matchedContacts.length) {
      const { data: dbMsgs } = await supabase
        .from('messages')
        .select('id, contact_id, direction, content, media_url, message_type, created_at')
        .in('contact_id', matchedContacts.map((c) => c.id))
        .order('created_at', { ascending: true });
      allContactDbMsgs = dbMsgs || [];
    }
  } catch {}

  const outboundDbMsgs = allContactDbMsgs.filter((m) => m.direction === 'outbound');
  const chronologicalMessages = [...(data?.messages?.data || [])].reverse();

  let enriched = correlateAndEnrichMessages(
    chronologicalMessages,
    outboundDbMsgs,
    (message) => {
      const mUser = (message.from?.username || message.from?.name || '').toLowerCase().replace(/^@/, '');
      return ownerIds.includes(String(message.from?.id)) || (mUser && ownerNames.has(mUser));
    },
    (isSelf) => (isSelf ? tokenRow.username || tokenRow.account_name || 'You' : otherUsername || otherName || 'User'),
    otherAvatar
  );

  if (enriched.length === 0 && allContactDbMsgs.length > 0) {
    enriched = allContactDbMsgs.map((m) => {
      const isSelf = m.direction === 'outbound';
      let text = m.content || '';
      let imageUrl = m.media_url || null;
      let buttons = [];
      let isInteractiveCard = false;

      if (text.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.elements && Array.isArray(parsed.elements)) {
            const el = parsed.elements[0] || {};
            text = el.title || '';
            if (el.subtitle) text += '\n' + el.subtitle;
            if (!imageUrl && el.image_url) imageUrl = el.image_url;
            if (el.buttons && Array.isArray(el.buttons)) buttons = el.buttons;
            isInteractiveCard = true;
          }
        } catch {}
      }

      if (!imageUrl && text) {
        const imgMatch = text.match(/(https?:\/\/[^\s]+(?:\.(?:png|jpg|jpeg|webp|gif)|res\.cloudinary\.com\/[^\s]+)[^\s]*)/i);
        if (imgMatch) imageUrl = imgMatch[0];
      }

      return {
        id: m.id,
        authorName: isSelf ? tokenRow.username || tokenRow.account_name || 'You' : otherUsername || otherName || 'User',
        authorAvatar: isSelf ? null : otherAvatar,
        text,
        imageUrl,
        videoUrl: null,
        shareUrl: null,
        buttons,
        isInteractiveCard: isInteractiveCard || Boolean(buttons.length || (imageUrl && isSelf)),
        createdAt: m.created_at,
        isSelf,
      };
    });
  }

  return enriched;
}

// ── Express Router Endpoints ───────────────────────────────────────────────

router.get('/inbox/stream', authenticateUser, async (req, res) => {
  try {
    const userIds = [...new Set([req.user.userId, req.user.authUserId].filter(Boolean))];
    const cacheKey = inboxCacheKey(userIds);
    const bypassCache = req.query.refresh === '1';

    if (!bypassCache) {
      const cachedPayload = await readInboxCache(cacheKey);
      if (cachedPayload) {
        res.setHeader('X-Inbox-Cache', 'HIT');
        return res.json(cachedPayload);
      }
    }

    const { data: tokenRows, error: tokenError } = await supabase
      .from('social_tokens')
      .select('id,user_id,provider,account_id,account_name,page_id,username,access_token')
      .in('user_id', userIds);

    if (tokenError) throw new Error(`Failed to query social_tokens: ${tokenError.message}`);

    const { data: igAccounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .in('user_id', userIds)
      .eq('is_connected', true);

    const connectedMap = {};
    (tokenRows || []).forEach((row) => {
      const p = String(row.provider || '').toLowerCase();
      if (!connectedMap[p]) connectedMap[p] = [];
      connectedMap[p].push(row);
    });

    if (igAccounts && igAccounts.length > 0) {
      if (!connectedMap['instagram']) connectedMap['instagram'] = [];
      igAccounts.forEach((acc) => {
        connectedMap['instagram'].push({
          id: acc.id,
          provider: 'instagram',
          account_id: acc.instagram_business_account_id,
          access_token_encrypted: acc.access_token_encrypted,
          username: acc.instagram_username || acc.username,
          account_name: acc.instagram_username || 'Instagram Account',
        });
      });
    }

    const platformStatuses = {
      instagram: { connected: Boolean(connectedMap['instagram']?.length), status: 'idle' },
      facebook: { connected: Boolean(connectedMap['facebook']?.length), status: 'idle' },
      youtube: { connected: Boolean(connectedMap['youtube']?.length || connectedMap['google']?.length), status: 'idle' },
      mastodon: { connected: Boolean(connectedMap['mastodon']?.length), status: 'idle' },
      bluesky: { connected: Boolean(connectedMap['bluesky']?.length), status: 'idle' },
    };

    const fetchPromises = [];
    const promiseMeta = [];

    (connectedMap['youtube'] || connectedMap['google'] || []).forEach((t) => {
      fetchPromises.push(fetchYouTubeComments(t));
      promiseMeta.push('youtube');
    });
    (connectedMap['instagram'] || []).forEach((t) => {
      fetchPromises.push(fetchInstagramComments(t));
      promiseMeta.push('instagram');
    });
    (connectedMap['facebook'] || []).forEach((t) => {
      fetchPromises.push(fetchFacebookComments(t));
      promiseMeta.push('facebook');
    });
    (connectedMap['bluesky'] || []).forEach((t) => {
      fetchPromises.push(fetchBlueskyComments(t));
      promiseMeta.push('bluesky');
    });
    (connectedMap['mastodon'] || []).forEach((t) => {
      fetchPromises.push(fetchMastodonComments(t));
      promiseMeta.push('mastodon');
    });

    const results = await Promise.allSettled(fetchPromises);
    let allItems = [];

    results.forEach((resItem, idx) => {
      const platformKey = promiseMeta[idx];
      if (resItem.status === 'fulfilled') {
        const val = resItem.value;
        if (platformStatuses[platformKey]) {
          platformStatuses[platformKey].status = val.status;
          if (val.error) platformStatuses[platformKey].error = val.error;
        }
        if (val.items) allItems = allItems.concat(val.items);
      } else if (platformStatuses[platformKey]) {
        platformStatuses[platformKey].status = 'error';
        platformStatuses[platformKey].error = resItem.reason?.message || 'Failed to fetch comments';
      }
    });

    const uniqueItemsMap = new Map();
    allItems.forEach((item) => {
      uniqueItemsMap.set(item.id, { ...item, accountConnected: true });
    });
    allItems = Array.from(uniqueItemsMap.values());
    allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const payload = {
      success: true,
      totalLoaded: allItems.length,
      platformStatuses,
      items: allItems,
    };

    await writeInboxCache(cacheKey, payload);
    void persistInboxItems(req.user.userId, allItems).catch(() => {});
    res.setHeader('X-Inbox-Cache', 'MISS');
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to aggregate inbox stream', message: err.message });
  }
});

router.get('/inbox/conversations', authenticateUser, async (req, res) => {
  try {
    const result = await listInboxConversations(req.user.userId, req.query);
    return res.json({ success: true, ...result });
  } catch (error) {
    const missingSchema = error.code === '42P01' || error.code === 'PGRST205';
    return res.status(missingSchema ? 503 : 500).json({
      success: false,
      error: missingSchema ? 'INBOX_SCHEMA_NOT_READY' : 'Failed to load inbox conversations',
    });
  }
});

router.get('/inbox/conversations/:id/messages', authenticateUser, async (req, res) => {
  try {
    const result = await listInboxMessages(req.user.userId, req.params.id, req.query);
    return res.json({ success: true, ...result });
  } catch (error) {
    const missingSchema = error.code === '42P01' || error.code === 'PGRST205';
    return res.status(missingSchema ? 503 : 500).json({
      success: false,
      error: missingSchema ? 'INBOX_SCHEMA_NOT_READY' : 'Failed to load inbox messages',
    });
  }
});

const handleMarkRead = async (req, res) => {
  try {
    const conversation = await markInboxConversationRead(req.user.userId, req.params.id);
    return res.json({ success: true, conversation });
  } catch {
    return res.status(500).json({ success: false, error: 'Failed to mark conversation as read' });
  }
};

router.patch('/inbox/conversations/:id/read', authenticateUser, handleMarkRead);
router.post('/inbox/conversations/:id/read', authenticateUser, handleMarkRead);

const handleThreadFetch = async (req, res) => {
  try {
    const platform = req.params.platform || req.query.platform;
    const conversationId = req.params.conversationId || req.query.conversationId;
    const accountId = req.query.accountId;
    const userIds = [...new Set([req.user.userId, req.user.authUserId].filter(Boolean))];

    if (!platform || !conversationId) {
      return res.status(400).json({ success: false, error: 'Missing platform or conversationId' });
    }

    if (platform === 'instagram') {
      const [{ data: igAccounts }, { data: tokenRows }] = await Promise.all([
        supabase.from('instagram_accounts').select('*').in('user_id', userIds),
        supabase.from('social_tokens').select('id,user_id,provider,account_id,account_name,page_id,username,access_token').in('user_id', userIds).eq('provider', 'instagram'),
      ]);

      const candidateAccounts = [
        ...(igAccounts || []).map((a) => ({
          ...a,
          account_id: a.instagram_business_account_id || a.id,
          access_token: a.access_token_encrypted || a.access_token,
        })),
        ...(tokenRows || []),
      ];

      if (!candidateAccounts.length) {
        return res.status(404).json({ success: false, error: 'No connected Instagram account found' });
      }

      const accIdStr = String(accountId || '').toLowerCase();
      const primaryToken =
        candidateAccounts.find(
          (a) =>
            (a.id && String(a.id).toLowerCase() === accIdStr) ||
            (a.account_id && String(a.account_id).toLowerCase() === accIdStr) ||
            (a.username && String(a.username).toLowerCase().replace(/^@/, '') === accIdStr.replace(/^@/, '')) ||
            (a.instagram_username && String(a.instagram_username).toLowerCase().replace(/^@/, '') === accIdStr.replace(/^@/, '')) ||
            (a.account_name && String(a.account_name).toLowerCase().replace(/^@/, '') === accIdStr.replace(/^@/, ''))
        ) || candidateAccounts[0];

      let replies = [];
      let usedToken = primaryToken;

      try {
        replies = await fetchMetaThread(primaryToken, 'instagram', conversationId);
      } catch {
        for (const alt of candidateAccounts) {
          if (alt === primaryToken) continue;
          try {
            const altReplies = await fetchMetaThread(alt, 'instagram', conversationId);
            if (altReplies?.length) {
              replies = altReplies;
              usedToken = alt;
              break;
            }
          } catch {}
        }
      }

      if (replies.length > 0) {
        void persistInboxThreadMessages(req.user.userId, 'instagram', usedToken.account_id || usedToken.id, conversationId, replies).catch(() => {});
      }

      return res.json({ success: true, replies });
    }

    if (platform === 'facebook') {
      const { data: fbAccounts } = await supabase
        .from('social_tokens')
        .select('id,user_id,provider,account_id,account_name,page_id,username,access_token')
        .in('user_id', userIds)
        .eq('provider', 'facebook')
        .limit(1);

      if (!fbAccounts?.length) {
        return res.status(404).json({ success: false, error: 'No connected Facebook account found' });
      }

      const replies = await fetchMetaThread(fbAccounts[0], 'facebook', conversationId);
      void persistInboxThreadMessages(req.user.userId, 'facebook', fbAccounts[0].page_id || fbAccounts[0].account_id, conversationId, replies).catch(() => {});
      return res.json({ success: true, replies });
    }

    return res.status(400).json({ success: false, error: `Thread loading not supported for ${platform}` });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

router.get('/inbox/thread', authenticateUser, handleThreadFetch);
router.get('/inbox/threads/:platform/:conversationId', authenticateUser, handleThreadFetch);

router.get('/inbox/avatar-proxy', async (req, res) => {
  try {
    const rawUrl = req.query.url;
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) {
      return res.status(400).send('Invalid URL');
    }
    const parsed = new URL(rawUrl);
    const allowedHosts = ['cdninstagram.com', 'fbcdn.net', 'facebook.com', 'instagram.com', 'ggpht.com', 'googleusercontent.com', 'ytimg.com', 'cloudinary.com', 'pravatar.cc'];
    const isAllowed = allowedHosts.some((h) => parsed.hostname.endsWith(h));
    if (!isAllowed) {
      return res.status(403).send('Host not allowed');
    }

    const imgRes = await axios.get(rawUrl, {
      responseType: 'arraybuffer',
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    res.setHeader('Content-Type', imgRes.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.send(Buffer.from(imgRes.data));
  } catch {
    return res.status(404).send('Image unavailable');
  }
});

router.post('/inbox/reply', authenticateUser, async (req, res) => {
  try {
    const { platform, accountId, commentId, text, recipientId: requestedRecipientId } = req.body || {};

    if (!platform || !commentId || !text || !text.trim()) {
      return res.status(400).json({ success: false, error: 'INVALID_PAYLOAD', message: 'Missing required parameters (platform, commentId, text)' });
    }

    const userIds = [...new Set([req.user.userId, req.user.authUserId, req.user.id].filter(Boolean))];
    let accessToken = null;
    let instanceUrl = null;

    if (platform === 'instagram') {
      const { data: igAccs } = await supabase.from('instagram_accounts').select('*').in('user_id', userIds);
      const matchingAccount = (igAccs || []).find((a) => accountId && (a.instagram_business_account_id === accountId || a.id === accountId || a.page_id === accountId)) || (igAccs && igAccs[0]);

      if (matchingAccount) {
        if (matchingAccount.is_connected === false || matchingAccount.token_status === 'disconnected') {
          return res.status(403).json({
            success: false,
            error: 'ACCOUNT_DISCONNECTED',
            message: `Instagram account @${matchingAccount.instagram_username || 'this account'} is disconnected. Please reconnect.`,
          });
        }
        accessToken = safeDecrypt(matchingAccount.access_token_encrypted || matchingAccount.access_token);
      }

      if (!accessToken) {
        const { data: sTokens } = await supabase.from('social_tokens').select('access_token').in('user_id', userIds).eq('provider', 'instagram');
        if (sTokens && sTokens.length > 0) accessToken = safeDecrypt(sTokens[0].access_token);
      }
    } else {
      const { data: sTokens } = await supabase.from('social_tokens').select('access_token,provider,instance_url,account_id,page_id').in('user_id', userIds);
      const targetLower = String(platform).toLowerCase();
      const matchedRow = (sTokens || []).find((r) => {
        const p = String(r.provider || '').toLowerCase();
        const matchesPlatform = targetLower === 'youtube' ? p === 'youtube' || p === 'google' : p === targetLower;
        if (!matchesPlatform) return false;
        return accountId ? String(r.account_id) === String(accountId) || String(r.page_id) === String(accountId) : true;
      });

      if (matchedRow) {
        accessToken = safeDecrypt(matchedRow.access_token);
        instanceUrl = matchedRow.instance_url;
      }
    }

    if (!accessToken) {
      const targetLower = String(platform).toLowerCase();
      for (const uid of userIds) {
        try {
          const userTokens = await getTokensForUser(uid);
          const tokObj = userTokens?.[targetLower] || userTokens?.google || userTokens?.youtube;
          if (tokObj) {
            accessToken = safeDecrypt(tokObj.accessToken || tokObj.access_token || tokObj);
            if (accessToken) break;
          }
        } catch {}
      }
    }

    if (!accessToken) {
      return res.status(403).json({ success: false, error: 'ACCOUNT_DISCONNECTED', message: `This ${platform} account is disconnected.` });
    }

    let replyId = `reply_${Date.now()}`;
    let rawTokenStr = typeof accessToken === 'string' ? accessToken : accessToken?.pageAccessToken || accessToken?.userAccessToken || accessToken?.accessToken;

    if (typeof rawTokenStr === 'string' && rawTokenStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawTokenStr);
        rawTokenStr = parsed.pageAccessToken || parsed.userAccessToken || parsed.accessToken || rawTokenStr;
      } catch {}
    }

    if (platform === 'youtube') {
      try {
        const freshYtToken = await googleOAuth.getValidAccessToken(req.user.userId, accountId);
        if (freshYtToken) rawTokenStr = freshYtToken;
      } catch {}
      await axios.post('https://www.googleapis.com/youtube/v3/comments', {
        snippet: { parentId: commentId, textOriginal: text },
      }, {
        params: { part: 'snippet' },
        headers: { Authorization: `Bearer ${rawTokenStr}` },
      });
    } else if (platform === 'instagram') {
      const isIgToken = rawTokenStr.startsWith('IG');
      const graphBase = isIgToken ? 'https://graph.instagram.com/v24.0' : 'https://graph.facebook.com/v18.0';

      let recipientId = requestedRecipientId || null;
      let igBusinessId = null;

      if (!recipientId) {
        const convRes = await axios.get(`${graphBase}/${commentId}`, {
          params: { fields: 'participants', access_token: rawTokenStr, locale: 'en_US' },
        });
        const participants = convRes.data?.participants?.data || [];
        const myIds = [String(accountId)];

        try {
          const fields = isIgToken ? 'id,username' : 'id,instagram_business_account{username}';
          const meRes = await axios.get(`${graphBase}/me?fields=${fields}`, { params: { access_token: rawTokenStr } });
          if (meRes.data?.id) myIds.push(String(meRes.data.id));
          if (meRes.data?.instagram_business_account?.id) {
            myIds.push(String(meRes.data.instagram_business_account.id));
            igBusinessId = String(meRes.data.instagram_business_account.id);
          }
        } catch {}

        const recipient = participants.find((p) => !myIds.includes(String(p.id))) || participants[0];
        if (recipient) recipientId = recipient.id;
      }

      if (!recipientId) {
        return res.status(400).json({ success: false, message: 'Cannot determine recipient ID for Instagram reply.' });
      }

      try {
        const endpointId = isIgToken ? 'me' : igBusinessId || accountId;
        const resp = await axios.post(`${graphBase}/${endpointId}/messages`, {
          recipient: { id: recipientId },
          message: { text },
        }, {
          params: { access_token: rawTokenStr, locale: 'en_US' },
        });
        replyId = resp.data?.message_id || resp.data?.id || replyId;
      } catch (err) {
        const errObj = err.response?.data?.error || {};
        const isWindow = errObj.code === 10 || errObj.error_subcode === 2018278 || /outside.*allow.*window/i.test(errObj.message || '') || /24-hour/i.test(errObj.message || '');
        if (isWindow) {
          return res.status(400).json({
            success: false,
            code: 'OUTSIDE_24H_WINDOW',
            message: 'Meta 24-Hour Policy: Replies can only be sent within 24 hours of the user\'s last message.',
          });
        }
        return res.status(400).json({ success: false, message: err.response?.data?.error?.message || err.message });
      }
    } else if (platform === 'facebook') {
      const graphBase = 'https://graph.facebook.com/v18.0';
      const resp = await axios.post(`${graphBase}/${commentId}/messages`, { message: text }, { params: { access_token: rawTokenStr } });
      replyId = resp.data?.message_id || resp.data?.id || replyId;
    } else if (platform === 'mastodon') {
      const mUrl = instanceUrl || 'https://mastodon.social';
      const mRes = await axios.post(`${mUrl}/api/v1/statuses`, { status: text, in_reply_to_id: commentId }, { headers: { Authorization: `Bearer ${rawTokenStr}` } });
      replyId = mRes.data?.id || replyId;
    }

    await recordInboxOutboundMessage(req.user.userId, {
      platform,
      accountId,
      conversationId: commentId,
      externalConversationId: requestedRecipientId || commentId,
      messageId: replyId,
      text,
    }).catch(() => {});

    await invalidateInboxCache(userIds);
    return res.json({ success: true, replyId, platform, commentId, timestamp: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'REPLY_FAILED', message: err.response?.data?.error?.message || err.message });
  }
});

router.post('/inbox/copilot', authenticateUser, async (req, res) => {
  try {
    const { commentText, style = 'friendly' } = req.body || {};
    if (!commentText) return res.status(400).json({ success: false, error: 'Missing commentText' });

    let suggestion = 'Thanks for reaching out! 🙌';
    const textLower = commentText.toLowerCase();

    if (style === 'friendly') {
      if (textLower.includes('camera') || textLower.includes('lens') || textLower.includes('gear')) {
        suggestion = 'Thanks so much! We shot this using a prime lens with natural lighting. Appreciate the support! 📸';
      } else if (textLower.includes('love') || textLower.includes('stunning') || textLower.includes('amazing')) {
        suggestion = 'Thank you so much! Really glad you liked this post! ❤️';
      } else {
        suggestion = 'Thanks for dropping by and sharing your thoughts! Appreciate you! 🙌';
      }
    } else if (style === 'professional') {
      suggestion = 'Thank you for your feedback. We appreciate your interest and would be glad to provide further details upon request.';
    } else {
      suggestion = 'Thank you! 🙏';
    }

    return res.json({ success: true, suggestion, style });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
