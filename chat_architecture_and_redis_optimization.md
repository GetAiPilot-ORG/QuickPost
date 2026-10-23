# High-Performance Chat & Social Inbox Architecture

This specification outlines the unified, production-ready chat architecture for **GetAiPilot** (Mobile App, BFF, and QuickPost Server). It details how to eliminate background database egress spikes, prevent Redis cache thrashing, and achieve sub-100ms message delivery.

---

## 1. The "Before" Architecture (The Root Cause of Failure)

Prior to optimization, the system suffered from **passive full-table polling**, **endpoint fragmentation**, and **cache thrashing**:

```mermaid
flowchart TD
    subgraph Problem1["Flaw 1: Passive Polling Loop"]
        CRON["Cron (Every 3m)"] --> WORKER["unifiedInboxWorker.js"]
        WORKER -->|Polls 63 Accounts| META_API["Meta / Google Graph APIs"]
        WORKER -->|63 Individual Upserts| DB_SYNC["Supabase: inbox_sync_state"]
    end

    subgraph Problem2["Flaw 2: Redis Thrashing Cycle"]
        DB_SYNC -->|Triggers Invalidation| REDIS_DEL["DEL inbox:stream:v1:*"]
        REDIS_DEL --> REDIS_COLD[("Redis Cache Cold (TTL Wiped)")]
        USER_REQ["User / Mobile Request"] --> REDIS_COLD
        REDIS_COLD -->|Cache Miss: 100% Reads Hit DB| PG_LOAD["Postgres & Kong Egress Spike"]
        PG_LOAD -->|Egress Exceeded| LOCK_402["HTTP 402 Restriction"]
    end

    subgraph Problem3["Flaw 3: Split-Brain Mobile Client"]
        MOBILE_APP["Mobile App"]
        MOBILE_APP -->|Screen A: Social Tab| EP1["/social/inbox/conversations"]
        MOBILE_APP -->|Screen B: Main Inbox| EP2["/social/instapilot/conversations"]
        MOBILE_APP -->|Screen C: Telegram| RAW_TG["Direct Client DB Query (200 raw msgs)"]
    end
```

### Why Redis Thrashing Occurred:
1. **Unnecessary Invalidation**: `unifiedInboxWorker` ran every 3 minutes. Even when **zero new messages** arrived, it updated `last_attempt_at` in `inbox_sync_state` for all 63 accounts.
2. **Global Key Nuking**: Database changes triggered `invalidateInboxCache()`, destroying the entire user stream cache key (`inbox:stream:v1:*`).
3. **Cache Miss Storm**: Because cache was constantly wiped every 3 minutes, almost every incoming client request resulted in a cache miss, slamming Kong API Gateway and Postgres with raw queries.

---

## 2. The "After" Architecture (Event-Driven & Multi-Tier Redis Shielding)

The optimized architecture operates on three core principles:
1. **Webhooks-First**: 100% event-driven for platforms that support webhooks (Instagram, Facebook, WhatsApp, Telegram). Zero background polling.
2. **Lazy On-Demand Sync**: Passive platforms (YouTube comments, Bluesky) only sync when an authenticated user actively views the inbox.
3. **Targeted Redis Shielding**: Invalidate only the specific updated thread—never nuke the entire user inbox cache.

```mermaid
flowchart TB
    subgraph Clients["1. Unified Client Layer"]
        MOBILE["Mobile App (iOS / Android)"]
        WEB["Web Dashboard (social.getaipilot.in)"]
    end

    subgraph Gateway["2. API Gateway & BFF Layer"]
        BFF["Getaipilot-BFF (app.getaipilot.com)"]
        QP_API["QuickPost API (api.getaipilot.in)"]
    end

    subgraph RedisTier["3. Redis Anti-Thrashing Cache (In-Memory <5ms)"]
        R_LOCK["Single-Flight Mutex (15s TTL)<br/><code>lock:sync:{userId}:{platform}</code>"]
        R_LIST["Conversations List Cache (120s TTL)<br/><code>inbox:convs:{userId}:{channel}</code>"]
        R_THREAD["Thread Messages Cache (300s TTL)<br/><code>inbox:thread:{convId}</code>"]
    end

    subgraph Ingestion["4. Hybrid Ingestion Engine"]
        WH_META["Meta Webhook Push<br/>(Instagram DMs, FB Messages)"]
        WH_WA["WhatsApp Cloud API Webhook"]
        WH_TG["Telegram Bot Webhook"]
        LAZY_SYNC["Lazy Worker<br/>(YouTube / Bluesky on active session)"]
    end

    subgraph Storage["5. Single Source of Truth (Supabase Postgres)"]
        T_CONV[("inbox_conversations")]
        T_MSG[("inbox_messages")]
        T_SYNC[("inbox_sync_state<br/>(Single Batch Write)")]
    end

    %% Connections
    CLIENTS --> Gateway
    MOBILE --> BFF
    WEB --> QP_API
    BFF --> QP_API

    QP_API <--> R_LIST
    QP_API <--> R_THREAD

    WH_META -->|Instant Push <500ms| QP_API
    WH_WA -->|Instant Push <500ms| BFF
    WH_TG -->|Instant Push <500ms| BFF

    QP_API -->|Write on Webhook| T_CONV
    QP_API -->|Write on Webhook| T_MSG
    LAZY_SYNC -.->|Batch Write Every 15m| T_SYNC

    QP_API -.->|Targeted Cache Patch| R_LIST
    QP_API -.->|Targeted Cache Patch| R_THREAD
```

---

## 3. Inbound Webhook Execution Flow (Instant Delivery)

