import { createClient } from '@supabase/supabase-js';
import supabase from './supabase.js';
import { getPlan } from '../config/plans.js';
import {
  currentMonthPeriod,
  selectBestSubscription,
  todayPeriod,
} from '../config/entitlementPolicy.js';

const HUB_PLAN_MAPPING = {
  'free': 'free',
  'free_trial': 'free',
  'social_pilot_starter': 'slite',
  'social_pilot_growth': 'sgrowth',
  'social_pilot_pro': 'sgrowth',
  'social_pilot_quarterly': 'slite',
  'social_pilot_half_yearly': 'slite',
  'all_in_one_bundle': 'sgrowth',
  'all_in_one_bundle_monthly': 'sgrowth',
  'all_in_one_bundle_quarterly': 'sgrowth',
  'all_in_one_bundle_half_yearly': 'sgrowth',
  'all_in_one_bundle_yearly': 'sgrowth',
  'custom_bundle': 'sgrowth',
  'custom_bundle_monthly': 'sgrowth',
  'custom_bundle_quarterly': 'sgrowth',
  'custom_bundle_half_yearly': 'sgrowth',
  'custom_bundle_yearly': 'sgrowth',
  'custom': 'sgrowth',
  'gap_core': 'sgrowth',
  'gap_max': 'sgrowth',
  'gap_ultimate_ecosystem': 'sgrowth',
  'spstarter': 'slite',
  'spgrowth': 'sgrowth',
  'enterprise': 'sgrowth'
};

const HUB_PLAN_DURATION = {
  'free_trial': 'monthly',
  'social_pilot_starter': 'monthly',
  'social_pilot_growth': 'monthly',
  'social_pilot_pro': 'monthly',
  'social_pilot_quarterly': 'quarterly',
  'social_pilot_half_yearly': 'six_months',
  'all_in_one_bundle_monthly': 'monthly',
  'all_in_one_bundle_quarterly': 'quarterly',
  'all_in_one_bundle_half_yearly': 'six_months',
  'all_in_one_bundle_yearly': 'year',
  'all_in_one_bundle': 'monthly',
  'custom_bundle': 'monthly',
  'custom_bundle_monthly': 'monthly',
  'custom_bundle_quarterly': 'quarterly',
  'custom_bundle_half_yearly': 'six_months',
  'custom_bundle_yearly': 'year',
  'custom': 'monthly',
  'gap_core': 'monthly',
  'gap_max': 'six_months',
  'gap_ultimate_ecosystem': 'monthly',
  'spstarter': 'monthly',
  'spgrowth': 'monthly',
  'enterprise': 'monthly'
};

const entitlementsCache = new Map();
const ENTITLEMENTS_CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes TTL

export function clearEntitlementsCache(userId) {
  if (userId) {
    entitlementsCache.delete(userId);
  } else {
    entitlementsCache.clear();
  }
}

