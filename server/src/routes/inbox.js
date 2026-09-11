import express from 'express';
import { authenticateUser } from '../middleware/authenticateUser.js';
import supabase, { getTokensForUser } from '../services/supabase.js';
import axios from 'axios';
import { decryptToken as decryptTokenEncryption } from '../services/tokenEncryption.js';
import { decryptToken as decryptInstaPilotToken } from '../services/instapilot.js';

const router = express.Router();

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

// ── Platform-Specific On-Demand Fetchers ────────────────────────────────────

async function fetchYouTubeComments(tokenRow) {
  try {
    const accessToken = safeDecrypt(tokenRow.access_token);
    if (!accessToken) return { status: 'error', error: 'Missing access token', items: [] };

    // Fetch user's channel ID
    const channelRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { part: 'snippet,contentDetails', mine: true },
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const channelItem = channelRes.data?.items?.[0];
    if (!channelItem) return { status: 'ok', items: [] };

    const channelId = channelItem.id;
    const channelTitle = channelItem.snippet?.title || 'YouTube Channel';

    // Query channel-wide comment threads directly via allThreadsRelatedToChannelId
    const commentsRes = await axios.get('https://www.googleapis.com/youtube/v3/commentThreads', {
      params: { part: 'snippet,replies', allThreadsRelatedToChannelId: channelId, maxResults: 25, textFormat: 'plainText' },
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const commentItems = [];
    for (const thread of commentsRes.data?.items || []) {
      const top = thread.snippet?.topLevelComment?.snippet;
      if (!top) continue;

      const authorChannelId = top.authorChannelId?.value;
      // Filter out comments posted by the channel owner itself
      if (authorChannelId && authorChannelId === channelId) {
        continue;
      }

      const childReplies = thread.replies?.comments || [];
      const hasOwnerReplied = childReplies.some(r => r.snippet?.authorChannelId?.value === channelId) || childReplies.length > 0;

      commentItems.push({
        id: `yt:${thread.id}`,
        platform: 'youtube',
        accountId: tokenRow.account_id || channelId,
        accountName: channelTitle,
        postId: top.videoId || channelId,
        postTitle: top.videoId ? `YouTube Video (${top.videoId})` : channelTitle,
        postThumbnail: channelItem.snippet?.thumbnails?.medium?.url || null,
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
    console.error('❌ [INBOX-YT] Failed:', err.response?.data?.error?.message || err.message);
    return { status: 'error', error: err.response?.data?.error?.message || err.message, items: [] };
  }
}

async function fetchInstagramComments(tokenRow) {
  try {
    const accessToken = safeDecrypt(tokenRow.access_token || tokenRow.access_token_encrypted);
    const businessId = tokenRow.account_id || tokenRow.page_id || tokenRow.instagram_business_account_id;
    if (!accessToken || !businessId) return { status: 'error', error: 'Missing Instagram Business credentials', items: [] };

    const graphBase = accessToken.startsWith('IGA') ? 'https://graph.instagram.com' : 'https://graph.facebook.com/v18.0';

    // Single nested request: fetch media and comments in 1 call
    const mediaRes = await axios.get(`${graphBase}/${businessId}/media`, {
      params: {
        fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count,comments{id,text,username,timestamp,replies{id,text,username,timestamp}}',
        limit: 10,
        access_token: accessToken
      }
    });

    const mediaList = mediaRes.data?.data || [];
    const commentItems = [];
    const ownerHandle = String(tokenRow.username || tokenRow.account_name || '').toLowerCase().replace('@', '').trim();

    for (const media of mediaList) {
      const comments = media.comments?.data || [];
      for (const c of comments) {
        const commentUsername = String(c.username || '').toLowerCase().replace('@', '').trim();

        // Filter out comments posted by the account owner itself
        if (ownerHandle && commentUsername === ownerHandle) {
          continue;
        }

        const childReplies = c.replies?.data || [];
        const hasOwnerReplied = childReplies.some(r => {
          const rUser = String(r.username || '').toLowerCase().replace('@', '').trim();
          return ownerHandle && rUser === ownerHandle;
        }) || childReplies.length > 0;

        commentItems.push({
          id: `ig:${c.id}`,
          platform: 'instagram',
          accountId: businessId,
          accountName: tokenRow.username || tokenRow.account_name || 'Instagram Account',
          postId: media.id,
          postTitle: media.caption || 'Instagram Post',
          postThumbnail: media.thumbnail_url || media.media_url || null,
          commentId: c.id,
          topLevelCommentId: c.id,
          authorName: c.username || 'Instagram User',
          authorAvatar: null,
          authorHandle: `@${c.username || 'user'}`,
          text: c.text || '',
          createdAt: c.timestamp || new Date().toISOString(),
          replied: hasOwnerReplied,
          starred: false,
          unread: false,
          replyCount: childReplies.length,
          replies: childReplies.map(r => ({
            id: r.id,
            authorName: r.username || tokenRow.username || tokenRow.account_name || 'Account Owner',
            authorHandle: `@${r.username || tokenRow.username || 'user'}`,
            authorAvatar: null,
            text: r.text,
            createdAt: r.timestamp
          }))
        });
      }
    }

    return { status: 'ok', items: commentItems };
  } catch (err) {
    console.error('❌ [INBOX-IG] Failed:', err.response?.data?.error?.message || err.message);
    return { status: 'error', error: err.response?.data?.error?.message || err.message, items: [] };
  }
}

async function fetchBlueskyComments(tokenRow) {
  try {
    const handle = tokenRow.account_id || tokenRow.username;
    const pass = safeDecrypt(tokenRow.access_token);
    if (!handle) return { status: 'error', error: 'Missing Bluesky handle', items: [] };

    // Public feed fetch for Bluesky handle via bsky.app public API
    const res = await axios.get('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed', {
      params: { actor: handle, limit: 5 }
    });

    const feed = res.data?.feed || [];
    const commentItems = [];

    for (const item of feed) {
      const post = item.post;
      if (!post || !post.replyCount) continue;

      try {
        const threadRes = await axios.get('https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread', {
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
    console.error('❌ [INBOX-BSKY] Failed:', err.message);
    return { status: 'error', error: err.message, items: [] };
  }
}

async function fetchMastodonComments(tokenRow) {
  try {
    const accessToken = safeDecrypt(tokenRow.access_token);
    const instanceUrl = tokenRow.instance_url || 'https://mastodon.social';
    if (!accessToken) return { status: 'error', error: 'Missing Mastodon token', items: [] };

    // Fetch user notifications for mentions / replies
    const notifRes = await axios.get(`${instanceUrl}/api/v1/notifications`, {
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
    console.error('❌ [INBOX-MASTO] Failed:', err.message);
    return { status: 'error', error: err.message, items: [] };
  }
}

async function fetchFacebookComments(tokenRow) {
  try {
    const accessToken = safeDecrypt(tokenRow.access_token);
    const pageId = tokenRow.page_id || tokenRow.account_id;
    if (!accessToken || !pageId) return { status: 'error', error: 'Missing Facebook Page credentials', items: [] };

    // Fetch recent 5 page posts
    const postsRes = await axios.get(`https://graph.facebook.com/v18.0/${pageId}/posts`, {
      params: {
        fields: 'id,message,created_time,full_picture,comments.limit(10){id,message,from,created_time,comments{id,message,from,created_time}}',
        limit: 5,
        access_token: accessToken
      }
    });

    const postList = postsRes.data?.data || [];
    const commentItems = [];

    for (const post of postList) {
      const comments = post.comments?.data || [];
      for (const c of comments) {
        commentItems.push({
          id: `fb:${c.id}`,
          platform: 'facebook',
          accountId: pageId,
          accountName: tokenRow.username || 'Facebook Page',
          postId: post.id,
          postTitle: post.message || 'Facebook Post',
          postThumbnail: post.full_picture || null,
          commentId: c.id,
          topLevelCommentId: c.id,
          authorName: c.from?.name || 'Facebook User',
          authorAvatar: null,
          authorHandle: `@${c.from?.name || 'user'}`,
          text: c.message || '',
          createdAt: c.created_time || new Date().toISOString(),
          replied: Boolean(c.comments?.data?.length),
          starred: false,
          unread: false,
          replyCount: c.comments?.data?.length || 0,
          replies: (c.comments?.data || []).map(r => ({
            id: r.id,
            authorName: r.from?.name || 'User',
            authorAvatar: null,
            text: r.message,
            createdAt: r.created_time
          }))
        });
      }
    }

    return { status: 'ok', items: commentItems };
  } catch (err) {
    console.error('❌ [INBOX-FB] Failed:', err.message);
    return { status: 'error', error: err.response?.data?.error?.message || err.message, items: [] };
  }
}

// ── GET /api/inbox/stream ───────────────────────────────────────────────────

router.get('/inbox/stream', authenticateUser, async (req, res) => {
  try {
    const userIds = [...new Set([req.user.userId, req.user.authUserId].filter(Boolean))];

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

    const ytTokenRow = connectedMap['youtube']?.[0] || connectedMap['google']?.[0];
    if (ytTokenRow) {
      fetchPromises.push(fetchYouTubeComments(ytTokenRow));
      promiseMeta.push('youtube');
    }
    if (connectedMap['instagram']) {
      fetchPromises.push(fetchInstagramComments(connectedMap['instagram'][0]));
      promiseMeta.push('instagram');
    }
    if (connectedMap['facebook']) {
      fetchPromises.push(fetchFacebookComments(connectedMap['facebook'][0]));
      promiseMeta.push('facebook');
    }
    if (connectedMap['bluesky']) {
      fetchPromises.push(fetchBlueskyComments(connectedMap['bluesky'][0]));
      promiseMeta.push('bluesky');
    }
    if (connectedMap['mastodon']) {
      fetchPromises.push(fetchMastodonComments(connectedMap['mastodon'][0]));
      promiseMeta.push('mastodon');
    }

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

    // Sort items by createdAt descending (newest first)
    allItems.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({
      success: true,
      totalLoaded: allItems.length,
      platformStatuses,
      items: allItems
    });

  } catch (err) {
    console.error('❌ [INBOX-STREAM] Error:', err.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to aggregate inbox stream',
      message: err.message
    });
  }
});

// ── POST /api/inbox/reply ───────────────────────────────────────────────────

router.post('/inbox/reply', authenticateUser, async (req, res) => {
  try {
    const { platform, accountId, commentId, postId, text } = req.body || {};

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
        .select('access_token,provider,instance_url,account_id,page_id')
        .in('user_id', userIds);

      const targetLower = String(platform).toLowerCase();
      const matchedRow = (sTokens || []).find(r => {
        const p = String(r.provider || '').toLowerCase();
        if (targetLower === 'youtube') return p === 'youtube' || p === 'google';
        if (targetLower === 'googlebusiness') return p === 'googlebusiness' || p === 'google_business' || p === 'google';
        return p === targetLower;
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

    // Execute platform-specific API reply dispatch
    if (platform === 'youtube') {
      const ytRes = await axios.post('https://www.googleapis.com/youtube/v3/comments', {
        snippet: {
          parentId: commentId,
          textOriginal: text
        }
      }, {
        params: { part: 'snippet' },
        headers: { Authorization: `Bearer ${rawTokenStr}` }
      });
      replyId = ytRes.data?.id || replyId;
    } else if (platform === 'instagram') {
      const graphBase = String(rawTokenStr).startsWith('IGA') ? 'https://graph.instagram.com' : 'https://graph.facebook.com/v18.0';
      const igRes = await axios.post(`${graphBase}/${commentId}/replies`, null, {
        params: {
          message: text,
          access_token: rawTokenStr
        }
      });
      replyId = igRes.data?.id || replyId;
    } else if (platform === 'facebook') {
      const fbRes = await axios.post(`https://graph.facebook.com/v18.0/${commentId}/comments`, null, {
        params: {
          message: text,
          access_token: rawTokenStr
        }
      });
      replyId = fbRes.data?.id || replyId;
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
