import supabase from './supabase.js';
import { currentMonthPeriod } from '../config/entitlementPolicy.js';
import { decryptToken } from './instapilot.js';
import { getEntitlements, clearEntitlementsCache } from './entitlements.js';
import { syncAutoDMMessageToInbox } from './inboxSyncWorker.js';
import { createFollowupProcessor } from './autodmFollowups.js';

async function reserveUsage(userId, alreadyReserved) {
  const entitlements = await getEntitlements(userId);
  const limit = entitlements.limits.autodm_replies_per_month;
  if (!Number.isFinite(limit)) throw new Error('Auto DM reply entitlement unavailable');
  if (alreadyReserved) return { allowed: true, isFreePlan: entitlements.plan?.id === 'free' };
  const { start, end } = currentMonthPeriod();
  const { data, error } = await supabase.rpc('consume_entitlement_usage', {
    p_user_id: userId, p_metric: 'autodm_replies_per_month', p_amount: 1,
    p_limit: limit, p_period_start: start, p_period_end: end,
  });
  if (error || !data?.[0]) throw new Error('Unable to reserve Auto DM reply usage');
  clearEntitlementsCache(userId);
  return { allowed: data[0].allowed === true, isFreePlan: entitlements.plan?.id === 'free' };
}

export function initAutoDMFollowups() {
  const processDue = createFollowupProcessor({ db: supabase, decryptToken, reserveUsage, syncMessage: syncAutoDMMessageToInbox });
  let running = false;
  let migrationWarningShown = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await processDue(); migrationWarningShown = false; }
    catch (error) {
      if (!migrationWarningShown) console.warn('[AUTODM-FOLLOWUP] Worker unavailable; apply follow-up migration if needed:', error.message);
      migrationWarningShown = true;
    } finally { running = false; }
  };
  const timer = setInterval(tick, 30000);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