When a customer sends an Instagram DM, Facebook message, or WhatsApp text, it bypasses background cron workers completely:

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer / Follower
    participant Meta as Meta Graph / Webhook Gateway
    participant QP as QuickPost Server (api.getaipilot.in)
    participant Redis as Redis Cache
    participant DB as Supabase Postgres
    participant SSE as Realtime SSE Broadcaster
    actor Creator as Creator (Mobile / Web App)

    Customer->>Meta: Sends Instagram DM / Comment
    Meta->>QP: POST /api/instapilot/webhooks/instagram (Signed HMAC-SHA256)
    QP->>QP: Verify Signature & Acknowledge 200 OK (<50ms)
    
    rect rgb(240, 248, 255)
    Note over QP,DB: Asynchronous Ingestion Pipeline
    QP->>DB: Upsert into `inbox_conversations` (Update last_message, unread_count + 1)
    QP->>DB: Insert into `inbox_messages` (Delivery status: 'received')
    end

    rect rgb(255, 250, 240)
    Note over QP,Redis: Anti-Thrashing Targeted Invalidation
    QP->>Redis: Invalidate ONLY `inbox:convs:{userId}:*` and `inbox:thread:{convId}`
    Note right of Redis: Other conversations and cached accounts stay warm in RAM!
    end

    QP->>SSE: Emit Event `new_message` { conversationId, body, sender }
    SSE->>Creator: Instant Push Notification & Live UI Paint (<300ms total)
```

---

## 4. User Inbox Read Flow with Single-Flight Redis Mutex

When the creator opens the inbox screen, the request is intercepted by Redis. If a cache miss occurs, a single-flight mutex ensures only **one** database query is run, preventing "dog-piling":

```mermaid
sequenceDiagram
    autonumber
    actor Creator as Creator Opens Inbox
    participant BFF as Getaipilot-BFF
    participant QP as QuickPost API
    participant Redis as Redis Store
    participant DB as Supabase DB

    Creator->>BFF: GET /mobile/v1/social/inbox/conversations
    BFF->>QP: GET /api/inbox/conversations?userId=...
    QP->>Redis: GET `inbox:convs:{userId}:all`

    alt Cache Hit (90%+ of calls)
        Redis-->>QP: Return Cached JSON (<5ms)
        QP-->>BFF: 200 OK (X-Inbox-Cache: HIT)
        BFF-->>Creator: Render Inbox Screen (<30ms)
    else Cache Miss (Cold state or expired)
        QP->>Redis: SETNX `lock:inbox:{userId}` (10s TTL Mutex)
        alt Mutex Acquired
            QP->>DB: Query `inbox_conversations` (Indexed: user_id, last_message_at DESC)
            DB-->>QP: 25 Rows Returned
            QP->>Redis: SETEX `inbox:convs:{userId}:all` 120s
            QP->>Redis: DEL `lock:inbox:{userId}`
            QP-->>BFF: 200 OK (X-Inbox-Cache: MISS)
            BFF-->>Creator: Render Inbox Screen
        else Mutex Locked (Concurrent request already fetching)
            QP->>QP: Wait 50ms & Re-check Redis Cache
            Redis-->>QP: Return newly cached JSON
            QP-->>BFF: 200 OK
            BFF-->>Creator: Render Inbox Screen
        end
    end
```

---

## 5. Redis Key Schema & TTL Policy

To prevent cache thrashing, use targeted namespaces with strict expiration policies:

| Cache Key | Type | TTL | Purpose | Invalidation Event |
| :--- | :--- | :--- | :--- | :--- |
| `inbox:convs:{userId}:{channel}` | `STRING` (JSON) | 120s | Stores top 50 conversation previews for the left sidebar. | Only on new inbound webhook or sent outbound reply. |
| `inbox:thread:{userId}:{convId}` | `STRING` (JSON) | 300s | Stores message history for the actively open chat. | Only when a new message arrives in that specific `convId`. |
| `inbox:sync_lock:{userId}:{platform}` | `STRING` (Mutex) | 15s | Single-flight lock preventing duplicate concurrent API calls. | Automatic TTL expiration. |
| `inbox:cooldown:{accountId}` | `STRING` | 1800s (30m) | Blocks syncing accounts that returned rate-limits or timeouts. | Automatic TTL expiration. |

---

## 6. Implementation Action Plan

### Step 1: Mobile App Endpoint Consolidation
* In [`getaipilot-app/src/features/inbox/api/inboxApi.ts`](file:///home/metabull/Projects/mobile/getaipilot-app/src/features/inbox/api/inboxApi.ts):
  * Replace the call to `/mobile/v1/social/instapilot/conversations` with `/mobile/v1/social/inbox/conversations`.
  * Point all Instagram, Facebook, and multi-channel UI components to the unified `inbox_conversations` contract.

### Step 2: Skip Webhook-Supported Platforms in Background Worker
* In [`QuickPost/server/src/workers/unifiedInboxWorker.js`](file:///home/metabull/Projects/QuickPost/server/src/workers/unifiedInboxWorker.js):
  * Exclude `instagram` and `facebook` from the recurring cron if their webhooks are active.
  * Only sync `youtube` and `bluesky`.

### Step 3: Implement Batch Writes in `unifiedInbox.js`
* In [`QuickPost/server/src/services/unifiedInbox.js`](file:///home/metabull/Projects/QuickPost/server/src/services/unifiedInbox.js):
  * Replace per-account `recordInboxSyncState` upserts with a single batched array upsert:
    ```javascript
    await supabase.from('inbox_sync_state').upsert(syncResultsBatch, {
      onConflict: 'user_id,platform,account_id'
    });
    ```

### Step 4: Add Redis Caching to `/inbox/conversations`
* Wrap `listInboxConversations` in [`inbox.js`](file:///home/metabull/Projects/QuickPost/server/src/routes/inbox.js) with the `inbox:convs:{userId}` Redis cache key with 120s TTL and single-flight mutex protection.
