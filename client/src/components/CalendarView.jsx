import React, { useState, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Clock,
  Loader2,
  Share2,
  CheckCircle2,
  X,
  Calendar,
  Copy,
  Edit3
} from "lucide-react";
import toast from "react-hot-toast";
import apiClient from "../utils/apiClient";
import { useDialog } from "../context/DialogContext";

// ─── Platform icon helper (matches ScheduledQueue list view icons) ───────────
function getPlatformIcon(id) {
  const cls = "w-3.5 h-3.5 object-contain";
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
  const url = icons[baseId];
  if (!url) return <Share2 className="w-3.5 h-3.5" />;
  return <img src={url} alt={baseId} className={cls} />;
}

// ─── Softer Pastel Accent colors (V2 Theme Refinement) ──────────────────────
function getPlatformAccent(channelId) {
  const provider = (channelId || "").split(":")[0].toLowerCase();
  const colors = {
    instagram: { bg: "bg-[#f3e8ff]/85 border-[#e9d5ff]", text: "text-[#6b21a8]", border: "border-[#e9d5ff]", borderLeft: "border-l-[3.5px] border-l-[#a855f7]", dot: "bg-[#8b5cf6]" },
    linkedin: { bg: "bg-[#eff6ff]/85 border-[#dbeafe]", text: "text-[#1e40af]", border: "border-[#dbeafe]", borderLeft: "border-l-[3.5px] border-l-[#3b82f6]", dot: "bg-[#3b82f6]" },
    facebook: { bg: "bg-[#f0f9ff]/85 border-[#e0f2fe]", text: "text-[#0369a1]", border: "border-[#e0f2fe]", borderLeft: "border-l-[3.5px] border-l-[#0284c7]", dot: "bg-[#0284c7]" },
    youtube: { bg: "bg-[#fff1f2]/85 border-[#ffe4e6]", text: "text-[#be123c]", border: "border-[#ffe4e6]", borderLeft: "border-l-[3.5px] border-l-[#ef4444]", dot: "bg-[#ef4444]" },
    x: { bg: "bg-[#f8fafc]/85 border-[#f1f5f9]", text: "text-[#334155]", border: "border-[#f1f5f9]", borderLeft: "border-l-[3.5px] border-l-[#cbd5e1]", dot: "bg-[#475569]" },
    threads: { bg: "bg-[#f5f5f5]/85 border-[#e5e5e5]", text: "text-[#171717]", border: "border-[#e5e5e5]", borderLeft: "border-l-[3.5px] border-l-[#a3a3a3]", dot: "bg-[#262626]" },
    pinterest: { bg: "bg-[#fff1f2]/85 border-[#ffe4e6]", text: "text-[#b91c1c]", border: "border-[#ffe4e6]", borderLeft: "border-l-[3.5px] border-l-[#dc2626]", dot: "bg-[#dc2626]" },
  };
  return colors[provider] || { bg: "bg-[#f0fdf4]/85 border-[#dcfce7]", text: "text-[#166534]", border: "border-[#dcfce7]", borderLeft: "border-l-[3.5px] border-l-[#22c55e]", dot: "bg-[#22c55e]" };
}

// ─── Status configs ─────────────────────────────────────────────────────────
const STATUS_BADGES = {
  scheduled: { label: "Scheduled", color: "bg-blue-50 text-blue-700 border-blue-150" },
  queued: { label: "Queued", color: "bg-violet-50 text-violet-700 border-violet-150" },
  processing: { label: "Publishing...", color: "bg-amber-50 text-amber-700 border-amber-150" },
  failed: { label: "Failed", color: "bg-red-50 text-red-700 border-red-150" },
  cancelled: { label: "Cancelled", color: "bg-gray-50 text-gray-500 border-gray-150" },
  sent: { label: "Published", color: "bg-green-50 text-green-700 border-green-150" },
};

