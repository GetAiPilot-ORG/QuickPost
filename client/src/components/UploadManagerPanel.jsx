import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, ChevronDown, X, RefreshCw, 
  CheckCircle2, AlertTriangle, CloudLightning,
  Image as ImageIcon, Video, AlertCircle
} from 'lucide-react';
import { useUploadJobs } from '../context/UploadJobContext';

/* ─────────────────────────────────────────────────────────────────────────── */
/* UI UPGRADE: Modern, Premium Dashboard Aesthetic                             */
/* Using Tailwind utility classes for consistent theme alignment               */
/* ─────────────────────────────────────────────────────────────────────────── */

const PLATFORM_ICONS = {
  instagram: '/icons/ig-instagram-icon.svg',
  youtube: '/icons/youtube-color-icon.svg',
  facebook: '/icons/facebook-round-color-icon.svg',
  x: '/icons/x-social-media-round-icon.svg',
  linkedin: '/icons/linkedin-icon.svg',
  pinterest: '/icons/pinterest-round-color-icon.svg',
  threads: '/icons/threads-icon.svg',
  mastodon: '/icons/mastodon-round-icon.svg',
  bluesky: '/icons/bluesky-circle-color-icon.svg',
  reddit: '/icons/reddit-icon.svg',
};

function phase(progress, status) {
  if (status === 'failed') return { label: 'ACTION NEEDED', bar: 'bg-red-500', glow: 'shadow-red-500/20', text: 'text-red-600', bg: 'bg-red-500/10' };
  if (status === 'stalled') return { label: 'VERIFYING', bar: 'bg-slate-500', glow: 'shadow-slate-500/20', text: 'text-slate-600', bg: 'bg-slate-500/10' };
  if (status === 'completed' || progress >= 100) return { label: 'SUCCESS', bar: 'bg-green-500', glow: 'shadow-green-500/20', text: 'text-green-600', bg: 'bg-green-500/10' };
  if (progress < 30) return { label: 'PREPARING', bar: 'bg-neutral-900', glow: 'shadow-neutral-900/20', text: 'text-neutral-900', bg: 'bg-neutral-900/10' };
  if (progress < 70) return { label: 'PROCESSING', bar: 'bg-neutral-900', glow: 'shadow-neutral-900/20', text: 'text-neutral-900', bg: 'bg-neutral-900/10' };
  return { label: 'FINALIZING', bar: 'bg-slate-500', glow: 'shadow-slate-500/20', text: 'text-slate-600', bg: 'bg-slate-500/10' };
}

function cleanUploadError(error = '') {
  const message = String(error || '')
    .replace(/Cloudinary upload failed:\s*/gi, '')
    .replace(/Ordinary upload failed:\s*/gi, '')
    .replace(/(Failed\s*—\s*[a-z]+):[a-f0-9\-]+:/gi, '$1:')
    .trim();

  if (/Maximum is 10485760/i.test(message)) {
    return 'The file size exceeds the limit. Please use a smaller file or compress it to continue.';
  }

  // Professional masking of raw errors - wait, no, show the actual error for debugging!
  return message || 'We encountered a brief interruption while processing your request. Please try again.';
}

function formatStepDescription(step = '') {
  if (!step) return 'Processing data…';
  // Strip out redundant sub-task percentages like "(15%)" or "(50%)." that conflict with the overall progress %
  let cleaned = String(step)
    .replace(/\s*\(\d+%\)\.?/g, '')
    .trim();
  if (cleaned && !cleaned.endsWith('…') && !cleaned.endsWith('!') && !cleaned.endsWith('.')) {
    cleaned += '…';
  }
  return cleaned || 'Processing data…';
}

function StatusDot({ colorClass }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      <motion.span
        className={`absolute inset-0 rounded-full ${colorClass} opacity-40`}
        animate={{ scale: [1, 2.5, 1], opacity: [0.4, 0, 0.4] }}
        transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
      />
      <span className={`absolute inset-0 rounded-full ${colorClass}`} />
    </span>
  );
}

