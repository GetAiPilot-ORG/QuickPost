import { sortSchedules } from "../utils/scheduleSort";
import React, { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Share2,
  Plus,
  Edit3,
  Trash2,
  RefreshCw,
  Zap,
  CalendarClock,
  LayoutGrid,
  List
} from "lucide-react";
import apiClient from "../utils/apiClient";
import ComposerModal from "../components/ComposerModal";
import InfoHelp from "../components/InfoHelp";
import CalendarView from "../components/CalendarView";
import { ScheduledMediaThumb, ScheduledPreviewDialog } from "../components/ScheduledMedia";
import { PENDING_SCHEDULE_STATUSES, scheduleStatus, scheduleCountdown, localScheduleInput } from "../utils/scheduleStatus";
import { Skeleton } from "boneyard-js/react";
import { useDialog } from "../context/DialogContext";
import { useAuth } from "../context/AuthContext";

// ─── Platform icon helper ────────────────────────────────────────────────────
function getPlatformIcon(id) {
  const cls = "w-4 h-4 object-contain";
  const baseId = (id || "").split(":")[0].toLowerCase();
  const icons = {
    facebook: "/icons/facebook-round-color-icon.svg",
    instagram: "/icons/ig-instagram-icon.svg",
    socialpilot: "/logo.png",
    x: "/icons/x-social-media-round-icon.svg",
    linkedin: "/icons/linkedin-icon.svg",
    youtube: "/icons/youtube-color-icon.svg",
    pinterest: "/icons/pinterest-round-color-icon.svg",
    threads: "/icons/threads-icon.svg",
    mastodon: "/icons/mastodon-round-icon.svg",
    bluesky: "/icons/bluesky-circle-color-icon.svg",
    reddit: "/icons/reddit-icon.svg",
  };
  return icons[baseId] ? (
    <img src={icons[baseId]} alt={baseId} className={cls} />
  ) : (
    <Share2 className="w-4 h-4" />
  );
}

// ─── Status badge config ─────────────────────────────────────────────────────
const STATUS_CONFIG = {
  scheduled: {
    label: "Scheduled",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    icon: CalendarClock,
    pulse: false,
  },
  queued: {
    label: "Queued",
    color: "bg-violet-50 text-violet-700 border-violet-200",
    icon: Clock,
    pulse: false,
  },
  processing: {
    label: "Publishing…",
    color: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Loader2,
    pulse: true,
  },
  failed: {
    label: "Failed",
    color: "bg-red-50 text-red-700 border-red-200",
    icon: AlertTriangle,
    pulse: false,
  },
  cancelled: {
    label: "Cancelled",
    color: "bg-gray-50 text-gray-500 border-gray-200",
    icon: X,
    pulse: false,
  },
  sent: {
    label: "Published",
    color: "bg-green-50 text-green-700 border-green-200",
    icon: CheckCircle2,
    pulse: false,
  },
};

