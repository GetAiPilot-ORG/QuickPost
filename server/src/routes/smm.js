import express from 'express';
import { authenticateUser } from '../middleware/authenticateUser.js';
import supabase from '../services/supabase.js';
import {
  getAllSocialGrowthServices,
  getInstagramServices,
  getBalance,
  getOrderStatus,
  createSubscription,
  syncServicesToSupabase,
} from '../services/smmService.js';
import { processSmmOrderQueue } from '../services/smmQueueWorker.js';
import { checkActiveAutoPilotSubscriptions } from '../services/smmAutoPilotWorker.js';

const router = express.Router();

const getUserId = (req) => req.user?.id || req.user?.authUserId || req.user?.userId;

/**
 * GET /api/smm/services
 * Fetch all social growth services with dynamic pricing from Supabase sg_services
 */
router.get('/services', async (req, res) => {
  try {
    const forceRefresh = req.query.force === 'true';
    const platforms = await getAllSocialGrowthServices({ forceRefresh });

    // Record snapshot into sg_admin_analytics
    try {
      await supabase.from('sg_admin_analytics').insert({
        snapshot_date: new Date().toISOString().split('T')[0],
        total_customers: customerList.length || users.length || 0,
        total_revenue_billed: Number(totalRevenueBilled.toFixed(2)),
        total_provider_spend: totalProviderSpend,
        net_profit: netProfitEarned,
        profit_margin_pct: overallMarginPct,
        total_orders_count: orders.length,
        total_wallet_liability: Number(totalWalletLiability.toFixed(2)),
        telesmm_live_balance: teleSmmBalance?.balance ? parseFloat(teleSmmBalance.balance) : null,
        metadata: {
          active_orders: orders.filter(o => o.status === 'processing' || o.status === 'pending').length,
          completed_orders: orders.filter(o => o.status === 'completed').length,
          last_synced_at: new Date().toISOString()
        }
      });
    } catch (snapErr) {
      console.warn('[Admin] Snapshot record note:', snapErr.message);
    }

    return res.json({
      success: true,
      platforms,
      counts: {
        instagram: platforms.instagram?.length || 0,
        youtube: platforms.youtube?.length || 0,
        x: platforms.x?.length || 0,
        tiktok: platforms.tiktok?.length || 0,
      },
    });
  } catch (error) {
    console.error('[SMM Routes] Error fetching all services:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch social growth services',
    });
  }
});

/**
 * GET /api/smm/live-activity
 * Fetch real-time live platform activity (real recent orders from sg_orders)
 */
