const ACCESS_STATUSES = new Set(['trialing', 'active']);
const PLAN_RANK = Object.freeze({
  free: 0,
  slite: 1,
  pro: 1,
  sgrowth: 2,
  gap_core: 3,
  gap_scale: 4,
  enterprise: 4,
});

export function subscriptionIsUsable(subscription, now = Date.now()) {
  if (!subscription || !ACCESS_STATUSES.has(subscription.status)) return false;
  if (subscription.grace_period_ends_at && Date.parse(subscription.grace_period_ends_at) >= now) {
    return true;
  }
  if (subscription.current_period_end && Date.parse(subscription.current_period_end) < now) {
    return false;
  }
  if (subscription.status === 'trialing' && subscription.trial_ends_at) {
    return Date.parse(subscription.trial_ends_at) >= now;
  }
  return true;
}

export function currentMonthPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export function todayPeriod(now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  return { start: day, end: day };
}

export function selectBestSubscription(subscriptions, now = Date.now()) {
  return (subscriptions || [])
    .filter((candidate) => subscriptionIsUsable(candidate, now))
    .sort((a, b) => (PLAN_RANK[b.plan_id] || 0) - (PLAN_RANK[a.plan_id] || 0))[0] || null;
}
