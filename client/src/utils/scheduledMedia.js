export function scheduledMediaUrls(post) {
  const candidates = [...(Array.isArray(post.media_urls) ? post.media_urls : []), post.media_url].filter(value => typeof value === 'string' && value.trim());
  return [...new Set(candidates.map(value => value.trim()))].filter(url => {
    try { return ['http:', 'https:'].includes(new URL(url, 'https://media.invalid').protocol); } catch { return false; }
  });
}
export function scheduledMediaIsVideo(url, post) {
  if (/\.(?:jpe?g|png|gif|webp|avif)(?:[?#]|$)/i.test(url)) return false;
  return /\.(?:mp4|mov|webm|m4v|avi)(?:[?#]|$)/i.test(url) || /\/video\/upload\//i.test(url) || post.media_type === 'video';
}
export function scheduledMediaPoster(post) {
  return [post.thumbnail_url, post.platform_data?.instagramCoverUrl, post.platform_data?.instagram?.coverUrl]
    .find(url => typeof url === 'string' && /^https?:\/\//i.test(url) && !/\.(?:mp4|mov|webm|m4v)(?:[?#]|$)/i.test(url)) || '';
}