router.get('/live-activity', async (req, res) => {
  try {
    const [recentOrdersRes, allOrdersRes] = await Promise.all([
      supabase
        .from('sg_orders')
        .select('id, quantity, service_id, target_link, status, created_at, sg_services(name, platform, category)')
        .order('created_at', { ascending: false })
        .limit(6),
      supabase
        .from('sg_orders')
        .select('status'),
    ]);

    const recentOrders = recentOrdersRes.data || [];
    const allStatuses = (allOrdersRes.data || []).map((o) => (o.status || '').toLowerCase());
    const totalCount = allStatuses.length;
    const completedCount = allStatuses.filter((s) => s === 'completed').length;
    const failedCount = allStatuses.filter((s) => ['failed', 'canceled', 'cancelled'].includes(s)).length;
    const inQueueCount = allStatuses.filter((s) => ['queued', 'processing', 'in_progress'].includes(s)).length;

    const finalized = completedCount + failedCount;
    const successRate =
      finalized > 0
        ? `${((completedCount / finalized) * 100).toFixed(1)}%`
        : totalCount > 0
        ? '100.0%'
        : '99.8%';

    if (!recentOrders || recentOrders.length === 0) {
      return res.json({
        success: true,
        activities: [],
        successRate,
        stats: {
          total: totalCount,
          completed: completedCount,
          inQueue: inQueueCount,
          failed: failedCount,
        },
        avgStartTime: '45 seconds',
      });
    }

    const activities = recentOrders.map((ord) => {
      let targetTag = 'Post';
      try {
        const urlStr = ord.target_link || '';
        const instaReel = urlStr.match(/instagram\.com\/(?:reel|reels)\/([A-Za-z0-9_-]+)/i);
        const instaPost = urlStr.match(/instagram\.com\/p\/([A-Za-z0-9_-]+)/i);
        const instaUser = urlStr.match(/instagram\.com\/([A-Za-z0-9_.-]+)/i);

        if (instaReel) {
          targetTag = `reel/${instaReel[1].slice(0, 6)}...`;
        } else if (instaPost) {
          targetTag = `post/${instaPost[1].slice(0, 6)}...`;
        } else if (instaUser && !['p', 'reel', 'reels', 'explore', 'stories'].includes(instaUser[1].toLowerCase())) {
          targetTag = `@${instaUser[1]}`;
        } else if (urlStr.includes('youtube.com/') || urlStr.includes('youtu.be/')) {
          targetTag = 'Video';
        } else if (urlStr.includes('x.com/') || urlStr.includes('twitter.com/')) {
          targetTag = 'Tweet';
        } else if (urlStr.includes('tiktok.com/')) {
          targetTag = 'TikTok';
        } else if (urlStr.startsWith('@')) {
          targetTag = urlStr;
        }
      } catch {
        targetTag = 'Media';
      }

      const rawName = ord.sg_services?.name || '';
      const category = ord.sg_services?.category || '';
      let serviceLabel = 'Boost';
      if (/likes?/i.test(rawName) || /likes?/i.test(category)) serviceLabel = 'Likes';
      else if (/views?|impressions?/i.test(rawName) || /views?/i.test(category)) serviceLabel = 'Views';
      else if (/followers?|subscribers?/i.test(rawName) || /followers?/i.test(category)) serviceLabel = 'Followers';
      else if (/comments?/i.test(rawName) || /comments?/i.test(category)) serviceLabel = 'Comments';
      else serviceLabel = rawName.slice(0, 20);

      const platform = (ord.sg_services?.platform || 'instagram').toLowerCase();

      return {
        id: ord.id,
        quantity: ord.quantity,
        serviceLabel,
        serviceName: rawName,
        platform,
        targetTag,
        status: ord.status,
        createdAt: ord.created_at,
      };
    });

    return res.json({
      success: true,
      activities,
      successRate,
      stats: {
        total: totalCount,
        completed: completedCount,
        inQueue: inQueueCount,
        failed: failedCount,
      },
      avgStartTime: '45 seconds',
    });
  } catch (error) {
    console.error('[SMM Live Activity Error]:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/smm/sync-services
 * Admin helper to sync TeleSMM services into Supabase sg_services with profit markup
 */
router.post('/sync-services', authenticateUser, async (req, res) => {
  try {
    const markupPercentage = parseFloat(req.body.markupPercentage) || 30;
    const fixedMarkup = parseFloat(req.body.fixedMarkup) || 0;

    const syncResult = await syncServicesToSupabase({ markupPercentage, fixedMarkup });

    return res.json({
      success: true,
      message: `Successfully synced ${syncResult.syncedCount} services to Supabase sg_services!`,
      markupPercentage,
    });
  } catch (error) {
    console.error('[SMM Routes] Error syncing services:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync services',
    });
  }
});

import {
  createRazorpayOrder,
  verifyRazorpayPaymentSignature,
} from '../services/razorpayWalletService.js';

/**
 * GET /api/smm/wallet
 * Get logged-in user's wallet balance & recent transactions
 */
router.get('/wallet', authenticateUser, async (req, res) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }

    // Fetch wallet (auto-create if doesn't exist)
    let { data: wallet, error: walletErr } = await supabase
      .from('sg_wallets')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (!wallet) {
      const { data: newWallet, error: createErr } = await supabase
        .from('sg_wallets')
        .insert({ user_id: userId, balance: 0.0 })
        .select()
        .single();
      if (createErr) throw createErr;
      wallet = newWallet;
    }

    // Fetch recent transactions
    const { data: transactions } = await supabase
      .from('sg_wallet_transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    return res.json({
      success: true,
      wallet: {
        balance: parseFloat(wallet.balance || 0),
        currency: wallet.currency || 'INR',
        updated_at: wallet.updated_at,
      },
      transactions: transactions || [],
    });
  } catch (error) {
    console.error('[SMM Wallet Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch wallet information',
    });
  }
});

/**
 * POST /api/smm/wallet/topup/create-order
 * Create a Razorpay checkout order for wallet deposit
 */
router.post('/wallet/topup/create-order', authenticateUser, async (req, res) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || amount < 10) {
      return res.status(400).json({
        success: false,
        error: 'Minimum top-up amount is ₹10.00',
      });
    }

    const userId = getUserId(req);
    const orderData = await createRazorpayOrder({
      amount,
      currency: 'INR',
      receipt: `sg_topup_${(userId || 'user').slice(0, 8)}_${Date.now()}`,
    });

    return res.json({
      success: true,
      order: orderData,
    });
  } catch (error) {
    console.error('[SMM Wallet Topup Create Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to initialize payment gateway',
    });
  }
});

/**
 * POST /api/smm/wallet/topup/verify
 * Cryptographically verify payment and credit funds into user's wallet
 */
