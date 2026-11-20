## 2026-11-20 — Made Tune feed modal keywords & country filtering fully workable
- Tuned modal keywords (creator role, custom keywords, preferred formats) now dynamically generate first-class topic objects, taking top priority in external fetches (YouTube, Pinterest, Bluesky, Unsplash, Pexels) and feed ranking.
- Country filter in header now triggers immediate reset, instant ticker refresh (`loadHotTopics`), and drives live regional trends across Google Trends, YouTube popular charts, news, and Pinterest.
- Formatted Tune modal input labels to regular sentence casing and font weight, and removed top badge when in tune mode.

## 2026-11-20 — Removed Tune modal badge & formatted input labels to regular case
- Removed the top "Feed Tuning & Advanced AI" pill badge from `CreatorInterestModal` when in tune mode.
- Formatted input labels to regular casing and non-bold weight (`font-normal`), removing uppercase tracking and bold styling.

## 2026-11-20 — Compact card body layout & tight vertical spacing in TrendCard
- Eliminated artificial flex stretching (`justify-between`), tightly grouping title, creator, and actions with natural compact spacing (`gap-1.5`).
- Scaled down padding (`px-2.5 py-2`), font sizes (`text-xs sm:text-[13px]`), icons (`w-4 h-4`), and button heights (`h-7`), reducing card body height by ~40% to match authentic Pinterest pin proportions.

## 2026-11-20 — Removed "Community Spark" badge from community and user post cards
- Removed the hardcoded "Community Spark" fallback label and emoji from `server/src/services/trendFeed.js`.
- Filtered out "Community Spark" from `TrendFeedPage.jsx` card body header, keeping cards clean with direct title and creator info.

## 2026-11-20 — Multi-platform creator username resolution, video playback & universal feed sync
- Resolved foreign key failure on `posts.author_id` by checking `auth.users` existence, persisting `author:${userId}` in `niche_tags` and ranking user uploads at the top.
- Auto-synced all broadcast uploads across every platform to Trend Feed community posts with video hover-playback support.
- Enforced username precedence: Instagram handle default for multi-platform broadcasts, individual platform handle for single-platform uploads (e.g. YouTube shows channel name), and "GAP Social-pilot" for community-only posts.

## 2026-11-20 — Pinned user uploaded SocialPilot posts to top of Trend Feed
- Explicitly prioritized SocialPilot uploads and user-authored posts with highest ranking tier (`rank_score > 100,000,000`), placing them at the very top of page 1.
- Updated `interleavePinterestFeed` to lead with community uploads before interleaving external platforms, and wired `onPostCreated` in `ComposerModal` to auto-refresh feed immediately upon upload.

## 2026-11-20 — Guaranteed equal round-robin card distribution across all feed columns
- Implemented pure sequential round-robin distribution (`items[i % colCount]`): as items load, they are immediately spread 1-by-1 across all columns equally.
- Guarantees no column can ever be more than 1 card ahead of any other column (eliminating the 4-in-one, 0-in-another bug).
- Flex-based multi-column layout guarantees equal column widths and natural Pinterest vertical stacking. Client built cleanly.
- Integrated skeleton placeholder cards directly inside every column simultaneously during loading (`TrendCardSkeleton` across all 4 columns), eliminating blank spaces matching user annotations (`15ce7641.png`).
- Fixed server pagination cursor bug where page N items were dropped by `applyRankCursor`, guaranteeing full 24-item dense batches. Client build passed in 4.50s.

