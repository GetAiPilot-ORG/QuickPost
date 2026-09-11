import { logError, logInfo } from "./db.ts";

type SupabaseLike = {
  from: (table: string) => any;
};

interface SocialContactSyncInput {
  supabase: SupabaseLike;
  contactId: string;
  userId: string;
  instagramAccountId: string;
  instagramUserId: string;
  username: string;
  fullName?: string | null;
  profilePictureUrl?: string | null;
  requestId?: string;
}

const cleanText = (value?: string | null) => {
  const text = String(value || "").trim();
  return text.length > 0 ? text : null;
};

const resolveHubUserId = async (
  supabase: SupabaseLike,
  socialUserId: string,
): Promise<string | null> => {
  const fallback =
    Deno.env.get("HUB_OWNER_USER_ID") ||
    Deno.env.get("ECOSYSTEM_HUB_USER_ID") ||
    null;

  const { data, error } = await supabase
    .from("users")
    .select("hub_user_id")
    .eq("id", socialUserId)
    .maybeSingle();

  if (error) {
    logError("Social ecosystem owner lookup failed", {
      socialUserId,
      error: error.message,
    });
  }

  return data?.hub_user_id || fallback;
};

export const syncSocialContactToEcosystemSoon = (
  input: SocialContactSyncInput,
) => {
  Promise.resolve()
    .then(() => syncSocialContactToEcosystem(input))
    .catch((error) => {
      logError("Social ecosystem contact sync failed", {
        requestId: input.requestId,
        contactId: input.contactId,
        error: error instanceof Error ? error.message : String(error),
      });
    });
};

export const syncSocialContactToEcosystem = async ({
  supabase,
  contactId,
  userId,
  instagramAccountId,
  instagramUserId,
  username,
  fullName,
  profilePictureUrl,
  requestId,
}: SocialContactSyncInput) => {
  const hubFnUrl = Deno.env.get("HUB_ECOSYSTEM_SYNC_FUNCTION_URL");
  const syncSecret = Deno.env.get("ECOSYSTEM_SYNC_SECRET");

  if (!hubFnUrl || !syncSecret) {
    return;
  }

  const hubUserId = await resolveHubUserId(supabase, userId);
  if (!hubUserId) {
    await supabase
      .from("contacts")
      .update({
        ecosystem_sync_status: "skipped",
        ecosystem_sync_source: "missing_hub_user_id",
        ecosystem_synced_at: new Date().toISOString(),
      })
      .eq("id", contactId);
    return;
  }

  const displayName =
    cleanText(fullName) || cleanText(username) || `Instagram ${instagramUserId}`;

  const response = await fetch(hubFnUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ecosystem-sync-secret": syncSecret,
    },
    body: JSON.stringify({
      action: "upsert_contact",
      user_id: hubUserId,
      source_platform: "social",
      external_contact_id: contactId,
      contact: {
        full_name: displayName,
        tags: ["instagram", "social-autodm"],
        metadata: {
          social_user_id: userId,
          instagram_account_id: instagramAccountId,
          instagram_user_id: instagramUserId,
          username: cleanText(username),
          profile_picture_url: cleanText(profilePictureUrl),
        },
      },
      target_platforms: ["crm", "whatsapp", "voice"],
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload?.success === false) {
    const message =
      payload?.error || `Hub ecosystem sync returned ${response.status}`;
    await supabase
      .from("contacts")
      .update({
        ecosystem_sync_status: "failed",
        ecosystem_sync_source: "hub_error",
        ecosystem_synced_at: new Date().toISOString(),
      })
      .eq("id", contactId);
    throw new Error(message);
  }

  const canonicalId = payload?.contact?.id || null;
  await supabase
    .from("contacts")
    .update({
      canonical_contact_id: canonicalId,
      ecosystem_sync_status: "synced",
      ecosystem_sync_source: "hub",
      ecosystem_synced_at: new Date().toISOString(),
    })
    .eq("id", contactId);

  logInfo("Social contact synced to ecosystem", {
    requestId,
    contactId,
    canonicalContactId: canonicalId,
  });
};
