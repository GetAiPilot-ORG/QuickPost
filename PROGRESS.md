
## 2026-10-06
- Diagnosed InstaPilot reply delays: webhooks arrived in 1–2s, but the listener only persisted inbox data; browser polling drove replies. Wired bot handling to live webhook logs, guarded overlapping syncs, and added generation timing.
- Backend syntax and mocked webhook/sync flow checks passed; live latency needs verification after restarting/deploying the API server.
