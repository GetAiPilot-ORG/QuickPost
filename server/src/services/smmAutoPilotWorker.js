import axios from 'axios';
import supabase from './supabase.js';
import { processSmmOrderQueue } from './smmQueueWorker.js';
import { decryptToken } from './instapilot.js';

let workerInterval = null;
let isChecking = false;

/**
 * Trigger an automatic boost for a specific newly detected post permalink
 */
export async function triggerAutoBoostForPermalink({ userId, username, permalink, mediaType = 'ALL' }) {
  if (!username || !permalink) return null;

  const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
  const cleanPermalink = permalink.split('?')[0].trim();

  // 1. Fetch active subscriptions for this username
  let query = supabase
    .from('sg_subscriptions')
    .select('*')
    .ilike('username', cleanUsername)
    .eq('status', 'Active')
    .gt('posts_remaining', 0);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: activeRules, error: ruleErr } = await query;
  if (ruleErr || !activeRules || activeRules.length === 0) {
    return null;
  }

  const results = [];

  for (const rule of activeRules) {
    try {
      // 2. Check if this exact permalink was already boosted by this rule or user
      const { data: existingOrder } = await supabase
        .from('sg_orders')
        .select('id')
        .eq('user_id', rule.user_id)
        .ilike('target_link', `${cleanPermalink}%`)
        .maybeSingle();

      if (existingOrder) {
        console.log(`[AutoPilot] Post ${cleanPermalink} was already boosted. Skipping.`);
        continue;
      }

      // 3. Map to verified high-speed single-post services on TeleSMM
      let targetServiceId = String(rule.service_id);
      if (rule.type === 'auto_views' || targetServiceId === '4381') {
        // If it's an image post, views cannot be delivered to static images -> use likes service
        if (mediaType === 'IMAGE') {
          targetServiceId = '4349'; // Deliver likes instead of failing
        } else {
          targetServiceId = '4348'; // High speed views for Reel/Video
        }
      } else {
        targetServiceId = '4349'; // High speed likes
      }

      const qty = Number(rule.max_quantity || rule.min_quantity || 100);
      const pricePerK = parseFloat(rule.price_per_k || 0.18);
      const costForThisPost = Number(((qty / 1000) * pricePerK).toFixed(3));

      // 4. Atomic Wallet Deduction for this 1 post
      const { data: checkoutResult, error: checkoutErr } = await supabase.rpc(
        'sg_process_multi_order_checkout',
        {
          p_user_id: rule.user_id,
          p_total_amount: costForThisPost,
          p_description: `Auto-Boost 1 post on @${cleanUsername} (${qty} units on ${cleanPermalink})`,
        }
      );

      if (checkoutErr || !checkoutResult?.[0]?.success) {
        console.warn(
          `[AutoPilot] User ${rule.user_id} has insufficient balance to boost ${cleanPermalink}. Skipping.`
        );
        continue;
      }

      // 5. Insert single order into sg_orders with the direct Reel/Post link
      const { data: newOrder, error: orderErr } = await supabase
        .from('sg_orders')
        .insert({
          user_id: rule.user_id,
          service_id: targetServiceId,
          target_link: cleanPermalink,
          quantity: qty,
          price_per_k: pricePerK,
          total_cost: costForThisPost,
          status: 'queued',
        })
        .select()
        .single();

      if (orderErr) {
        // Auto-refund on DB insertion error
        await supabase.rpc('sg_refund_failed_order', {
          p_user_id: rule.user_id,
          p_amount: costForThisPost,
          p_order_id: 'AUTO_BOOST_ERR',
          p_reason: 'Database order insertion failure',
        });
        console.error('[AutoPilot] Failed to insert order:', orderErr);
        continue;
      }

      // 6. Decrement posts_remaining
      const newRemaining = Math.max(0, Number(rule.posts_remaining) - 1);
      const updatePayload = {
        posts_remaining: newRemaining,
        updated_at: new Date().toISOString(),
      };
      if (newRemaining === 0) {
        updatePayload.status = 'Completed';
      }

      await supabase
        .from('sg_subscriptions')
        .update(updatePayload)
        .eq('id', rule.id);

      console.log(
        `[AutoPilot] 🚀 Successfully queued Auto-Boost for ${cleanPermalink}! (${newRemaining} posts left on rule ${rule.id})`
      );

      results.push(newOrder);
    } catch (err) {
      console.error(`[AutoPilot] Error processing rule ${rule.id}:`, err.message);
    }
  }

  // Trigger queue worker immediately to dispatch orders to TeleSMM
  if (results.length > 0) {
    processSmmOrderQueue().catch((err) =>
      console.error('[AutoPilot] Queue trigger error:', err)
    );
  }

  return results;
}

/**
 * Fetch latest media permalinks for a connected Instagram account
 */