router.post('/wallet/topup/verify', authenticateUser, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required payment verification details.',
      });
    }

    // 1. Verify cryptographic HMAC signature
    const isValid = verifyRazorpayPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      return res.status(400).json({
        success: false,
        error: 'Payment verification failed: Invalid signature.',
      });
    }

    // 2. Check for duplicate credit
    const { data: existingTx } = await supabase
      .from('sg_wallet_transactions')
      .select('id')
      .eq('reference_id', razorpay_payment_id)
      .maybeSingle();

    if (existingTx) {
      return res.json({
        success: true,
        message: 'Payment was already credited.',
      });
    }

    // 3. Atomically credit funds to user's wallet
    const depositAmount = parseFloat(amount);
    const { data: newBalance, error: creditErr } = await supabase.rpc('sg_add_wallet_funds', {
      p_user_id: userId,
      p_amount: depositAmount,
      p_payment_id: razorpay_payment_id,
      p_description: `Wallet top-up via Razorpay (Payment ID: ${razorpay_payment_id})`,
    });

    if (creditErr) {
      console.error('[SMM Wallet Credit Error]:', creditErr);
      return res.status(500).json({
        success: false,
        error: 'Payment succeeded but failed to update wallet. Contact support with Payment ID: ' + razorpay_payment_id,
      });
    }

    return res.json({
      success: true,
      message: `₹${depositAmount.toFixed(2)} added to your wallet successfully!`,
      new_balance: newBalance,
      payment_id: razorpay_payment_id,
    });
  } catch (error) {
    console.error('[SMM Wallet Verify Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Payment verification failed',
    });
  }
});

/**
 * POST /api/smm/orders (Supports Single and Multiple Simultaneous Orders)
 * Deducts wallet atomically and queues orders for one-by-one background processing
 */
router.post('/orders', authenticateUser, async (req, res) => {
  try {
    const userId = getUserId(req);
    let orderItems = [];

    // Support both multi-order array { orders: [...] } and single order payload
    if (Array.isArray(req.body.orders)) {
      orderItems = req.body.orders;
    } else if (req.body.service || req.body.service_id) {
      orderItems = [
        {
          service_id: req.body.service || req.body.service_id,
          link: req.body.link || req.body.target_link,
          quantity: req.body.quantity,
        },
      ];
    }

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide at least one order item.',
      });
    }

    // 1. Fetch DB pricing for all requested services
    const requestedServiceIds = [...new Set(orderItems.map((o) => String(o.service_id || o.service)))];
    const { data: servicesInDb, error: svcErr } = await supabase
      .from('sg_services')
      .select('*')
      .in('service_id', requestedServiceIds);

    if (svcErr || !servicesInDb || servicesInDb.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Could not resolve service pricing. Please check service IDs.',
      });
    }

    const servicePriceMap = new Map();
    servicesInDb.forEach((s) => servicePriceMap.set(s.service_id, s));

    // 2. Validate items & calculate total batch cost
    let totalBatchCost = 0;
    const validatedOrders = [];

    for (const item of orderItems) {
      const sId = String(item.service_id || item.service);
      const link = String(item.link || item.target_link || '').trim();
      const qty = parseInt(item.quantity, 10);

      if (!sId || !link || !qty || qty <= 0) {
        return res.status(400).json({
          success: false,
          error: `Invalid order parameters for service ${sId}. Link and quantity > 0 are required.`,
        });
      }

      const dbService = servicePriceMap.get(sId);
      if (!dbService) {
        return res.status(400).json({
          success: false,
          error: `Service ID ${sId} is not available or inactive.`,
        });
      }

      if (qty < dbService.min_quantity || qty > dbService.max_quantity) {
        return res.status(400).json({
          success: false,
          error: `${dbService.name}: Quantity must be between ${dbService.min_quantity} and ${dbService.max_quantity}.`,
        });
      }

      const pricePerK = parseFloat(dbService.price_per_k);
      const itemCost = Number(((qty / 1000) * pricePerK).toFixed(4));
      totalBatchCost = Number((totalBatchCost + itemCost).toFixed(4));

      validatedOrders.push({
        user_id: userId,
        service_id: sId,
        target_link: link,
        quantity: qty,
        price_per_k: pricePerK,
        total_cost: itemCost,
        status: 'queued',
      });
    }

    // 3. Atomically check and deduct wallet for the entire batch
    const { data: checkoutResult, error: checkoutErr } = await supabase.rpc(
      'sg_process_multi_order_checkout',
      {
        p_user_id: userId,
        p_total_amount: totalBatchCost,
        p_description: `Growth Order (${validatedOrders.length} item${validatedOrders.length > 1 ? 's' : ''})`,
      }
    );

    if (checkoutErr || !checkoutResult?.[0]?.success) {
      return res.status(400).json({
        success: false,
        error: checkoutResult?.[0]?.message || 'Insufficient wallet balance for this order.',
      });
    }

    // 4. Insert orders into sg_orders table as 'queued'
    const { data: insertedOrders, error: insertErr } = await supabase
      .from('sg_orders')
      .insert(validatedOrders)
      .select();

    if (insertErr) {
      // Auto-refund on catastrophic DB insert error
      await supabase.rpc('sg_refund_failed_order', {
        p_user_id: userId,
        p_amount: totalBatchCost,
        p_order_id: 'ORDER_INIT_FAIL',
        p_reason: 'Refund: Database order placement error',
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to record orders in database. Funds have been refunded.',
      });
    }

    // 5. Trigger Queue Worker asynchronously in background (doesn't block user response!)
    processSmmOrderQueue().catch((err) =>
      console.error('[SMM Routes] Queue trigger error:', err)
    );

    return res.json({
      success: true,
      message: `Successfully placed ${insertedOrders.length} order(s)! Processing in background.`,
      orders: insertedOrders,
      total_deducted: totalBatchCost,
      new_balance: checkoutResult[0].new_balance,
    });
  } catch (error) {
    console.error('[SMM Orders Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to place order',
    });
  }
});

