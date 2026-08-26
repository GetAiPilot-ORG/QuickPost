export type DeliveryPlanId = "free" | "pro" | "enterprise";

export type BrandableAction = { type: string; text?: string };

export const SOCIALPILOT_WATERMARK =
  "\n\n⚡ Automation is powered by @Getaipilot";

export const STORED_BRANDING_PATTERN =
  /\n*\s*_?(?:⚡\s*)?(?:Automation is powered by @Getaipilot|This automation powered by @getaipilot|This automation is from SocialPilot \(social\.getaipilot\.in\)|Automated via QuickPost\.co \(Get it Free\))_?\s*$/i;

export const stripBrandingWatermark = (text: string) =>
  String(text || "")
    .replace(STORED_BRANDING_PATTERN, "")
    .trimEnd();

export const applyDeliveryBranding = <T extends BrandableAction>(
  actions: T[],
  isFreePlan: boolean,
): T[] => {
  const cleaned = actions.map((action) =>
    action.type === "text"
      ? { ...action, text: stripBrandingWatermark(action.text || "") }
      : action,
  ) as T[];

  if (!isFreePlan) return cleaned;

  const firstTextIndex = cleaned.findIndex((action) => action.type === "text");
  if (firstTextIndex !== -1) {
    return cleaned.map((action, index) =>
      index === firstTextIndex
        ? { ...action, text: `${action.text || ""}${SOCIALPILOT_WATERMARK}` }
        : action,
    ) as T[];
  }

  // No text action exists, so send the watermark as its own text message.
  return [
    ...cleaned,
    { type: "text", text: SOCIALPILOT_WATERMARK.trim() } as T,
  ];
};

const PAID_PLANS = new Set([
  "pro",
  "enterprise",
  "starter",
  "slite",
  "growth",
  "sgrowth",
  "scale",
  "sscale",
  "custom_bundle",
  "custom_bundle_monthly",
  "custom_bundle_quarterly",
  "custom_bundle_half_yearly",
  "custom_bundle_yearly",
  "custom",
  "gap_core",
  "gap_max",
  "gap_ultimate_ecosystem",
  "spstarter",
  "spgrowth",
  "social_pilot_starter",
  "social_pilot_growth",
  "social_pilot_pro",
  "all_in_one_bundle",
  "all_in_one_bundle_monthly",
  "all_in_one_bundle_quarterly",
  "all_in_one_bundle_half_yearly",
  "all_in_one_bundle_yearly",
]);

export const isPaidPlan = (planId?: string | null): boolean => {
  if (!planId) return false;
  const normalized = String(planId).toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (["free", "free_trial", "none"].includes(normalized)) return false;
  return PAID_PLANS.has(normalized) || !normalized.includes("free");
};

export const getDeliveryPlan = (
  subscriptions: Array<{
    plan_id?: string | null;
    status?: string | null;
    current_period_end?: string | null;
    trial_ends_at?: string | null;
    grace_period_ends_at?: string | null;
  }>,
  now = Date.now(),
): { id: DeliveryPlanId; replyLimit: number } => {
  const rank: Record<string, number> = {
    free: 0,
    free_trial: 0,
    slite: 1,
    starter: 1,
    social_pilot_starter: 1,
    sgrowth: 2,
    growth: 2,
    pro: 2,
    social_pilot_growth: 2,
    social_pilot_pro: 2,
    custom_bundle: 2,
    sscale: 3,
    scale: 3,
    enterprise: 3,
  };

  const usable = subscriptions
    .filter((subscription) => {
      if (!["active", "trialing"].includes(String(subscription.status)))
        return false;
      if(
        subscription.grace_period_ends_at &&
        Date.parse(subscription.grace_period_ends_at) >= now
      )
        return true;
      if(
        subscription.current_period_end &&
        Date.parse(subscription.current_period_end) < now
      )
        return false;
      if(
        subscription.status === "trialing" &&
        subscription.trial_ends_at &&
        Date.parse(subscription.trial_ends_at) < now
      )
        return false;
      return true;
    })
    .sort(
      (a, b) =>
        (rank[String(a.plan_id).toLowerCase()] ?? (isPaidPlan(a.plan_id) ? 2 : 0)) -
        (rank[String(b.plan_id).toLowerCase()] ?? (isPaidPlan(b.plan_id) ? 2 : 0)),
    )
    .reverse()[0];

  const isPaid = usable?.plan_id ? isPaidPlan(usable.plan_id) : false;
  const id: DeliveryPlanId = isPaid
    ? String(usable?.plan_id).toLowerCase().includes("enterprise") ||
      String(usable?.plan_id).toLowerCase().includes("scale")
      ? "enterprise"
      : "pro"
    : "free";

  return { id, replyLimit: isPaid ? 1_000_000 : 50 };
};
