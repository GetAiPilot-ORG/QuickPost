import crypto from 'node:crypto';

export function resolveSocialProfile(channels = [], tokens = {}) {
  const extChannels = Array.isArray(channels)
    ? channels.filter((c) => typeof c === 'string' && c !== 'socialpilot')
    : [];

  if (extChannels.length === 0) {
    return {
      targetPlatform: 'socialpilot',
      targetUsername: null,
      avatarUrl: null,
    };
  }

  // 1. Instagram
  const igCh = extChannels.find((c) => c === 'instagram' || c.startsWith('instagram:'));
  if (igCh) {
    const accountId = igCh.includes(':') ? igCh.split(':')[1] : null;
    const acc = accountId
      ? tokens.instagramAccounts?.find((a) => a.id === accountId)
      : (tokens.instagramAccounts?.[0] || tokens.instagram);
    const rawUsername = acc?.instagram_username || acc?.username || tokens.instagram?.username;
    if (rawUsername) {
      const targetUsername = rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`;
      return {
        targetPlatform: 'instagram',
        targetUsername,
        avatarUrl: acc?.profile_picture_url || acc?.profilePicture || tokens.instagram?.profilePicture || null,
      };
    }
  }

  // 2. YouTube
  const ytCh = extChannels.find((c) => c === 'youtube' || c.startsWith('youtube:'));
  if (ytCh) {
    const accountId = ytCh.includes(':') ? ytCh.split(':')[1] : null;
    const acc = accountId
      ? tokens.youtubeAccounts?.find((a) => a.id === accountId)
      : tokens.youtubeAccounts?.[0];
    const username = acc?.channelTitle || acc?.username || acc?.title;
    if (username) {
      return {
        targetPlatform: 'youtube',
        targetUsername: username,
        avatarUrl: acc?.profilePicture || acc?.profile_picture || null,
      };
    }
  }

  // 3. X (Twitter)
  const xCh = extChannels.find((c) => c === 'x' || c.startsWith('x:'));
  if (xCh) {
    const accountId = xCh.includes(':') ? xCh.split(':')[1] : null;
    const acc = accountId
      ? tokens.xAccounts?.find((a) => a.id === accountId)
      : tokens.xAccounts?.[0];
    const username = acc?.username || acc?.screen_name;
    if (username) {
      return {
        targetPlatform: 'x',
        targetUsername: username.startsWith('@') ? username : `@${username}`,
        avatarUrl: acc?.profilePicture || null,
      };
    }
  }

  // 4. Pinterest
  const pinCh = extChannels.find((c) => c === 'pinterest' || c.startsWith('pinterest:'));
  if (pinCh) {
    const accountId = pinCh.includes(':') ? pinCh.split(':')[1] : null;
    const acc = accountId
      ? tokens.pinterestAccounts?.find((a) => a.id === accountId)
      : tokens.pinterestAccounts?.[0];
    const username = acc?.username || acc?.profileData?.username;
    if (username) {
      return {
        targetPlatform: 'pinterest',
        targetUsername: username,
        avatarUrl: acc?.profilePicture || null,
      };
    }
  }

  // 5. Bluesky
  const bskyCh = extChannels.find((c) => c === 'bluesky' || c.startsWith('bluesky:'));
  if (bskyCh) {
    const accountId = bskyCh.includes(':') ? bskyCh.split(':')[1] : null;
    const acc = accountId
      ? tokens.blueskyAccounts?.find((a) => a.id === accountId)
      : tokens.blueskyAccounts?.[0];
    const username = acc?.handle;
    if (username) {
      return {
        targetPlatform: 'bluesky',
        targetUsername: username.startsWith('@') ? username : `@${username}`,
        avatarUrl: acc?.avatar || null,
      };
    }
  }

  // 6. Facebook
  const fbCh = extChannels.find((c) => c === 'facebook' || c.startsWith('facebook:'));
  if (fbCh) {
    const accountId = fbCh.includes(':') ? fbCh.split(':')[1] : null;
    const acc = accountId
      ? tokens.facebookAccounts?.find((a) => a.id === accountId)
      : tokens.facebookAccounts?.[0];
    const username = acc?.pageName || acc?.name;
    if (username) {
      return {
        targetPlatform: 'facebook',
        targetUsername: username,
        avatarUrl: acc?.profilePicture || null,
      };
    }
  }

  // 7. LinkedIn
  const liCh = extChannels.find((c) => c === 'linkedin' || c.startsWith('linkedin:'));
  if (liCh) {
    const accountId = liCh.includes(':') ? liCh.split(':')[1] : null;
    const acc = accountId
      ? tokens.linkedinAccounts?.find((a) => a.id === accountId)
      : tokens.linkedinAccounts?.[0];
    const username = acc?.name;
    if (username) {
      return {
        targetPlatform: 'linkedin',
        targetUsername: username,
        avatarUrl: acc?.profilePicture || null,
      };
    }
  }

  return {
    targetPlatform: extChannels[0] || 'socialpilot',
    targetUsername: null,
    avatarUrl: null,
  };
}

export function buildSocialpilotPost({
  userId,
  publicationKey,
  caption,
  mediaUrls,
  mediaType,
  thumbnailUrl,
  creator,
  avatarUrl,
  nicheTags,
  niche_tags,
  appUrl,
  now = new Date(),
}) {
  if (!userId || !publicationKey) throw new Error('Missing SocialPilot publication identity');
  if (!Array.isArray(mediaUrls) || !mediaUrls.length || mediaUrls.some((value) => {
    try { return !['http:', 'https:'].includes(new URL(value).protocol); } catch { return true; }
  })) throw new Error('SocialPilot requires publicly hosted post media');
  const hash = crypto.createHash('sha256').update(`${userId}:${publicationKey}`).digest('hex').slice(0, 32);
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20)}`;
  const origin = new URL(appUrl || process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://getaipilot.in').origin;
  const tags = Array.isArray(nicheTags || niche_tags) ? (nicheTags || niche_tags) : [];
  return {
    id,
    source_platform: 'socialpilot',
    source_url: `${origin}/dashboard/trends?post=${id}`,
    author_id: userId,
    publication_key: String(publicationKey),
    creator: String(creator || 'GAP Social-pilot').slice(0, 100),
    creator_avatar_url: avatarUrl || null,
    caption: String(caption || ''),
    media_urls: mediaUrls,
    media_type: mediaType,
    thumbnail_url: thumbnailUrl || (mediaType === 'image' ? mediaUrls[0] : null),
    published_at: now.toISOString(),
    ingested_at: now.toISOString(),
    engagement_score: 1,
    niche_tags: tags,
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

    let metadata = {};
    try {
      const { data: auth } = await db.auth.admin.getUserById(input.userId);
      metadata = auth?.user?.user_metadata || {};
    } catch (_) {}

    // Resolve target social profile if not directly provided
    let targetUsername = input.targetUsername;
    let targetPlatform = input.targetPlatform;
    let targetAvatarUrl = input.targetAvatarUrl;

    if (!targetUsername && input.userId) {
      try {
        const { getTokensForUser } = await import('./supabase.js');
        const userTokens = await getTokensForUser(input.userId);
        const resolved = resolveSocialProfile(input.channels || [], userTokens);
        if (resolved.targetUsername) {
          targetUsername = resolved.targetUsername;
          targetPlatform = resolved.targetPlatform;
          targetAvatarUrl = targetAvatarUrl || resolved.avatarUrl;
        }
      } catch (_) {}
    }

    // Determine Creator and Platform:
    // When uploading to social media (Instagram, etc.): show social media username (e.g. @hapfsunion)
    // When uploading ONLY to SocialPilot: show "GAP Social-pilot"
    const creator = targetUsername
      ? targetUsername
      : (metadata.full_name || metadata.name || 'GAP Social-pilot');

    const avatarUrl = targetAvatarUrl || metadata.avatar_url || metadata.picture || null;
    const effectivePlatform = targetPlatform || (targetUsername ? 'instagram' : 'socialpilot');

    const nicheTags = Array.isArray(input.nicheTags) ? [...input.nicheTags] : [];
    if (effectivePlatform && effectivePlatform !== 'socialpilot') {
      nicheTags.push(`platform:${effectivePlatform}`);
      nicheTags.push(`user:${creator.replace(/^@/, '')}`);
    } else {
      nicheTags.push('platform:socialpilot');
    }

    const post = buildSocialpilotPost({
      ...input,
      creator,
      avatarUrl,
      nicheTags,
    });

    const result = await db.from('posts').upsert(post, { onConflict: 'id', ignoreDuplicates: true });
    if (result.error) throw result.error;
    return { success: true, postId: post.id, url: post.source_url };
  } catch (error) {
    return { success: false, error: `SocialPilot publishing failed: ${error.message || 'Unable to publish'}` };
  }
}

export function communityFeedPost(row) {
  if (row.source_platform !== 'socialpilot') return row;
  const platformTag = (row.niche_tags || []).find((t) => typeof t === 'string' && t.startsWith('platform:'));
  const targetPlatform = platformTag
    ? platformTag.replace('platform:', '')
    : (row.creator?.startsWith('@') ? 'instagram' : 'socialpilot');

  return {
    ...row,
    title: row.caption,
    content_type: row.media_type === 'video' ? 'video' : 'visual',
    video_url: row.media_type === 'video' ? row.media_urls?.[0] : null,
    full_image_url: row.media_type === 'image' ? row.media_urls?.[0] : null,
    target_platform: targetPlatform,
  };
}
