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
let lastIgError = null;
let lastIgDebug = null;

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

async function invalidateInboxCache(userIds) {
  try {
    await getInboxRedis()?.del(inboxCacheKey(userIds));
  } catch {}
}

/**
 * Universal Social Inbox Backend Aggregator & Reply Engine
 * 
 * Architecture Rules:
 * 1. Stateless: NO permanent comments table in PostgreSQL.
 * 2. Scoped to req.user.userId / req.user.authUserId strictly.
 * 3. Platform Isolation: Failures in one API never break the others.
 */

// Helper to safely decrypt tokens from social_tokens & instagram_accounts tables
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
    } catch { }
  }
  return decrypted;
}

function getMockConversations(platform, accountId, accountName) {
  return [
    {
      id: `mock:${platform}:1`,
      platform: platform,
      accountId: accountId,
      accountName: accountName,
      postId: null,
      postTitle: null,
      postThumbnail: null,
      commentId: `conv_${platform}_1`,
      topLevelCommentId: `conv_${platform}_1`,
      authorName: 'Jane Doe',
      authorAvatar: 'https://i.pravatar.cc/150?u=jane',
      authorHandle: '@janedoe',
      text: 'Hey! Are you guys open this weekend?',
      createdAt: new Date().toISOString(),
      replied: false,
      starred: false,
      unread: true,
      replyCount: 1,
      replies: [
        {
          id: 'msg_1',
          authorName: 'Jane Doe',
          authorAvatar: 'https://i.pravatar.cc/150?u=jane',
          text: 'Hey! Are you guys open this weekend?',
          createdAt: new Date().toISOString(),
          isSelf: false
        }
      ]
    },
    {
      id: `mock:${platform}:2`,
      platform: platform,
      accountId: accountId,
      accountName: accountName,
      postId: null,
      postTitle: null,
      postThumbnail: null,
      commentId: `conv_${platform}_2`,
      topLevelCommentId: `conv_${platform}_2`,
      authorName: 'Alex Carter',
      authorAvatar: 'https://i.pravatar.cc/150?u=alex',
      authorHandle: '@alexcarter',
      text: 'Got it, thank you!',
      createdAt: new Date(Date.now() - 3600000).toISOString(),
      replied: true,
      starred: true,
      unread: false,
      replyCount: 2,
      replies: [
        {
          id: 'msg_2',
          authorName: 'Alex Carter',
          authorAvatar: 'https://i.pravatar.cc/150?u=alex',
          text: 'Can I get a custom quote for 5 videos?',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
          isSelf: false
        },
        {
          id: 'msg_3',
          authorName: 'Account Owner',
          authorAvatar: null,
          text: 'Yes! We just sent you an email with the brochure.',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          isSelf: true
        }
      ]
    }
  ];
}

// ── Platform-Specific On-Demand Fetchers ────────────────────────────────────