const JobCard = React.forwardRef(function JobCard({ job, onRetry, onDismiss }, ref) {
  const { progress, status, step, error, meta } = job;
  const p = phase(progress, status);
  const isActive = status === 'pending' || status === 'processing';
  const isDone = status === 'completed';
  const isFailed = status === 'failed';
  const isStalled = status === 'stalled';
  const isSizeLimitError = /Maximum is 10485760/i.test(error || '');
  const displayError = cleanUploadError(error);
  const channels = meta?.channels || [];
  const caption = meta?.caption || '';
  const mediaType = meta?.mediaType || 'image';
  const fileCount = meta?.fileCount || 1;
  const previewUrl = meta?.previewUrl || null;
  const requiresReconnect = Boolean(meta?.requiresReconnect || meta?.retryDisabled);

  useEffect(() => {
    if (status === 'completed') {
      const timer = setTimeout(() => {
        onDismiss(job.id);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [status, job.id, onDismiss]);

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 15, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`relative overflow-hidden rounded-xl border p-3.5 transition-all duration-300 ${
        isFailed 
          ? 'border-red-200 bg-red-50/40 hover:border-red-300' 
          : isDone 
          ? 'border-green-200 bg-green-50/40 hover:border-green-300' 
          : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-md'
      } shadow-sm`}
    >
      {isActive && (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-neutral-900/[0.03] to-transparent"
          animate={{ x: ['-100%', '200%'] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
        />
      )}

      <div className="relative flex items-start gap-3.5 z-10">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border shadow-sm ${
          isFailed ? 'border-red-100 bg-white' : isDone ? 'border-green-100 bg-white' : 'border-stone-100 bg-stone-50'
        }`}>
          {previewUrl ? (
            <img src={previewUrl} alt="" className="h-full w-full object-cover" />
          ) : mediaType === 'video' ? (
            <Video size={20} className={isFailed ? 'text-red-500' : isDone ? 'text-green-600' : 'text-stone-400'} />
          ) : (
            <ImageIcon size={20} className={isFailed ? 'text-red-500' : isDone ? 'text-green-600' : 'text-stone-400'} />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-col">
              <h4 className="truncate text-[13px] font-bold text-neutral-900">
                {caption || `${fileCount} Item${fileCount !== 1 ? 's' : ''}`}
              </h4>
              <div className="mt-1 flex items-center gap-1.5">
                {isActive && <StatusDot colorClass={p.bar} />}
                {isDone && <CheckCircle2 size={12} className="text-green-600" />}
                {isFailed && <AlertCircle size={12} className="text-red-500" />}
                {isStalled && <AlertCircle size={12} className="text-slate-500" />}
                <span className={`text-[9px] font-bold uppercase tracking-wider ${p.text}`}>
                  {p.label}
                </span>
              </div>
            </div>

            <button
              onClick={() => onDismiss(job.id)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-stone-400 transition-colors hover:bg-stone-100 hover:text-neutral-900 focus:outline-none"
              aria-label="Dismiss"
            >
              <X size={14} />
            </button>
          </div>

          <p className={`mt-2 line-clamp-2 text-[11px] font-medium leading-relaxed ${isFailed ? 'text-red-600/90' : 'text-stone-500'}`}>
            {isFailed ? displayError : formatStepDescription(step)}
          </p>

          <div className="mt-3.5 relative h-1.5 overflow-hidden rounded-full bg-stone-100">
            <motion.div
              className={`h-full rounded-full ${isFailed ? 'bg-red-500' : isDone ? 'bg-green-500' : 'bg-neutral-900'} ${p.glow} shadow-sm`}
              animate={{ width: `${isFailed ? 100 : Math.max(progress, 0)}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            {isActive && progress > 0 && progress < 100 && (
              <motion.div
                className="absolute inset-y-0 w-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                style={{ left: `${progress}%`, transform: 'translateX(-50%)' }}
                animate={{ opacity: [0.2, 0.6, 0.2] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
              />
            )}
          </div>

          <div className="mt-2.5 flex items-center justify-between">
            <span className={`text-[11px] font-bold tabular-nums ${isDone ? 'text-green-600' : isFailed ? 'text-red-500' : 'text-neutral-900'}`}>
              {isDone ? 'Complete' : isFailed ? 'Attention' : isStalled ? 'Checking' : `${progress}%`}
            </span>

            <div className="flex items-center">
              {channels.slice(0, 6).map((ch, i) => {
                const src = PLATFORM_ICONS[ch];
                return src ? (
                  <div 
                    key={ch} 
                    className="relative -ml-1.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white shadow-sm first:ml-0"
                    style={{ zIndex: 6 - i }}
                  >
                    <img src={src} alt={ch} className="h-full w-full object-cover" />
                  </div>
                ) : null;
              })}
              {channels.length > 6 && (
                <div className="relative -ml-1.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 border-white bg-stone-100 shadow-sm">
                  <span className="text-[7px] font-bold text-stone-500">
                    +{channels.length - 6}
                  </span>
                </div>
              )}
            </div>
          </div>

          {isFailed && (
            <div className="mt-3.5 flex">
              <button
                onClick={() => {
                  if (isSizeLimitError) {
                    onDismiss(job.id);
                    return;
                  }
                  if (requiresReconnect) {
                    window.location.href = '/connect';
                    return;
                  }
                  onRetry(job.id);
                }}
                className="group flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-red-600 shadow-sm transition-all hover:bg-red-500 hover:text-white"
              >
                <RefreshCw size={12} className={isActive ? 'animate-spin' : 'transition-transform group-hover:rotate-180'} />
                {isSizeLimitError ? 'Acknowledge' : requiresReconnect ? 'Reconnect Account' : 'Retry Process'}
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
});

export default function UploadManagerPanel() {
  const { jobs, retryJob, clearCompleted, dismissJob, activeCount } = useUploadJobs();
  const [collapsed, setCollapsed] = useState(false);

  if (jobs.length === 0) return null;

  const completedCount = jobs.filter(j => j.status === 'completed').length;
  const failedCount = jobs.filter(j => j.status === 'failed').length;
  const stalledCount = jobs.filter(j => j.status === 'stalled').length;
  const hasOnlyFailures = activeCount === 0 && failedCount > 0 && completedCount === 0 && stalledCount === 0;
  const anyFinished = completedCount > 0 || failedCount > 0 || stalledCount > 0;

  const activeJobs = jobs.filter(j => j.status === 'pending' || j.status === 'processing');
  const avgProgress = activeJobs.length > 0
    ? Math.round(activeJobs.reduce((s, j) => s + j.progress, 0) / activeJobs.length)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 30, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      className="fixed bottom-6 right-6 z-[99999] w-[clamp(320px,90vw,380px)] overflow-hidden rounded-2xl border border-dust bg-white shadow-2xl shadow-ink/10"
    >
      {/* Dynamic Header */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        className={`group flex cursor-pointer select-none items-center justify-between p-4 transition-colors hover:bg-canvas/40 ${
          collapsed ? '' : 'border-b border-dust bg-canvas/20'
        }`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3.5">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] shadow-sm ${
            activeCount > 0 ? 'bg-ink' : hasOnlyFailures ? 'bg-red-500' : 'bg-green-500'
          }`}>
            {activeCount > 0 ? (
              <motion.div
                animate={{ y: [-1, 1, -1] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              >
                <CloudLightning size={20} className="text-white" strokeWidth={2.5} />
              </motion.div>
            ) : hasOnlyFailures ? (
              <AlertTriangle size={20} className="text-white" strokeWidth={2.5} />
            ) : (
              <CheckCircle2 size={20} className="text-white" strokeWidth={2.5} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-[14px] font-bold tracking-tight text-ink">
              {activeCount > 0 ? `Processing ${activeCount} task${activeCount !== 1 ? 's' : ''}...` : 'Task Manager'}
            </h3>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-slate-500">
              <span>{jobs.length} JOB{jobs.length !== 1 ? 'S' : ''}</span>
              {completedCount > 0 && (
                <>
                  <span className="h-1 w-1 rounded-full bg-dust" />
                  <span className="text-green-600">{completedCount} DONE</span>
                </>
              )}
              {failedCount > 0 && (
                <>
                  <span className="h-1 w-1 rounded-full bg-dust" />
                  <span className="text-red-500">{failedCount} FAILED</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 pl-3">
          {anyFinished && !collapsed && (
            <button
              onClick={e => {
                e.stopPropagation();
                clearCompleted();
              }}
              className="rounded-lg bg-canvas px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 transition-colors hover:bg-slate-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-ink/20"
            >
              Clear
            </button>
          )}
          <motion.div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-transparent text-slate-500 transition-colors group-hover:bg-slate-100 group-hover:text-ink"
            animate={{ rotate: collapsed ? 180 : 0 }}
            transition={{ duration: 0.3, ease: 'backOut' }}
          >
            <ChevronDown size={18} strokeWidth={2.5} />
          </motion.div>
        </div>
      </div>

      {/* Global Progress Bar for Active Jobs */}
      {activeCount > 0 && (
        <div className="h-[3px] w-full bg-ink/10">
          <motion.div
            className="h-full bg-ink"
            animate={{ width: `${avgProgress}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      )}

      {/* Expandable List */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="job-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="flex max-h-[65vh] flex-col gap-3 overflow-y-auto p-4 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300 hover:scrollbar-thumb-slate-400">
              <AnimatePresence mode="popLayout">
                {jobs.map(job => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onRetry={retryJob}
                    onDismiss={dismissJob}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
