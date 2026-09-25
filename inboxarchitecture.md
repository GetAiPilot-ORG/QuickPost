# High-Performance Social Inbox Architecture & Migration Plan

This plan executes your two-stage strategy to transform the Social Inbox from a blocking live aggregator (5–15s latency) into an instant (<100ms) database-backed inbox.

---

## User Review Required

> [!IMPORTANT]
> **Execution Strategy**:
> - **Stage 1 (Today's Quick Relief)**: Implements all low-hanging performance optimizations in the existing codebase without breaking changes or database migrations.
> - **Stage 2 (Permanent Architecture)**: Builds the complete database-backed inbox (`inbox_conversations`, `inbox_messages`, asynchronous workers, split paginated APIs) alongside the existing endpoints, ensuring zero downtime.

---

## Proposed Changes

---

### STAGE 1 — Quick Relief Today

#### [server/src/routes/inbox.js](file:///home/metabull/Projects/QuickPost/server/src/routes/inbox.js)
1. **Reduce Message Limit**: Change conversation query parameters from `messages.limit(15)` to `messages.limit(1)` so the left sidebar only pulls the single latest preview message instead of full chat histories.
2. **Eliminate N+1 Profile Lookups**: Remove per-conversation participant profile requests (`/${participantId}?fields=...`) in the synchronous request path; use available payload fallback avatars.
3. **Enforce 3.5-Second Per-Provider Timeout**: Wrap all external provider requests (`fetchYouTubeComments`, `fetchInstagramComments`, `fetchFacebookComments`, `fetchBlueskyComments`, `fetchMastodonComments`) with an `AbortController` / `timeout: 3500` so no single slow platform stalls the inbox.
4. **User-Scoped Caching**: Add Redis / in-memory cache for `/api/inbox/stream` keyed by `inbox:user:${userId}:stream` with a 45-second TTL. If cached data exists, return in **< 10ms**.

#### [client/src/services/instagramApi.ts](file:///home/metabull/Projects/QuickPost/client/src/services/instagramApi.ts)
1. **Remove Cache Buster**: Eliminate `?_t=${Date.now()}` on thread requests so HTTP caching and browser caching are preserved.

#### [client/src/pages/SocialInboxPage.jsx](file:///home/metabull/Projects/QuickPost/client/src/pages/SocialInboxPage.jsx)
1. **Frontend Stale-While-Revalidate**: Cache loaded conversations in component/context memory so switching tabs or returning to `/dashboard/inbox` paints existing conversations immediately (0ms) while revalidating quietly in the background.

---

### STAGE 2 — Permanent Database-Backed Architecture

#### 1. Database Schema Migration (`supabase/migrations/`)
Create platform-neutral, indexed tables:
- `inbox_conversations` (`id`, `user_id`, `platform`, `account_id`, `external_conversation_id`, `participant_name`, `participant_handle`, `participant_avatar_url`, `last_message_text`, `last_message_at`, `unread_count`, `is_replied`, `status`, `updated_at`)
- `inbox_messages` (`id`, `conversation_id`, `user_id`, `external_message_id`, `direction`, `body`, `message_type`, `media_url`, `sent_at`, `delivery_status`, `raw_payload`)
- `inbox_sync_state` (`user_id`, `platform`, `account_id`, `cursor`, `last_synced_at`)

Composite indexes:
- `(user_id, last_message_at DESC, id DESC)`
- `(user_id, platform, last_message_at DESC, id DESC)`
- `(conversation_id, sent_at DESC, id DESC)`
- `UNIQUE(platform, account_id, external_conversation_id)`
- `UNIQUE(platform, account_id, external_message_id)`

#### 2. Asynchronous Ingestion (Webhooks & Background Workers)
- **Meta Webhook Handler** (`server/src/routes/instapilot.js` & `server/src/routes/inbox.js`): Normalize incoming DMs and comments directly into `inbox_conversations` and `inbox_messages` on webhook receipt.
- **Incremental Sync Worker** (`server/src/workers/inboxSyncWorker.js`): Sync non-webhook platforms (YouTube, Mastodon, Bluesky) on a 2–3 minute recurring interval using `inbox_sync_state`.

#### 3. Split Paginated APIs (`server/src/routes/inboxV2.js`)
- `GET /api/inbox/conversations?limit=30&cursor=...&platform=...` (returns only preview items)
- `GET /api/inbox/conversations/:id/messages?limit=30&before=...` (cursor-paginated messages for opened thread)
- `POST /api/inbox/conversations/:id/reply` (outbound reply dispatch)
- `POST /api/inbox/conversations/:id/read` (mark conversation as read)

#### 4. Frontend Integration (`client/src/pages/SocialInboxPage.jsx`)
- Install & configure `@tanstack/react-query`.
- Prefetch thread data on hover/selection.
- Optimistic outbound messages (`sending` → `sent` / `failed`).
- SSE stream updates only the relevant item in the React Query cache without full list re-fetch.

---

## Verification Plan

### Automated Tests & Benchmarks
- **Response Time Benchmark**:
  - Run `time curl` on `/api/inbox/stream` before and after Stage 1 optimizations (target: drop from 8s+ to <350ms cached).
  - Verify 3.5s timeout triggers gracefully if any provider is mocked as slow or offline.
- **Build Verification**:
  - Run `npm run build` in `client/` to ensure no linting/TypeScript regressions.

### Manual Verification
- Open `/dashboard/inbox` and verify conversation list renders without delay.
- Click across platforms (Instagram, YouTube, etc.) and verify conversations and threads load correctly.
- Test sending a manual reply and verify that the UI updates immediately.














chadgpt:-
My final recommendation: implement this in two stages, but treat Stage 1 as temporary. The permanent fix is a database-backed inbox.

## Stage 1 — Quick relief today

- Change conversation requests from `messages.limit(15)` to `messages.limit(1)`.
- Remove per-conversation avatar/profile API requests from the page-load path.
- Add a 3.5-second timeout to every external platform request.
- Add user-scoped Redis caching for `/api/inbox/stream` with a 30–60 second TTL.
- Add React Query so returning to the inbox shows cached data immediately.

This should noticeably improve the current inbox while the permanent system is built.

## Stage 2 — Permanent architecture

### 1. Store inbox data locally

Create:

- `inbox_conversations`: participant, latest-message preview, unread count, status and timestamps.
- `inbox_messages`: complete message history.
- `inbox_sync_state`: each account’s cursor and last successful synchronization.

Use unique identifiers containing:

```text
user_id + platform + account_id + external_id
```

### 2. Ingest asynchronously

- Meta messages arrive through webhooks.
- Platforms without reliable message webhooks use incremental background synchronization every few minutes.
- Webhook handlers acknowledge quickly.
- Workers handle normalization, profile enrichment and database upserts.
- Never contact external platforms while loading the inbox.

### 3. Split the API

```http
GET /api/inbox/conversations?limit=30&cursor=...
GET /api/inbox/conversations/:id/messages?limit=30&before=...
POST /api/inbox/conversations/:id/reply
POST /api/inbox/conversations/:id/read
```

Use composite cursor pagination:

```text
Conversations: (last_message_at, id)
Messages:      (sent_at, id)
```

### 4. Make the frontend instant

- React Query caches conversations and opened threads.
- Fetch a thread only when selected.
- Load older messages when scrolling upward.
- Optimistically display outgoing messages with `sending`, `sent` or `failed` status.
- SSE updates only the affected conversation/message in the cache.
- Virtualize long lists.

### 5. Migrate safely

- Keep `/api/inbox/stream` temporarily as a fallback.
- Backfill existing conversations into the new tables.
- Compare old and new results for correctness.
- Switch the frontend to the new endpoints.
- Remove the live aggregator only after verification.

## Build order

```text
Quick wins
→ Database migration
→ Ingestion workers/webhooks
→ Paginated APIs
→ React Query and realtime updates
→ Backfill and verification
→ Remove old aggregator
```

Expected targets:

- Cached inbox display: under 100 ms
- Database-backed list/thread request: under 300 ms
- New message appearing through realtime updates: under 1 second

In one sentence: **save platform messages in Postgres as they arrive, read only from Postgres when the inbox opens, and use external APIs only in background ingestion workers.**
