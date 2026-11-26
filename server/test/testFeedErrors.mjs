import { getTrendFeedPage } from "../src/services/trendFeed.js";
import assert from "node:assert";

async function run() {
  console.log("=== Testing getTrendFeedPage across multiple regions & pages ===");

  for (const region of ["IN", "US", "GLOBAL", "GB", "CA", "AU"]) {
    console.log(`Testing region: ${region}, page: 1...`);
    const page1 = await getTrendFeedPage({
      region,
      page: 1,
      limit: 20,
      type: "all",
    }, { skipExternal: true });
    assert.ok(page1 && page1.success, `Page 1 should succeed for region ${region}`);
    console.log(`Region ${region} page 1 items: ${page1.items.length}`);

    console.log(`Testing region: ${region}, page: 2...`);
    const page2 = await getTrendFeedPage({
      region,
      page: 2,
      limit: 20,
      type: "all",
      cursor: page1.nextCursor,
    }, { skipExternal: true });
    assert.ok(page2 && page2.success, `Page 2 should succeed for region ${region}`);
    console.log(`Region ${region} page 2 items: ${page2.items.length}`);
  }

  console.log("✅ All getTrendFeedPage tests completed successfully without any ReferenceError!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