export async function fetchYouTubeComments(tokenRow) {
  try {
    let accessToken = null;
    try {
      accessToken = await googleOAuth.getValidAccessToken(tokenRow.user_id, tokenRow.account_id);
    } catch (e) {
      accessToken = safeDecrypt(tokenRow.access_token);
    }
    if (!accessToken) return { status: 'error', error: 'Missing access token', items: [] };

    // Fetch user's channel ID
    const channelRes = await externalApi.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'snippet,contentDetails', mine: true },
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const channelItem = channelRes.data?.items?.[0];
    if (!channelItem) return { status: 'ok', items: [] };

    const channelId = channelItem.id;
    const channelTitle = channelItem.snippet?.title || 'YouTube Channel';

    // Query channel-wide comment threads directly via allThreadsRelatedToChannelId
    const commentsRes = await externalApi.get('https://www.googleapis.com/youtube/v3/commentThreads', {
      params: { part: 'snippet,replies', allThreadsRelatedToChannelId: channelId, maxResults: 25, textFormat: 'plainText' },
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const threads = commentsRes.data?.items || [];
    const videoIds = [...new Set(threads.map(t => t.snippet?.topLevelComment?.snippet?.videoId).filter(Boolean))];
    const videoMap = {};

    if (videoIds.length > 0) {
      try {
        const videoRes = await externalApi.get('https://www.googleapis.com/youtube/v3/videos', {
          params: { part: 'snippet', id: videoIds.join(',') },
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        for (const v of videoRes.data?.items || []) {
          const snip = v.snippet;
          const thumbs = snip?.thumbnails || {};
          videoMap[v.id] = {
            title: snip?.title || 'YouTube Video',
            thumbnail: thumbs.maxres?.url || thumbs.standard?.url || thumbs.high?.url || thumbs.medium?.url || thumbs.default?.url || `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`
          };
        }
      } catch (vErr) {
        console.warn('⚠️ [INBOX-YT] Failed to batch fetch video details:', vErr.message);
      }
    }

    const commentItems = [];
    for (const thread of threads) {
      const top = thread.snippet?.topLevelComment?.snippet;
      if (!top) continue;

      const authorChannelId = top.authorChannelId?.value;
      // Filter out comments posted by the channel owner itself
      if (authorChannelId && authorChannelId === channelId) {
        continue;
      }

      const childReplies = thread.replies?.comments || [];
      const hasOwnerReplied = childReplies.some(r => r.snippet?.authorChannelId?.value === channelId) || childReplies.length > 0;
      const vInfo = top.videoId ? videoMap[top.videoId] : null;
      const fallbackPostThumb = channelItem.snippet?.thumbnails?.high?.url || channelItem.snippet?.thumbnails?.medium?.url || channelItem.snippet?.thumbnails?.default?.url;

      commentItems.push({
        id: `yt:${thread.id}`,
        platform: 'youtube',
        accountId: tokenRow.account_id || channelId,
        accountName: channelTitle,
        postId: top.videoId || channelId,
        postTitle: vInfo?.title || (top.videoId ? `YouTube Video (${top.videoId})` : channelTitle),
        postThumbnail: vInfo?.thumbnail || (top.videoId ? `https://i.ytimg.com/vi/${top.videoId}/hqdefault.jpg` : fallbackPostThumb),
        commentId: thread.id,
        topLevelCommentId: thread.id,
        authorName: top.authorDisplayName || 'YouTube User',
        authorAvatar: top.authorProfileImageUrl || null,
        authorHandle: top.authorDisplayName ? (top.authorDisplayName.startsWith('@') ? top.authorDisplayName : `@${top.authorDisplayName}`) : '@user',
        text: top.textDisplay || '',
        createdAt: top.publishedAt || new Date().toISOString(),
        replied: hasOwnerReplied,
        starred: false,
        unread: false,
        replyCount: thread.snippet?.totalReplyCount || childReplies.length,
        replies: childReplies.map(r => ({
          id: r.id,
          authorName: r.snippet?.authorDisplayName,
          authorAvatar: r.snippet?.authorProfileImageUrl,
          text: r.snippet?.textDisplay,
          createdAt: r.snippet?.publishedAt
        }))
      });
    }

    return { status: 'ok', items: commentItems };
  } catch (err) {
    console.error(`❌ [INBOX-YT] Failed for account ${tokenRow.account_id || tokenRow.username || 'unknown'} (User: ${tokenRow.user_id}):`, err.response?.data?.error?.message || err.message);
    return { status: 'error', error: err.response?.data?.error?.message || err.message, items: [] };
  }
}

export async function fetchInstagramComments(tokenRow) {
  try {
    const accessToken = safeDecrypt(tokenRow.access_token || tokenRow.access_token_encrypted);
    const businessId = tokenRow.account_id || tokenRow.page_id || tokenRow.instagram_business_account_id;
    if (!accessToken || !businessId) return { status: 'error', error: 'Missing Instagram Business credentials', items: [] };

    const isIgToken = accessToken.startsWith('IG');
    const graphBase = isIgToken ? 'https://graph.instagram.com/v24.0' : 'https://graph.facebook.com/v18.0';
    const queryId = isIgToken ? businessId : (tokenRow.page_id || businessId);
    
    const convRes = await externalApi.get(`${graphBase}/${queryId}/conversations`, {
      params: {
        platform: 'instagram',
        fields: 'id,updated_time,participants,messages.limit(1){id,message,created_time,from,to}',
        limit: 20,
        access_token: accessToken
      }
    });

    const conversations = convRes.data?.data || [];
    let conversationItems = [];

    const myUsername = (tokenRow.username || tokenRow.account_name || '').toLowerCase();
    
    await Promise.all(conversations.map(async (conv) => {
      const messages = conv.messages?.data || [];
      const participants = conv.participants?.data || [];
      const otherUser = participants.find(p => (p.username || p.name || '').toLowerCase() !== myUsername && String(p.id) !== String(queryId)) || participants[0] || {};
      
      const fetchedAvatar = otherUser.profile_pic || null;

      const lastMessage = messages[0] || {};
      const hasReplied = String(lastMessage.from?.id) === String(queryId) || (lastMessage.from?.username || '').toLowerCase() === myUsername;

      conversationItems.push({
        id: `ig:${conv.id}`,
        externalConversationId: otherUser.id || conv.id,
        replyRecipientId: otherUser.id || null,
        platform: 'instagram',
        accountId: queryId,
        accountName: tokenRow.username || tokenRow.account_name || 'Instagram Account',
        postId: null,
        postTitle: null,
        postThumbnail: null,
        commentId: conv.id,
        topLevelCommentId: conv.id,
        authorName: otherUser.username || otherUser.name || 'Instagram User',
        authorAvatar: fetchedAvatar, 
        authorHandle: otherUser.username ? `@${otherUser.username}` : '',
        text: lastMessage.message || '',
        createdAt: lastMessage.created_time || conv.updated_time,
        replied: hasReplied,
        starred: false,
        unread: !hasReplied,
        replyCount: messages.length,
        replies: messages.map(m => ({
          id: m.id,
          authorName: (String(m.from?.id) === String(queryId) || (m.from?.username || '').toLowerCase() === myUsername) ? (tokenRow.username || 'You') : (otherUser.username || otherUser.name),
          authorAvatar: fetchedAvatar,
          text: m.message,
          createdAt: m.created_time,
          isSelf: String(m.from?.id) === String(queryId) || (m.from?.username || '').toLowerCase() === myUsername
        })).reverse()
      });
    }));

    // Sort by most recent message
    conversationItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return { status: 'ok', items: conversationItems };
  } catch (err) {
    console.error(`❌ [INBOX-IG] Failed for @${tokenRow.username || tokenRow.account_id || 'unknown'} (User: ${tokenRow.user_id}):`, err.response?.data?.error?.message || err.message);
    return { status: 'error', error: err.response?.data?.error?.message || err.message, items: [] };
  }
}

export async function fetchBlueskyComments(tokenRow) {
  try {
    const handle = tokenRow.account_id || tokenRow.username;
    const pass = safeDecrypt(tokenRow.access_token);
    if (!handle) return { status: 'error', error: 'Missing Bluesky handle', items: [] };

    // Public feed fetch for Bluesky handle via bsky.app public API
    const res = await externalApi.get('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed', {
      params: { actor: handle, limit: 5 }
    });

    const feed = res.data?.feed || [];
    const commentItems = [];

    for (const item of feed) {
      const post = item.post;
      if (!post || !post.replyCount) continue;

      try {
        const threadRes = await externalApi.get('https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread', {
          params: { uri: post.uri, depth: 1 }
        });

        const replies = threadRes.data?.thread?.replies || [];
        for (const replyNode of replies) {
          const replyPost = replyNode.post;
          if (!replyPost) continue;

          commentItems.push({
            id: `bsky:${replyPost.cid || replyPost.uri}`,
            platform: 'bluesky',
            accountId: handle,
            accountName: `@${handle}`,
            postId: post.uri,
            postTitle: post.record?.text || 'Bluesky Post',
            postThumbnail: post.embed?.images?.[0]?.thumb || null,
            commentId: replyPost.uri,
            topLevelCommentId: replyPost.uri,
            authorName: replyPost.author?.displayName || replyPost.author?.handle,
            authorAvatar: replyPost.author?.avatar || null,
            authorHandle: `@${replyPost.author?.handle}`,
            text: replyPost.record?.text || '',
            createdAt: replyPost.indexedAt || new Date().toISOString(),
            replied: false,
            starred: false,
            unread: false,
            replyCount: replyPost.replyCount || 0,
            replies: []
          });
        }
      } catch (tErr) {
        console.warn(`[INBOX-BSKY] Thread ${post.uri} error:`, tErr.message);
      }
    }

    return { status: 'ok', items: commentItems };
  } catch (err) {
    console.error(`❌ [INBOX-BSKY] Failed for @${tokenRow.username || tokenRow.account_id || 'unknown'} (User: ${tokenRow.user_id}):`, err.message);
    return { status: 'error', error: err.message, items: [] };
  }
}

export async function fetchMastodonComments(tokenRow) {
  try {
    const accessToken = safeDecrypt(tokenRow.access_token);
    const instanceUrl = tokenRow.instance_url || 'https://mastodon.social';
    if (!accessToken) return { status: 'error', error: 'Missing Mastodon token', items: [] };

    // Fetch user notifications for mentions / replies
    const notifRes = await externalApi.get(`${instanceUrl}/api/v1/notifications`, {
      params: { types: ['mention', 'status'], limit: 10 },
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const notifs = notifRes.data || [];
    const commentItems = [];

    for (const n of notifs) {
      const status = n.status;
      if (!status) continue;

      commentItems.push({
        id: `masto:${status.id}`,
        platform: 'mastodon',
        accountId: tokenRow.account_id || 'mastodon_user',
        accountName: tokenRow.account_name || 'Mastodon Account',
        postId: status.in_reply_to_id || status.id,
        postTitle: 'Mastodon Toot',
        postThumbnail: status.media_attachments?.[0]?.preview_url || null,
        commentId: status.id,
        topLevelCommentId: status.id,
        authorName: status.account?.display_name || status.account?.username,
        authorAvatar: status.account?.avatar || null,
        authorHandle: `@${status.account?.acct}`,
        text: (status.content || '').replace(/<[^>]*>?/gm, ''), // strip HTML tags
        createdAt: status.created_at || new Date().toISOString(),
        replied: false,
        starred: false,
        unread: !n.read,
        replyCount: status.replies_count || 0,
        replies: []
      });
    }

    return { status: 'ok', items: commentItems };
  } catch (err) {
    console.error(`❌ [INBOX-MASTO] Failed for @${tokenRow.username || tokenRow.account_id || 'unknown'} (User: ${tokenRow.user_id}):`, err.message);
    return { status: 'error', error: err.message, items: [] };
  }
}

export async function fetchFacebookComments(tokenRow) {
  try {
    const accessToken = safeDecrypt(tokenRow.access_token);
    const pageId = tokenRow.page_id || tokenRow.account_id;
    if (!accessToken || !pageId) return { status: 'error', error: 'Missing Facebook Page credentials', items: [] };

    const convRes = await externalApi.get(`https://graph.facebook.com/v18.0/${pageId}/conversations`, {
      params: {
        platform: 'messenger',
        fields: 'id,updated_time,participants,messages.limit(1){id,message,created_time,from,to}',
        limit: 20,
        access_token: accessToken
      }
    });

    const conversations = convRes.data?.data || [];
    let conversationItems = [];

    const myUsername = (tokenRow.username || tokenRow.account_name || 'Facebook Page').toLowerCase();
    
    await Promise.all(conversations.map(async (conv) => {
      const messages = conv.messages?.data || [];
      const participants = conv.participants?.data || [];
      const otherUser = participants.find(p => (p.name || '').toLowerCase() !== myUsername && String(p.id) !== String(pageId)) || participants[0] || {};
      
      const fetchedAvatar = otherUser.picture?.data?.url || null;

      const lastMessage = messages[0] || {};
      const hasReplied = String(lastMessage.from?.id) === String(pageId) || (lastMessage.from?.name || '').toLowerCase() === myUsername;

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
        replies: messages.map(m => ({
          id: m.id,
          authorName: (String(m.from?.id) === String(pageId) || (m.from?.name || '').toLowerCase() === myUsername) ? (tokenRow.username || 'You') : (otherUser.name || 'User'),
          authorAvatar: fetchedAvatar,
          text: m.message,
          createdAt: m.created_time,
          isSelf: String(m.from?.id) === String(pageId) || (m.from?.name || '').toLowerCase() === myUsername
        })).reverse()
      });
    }));

    // Sort by most recent message
    conversationItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return { status: 'ok', items: conversationItems };
  } catch (err) {
    console.error(`❌ [INBOX-FB] Failed for @${tokenRow.username || tokenRow.account_id || 'unknown'} (User: ${tokenRow.user_id}):`, err.message);
    return { status: 'error', error: err.response?.data?.error?.message || err.message, items: [] };
  }
}

async function fetchMetaThread(tokenRow, platform, conversationId) {
  const accessToken = safeDecrypt(tokenRow.access_token || tokenRow.access_token_encrypted);
  const accountId = tokenRow.account_id || tokenRow.page_id || tokenRow.instagram_business_account_id;
  if (!accessToken || !accountId) throw new Error(`Missing ${platform} credentials`);

  const isInstagram = platform === 'instagram';
  const isIgToken = isInstagram && accessToken.startsWith('IG');
  const graphBase = isIgToken
    ? 'https://graph.instagram.com/v24.0'
    : 'https://graph.facebook.com/v18.0';
  const ownerId = isIgToken ? accountId : (tokenRow.page_id || accountId);
  const ownerName = String(tokenRow.username || tokenRow.account_name || '').toLowerCase();
  const { data } = await externalApi.get(`${graphBase}/${conversationId}`, {
    params: {
      fields: 'participants,messages.limit(50){id,message,created_time,from,to}',
      access_token: accessToken,
    },
  });

  const participants = data?.participants?.data || [];
  const otherUser = participants.find((participant) =>
    String(participant.id) !== String(ownerId) &&
    String(participant.username || participant.name || '').toLowerCase() !== ownerName
  ) || participants[0] || {};

  return (data?.messages?.data || []).map((message) => {
    const isSelf = String(message.from?.id) === String(ownerId) ||
      String(message.from?.username || message.from?.name || '').toLowerCase() === ownerName;
    return {
      id: message.id,
      authorName: isSelf ? (tokenRow.username || tokenRow.account_name || 'You') : (otherUser.username || otherUser.name || 'User'),
      authorAvatar: isInstagram ? otherUser.profile_pic || null : otherUser.picture?.data?.url || null,
      text: message.message || '',
      createdAt: message.created_time,
      isSelf,
    };
  }).reverse();
}

// ── GET /api/inbox/stream ───────────────────────────────────────────────────

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

    // Fetch connected accounts from social_tokens strictly scoped to req.user
    const { data: tokenRows, error: tokenError } = await supabase
      .from('social_tokens')
      .select('id,user_id,provider,account_id,account_name,page_id,username,access_token')
      .in('user_id', userIds);

    if (tokenError) {
      throw new Error(`Failed to query social_tokens: ${tokenError.message}`);
    }

    // Also fetch connected accounts from instagram_accounts
    const { data: igAccounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .in('user_id', userIds)
      .eq('is_connected', true);

    const connectedMap = {};
    (tokenRows || []).forEach(row => {
      const p = String(row.provider || '').toLowerCase();
      if (!connectedMap[p]) connectedMap[p] = [];
      connectedMap[p].push(row);
    });

    if (igAccounts && igAccounts.length > 0) {
      if (!connectedMap['instagram']) connectedMap['instagram'] = [];
      igAccounts.forEach(acc => {
        connectedMap['instagram'].push({
          id: acc.id,
          provider: 'instagram',
          account_id: acc.instagram_business_account_id,
          access_token_encrypted: acc.access_token_encrypted,
          username: acc.instagram_username || acc.username,
          account_name: acc.instagram_username || 'Instagram Account'
        });
      });
    }

    const platformStatuses = {
      instagram: { connected: Boolean(connectedMap['instagram']?.length), status: 'idle' },
      facebook: { connected: Boolean(connectedMap['facebook']?.length), status: 'idle' },
      linkedin: { connected: Boolean(connectedMap['linkedin']?.length), status: 'idle' },
      threads: { connected: Boolean(connectedMap['threads']?.length), status: 'idle' },
      bluesky: { connected: Boolean(connectedMap['bluesky']?.length), status: 'idle' },
      x: { connected: Boolean(connectedMap['x']?.length), status: 'idle' },
      googleBusiness: { connected: Boolean(connectedMap['googlebusiness']?.length || connectedMap['google_business']?.length), status: 'idle' },
      youtube: { connected: Boolean(connectedMap['youtube']?.length || connectedMap['google']?.length), status: 'idle' },
      mastodon: { connected: Boolean(connectedMap['mastodon']?.length), status: 'idle' },
    };

    // Execute API adapters concurrently with Promise.allSettled for complete platform isolation
    const fetchPromises = [];
    const promiseMeta = [];

    (connectedMap['youtube'] || connectedMap['google'] || []).forEach(tokenRow => {
      fetchPromises.push(fetchYouTubeComments(tokenRow));
      promiseMeta.push('youtube');
    });

    (connectedMap['instagram'] || []).forEach(tokenRow => {
      fetchPromises.push(fetchInstagramComments(tokenRow));
      promiseMeta.push('instagram');
    });

    (connectedMap['facebook'] || []).forEach(tokenRow => {
      fetchPromises.push(fetchFacebookComments(tokenRow));
      promiseMeta.push('facebook');
    });

    (connectedMap['bluesky'] || []).forEach(tokenRow => {
      fetchPromises.push(fetchBlueskyComments(tokenRow));
      promiseMeta.push('bluesky');
    });

    (connectedMap['mastodon'] || []).forEach(tokenRow => {
      fetchPromises.push(fetchMastodonComments(tokenRow));
      promiseMeta.push('mastodon');
    });

    const results = await Promise.allSettled(fetchPromises);
    let allItems = [];

    results.forEach((resItem, idx) => {
      const platformKey = promiseMeta[idx];
      if (resItem.status === 'fulfilled') {
        const val = resItem.value;
        platformStatuses[platformKey].status = val.status;
        if (val.error) platformStatuses[platformKey].error = val.error;
        if (val.items) allItems = allItems.concat(val.items);
      } else {
        platformStatuses[platformKey].status = 'error';
        platformStatuses[platformKey].error = resItem.reason?.message || 'Failed to fetch comments';
      }
    });

    // Deduplicate items by ID (prevents the same profile/chat from showing twice)
    const uniqueItemsMap = new Map();
    allItems.forEach(item => {
      uniqueItemsMap.set(item.id, item);
    });
    allItems = Array.from(uniqueItemsMap.values());

    // Sort items by createdAt descending (newest first)
    allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const payload = {
      success: true,
      totalLoaded: allItems.length,
      platformStatuses,
      items: allItems
    };
    await writeInboxCache(cacheKey, payload);
    void persistInboxItems(req.user.userId, allItems).catch((error) => {
      console.warn('[INBOX] Could not persist legacy aggregation:', error.message);
    });
    res.setHeader('X-Inbox-Cache', 'MISS');
    return res.json(payload);

  } catch (err) {
    console.error('❌ [INBOX-STREAM] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to aggregate inbox stream',
      message: err.message
    });
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
    return res.status(500).json({ success: false, error: 'Failed to load inbox messages' });
  }
});

