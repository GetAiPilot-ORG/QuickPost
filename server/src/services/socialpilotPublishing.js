import crypto from 'node:crypto';

export function buildSocialpilotPost({ userId, publicationKey, caption, mediaUrls, mediaType, thumbnailUrl, creator, avatarUrl, appUrl, now = new Date() }) {
  if (!userId || !publicationKey) throw new Error('Missing SocialPilot publication identity');
  if (!Array.isArray(mediaUrls) || !mediaUrls.length || mediaUrls.some((value) => {
    try { return !['http:', 'https:'].includes(new URL(value).protocol); } catch { return true; }
  })) throw new Error('SocialPilot requires publicly hosted post media');
  const hash = crypto.createHash('sha256').update(`${userId}:${publicationKey}`).digest('hex').slice(0, 32);
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20)}`;
  const origin = new URL(appUrl || process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://getaipilot.in').origin;
  return {
    id, source_platform: 'socialpilot', source_url: `${origin}/dashboard/trends?post=${id}`,
    author_id: userId, publication_key: String(publicationKey),
    creator: String(creator || 'SocialPilot creator').slice(0, 100), creator_avatar_url: avatarUrl || null,
    caption: String(caption || ''), media_urls: mediaUrls, media_type: mediaType,
    thumbnail_url: thumbnailUrl || (mediaType === 'image' ? mediaUrls[0] : null),
    published_at: now.toISOString(), ingested_at: now.toISOString(), engagement_score: 1, niche_tags: [],
  };
}

export async function publishToSocialpilot(input, options = {}) {
  try {
    const db = options.supabase || (await import('./supabase.js')).default;
    const key = input.publicationKey;
    if (!input.userId || !key) throw new Error('Missing SocialPilot publication identity');
    const id = buildSocialpilotPost(input).id;
    const existing = await db.from('posts').select('id,source_url').eq('id', id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { success: true, postId: existing.data.id, url: existing.data.source_url };
    const { data: auth, error: authError } = await db.auth.admin.getUserById(input.userId);
    if (authError) throw authError;
    const metadata = auth?.user?.user_metadata || {};
    const post = buildSocialpilotPost({ ...input, creator: metadata.full_name || metadata.name || metadata.username, avatarUrl: metadata.avatar_url || metadata.picture });
    const result = await db.from('posts').upsert(post, { onConflict: 'id', ignoreDuplicates: true });
    if (result.error) throw result.error;
    return { success: true, postId: post.id, url: post.source_url };
  } catch (error) {
    return { success: false, error: `SocialPilot publishing failed: ${error.message || 'Unable to publish'}` };
  }
}

export function communityFeedPost(row) {
  if (row.source_platform !== 'socialpilot') return row;
  return {
    ...row, title: row.caption, content_type: row.media_type === 'video' ? 'video' : 'visual',
    video_url: row.media_type === 'video' ? row.media_urls?.[0] : null,
    full_image_url: row.media_type === 'image' ? row.media_urls?.[0] : null,
  };
}