async function fetchLatestConnectedMedia(account) {
  try {
    const tokens = decryptToken(account.access_token_encrypted);
    const tokenStr =
      typeof tokens === 'object'
        ? tokens.pageAccessToken || tokens.userAccessToken || tokens.accessToken || tokens
        : tokens;

    if (!tokenStr) return [];

    let url = 'https://graph.instagram.com/me/media';
    if (tokenStr.startsWith('EAAB') || tokenStr.startsWith('EAAG')) {
      const accountId = account.instagram_business_account_id || account.page_id || 'me';
      url = `https://graph.facebook.com/v18.0/${accountId}/media`;
    }

    const res = await axios.get(url, {
      params: {
        fields: 'id,permalink,media_type,timestamp,caption',
        limit: 5,
        access_token: tokenStr,
      },
      timeout: 8000,
    });

    return res.data?.data || [];
  } catch (err) {
    console.warn(
      `[AutoPilot] Graph API media fetch failed for @${account.instagram_username}:`,
      err.response?.data?.error?.message || err.message
    );
    return [];
  }
}

/**
 * Fetch latest public post permalinks for a public Instagram username
 */
async function fetchLatestPublicMedia(username) {
  try {
    const cleanUser = username.replace(/^@/, '').trim();
    const res = await axios.get(
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanUser}`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'X-IG-App-ID': '936619743392459',
        },
        timeout: 6000,
      }
    );

    const edges =
      res.data?.data?.user?.edge_owner_to_timeline_media?.edges || [];
    return edges.map((e) => ({
      id: e.node?.id,
      permalink: `https://www.instagram.com/p/${e.node?.shortcode}/`,
      media_type: e.node?.is_video ? 'VIDEO' : 'IMAGE',
      timestamp: e.node?.taken_at_timestamp,
    }));
  } catch (err) {
    return [];
  }
}

/**
 * Poller: Checks all active subscriptions in sg_subscriptions and triggers auto-boost for any new posts
 */
export async function checkActiveAutoPilotSubscriptions() {
  if (isChecking) return;
  isChecking = true;

  try {
    // 1. Fetch all active subscriptions
    const { data: activeRules, error } = await supabase
      .from('sg_subscriptions')
      .select('*')
      .eq('status', 'Active')
      .gt('posts_remaining', 0);

    if (error || !activeRules || activeRules.length === 0) {
      isChecking = false;
      return;
    }

    // 2. Fetch connected instagram_accounts in Supabase
    const userNames = [...new Set(activeRules.map((r) => (r.username || '').toLowerCase().replace(/^@/, '')))];
    const { data: accounts } = await supabase
      .from('instagram_accounts')
      .select('*')
      .in('instagram_username', userNames)
      .eq('is_connected', true);

    const accountMap = {};
    if (accounts) {
      for (const acc of accounts) {
        const key = (acc.instagram_username || '').toLowerCase().replace(/^@/, '');
        accountMap[key] = acc;
      }
    }

    // 3. Process rules
    for (const rule of activeRules) {
      const cleanUser = (rule.username || '').toLowerCase().replace(/^@/, '').trim();
      const connectedAccount = accountMap[cleanUser];

      let mediaList = [];
      if (connectedAccount && connectedAccount.access_token_encrypted) {
        mediaList = await fetchLatestConnectedMedia(connectedAccount);
      }

      // If no token or token query returned empty, try public scraper
      if (!mediaList || mediaList.length === 0) {
        mediaList = await fetchLatestPublicMedia(cleanUser);
      }

      if (mediaList && mediaList.length > 0) {
        // Look at the latest 3 posts
        for (const post of mediaList.slice(0, 3)) {
          if (post?.permalink) {
            await triggerAutoBoostForPermalink({
              userId: rule.user_id,
              username: cleanUser,
              permalink: post.permalink,
              mediaType: post.media_type || 'ALL',
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('[AutoPilot Worker Error]:', err.message);
  } finally {
    isChecking = false;
  }
}

/**
 * Start AutoPilot background interval
 */
export function startSmmAutoPilotWorker({ intervalMs = 2 * 60 * 1000 } = {}) {
  if (workerInterval) {
    clearInterval(workerInterval);
  }

  console.log(
    `[AutoPilot Worker] Started. Polling active rules every ${intervalMs / 1000}s...`
  );

  // Run initial check after 3 seconds
  setTimeout(() => {
    checkActiveAutoPilotSubscriptions().catch((err) =>
      console.error('[AutoPilot Initial Check Error]:', err)
    );
  }, 3000);

  workerInterval = setInterval(() => {
    checkActiveAutoPilotSubscriptions().catch((err) =>
      console.error('[AutoPilot Polling Error]:', err)
    );
  }, intervalMs);

  return workerInterval;
}
