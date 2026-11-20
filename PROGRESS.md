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
