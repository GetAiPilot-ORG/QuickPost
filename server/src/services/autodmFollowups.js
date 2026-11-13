import { normalizeFollowupConfig } from './autodmFollowupConfig.js';

const WINDOW_MS = 24 * 60 * 60 * 1000;
export const FOLLOWUP_DELAY_MS = 3 * 60 * 60 * 1000;

export function followupEligibility(job, automation, account, activity, now = Date.now()) {
  if (!automation?.is_active || !account?.is_connected || automation.instagram_account_id !== job.instagram_account_id || account.user_id !== job.user_id) return 'automation_unavailable';
  if (automation.starts_at && Date.parse(automation.starts_at) > now) return 'automation_not_started';
  if (automation.ends_at && Date.parse(automation.ends_at) <= now) return 'automation_expired';
  if (automation.response_flow?.follow_up?.enabled !== true) return 'followup_disabled';
  try { normalizeFollowupConfig(automation.response_flow.follow_up); } catch { return 'invalid_message'; }
  const inbound = Date.parse(activity?.last_inbound_at);
  if (!Number.isFinite(inbound) || inbound > Date.parse(job.inbound_at)) return 'recipient_replied';
  if (inbound + WINDOW_MS <= now || inbound > now) return 'messaging_window_closed';
  if (Date.parse(job.scheduled_at) + FOLLOWUP_DELAY_MS > now) return 'not_due';
  if (account.token_expires_at && Date.parse(account.token_expires_at) <= now) return 'token_expired';
  return null;
}

export async function sendFollowupMessage(token, senderId, text, buttons = [], fetchImpl = fetch) {
  const message = buttons.length ? {
    attachment: { type: 'template', payload: {
      template_type: 'button', text,
      buttons: buttons.map(({ title, url }) => ({ type: 'web_url', title, url })),
    } },
  } : { text };
  const base = (process.env.IG_GRAPH_BASE_URL || 'https://graph.instagram.com/v24.0').replace(/\/$/, '');
  const versioned = /\/v\d+\.\d+$/.test(base) ? base : `${base}/${process.env.IG_GRAPH_VERSION || 'v24.0'}`;
  const response = await fetchImpl(`${versioned}/me/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: senderId }, messaging_type: 'RESPONSE', message }),
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  if (!response.ok || result.error) {
    const error = new Error(`Meta rejected follow-up (${response.status}, code ${result.error?.code || 'unknown'})`);
    error.rateLimited = response.status === 429 || [4, 17, 32, 613].includes(result.error?.code);
    const retrySeconds = Number(response.headers.get('retry-after'));
    error.retryAfterMs = Number.isFinite(retrySeconds) && retrySeconds > 0 ? Math.min(retrySeconds * 1000, 3600000) : 60000;
    throw error;
  }
  if (!result.message_id) throw new Error('Meta delivery outcome unknown: missing message ID');
  return result.message_id;
}

export function createFollowupProcessor({ db, decryptToken, reserveUsage, syncMessage, send = sendFollowupMessage, logger = console }) {
  async function read(query) {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data;
  }
  async function finish(job, values) {
    const { error } = await db.from('autodm_followups').update(values).eq('id', job.id).eq('status', 'sending');
    if (error) throw new Error(error.message);
  }
  return async function processDueFollowups() {
    for (let i = 0; i < 10; i++) {
      const jobs = await read(db.rpc('claim_autodm_followup'));
      const job = jobs?.[0];
      if (!job) break;
      let delivered = false;
      try {
        const [automation, account, activity] = await Promise.all([
          read(db.from('automations').select('id,is_active,instagram_account_id,response_flow,starts_at,ends_at').eq('id', job.automation_id).maybeSingle()),
          read(db.from('instagram_accounts').select('id,user_id,is_connected,access_token_encrypted,token_expires_at').eq('id', job.instagram_account_id).maybeSingle()),
          read(db.from('autodm_dm_activity').select('last_inbound_at').eq('instagram_account_id', job.instagram_account_id).eq('sender_id', job.sender_id).maybeSingle()),
        ]);
        const reason = followupEligibility(job, automation, account, activity);
        if (reason) { await finish(job, { status: 'cancelled', last_error: reason }); continue; }
        const bundle = decryptToken(account.access_token_encrypted);
        const token = bundle.pageAccessToken || bundle.accessToken || bundle.access_token;
        if (!token) throw new Error('Missing Instagram messaging token');
        const usage = await reserveUsage(job.user_id, job.usage_reserved);
        if (!usage.allowed) { await finish(job, { status: 'cancelled', last_error: 'monthly_reply_limit_reached' }); continue; }
        if (!job.usage_reserved) await finish(job, { usage_reserved: true });
        const config = normalizeFollowupConfig(automation.response_flow.follow_up);
        const text = config.message + (usage.isFreePlan ? '\n\n⚡ Automation is powered by @Getaipilot' : '');
        // Re-read after quota/token work so a reply during preparation cancels delivery.
        const current = await read(db.from('autodm_followups').select('status').eq('id', job.id).maybeSingle());
        if (current?.status !== 'sending') continue;
        const latestActivity = await read(db.from('autodm_dm_activity').select('last_inbound_at').eq('instagram_account_id', job.instagram_account_id).eq('sender_id', job.sender_id).maybeSingle());
        const latestReason = followupEligibility(job, automation, account, latestActivity);
        if (latestReason) { await finish(job, { status: 'cancelled', last_error: latestReason }); continue; }
        const messageId = await send(token, job.sender_id, text, config.buttons);
        delivered = true;
        const sentAt = new Date().toISOString();
        await finish(job, { status: 'sent', sent_at: sentAt, last_error: null });
        const message = await read(db.from('messages').insert({
          user_id: job.user_id, instagram_account_id: job.instagram_account_id,
          contact_id: job.contact_id, automation_id: job.automation_id,
          direction: 'outbound', message_type: config.buttons.length ? 'template' : 'text',
          content: config.buttons.length ? JSON.stringify({ text, buttons: config.buttons.map(({ title, url }) => ({ type: 'web_url', title, url })) }) : text,
          instagram_message_id: messageId, status: 'sent', sent_at: sentAt,
        }).select('*').single());
        await syncMessage(message);
      } catch (error) {
        // Only explicit rate-limit rejections are safe to retry; network failures may have delivered.
        const retry = !delivered && error.rateLimited && job.attempts < 5;
        await finish(job, retry
          ? { status: 'pending', due_at: new Date(Date.now() + error.retryAfterMs).toISOString(), last_error: 'meta_rate_limited' }
          : { status: delivered ? 'sent' : 'failed', last_error: delivered ? 'delivery_record_failed' : String(error.message).slice(0, 240) });
        logger.warn('[AUTODM-FOLLOWUP]', { id: job.id, reason: delivered ? 'delivery_record_failed' : error.message });
      }
    }
  };
}
