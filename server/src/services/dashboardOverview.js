import axios from 'axios';
import supabase, { getConnectedAccounts } from './supabase.js';
import { getAnalytics as getInstaPilotAnalytics, decryptToken } from './instapilot.js';
import { getDailyMetrics } from './autodm.js';

const GRAPH_VERSION = process.env.META_GRAPH_VERSION || 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const IG_GRAPH_BASE = process.env.IG_GRAPH_BASE_URL || 'https://graph.instagram.com/v24.0';
const RANGE_OPTIONS = new Set([7, 30, 90]);

function getUserIds(user) {
  return [...new Set([user?.userId, user?.authUserId].filter(Boolean))];
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function getPostDate(post) {
  return safeDate(post.posted_at || post.scheduled_for || post.created_at);
}

function getPostChannels(post) {
  const fromColumns = Array.isArray(post.selected_channels) ? post.selected_channels : [];
  const fromPlatformData = Array.isArray(post.platform_data?.selectedChannels)
    ? post.platform_data.selectedChannels
    : [];
  return [...new Set([...fromColumns, ...fromPlatformData].map(String).filter(Boolean))];
}

export function normalizeDashboardRange(value) {
  const range = Number(value);
  return RANGE_OPTIONS.has(range) ? range : 30;
}

export function summarizeBroadcasts(broadcasts = [], range = 30, now = new Date()) {
  const today = startOfUtcDay(now);
  const rangeStart = new Date(today);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - range + 1);
  const previousStart = new Date(rangeStart);
  previousStart.setUTCDate(previousStart.getUTCDate() - range);

  const inRange = broadcasts.filter((post) => {
    const date = getPostDate(post);
    return date && date >= rangeStart && date <= now;
  });
  const previousRange = broadcasts.filter((post) => {
    const date = getPostDate(post);
    return date && date >= previousStart && date < rangeStart;
  });

  const sent = inRange.filter((post) => ['sent', 'partially_sent'].includes(post.status)).length;
  const scheduled = broadcasts.filter((post) => ['scheduled', 'queued'].includes(post.status)).length;
  const processing = broadcasts.filter((post) => post.status === 'processing').length;
  const failed = inRange.filter((post) => post.status === 'failed').length;
  const completed = sent + failed;
  const successRate = completed > 0 ? Math.round((sent / completed) * 100) : null;

  const nextScheduled =
    broadcasts
      .filter((post) => ['scheduled', 'queued', 'processing'].includes(post.status))
      .map((post) => ({ post, date: safeDate(post.scheduled_for) }))
      .filter((item) => item.date)
      .sort((a, b) => a.date - b.date)[0]?.post || null;

  const recentActivity = [...broadcasts]
    .filter((post) => ['sent', 'partially_sent', 'failed', 'cancelled'].includes(post.status))
    .sort((a, b) => (getPostDate(b)?.getTime() || 0) - (getPostDate(a)?.getTime() || 0))
    .slice(0, 8)
    .map(compactPost);

  const trend = [];
  for (let offset = 0; offset < range; offset += 1) {
    const day = new Date(rangeStart);
    day.setUTCDate(day.getUTCDate() + offset);
    const key = dateKey(day);
    const posts = inRange.filter((post) => dateKey(getPostDate(post)) === key);
    trend.push({
      date: key,
      sent: posts.filter((post) => ['sent', 'partially_sent'].includes(post.status)).length,
      scheduled: posts.filter((post) => ['scheduled', 'queued'].includes(post.status)).length,
      failed: posts.filter((post) => post.status === 'failed').length,
    });
  }

  return {
    operations: {
      totalPosts: inRange.length,
      sent,
      scheduled,
      failed,
      processing,
      successRate,
      queueCount: scheduled + processing,
      previousTotalPosts: previousRange.length,
      totalPostsDelta: inRange.length - previousRange.length,
      nextScheduled: nextScheduled ? compactPost(nextScheduled) : null,
      recentActivity,
    },
    publishingTrend: trend,
  };
}

function compactPost(post) {
  return {
    id: post.id,
    caption: post.caption || 'Untitled post',
    status: post.status,
    scheduledFor: post.scheduled_for || null,
    postedAt: post.posted_at || null,
    createdAt: post.created_at || null,
    mediaType: post.media_type || null,
    mediaUrl: post.thumbnail_url || post.media_url || null,
    channels: getPostChannels(post),
  };
}

