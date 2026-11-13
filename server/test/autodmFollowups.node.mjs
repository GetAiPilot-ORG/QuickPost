import test from 'node:test';
import assert from 'node:assert/strict';
import { createFollowupProcessor, followupEligibility, sendFollowupMessage } from '../src/services/autodmFollowups.js';
import { normalizeFollowupConfig } from '../src/services/autodmFollowupConfig.js';

const now = Date.now();
const iso = (offset) => new Date(now + offset * 3600000).toISOString();
function fixture() {
  return {
    job: { id: 'j', automation_id: 'a', instagram_account_id: 'ig', user_id: 'u', contact_id: 'c', sender_id: 'person', inbound_at: iso(-4), scheduled_at: iso(-3.1), attempts: 1 },
    automation: { id: 'a', instagram_account_id: 'ig', is_active: true, response_flow: { follow_up: { enabled: true, message: 'Join my channel: https://example.com' } } },
    account: { id: 'ig', user_id: 'u', is_connected: true, access_token_encrypted: 'encrypted' },
    activity: { last_inbound_at: iso(-4) },
  };
}
test('only a completed eligible conversation can receive the reminder', () => {
  const f = fixture();
  const check = () => followupEligibility(f.job, f.automation, f.account, f.activity, now);
  assert.equal(check(), null);
  f.activity.last_inbound_at = iso(-1);
  assert.equal(check(), 'recipient_replied');
  f.activity.last_inbound_at = iso(-25);
  assert.equal(check(), 'messaging_window_closed');
  f.activity = null;
  assert.equal(check(), 'recipient_replied');
});
test('paused, disabled, disconnected, expired and premature sends are blocked', () => {
  for (const [mutate, reason] of [
    [f => f.automation.is_active = false, 'automation_unavailable'],
    [f => f.account.is_connected = false, 'automation_unavailable'],
    [f => f.account.user_id = 'another-tenant', 'automation_unavailable'],
    [f => f.automation.response_flow.follow_up.enabled = false, 'followup_disabled'],
    [f => f.automation.ends_at = iso(-1), 'automation_expired'],
    [f => f.account.token_expires_at = iso(-1), 'token_expired'],
    [f => f.job.scheduled_at = iso(-2), 'not_due'],
  ]) {
    const f = fixture(); mutate(f);
    assert.equal(followupEligibility(f.job, f.automation, f.account, f.activity, now), reason);
  }
});
test('settings validate UTF-8 size and force the three-hour delay', () => {
  assert.equal(normalizeFollowupConfig({ enabled: true, message: ' hello ', delay_hours: 30 }).delay_hours, 3);
  assert.throws(() => normalizeFollowupConfig({ enabled: true, message: ' ' }));
  assert.throws(() => normalizeFollowupConfig({ enabled: true, message: '😀'.repeat(226) }));
  assert.throws(() => normalizeFollowupConfig({ enabled: 'true', message: 'hello' }));
  assert.equal(normalizeFollowupConfig(null).enabled, false);
});

