## 2026-10-13
- Added YouTube title input in PlatformCustomization with caption fallback, synced live preview, and wired dedicated title to broadcast uploads.
- Added YouTube channel detection and missing channel/unverified warnings with direct links to youtube.com/create_channel and youtube.com/verify across intelligence engine, composer, and dashboard.

## 2026-10-09
- Pinterest live checks: production boards succeed; Trial Pin creation returns 403/code 29 and the production token fails Sandbox authentication. Switched local API base to Sandbox; restart and reconnect are required.
- Fixed missing Pinterest OAuth import and surfaced board-fetch errors. Mock publishing/error checks, backend syntax checks, and client build passed; live Sandbox publishing remains pending reconnection.

## 2026-10-06
- Diagnosed InstaPilot reply delays: webhooks arrived in 1–2s, but the listener only persisted inbox data; browser polling drove replies. Wired bot handling to live webhook logs, guarded overlapping syncs, and added generation timing.
- Backend syntax and mocked webhook/sync flow checks passed; live latency needs verification after restarting/deploying the API server.

## 2026-11-12
- Added three-hour Auto DM follow-ups with up to three link buttons, message preview, durable scheduling, reply/disable cancellation, messaging-window checks, quota enforcement and duplicate protection.
- Deployed the additive migration and webhook to Supabase; live schema/permission checks passed. Client build, 13 worker/config tests, temporary PostgreSQL checks and UI checks passed; user will deploy backend/frontend. Edge typecheck retains 13 pre-existing errors.
- Fixed public comment spam: self/nested event rejection, permanent per-comment claims, one matching automation and single-attempt public replies. Eleven Edge regression tests and PostgreSQL guard checks passed; deployed guard migration and webhook to Supabase.

## 2026-11-13
- Added response-picker illustrations, cleaner reorderable rows and focused Auto DM UX fixes: clearer optional fields/personalization, readiness validation and simpler follow-up copy.
- Compacted Scheduled Queue with bounded, aligned date-grouped list rows, clarified statuses/pending counts, fixed overdue markers, and added media previews and a time-sorted day agenda for busy dates.
- Client build and isolated desktop/mobile/filter/save/media checks passed, including a 15-post day, video playback and carousel navigation with no schedule mutations. Publishing remains due-time dispatch; advance staging is not implemented.

## 2026-11-13 — Tutorial help
- Mapped all 11 supplied playlist tutorials to screen-specific i buttons; added an embedded video dialog with YouTube/playlist links in the dashboard header, composer and account connection page.
- Client build passed; isolated browser check confirmed AutoDM editor video mapping, and dialog opening. Player is conditionally mounted only while the dialog is open.

## 2026-11-13 — Inbox shared media
- Replaced Instagram reel/post URL-only messages with share cards, available media previews, on-demand Instagram embeds and an Instagram fallback link; restored video rendering and accepted ig_post webhook attachments.
- Client build, backend syntax and share URL validation checks passed. Live preview depends on Meta media availability and Instagram embed access; live account verification remains pending.

## 2026-11-13 — Reel card refinement
- Removed generic reel headers/buttons and bubble padding; available covers/videos now render as rounded vertical media cards, with lazy embeds automatically used for URL-only shares.
- Inbox normalization now checks all webhook attachments and prefers available image/video attachments when loading history. Build and backend syntax checks passed; live Meta media availability remains unverified.

## 2026-11-13 — Remove Instagram embed chrome
- Removed inline Instagram iframes and their profile/follow controls. Available media stays in clean reel cards; unavailable covers now have an explicit compact fallback. Video failures retain a usable cover when available.
- Client build and diff checks passed. URL-only historical messages still need actual cover metadata for the requested native-style thumbnail; this is not solved by the renderer.

## 2026-11-13 — Live reel preview diagnosis
- Read-only inspection of recent inbox records confirmed missing image/video fields on shared links. A live authenticated Meta message request succeeded (HTTP 200) but returned only shares.data[].link, without attachments or cover metadata.
- Native-style covers remain unresolved for URL-only third-party shares. No further cosmetic substitution or production data mutation was made.

## 2026-11-13 — Queue list sorting
- Made list sorting explicit by scheduled time, defaulting to latest first with an oldest-first selector; date groups and within-day rows follow the same direction. Undated/invalid timestamps stay last; calendar order is unchanged.
- Sorting checks covered both directions, same-day times, missing dates and nonmutation; client build and diff checks passed.

## 2026-11-13 — SocialPilot public publishing
- Added default-off “Post on SocialPilot too” consent, immediate/scheduled publishing, durable native media, author display, duplicate protection and per-channel results/retry handling. Trend Feed includes public contributions plus a SocialPilot tab and direct post previews.
- Deployed additive migration 202611130001 after transaction/permission checks. Eight publishing/feed/retry tests, client build and isolated desktop/mobile opt-in/carousel checks passed; no real user posts were published during verification. Backend/frontend deployment remains with the user.
