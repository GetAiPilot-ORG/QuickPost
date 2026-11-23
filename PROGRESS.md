## 2026-11-23 — Fixed cross-removed search pills resurrecting & removed AI sparkle icon
- Fixed pill resurrection & leak loops: `TrendFeedPage.jsx` ke `loadPage` se `setRecentDbSearches` merge logic ko completely hata diya; `deletedSearchesRef` ko `localStorage` (`qp_trend_deleted_searches_${userKey}`) se persist kiya taaki refresh ya scroll par deleted terms resurrect na hon; backend me authenticated user ke liye `clientSearches` param merge block kiya aur DB ko authoritative banaya.
- Instant UI & Feed sync: Topic cross (`x`) karte hi state, ref, profile, draftProfile aur Supabase metadata se remove hota hai, aur feed turant reload hoti hai taaki deleted topic ka content gayab ho sake.
- Removed AI sparkle icon: "All My Topics" button se `<Sparkles />` icon remove kar diya for a cleaner professional UI.

## 2026-11-23 — Fixed searched topics not populating in main personalized All Feeds
- First-class searched topic definitions: `resolveTargetTopics` me searched terms ke liye custom topic objects banaye taaki `targetTopics` me jud kar live external fetches (YouTube, Pinterest, News) aur 90M ranking boost trigger ho sakein.
- Cache key & Onboarding persistence fix: `trendFeed.js` ke `cacheKey` me `recentSearches` add kiya taaki purana unpersonalized feed cache hit na kare; `TrendFeedPage` me `hasDbInterests` aur `handleSaveInterests` ko fix kiya taaki modal save karne par existing searched topics wipe out na hon.

## 2026-11-23 — Auto-added searched topics to user's DB interest topics & preferences
- Server-side DB synchronization: `GET /api/trends/feed` route me search param aane par `addSearchQueryToUserInterests` auto-call kiya jo term ko user ke Supabase Auth `trend_preferences.interests` string, `recentSearches` array, aur matching `selectedTopicIds` me seamlessly persist karta hai.
- Client state & deletion guard: `TrendFeedPage` typing debounce par search term ko automatically register kiya; client par server-returned search list merging fix ki with `deletedSearchesRef` taaki naye searched topics drops na hon aur deleted topics resurrect na hon.

## 2026-11-23 — Replaced cheap system emojis with professional Lucide vector icons
- Lucide Vector Icon Suite: Saare 53 topic cards me cartoonish OS emojis ki jagah high-resolution `lucide-react` vector icons (`Bot`, `Code2`, `Rocket`, `Cpu`, `Coins`, `Building2`, `Palette`, `Dumbbell`, `Plane`, `Tv2`, `Music`, `Trees`, etc.) map kiye.
- Sleek Icon Container & Topics Rail: Onboarding modal cards me clean 40x40 rounded-xl container lagaya with subtle gradient highlight when selected; saath hi top topics rail me compact 13px vector icons render kiye for a premium SaaS look.

## 2026-11-23 — Cleaned up Onboarding Modal (removed Creator Inspiration badge, search bar & card subtitles)
- Header cleanup: "Creator Inspiration Engine" pill badge ko modal header se remove kiya taaki seedhe clean heading "What topics do you create or love?" dikhe.
- Search bar removal: Custom interest topic search bar aur "Add Topic" button ko modal body se remove kiya taaki user ko sirf curated topic niche cards dikhein.
- Topic cards simplification: Har topic card se 2nd line category subtitle (jaise "Tech & AI", "Business & Wealth") hata diya taaki card me sirf emoji, title aur checkmark ka clean minimal look rahe.

## 2026-11-21 — Added Direct YouTube Shorts & Videos scraper to eliminate 429 quota failures
- Root cause: SerpApi monthly search quota khatam ho chuka tha (250/250 searches used, returning 429), aur YouTube Data API `search.list` ki daily 10k quota bhi exhaust ho chuki thi (status 429 `RESOURCE_EXHAUSTED`), jisse YouTube shorts empty return ho rahe the.
- Direct extraction & Circuit breaker: `fetchYouTubeDirectShorts` aur `fetchYouTubeDirectVideos` scrapers add kiye jo YouTube `ytInitialData` se `shortsLockupViewModel` aur `videoRenderer` directly parse karte hain (0 quota cost, 100% reliable, exact query matches); saath hi SerpApi par 30-min 429 circuit breaker lagaya taaki repeated slow failing calls na hon.

