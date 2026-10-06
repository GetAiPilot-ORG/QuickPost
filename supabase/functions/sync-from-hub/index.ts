import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-sync-secret, Authorization",
};

function jsonRes(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// Plans that include Social Pilot access mapping dictionary
const HUB_PLAN_MAPPING: Record<string, "free" | "slite" | "sgrowth"> = {
  "free": "free",
  "free_trial": "free",
  "social_pilot_starter": "slite",
  "social_pilot_growth": "sgrowth",
  "social_pilot_pro": "sgrowth",
  "social_pilot_quarterly": "slite",
  "social_pilot_half_yearly": "slite",
  "all_in_one_bundle": "sgrowth",
  "all_in_one_bundle_monthly": "sgrowth",
  "all_in_one_bundle_quarterly": "sgrowth",
  "all_in_one_bundle_half_yearly": "sgrowth",
  "all_in_one_bundle_yearly": "sgrowth",
  "custom_bundle": "sgrowth",
  "custom_bundle_monthly": "sgrowth",
  "custom_bundle_quarterly": "sgrowth",
  "custom_bundle_half_yearly": "sgrowth",
  "custom_bundle_yearly": "sgrowth",
  "custom": "sgrowth",
  "gap_core": "sgrowth",
  "gap_max": "sgrowth",
  "gap_ultimate_ecosystem": "sgrowth",
  "spstarter": "slite",
  "spgrowth": "sgrowth",
  "enterprise": "sgrowth",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST")
    return jsonRes(405, { error: "Method not allowed" });

  // ── Auth ──────────────────────────────────────────────────────────────────
  const syncSecret = Deno.env.get("SOCIAL_SYNC_SECRET") ?? "";
  const incoming = req.headers.get("x-sync-secret") ?? "";

  if (!syncSecret || incoming !== syncSecret) {
    console.error("[sync-from-hub] Unauthorized");
    return jsonRes(401, { error: "Unauthorized" });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !supabaseKey) {
    return jsonRes(500, { error: "Server misconfiguration" });
  }

  try {
    const body = await req.json();
    const {
      email,
      name,
      hub_user_id,
      profile_picture,
      plan_id,
      plan_label,
      subscription_status,
      expires_at,
    } = body;

    if (!email) {
      return jsonRes(400, { error: "email is required" });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    // Normalize plan_id and plan_label to match mapping keys
    const rawPlanId = plan_id ? String(plan_id).toLowerCase().trim() : "";
    const rawPlanNorm = rawPlanId.replace(/\s+/g, '_');
    let mappedPlan = HUB_PLAN_MAPPING[rawPlanId] || HUB_PLAN_MAPPING[rawPlanNorm] || "free";
    
    if (mappedPlan === "free" && plan_label) {
      const rawLabel = String(plan_label).toLowerCase().trim();
      const rawLabelNorm = rawLabel.replace(/\s+/g, '_');
      mappedPlan = HUB_PLAN_MAPPING[rawLabel] || HUB_PLAN_MAPPING[rawLabelNorm] || "free";
    }
    
    // Normalize status.
    const rawStatus = subscription_status ? String(subscription_status).trim().toLowerCase() : "";
    const isActive = ["active", "created", "authenticated", "trialing"].includes(rawStatus);

    // 1. Fetch existing subscription for expires_at fallback
    const { data: existingSub } = await supabase
      .from("hub_subscriptions")
      .select("expires_at, plan, plan_id, subscription_status")
      .eq("email", email)
      .maybeSingle();

    // Map storedPlan name for display (requires explicit active status check)
    let storedPlan = "Free";
    if (mappedPlan !== "free" && isActive) {
      storedPlan = plan_label ? String(plan_label).trim() : mappedPlan;
    }

    // null expires_at in payload must not accidentally erase existing valid non-null expires_at in DB
    const finalExpiresAt = expires_at || existingSub?.expires_at || null;

    // ── Upsert into hub_subscriptions (email as primary key) ──────────────
    const record: Record<string, unknown> = {
      email,
      plan: storedPlan,
      plan_id: plan_id || null, // Write raw plan_id to DB
      subscription_status: subscription_status ? String(subscription_status).trim() : (existingSub?.subscription_status || 'active'),
      updated_at: new Date().toISOString(),
      synced_at: new Date().toISOString(),
    };

    if (name) record.name = name;
    if (hub_user_id) record.hub_user_id = hub_user_id;
    if (profile_picture) record.profile_picture = profile_picture;
    if (finalExpiresAt) record.expires_at = finalExpiresAt;

    const { error: upsertError } = await supabase
      .from("hub_subscriptions")
      .upsert(record, { onConflict: "email" });

    if (upsertError) {
      console.error("[sync-from-hub] Upsert failed:", upsertError.message);
      return jsonRes(500, { error: upsertError.message });
    }

    console.log(
      `[sync-from-hub] ✅ ${email} → plan=${storedPlan} (${plan_id})`,
    );

    return jsonRes(200, {
      success: true,
      email,
      plan: storedPlan,
      message: "Hub subscription synced to social DB",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error";
    console.error("[sync-from-hub] Error:", msg);
    return jsonRes(500, { error: msg });
  }
});
