import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { scheduledMediaUrls, scheduledMediaIsVideo, scheduledMediaPoster } from '../utils/scheduledMedia';
import { scheduleStatus } from '../utils/scheduleStatus';

export function ScheduledMediaThumb({ post, className = 'h-14 w-16' }) {
  const urls = scheduledMediaUrls(post), src = urls[0], video = src && scheduledMediaIsVideo(src, post);
  const poster = scheduledMediaPoster(post);
  const [failed, setFailed] = useState(false);
  const [visible, setVisible] = useState(false);
  const container = useRef(null);
  useEffect(() => {
    setFailed(false);
    if (!video || poster) return;
    if (typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '80px' });
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, [src, poster, video]);
  return <div ref={container} className={`relative shrink-0 overflow-hidden rounded-md border border-black/5 bg-gray-100 ${className}`}>
    {!failed && (poster || (src && !video)) ? <img key={poster || src} src={poster || src} alt="" loading="lazy" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      : !failed && video && visible ? <video key={src} src={src} muted playsInline preload="metadata" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      : <span className="grid h-full place-items-center p-1 text-center text-[10px] text-gray-500">{failed ? 'Preview unavailable' : video ? 'Video' : 'Text post'}</span>}
    {src && <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-[9px] text-white">{urls.length > 1 ? `${urls.length} items` : video ? 'Video' : 'Photo'}</span>}
  </div>;
}

export function ScheduledMediaGallery({ post }) {
  const urls = scheduledMediaUrls(post);
  const [index, setIndex] = useState(0);
  const [failedUrl, setFailedUrl] = useState(null);
  const selected = Math.min(index, Math.max(0, urls.length - 1)), src = urls[selected];
  const video = src && scheduledMediaIsVideo(src, post);
  if (!src) {
    const poster = scheduledMediaPoster(post);
    return <div className="rounded-lg border border-dashed p-4 text-center text-sm text-gray-500">
      {poster && failedUrl !== poster && <img src={poster} alt="Post cover preview" className="mb-3 max-h-[300px] w-full object-contain" onError={() => setFailedUrl(poster)} />}
      {poster ? 'Cover preview · original media unavailable' : ['image', 'video', 'carousel'].includes(post.media_type) ? 'Original media is unavailable.' : 'Text-only post · no media attached'}
    </div>;
  }
  return <section aria-label="Post media preview" className="space-y-3">
    <div className="overflow-hidden rounded-lg bg-gray-100">
      {failedUrl === src ? <p role="status" className="p-8 text-center text-sm text-gray-600">This media preview could not load.</p>
        : video ? <video key={src} src={src} poster={selected === 0 ? scheduledMediaPoster(post) || undefined : undefined} controls playsInline preload="metadata" className="max-h-[340px] min-h-[180px] w-full bg-black object-contain" onError={() => setFailedUrl(src)} />
          : <img key={src} src={src} alt={`Post media ${selected + 1} of ${urls.length}`} className="max-h-[340px] w-full object-contain" onError={() => setFailedUrl(src)} />}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
      {urls.length > 1 ? <div className="flex items-center gap-3"><button type="button" disabled={selected === 0} onClick={() => setIndex(selected - 1)} className="rounded border px-2 py-1.5 disabled:opacity-40">Previous</button><span aria-live="polite">{selected + 1} / {urls.length}</span><button type="button" disabled={selected === urls.length - 1} onClick={() => setIndex(selected + 1)} className="rounded border px-2 py-1.5 disabled:opacity-40">Next</button></div> : <span>{video ? 'Video preview' : 'Photo preview'}</span>}
      <a href={src} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Open original media</a>
    </div>
  </section>;
}

export function ScheduledPreviewDialog({ post, open, onOpenChange, errorMessage }) {
  const status = scheduleStatus(post);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto max-w-2xl">
    <DialogHeader><DialogTitle>Post preview</DialogTitle><DialogDescription>{new Date(post.scheduled_for).toLocaleString()} · {Intl.DateTimeFormat().resolvedOptions().timeZone}</DialogDescription></DialogHeader>
    <span className={`w-fit rounded-full border px-2 py-1 text-xs font-semibold ${status.color}`}>{status.label}</span>
    {errorMessage && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</p>}
    <ScheduledMediaGallery key={post.id} post={post} />
    <p className="whitespace-pre-wrap break-words text-sm text-gray-700">{post.caption || 'No caption'}</p>
  </DialogContent></Dialog>;
}