export function summarizeConnectedAccounts(connectedAccounts = {}) {
  const accountGroups = Object.entries(connectedAccounts)
    .filter(([key, value]) => key.endsWith('Accounts') && Array.isArray(value))
    .flatMap(([key, accounts]) => {
      const provider = key.replace(/Accounts$/, '');
      return accounts.map((account) => ({
        provider,
        id: account.id || account.account_id || account.instagram_business_id,
        username: account.username || account.name || null,
        connected: account.connected !== false,
        profilePicture: account.profilePicture || account.profile_picture_url || null,
        tokenExpiry: account.token_expiry || null,
        needsReconnect: isExpired(account.token_expiry),
      }));
    });

  const singles = Object.entries(connectedAccounts)
    .filter(([key, value]) => !key.endsWith('Accounts') && value?.connected && !connectedAccounts[`${key}Accounts`]?.length)
    .map(([provider, account]) => ({
      provider,
      id: account.account_id || account.instagram_business_id || account.page_id || provider,
      username: account.username || null,
      connected: true,
      profilePicture: account.profilePicture || null,
      tokenExpiry: account.token_expiry || null,
      needsReconnect: isExpired(account.token_expiry),
    }));

  const accounts = [...accountGroups, ...singles];
  return {
    totalConnected: accounts.length,
    needsReconnect: accounts.filter((account) => account.needsReconnect),
    accounts,
  };
}

function isExpired(value) {
  const date = safeDate(value);
  return Boolean(date && date.getTime() <= Date.now());
}

async function getBroadcastRows(userIds, range) {
  const since = new Date(Date.now() - range * 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('broadcasts')
    .select('*')
    .in('user_id', userIds)
    .or(`created_at.gte.${since},posted_at.gte.${since},scheduled_for.gte.${since},status.in.(scheduled,queued,processing)`)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(`Failed to load dashboard broadcasts: ${error.message}`);
  return data || [];
}

async function getInstagramAccountRows(userIds, instagramAccountId) {
  let query = supabase
    .from('instagram_accounts')
    .select('id, instagram_business_account_id, instagram_username, profile_picture_url, followers_count, media_count, access_token_encrypted, token_expires_at, token_status, updated_at, is_connected')
    .in('user_id', userIds)
    .eq('is_connected', true)
    .order('updated_at', { ascending: false });

  if (instagramAccountId && instagramAccountId !== 'all') {
    query = query.eq('id', instagramAccountId);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[DASHBOARD] Instagram accounts unavailable:', error.message);
    return [];
  }
  return data || [];
}

function getAccountToken(account) {
  if (!account.access_token_encrypted) return null;
  const decrypted = decryptToken(account.access_token_encrypted);
  return decrypted.pageAccessToken || decrypted.userAccessToken || null;
}

function getGraphBase(token) {
  return token?.startsWith('IG') ? IG_GRAPH_BASE : GRAPH_BASE;
}

async function readInstagramProfile(account, accessToken) {
  const id = account.instagram_business_account_id;
  const { data } = await axios.get(`${getGraphBase(accessToken)}/${id}`, {
    params: {
      fields: 'id,username,followers_count,media_count,profile_picture_url',
      access_token: accessToken,
    },
    timeout: 10000,
  });
  return data || {};
}

async function readInstagramInsights(account, accessToken, range) {
  const id = account.instagram_business_account_id;
  const until = Math.floor(Date.now() / 1000);
  const since = until - range * 24 * 60 * 60;
  const metrics = ['reach', 'views', 'profile_views'];
  const values = {};
  const unavailable = [];

  for (const metric of metrics) {
    try {
      const { data } = await axios.get(`${getGraphBase(accessToken)}/${id}/insights`, {
        params: { metric, period: 'day', since, until, access_token: accessToken },
        timeout: 10000,
      });
      values[metric] = sumInsightValues(data?.data?.[0]?.values || []);
      if (values[metric] === null) {
        unavailable.push(`${metric} was not returned by Meta for this period.`);
      }
    } catch (error) {
      unavailable.push(cleanMetaInsightError(metric, error.response?.data?.error?.message || error.message));
    }
  }

  return { values, unavailable };
}

function cleanMetaInsightError(metric, message) {
  const text = String(message || '').toLowerCase();
  if (text.includes('must be one of the following values')) {
    return `${metric} is not available for this Instagram account.`;
  }
  if (text.includes('permission') || text.includes('access token')) {
    return 'Reconnect Instagram or grant insights permission to show this metric.';
  }
  return `${metric} is unavailable from Meta right now.`;
}

function cleanInstagramGrowthError(message) {
  const text = String(message || '').toLowerCase();
  if (text.includes('must be one of the following values')) {
    return 'Meta did not return one or more Instagram insight metrics for this account.';
  }
  if (text.includes('permission') || text.includes('access token') || text.includes('missing instagram access token')) {
    return 'Reconnect Instagram or grant insights permission to show this metric.';
  }
  return 'Instagram insights are unavailable from Meta right now.';
}

export function sumInsightValues(rows = []) {
  const numbers = rows.map((row) => Number(row?.value)).filter(Number.isFinite);
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, value) => sum + value, 0);
}

