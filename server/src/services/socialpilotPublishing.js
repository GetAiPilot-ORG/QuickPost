import crypto from 'node:crypto';

function getProfileForPlatform(platformKey, channelStr, tokens) {
  const accountId = channelStr && channelStr.includes(':') ? channelStr.split(':')[1] : null;

  switch (platformKey) {
    case 'instagram': {
      const acc = accountId
        ? tokens.instagramAccounts?.find((a) => a.id === accountId)
        : (tokens.instagramAccounts?.[0] || tokens.instagram);
      const rawUsername = acc?.instagram_username || acc?.username || tokens.instagram?.username;
      if (rawUsername) {
        return {
          targetPlatform: 'instagram',
          targetUsername: rawUsername.startsWith('@') ? rawUsername : `@${rawUsername}`,
          avatarUrl: acc?.profile_picture_url || acc?.profilePicture || tokens.instagram?.profilePicture || null,
        };
      }
      return null;
    }
    case 'youtube': {
      const acc = accountId
        ? tokens.youtubeAccounts?.find((a) => a.id === accountId)
        : tokens.youtubeAccounts?.[0];
      const username = acc?.channelTitle || acc?.username || acc?.title || acc?.profileData?.username || acc?.profileData?.name || acc?.handle;
      if (username) {
        return {
          targetPlatform: 'youtube',
          targetUsername: username,
          avatarUrl: acc?.profilePicture || acc?.profile_picture || acc?.profileData?.picture || null,
        };
      }
      return null;
    }
    case 'x': {
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
      return null;
    }
    case 'pinterest': {
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
      return null;
    }
    case 'bluesky': {
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
      return null;
    }
    case 'facebook': {
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
      return null;
    }
    case 'linkedin': {
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
      return null;
    }
    default:
      return null;
  }
}

export function resolveSocialProfile(channels = [], tokens = {}) {
  const extChannels = Array.isArray(channels)
    ? channels.filter((c) => typeof c === 'string' && c !== 'socialpilot')
    : [];

  if (extChannels.length === 0) {
    return {
      targetPlatform: 'socialpilot',
      targetUsername: 'GAP Social-pilot',
      avatarUrl: '/logo.png',
    };
  }

  const getBasePlatform = (ch) => (ch.includes(':') ? ch.split(':')[0] : ch);

  // Rule:
  // "user agr multiple platform par upload kr raha h to bydefalut insta ka username show krna or otherwise jis platform par upload kr raha h sirf uska username show kro"
  if (extChannels.length > 1) {
    // Check if Instagram is in selected platforms
    const igCh = extChannels.find((c) => getBasePlatform(c) === 'instagram');
    if (igCh) {
      const igProfile = getProfileForPlatform('instagram', igCh, tokens);
      if (igProfile) return igProfile;
    }

    // If multiple channels without Instagram, resolve for the first channel with a valid username
    for (const ch of extChannels) {
      const base = getBasePlatform(ch);
      const prof = getProfileForPlatform(base, ch, tokens);
      if (prof) return prof;
    }
  } else {
    // Single external platform: show ONLY that platform's username and platform
    const singleCh = extChannels[0];
    const base = getBasePlatform(singleCh);
    const prof = getProfileForPlatform(base, singleCh, tokens);
    if (prof) return prof;
  }

  const defaultBase = getBasePlatform(extChannels[0]) || 'socialpilot';
  return {
    targetPlatform: defaultBase,
    targetUsername: null,
    avatarUrl: null,
  };
}

export function buildSocialpilotPost({
  userId,
  authorId,
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
  sourceUrl,
  sourcePlatform,
  now = new Date(),
}) {
  if (!userId || !publicationKey) throw new Error('Missing SocialPilot publication identity');
  if (!Array.isArray(mediaUrls) || !mediaUrls.length || mediaUrls.some((value) => {
    try { return !['http:', 'https:'].includes(new URL(value).protocol); } catch { return true; }
  })) throw new Error('SocialPilot requires publicly hosted post media');
  const hash = crypto.createHash('sha256').update(`${userId}:${publicationKey}`).digest('hex').slice(0, 32);
  const id = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20)}`;
  const origin = new URL(appUrl || process.env.CLIENT_URL || process.env.FRONTEND_URL || 'https://getaipilot.in').origin;
  const tags = Array.isArray(nicheTags || niche_tags) ? [...(nicheTags || niche_tags)] : [];
  if (userId && !tags.includes(`author:${userId}`)) {
    tags.push(`author:${userId}`);
  }

  return {
    id,
    source_platform: sourcePlatform || 'socialpilot',
    source_url: sourceUrl || `${origin}/dashboard/trends?post=${id}`,
    author_id: authorId || null,
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

    // Verify if user exists in auth.users to prevent foreign key violation on posts.author_id
    let validAuthId = null;
    let metadata = {};
    try {
      const { data: auth } = await db.auth.admin.getUserById(input.userId);
      if (auth?.user?.id) {
        validAuthId = auth.user.id;
        metadata = auth.user.user_metadata || {};
      }
    } catch (_) {}

    if (!validAuthId) {
      try {
        const { data: pubUser } = await db.from('users').select('*').eq('id', input.userId).maybeSingle();
        if (pubUser) {
          metadata = { ...pubUser, ...metadata };
        }
      } catch (_) {}
    }

    const id = buildSocialpilotPost({ ...input, authorId: validAuthId }).id;
    const existing = await db.from('posts').select('id,source_url').eq('id', id).maybeSingle();
    if (existing.error) throw existing.error;
    if (existing.data) return { success: true, postId: existing.data.id, url: existing.data.source_url };

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
    // If external username resolved: use it
    // If only SocialPilot: "GAP Social-pilot"
    const creator = targetUsername
      ? targetUsername
      : (metadata.full_name || metadata.name || 'GAP Social-pilot');

    const avatarUrl = targetAvatarUrl || metadata.avatar_url || metadata.picture || null;
    const effectivePlatform = targetPlatform || (targetUsername?.startsWith('@') ? 'instagram' : 'socialpilot');

    const nicheTags = Array.isArray(input.nicheTags) ? [...input.nicheTags] : [];
    if (effectivePlatform && effectivePlatform !== 'socialpilot') {
      nicheTags.push(`platform:${effectivePlatform}`);
      nicheTags.push(`user:${creator.replace(/^@/, '')}`);
    } else {
      nicheTags.push('platform:socialpilot');
    }
    if (input.userId && !nicheTags.includes(`author:${input.userId}`)) {
      nicheTags.push(`author:${input.userId}`);
    }

    const post = buildSocialpilotPost({
      ...input,
      authorId: validAuthId,
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
  const platformTag = (row.niche_tags || []).find((t) => typeof t === 'string' && t.startsWith('platform:'));
  const targetPlatform = platformTag
    ? platformTag.replace('platform:', '')
    : (row.source_platform === 'youtube' ? 'youtube' : (row.creator?.startsWith('@') ? 'instagram' : row.source_platform || 'socialpilot'));

  const isVideo = row.media_type === 'video' || (typeof row.media_urls?.[0] === 'string' && (row.media_urls[0].includes('/video/upload/') || row.media_urls[0].endsWith('.mp4')));

  return {
    ...row,
    title: row.title || row.caption,
    content_type: isVideo ? 'video' : (row.content_type || 'visual'),
    video_url: isVideo ? (row.video_url || row.media_urls?.[0]) : null,
    full_image_url: row.media_type === 'image' ? (row.media_urls?.[0] || row.thumbnail_url) : null,
    target_platform: targetPlatform,
  };
}
