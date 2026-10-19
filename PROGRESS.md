## 2026-10-13
- Added YouTube title input in PlatformCustomization with caption fallback, synced live preview, and wired dedicated title to broadcast uploads.
- Added YouTube channel detection and missing channel/unverified warnings with direct links to youtube.com/create_channel and youtube.com/verify across intelligence engine, composer, and dashboard.

## 2026-10-09
- Pinterest live checks: production boards succeed; Trial Pin creation returns 403/code 29 and the production token fails Sandbox authentication. Switched local API base to Sandbox; restart and reconnect are required.
- Fixed missing Pinterest OAuth import and surfaced board-fetch errors. Mock publishing/error checks, backend syntax checks, and client build passed; live Sandbox publishing remains pending reconnection.

## 2026-10-06
- Diagnosed InstaPilot reply delays: webhooks arrived in 1–2s, but the listener only persisted inbox data; browser polling drove replies. Wired bot handling to live webhook logs, guarded overlapping syncs, and added generation timing.
- Backend syntax and mocked webhook/sync flow checks passed; live latency needs verification after restarting/deploying the API server.
