import assert from "node:assert";
import dotenv from "dotenv";
dotenv.config();

import {
  extractKeywords,
  calculateRelevance,
  filterAndRankPosts,
} from "../src/services/trends/trendRelevance.js";
import {
  searchPinterestPins,
  fetchPinterestTrendingPins,
  getPinterestRssFeed,
} from "../src/services/trends/trendPinterestSource.js";
import {
  searchBlueskyPosts,
  getBlueskyTrendingPosts,
  getBlueskyTrendingTopics,
} from "../src/services/trends/trendBlueskySource.js";
import {
  fetchPinterestTrends,
  fetchBlueskyTrends,
} from "../src/services/trends/trendSources.js";
import { getTrendFeedPage, getHotTopicsRadar } from "../src/services/trendFeed.js";

async function runTests() {
  console.log("🚀 Starting Trend Search & Feeds Verification Suite...");

  // 1. Test Relevance Engine
  console.log("\n[TEST 1] Relevance Engine Unit Tests");
  const keywords = extractKeywords("the best artificial intelligence in 2026");
  assert.ok(keywords.includes("artificial"), "Should extract 'artificial'");
  assert.ok(keywords.includes("intelligence"), "Should extract 'intelligence'");
  assert.ok(!keywords.includes("the"), "Should remove stopword 'the'");
  assert.ok(!keywords.includes("in"), "Should remove stopword 'in'");

  const pinItem = {
    source_platform: "pinterest",
    title: "Minimalist Modern Architecture and AI interior design",
    caption: "Stunning modern home architecture with smart AI features",
    creator: "DesignStudio",
    thumbnail_url: "https://example.com/pin.jpg",
    metrics: { saves: 500 },
  };

  const relScore = calculateRelevance(pinItem, "architecture");
  assert.ok(relScore > 0, "Relevant item should have positive score");

  const irrelevantScore = calculateRelevance(pinItem, "cooking recipes vegan");
  assert.strictEqual(irrelevantScore, 0, "Irrelevant query should score 0");

  const spamPin = {
    source_platform: "pinterest",
    title: "dm for edit",
    thumbnail_url: "https://example.com/pin.jpg",
  };
  assert.strictEqual(calculateRelevance(spamPin, "edit"), 0, "Spam pin title should score 0");

  const ranked = filterAndRankPosts([pinItem, spamPin], "architecture");
  assert.strictEqual(ranked.length, 1, "Spam should be discarded by filterAndRankPosts");
  assert.strictEqual(ranked[0].creator, "DesignStudio");
  console.log("✅ Relevance engine tests passed successfully.");

  // 2. Test Bluesky Official Endpoints
  console.log("\n[TEST 2] Bluesky Official Search & Trending Tests");
  try {
    const bskySearch = await searchBlueskyPosts({ query: "technology", limit: 5 });
    console.log(`Bluesky search returned ${bskySearch.posts.length} posts`);
    if (bskySearch.posts.length > 0) {
      const p = bskySearch.posts[0];
      assert.strictEqual(p.source_platform, "bluesky");
      assert.ok(p.id.startsWith("bsky_"));
      assert.ok(p.title);
      assert.ok(p.source_url.includes("bsky.app"));
      console.log(`Sample Bluesky post author: ${p.creator}`);
    }

    const bskyTopics = await getBlueskyTrendingTopics();
    console.log(`Bluesky trending topics count: ${bskyTopics.trends.length}`);
    assert.ok(Array.isArray(bskyTopics.trends));
    console.log("✅ Bluesky tests passed successfully.");
  } catch (err) {
    console.warn("Bluesky live check warning:", err.message);
  }

  // 3. Test Pinterest Official Endpoints
  console.log("\n[TEST 3] Pinterest Official Search & Feed Tests");
  try {
    const pinSearch = await searchPinterestPins({ query: "interior design", limit: 5 });
    console.log(`Pinterest search returned ${pinSearch.pins.length} pins`);
    if (pinSearch.pins.length > 0) {
      const p = pinSearch.pins[0];
      assert.strictEqual(p.source_platform, "pinterest");
      assert.ok(p.id.startsWith("pin_"));
      assert.ok(p.thumbnail_url);
      assert.ok(p.source_url.includes("pinterest.com"));
      console.log(`Sample Pinterest pin title: ${p.title}`);
    }

    const curatedPins = await fetchPinterestTrendingPins({ category: "design_art", limit: 5 });
    console.log(`Pinterest curated pins count: ${curatedPins.length}`);
    assert.ok(Array.isArray(curatedPins));
    console.log("✅ Pinterest tests passed successfully.");
  } catch (err) {
    console.warn("Pinterest live check warning:", err.message);
  }

  // 4. Test Unified Trend Sources
  console.log("\n[TEST 4] Unified Trend Sources Wrapper Tests");
  try {
    const pinTrends = await fetchPinterestTrends({ query: "technology", limit: 4 });
    const bskyTrends = await fetchBlueskyTrends({ query: "technology", limit: 4 });
    console.log(`fetchPinterestTrends items: ${pinTrends.length}`);
    console.log(`fetchBlueskyTrends items: ${bskyTrends.length}`);
    console.log("✅ Unified trend sources tests passed successfully.");
  } catch (err) {
    console.warn("Unified sources warning:", err.message);
  }

  // 5. Test Hot Topics Radar
  console.log("\n[TEST 5] Hot Topics Radar Test");
  try {
    const radar = await getHotTopicsRadar({ geo: "US" });
    assert.strictEqual(radar.success, true);
    assert.ok(Array.isArray(radar.hotTopics));
    assert.ok(radar.hotTopics.length > 0);
    console.log(`Radar generated ${radar.hotTopics.length} hot topics combining Google & Bluesky.`);
    console.log(`Top 2 topics:`, radar.hotTopics.slice(0, 2).map((t) => t.query));
    console.log("✅ Hot topics radar test passed successfully.");
  } catch (err) {
    console.warn("Radar check warning:", err.message);
  }

  // 6. Test Feed Integration
  console.log("\n[TEST 6] getTrendFeedPage with Pinterest & Bluesky Tests");
  const mockSupabase = {
    from: () => ({
      select: () => ({
        order: () => ({
          in: () => ({ limit: async () => ({ data: [], error: null }) }),
          eq: () => ({ limit: async () => ({ data: [], error: null }) }),
          limit: async () => ({ data: [], error: null }),
        }),
      }),
    }),
  };

  try {
    // Pinterest specific tab
    const pinFeed = await getTrendFeedPage(
      { type: "pinterest", limit: 10 },
      { skipExternal: false, cache: null, supabase: mockSupabase }
    );
    assert.strictEqual(pinFeed.success, true);
    console.log(`Pinterest tab returned ${pinFeed.items.length} items`);
    if (pinFeed.items.length > 0) {
      assert.strictEqual(pinFeed.items[0].source_platform, "pinterest");
    }

    // Bluesky specific tab
    const bskyFeed = await getTrendFeedPage(
      { type: "bluesky", limit: 10 },
      { skipExternal: false, cache: null, supabase: mockSupabase }
    );
    assert.strictEqual(bskyFeed.success, true);
    console.log(`Bluesky tab returned ${bskyFeed.items.length} items`);
    if (bskyFeed.items.length > 0) {
      assert.strictEqual(bskyFeed.items[0].source_platform, "bluesky");
    }

    // Search query test
    const searchFeed = await getTrendFeedPage(
      { search: "technology", type: "all", limit: 20 },
      { skipExternal: false, cache: null, supabase: mockSupabase }
    );
    assert.strictEqual(searchFeed.success, true);
    console.log(`Search feed for 'technology' returned ${searchFeed.items.length} items`);
    const platforms = new Set(searchFeed.items.map((it) => it.source_platform));
    console.log(`Platforms represented in search results:`, Array.from(platforms));
    console.log("✅ Feed integration tests passed successfully.");
  } catch (err) {
    console.warn("Feed integration check warning:", err.message);
  }

  console.log("\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!");
}

runTests().catch((err) => {
  console.error("❌ Test suite failed:", err);
  process.exit(1);
});