// Helper to format Date object as local YYYY-MM-DD string
function getLocalDateString(date) {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Helper to extract account picture from connected accounts
function getAccountPicture(channelId, connectedAccounts) {
  if (!channelId || !connectedAccounts) return null;
  const parts = channelId.split(":");
  const provider = parts[0];
  const accountId = parts[1];
  const accountsKey = `${provider}Accounts`;
  const accounts = connectedAccounts[accountsKey] || [];

  let account = null;
  if (accountId) {
    account = accounts.find((acc) => String(acc.id) === String(accountId));
  } else if (accounts.length > 0) {
    account = accounts[0];
  }
  return account?.profilePicture || account?.avatar || account?.avatar_url || account?.profile_picture || null;
}

// Helper to extract account name from connected accounts
function getAccountName(channelId, connectedAccounts) {
  if (!channelId || !connectedAccounts) return "";
  const parts = channelId.split(":");
  const provider = parts[0];
  const accountId = parts[1];
  const accountsKey = `${provider}Accounts`;
  const accounts = connectedAccounts[accountsKey] || [];

  let account = null;
  if (accountId) {
    account = accounts.find((acc) => String(acc.id) === String(accountId));
  } else if (accounts.length > 0) {
    account = accounts[0];
  }
  return account?.username ? `@${account.username}` : (account?.name || provider);
}

export default function CalendarView({
  posts,
  connectedAccounts,
  onRefresh,
  onCancel,
  onAddPost,
}) {
  const { confirm, alert } = useDialog();
  const calendarRef = useRef(null);

  const [isMobile, setIsMobile] = useState(false);
  const [activeMobileDate, setActiveMobileDate] = useState(() => new Date());
  const [currentDate, setCurrentDate] = useState(new Date());

  const [slideDirection, setSlideDirection] = useState(1);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Persistence view modes (Month vs Week)
  const [calendarMode, setCalendarMode] = useState(() => {
    return localStorage.getItem("quickpost_calendar_mode") || "month";
  });

  const [expandedDates, setExpandedDates] = useState({});
  const [dragOverDate, setDragOverDate] = useState(null);

  // Event interaction states
  const [detailEvent, setDetailEvent] = useState(null);
  const [editingPost, setEditingPost] = useState(null);

  // Edit schedule form states
  const [editCaption, setEditCaption] = useState("");
  const [editTime, setEditTime] = useState("");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Toggle view modes
  const handleModeChange = (mode) => {
    setCalendarMode(mode);
    localStorage.setItem("quickpost_calendar_mode", mode);
  };

  // Navigations
  const handlePrev = () => {
    setSlideDirection(-1);
    if (calendarMode === "week") {
      setCurrentDate((prev) => {
        const next = new Date(prev);
        next.setDate(prev.getDate() - 7);
        return next;
      });
    } else {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    }
  };

  const handleNext = () => {
    setSlideDirection(1);
    if (calendarMode === "week") {
      setCurrentDate((prev) => {
        const next = new Date(prev);
        next.setDate(prev.getDate() + 7);
        return next;
      });
    } else {
      setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };



  // Group posts by local date string YYYY-MM-DD
  const postsByDate = useMemo(() => {
    const map = {};
    posts.forEach((post) => {
      if (!post.scheduled_for) return;
      const localDate = getLocalDateString(post.scheduled_for);
      if (!map[localDate]) map[localDate] = [];
      map[localDate].push(post);
    });
    Object.keys(map).forEach((dateStr) => {
      map[dateStr].sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for));
    });
    return map;
  }, [posts]);

  // Mobile picker week days generator
  const mobileWeekDays = useMemo(() => {
    const start = new Date(currentDate);
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // Grid dates generator (Handles Month and Week modes)
  const gridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (calendarMode === "week") {
      const days = [];
      const startOfWeek = new Date(currentDate);
      const dayIndex = startOfWeek.getDay(); // 0 for Sunday
      startOfWeek.setDate(startOfWeek.getDate() - dayIndex);

      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        days.push({
          date: d,
          isCurrentMonth: d.getMonth() === month,
        });
      }
      return days;
    }

    // Month Grid Calculation
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0);

    const startDayOfWeek = startOfMonth.getDay();
    const daysInMonth = endOfMonth.getDate();

    const prevMonthEnd = new Date(year, month, 0);
    const daysInPrevMonth = prevMonthEnd.getDate();

    const days = [];

    // Prev month padding
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, daysInPrevMonth - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month padding
    const totalCells = days.length;
    const remainingCells = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate, calendarMode]);

  // Headers formatting
  const monthName = currentDate.toLocaleString(undefined, { month: "long" });
  const currentYear = currentDate.getFullYear();
  const todayStr = getLocalDateString(new Date());

  const headerLabel = useMemo(() => {
    if (calendarMode === "week" && gridDays.length === 7) {
      const first = gridDays[0].date;
      const last = gridDays[6].date;

      const firstMonth = first.toLocaleString(undefined, { month: "short" });
      const lastMonth = last.toLocaleString(undefined, { month: "short" });

      if (first.getFullYear() !== last.getFullYear()) {
        return `${firstMonth} ${first.getDate()}, ${first.getFullYear()} – ${lastMonth} ${last.getDate()}, ${last.getFullYear()}`;
      }
      if (first.getMonth() !== last.getMonth()) {
        return `${firstMonth} ${first.getDate()} – ${lastMonth} ${last.getDate()}, ${currentYear}`;
      }
      return `${firstMonth} ${first.getDate()} – ${last.getDate()}, ${currentYear}`;
    }
    return `${monthName} ${currentYear}`;
  }, [currentDate, calendarMode, gridDays, monthName, currentYear]);

  // Drag & Drop
  const handleDragStart = (e, post) => {
    e.dataTransfer.setData("text/plain", post.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (e, dateStr) => {
    e.preventDefault();
    setDragOverDate(dateStr);
  };

  const handleDrop = async (e, targetDate) => {
    e.preventDefault();
    setDragOverDate(null);
    const postId = e.dataTransfer.getData("text/plain");
    const targetPost = posts.find((p) => p.id === postId);
    if (!targetPost) return;

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    if (targetDate < todayMidnight) {
      toast.error("Cannot reschedule posts to a past date", { id: "past-drop" });
      return;
    }

    const originalTime = new Date(targetPost.scheduled_for);
    const newScheduledTime = new Date(targetDate);
    newScheduledTime.setHours(
      originalTime.getHours(),
      originalTime.getMinutes(),
      originalTime.getSeconds(),
      originalTime.getMilliseconds()
    );

    if (newScheduledTime < new Date(Date.now() + 2 * 60 * 1000)) {
      toast.error("Cannot reschedule post to less than 2 minutes from now", { id: "time-drop" });
      return;
    }

    const oldScheduledFor = targetPost.scheduled_for;

    // Optimistic UI Update
    targetPost.scheduled_for = newScheduledTime.toISOString();
    onRefresh(true);

    try {
      await apiClient.patch(`/api/broadcasts/${postId}`, {
        scheduledFor: newScheduledTime.toISOString(),
        userTimezone: tz,
      });
      toast.success("Post rescheduled successfully");
      onRefresh(); // Re-trigger full sync refresh after backend confirms
    } catch (err) {
      targetPost.scheduled_for = oldScheduledFor;
      onRefresh(true);
      toast.error(err.response?.data?.error || "Failed to reschedule post");
    }
  };

  const toggleExpandDate = (dateStr, e) => {
    e.stopPropagation();
    setExpandedDates((prev) => ({
      ...prev,
      [dateStr]: !prev[dateStr],
    }));
  };

  // Edit / Action handlers
  const handleOpenEdit = (post) => {
    setEditingPost(post);
    setEditCaption(post.caption || "");
    setEditTime(post.scheduled_for ? new Date(post.scheduled_for).toISOString().slice(0, 16) : "");
    setDetailEvent(null);
  };

  const handleCloseEdit = () => {
    setEditingPost(null);
    setEditCaption("");
    setEditTime("");
  };

  const handleSaveEdit = async () => {
    if (!editingPost || !editTime) return;
    setSaving(true);
    try {
      await apiClient.patch(`/api/broadcasts/${editingPost.id}`, {
        caption: editCaption,
        scheduledFor: new Date(editTime).toISOString(),
        userTimezone: tz,
      });
      handleCloseEdit();
      onRefresh();
    } catch (err) {
      alert("Update failed", err.response?.data?.error || "Failed to update schedule.", { intent: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPost = async () => {
    const postToCancel = editingPost || detailEvent;
    if (!postToCancel) return;

    const confirmed = await confirm(
      "Cancel scheduled post?",
      "This post will be cancelled and removed from the active queue. You can review it in history later.",
      {
        intent: "danger",
        confirmText: "Cancel Post",
        cancelText: "Keep Scheduled",
      }
    );
    if (!confirmed) return;

    setCancelling(true);
    try {
      await onCancel(postToCancel.id);
      handleCloseEdit();
      setDetailEvent(null);
    } catch (err) {
      alert("Action failed", "Failed to cancel post. Please try again.", { intent: "danger" });
    } finally {
      setCancelling(false);
    }
  };

  const handleDuplicate = (post) => {
    setDetailEvent(null);
    onAddPost(new Date(post.scheduled_for), {
      caption: post.caption,
      mediaUrls: post.media_urls || [],
    });
  };

  // Card subcomponent to maintain clean hierarchy
  const RenderEventCard = ({ post, isCompact = false }) => {
    const channel = post.selected_channels?.[0];
    const accent = getPlatformAccent(channel);
    const postTime = new Date(post.scheduled_for).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const hasMedia = !!(post.media_url || post.thumbnail_url);
    const avatar = getAccountPicture(channel, connectedAccounts);
    const accountName = getAccountName(channel, connectedAccounts);

    return (
      <motion.div
        key={post.id}
        draggable={post.status !== "sent" ? "true" : "false"}
        onDragStart={(e) => {
          if (post.status === "sent") {
            e.preventDefault();
            return;
          }
          handleDragStart(e, post);
        }}
        onClick={(e) => {
          e.stopPropagation();
          setDetailEvent(post);
        }}
        whileHover={{ y: -1, scale: 1.01 }}
        className={`p-2 rounded-xl border text-left select-none shadow-sm transition-all flex flex-col gap-1.5 hover:shadow-md ${post.status === "sent" ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
          } ${calendarMode === "week" ? "min-h-[96px]" : ""
          } ${accent.bg} ${accent.border}`}
      >
        {/* Top platform/account info bar */}
        <div className="flex items-center justify-between gap-1.5 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0">{getPlatformIcon(channel)}</span>
            <span className={`text-[10px] font-extrabold truncate shrink-0 max-w-[80px] sm:max-w-none ${accent.text}`}>
              {accountName || channel?.split(":")[0]}
            </span>
          </div>
          {avatar && (
            <img
              src={avatar}
              alt="avatar"
              className="w-4 h-4 rounded-full border border-white shrink-0 object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.05)]"
            />
          )}
        </div>

        {/* Main card description */}
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-extrabold text-gray-500 leading-none">
              {postTime}
            </span>
            {hasMedia && <span className="text-[10px] leading-none shrink-0" title="Media post">📷</span>}
          </div>
          <span className={`text-[11px] font-semibold text-gray-700 leading-tight mt-1 ${calendarMode === "week" ? "line-clamp-3" : "truncate"
            }`}>
            {post.caption || "No caption"}
          </span>
        </div>
      </motion.div>
    );
  };

  return (
    <div
      ref={calendarRef}
      className="bg-white rounded-2xl border border-[#ebe7e1] overflow-hidden shadow-sm flex flex-col focus:outline-none"
    >

      {/* ─── Calendar Navigation Header ─────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-[#ebe7e1] px-6 py-4 gap-4 bg-white z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-[#ebe7e1] rounded-lg overflow-hidden bg-white">
            <button
              onClick={handlePrev}
              className="p-2 text-gray-500 hover:bg-gray-50 transition-colors border-r border-[#ebe7e1]"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={handleNext}
              className="p-2 text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <h2 className="text-sm font-extrabold text-gray-900 leading-none tracking-tight">
            {headerLabel}
          </h2>
          <button
            onClick={handleToday}
            className="px-3 py-1.5 border border-[#ebe7e1] text-xs font-semibold text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Today
          </button>
        </div>

        {/* View Mode Segmented Controls */}
        <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 self-start sm:self-auto shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]">
          <button
            onClick={() => handleModeChange("month")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${calendarMode === "month"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
              }`}
          >
            Month
          </button>
          <button
            onClick={() => handleModeChange("week")}
            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${calendarMode === "week"
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-800"
              }`}
          >
            Week
          </button>
        </div>
      </div>

      {isMobile ? (
        <div className="flex flex-col bg-[#FAFaf9]/20">
          {/* Mobile horizontal week picker */}
          <div className="grid grid-cols-7 gap-1 border-b border-[#ebe7e1] p-3 bg-[#FAFaf9]/75 shrink-0">
            {mobileWeekDays.map((d) => {
              const dateKey = getLocalDateString(d);
              const isSelected = dateKey === getLocalDateString(activeMobileDate);
              const dayName = d.toLocaleDateString(undefined, { weekday: "narrow" });
              const dateNum = d.getDate();
              const dayPosts = postsByDate[dateKey] || [];
              const hasPosts = dayPosts.length > 0;

              return (
                <button
                  key={d.toISOString()}
                  onClick={() => setActiveMobileDate(d)}
                  className={`flex flex-col items-center py-2 rounded-xl transition-all relative ${isSelected
                    ? "bg-[#111111] text-white shadow-sm font-extrabold"
                    : "text-gray-600 hover:bg-gray-50/50 active:bg-gray-100/50"
                    }`}
                >
                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-60">
                    {dayName}
                  </span>
                  <span className="text-sm font-extrabold mt-1">
                    {dateNum}
                  </span>
                  {hasPosts && !isSelected && (
                    <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-blue-500" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Mobile scheduled posts list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[360px] bg-white">
            {postsByDate[getLocalDateString(activeMobileDate)]?.length > 0 ? (
              postsByDate[getLocalDateString(activeMobileDate)].map((post) => {
                const channel = post.selected_channels?.[0];
                const accent = getPlatformAccent(channel);
                const postTime = new Date(post.scheduled_for).toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                });
                const badge = STATUS_BADGES[post.status] || { label: post.status, color: "bg-gray-100 text-gray-700 border-gray-200" };

                return (
                  <div
                    key={post.id}
                    onClick={() => setDetailEvent(post)}
                    className={`flex items-center gap-4 p-3.5 bg-white border border-[#ebe7e1] rounded-2xl active:scale-[0.98] transition-all cursor-pointer shadow-sm relative ${accent.borderLeft}`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${accent.bg} ${accent.text}`}>
                      {getPlatformIcon(channel)}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-extrabold text-gray-400">
                          {postTime}
                        </span>
                        <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-gray-800 truncate mt-1">
                        {post.caption || "No caption"}
                      </p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-[#ebe7e1] rounded-2xl bg-[#FAFaf9]/30">
                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mb-3">
                  <Calendar className="w-5 h-5 text-gray-300" />
                </div>
                <p className="text-xs font-bold text-gray-700">No posts scheduled</p>
                <p className="text-[10px] text-gray-400 mt-1 max-w-[200px]">
                  Keep your pipeline active by scheduling a post for this day.
                </p>
                <button
                  onClick={() => onAddPost(activeMobileDate)}
                  className="mt-4 px-4 py-2 bg-[#111111] hover:bg-gray-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all"
                >
                  + Schedule Post
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="overflow-hidden relative w-full flex-1 min-h-[520px]">
          <AnimatePresence initial={false} custom={slideDirection} mode="wait">
            <motion.div
              key={currentDate.toISOString() + calendarMode}
              custom={slideDirection}
              variants={{
                enter: (dir) => ({
                  x: dir > 0 ? "15%" : "-15%",
                  opacity: 0,
                }),
                center: {
                  x: 0,
                  opacity: 1,
                },
                exit: (dir) => ({
                  x: dir > 0 ? "-15%" : "15%",
                  opacity: 0,
                }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "tween", ease: "easeInOut", duration: 0.24 }}
              className="w-full h-full flex flex-col"
            >
              {/* ─── Weekday labels ─────────── */}
              <div className="grid grid-cols-7 border-b border-[#ebe7e1] bg-gray-50/50">
                {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
                  <div
                    key={day}
                    className="py-1.5 text-center text-[10px] font-extrabold text-gray-400 uppercase tracking-wider truncate px-1"
                  >
                    {calendarMode === "week" ? day : day.slice(0, 3)}
                  </div>
                ))}
              </div>

              {/* ─── Grid Cells ─────────── */}
              <div className={`grid grid-cols-7 bg-white border-b border-r border-[#ebe7e1]/60 ${calendarMode === "week" ? "grid-rows-1" : "grid-rows-5 auto-rows-fr"
                }`}>
                {gridDays.map(({ date, isCurrentMonth }) => {
                  const dateStr = getLocalDateString(date);
                  const isToday = dateStr === todayStr;
                  const dayPosts = postsByDate[dateStr] || [];
                  const isExpanded = !!expandedDates[dateStr];

                  // Limits display items to at most 1 in month view for super-compact single-screen fit. Week view displays all.
                  const visiblePosts = (calendarMode === "week") ? dayPosts : dayPosts.slice(0, 1);
                  const hasMore = calendarMode === "month" && dayPosts.length > 1;
                  const moreCount = dayPosts.length - 1;

                  const isOver = dateStr === dragOverDate;

                  // Soft pastel contrasting backgrounds:
                  // Soothing pale slate blue for active days containing posts vs off-white for empty days
                  const cellBackground = isCurrentMonth
                    ? (dayPosts.length > 0 ? "bg-[#f5f3ff] hover:bg-[#ede9fe]/70" : "bg-white hover:bg-gray-50/40")
                    : "bg-[#fafafa]/40 text-gray-300/60";

                  return (
                    <div
                      key={dateStr}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnter={(e) => handleDragEnter(e, dateStr)}
                      onDrop={(e) => handleDrop(e, date)}
                      onClick={() => onAddPost(date)}
                      className={`p-2 flex flex-col justify-between group transition-all relative border-t border-l border-[#ebe7e1]/60 ${calendarMode === "week" ? "min-h-[420px] h-full" : "min-h-[110px] sm:min-h-[120px]"
                        } ${cellBackground} ${isOver ? "bg-[#eff6ff] ring-2 ring-[#bfdbfe]/50 border-blue-400 border-dashed z-10" : ""
                        }`}
                    >
                      {/* Cell Header (Date number) */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[11px] font-extrabold w-5 h-5 flex items-center justify-center rounded-full ${isToday
                            ? "bg-green-500 text-white shadow-sm shadow-green-200"
                            : isCurrentMonth
                              ? "text-gray-900"
                              : "text-gray-300"
                            }`}
                        >
                          {date.getDate()}
                        </span>

                        {/* Add Post Plus button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddPost(date);
                          }}
                          className="p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition border border-transparent hover:border-gray-200"
                        >
                          <Plus size={12} />
                        </button>
                      </div>

                      {/* Event Stack */}
                      <div className="flex-1 flex flex-col gap-2 overflow-hidden justify-start mb-2">
                        {visiblePosts.map((post) => (
                          <RenderEventCard key={post.id} post={post} isCompact={calendarMode === "month"} />
                        ))}
                      </div>

                      {/* Expand (+x more) Triggers */}
                      <div className="h-4 shrink-0 flex items-center justify-start">
                        {hasMore && (
                          <button
                            onClick={(e) => toggleExpandDate(dateStr, e)}
                            className="px-2 py-0.5 rounded-full bg-black/5 hover:bg-black/10 border border-black/5 text-[9px] font-extrabold text-gray-600 transition uppercase tracking-wider"
                          >
                            +{moreCount} more
                          </button>
                        )}
                      </div>

                      {/* Floating Expanded Overlay List */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 5 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 5 }}
                            onClick={(e) => e.stopPropagation()}
                            className={`absolute ${date.getDay() === 0
                              ? "left-1"
                              : date.getDay() === 6
                                ? "right-1"
                                : "left-1/2 -translate-x-1/2"
                              } -top-6 w-[260px] z-[45] bg-white shadow-2xl border border-gray-200/90 rounded-2xl p-4 flex flex-col gap-3 max-h-[300px] overflow-y-auto cursor-default select-none [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:bg-gray-200 hover:[&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent`}
                          >
                            <div className="flex items-center justify-between border-b border-gray-100 pb-2.5 shrink-0">
                              <span className="text-xs font-extrabold text-gray-900 flex items-center gap-1.5 uppercase tracking-wider">
                                <Calendar className="w-3.5 h-3.5 text-gray-500" />
                                {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                              </span>
                              <button
                                onClick={(e) => toggleExpandDate(dateStr, e)}
                                className="p-1 rounded-full hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition"
                              >
                                <X size={12} className="stroke-[2.5]" />
                              </button>
                            </div>
                            <div className="flex-1 flex flex-col gap-2.5">
                              {dayPosts.map((post) => (
                                <RenderEventCard key={post.id} post={post} isCompact={false} />
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* ─── Rich Event Details Popover Panel ─────────── */}
      <AnimatePresence>
        {detailEvent && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailEvent(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            {/* Popover Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              className="relative w-full max-w-[460px] bg-white rounded-2xl shadow-2xl overflow-hidden border border-black/5 z-10 text-left flex flex-col"
            >
              {/* Header profile block */}
              <div className="p-6 border-b border-[#ebe7e1] flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {getAccountPicture(detailEvent.selected_channels?.[0], connectedAccounts) ? (
                    <img
                      src={getAccountPicture(detailEvent.selected_channels?.[0], connectedAccounts)}
                      alt="profile"
                      className="w-12 h-12 rounded-xl object-cover border border-[#ebe7e1]"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center border border-[#ebe7e1]">
                      <Calendar className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-gray-900 leading-tight truncate">
                      {getAccountName(detailEvent.selected_channels?.[0], connectedAccounts) || "Connected Account"}
                    </h4>
                    <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5 font-semibold">
                      {getPlatformIcon(detailEvent.selected_channels?.[0])}
                      {detailEvent.selected_channels?.[0]?.split(":")[0]}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setDetailEvent(null)}
                  className="p-1 rounded-full border border-gray-100 text-gray-400 hover:text-gray-800 transition hover:bg-gray-50"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Details Body */}
              <div className="p-6 space-y-4 max-h-[360px] overflow-y-auto custom-scrollbar">
                {/* Time details */}
                <div className="flex items-center gap-3 text-xs font-semibold text-gray-600 bg-gray-50/70 p-3 rounded-xl border border-gray-150">
                  <Clock className="w-4 h-4 text-blue-500" />
                  <div>
                    <span className="block font-extrabold text-gray-800">
                      {new Date(detailEvent.scheduled_for).toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-gray-400 font-semibold block mt-0.5">
                      {new Date(detailEvent.scheduled_for).toLocaleTimeString(undefined, {
                        hour: "numeric",
                        minute: "2-digit",
                      })} ({tz})
                    </span>
                  </div>
                </div>

                {/* Status indicator */}
                {STATUS_BADGES[detailEvent.status] && (
                  <div>
                    <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1 block">
                      Status
                    </label>
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${STATUS_BADGES[detailEvent.status].color
                      }`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                      {STATUS_BADGES[detailEvent.status].label}
                    </span>
                  </div>
                )}

                {/* Caption Block */}
                <div>
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1 block">
                    Caption
                  </label>
                  <p className="text-xs font-semibold text-gray-700 bg-gray-50/50 p-3 rounded-xl border border-gray-100 leading-relaxed whitespace-pre-wrap">
                    {detailEvent.caption || <span className="text-gray-400 italic">No caption provided</span>}
                  </p>
                </div>
              </div>

              {/* Action buttons footer */}
              <div className="p-4 border-t border-[#ebe7e1] bg-gray-50/60 flex items-center justify-between gap-2">
                {detailEvent.status !== "sent" ? (
                  <button
                    onClick={() => handleOpenEdit(detailEvent)}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-gray-600 border border-[#ebe7e1] bg-white hover:bg-gray-50 rounded-xl transition shadow-sm"
                  >
                    <Edit3 size={13} /> Edit
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDuplicate(detailEvent)}
                    className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-gray-600 border border-[#ebe7e1] bg-white hover:bg-gray-50 rounded-xl transition shadow-sm"
                  >
                    <Copy size={13} /> Duplicate
                  </button>
                  {detailEvent.status !== "sent" && (
                    <button
                      onClick={() => {
                        setEditingPost(detailEvent);
                        handleCancelPost();
                      }}
                      className="flex items-center gap-1 px-3.5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-sm"
                    >
                      <Trash2 size={13} /> Cancel Post
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Standard Edit Modal ─────────── */}
      <AnimatePresence>
        {editingPost && (
          <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseEdit}
              className="absolute inset-0 bg-black/35 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: 4 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-[480px] bg-white rounded-2xl border border-black/5 shadow-2xl p-6 overflow-hidden z-10 text-left"
            >
              <button
                onClick={handleCloseEdit}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-gray-100 hover:bg-gray-50 text-gray-400 hover:text-gray-800 transition"
              >
                <X size={14} />
              </button>

              <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" /> Edit Scheduled Post
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-2 block">
                    Target Platforms
                  </label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {editingPost.selected_channels?.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-50 border border-gray-200 text-gray-600"
                      >
                        {getPlatformIcon(id)}
                        <span className="text-[11px] font-semibold text-gray-600">
                          {id.split(":")[0]}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5 block">
                    Caption
                  </label>
                  <textarea
                    value={editCaption}
                    onChange={(e) => setEditCaption(e.target.value)}
                    rows={4}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none resize-none placeholder-gray-400"
                    placeholder="Write details..."
                  />
                </div>

                <div>
                  <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5 block">
                    Scheduled Time ({tz})
                  </label>
                  <input
                    type="datetime-local"
                    value={editTime}
                    onChange={(e) => setEditTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                  />
                </div>

                <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-6">
                  <button
                    onClick={handleCancelPost}
                    disabled={cancelling}
                    className="flex items-center gap-1.5 px-4 py-2 hover:bg-red-50 text-red-600 text-xs font-bold rounded-xl transition disabled:opacity-50"
                  >
                    {cancelling ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5" />
                    )}
                    Delete Post
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCloseEdit}
                      className="px-4 py-2 text-gray-500 hover:text-gray-700 text-xs font-semibold rounded-xl transition"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={saving || !editTime}
                      className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-100 transition disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      Save Changes
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
