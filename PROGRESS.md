## 2026-11-21 — Strict topic isolation & balanced multi-topic round-robin interleaving
- Root cause of clustering & leakage: `priorityPosts` Page 1 par top 6 items ek hi topic ke dump kar raha tha aur non-matching items fallback loop se feed me leak ho rahe the; saath hi `isItemRelevantToTopic` loose fallback se har post ko match maan leta tha.
- Strict relevance ("uske alawa kuch nhi"): `trendTopics.js` me relevance check fix kiya aur `getTrendFeedPage` me personalized mode me candidate posts ko strictly user ke active topics se match filter kiya, generic DB aur irrelevant pulses completely discard kiye.
- Balanced round-robin ("sabhi content mixed"): `interleavePinterestFeed` me priority dump hatakar topic buckets me sorted items ko shifting round-robin offset se distribute kiya taaki masonry columns me sabhi topics evenly alternate karein aur koi single topic dominate na kare.

## 2026-11-21 — "All Topics" feed strictly personalized to each user's search & interest topics
- Root cause: Personalized feeds me Page 1 par generic country pulses (cricket, bhajans, popular videos) top 3 slots le rahe the aur community test posts slots 4-5 occupy kar rahe the, jisse alag-alag accounts me All Topics feed same lag rahi thi aur topic matches ka score 250k tha jo generic 95M pulses se dab jata tha.
- User-specific topic leadership: Personalized feeds me generic country pulses aur unrelated community posts suppress kiye; user ke searched (90M), tuned (80M) aur onboarding (70M) topic matches ko top priority di.
- Multi-topic coverage on Page 1: Page 1 par up to 5 user topics ke YouTube Shorts/Trends aur Pinterest pins fetch kiye aur topic buckets ke through round-robin distribute kiye taaki har account me feed 100% usi user ke interests ke hisab se aaye.

## 2026-11-21 — Immediate real-time search execution without page refresh
- Real-time search update: Search submit (Enter key, search button click, trending ticker click, rail pill click) now directly invokes `handleExecuteSearch` which updates `debouncedSearchRef.current` and triggers `loadPage({ reset: true, overrideSearch })` synchronously, eliminating the need to refresh the page.
- Debounce conflict eliminated: Removed 350ms typing auto-debounce so typing full words doesn't create race conditions or bail-out no-ops in React; added `handleClearSearch` for instant reset on clear/empty input.

## 2026-11-21 — Enforced 100% strict per-user isolation for interest topics and trend feeds
- Root cause of mixing: Frontend state was transmitting client-side `params.topics`, `params.interests`, and `params.searches` during feed requests, causing stale/previous session localStorage to overwrite other users' preferences on the server; additionally `GET /trends/feed` was auto-mutating DB interests on search query.
- Server isolation: For authenticated requests, `trendFeed.js` now reads topics, interests, and recent searches strictly and exclusively from that specific user's DB record (`getUserTrendPreferences`), completely rejecting client-injected query params; removed auto-recording from GET feed route.
- Client state reset: In `TrendFeedPage.jsx`, bound complete state reset to `userKey` change, blocked premature fetching while `authLoading` is true, and added automatic `qp_trend_` key purging on logout in `AuthContext.jsx`.

## 2026-11-21 — Eliminated duplicate content across feed columns with canonical key deduplication
- Root cause: Page 1 was fetching leadSearchedTopic and the topicsForPage loop with overlapping queries, creating YouTube shorts and regular video entries with differing ID prefixes (`yt_short_` vs `yt_`) for identical videos, and round-robin placed adjacent duplicates in adjacent columns.
- Canonical deduplication: Added `getCanonicalPostKey` and `dedupePostsByCanonicalKey` extracting video IDs, pin IDs, and normalized titles across backend (candidate merge, ranking, and Pinterest interleaving) and frontend (`setItems`, `rememberSeen`, and `columns` round-robin memoization).
- Client race-condition prevention: Removed redundant `loadPage` invocation on country select in `TrendFeedPage.jsx` so the `useEffect` triggers cleanly once without duplicate simultaneous requests.

## 2026-11-21 — Made Country Filter truly workable with distinct regional feeds & ticker
- Multi-source region targeting: YouTube Shorts (`searchQuery` me country name add kiya like `shorts India` / `shorts USA`), YouTube Data API (`chart: mostPopular`, `regionCode`), Google Trends (`geo`), News (GNews/NewsAPI country param), Pinterest, Pexels, aur Unsplash sabhi me selected region enforce kiya.
- Regional ranking & DB isolation: Non-Indian region select hone par DB ke old Indian videos ko US/GB/CA/AU feed me dilute hone se roka, Page 1 par country pulses (Google Trends + country viral shorts/videos) ko top showcase kiya, aur priority search matches ko 6 tak cap kiya taaki country trends dominate karein.
- Client race-condition & request ID fix: `loadRequestIdRef` add kiya taaki country switch karte hi previous in-flight requests discard ho jayein aur immediate reset ke sath distinct regional content load ho.

