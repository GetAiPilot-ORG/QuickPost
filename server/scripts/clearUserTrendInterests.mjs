import supabase from '../src/services/supabase.js';

async function clearAllTrendInterests() {
  console.log("🧹 Clearing trend preferences & interests from database for all users...");
  try {
    const { data: usersData, error } = await supabase.auth.admin.listUsers();
    if (error) {
      console.error("Error listing users:", error.message);
      process.exit(1);
    }

    const users = usersData?.users || [];
    let clearedCount = 0;

    for (const u of users) {
      const meta = u.user_metadata || {};
      if (meta.trend_preferences) {
        console.log(`Clearing preferences for user: ${u.email} (${u.id})`);
        const { error: updateErr } = await supabase.auth.admin.updateUserById(u.id, {
          user_metadata: {
            ...meta,
            trend_preferences: {
              selectedTopicIds: [],
              interests: "",
              work: "",
              goal: "",
              recentSearches: [],
              onboarded: false,
              updatedAt: new Date().toISOString(),
            },
          },
        });

        if (updateErr) {
          console.error(`Failed to clear user ${u.email}:`, updateErr.message);
        } else {
          clearedCount++;
        }
      }
    }

    console.log(`✅ Successfully cleared trend interests for ${clearedCount} users in Supabase.`);
  } catch (err) {
    console.error("Error clearing trend interests:", err.message);
  }
}

clearAllTrendInterests().then(() => process.exit(0));
