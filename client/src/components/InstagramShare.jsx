import React, { useState } from 'react';

export function instagramShareUrl(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol !== 'https:' || !['instagram.com', 'www.instagram.com', 'm.instagram.com'].includes(url.hostname)) return null;
    const match = url.pathname.match(/^\/(reel|reels|p|tv)\/([A-Za-z0-9_-]+)\/?$/);
    return match ? `https://www.instagram.com/${match[1] === 'reels' ? 'reel' : match[1]}/${match[2]}/` : null;
  } catch { return null; }
}

export default function InstagramShare({ url, imageUrl, videoUrl }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const reel = url.includes('/reel/');
  const hasVideo = videoUrl && !videoFailed;
  const hasImage = imageUrl && !imageFailed;
  const hasMedia = hasImage || hasVideo;
  return <div style={{ width: 230, maxWidth: '100%', overflow: 'hidden', borderRadius: 16, background: '#fff' }}>
    {hasMedia ? hasVideo ? <video src={videoUrl} poster={hasImage ? imageUrl : undefined} controls preload="metadata" playsInline onError={() => setVideoFailed(true)} aria-label="Shared Instagram video" style={{ display: 'block', width: '100%', aspectRatio: reel ? '9 / 16' : undefined, maxHeight: 410, objectFit: 'cover', background: '#111' }} />
      : <a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Open shared Instagram ${reel ? 'reel' : 'post'}`} style={{ display: 'block', position: 'relative', color: '#fff' }}>
          <img src={imageUrl} alt={`Shared Instagram ${reel ? 'reel' : 'post'}`} loading="lazy" onError={() => setImageFailed(true)} style={{ width: '100%', aspectRatio: reel ? '9 / 16' : '1', maxHeight: 410, objectFit: 'cover', display: 'block' }} />
          {reel && <span aria-hidden="true" style={{ position: 'absolute', bottom: 10, left: 10, background: '#fff', color: '#111', borderRadius: 6, padding: '2px 6px', fontSize: 13 }}>▶</span>}
        </a>
      : <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', color: '#1e293b', textDecoration: 'none', background: '#f3f4f6' }}>
          <span aria-hidden="true" style={{ fontSize: 20 }}>▶</span>
          <span style={{ fontSize: 12, lineHeight: 1.5 }}><strong style={{ display: 'block' }}>Shared Instagram {reel ? 'reel' : 'post'}</strong><span style={{ color: '#64748b' }}>Preview unavailable · Open in Instagram ↗</span></span>
        </a>}

  </div>;
}