router.post('/inbox/conversations/:id/read', authenticateUser, async (req, res) => {
  try {
    const conversation = await markInboxConversationRead(req.user.userId, req.params.id);
    return res.json({ success: true, conversation });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to mark conversation read' });
  }
});

router.get('/inbox/thread', authenticateUser, async (req, res) => {
  try {
    const platform = String(req.query.platform || '').toLowerCase();
    const conversationId = String(req.query.conversationId || '');
    const externalConversationId = String(req.query.externalConversationId || conversationId);
    const accountId = String(req.query.accountId || '');
    if (!['instagram', 'facebook'].includes(platform) || !conversationId || !accountId) {
      return res.status(400).json({ success: false, error: 'Valid platform, conversationId, and accountId are required' });
    }

    const userIds = [...new Set([req.user.userId, req.user.authUserId].filter(Boolean))];
    const { data: tokenRows, error: tokenError } = await supabase
      .from('social_tokens')
      .select('user_id,provider,account_id,account_name,page_id,username,access_token')
      .in('user_id', userIds);
    if (tokenError) throw tokenError;

    let candidates = (tokenRows || []).filter((row) => String(row.provider || '').toLowerCase() === platform);
    if (platform === 'instagram') {
      const { data: instagramAccounts, error: accountError } = await supabase
        .from('instagram_accounts')
        .select('user_id,instagram_business_account_id,access_token_encrypted,instagram_username')
        .in('user_id', userIds)
        .eq('is_connected', true);
      if (accountError) throw accountError;
      candidates = candidates.concat((instagramAccounts || []).map((account) => ({
        account_id: account.instagram_business_account_id,
        access_token_encrypted: account.access_token_encrypted,
        username: account.instagram_username,
        account_name: account.instagram_username,
      })));
    }

    const tokenRow = candidates.find((row) =>
      String(row.account_id || '') === accountId || String(row.page_id || '') === accountId
    );
    if (!tokenRow) return res.status(404).json({ success: false, error: 'Connected account not found' });

    const replies = await fetchMetaThread(tokenRow, platform, conversationId);
    void persistInboxThreadMessages(
      req.user.userId,
      platform,
      accountId,
      externalConversationId,
      replies
    ).catch((error) => console.warn('[INBOX] Could not persist thread:', error.message));
    return res.json({ success: true, replies });
  } catch (err) {
    console.error('❌ [INBOX-THREAD] Error:', err.response?.data?.error?.message || err.message);
    return res.status(err.response?.status || 502).json({
      success: false,
      error: err.response?.data?.error?.message || err.message || 'Failed to load conversation',
    });
  }
});

