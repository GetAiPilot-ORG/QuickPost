# Trend Page Architecture

## Data
- `public.posts` is the canonical normalized inspiration item table across source platforms.
- External-source dedupe starts at `source_url`; ingestion can add stronger content-hash handling when the worker exists.
- `pgvector` is enabled now, with `embedding vector(1536)` reserved for later personalization/tag similarity.

## Execution
- Pinterest Trial publishing uses `PINTEREST_API_BASE_URL=https://api-sandbox.pinterest.com/v5`; OAuth exchange, refresh, boards, and Pins must use the same environment. Reconnect after changing environments because production tokens do not authenticate in Sandbox. Standard access is required for production Pin creation.
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
- Social Inbox Stage 2 reads normalized conversation previews and messages from `inbox_conversations` and `inbox_messages`, using `(timestamp, id)` cursors; `inbox_sync_state` holds per-account incremental sync state.
- The legacy aggregator remains a migration/backfill fallback and writes fetched items into the unified inbox. Instagram messaging webhooks persist to unified inbox tables before optional InstaPilot automation runs; the main Social Inbox never depends on an imported bot account or InstaPilot's DM-sync status.
- Non-webhook inbox sources synchronize through the separate `worker:inbox` process on `INBOX_SYNC_CRON` (three minutes by default), with bounded five-account batches and per-account status in `inbox_sync_state`.
- Instagram OAuth subscribes the account to Meta webhooks automatically; the inbox worker performs one idempotent subscription check per credential version for already-connected accounts.
- Broadcast retries checkpoint successful exact account channels in `platform_data.completedChannels`; retry workers publish only unfinished channels so a failure on one provider cannot duplicate posts on another.
- Expired Meta credentials are skipped, and permanent authorization/scope failures cool down for 24 hours unless account credentials are updated; transient timeouts remain eligible for the next sync.
- Social Inbox subscribes to Supabase Realtime changes on `inbox_conversations`, debounces burst updates, refreshes the active thread when affected, and revalidates when the browser tab becomes visible.
- A visibility-aware 15-second database poll covers missed Realtime events; source freshness still depends on webhook delivery or the three-minute provider synchronization worker.

- InstaPilot replies run from the API server’s `webhook_logs` Realtime listener after unified inbox persistence; keep `ENABLE_LOCAL_WEBHOOK_WORKER` enabled on the bot-serving process. Manual Graph inbox sync shares one in-flight operation per user per process.
- Auto DM follow-ups persist in `autodm_followups`; verified inbound DM/postback webhooks update `autodm_dm_activity` and cancel reminders on replies. Comment/echo events never open a messaging window.
- The webhook engine queues one reminder per automation/account/recipient after a complete successful flow. The API polls every 30 seconds, claims with `SKIP LOCKED`, enforces the three-hour delay/24-hour window and existing quotas, and never replays ambiguous sends. Follow-up link buttons use Meta button templates and preserve their payload in the unified inbox; see `docs/autodm-followups.md` for deployment.

- Auto DM comment delivery uses a permanent `autodm_comment_claims` receipt keyed only by the provider comment ID, acquired before sending. Existing comment webhook IDs are seeded by migration `202611120002` to block historical replays; RLS permits server-only claims.
- Own/nested comment events are rejected before account lookups and checked again against resolved account identities. Comment events execute only the oldest matching automation (ID breaks creation-time ties); public comment POSTs are attempted once, with no retry after uncertain delivery.

- Scheduled Queue shares status presentation across calendar/list/details; Pending groups `scheduled`, `queued` and `processing`. Only waiting jobs show countdowns; completed/failed jobs never show overdue markers.
- The current publishing scheduler polls due jobs every minute by default; provider uploads/processing run after dispatch, with just-in-time media download when local files are missing. Scheduled time is a target rather than an exact live-time guarantee; advance provider preparation is not implemented.
- Scheduled media previews resolve `media_urls` plus legacy `media_url`, use stored covers where available, and show native controlled video/image galleries. Video thumbnails load metadata only near the viewport; busy calendar days use a time-sorted agenda instead of expanding the whole week.

- SocialPilot publishing is an explicit, default-off composer opt-in, added server-side as the `socialpilot` broadcast target. It uses the same immediate/scheduled execution paths, durable cloud media and per-channel retry receipts as external providers.
- Native community posts extend canonical `public.posts` with author display snapshots, media URLs/type and a publication key. IDs derive from authenticated user + source job/broadcast identity; insert-only upserts make duplicate deliveries idempotent. Existing authenticated-read/server-only-write RLS remains in force.
- Trend Feed interleaves native posts with external items and exposes a SocialPilot tab with descending `(published_at,id)` cursor pagination. Native media uses controlled image/video/carousel previews; authenticated `/api/trends/posts/:id` resolves share links. Community reads intentionally span authors; private auth/account records are never included.