async function readTopInstagramMedia(account, accessToken) {
  const id = account.instagram_business_account_id;
  const { data } = await axios.get(`${getGraphBase(accessToken)}/${id}/media`, {
    params: {
      fields: 'id,caption,like_count,comments_count,media_type,media_url,thumbnail_url,permalink,timestamp',
      limit: 12,
      access_token: accessToken,
    },
    timeout: 10000,
  });

  return (data?.data || [])
    .map((item) => ({
      id: item.id,
      caption: item.caption || 'Instagram media',
      likes: item.like_count || 0,
      comments: item.comments_count || 0,
      engagement: (item.like_count || 0) + (item.comments_count || 0),
      mediaType: item.media_type,
      mediaUrl: item.thumbnail_url || item.media_url || null,
      permalink: item.permalink || null,
      timestamp: item.timestamp || null,
    }))
    .sort((a, b) => b.engagement - a.engagement)
    .slice(0, 3);
}

async function upsertMetricSnapshot(userId, account, metrics) {
  const snapshotDate = dateKey(new Date());
  const accountId = account.id || account.instagram_business_account_id;
  const provider = 'instagram';

  try {
    const { data: previous } = await supabase
      .from('social_account_metric_snapshots')
      .select('snapshot_date,followers_count,media_count,raw_metrics')
      .eq('user_id', userId)
      .eq('provider', provider)
      .eq('account_id', accountId)
      .lt('snapshot_date', snapshotDate)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase.from('social_account_metric_snapshots').upsert(
      {
        user_id: userId,
        provider,
        account_id: accountId,
        snapshot_date: snapshotDate,
        followers_count: metrics.followers,
        media_count: metrics.mediaCount,
        reach: metrics.reach,
        impressions: metrics.impressions,
        profile_views: metrics.profileViews,
        raw_metrics: metrics,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,provider,account_id,snapshot_date' },
    );

    return {
      baselineCollecting: !previous,
      followerDelta: previous?.followers_count != null ? metrics.followers - previous.followers_count : null,
      mediaDelta: previous?.media_count != null ? metrics.mediaCount - previous.media_count : null,
      previousDate: previous?.snapshot_date || null,
    };
  } catch (error) {
    console.warn('[DASHBOARD] Metric snapshot skipped:', error.message);
    return { baselineCollecting: true, followerDelta: null, mediaDelta: null, previousDate: null };
  }
}

async function buildInstagramGrowth(user, range, instagramAccountId) {
  const userIds = getUserIds(user);
  const accounts = await getInstagramAccountRows(userIds, instagramAccountId);

  if (accounts.length === 0) {
    return {
      selectedAccountId: instagramAccountId || 'all',
      accounts: [],
      summary: {
        followers: null,
        followerDelta: null,
        reach: null,
        impressions: null,
        profileViews: null,
        unavailableReason: 'No connected Instagram account found.',
      },
    };
  }

  const rows = await Promise.all(
    accounts.map(async (account) => {
      const base = {
        id: account.id,
        instagramBusinessId: account.instagram_business_account_id,
        username: account.instagram_username,
        profilePicture: account.profile_picture_url,
        tokenExpiresAt: account.token_expires_at,
        tokenStatus: account.token_status || 'active',
      };

      if (isExpired(account.token_expires_at) || account.token_status === 'expired') {
        return {
          ...base,
          followers: account.followers_count ?? null,
          mediaCount: account.media_count ?? null,
          topMedia: [],
          baselineCollecting: true,
          unavailableReason: 'Instagram connection needs reconnect.',
        };
      }

      try {
        const token = getAccountToken(account);
        if (!token) throw new Error('Missing Instagram access token.');

        const [profile, insights, topMedia] = await Promise.all([
          readInstagramProfile(account, token),
          readInstagramInsights(account, token, range),
          readTopInstagramMedia(account, token).catch((error) => {
            console.warn('[DASHBOARD] Top media unavailable:', error.message);
            return [];
          }),
        ]);

        const metrics = {
          followers: profile.followers_count ?? account.followers_count ?? null,
          mediaCount: profile.media_count ?? account.media_count ?? null,
          reach: insights.values.reach ?? null,
          impressions: insights.values.views ?? null,
          profileViews: insights.values.profile_views ?? null,
        };
        const snapshot = await upsertMetricSnapshot(user.userId, account, metrics);

        return {
          ...base,
          username: profile.username || base.username,
          profilePicture: profile.profile_picture_url || base.profilePicture,
          ...metrics,
          ...snapshot,
          topMedia,
          unavailableReason: insights.unavailable.length ? insights.unavailable[0] : null,
        };
      } catch (error) {
        return {
          ...base,
          followers: account.followers_count ?? null,
          mediaCount: account.media_count ?? null,
          topMedia: [],
          baselineCollecting: true,
          unavailableReason: cleanInstagramGrowthError(error.response?.data?.error?.message || error.message),
        };
      }
    }),
  );

  const summaryRows = rows.filter((row) => row.unavailableReason !== 'Instagram connection needs reconnect.');
  const summary = {
    followers: sumNullable(summaryRows.map((row) => row.followers)),
    followerDelta: sumNullable(summaryRows.map((row) => row.followerDelta)),
    reach: sumNullable(summaryRows.map((row) => row.reach)),
    impressions: sumNullable(summaryRows.map((row) => row.impressions)),
    profileViews: sumNullable(summaryRows.map((row) => row.profileViews)),
    unavailableReason: summaryRows.length ? null : rows[0]?.unavailableReason || null,
  };

  return { selectedAccountId: instagramAccountId || 'all', accounts: rows, summary };
}

function sumNullable(values) {
  const numbers = values.filter((value) => Number.isFinite(Number(value)));
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, value) => sum + Number(value), 0);
}

