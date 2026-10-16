export const PLAN_IDS = Object.freeze({
  FREE: 'free',
  SLITE: 'slite',
  SGROWTH: 'sgrowth',
  GAP_CORE: 'gap_core',
  GAP_SCALE: 'gap_scale',
});

export const PLANS = Object.freeze({
  free: Object.freeze({
    id: 'free',
    name: 'Free',
    prices: Object.freeze({ month: 0, year: 0 }),
    features: Object.freeze({
      publishing: true,
      scheduling: true,
      analytics: true,
      autodm: true,
      approval_workflow: false,
      api: false,
      priority_support: false,
    }),
    limits: Object.freeze({
      social_accounts: 3,
      scheduled_queue: 10,
      team_members: 1,
      history_days: 7,
      autodm_accounts: 3,
      autodm_automations: 1,
      autodm_replies_per_month: 50,
      contacts: 100,
    }),
  }),
  slite: Object.freeze({
    id: 'slite',
    name: 'Starter',
    prices: Object.freeze({ month: 999, year: 9588 }),
    features: Object.freeze({
      publishing: true,
      scheduling: true,
      analytics: true,
      autodm: true,
      approval_workflow: false,
      api: false,
      priority_support: true,
    }),
    limits: Object.freeze({
      social_accounts: 10,
      scheduled_queue: 1000000,
      team_members: 1,
      history_days: 90,
      autodm_accounts: 10,
      autodm_automations: 1000000,
      autodm_replies_per_month: 1000000,
      contacts: 1000000,
    }),
  }),
  sgrowth: Object.freeze({
    id: 'sgrowth',
    name: 'Growth',
    prices: Object.freeze({ month: 1999, year: 19188 }),
    features: Object.freeze({
      publishing: true,
      scheduling: true,
      analytics: true,
      autodm: true,
      approval_workflow: true,
      api: true,
      priority_support: true,
    }),
    limits: Object.freeze({
      social_accounts: 30,
      scheduled_queue: 1000000,
      team_members: 10,
      history_days: 365,
      autodm_accounts: 30,
      autodm_automations: 1000000,
      autodm_replies_per_month: 1000000,
      contacts: 1000000,
    }),
  }),
  gap_core: Object.freeze({
    id: 'gap_core',
    name: 'GAP Core',
    prices: Object.freeze({ month: 4999, year: 49990 }),
    features: Object.freeze({
      publishing: true,
      scheduling: true,
      analytics: true,
      autodm: true,
      approval_workflow: true,
      api: true,
      priority_support: true,
    }),
    limits: Object.freeze({
      social_accounts: 30,
      scheduled_queue: 1000000,
      team_members: 15,
      history_days: 365,
      autodm_accounts: 30,
      autodm_automations: 1000000,
      autodm_replies_per_month: 1000000,
      contacts: 1000000,
    }),
  }),
  gap_scale: Object.freeze({
    id: 'gap_scale',
    name: 'GAP Enterprise',
    prices: Object.freeze({ month: 8999, year: 89990 }),
    features: Object.freeze({
      publishing: true,
      scheduling: true,
      analytics: true,
      autodm: true,
      approval_workflow: true,
      api: true,
      priority_support: true,
    }),
    limits: Object.freeze({
      social_accounts: 50,
      scheduled_queue: 1000000,
      team_members: 25,
      history_days: 365,
      autodm_accounts: 50,
      autodm_automations: 1000000,
      autodm_replies_per_month: 1000000,
      contacts: 1000000,
    }),
  }),
});

export function normalizePlanId(planId) {
  const id = String(planId || '').toLowerCase().trim();
  if (['gap_core', 'gap core', 'all_in_one_bundle_monthly', 'all_in_one_bundle', 'all_in_one_bundle_quarterly', 'all_in_one_bundle_half_yearly', 'all_in_one_bundle_yearly', 'custom_bundle'].includes(id)) return 'gap_core';
  if (['gap_scale', 'gap enterprise', 'gap_scale_quarterly', 'gap_scale_half_yearly', 'gap_scale_yearly', 'enterprise'].includes(id)) return 'gap_scale';
  if (['starter', 'slite', 'pro', '999', 'spstarter'].includes(id)) return 'slite';
  if (['growth', 'sgrowth', '1999', '2999', 'spgrowth'].includes(id)) return 'sgrowth';
  return id || 'free';
}

export function getPlan(planId) {
  return PLANS[normalizePlanId(planId)] || PLANS.free;
}
