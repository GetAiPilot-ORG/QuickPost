import React from 'react';
import { Play, Clapperboard, Image as ImageIcon, Layers } from 'lucide-react';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * High-Craft Media Type Badges
 * Designed with precision glassmorphism, crisp vector glyphs, and distinct identities.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export function ReelBadge({ className = '', style = {} }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider text-white shadow-lg pointer-events-none select-none transition-transform ${className}`}
      style={{
        background: 'rgba(18, 12, 16, 0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(244, 63, 94, 0.35)',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
        ...style,
      }}
      title="Instagram / YouTube Short Reel"
    >
      {/* Glowing Reel Clapper Icon */}
      <span className="relative flex items-center justify-center text-rose-400">
        <Clapperboard size={11} strokeWidth={2.4} />
      </span>
      <span className="font-semibold uppercase tracking-wider text-[9.5px] text-white/95">
        Reel
      </span>
    </div>
  );
}

export function VideoBadge({ className = '', style = {}, duration }) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider text-white shadow-lg pointer-events-none select-none transition-transform ${className}`}
      style={{
        background: 'rgba(12, 14, 20, 0.72)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        ...style,
      }}
      title="Video Post"
    >
      <span className="flex items-center justify-center text-white">
        <Play size={10} fill="currentColor" strokeWidth={0} />
      </span>
      <span className="font-semibold uppercase tracking-wider text-[9.5px] text-white/95">
        {duration || 'Video'}
      </span>
    </div>
  );
}

export function ImageBadge({ className = '', style = {}, isCarousel = false, count = 1 }) {
  if (isCarousel && count > 1) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider text-white shadow-lg pointer-events-none select-none transition-transform ${className}`}
        style={{
          background: 'rgba(15, 17, 22, 0.72)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(56, 189, 248, 0.32)',
          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
          ...style,
        }}
        title={`Carousel (${count} slides)`}
      >
        <span className="flex items-center justify-center text-sky-400">
          <Layers size={11} strokeWidth={2.4} />
        </span>
        <span className="font-semibold tracking-wide text-[9.5px] text-white/95">
          {count}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider text-white shadow-lg pointer-events-none select-none transition-transform ${className}`}
      style={{
        background: 'rgba(15, 15, 18, 0.65)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        border: '1px solid rgba(255, 255, 255, 0.14)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        ...style,
      }}
      title="Photo Post"
    >
      <span className="flex items-center justify-center text-stone-300">
        <ImageIcon size={10} strokeWidth={2.2} />
      </span>
      <span className="font-semibold uppercase tracking-wider text-[9px] text-stone-200">
        Photo
      </span>
    </div>
  );
}

/**
 * Smart Media Badge Resolver
 * Automatically determines whether a post is a Reel, Video, Carousel, or Photo
 */
export default function MediaBadge({ post, className = '', style = {} }) {
  if (!post) return null;

  const mediaUrls = Array.isArray(post.media_urls) && post.media_urls.length > 1 ? post.media_urls : null;
  const isCarousel = !!mediaUrls;
  const carouselCount = mediaUrls?.length || 1;

  const rawPostType = String(
    post.platform_data?.postType ||
    post.postType ||
    post.post_type ||
    post.platform_data?.instagram?.type ||
    ''
  ).toLowerCase();

  const isReel =
    rawPostType === 'reel' ||
    post.platform_data?.selected_post_size_preset === 'ig-reel' ||
    (post.media_type === 'video' && (
      post.platform_data?.selectedAspectRatio === '9:16' ||
      post.platform_data?.selected_aspect_ratio === '9:16' ||
      post.platform_data?.youtube?.type === 'short' ||
      String(post.platform_data?.selected_post_size_preset || '').includes('short')
    ));

  if (isReel) {
    return <ReelBadge className={className} style={style} />;
  }

  if (isCarousel) {
    return <ImageBadge className={className} style={style} isCarousel={true} count={carouselCount} />;
  }

  const isVideo =
    post.media_type === 'video' ||
    rawPostType === 'video' ||
    post.youtube_video_id ||
    /\.(mp4|mov|webm|avi)$/i.test(post.video_filename || post.media_url || '');

  if (isVideo) {
    return <VideoBadge className={className} style={style} />;
  }

  // Single Photo / Image
  return <ImageBadge className={className} style={style} isCarousel={false} />;
}
