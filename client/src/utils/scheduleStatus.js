export const PENDING_SCHEDULE_STATUSES = ['scheduled', 'queued', 'processing'];
const COLORS = {
  scheduled: { label: 'Scheduled', color: 'bg-[#eff6ff] text-[#1d4ed8] border-[#bfdbfe]' },
  queued: { label: 'Queued', color: 'bg-[#eef2ff] text-[#4338ca] border-[#c7d2fe]' },
  processing: { label: 'Publishing', color: 'bg-[#fffbeb] text-[#92400e] border-[#fde68a]' },
  sent: { label: 'Published', color: 'bg-[#f0fdf4] text-[#166534] border-[#bbf7d0]' },
  failed: { label: 'Failed', color: 'bg-[#fef2f2] text-[#b91c1c] border-[#fecaca]' },
  cancelled: { label: 'Cancelled', color: 'bg-[#f3f4f6] text-[#4b5563] border-[#d1d5db]' },
};
export function scheduleStatus(post) {
  const base = COLORS[post.status] || { label: 'Unknown status', color: 'bg-[#f3f4f6] text-[#4b5563] border-[#d1d5db]' };
  if (post.status === 'scheduled' && post.last_error) return { ...base, label: 'Retry pending' };
  if (post.status === 'failed' && post.platform_data?.completedChannels?.length) return { ...base, label: 'Partially published' };
  return base;
}
export function scheduleCountdown(post, now = Date.now()) {
  if (!['scheduled', 'queued'].includes(post.status) || !post.scheduled_for) return null;
  const scheduled = Date.parse(post.scheduled_for);
  if (!Number.isFinite(scheduled)) return null;
  const diff = scheduled - now;
  if (diff <= 0) return 'Waiting to start';
  const mins = Math.ceil(diff / 60000), hours = Math.floor(mins / 60), days = Math.floor(hours / 24);
  if (days) return `in ${days}d ${hours % 24}h`;
  if (hours) return `in ${hours}h ${mins % 60}m`;
  return `in ${mins}m`;
}

export function localScheduleInput(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = part => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