## 2026-11-21 — Stop auto-adding partial search fragments, enforce explicit search submission & remove Bluesky
- Stopped partial word auto-add: Removed debounce-triggered topic registration so typing never creates fragment badges ('sp', 'spidrm', 'spiderma'); topics only register when user presses Enter or clicks Search on a full word.
- Fragment pruning & DB sanitization: Added `sanitizeRecentSearchesList` to prune all substring and typo fragments, keeping only complete words in DB, metadata, and topic rails.
- Removed Bluesky: Removed Bluesky tab, card renders, queries, and hot topic radar ingestion from both client and server.

## 2026-11-21 — Feed optimization for searched & tuned topics over generic sparks
- Searched topic prioritization: User ke searched topics aur tuned keywords ko feed pool ke sabse aage rakha, Page 1 par unhi topics ke YouTube Shorts & Trends fetch kiye instead of empty-query random videos.
- Precision relevance & community cap: Search mode me strict relevance ranking enforce ki aur irrelevant community posts exclude kiye; normal feed me searched/tuned matches ko top rank (80M/60M) diya aur generic community sparks ko Page 1 par 2 tak cap kiya taaki user ke searched topics hi dominate karein.

## 2026-11-21 — Auto-add searched topics to user interests across DB & UI
- Searched topic auto-add to interests: koi bhi user jab search kare (search bar, Enter, ya trending tags), topic automatically user ke `interests` keywords list aur Supabase DB me add hota hai, prefix fragments deduplicate hote hain, aur predefined topics se match hone par `selectedTopicIds` me bhi include hota hai.
- Onboarding & Tune modal sync: Onboarding modal me searched/custom interests tags display kiye aur quick add input joda; rail se remove karne par interests aur DB se bhi clean sync rakha.

## 2026-11-21 — Onboarding modal re-trigger jab tak DB me interests khali hain
- Skip ya Close karne par onboarding ko permanently suppress hone se roka: `localStorage` aur DB dono me `onboarded: true` tabhi set hoga jab user ke paas actual saved topics/interests honge.
- Page refresh par DB interests check kiye: agar `selectedTopicIds` aur `interests` khali hain, onboarding modal dobara show hoga jab tak user topics save na kare.

## 2026-11-20 — First-time per-user interest onboarding, isolated DB persistence & dynamic search topics
- Fixed first-time visit onboarding modal: removed global browser-wide localStorage blocker (`GLOBAL_ONBOARDED_KEY`) and hardcoded default topic IDs, strictly scoping onboarding state and storage keys to each authenticated `userKey`.
- Guaranteed per-user persistence: saved preferences, niche topics, and custom interests directly into Supabase Auth `user_metadata.trend_preferences` for each specific user UUID, completely isolating User A and User B.
- Dynamic searched topics rail: added a dedicated curated & searched topics rail below the command bar displaying all selected interest topics plus auto-accumulated searched topics with 1-click filtering and removal.

## 2026-11-20 — Integrated YouTube Shorts into Trend Feed & Detail modal
- Added dedicated `fetchYouTubeShorts` using SerpApi YouTube engine (`search_query: "trending #shorts viral"`, `gl: region`) with fallback to YouTube Data API videos, extracting vertical thumbnails (`frame0.jpg`), views, and short IDs.
- Added "YouTube Shorts" format tab (`/icons/youtube-color-icon.svg`), `type=shorts` filtering in `trendFeed.js`, and distinct red `YouTube Short` badge on feed cards.
- Integrated vertical 9:16 Shorts player in `TrendDetailsBottomSheet` with direct "Watch on YouTube Shorts ↗" button and one-click Composer "Use Idea" integration.

## 2026-11-20 — Made Tune feed modal keywords & country filtering fully workable
- Tuned modal keywords (creator role, custom keywords, preferred formats) now dynamically generate first-class topic objects, taking top priority in external fetches (YouTube, Pinterest, Bluesky, Unsplash, Pexels) and feed ranking.
- Country filter in header now triggers immediate reset, instant ticker refresh (`loadHotTopics`), and drives live regional trends across Google Trends, YouTube popular charts, news, and Pinterest.
- Formatted Tune modal input labels to regular sentence casing and font weight, and removed top badge when in tune mode.

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
- Integrated skeleton placeholder cards directly inside every column simultaneously during loading (`TrendCardSkeleton` across all 4 columns), eliminating blank spaces.

## 2026-11-20 — Refactored Trend Feed to authentic Pinterest layout with uncropped natural image sizing
- Eliminated forced aspect ratios (`aspect-[2/3]`, `aspect-[3/4]`, `object-cover`) on feed cards; images now render at `w-full h-auto block`, preserving their exact original size and aspect ratio without any cropping.
- Restructured `TrendCard` to authentic Pinterest layout: image at the top of the pin, floating hover actions (Save, source link), and clean creator/stats row below.