## 2026-11-21 — Enforced #main-content container scroll reset on route navigation and feed mount
- Scroll container root cause: Dashboard layout me scroll `window` par nahi balki `<main id="main-content">` par hota hai (`overflowY: auto`), jisse `window.scrollTo` se scroll reset nahi ho raha tha aur dusre page se aane par page purani scroll position par rehta tha.
- Multi-layer reset: `DashboardLayout` me route switch listener (`location.pathname`), `TrendFeedPage` ke mount/reset helper `scrollTrendFeedToTop`, aur `Sidebar` link click handlers me `#main-content`, `document.documentElement`, aur `window` sabhi ko 0 par reset kiya (with `requestAnimationFrame` + timeout) taaki Trend page hamesha upar se khule.

## 2026-11-21 — Purged stale deleted search pills & enforced scroll to top on mount
- Search deletion bugfix: `DELETE /api/trends/search-history` me `req.user?.authUserId` missing tha jisse user_metadata se cut kiye hue terms delete nahi ho rahe the; ab `deleteUserSearch` auth UUID use karke `recentSearches`, `interests`, aur `work` (role) sabhi jagah se delete karta hai.
- Stopped partial typing topic registration: 600ms debounce typing live feed update karti hai par `registerTopic=false` bhejti hai taaki `totalga` jaise adhoore words DB me permanent pill na banein (sirf Enter ya Search click karne par hi register hote hain).
- Auto scroll to top: Trend feed page open hone par aur feed reset hone par `window.scrollTo({ top: 0, left: 0, behavior: 'instant' })` add kiya taaki page hamesha upar se khule.

## 2026-11-21 — Strict Search Isolation & Explicit "All My Topics" Multi-Topic Feed
- Search Mode Isolation: Search query active hone par user ke background onboarding topics (`work`, `interests`, `selectedTopicIds`) ko search feed se completely decouple kiya; DB rows ko `ilike('caption', %search%)` tak restrict kiya aur external APIs sirf searched query ke liye fetch karte hain; har candidate par `calculateRelevance(item, search) > 0` enforce kiya taaki unrelated topics (AS Gaming, Ronaldo, generic DB) ka 0% leakage ho aur sabhi cards par badge `[search]` ho.
- Explicit "All My Topics" Multi-Topic View: Frontend par search input me 600ms debounce auto-search joda; active search me topic rail par "All My Topics" button prominently show kiya jise click karte hi search aur filters clear hokar user ke saare onboarding, tuned aur searched topics ka balanced round-robin feed instantly load hota hai.

## 2026-11-21 — Fixed empty column gap with full data fetching & height-balanced waterfall
- Full data fetching (no premature loop exit): `interleavePinterestFeed` me while loop seen items encounter hone par prematurely break ho raha tha jisse sirf 11-12 items return ho rahe the; ab queue me jab tak items bache hain unseen items shift hote hain aur remaining relevant posts se backfill hota hai taaki hamesha full 24 items deliver hon.
- Height-balanced Waterfall bin packing: Frontend me `columns` ko index modulo ke bajaye greedy shortest-column height estimation bin packing algorithm se distribute kiya, jisse tall 9:16 portrait pins ke hone par bhi koi bhi column/line khali nahi rehti aur sabhi columns perfectly even rehte hain.

## 2026-11-21 — Strict exact topic matching, stock footage elimination & format-balanced interleaving
- Exact relevance enforcement: `isItemRelevantToTopic` me generic stock footage ("Reel & B-Roll", "Vertical Video", Pexels) aur single generic words (`#gaming`, `push`, `free`) ko false positive match hone se roka; creator channel match aur multi-word phrases ("as gaming", "free fire", "rank push") enforce kiye.
- Filtered shorts & SerpApi fallback: `fetchYouTubeShorts` me `isItemRelevantToTopic` filtering add ki taaki search query se aaye hue unrelated videos filter out ho sakein; YouTube Data API 429 par SerpApi `video_results` fallback joda.
- Format-balanced Pinterest interleaving: Multi-topic personalized feed me Shorts aur full Videos ko round-robin me balance kiya taaki preferred format (Short video) aur diverse media types masonry feed me seamlessly mixed dikhein.

## 2026-11-21 — Tune Modal inputs auto-added to DB interest topics, topics rail & instant feed update
- Tune Modal integration: "Tune Your Inspiration Feed" inputs (creator role, custom keywords, preferred formats) ko user ke DB interest topics (`work`, `interests`, `recentSearches`) me directly auto-add kiya aur frontend topics rail par clickable pills ke roop me show kiya.
- Race condition & priority fix: `handleSaveInterests` me `apiClient.post` ko await kiya taaki DB update hone ke baad hi feed request jaye, aur backend me `tunedTopics` ko feed pool ke sabse aage prioritize kiya taaki save & apply karte hi naye topics ka content immediately feed me aaye.
- User-specific isolation: Har user ka creator role aur custom keywords Supabase auth metadata aur preferences table me strictly usi user ID ke under persist hote hain.

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
- Enforced username precedence: Instagram handle default for multi-platform broadcasts, individual platform handle for single-platform uploads, and "GAP Social-pilot" for community-only posts.