// ── POST /api/inbox/reply ───────────────────────────────────────────────────

router.post('/inbox/reply', authenticateUser, async (req, res) => {
  try {
    const { platform, accountId, commentId, postId, text, recipientId: requestedRecipientId } = req.body || {};

    if (!platform || !commentId || !text || !text.trim()) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PAYLOAD',
        message: 'Missing required parameters (platform, commentId, text)'
      });
    }

    const userIds = [...new Set([req.user.userId, req.user.authUserId, req.user.id].filter(Boolean))];

    let accessToken = null;
    let instanceUrl = null;

    if (platform === 'instagram') {
      // 1. Check instagram_accounts table first
      const { data: igAccs } = await supabase
        .from('instagram_accounts')
        .select('*')
        .in('user_id', userIds)
        .eq('is_connected', true);

      if (igAccs && igAccs.length > 0) {
        const acc = igAccs.find(a => accountId && (a.instagram_business_account_id === accountId || a.id === accountId)) || igAccs[0];
        accessToken = safeDecrypt(acc.access_token_encrypted || acc.access_token);
      }

      // 2. Fallback to social_tokens table
      if (!accessToken) {
        const { data: sTokens } = await supabase
          .from('social_tokens')
          .select('access_token')
          .in('user_id', userIds)
          .eq('provider', 'instagram');
        if (sTokens && sTokens.length > 0) {
          accessToken = safeDecrypt(sTokens[0].access_token);
        }
      }
    } else {
      // Generic lookup in social_tokens table with case-insensitive provider matching
      const { data: sTokens } = await supabase
        .from('social_tokens')
        .select('access_token,provider,instance_url,account_id,page_id,instagram_business_id,username,account_name')
        .in('user_id', userIds);

      const targetLower = String(platform).toLowerCase();
      const matchedRow = (sTokens || []).find(r => {
        const p = String(r.provider || '').toLowerCase();
        let matchesPlatform = false;
        
        if (targetLower === 'youtube') matchesPlatform = (p === 'youtube' || p === 'google');
        else if (targetLower === 'googlebusiness') matchesPlatform = (p === 'googlebusiness' || p === 'google_business' || p === 'google');
        else matchesPlatform = (p === targetLower);
        
        if (!matchesPlatform) return false;
        
        if (accountId) {
          return String(r.account_id) === String(accountId) || String(r.page_id) === String(accountId);
        }
        return true;
      });

      if (matchedRow) {
        accessToken = safeDecrypt(matchedRow.access_token);
        instanceUrl = matchedRow.instance_url;
      }
    }

    // 3. Robust Fallback: check getTokensForUser for any cached/synced account
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
        } catch (e) {
          // ignore fallback error
        }
      }
    }

    if (!accessToken) {
      return res.status(403).json({
        success: false,
        error: 'UNAUTHORIZED_ACCOUNT',
        message: `No authorized ${platform} account found for this user`
      });
    }

    let replyId = `reply_${Date.now()}`;
    let rawTokenStr = typeof accessToken === 'string' ? accessToken : (accessToken?.pageAccessToken || accessToken?.userAccessToken || accessToken?.accessToken);

    if (typeof rawTokenStr === 'string' && rawTokenStr.startsWith('{')) {
      try {
        const parsed = JSON.parse(rawTokenStr);
        rawTokenStr = parsed.pageAccessToken || parsed.userAccessToken || parsed.accessToken || rawTokenStr;
      } catch { }
    }

    if (!rawTokenStr || rawTokenStr === 'undefined' || rawTokenStr === 'null') {
      return res.status(403).json({
        success: false,
        error: 'INVALID_TOKEN_FORMAT',
        message: 'The access token could not be parsed properly for this account.'
      });
    }

    // Execute platform-specific API reply dispatch
    if (platform === 'youtube') {
      try {
        const freshYtToken = await googleOAuth.getValidAccessToken(req.user.userId, accountId);
        if (freshYtToken) rawTokenStr = freshYtToken;
      } catch (e) {
        // use decrypted token fallback
      }
      const ytRes = await axios.post('https://www.googleapis.com/youtube/v3/comments', {
        snippet: {
          parentId: commentId,
          textOriginal: text
        }
      }, {
        params: { part: 'snippet' },
        headers: { Authorization: `Bearer ${rawTokenStr}` }
      });
    } else if (platform === 'instagram') {
      const isIgToken = rawTokenStr.startsWith('IG');
      const graphBase = isIgToken ? 'https://graph.instagram.com/v24.0' : 'https://graph.facebook.com/v18.0';
      
      let recipientId = requestedRecipientId || null;
      let igBusinessId = null;
      try {
        if (recipientId) {
          lastIgDebug = { recipientId, accountId, commentId, source: 'persisted_conversation' };
        } else {
        const convRes = await axios.get(`${graphBase}/${commentId}`, {
          params: { fields: 'participants', access_token: rawTokenStr, locale: 'en_US' }
        });
        const participants = convRes.data?.participants?.data || [];
        const myIds = [
          String(accountId)
        ];

        let myUsernames = [];
        // Add known usernames from the database row (if we used the fallback lookup, this might not exist, which is fine)
        if (typeof matchedRow !== 'undefined' && matchedRow) {
          if (matchedRow.username) myUsernames.push(String(matchedRow.username).toLowerCase());
          if (matchedRow.account_name) myUsernames.push(String(matchedRow.account_name).toLowerCase());
        }

        try {
          const fields = isIgToken ? 'id,username' : 'id,instagram_business_account{username}';
          const meRes = await axios.get(`${graphBase}/me?fields=${fields}`, {
            params: { access_token: rawTokenStr }
          });
          if (meRes.data?.id) myIds.push(String(meRes.data.id));
          if (meRes.data?.username) myUsernames.push(String(meRes.data.username).toLowerCase());
          
          if (meRes.data?.instagram_business_account?.id) {
            myIds.push(String(meRes.data.instagram_business_account.id));
            igBusinessId = String(meRes.data.instagram_business_account.id);
          }
          if (meRes.data?.instagram_business_account?.username) {
             myUsernames.push(String(meRes.data.instagram_business_account.username).toLowerCase());
          }
          lastIgDebug = { ...lastIgDebug, meResData: meRes.data };
        } catch (e) {
          console.log('DEBUG [INBOX-IG] -> /me lookup failed:', e.response?.data || e.message);
          lastIgDebug = { ...lastIgDebug, meLookupError: e.response?.data || e.message };
        }

        const recipient = participants.find(p => {
          if (myIds.includes(String(p.id))) return false;
          const pName = String(p.username || p.name || '').toLowerCase();
          if (pName && myUsernames.includes(pName)) return false;
          return true;
        }) || participants[0];
        
        if (recipient) recipientId = recipient.id;
        
        lastIgDebug = {
          recipientId,
          participants,
          myIds,
          igBusinessId,
          accountId,
          commentId
        };
        console.log('DEBUG [INBOX-IG] -> Extracted recipientId:', recipientId, 'from participants:', participants, 'myIds:', myIds);
        }
      } catch (err) {
        console.error('Failed to fetch IG conversation participants:', err.response?.data || err.message);
        return res.status(400).json({ 
          success: false, 
          message: 'Failed to fetch conversation participants: ' + (err.response?.data?.error?.message || err.message) 
        });
      }

      if (!recipientId) {
        return res.status(400).json({ success: false, message: 'Cannot determine recipient ID for Instagram reply. Participants array might be empty.' });
      }

      try {
        let endpointId = 'me';
        if (!isIgToken) {
           endpointId = igBusinessId || accountId;
        }
        console.log('DEBUG [INBOX-IG] -> POSTing to endpointId:', endpointId);
        
        const res = await axios.post(`${graphBase}/${endpointId}/messages`, {
          recipient: { id: recipientId },
          message: { text: text }
        }, {
          params: { access_token: rawTokenStr, locale: 'en_US' }
        });
        replyId = res.data?.message_id || res.data?.id || replyId;
      } catch (err) {
        lastIgError = err.response?.data || err.message;
        console.error('Failed to send IG message:', lastIgError);
        return res.status(400).json({ success: false, message: err.response?.data?.error?.message || err.message, debugDetails: lastIgError });
      }
    } else if (platform === 'facebook') {
      const graphBase = 'https://graph.facebook.com/v18.0';
      const res = await axios.post(`${graphBase}/${commentId}/messages`, {
        message: text
      }, {
        params: { access_token: rawTokenStr }
      });
      replyId = res.data?.message_id || res.data?.id || replyId;
    } else if (platform === 'mastodon') {
      const mUrl = instanceUrl || 'https://mastodon.social';
      const mRes = await axios.post(`${mUrl}/api/v1/statuses`, {
        status: text,
        in_reply_to_id: commentId
      }, {
        headers: { Authorization: `Bearer ${rawTokenStr}` }
      });
      replyId = mRes.data?.id || replyId;
    }

    await recordInboxOutboundMessage(req.user.userId, {
      platform,
      accountId,
      conversationId: commentId,
      externalConversationId: requestedRecipientId || commentId,
      messageId: replyId,
      text,
    }).catch((error) => console.warn('[INBOX] Could not persist reply:', error.message));
    await invalidateInboxCache(userIds);
    return res.json({
      success: true,
      replyId,
      platform,
      commentId,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    console.error('❌ [INBOX-REPLY] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'REPLY_FAILED',
      message: err.response?.data?.error?.message || err.message
    });
  }
});

router.get('/inbox/debug-last-error', (req, res) => res.json({ lastIgError, lastIgDebug }));

// ── POST /api/inbox/copilot ─────────────────────────────────────────────────

router.post('/inbox/copilot', authenticateUser, async (req, res) => {
  try {
    const { commentText, style = 'friendly' } = req.body || {};
    if (!commentText) {
      return res.status(400).json({ success: false, error: 'Missing commentText' });
    }

    let suggestion = '';
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
    } else { // quick_thanks
      suggestion = 'Thank you! 🙏';
    }

    return res.json({
      success: true,
      suggestion,
      style
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