export async function getEntitlements(userId, email = null, token = null) {
  // Check cache first (strictly user-scoped with expiration-aware TTL)
  try {
    const cached = entitlementsCache.get(userId);
    const ttl = cached?._ttl ?? ENTITLEMENTS_CACHE_TTL_MS;
    if (cached && (Date.now() - cached._cachedAt < ttl)) {
      return cached.data;
    }
  } catch (_cacheErr) {
    // Failure safety: cache error falls back directly to database execution
  }

  const { data: subscriptionsData, error } = await supabase
    .from('app_subscriptions')
    .select('plan_id,source,status,billing_interval,current_period_start,current_period_end,trial_ends_at,cancel_at_period_end,grace_period_ends_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error && error.code !== '42P01') {
    throw new Error(`Failed to load subscription: ${error.message}`);
  }

  const subscriptions = subscriptionsData || [];

  // Also query hub_subscriptions via user's email
  try {
    const userEmail = email || (await supabase
      .from('users')
      .select('email')
      .eq('id', userId)
      .maybeSingle()
      .then(res => res.data?.email));

    if (userEmail) {
      // Scoped client using user's own token to satisfy RLS SELECT policy:
      // "Anyone can read hub_subscriptions by own email" (USING (email = auth.jwt() ->> 'email'))
      const clientUrl = process.env.SUPABASE_URL;
      const clientToUse = token ? createClient(clientUrl, process.env.SUPABASE_ANON_KEY, {
        auth: { persistSession: false },
        global: {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      }) : supabase;

      const { data: hubSubscription } = await clientToUse
        .from('hub_subscriptions')
        .select('*')
        .eq('email', userEmail)
        .maybeSingle();

      const subStatus = String(hubSubscription?.subscription_status || '').toLowerCase().trim();
      const isStatusActive = ['active', 'created', 'authenticated', 'trialing'].includes(subStatus);
      if (hubSubscription && isStatusActive) {
        const expiresAt = hubSubscription.expires_at;
        const isNotExpired = !expiresAt || new Date(expiresAt) > new Date();
        if (isNotExpired) {
          // Map hub plan to QuickPost plans. Handle case where plan_id is a JSON array string.
          let planList = [];
          const rawPlanId = hubSubscription.plan_id || hubSubscription.plan || '';
          try {
            const parsed = JSON.parse(rawPlanId);
            if (Array.isArray(parsed)) {
              planList = parsed;
            } else {
              planList = [parsed];
            }
          } catch (e) {
            planList = [rawPlanId];
          }

          let mappedPlanId = 'free';
          let matchedHubPlan = 'free';

          for (const item of planList) {
            const p = String(item || '').toLowerCase().trim();
            const pNorm = p.replace(/\s+/g, '_');
            const matchKey = HUB_PLAN_MAPPING[p] ? p : (HUB_PLAN_MAPPING[pNorm] ? pNorm : null);
            if (matchKey) {
              if (HUB_PLAN_MAPPING[matchKey] === 'sgrowth') {
                mappedPlanId = 'sgrowth';
                matchedHubPlan = matchKey;
                break; // Highest tier, stop searching
              }
              mappedPlanId = HUB_PLAN_MAPPING[matchKey];
              matchedHubPlan = matchKey;
            }
          }

          // Fallback: If still free, check hubSubscription.plan explicitly
          if (mappedPlanId === 'free' && hubSubscription.plan) {
            const p = String(hubSubscription.plan).toLowerCase().trim();
            const pNorm = p.replace(/\s+/g, '_');
            const matchKey = HUB_PLAN_MAPPING[p] ? p : (HUB_PLAN_MAPPING[pNorm] ? pNorm : null);
            if (matchKey) {
              mappedPlanId = HUB_PLAN_MAPPING[matchKey];
              matchedHubPlan = matchKey;
            }
          }

          if (mappedPlanId !== 'free') {
            subscriptions.push({
              plan_id: mappedPlanId,
              source: 'hub',
              status: 'active',
              billing_interval: HUB_PLAN_DURATION[matchedHubPlan] || 'monthly',
              current_period_end: expiresAt || null,
              cancel_at_period_end: false,
              grace_period_ends_at: null,
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to load hub subscription: ', err.message);
  }

  const subscription = selectBestSubscription(subscriptions);
  const plan = getPlan(subscription?.plan_id || 'free');

  let latestActivation = null;
  if (subscription?.source === 'standalone') {
    const { data, error: activationError } = await supabase
      .from('subscription_payment_activations')
      .select('interval_months')
      .eq('user_id', userId)
      .order('activated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (activationError && activationError.code !== '42P01') {
      throw new Error(`Failed to load subscription activation: ${activationError.message}`);
    }
    latestActivation = data;
  }

  const { data: usage, error: usageError } = await supabase
    .from('entitlement_usage')
    .select('metric,used,period_start,period_end')
    .eq('user_id', userId)
    .gte('period_end', new Date().toISOString().slice(0, 10));

  if (usageError && usageError.code !== '42P01') {
    throw new Error(`Failed to load usage: ${usageError.message}`);
  }

  const computed = {
    plan: { id: plan.id, name: plan.name },
    subscription: subscription ? {
      ...subscription,
      interval_months: latestActivation?.interval_months
        || (subscription.billing_interval === 'year' ? 12 : 1),
    } : {
      source: 'standalone',
      status: 'active',
      billing_interval: null,
      interval_months: null,
      current_period_end: null,
      cancel_at_period_end: false,
    },
    features: plan.features,
    limits: plan.limits,
    usage: Object.fromEntries((usage || []).map((row) => [row.metric, row])),
  };

  try {
    // Calculate exact milliseconds remaining until subscription or trial expiration
    const expiryTimestamp = subscription?.current_period_end || subscription?.trial_ends_at || subscription?.grace_period_ends_at;
    const msUntilExpiry = expiryTimestamp ? Date.parse(expiryTimestamp) - Date.now() : ENTITLEMENTS_CACHE_TTL_MS;
    
    // Clamp TTL: Never cache beyond the exact second of subscription expiration
    const effectiveTTL = Math.max(0, Math.min(ENTITLEMENTS_CACHE_TTL_MS, msUntilExpiry));

    if (effectiveTTL > 0) {
      entitlementsCache.set(userId, { data: computed, _cachedAt: Date.now(), _ttl: effectiveTTL });
    }
  } catch (_err) { }

  return computed;
}

export async function consumeUsage(userId, metric, amount = 1, cadence = 'month') {
  try {
    const entitlements = await getEntitlements(userId);
    const limit = entitlements.limits[metric];
    if (!Number.isFinite(limit)) {
      throw new Error(`Unknown metered entitlement: ${metric}`);
    }

    const period = cadence === 'day' ? todayPeriod() : currentMonthPeriod();
    const { data, error } = await supabase.rpc('consume_entitlement_usage', {
      p_user_id: userId,
      p_metric: metric,
      p_amount: amount,
      p_limit: limit,
      p_period_start: period.start,
      p_period_end: period.end,
    });

    if (error) {
      console.warn(`[ENTITLEMENTS] Failed to reserve usage via RPC for user ${userId}:`, error.message);
      return { allowed: true, used: 1, limit_value: limit, entitlements };
    }
    const result = data?.[0] || { allowed: true, used: 1, limit_value: limit };

    // Invalidate user cache on usage mutation so subsequent reads get fresh usage counts
    clearEntitlementsCache(userId);

    return { ...result, entitlements };
  } catch (err) {
    console.warn(`[ENTITLEMENTS] Graceful fallback on consumeUsage for user ${userId}:`, err.message);
    return { allowed: true, used: 1, limit_value: 9999 };
  }
}

export async function countUserResource(userId, table, filters = {}) {
  let query = supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  const { count, error } = await query;
  if (error) throw new Error(`Failed to count ${table}: ${error.message}`);
  return count || 0;
}