// Single order alias (for backward compatibility)
router.post('/order', (req, res, next) => {
  req.url = '/orders';
  router.handle(req, res, next);
});

/**
 * POST /api/smm/subscription
 * Order Instagram Auto-Likes / Auto-Views Subscription
 */
router.post('/subscription', authenticateUser, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { service, username, min, max, posts, delay, expiry } = req.body;

    if (!service || !username || !min || !max || !posts) {
      return res.status(400).json({
        success: false,
        error: 'Missing required subscription fields (service, username, min, max, posts).',
      });
    }

    const serviceIdStr = String(service);
    // 1. Fetch dynamic pricing from sg_services
    const { data: dbService, error: svcErr } = await supabase
      .from('sg_services')
      .select('*')
      .eq('service_id', serviceIdStr)
      .maybeSingle();

    if (svcErr || !dbService) {
      return res.status(400).json({
        success: false,
        error: `Service ID ${serviceIdStr} not found in database.`,
      });
    }

    const pricePerK = parseFloat(dbService.price_per_k);
    const minQty = Number(min);
    const maxQty = Number(max);
    const svcMin = dbService.min_quantity || 10;
    const svcMax = dbService.max_quantity || 1000000;

    if (minQty < svcMin) {
      return res.status(400).json({
        success: false,
        error: `Minimum quantity per post for this service is ${svcMin}. You entered ${minQty}.`,
      });
    }

    if (maxQty > svcMax) {
      return res.status(400).json({
        success: false,
        error: `Maximum quantity per post for this service is ${svcMax}. You entered ${maxQty}.`,
      });
    }

    if (minQty > maxQty) {
      return res.status(400).json({
        success: false,
        error: `Min quantity (${minQty}) cannot be greater than Max quantity (${maxQty}).`,
      });
    }

    const totalQty = Number(posts) * maxQty;
    const totalCost = Number(((totalQty / 1000) * pricePerK).toFixed(2));

    // 2. Atomic Wallet Deduction
    const { data: checkoutResult, error: checkoutErr } = await supabase.rpc(
      'sg_process_multi_order_checkout',
      {
        p_user_id: userId,
        p_total_amount: totalCost,
        p_description: `Instagram Auto-Boost (@${username}) - ${posts} posts`,
      }
    );

    if (checkoutErr || !checkoutResult?.[0]?.success) {
      return res.status(400).json({
        success: false,
        error: checkoutResult?.[0]?.message || 'Insufficient wallet balance for this subscription.',
      });
    }

    // Map to verified high-speed single post service IDs for guaranteed delivery
    let targetServiceId = serviceIdStr;
    let ruleType = 'auto_likes';
    if (serviceIdStr === '4381' || dbService.name.toLowerCase().includes('view')) {
      targetServiceId = '4348';
      ruleType = 'auto_views';
    } else if (serviceIdStr === '4380' || dbService.name.toLowerCase().includes('like')) {
      targetServiceId = '4349';
      ruleType = 'auto_likes';
    }

    // 3. Save to sg_subscriptions table as Active Auto-Pilot Rule
    const { data: newSubRecord, error: subDbErr } = await supabase
      .from('sg_subscriptions')
      .insert({
        user_id: userId,
        provider_subscription_id: `AUTOPILOT_${Date.now()}`,
        service_id: targetServiceId,
        platform: 'instagram',
        type: ruleType,
        username: username.replace(/^@/, '').trim(),
        min_quantity: minQty,
        max_quantity: maxQty,
        posts_total: Number(posts),
        posts_remaining: Number(posts),
        delay_minutes: Number(delay || 5),
        price_per_k: pricePerK,
        total_charged: totalCost,
        status: 'Active',
      })
      .select()
      .single();

    if (subDbErr) {
      // Auto-refund on DB insertion error
      await supabase.rpc('sg_refund_failed_order', {
        p_user_id: userId,
        p_amount: totalCost,
        p_order_id: 'SUB_INIT_FAIL',
        p_reason: 'Database subscription recording failure',
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to record Auto-Pilot subscription in database. Funds refunded.',
      });
    }

    // 4. Trigger immediate post detection in background
    checkActiveAutoPilotSubscriptions().catch((err) =>
      console.error('[SMM Routes] Initial AutoPilot check error:', err)
    );

    return res.json({
      success: true,
      message: `✨ Auto-Pilot successfully activated for @${username} on your next ${posts} posts!`,
      subscription: newSubRecord,
      new_balance: checkoutResult[0].new_balance,
    });
  } catch (error) {
    console.error('[SMM Subscription Route Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
});

