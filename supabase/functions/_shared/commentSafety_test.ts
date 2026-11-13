import { ignoredCommentReason, claimCommentDelivery, webhookEventIdentity } from './commentSafety.ts';
import { sendInstagramCommentReply } from './metaService.ts';

function equal(actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
const original = { triggerType: 'comment', igId: '17841449307041459', senderId: '1120051020600191', eventId: '18100150634651977', externalPayload: { value: { from: { id: '1120051020600191', username: 'cy.theycallmecalm' } } } };
Deno.test('original audience comment remains eligible', () => equal(ignoredCommentReason(original), null));
Deno.test('reported own-reply webhook is blocked before account lookup or sending', () => {
  equal(ignoredCommentReason({ ...original, senderId: original.igId, eventId: '18574386802079098', externalPayload: { value: { parent_id: original.eventId, from: { id: original.igId, self_ig_scoped_id: '1686313179865514', username: 'fr.tanishqq' } } } }), 'ignored_nested_reply');
});
Deno.test('self marker blocks an own comment even when IDs use a different scope', () => {
  equal(ignoredCommentReason({ ...original, externalPayload: { value: { from: { id: 'scoped-author', self_ig_scoped_id: 'own-scope' } } } }), 'ignored_self_action');
});
Deno.test('nested third-party replies cannot retrigger an automation', () => {
  equal(ignoredCommentReason({ ...original, parentId: 'parent' }), 'ignored_nested_reply');
  equal(ignoredCommentReason({ ...original, externalPayload: { value: { parent_id: 'parent' } } }), 'ignored_nested_reply');
});
Deno.test('raw author username and business ID are checked against resolved account aliases', () => {
  equal(ignoredCommentReason({ ...original, externalPayload: { value: { from: { username: '@FR.TANISHQQ' } } } }, [{ instagram_username: 'fr.tanishqq', ig_id: 'other-scoped-id' }]), 'ignored_self_action');
  equal(ignoredCommentReason(original, [{ instagram_business_account_id: original.senderId }]), 'ignored_self_action');
});
Deno.test('missing identity fails closed; ordinary DMs are unaffected', () => {
  equal(ignoredCommentReason({ ...original, eventId: '' }), 'ignored_invalid_comment');
  equal(ignoredCommentReason({ ...original, triggerType: 'dm', parentId: 'quoted-message' }), null);
});
Deno.test('comment identity survives edits and account aliases', () => {
  equal(webhookEventIdentity({ eventType: 'comments', eventId: original.eventId, igId: 'alias-one', senderId: 'person' }), webhookEventIdentity({ eventType: 'comments', eventId: original.eventId, igId: 'alias-two', senderId: 'person' }));
});
Deno.test('concurrent handlers and overlapping automations claim a comment only once', async () => {
  const claimed = new Set();
  const db = { from: () => ({ insert: async (row: Record<string, unknown>) => {
    if (claimed.has(row.comment_id)) return { error: { code: '23505', message: 'duplicate' } };
    claimed.add(row.comment_id);
    return { error: null };
  } }) };
  const results = await Promise.all([claimCommentDelivery(db, 'comment', 'account', 'automation-a'), claimCommentDelivery(db, 'comment', 'account', 'automation-b')]);
  equal(results.sort(), [false, true]);
  equal(await claimCommentDelivery(db, 'another-comment', 'account', 'automation-a'), true);
});
Deno.test('database unavailability prevents sending instead of bypassing the claim', async () => {
  const db = { from: () => ({ insert: async () => ({ error: { code: 'PGRST205', message: 'missing migration' } }) }) };
  let rejected = false;
  try { await claimCommentDelivery(db, 'comment', 'account', 'automation'); } catch { rejected = true; }
  equal(rejected, true);
});
Deno.test('ambiguous public reply failures are never automatically retried', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = () => { calls++; return Promise.reject(new Error('delivery outcome unknown')); };
  try { equal((await sendInstagramCommentReply('comment', 'Sent to your DM', 'token')).ok, false); equal(calls, 1); }
  finally { globalThis.fetch = previous; }
});
Deno.test('confirmed public reply uses one request against the original comment', async () => {
  const previous = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (url, init) => {
    calls++; equal(String(url).endsWith('/original-comment/replies'), true);
    equal(JSON.parse(String(init?.body)), { message: 'Sent to your DM' });
    return Promise.resolve(new Response(JSON.stringify({ id: 'reply' })));
  };
  try { equal((await sendInstagramCommentReply('original-comment', 'Sent to your DM', 'token')).ok, true); equal(calls, 1); }
  finally { globalThis.fetch = previous; }
});