async function buildAutomationSummary(user, range) {
  const since = dateKey(new Date(Date.now() - range * 24 * 60 * 60 * 1000));
  const [instapilot, dailyMetrics] = await Promise.all([
    getInstaPilotAnalytics(user.userId).catch((error) => {
      console.warn('[DASHBOARD] InstaPilot analytics unavailable:', error.message);
      return null;
    }),
    getDailyMetrics(user, { startDate: since }).catch((error) => {
      console.warn('[DASHBOARD] AutoDM metrics unavailable:', error.message);
      return [];
    }),
  ]);

  const autodm = dailyMetrics.reduce(
    (total, row) => ({
      messagesSent: total.messagesSent + (row.messages_sent || 0),
      messagesSeen: total.messagesSeen + (row.messages_seen || 0),
      totalClicks: total.totalClicks + (row.total_clicks || 0),
      followersGained: total.followersGained + (row.followers_gained || 0),
    }),
    { messagesSent: 0, messagesSeen: 0, totalClicks: 0, followersGained: 0 },
  );

  return { instapilot, autodm };
}

export async function getDashboardOverview(user, query = {}) {
  const range = normalizeDashboardRange(query.range);
  const instagramAccountId = query.instagramAccountId || 'all';
  const userIds = getUserIds(user);
  if (userIds.length === 0) throw new Error('Missing dashboard user');

  const [broadcasts, connectedAccounts] = await Promise.all([
    getBroadcastRows(userIds, range),
    getConnectedAccounts(user),
  ]);

  const broadcastSummary = summarizeBroadcasts(broadcasts, range);
  const [instagramGrowth, automation] = await Promise.all([
    buildInstagramGrowth(user, range, instagramAccountId),
    buildAutomationSummary(user, range),
  ]);

  return {
    success: true,
    range,
    generatedAt: new Date().toISOString(),
    ...broadcastSummary,
    accounts: summarizeConnectedAccounts(connectedAccounts),
    instagramGrowth,
    automation,
  };
}