/**
 * DELETE /api/smm/subscription/:id
 * Cancel an active Auto-Pilot rule and refund remaining posts pro-rata
 */
router.delete('/subscription/:id', authenticateUser, async (req, res) => {
  try {
    const userId = getUserId(req);
    const subId = req.params.id;

    const { data: sub, error } = await supabase
      .from('sg_subscriptions')
      .select('*')
      .eq('id', subId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !sub) {
      return res.status(404).json({
        success: false,
        error: 'Subscription rule not found',
      });
    }

    if (sub.status === 'Canceled' || sub.status === 'Completed') {
      return res.json({
        success: true,
        message: `Subscription is already ${sub.status.toLowerCase()}.`,
      });
    }

    // Calculate pro-rata refund for remaining unused posts
    const postsRemaining = Number(sub.posts_remaining || 0);
    const postsTotal = Number(sub.posts_total || 1);
    const totalCharged = parseFloat(sub.total_charged || 0);
    const refundAmount = Number(((postsRemaining / postsTotal) * totalCharged).toFixed(2));

    let newBalance = null;
    if (refundAmount > 0) {
      const { data: balanceData } = await supabase.rpc('sg_refund_failed_order', {
        p_user_id: userId,
        p_amount: refundAmount,
        p_order_id: sub.id,
        p_reason: `Refund: Auto-Pilot cancelled (${postsRemaining}/${postsTotal} posts unused)`,
      });
      newBalance = balanceData;
    }

    await supabase
      .from('sg_subscriptions')
      .update({
        status: 'Canceled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sub.id);

    return res.json({
      success: true,
      message: `Auto-Pilot cancelled. ₹${refundAmount.toFixed(2)} refunded to wallet.`,
      refunded_amount: refundAmount,
      new_balance: newBalance,
    });
  } catch (error) {
    console.error('[SMM Subscription Cancel Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to cancel subscription',
    });
  }
});

/**
 * GET /api/smm/orders
 * Get current user's order history
 */
router.get('/orders', authenticateUser, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { data: orders, error } = await supabase
      .from('sg_orders')
      .select('*, sg_services(name, category, platform)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return res.json({
      success: true,
      orders: orders || [],
    });
  } catch (error) {
    console.error('[SMM Orders Fetch Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch orders',
    });
  }
});

/**
 * GET /api/smm/subscriptions
 * Get current user's active auto-subscriptions
 */
router.get('/subscriptions', authenticateUser, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { data: subs, error } = await supabase
      .from('sg_subscriptions')
      .select('*, sg_services(name, category, platform)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.json({
      success: true,
      subscriptions: subs || [],
    });
  } catch (error) {
    console.error('[SMM Subscriptions Fetch Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch subscriptions',
    });
  }
});

/**
 * GET /api/smm/balance (Provider balance check)
 */
router.get('/balance', async (req, res) => {
  try {
    const balance = await getBalance();
    return res.json({
      success: true,
      balance,
    });
  } catch (error) {
    console.error('[SMM Routes] Error fetching balance:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch balance',
    });
  }
});

/**
 * GET /api/smm/order/:orderId
 */
router.get('/order/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const status = await getOrderStatus(orderId);
    return res.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('[SMM Routes] Error fetching order status:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch order status',
    });
  }
});

export default router;

