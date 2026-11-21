import { getCanonicalPostKey, dedupePostsByCanonicalKey } from "../src/services/trendFeed.js";
import assert from "node:assert";

console.log("=== Testing Trend Feed Canonical Deduplication ===");

const testItems = [
  {
    id: "yt_short_dQw4w9WgXcQ",
    video_id: "dQw4w9WgXcQ",
    title: "Never Gonna Give You Up",
    source_platform: "youtube",
    source_url: "https://www.youtube.com/shorts/dQw4w9WgXcQ",
  },
  {
    id: "yt_dQw4w9WgXcQ",
    title: "Never Gonna Give You Up (Official Video)",
    source_platform: "youtube",
    source_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  },
  {
    id: "pin_1234567890",
    title: "Minimalist Living Room",
    source_platform: "pinterest",
    source_url: "https://pinterest.com/pin/1234567890/",
  },
  {
    id: "pin_alt_999",
    title: "Minimalist Living Room Idea",
    source_platform: "pinterest",
    source_url: "https://pinterest.com/pin/1234567890/?sender=abc",
  },
  {
    id: "pexels_9876543",
    title: "Coffee Brewing",
    source_platform: "pexels",
    source_url: "https://www.pexels.com/video/9876543/",
  },
  {
    id: "unique_item_1",
    title: "Brand New Unique Item",
    source_platform: "socialpilot",
  },
];

console.log(`Input items: ${testItems.length}`);
const deduplicated = dedupePostsByCanonicalKey(testItems);
console.log(`Deduplicated items: ${deduplicated.length}`);

// Assertions
assert.strictEqual(deduplicated.length, 4, "Should dedupe down to 4 unique items");
assert.strictEqual(deduplicated[0].id, "yt_short_dQw4w9WgXcQ", "First YouTube item preserved");
assert.strictEqual(deduplicated[1].id, "pin_1234567890", "First Pinterest item preserved");
assert.strictEqual(deduplicated[2].id, "pexels_9876543", "Pexels item preserved");
assert.strictEqual(deduplicated[3].id, "unique_item_1", "Unique item preserved");

console.log("✅ All Canonical Deduplication Unit Tests Passed Successfully!");
process.exit(0);