function harness(options = {}) {
  const f = fixture();
  const state = { ...f, job: { ...f.job, status: 'pending' }, messages: [], sent: [], synced: [], quota: 0 };
  const db = {
    rpc: async () => {
      if (state.job.status !== 'pending') return { data: [] };
      state.job.status = 'sending';
      return { data: [{ ...state.job }] };
    },
    from(table) {
      const query = { action: 'select', values: null, filters: {} };
      const builder = {
        select() { return this; },
        update(values) { query.action = 'update'; query.values = values; return this; },
        insert(values) { query.action = 'insert'; query.values = values; return this; },
        eq(key, value) { query.filters[key] = value; return this; },
        maybeSingle() { return this; }, single() { return this; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            if (query.action === 'update') {
              if (!query.filters.status || state.job.status === query.filters.status) Object.assign(state.job, query.values);
              return { data: null };
            }
            if (table === 'messages') { state.messages.push(query.values); return { data: query.values }; }
            return { data: ({ automations: state.automation, instagram_accounts: state.account, autodm_dm_activity: state.activity, autodm_followups: state.job })[table] };
          }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  const run = createFollowupProcessor({ db,
    decryptToken: () => ({ pageAccessToken: 'test-token' }),
    reserveUsage: async () => { state.quota++; if (options.replyDuringPreparation) state.job.status = 'cancelled'; return { allowed: !options.quotaBlocked, isFreePlan: true }; },
    send: async (...args) => { state.sent.push(args); if (options.sendError) throw options.sendError; return 'meta-message'; },
    syncMessage: async (message) => state.synced.push(message), logger: { warn() {} },
  });
  return { state, run };
}
test('worker sends once, records delivery and syncs the same chat', async () => {
  const { state, run } = harness();
  await run(); await run();
  assert.equal(state.sent.length, 1);
  assert.equal(state.sent[0][1], 'person');
  assert.match(state.sent[0][2], /Join my channel/);
  assert.match(state.sent[0][2], /powered by @Getaipilot/);
  assert.equal(state.job.status, 'sent');
  assert.equal(state.messages[0].instagram_message_id, 'meta-message');
  assert.equal(state.synced.length, 1);
});
test('reply while preparing and quota exhaustion both prevent a send', async () => {
  for (const options of [{ replyDuringPreparation: true }, { quotaBlocked: true }]) {
    const { state, run } = harness(options); await run();
    assert.equal(state.sent.length, 0);
    assert.equal(state.job.status, 'cancelled');
  }
});
test('an ambiguous timeout is terminal, so restarts cannot duplicate delivery', async () => {
  const { state, run } = harness({ sendError: new Error('Request timeout') });
  await run(); await run();
  assert.equal(state.job.status, 'failed');
  assert.equal(state.sent.length, 1);
  assert.equal(state.messages.length, 0);
});
test('explicit rate rejection is identified without automatic HTTP retry', async () => {
  let calls = 0;
  await assert.rejects(sendFollowupMessage('token', 'person', 'text', [], async () => {
    calls++; return new Response(JSON.stringify({ error: { code: 4 } }), { status: 429, headers: { 'retry-after': '120' } });
  }), error => error.rateLimited === true && error.retryAfterMs === 120000);
  assert.equal(calls, 1);
});
test('worker skips a reply that arrived before the job was claimed', async () => {
  const { state, run } = harness();
  state.activity.last_inbound_at = iso(-1);
  await run();
  assert.equal(state.sent.length, 0);
  assert.equal(state.quota, 0);
  assert.equal(state.job.last_error, 'recipient_replied');
});
test('worker skips disabled follow-ups without consuming quota', async () => {
  const { state, run } = harness();
  state.automation.response_flow.follow_up.enabled = false;
  await run();
  assert.equal(state.sent.length, 0);
  assert.equal(state.quota, 0);
  assert.equal(state.job.status, 'cancelled');
});
test('HTTP delivery targets the existing recipient and keeps tokens out of the URL', async () => {
  const result = await sendFollowupMessage('secret-token', 'existing-person', 'Hello', [], async (url, options) => {
    assert.ok(url.endsWith('/me/messages'));
    assert.ok(!url.includes('secret-token'));
    const body = JSON.parse(options.body);
    assert.deepEqual(body.recipient, { id: 'existing-person' });
    assert.equal(body.messaging_type, 'RESPONSE');
    assert.equal(body.message.text, 'Hello');
    return new Response(JSON.stringify({ message_id: 'confirmed-id' }));
  });
  assert.equal(result, 'confirmed-id');
});
test('buttons are validated for count, titles, URLs and template text limit', () => {
  const config = { enabled: true, message: 'Join us', buttons: [{ title: 'Join channel', url: 'https://ig.me/j/community' }] };
  assert.equal(normalizeFollowupConfig(config).buttons[0].type, 'url');
  for (const buttons of [
    Array(4).fill(config.buttons[0]),
    [{ title: '', url: 'https://example.com' }],
    [{ title: 'x'.repeat(21), url: 'https://example.com' }],
    [{ title: 'Join', url: 'javascript:alert(1)' }],
    [{ title: 'Join', url: 'https://user:password@example.com' }],
    [{ title: 'Join', url: 'https://example.com', type: 'postback' }],
  ]) assert.throws(() => normalizeFollowupConfig({ ...config, buttons }));
  assert.throws(() => normalizeFollowupConfig({ ...config, message: 'x'.repeat(601) }));
  assert.equal(normalizeFollowupConfig({ ...config, enabled: false, buttons: [{ title: '', url: '' }] }).enabled, false);
});
test('button follow-ups use a single official button template', async () => {
  const buttons = [{ type: 'url', title: 'Join channel', url: 'https://ig.me/j/community' }];
  await sendFollowupMessage('token', 'person', 'Join us', buttons, async (url, options) => {
    const body = JSON.parse(options.body);
    assert.deepEqual(body.message, { attachment: { type: 'template', payload: {
      template_type: 'button', text: 'Join us', buttons: [{ type: 'web_url', title: 'Join channel', url: buttons[0].url }],
    } } });
    assert.deepEqual(body.recipient, { id: 'person' });
    return new Response(JSON.stringify({ message_id: 'button-message' }));
  });
});
test('worker delivers configured buttons and stores them for the inbox', async () => {
  const { state, run } = harness();
  state.automation.response_flow.follow_up.buttons = [{ type: 'url', title: 'Join channel', url: 'https://ig.me/j/community' }];
  await run();
  assert.equal(state.sent[0][3][0].title, 'Join channel');
  assert.equal(state.messages[0].message_type, 'template');
  const stored = JSON.parse(state.messages[0].content);
  assert.equal(stored.buttons[0].type, 'web_url');
  assert.match(stored.text, /Join my channel/);
});
