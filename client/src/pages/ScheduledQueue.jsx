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
import CalendarView from "../components/CalendarView";
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

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.scheduled;
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
function formatScheduledTime(utcString) {
  if (!utcString) return "—";
  const d = new Date(utcString);
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeUntil(utcString) {
  if (!utcString) return null;
  const diff = new Date(utcString).getTime() - Date.now();
  if (diff < 0) return "overdue";
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `in ${days}d ${hrs % 24}h`;
  if (hrs > 0) return `in ${hrs}h ${mins % 60}m`;
  return `in ${mins}m`;
}

function cleanError(errorMsg) {
  if (!errorMsg) return "";
  return String(errorMsg)
    .replace(/(Failed\s*—\s*[a-z]+):[a-f0-9\-]+:/gi, '$1:')
    .trim();
}

// ─── Thumbnail ───────────────────────────────────────────────────────────────
function QueueThumb({ post }) {
  const url = post.thumbnail_url || post.media_url;
  return (
    <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
      {url ? (
        <img
          src={url}
          alt="thumb"
          className="w-full h-full object-cover"
          onError={(e) => (e.target.style.display = "none")}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
          <Calendar className="w-6 h-6 text-gray-300" />
        </div>
      )}
    </div>
  );
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
      ? new Date(post.scheduled_for).toISOString().slice(0, 16)
      : "",
  );
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const channels = Array.isArray(post.selected_channels)
    ? post.selected_channels
    : [];
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone; // Always show in local time for the user
  const until = timeUntil(post.scheduled_for);

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
  const minEditTime = new Date(Date.now() + 2 * 60 * 1000)
    .toISOString()
    .slice(0, 16);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: -6 }}
      className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-shadow hover:shadow-md ${post.status === "processing"
        ? "border-amber-200 ring-1 ring-amber-100"
        : post.status === "failed"
          ? "border-red-200"
          : post.status === "cancelled"
            ? "border-gray-200 opacity-60"
            : "border-gray-100"
        }`}
    >
      {/* Main row */}
      <div className="p-4 flex items-start gap-4">
        <QueueThumb post={post} />
        <div className="flex-1 min-w-0">
          {/* Caption */}
          <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-normal mb-1">
            {post.caption || (
              <span className="text-gray-400 italic">No caption</span>
            )}
          </p>

          {/* Error Message Inline (if failed) */}
          {post.status === "failed" && post.last_error && (
            <div className="mb-2 inline-flex items-start gap-1.5 p-1.5 bg-red-50/80 rounded-md border border-red-100 max-w-full">
              <AlertTriangle className="w-3.5 h-3.5 text-red-600 mt-0.5 shrink-0" />
              <span className="text-[12px] font-medium text-red-700 leading-tight">
                {cleanError(post.last_error)}
              </span>
            </div>
          )}

          {/* Meta: time + timezone */}
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <div className="flex items-center gap-1 text-[11px] font-medium text-gray-500">
              <Clock className="w-3 h-3" />
              {formatScheduledTime(post.scheduled_for)}
              {until && (
                <span
                  className={`ml-1 font-bold ${until === "overdue" ? "text-red-500" : "text-blue-500"
                    }`}
                >
                  ({until})
                </span>
              )}
            </div>
            <span className="text-[10px] text-gray-300">·</span>
            <span className="text-[10px] text-gray-400">{tz}</span>
          </div>

          {/* Platforms + status */}
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={post.status} />
            <div className="flex items-center gap-1 flex-wrap">
              {channels.map((id) => (
                <span
                  key={id}
                  title={(id || "").split(":")[0]}
                  className="w-5 h-5 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden"
                >
                  {getPlatformIcon(id)}
                </span>
              ))}
            </div>
            {post.attempt_count > 0 && (
              <span className="text-[10px] text-gray-400">
                attempt {post.attempt_count}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
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
    { id: "scheduled", label: "Scheduled" },
    { id: "sent", label: "Published" },
    { id: "failed", label: "Failed" },
    { id: "cancelled", label: "Cancelled" },
  ];

  const filtered =
    activeFilter === "all"
      ? posts
      : posts.filter((p) => p.status === activeFilter);

  const grouped = groupByDate(filtered);

  return (
    <div className="min-h-screen" style={{ background: "var(--canvas)" }}>
      {/* ── Header ── */}
      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #ebe7e1",
          padding: "clamp(20px, 3vw, 24px) clamp(18px, 3vw, 32px)",
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1
              style={{
                fontSize: "clamp(36px, 5vw, 56px)",
                fontWeight: 500,
                color: "#111111",
                margin: 0,
                letterSpacing: "-0.025em",
                lineHeight: 1.08,
                fontFamily: "var(--font)",
              }}
            >
              Scheduled Queue
            </h1>
            <p className="text-xs text-gray-500 font-medium mt-1.5 max-w-md">
              Manage and track upcoming social broadcasts across all connected channels.
            </p>
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
                Grid
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
          padding: "0 clamp(18px, 3vw, 32px)",
        }}
      >
        <div className="flex items-center gap-6">
          {[
            { id: "all", label: "All", count: posts.length },
            {
              id: "scheduled",
              label: "Scheduled",
              count: posts.filter((p) => p.status === "scheduled").length,
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
          padding: "32px clamp(18px, 3vw, 32px)",
          margin: "0 auto",
          maxWidth: "1600px",
        }}
      >
        <Skeleton
          name="scheduled-queue"
          loading={loading}
          fixture={
            <div className="space-y-8">
              {[1, 2].map((i) => (
                <div key={i}>
                  <div className="flex items-center gap-3 mb-3">
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
                src={`https://illustrations.popsy.co/amber/${activeFilter === 'failed' ? 'designer' :
                  activeFilter === 'cancelled' ? 'creative-work' :
                    'surreal-hourglass'
                  }.svg`}
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
            <div className="space-y-8">
              <AnimatePresence>
                {Object.entries(grouped).map(([date, datePosts]) => (
                  <div key={date}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-widest">
                        <Calendar className="w-3.5 h-3.5" />
                        {date}
                      </div>
                      <div className="flex-1 h-px bg-gray-100" />
                      <span className="text-[10px] font-bold text-gray-300">
                        {datePosts.length} post{datePosts.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="space-y-3">
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
