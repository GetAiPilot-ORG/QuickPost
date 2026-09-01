// sync-to-hub/index.ts
// Supabase Edge Function to sync all table data to the Hub project (getaipilot)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

interface SyncTableResult {
  table: string;
  rowsFetched: number;
  rowsUpserted: number;
  status: "success" | "error";
  error?: string;
}

interface SyncResult {
  success: boolean;
  timestamp: string;
  tables: SyncTableResult[];
  summary: {
    total_tables: number;
    succeeded: number;
    failed: number;
    total_rows_synced: number;
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Table definitions
// ──────────────────────────────────────────────────────────────────────────────

const TABLES_TO_SYNC = [
  "users", // 1. Parent table
  "social_payments", // 2. Subscription/Plan data (syncs to "social_payments" in hub)
  "social_tokens", // 3. References users
  "broadcasts", // 4. References users
  "user_onboarding", // 5. User onboarding tracking
];

// Map source table names to hub table names (for cases where they differ)
const TABLE_NAME_MAP: Record<string, string> = {};

// Conflict resolution columns for each table
const TABLE_CONFLICT_KEYS: Record<string, string> = {
  users: "id",
  social_payments: "id",
  social_tokens: "user_id,provider",
  broadcasts: "id",
  user_onboarding: "user_id",
};

const CHUNK_SIZE = 500;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ──────────────────────────────────────────────────────────────────────────────
// Table Transformations with Cross-Project User ID Mapping
// ──────────────────────────────────────────────────────────────────────────────

function createTransformers(userIdMap: Record<string, string>) {
  const mapUserId = (uid: string) => (uid && userIdMap[uid]) ? userIdMap[uid] : uid;

  return {
    "users": (row: any) => ({
      id: mapUserId(row.id),
      email: row.email,
      name: row.name,
      google_id: row.google_id,
      profile_picture: row.profile_picture,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }),
    "social_payments": (row: any) => ({
      id: row.id,
      user_id: mapUserId(row.user_id),
      amount: row.amount ? row.amount / 100 : 0, // Convert from paise/cents
      currency: "INR",
      status: row.status || "pending",
      transaction_id: row.razorpay_payment_link_id,
      plan_tier: row.plan,
      created_at: row.created_at,
      updated_at: new Date().toISOString(),
    }),
    "social_tokens": (row: any) => ({
      id: row.id,
      user_id: mapUserId(row.user_id),
      provider: row.provider,
      access_token: row.access_token,
      refresh_token: row.refresh_token,
      token_expiry: row.token_expiry,
      expires_at: row.expires_at,
      instagram_business_id: row.instagram_business_id,
      pinterest_username: row.pinterest_username,
      facebook_page_id: row.facebook_page_id,
      facebook_page_name: row.facebook_page_name,
      bluesky_did: row.bluesky_did,
      bluesky_handle: row.bluesky_handle,
      mastodon_instance: row.mastodon_instance,
      page_id: row.page_id,
      account_id: row.account_id,
      account_name: row.account_name,
      username: row.username,
      profile_data: row.profile_data,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }),
    "broadcasts": (row: any) => ({
      id: row.id,
      user_id: mapUserId(row.user_id),
      caption: row.caption,
      video_filename: row.video_filename,
      status: row.status,
      instagram_success: row.instagram_success,
      instagram_post_id: row.instagram_post_id,
      instagram_url: row.instagram_url,
      instagram_error: row.instagram_error,
      youtube_success: row.youtube_success,
      youtube_video_id: row.youtube_video_id,
      youtube_url: row.youtube_url,
      youtube_shorts_url: row.youtube_shorts_url,
      youtube_error: row.youtube_error,
      pinterest_success: row.pinterest_success,
      pinterest_pin_id: row.pinterest_pin_id,
      pinterest_url: row.pinterest_url,
      pinterest_error: row.pinterest_error,
      pinterest_board_id: row.pinterest_board_id,
      pinterest_title: row.pinterest_title,
      pinterest_link: row.pinterest_link,
      facebook_success: row.facebook_success,
      facebook_post_id: row.facebook_post_id,
      facebook_url: row.facebook_url,
      facebook_error: row.facebook_error,
      bluesky_success: row.bluesky_success,
      bluesky_post_id: row.bluesky_post_id,
      bluesky_url: row.bluesky_url,
      bluesky_error: row.bluesky_error,
      linkedin_success: row.linkedin_success,
      linkedin_post_id: row.linkedin_post_id,
      linkedin_url: row.linkedin_url,
      linkedin_error: row.linkedin_error,
      mastodon_success: row.mastodon_success,
      mastodon_post_id: row.mastodon_post_id,
      mastodon_url: row.mastodon_url,
      mastodon_error: row.mastodon_error,
      tiktok_success: row.tiktok_success,
      tiktok_publish_id: row.tiktok_publish_id,
      tiktok_error: row.tiktok_error,
      threads_success: row.threads_success,
      threads_post_id: row.threads_post_id,
      threads_url: row.threads_url,
      threads_error: row.threads_error,
      x_success: row.x_success,
      x_post_id: row.x_post_id,
      x_url: row.x_url,
      x_error: row.x_error,
      scheduled_for: row.scheduled_for,
      posted_at: row.posted_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user_timezone: row.user_timezone,
      processing_started_at: row.processing_started_at,
      attempt_count: row.attempt_count,
      last_error: row.last_error,
      cancelled_at: row.cancelled_at,
      media_type: row.media_type,
      media_url: row.media_url,
      media_urls: row.media_urls,
      platform_data: row.platform_data,
      selected_channels: row.selected_channels,
      thumbnail_url: row.thumbnail_url,
    }),
    "user_onboarding": (row: any) => ({
      id: row.id,
      user_id: mapUserId(row.user_id),
      channels: row.channels,
      tools: row.tools,
      user_type: row.user_type,
      completed: row.completed,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Sync a single table
// ──────────────────────────────────────────────────────────────────────────────

async function syncTable(
  sourceClient: any,
  hubClient: any,
  tableName: string,
  transformers: Record<string, (row: any) => any>,
): Promise<SyncTableResult> {
  console.log(`[sync-to-hub] 🔄 Processing table: ${tableName}`);

  const hubTableName = TABLE_NAME_MAP[tableName] || tableName;
  console.log(`[sync-to-hub] 📍 Source: '${tableName}' → Hub: '${hubTableName}'`);

  // Fetch all rows from source
  const { data: rows, error: fetchError } = await sourceClient
    .from(tableName)
    .select("*");

  if (fetchError) {
    console.error(`[sync-to-hub] ❌ Fetch Error (${tableName}):`, fetchError.message);
    return {
      table: tableName,
      rowsFetched: 0,
      rowsUpserted: 0,
      status: "error",
      error: `Fetch failed: ${fetchError.message}`,
    };
  }

  const rowCount = rows?.length || 0;
  console.log(`[sync-to-hub] 📥 Fetched ${rowCount} rows from source '${tableName}'`);

  if (rowCount === 0) {
    return {
      table: tableName,
      rowsFetched: 0,
      rowsUpserted: 0,
      status: "success",
    };
  }

  // ── Apply Transformations ───────────────────────────────────────────────────
  let finalRows = rows;
  const transform = transformers[tableName];

  if (transform) {
    console.log(`[sync-to-hub] 🛠️ Applying transformations for '${tableName}'...`);
    finalRows = rows.map(transform);
  }

  // ── Deduplicate by Conflict Key ───────────────────────────────────────────
  const conflictKey = TABLE_CONFLICT_KEYS[tableName] || "id";
  const dedupedMap = new Map<string, any>();

  for (const row of finalRows) {
    let key = String(row.id);
    if (conflictKey === "user_id,provider") {
      key = `${row.user_id}:${row.provider}`;
    } else if (conflictKey === "user_id") {
      key = `${row.user_id}`;
    }

    const existing = dedupedMap.get(key);
    if (!existing || new Date(row.updated_at || 0).getTime() >= new Date(existing.updated_at || 0).getTime()) {
      dedupedMap.set(key, row);
    }
  }
  finalRows = Array.from(dedupedMap.values());

  // ── Upsert to Hub ───────────────────────────────────────────────────────────
  const chunks = chunkArray(finalRows, CHUNK_SIZE);
  let totalUpserted = 0;

  for (const [index, chunk] of chunks.entries()) {
    console.log(`[sync-to-hub] 🔄 Chunk ${index + 1}/${chunks.length}: Upserting ${chunk.length} rows to '${hubTableName}' (onConflict: ${conflictKey})...`);

    const { error: upsertError } = await hubClient
      .from(hubTableName)
      .upsert(chunk, { onConflict: conflictKey });

    if (upsertError) {
      console.error(`[sync-to-hub] ❌ UPSERT FAILED (${tableName} → ${hubTableName}, chunk ${index + 1}):`, upsertError.message);
      return {
        table: tableName,
        rowsFetched: rowCount,
        rowsUpserted: totalUpserted,
        status: "error",
        error: `Upsert failed at chunk ${index + 1}: ${upsertError.message}`,
      };
    }

    totalUpserted += chunk.length;
  }

  console.log(`[sync-to-hub] 🎉 Table '${tableName}' sync complete! Total: ${totalUpserted}`);

  return {
    table: tableName,
    rowsFetched: rowCount,
    rowsUpserted: totalUpserted,
    status: "success",
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Handler
// ──────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, x-sync-secret, apikey",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
    });
  }

  try {
    const SOURCE_URL = Deno.env.get("SUPABASE_URL")!;
    const SOURCE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const HUB_URL = Deno.env.get("HUB_SUPABASE_URL");
    const HUB_KEY = Deno.env.get("HUB_SUPABASE_SERVICE_ROLE_KEY");

    console.log("[sync-to-hub] 🔐 Environment Check:");
    console.log(`[sync-to-hub] ✓ SOURCE_URL: ${SOURCE_URL ? "SET" : "MISSING"}`);
    console.log(`[sync-to-hub] ✓ SOURCE_KEY: ${SOURCE_KEY ? "SET" : "MISSING"}`);
    console.log(`[sync-to-hub] ✓ HUB_URL: ${HUB_URL ? "SET" : "MISSING"}`);
    console.log(`[sync-to-hub] ✓ HUB_KEY: ${HUB_KEY ? "SET" : "MISSING"}`);

    if (!HUB_URL || !HUB_KEY) {
      console.error("[sync-to-hub] ❌ Missing hub credentials!");
      throw new Error(
        "Missing HUB_SUPABASE_URL or HUB_SUPABASE_SERVICE_ROLE_KEY secrets.",
      );
    }

    const sourceClient = createClient(SOURCE_URL, SOURCE_KEY, {
      auth: { persistSession: false },
    });
    const hubClient = createClient(HUB_URL, HUB_KEY, {
      auth: { persistSession: false },
    });

    console.log("[sync-to-hub] 🚀 Preparing Cross-Project User Mapping...");

    // 1. Fetch all existing users in Hub to resolve email collisions
    const { data: existingHubUsers, error: hubUsersErr } = await hubClient
      .from("users")
      .select("id, email");

    if (hubUsersErr) {
      console.warn("[sync-to-hub] ⚠️ Could not fetch existing hub users:", hubUsersErr.message);
    }

    const emailToHubId = new Map<string, string>();
    if (existingHubUsers) {
      for (const u of existingHubUsers) {
        if (u.email) {
          emailToHubId.set(u.email.trim().toLowerCase(), u.id);
        }
      }
    }

    // 2. Fetch all source users to build the ID translation map
    const { data: sourceUsers, error: srcUsersErr } = await sourceClient
      .from("users")
      .select("id, email");

    if (srcUsersErr) {
      throw new Error(`Failed to fetch source users: ${srcUsersErr.message}`);
    }

    const userIdMap: Record<string, string> = {};
    if (sourceUsers) {
      for (const su of sourceUsers) {
        if (su.email) {
          const lowerEmail = su.email.trim().toLowerCase();
          const existingHubId = emailToHubId.get(lowerEmail);
          if (existingHubId) {
            userIdMap[su.id] = existingHubId;
            console.log(`[sync-to-hub] 🔗 Reconciled user '${su.email}': Social ID ${su.id} → Hub ID ${existingHubId}`);
          } else {
            userIdMap[su.id] = su.id;
          }
        } else {
          userIdMap[su.id] = su.id;
        }
      }
    }

    const transformers = createTransformers(userIdMap);

    console.log("[sync-to-hub] 🚀 Starting Sync...");
    console.log(`[sync-to-hub] 📊 Tables to sync: ${TABLES_TO_SYNC.join(", ")}`);
    const tableResults: SyncTableResult[] = [];

    for (const table of TABLES_TO_SYNC) {
      console.log(`[sync-to-hub] ⏱️ Starting sync for table: ${table}`);
      const result = await syncTable(sourceClient, hubClient, table, transformers);
      tableResults.push(result);
      console.log(
        `[sync-to-hub] ✨ Completed ${table}: ${result.status} (${result.rowsUpserted}/${result.rowsFetched} rows)`,
      );
      if (result.status === "error" && table === "users") {
        console.error("[sync-to-hub] ⛔ Users table sync failed, stopping sync");
        break;
      }
    }

    const failed = tableResults.filter((r) => r.status === "error").length;
    const summary = {
      total_tables: tableResults.length,
      succeeded: tableResults.filter((r) => r.status === "success").length,
      failed,
      total_rows_synced: tableResults.reduce(
        (acc, r) => acc + r.rowsUpserted,
        0,
      ),
    };

    const responseData = {
      success: failed === 0,
      timestamp: new Date().toISOString(),
      tables: tableResults,
      summary,
    };

    console.log(
      `[sync-to-hub] ✨ Finished. Synced ${summary.total_rows_synced} rows across ${summary.succeeded} tables.`,
    );

    return new Response(JSON.stringify(responseData, null, 2), {
      status: failed > 0 ? 207 : 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    console.error("[sync-to-hub] 💥 Critical Function Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
