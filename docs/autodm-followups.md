# Auto DM follow-ups

The automation editor stores `response_flow.follow_up` with `enabled`, `message`,
and a fixed `delay_hours: 3`. Disabled by default. Text and channel links are
supported, with up to three link buttons (20-character titles, HTTP/HTTPS URLs).
The 900 UTF-8 byte message limit leaves room for the free-plan watermark; messages
with buttons also have a 600-character limit. Buttons use Meta’s button template
and are preserved in the Social Inbox. The editor includes a message preview.

After a fully successful final response segment (no pending continuation), the
webhook engine calls `schedule_autodm_followup`. Only genuine inbound DMs or reply
postbacks open eligibility; comments, echoes, and link opens do not. Provider
webhook timestamps determine the 24-hour window, not webhook arrival time.

A persisted reminder is unique per automation/account/recipient, including after
cancellation or failure. This is one follow-up per person for that automation,
not a repeating inactivity campaign. Replies cancel queued/claimed reminders;
pausing the automation or disabling follow-ups also cancels them permanently.

The API server polls every 30 seconds in batches of ten. Database row locks prevent
multiple API instances claiming the same job. Before sending, the worker checks
account ownership/connection, automation schedule/settings, latest recipient
activity, token expiry, and monthly reply quota. Confirmed rate rejections retry
at most five attempts within the messaging window, using one quota reservation.
Unknown network outcomes and stale claims are never resent automatically.
Messages use the existing recipient ID and are logged to Auto DM and Social Inbox.
A reply arriving after the final check can race a request already sent to Meta.

## Deployment

Supabase migration `202611120001_autodm_followups.sql` and the updated `webhook`
function were deployed to project `oqaysrnncwbtrujnxsdo` on 2026-11-12. Tables,
triggers, migration history and worker/client permissions were verified live.

1. Deploy the updated client.
2. Deploy/restart the API server. Existing Supabase service-role credentials and
   Instagram token-encryption keys are reused; there is no additional paid API.
3. Enable follow-ups on an automation, enter the message/channel URL, and save.

Only flows completed after deployment are eligible; historical messages are not
backfilled. Verify with a real recipient reply/button tap, successful resource
delivery, and no further reply for three hours. No live message was sent during
local verification. Run worker tests with `npm --prefix server run test:autodm-followups`.
