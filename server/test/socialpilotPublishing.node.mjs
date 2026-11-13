import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSocialpilotPost, publishToSocialpilot, communityFeedPost } from '../src/services/socialpilotPublishing.js';
import { getCommunityFeedPage, getTrendFeedPage } from '../src/services/trendFeed.js';
const input = { userId: '11111111-1111-4111-a111-111111111111', publicationKey: 'job-1', caption: 'My post', mediaUrls: ['https://media.example/photo.jpg'], mediaType: 'image', appUrl: 'https://getaipilot.in', now: new Date('2026-11-13T09:00:00Z') };
function fakeDb() {
  const rows = new Map();
  return { rows, auth: { admin: { getUserById: async () => ({ data: { user: { user_metadata: { full_name: 'Creator' } } } }) } }, from: () => ({ select: () => ({ eq: (_, id) => ({ maybeSingle: async () => ({ data: rows.get(id) || null }) }) }), upsert: async (row) => { if (!rows.has(row.id)) rows.set(row.id, row); return { error: null }; } }) };
}
test('stable publication identity isolates users and separate posts', () => {
  const post = buildSocialpilotPost(input);
  assert.equal(post.id, buildSocialpilotPost({ ...input, now: new Date() }).id);
  assert.notEqual(post.id, buildSocialpilotPost({ ...input, userId: 'other' }).id);
  assert.notEqual(post.id, buildSocialpilotPost({ ...input, publicationKey: 'job-2' }).id);
  assert.equal(post.thumbnail_url, input.mediaUrls[0]);
  assert.match(post.source_url, /dashboard\/trends\?post=/);
});
test('invalid or missing media fails before publishing', async () => {
  for (const mediaUrls of [[], ['javascript:alert(1)']]) assert.throws(() => buildSocialpilotPost({ ...input, mediaUrls }));
  const result = await publishToSocialpilot({ ...input, publicationKey: '' }, { supabase: fakeDb() });
  assert.equal(result.success, false);
});
test('concurrent duplicate deliveries create one public post and preserve original timestamp', async () => {
  const db = fakeDb();
  const results = await Promise.all([publishToSocialpilot(input, { supabase: db }), publishToSocialpilot(input, { supabase: db })]);
  assert.ok(results.every(result => result.success));
  assert.equal(db.rows.size, 1);
  await publishToSocialpilot({ ...input, now: new Date('2026-11-14') }, { supabase: db });
  assert.equal([...db.rows.values()][0].published_at, input.now.toISOString());
});
test('database failure is reported as a failed publishing target', async () => {
  const db = fakeDb(); db.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ error: new Error('storage unavailable') }) }) }) });
  const result = await publishToSocialpilot(input, { supabase: db });
  assert.equal(result.success, false); assert.match(result.error, /storage unavailable/);
});
test('native image, video and carousel payloads retain all media', () => {
  const image = communityFeedPost(buildSocialpilotPost(input)); assert.equal(image.full_image_url, input.mediaUrls[0]);
  const video = communityFeedPost(buildSocialpilotPost({ ...input, mediaType: 'video', mediaUrls: ['https://media.example/video.mp4'], thumbnailUrl: 'https://media.example/cover.jpg' }));
  assert.equal(video.video_url, 'https://media.example/video.mp4'); assert.equal(video.content_type, 'video');
  assert.equal(buildSocialpilotPost({ ...input, mediaUrls: [...input.mediaUrls, 'https://media.example/2.jpg'] }).media_urls.length, 2);
});
test('community pagination is public across users and uses timestamp/id keysets', async () => {
  const calls = [];
  const rows = [buildSocialpilotPost(input), buildSocialpilotPost({ ...input, userId: 'another', publicationKey: 'job-2' })];
  const query = new Proxy({}, { get: (_, method) => (...args) => { calls.push([method, ...args]); return method === 'limit' ? Promise.resolve({ data: rows }) : query; } });
  const db = { from: () => query };
  const first = await getTrendFeedPage({ type: 'community', limit: 1 }, { supabase: db });
  assert.equal(first.items.length, 1); assert.equal(first.hasMore, true); assert.ok(first.nextCursor);
  await getCommunityFeedPage({ limit: 1, cursor: first.nextCursor }, { supabase: db });
  assert.ok(calls.some(([method, arg]) => method === 'or' && arg.includes('published_at.lt.')));
  assert.ok(!calls.some(([method, key]) => method === 'eq' && key === 'author_id'));
  await assert.rejects(() => getCommunityFeedPage({ cursor: 'invalid' }, { supabase: db }), /Invalid community/);
});

test('All Pins includes native community media alongside other sources', async () => {
  const native = buildSocialpilotPost(input);
  const external = { id: 'youtube-video', source_platform: 'youtube', caption: 'A video', engagement_score: 100000, published_at: input.now.toISOString(), ingested_at: input.now.toISOString() };
  const query = new Proxy({}, { get: (_, method) => () => method === 'limit' ? Promise.resolve({ data: [native, external] }) : query });
  const result = await getTrendFeedPage({ type: 'all' }, { supabase: { from: () => query }, cache: null, skipExternal: true, now: input.now });
  assert.ok(result.items.some(row => row.source_platform === 'socialpilot'));
  assert.ok(result.items.some(row => row.source_platform === 'youtube'));
});

test('partial retries skip a successful SocialPilot target', async () => {
  const { pendingBroadcastChannels } = await import('../src/config/queuePolicy.js');
  const post = { selected_channels: ['instagram:one', 'socialpilot'], platform_data: { selectedChannels: ['instagram:one', 'socialpilot'], completedChannels: ['socialpilot'] } };
  assert.deepEqual(pendingBroadcastChannels(post), ['instagram:one']);
  assert.deepEqual(pendingBroadcastChannels({ ...post, platform_data: { selectedChannels: post.selected_channels, completedChannels: ['instagram:one'] } }), ['socialpilot']);
});
