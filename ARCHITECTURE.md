# Trend Page Architecture

## Data
- `public.posts` is the canonical normalized inspiration item table across source platforms.
- External-source dedupe starts at `source_url`; ingestion can add stronger content-hash handling when the worker exists.
- `pgvector` is enabled now, with `embedding vector(1536)` reserved for later personalization/tag similarity.

## Execution
- Phase work follows `TODO.md` order.
- Paid APIs, scraping/ToS risk, Supabase data deletion, or architecture conflicts must stop in `BLOCKERS.md`.
- Trend source credentials stay server-side in `server/.env`; the frontend only receives Supabase anon config and API base URLs.
- YouTube ingestion starts from `server/src/services/trendYoutubeClient.js`, using official `videos.list?chart=mostPopular` and a 10,000-unit daily budget guard.
- The YouTube cron worker is a separate server process at `server/src/workers/trendYoutubeWorker.js`; the API server does not own ingestion scheduling.
- `server/src/services/trendPostNormalizer.js` maps platform payloads into `public.posts`; AI-generated niche tags are intentionally empty until Phase 6.
- `content_hash` is generated server-side from stable normalized post fields and enforced with a partial unique index.
- Feed API ranks a bounded recent candidate pool with `recency_decay * engagement_velocity` and paginates using `rank_score desc, id desc`.
- Feed page responses cache in Redis when `REDIS_URL` or `BULLMQ_REDIS_URL` is configured; missing/unavailable cache falls back to Supabase.
- Frontend trend work lives in the existing Vite React dashboard client; adding a separate Next.js app is deferred unless the product moves off this client shell.
- Trend Feed uses `react-virtuoso` grid virtualization in the dashboard route.
- Seen-post exclusion is browser-scoped per user via localStorage and the feed API `seen` query param; promote to a DB table only when cross-device history is needed.
- Trend preference onboarding is browser-scoped per user via localStorage and the feed API `interests` query param; promote to DB profiles when cross-device personalization is needed.
- Trend cards render official YouTube iframes from validated embed/source URLs; raw stored embed HTML is never injected into React.
- The API prefers unseen posts but falls back to seen rows when the candidate pool is exhausted, so low-volume ingestion never renders a blank feed.
- Interest matching boosts ranked posts that mention selected work/interests/goals, but does not hide the rest of the feed while source volume is still low.
- Trend Feed virtualization uses `react-virtuoso` `listClassName`/`itemClassName`; custom grid wrappers must preserve library measurement props.
- Short feed pages render with native CSS grid; virtualization starts only after the first page is exceeded.
- YouTube embeds include page origin/referrer policy, and ingestion records `status.embeddable` so blocked videos fall back to thumbnail links.
- Reddit ingestion uses official OAuth API app tokens against `oauth.reddit.com`, surfaces 429 retry hints, stores no embeds, and routes normalized posts through the shared `posts` dedupe insert pipeline.
- Bluesky ingestion uses the public Jetstream WebSocket filtered to `app.bsky.feed.post`; raw CBOR/CAR `subscribeRepos` is deferred because Jetstream gives the needed public post stream with lower bandwidth and simpler JSON parsing.
- Social Inbox Stage 1 keeps the live aggregator temporarily, with tenant-scoped Redis caching, 3.5-second provider timeouts, one-message Meta previews, and lazy full-thread reads on selection.
- Inbox refresh requests bypass and repopulate the Redis cache; successful replies invalidate the tenant cache. Redis failures fall back to uncached aggregation.