## 2026-11-20 — Aligned Skeletons to 4-column Pinterest layout & added media error fallback
- Updated `AttractiveTrendLoadingIndicator` and `TrendFeedSkeleton` to 4-column Pinterest layout (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4`) with image-first staggered cards, eliminating column mismatch and old header placeholders.
- Added resolution fallbacks (`/736x/` -> `/564x/` -> `/236x/`) and graceful placeholder in `TrendCard` to prevent pins collapsing when high-res image URLs fail. Client build passed in 5.56s.

## 2026-11-20 — Removed dark letterboxing spacing in Trend detail modal
- Replaced rigid full-width `bg-neutral-950` wrapper in `TrendDetailsBottomSheet` with an image-hugging `inline-block` container; eliminated black letterbox spacing on sides of portrait/vertical photos.
- Photos and videos now center cleanly with natural dimensions up to `max-h-[58vh]` and subtle rounded borders. Client build passed in 4.71s.

## 2026-11-20 — Refactored Trend Feed to authentic Pinterest layout with uncropped natural image sizing
- Eliminated forced aspect ratios (`aspect-[2/3]`, `aspect-[3/4]`, `object-cover`) on feed cards; images now render at `w-full h-auto block`, preserving their exact original size and aspect ratio without any cropping.
- Restructured `TrendCard` to authentic Pinterest layout: image at the top of the pin, floating hover actions (Save, source link), and clean creator/stats row below. Client build passed in 7.29s.

## 2026-11-19 — Fixed missing TutorialHelp import in ComposerModal
- Added missing `import TutorialHelp from "./TutorialHelp"` in `client/src/components/ComposerModal.jsx` to resolve runtime `ReferenceError: TutorialHelp is not defined` on dashboard/composer render.
- Client production build verified clean in 17.49s.

## 2026-11-19 — Restored clean, compact Tune modal UI & detached search accumulation from keywords
- Restored original 3-row layout (Creator Role, Custom Keywords, Preferred Formats) in Tune modal matching `070e091b.png`; removed bulky cards, subtabs, helper text, and `#tags` cloud.
- Detached search queries from `interests`: inputs now stay empty by default (`""`) unless manually saved by the user, and auto-cleaned legacy accumulated search spam from state and DB. Client build passed in 5.68s.

## 2026-11-19 — Isolated Tune modal strictly to Advanced Tuning & reserved Niches only for first visit
- Removed topic niches and subtabs completely from the header `Tune` modal: now strictly renders Creator Role, Custom Keywords textarea (with active `#tag` chips), and Preferred Content Formats.
- Topic niches selection is now strictly isolated to the one-time first-visit onboarding feed flow. Client built cleanly in 4.80s.

## 2026-11-19 — Separated Onboarding from Tune modal & guaranteed single onboarding appearance
- Removed Advanced Tuning inputs completely from Onboarding modal (now purely 54 topic cards + fast Personalize CTA).
- Wired Advanced Tuning (Creator Role, Custom Keywords textarea + tag chips, Content Formats) exclusively into the header's `Tune` button, and guaranteed Onboarding only ever appears once via multi-storage checks and auto-dismiss on existing DB preferences. Client built in 6.54s.

## 2026-11-19 — Resolved onboarding modal lag, removed number badge & clear selection text, improved gradient CTA
- Eliminated onboarding lag: isolated modal selection to local state (preventing massive background feed re-renders), replaced 54 Framer Motion spring buttons with GPU-accelerated CSS transitions, and removed GPU-heavy nested blurs.
- Removed "Clear selection" text from footer and stripped number badge from CTA button, styling it with a smooth theme-matched orange-to-amber gradient (`from-[#FF5600] via-[#FF6D1A] to-[#F59E0B]`). Client built in 4.82s.

## 2026-11-19 — Pinned platform tabs & isolated horizontal scroll to trending hashtags only
- Removed pulsing dot from `TRENDING:` label and locked platform tabs (`All Trends`, `Pinterest`, `Bluesky`, etc.) into a fixed left position (`flex-shrink-0`).
- Isolated horizontal scrolling solely to trending hashtag pills (`#jazz vs lakers`, `#gta vi`, etc.) with `overflow-x-auto no-scrollbar`. Client built in 5.47s.

## 2026-11-19 — Refined feed loader to theme-matched editorial ghost shimmer & brand dots
- Replaced alien neon orbit with GAP Social-pilot theme-matched elements: subtle 3-column masonry ghost cards shimmer with brand orange (`#FF5600`), deep ink (`#111111`), and warm amber dots. Client built in 9.93s.

## 2026-11-19 — Unified command bar into single line with trending tags & cleaned feed badges
- Removed redundant topic pills row and moved live trending tags (`#tags`) inline into the `All Trends` platform tabs line, reducing header height to a single compact row (~38px) and maximizing feed viewport space.
- Removed `[ 📌 Pin ]` and `[ 🦋 Bluesky Post ]` text overlay badges from feed post cards for a clean, editorial presentation. Client built in 5.54s.

## 2026-11-19 — Fixed feed glitching/auto-reloading loop & guaranteed searched topics in All Topics mixed feed
- Eliminated React infinite re-render/re-fetch loop in `TrendFeedPage.jsx`: wrapped mutable filters/searches in stable `useRef`s, decoupled `loadPage` dependencies, and guarded `setRecentDbSearches` against identical array triggers.
- Rebuilt `searchTopicObjects` directly from `recentSearches`, guaranteed 3-point relevance score in `calculateItemTopicMatch` for explicit search items, and implemented multi-topic balanced interleaving in `interleavePinterestFeed` so searched topics and onboarding topics are woven side-by-side in All Topics. Client built cleanly in 5.26s.

## 2026-11-19 — Implemented true mixed feed of onboarding selected topics and searched topics in All Topics
- Resolved root cause where `fetchLiveExternalPosts` ignored `searchQueries` whenever `targetTopics.length > 0`: rebuilt balanced `mixedPool` interleaving onboarding topics and searched topics on every page.
- Updated `calculateItemTopicMatch` and `rankPosts` to recognize search topic definitions and assign 500+ topic boosts, ensuring searched topics are fully mixed with onboarding topics.
- Wired client `TrendFeedPage.jsx` to pass `params.searches` in feed queries alongside `params.topics`. Client built in 5.31s.

## 2026-11-19 — Auto-added searched topics to user interests & All Topics feed
- Created `addSearchQueryToUserInterests` in `userTrendPreferencesService.js`: automatically appends search terms to user's DB interest preferences (`user_trend_preferences`) and checks topic registry to add matching topic IDs to `selected_topic_ids`.
- Wired search submission and debounce in `TrendFeedPage.jsx` (`registerSearchTopic`) to add search queries as active interest topics in the rail, reflect in deduplicated "All Topics" count, and include in the combined personalized feed. Client built in 18.37s.

## 2026-11-19 — Streamlined Trend Feed topics rail to user-selected & searched topics only
- Removed "My Topics" button from the platform tabs row and eliminated generic static categories (`NICHE_PILLS`) from the command bar.
- Re-architected topics rail to exclusively display user's onboarding interest topics and persistent database search history with individual delete/filter controls.
- Added instant DB search recording (`POST/DELETE /api/trends/search-history`) on Enter and hot topic clicks. Client built in 9.18s.

## 2026-11-19 — Resolved "Dashboard could not refresh: Invalid token" root cause
- Fixed backend auth middleware (`authenticateUser.js`): decoded Supabase 64-byte base64 JWT secret buffer to prevent invalid signature failures, added claim-based expiry detection to return `TOKEN_EXPIRED` (401), and ensured env files load across cwd paths.
- Fixed client auth cache loop (`apiClient.js` & `DashboardOverview.jsx`): cleared stale in-memory token cache on 401 and retry, prevented interceptor overwrites during session refresh, and added clean retry recovery with proactive session check. Client build passed in 5.42s.

## 2026-11-19 — Persisted user interest topics & search history to DB with feed personalization
- Created `user_trend_preferences` and `user_trend_searches` Supabase schema & endpoints (`GET/POST /api/trends/preferences`, `POST /api/trends/search-history`).
- Auto-save selected creator topics on onboarding/tuning and search queries on search to database, with fallback to Supabase user metadata.
- Feed engine automatically retrieves user's DB topics and recent search terms, folding them into live queries and relevance ranking. Client build passed cleanly in 5.59s.

## 2026-11-19 — Fixed Pinterest & Bluesky irrelevant content & search fallbacks
- Resolved irrelevant lifestyle pins & uncurated posts by optimizing platform queries (1-2 visual keywords for Pinterest, boolean OR for Bluesky), removing harmful RSS fallback to `handle: "pinterest"`, and filtering replies/link spam on Bluesky.
- Added strict relevance validation before stamping `matched_topic` in `trendFeed.js` and `trendTopics.js`, preventing zero-match fallback pins from getting artificial 500x score boosts in the personalized waterfall.
- Verified topic relevance test suite and client production build passed cleanly in 6.25s.

## 2026-11-19 — Compacted & optimized Trend Feed command bar to maximize feed viewport space
- Reduced top padding from `pt-4` to `pt-1.5`, unified curated topics and general categories into a single seamless horizontal rail (eliminating an entire 35px row), removed duplicate Tune button, and compacted the live trending ticker.
- Gained ~75px of vertical screen real estate for the media feed cards. Client build passed cleanly in 18.31s.

## 2026-11-19 — Removed AI sparkles icon & upgraded CTA button UI
- Removed generic AI sparkle icons from both the top header badge (`Creator Inspiration Engine`) and the primary `Personalize Feed` button.
- Upgraded the CTA button with a vertical warm brand gradient, top light bevel reflection, dynamic selected count pill, and an elegant forward `ArrowRight` micro-interaction on hover.

## 2026-11-19 — Streamlined onboarding modal & expanded topic library to 54 creator niches
- Cleaned up Creator Inspiration Onboarding modal by removing the subtitle description, search bar row, and category tabs, bringing topics directly under the headline with an expanded `max-w-3xl` container.
- Expanded topic library from 24 to 54 diverse creator topics synced across server (`trendTopics.js`) and client (`TREND_INTEREST_TOPICS`), added "Clear selection" to footer, and verified client build.

## 2026-11-19 — Trend Feed onboarding modal UI, animations & visual effects
- Upgraded Creator Inspiration Onboarding modal with ambient gradient aura orbs, backdrop blur, spring physics transitions, and a glowing top accent bar.
- Added interactive category pill slider using Framer Motion `layoutId`, tactile micro-interactions (`whileHover`, `whileTap`) and pop checkmarks on topic cards, live visual progress meter towards recommendation threshold, and a gradient CTA button.
- Client production build passed cleanly in 4.48s.

## 2026-11-19 — Real API category/format routing & unified command bar UI
- Re-architected Trend Feed controls into a single cohesive glassmorphism command bar: unified segmented platform tabs, tactile niche emoji pills, inline personalized topics toggle, pulsing live trending radar ticker, and active search banner.
- Wired live external API category & search fetching across all sources (YouTube, Pinterest, Bluesky, Unsplash, Pexels, News, SerpApi Google Trends) so clicking any category, format, or trending hashtag actively queries real live data without being overridden by default onboarding topics.
- Fixed Vite HTTP 431 Request Header Fields Too Large by capping `seen` IDs in feed URL query params to the latest 20 items (preventing multi-KB query strings during infinite scroll) and configured Vite dev with `--max-http-header-size=65536`.
- Verified backend endpoints and client production build passed cleanly.

## 2026-11-19 — Bluesky (skybird) multi-page search & infinite scroll alignment
- Resolved Bluesky search showing limited posts by switching from 403-blocked public domain to working `https://api.bsky.app/xrpc` endpoint, implementing date-based `until` cursor tracking across pages, and wiring niche category search queries.
- Verified live Bluesky search returns 30 posts on page 1, 30 fresh posts on page 2, and seamlessly integrates into infinite scroll and "All Trends" feeds. Client build passed cleanly.

## 2026-11-19 — Pinterest multi-page search & infinite scroll alignment
- Resolved Pinterest search showing limited posts by adding official Pinterest BaseSearchResource cursor/bookmark pagination across pages, increasing batch size to 35-50 pins, and preventing over-filtering of visually matched pins.
- Verified live Pinterest search returns 30+ pins on page 1, 25+ fresh pins on page 2, and seamlessly integrates into infinite scroll and "All Trends" feeds. Client build passed cleanly.

## 2026-11-18 — Onboarding topics personalized feed
- Wired selected onboarding topics to live multi-platform search (Pinterest, Bluesky, YouTube, Pexels, Unsplash) and boosted matching candidates in ranking engine with topic badges.
- Added a dedicated "My Curated Topics" pill bar in Trend Feed for combined view or one-click filtering by individual selected topics, plus instant profile re-sync on onboarding save.
- All automated test suites and client build passed cleanly.