function StatusBadge({ status, lastError, platformData }) {
  const cfg = { ...(STATUS_CONFIG[status] || STATUS_CONFIG.cancelled), ...scheduleStatus({ status, last_error: lastError, platform_data: platformData }) };
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.color}`}
    >
      <Icon className={`w-3 h-3 ${cfg.pulse ? "animate-spin" : ""}`} />
      {cfg.label}
    </span>
  );
}

// ─── Format helpers ──────────────────────────────────────────────────────────
function cleanError(errorMsg) {
  if (!errorMsg) return "";
  let cleaned = String(errorMsg)
    .replace(/^\[Attempt\s+\d+(?:\/\d+)?\]\s*/i, '')
    .replace(/^Attempt\s+\d+:\s*/i, '')
    .replace(/^REAUTH_REQUIRED:\s*/i, '')
    .replace(/^Platform publishing failed\s*-\s*/i, '')
    .replace(/(?:^|\s*\|\s*)([a-zA-Z0-9_-]+):[0-9a-fA-F-]{8,}(?::\s*|\s*-\s*)/gi, (_m, p) => `${p.charAt(0).toUpperCase() + p.slice(1)}: `)
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '')
    .replace(/(Failed\s*—\s*[a-z]+):[a-f0-9\-]+:/gi, '$1:')
    .replace(/Instagram:\s*Instagram publishing failed:\s*/gi, 'Instagram: ')
    .trim();

  const lower = cleaned.toLowerCase();
  if (lower.includes('invalid access token') || lower.includes('session has expired') || lower.includes('session has been invalidated')) {
    return 'Instagram session expired. Please reconnect in Settings / Channels.';
  }
  return cleaned || "Publishing encountered an issue. Please retry.";
}

// ─── Thumbnail ───────────────────────────────────────────────────────────────
function QueueThumb({ post, onPreview }) {
  return <button type="button" aria-label={`Preview ${post.caption || 'post'}`} onClick={onPreview} className="shrink-0 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black"><ScheduledMediaThumb post={post} className="h-[52px] w-[52px]" /></button>;
}

// ─── Queue Card ───────────────────────────────────────────────────────────────
function QueueCard({ post, onCancel, onRetry, onRefresh, autoEditId }) {
  const { confirm, alert } = useDialog();
  const [expanded, setExpanded] = useState(post.id === autoEditId);
  const [editing, setEditing] = useState(post.id === autoEditId);

  useEffect(() => {
    if (post.id === autoEditId) {
      setExpanded(true);
      setEditing(true);
    }
  }, [autoEditId, post.id]);
  const [newCaption, setNewCaption] = useState(post.caption || "");
  const [newTime, setNewTime] = useState(
    post.scheduled_for
      ? localScheduleInput(post.scheduled_for)
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const { connectedAccounts } = useAuth();

  const channels = (Array.isArray(post.selected_channels) ? post.selected_channels : [])
    .filter((c) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(c).trim()));
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; // Always show in local time for the user
  const until = scheduleCountdown(post);

  const handleSaveEdit = async () => {
    if (!newTime) return;
    setSaving(true);
    try {
      await apiClient.patch(`/api/broadcasts/${post.id}`, {
        caption: newCaption,
        scheduledFor: new Date(newTime).toISOString(),
        userTimezone: tz,
      });
      setEditing(false);
      onRefresh();
    } catch (err) {
      alert("Update failed", err.response?.data?.error || "Failed to update post.", { intent: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    const confirmed = await confirm(
      "Cancel scheduled post?",
      "This scheduled post will be removed from the queue. This cannot be undone.",
      {
        intent: "danger",
        confirmText: "Cancel post",
        cancelText: "Keep scheduled",
      },
    );
    if (!confirmed) return;
    setActionLoading("cancel");
    try {
      await onCancel(post.id);
    } finally {
      setActionLoading("");
    }
  };

  const handleRetry = async () => {
    setActionLoading("retry");
    try {
      await onRetry(post.id);
    } finally {
      setActionLoading("");
    }
  };

  // Min datetime for editing = now + 2 min
  const minEditTime = localScheduleInput(Date.now() + 2 * 60 * 1000);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: -6 }}
      className={`scheduled-list-card ${post.status === "cancelled" ? 'opacity-70' : ''}`}
      role="listitem"
    >
      <div className="scheduled-list-row">
        <div className="scheduled-row-thumb"><QueueThumb post={post} onPreview={() => setPreviewOpen(true)} /></div>
        <div className="scheduled-row-content min-w-0">
          <button type="button" onClick={() => setPreviewOpen(true)} className="block w-full truncate text-left text-sm font-semibold text-gray-900 hover:underline focus-visible:outline-none focus-visible:underline">{post.caption || 'Untitled post'}</button>
          <div className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden text-xs text-gray-500">
            {channels.map(channel => {
              const [provider, accountId] = channel.split(':');
              const accounts = connectedAccounts?.[`${provider}Accounts`] || [];
              const account = accountId ? accounts.find(item => String(item.id) === accountId) : accounts[0];
              const label = account?.username ? `@${account.username.replace(/^@/, '')}` : account?.name || provider;
              return <span key={channel} title={label} className="inline-flex min-w-0 items-center gap-1.5"><span className="shrink-0">{getPlatformIcon(channel)}</span><span className="truncate">{label}</span></span>;
            })}
          </div>
          {post.status === 'failed' && post.last_error && <p title={cleanError(post.last_error)} className="mt-1 truncate text-xs text-red-600">{cleanError(post.last_error)}</p>}
        </div>
        <div className="scheduled-row-time text-xs">
          <p className="font-semibold tabular-nums text-gray-800">{post.scheduled_for && Number.isFinite(Date.parse(post.scheduled_for)) ? new Date(post.scheduled_for).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : '—'}</p>
          {until && <p className="mt-1 text-[11px] text-gray-500">{until}</p>}
        </div>
        <div className="scheduled-row-status"><StatusBadge status={post.status} lastError={post.last_error} platformData={post.platform_data} /></div>
        {/* Actions */}
        <div className="scheduled-row-actions flex items-center justify-end gap-1">
          <button type="button" onClick={() => setPreviewOpen(true)} className="rounded-md px-2 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black">Preview</button>
          {post.status === "scheduled" && (
            <button
              onClick={() => {
                setEditing(!editing);
                setExpanded(true);
              }}
              title="Edit"
              className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
          {post.status === "failed" && (
            <button
              onClick={handleRetry}
              title="Retry"
              disabled={actionLoading === "retry"}
              className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors disabled:opacity-50"
            >
              {actionLoading === "retry" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RotateCcw className="w-4 h-4" />
              )}
            </button>
          )}
          {["scheduled", "failed"].includes(post.status) && (
            <button
              onClick={handleCancel}
              title="Cancel"
              disabled={actionLoading === "cancel"}
              className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {actionLoading === "cancel" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          )}
          {post.status === "scheduled" && (
            <button
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? 'Hide details' : 'Show details'}
              aria-expanded={expanded}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {expanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      <ScheduledPreviewDialog post={post} open={previewOpen} onOpenChange={setPreviewOpen} errorMessage={post.status === 'failed' ? cleanError(post.last_error) : null} />

      {/* Expanded / Edit panel */}
      <AnimatePresence>
        {expanded && post.status === "scheduled" && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-gray-100 bg-gray-50/50 px-4 pb-4 pt-3 space-y-3">
              {/* Edit form */}
              {editing && (
                <div className="p-3 bg-white rounded-xl border border-blue-100 space-y-3">
                  <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                    Edit Scheduled Post
                  </p>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                      Caption
                    </label>
                    <textarea
                      value={newCaption}
                      onChange={(e) => setNewCaption(e.target.value)}
                      rows={3}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-400 outline-none resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                      New Schedule Time{" "}
                      <span className="text-gray-300 font-normal normal-case">
                        ({tz})
                      </span>
                    </label>
                    <input
                      type="datetime-local"
                      value={newTime}
                      onChange={(e) => setNewTime(e.target.value)}
                      min={minEditTime}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-400 outline-none"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving || !newTime}
                      className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3 h-3" />
                      )}
                      Save Changes
                    </button>
                    <button
                      onClick={() => setEditing(false)}
                      className="px-4 py-1.5 text-gray-500 hover:text-gray-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Metadata */}
              <div className="flex items-center gap-4 text-[10px] text-gray-400">
                <span>
                  Created: {new Date(post.created_at).toLocaleDateString()}
                </span>
                {post.attempt_count > 0 && (
                  <span>Attempts: {post.attempt_count}</span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Group posts by date ──────────────────────────────────────────────────────
function groupByDate(posts) {
  const groups = {};
  for (const post of posts) {
    const d = post.scheduled_for
      ? new Date(post.scheduled_for).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
      : "No date";
    if (!groups[d]) groups[d] = [];
    groups[d].push(post);
  }
  return groups;
}

// ─── Main ScheduledQueue Page ─────────────────────────────────────────────────
export default function ScheduledQueue() {
  const [searchParams] = useSearchParams();
  const autoEditId = searchParams.get("edit");
  const { connectedAccounts } = useAuth();
  const [posts, setPosts] = useState([]);
  const [stats, setStats] = useState({ pending: 0 });
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState('latest');

  // Persistent toggle state
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem("quickpost_queue_view") || "list";
  });
  const [prefillDate, setPrefillDate] = useState("");
  const [prefillCaption, setPrefillCaption] = useState("");
  const [prefillMediaUrls, setPrefillMediaUrls] = useState([]);

  const handleViewChange = (mode) => {
    setViewMode(mode);
    localStorage.setItem("quickpost_queue_view", mode);
  };

  const fetchQueue = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await apiClient.get("/api/broadcasts/queue");
      setPosts(res.data.broadcasts || []);
      setStats(res.data.stats || { pending: 0 });
    } catch (err) {
      console.error("Failed to fetch queue:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
    // Auto-refresh every 30 seconds to catch status changes
    const interval = setInterval(() => fetchQueue(true), 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  const handleCancel = async (id) => {
    await apiClient.post(`/api/broadcasts/${id}/cancel`);
    fetchQueue(true);
  };

  const handleRetry = async (id) => {
    await apiClient.post(`/api/broadcasts/${id}/retry`);
    fetchQueue(true);
  };

  // Filter
  const FILTERS = [
    { id: "all", label: "All" },
    { id: "scheduled", label: "Pending" },
    { id: "sent", label: "Published" },
    { id: "failed", label: "Failed" },
    { id: "cancelled", label: "Cancelled" },
  ];

  const filtered =
    activeFilter === "all"
      ? posts
      : posts.filter((p) => activeFilter === 'scheduled' ? PENDING_SCHEDULE_STATUSES.includes(p.status) : p.status === activeFilter);

  const grouped = groupByDate(sortSchedules(filtered, sortOrder));

  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)" }}>
      {/* ── Header ── */}
      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #ebe7e1",
          padding: "18px clamp(12px, 2vw, 20px)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1
              style={{
                fontSize: "clamp(28px, 3vw, 38px)",
                fontWeight: 500,
                color: "#111111",
                margin: 0,
                letterSpacing: "-0.025em",
                lineHeight: 1.08,
                fontFamily: "var(--font)",
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              Scheduled Queue
              <InfoHelp text="The scheduled time is a publishing target, not a guaranteed live time. Dispatch checks run every minute by default; upload and platform processing can add delay." />
            </h1>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Segmented View Toggle */}
            <div className="flex items-center bg-gray-100/80 p-0.5 rounded-lg border border-gray-200/70">
              <button
                onClick={() => handleViewChange("grid")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === "grid"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                  }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Calendar
              </button>
              <button
                onClick={() => handleViewChange("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${viewMode === "list"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-800"
                  }`}
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
            </div>

            <button
              onClick={() => fetchQueue(true)}
              disabled={refreshing}
              style={{
                padding: 8,
                borderRadius: "8px",
                border: "1px solid #d3cec6",
                background: "#ffffff",
                color: "#626260",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.color = "#111111";
                e.currentTarget.style.background = "#ebe7e1";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.color = "#626260";
                e.currentTarget.style.background = "#ffffff";
              }}
              className="disabled:opacity-50"
              title="Refresh"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={() => setComposerOpen(true)}
              className="btn-ink"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 14,
                padding: "9px 18px",
                borderRadius: "8px",
              }}
            >
              <Plus size={16} />
              <span className="hidden sm:inline">Schedule Post</span>
              <span className="sm:hidden">Schedule</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── Filter tabs with seamless count indicators ── */}
      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #d3cec6",
          padding: "0 clamp(12px, 2vw, 20px)",
        }}
      >
        <div className="flex items-center gap-6 overflow-x-auto" aria-label="Filter schedules">
          {[
            { id: "all", label: "All", count: posts.length },
            {
              id: "scheduled",
              label: "Pending",
              count: posts.filter((p) => PENDING_SCHEDULE_STATUSES.includes(p.status)).length,
            },
            {
              id: "sent",
              label: "Published",
              count: posts.filter((p) => p.status === "sent").length,
            },
            {
              id: "failed",
              label: "Failed",
              count: posts.filter((p) => p.status === "failed").length,
              hasWarning: posts.filter((p) => p.status === "failed").length > 0,
            },
            {
              id: "cancelled",
              label: "Cancelled",
              count: posts.filter((p) => p.status === "cancelled").length,
            },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className="flex items-center gap-2 transition-colors"
              style={{
                padding: "13px 0",
                fontSize: 13,
                fontWeight: activeFilter === f.id ? 600 : 500,
                color: activeFilter === f.id ? "#111111" : "#626260",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                borderBottom: `2px solid ${activeFilter === f.id ? "#111111" : "transparent"}`,
                marginBottom: -1,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <span>{f.label}</span>
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full font-medium transition-colors ${activeFilter === f.id
                    ? f.hasWarning
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-900 text-white"
                    : f.hasWarning
                      ? "bg-red-50 text-red-600"
                      : "bg-gray-100 text-gray-500"
                  }`}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div
        style={{
          padding: "16px clamp(12px, 2vw, 20px)",
          margin: "0 auto",
          maxWidth: viewMode === 'list' ? '1120px' : '1600px',
        }}
      >
        <Skeleton
          name="scheduled-queue"
          loading={loading}
          fixture={
            <div className="space-y-8">
              {[1, 2].map((i) => (
                <div key={i}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
                    <div className="flex-1 h-px bg-gray-100" />
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((j) => (
                      <div
                        key={j}
                        className="h-32 bg-white rounded-2xl border border-gray-100 shadow-sm"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          }
        >
          {viewMode === "grid" ? (
            <CalendarView
              posts={filtered}
              connectedAccounts={connectedAccounts}
              onRefresh={(silent) => fetchQueue(silent)}
              onCancel={handleCancel}
              onAddPost={(date, options = {}) => {
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, "0");
                const d = String(date.getDate()).padStart(2, "0");
                const localDateStr = `${y}-${m}-${d}`;
                setPrefillDate(`${localDateStr}T09:00`);
                if (options.caption) setPrefillCaption(options.caption);
                if (options.mediaUrls) setPrefillMediaUrls(options.mediaUrls);
                setComposerOpen(true);
              }}
            />
          ) : filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-dashed border-gray-200 p-20 text-center shadow-sm"
            >
              <img
                src={activeFilter === 'failed' ? 'https://img.magnific.com/free-vector/tiny-people-examining-operating-system-error-warning-web-page-isolated-flat-illustration_74855-11104.jpg?semt=ais_hybrid&w=740&q=80' : 
                  activeFilter === 'cancelled' ? 'https://img.magnific.com/free-vector/cancelled-events-announcement-illustration_23-2148584716.jpg' : 
                  'https://cdni.iconscout.com/illustration/premium/thumb/women-upload-data-from-cloud-illustration-svg-download-png-7581074.png'}
                alt={`No ${activeFilter} posts`}
                className="h-32 object-contain mx-auto mb-6"
              />
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {activeFilter === "all"
                  ? "No scheduled posts yet"
                  : `No ${activeFilter} posts`}
              </h3>
              <p className="text-gray-400 text-sm mb-8 max-w-xs mx-auto">
                Create a post in the Composer and toggle "Schedule Post" to pick
                a future time.
              </p>
              <button
                onClick={() => setComposerOpen(true)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-lg"
              >
                <span className="flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Schedule your first post
                </span>
              </button>
            </motion.div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
                <label className="flex items-center gap-2">Schedule time
                  <select aria-label="Sort posts by schedule time" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700">
                    <option value="latest">Latest first</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </label>
                <span>Times in {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
              </div>
              <AnimatePresence>
                {Object.entries(grouped).map(([date, datePosts]) => (
                  <div key={date}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-1.5 text-[13px] font-semibold text-gray-700">
                        <Calendar className="w-3.5 h-3.5" />
                        {date}
                      </div>
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-xs font-medium text-gray-500">
                        {datePosts.length} post{datePosts.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="scheduled-list-group" role="list" aria-label={date}>
                      {datePosts.map((post) => (
                        <QueueCard
                          key={post.id}
                          post={post}
                          autoEditId={autoEditId}
                          onCancel={handleCancel}
                          onRetry={handleRetry}
                          onRefresh={() => fetchQueue(true)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </Skeleton>
      </div>

      <ComposerModal
        isOpen={composerOpen}
        initialScheduledAt={prefillDate}
        initialCaption={prefillCaption}
        initialMediaUrls={prefillMediaUrls}
        onClose={() => {
          setComposerOpen(false);
          setPrefillDate("");
          setPrefillCaption("");
          setPrefillMediaUrls([]);
        }}
        onPostCreated={() => {
          setComposerOpen(false);
          setPrefillDate("");
          setPrefillCaption("");
          setPrefillMediaUrls([]);
          fetchQueue(true);
        }}
      />
    </div>
  );
}
