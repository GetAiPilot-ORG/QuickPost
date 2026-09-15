import React, { useEffect, useMemo, useState, useRef } from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  ExternalLink,
  Filter,
  Globe2,
  Info,
  Link2,
  Lock,
  MessageSquare,
  Pencil,
  RefreshCw,
  Search,
  ShieldCheck,
  ThumbsUp,
} from "lucide-react";
import apiClient from "../utils/apiClient";

const tabs = ["Dashboard", "Videos", "Shorts", "Posts", "Playlists", "Analytics", "Access"];
const YOUTUBE_ICON = "/icons/youtube-color-icon.svg";
const ACTIVE_ACCOUNT_KEY = "quickpost_youtube_active_account";
const WELCOME_KEY = "quickpost_youtube_studio_welcome_seen";
const stickers = {
  Posts: "/icons/stressed-man-looking-at-a-system-error-warning-message-vector-removebg-preview.png",
  Playlists: "https://illustrations.popsy.co/amber/graphic-design.svg",
  Shorts: "https://illustrations.popsy.co/amber/video-call.svg",
  Videos: "https://illustrations.popsy.co/amber/web-design.svg",
};

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toLocaleString() : "0";
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function parseDuration(iso = "") {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const [, h = "0", m = "0", s = "0"] = match;
  const parts = Number(h) > 0 ? [h, m.padStart(2, "0"), s.padStart(2, "0")] : [m || "0", s.padStart(2, "0")];
  return parts.join(":");
}

function durationSeconds(iso = "") {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function statusCopy(status) {
  if (status === "allowed") return { label: "Ready", text: "All upload checks passed.", color: "#15803d", bg: "#ecfdf5", icon: CheckCircle2 };
  if (status === "eligible") return { label: "Action needed", text: "Phone verification is required to unlock every upload feature.", color: "#b45309", bg: "#fffbeb", icon: AlertTriangle };
  if (status === "disallowed") return { label: "Blocked", text: "Review YouTube Studio feature eligibility before publishing long videos.", color: "#b91c1c", bg: "#fff1f2", icon: AlertTriangle };
  return { label: "Unknown", text: "Refresh or reconnect to check upload eligibility.", color: "#b45309", bg: "#fffbeb", icon: AlertTriangle };
}

function visibilityIcon(status) {
  if (status === "private") return <Lock size={18} />;
  if (status === "unlisted") return <Link2 size={18} />;
  return <Globe2 size={18} />;
}

const tableHeaders = {
  Videos: ["Video", "Notices", "Visibility", "Date", "Views", "Comments"],
  Shorts: ["Short", "Notices", "Visibility", "Date", "Views", "Comments"],
  Posts: ["Post", "Type", "Visibility", "Restrictions", "Date", "Comments", "Likes"],
  Playlists: ["Playlist", "Type", "Visibility", "Last updated", "Video count", "Views"],
};

function EmptyState({ type }) {
  const copy = {
    Posts: ["Post sync is not supported by YouTube.", null],
    Playlists: ["Create your playlist, then add existing content or upload new videos.", "New playlist"],
    Shorts: ["No shorts found for this channel.", "Upload videos"],
  }[type] || ["No content found for this channel.", "Upload videos"];

  return (
    <div style={{ minHeight: 360, display: "grid", placeItems: "center", color: "var(--slate)" }}>
      <div className={type === 'Posts' ? "text-center max-w-[360px] md:max-w-[700px] w-full" : "text-center max-w-[360px] w-full"}>
        <div className={type === 'Posts' ? "w-[260px] h-[220px] md:w-[600px] md:h-[480px] mx-auto mb-[18px] grid place-items-center" : "w-[170px] h-[138px] mx-auto mb-[18px] grid place-items-center"}>
          <img src={stickers[type] || stickers.Videos} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", mixBlendMode: "multiply" }} />
        </div>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45 }}>{copy[0]}</p>
        {copy[1] && (
          <a href="/dashboard/compose" style={{ marginTop: 18, display: "inline-flex", height: 38, alignItems: "center", borderRadius: 999, padding: "0 18px", background: "var(--ink)", color: "var(--canvas)", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
            {copy[1]}
          </a>
        )}
      </div>
    </div>
  );
}

function TableSkeletonRows() {
  return [1, 2, 3].map((row) => (
    <tr key={row} style={{ borderBottom: "1px solid rgba(20,20,19,0.08)" }}>
      <td style={{ padding: "12px 10px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "120px minmax(240px, 1fr)", gap: 16, alignItems: "center" }}>
          <div className="skeleton-shimmer" style={{ width: 120, height: 68, borderRadius: 7 }} />
          <div>
            <div className="skeleton-shimmer" style={{ width: "58%", height: 14, borderRadius: 999, marginBottom: 10 }} />
            <div className="skeleton-shimmer" style={{ width: "76%", height: 12, borderRadius: 999 }} />
          </div>
        </div>
      </td>
      <td style={{ padding: "12px 10px" }}><div className="skeleton-shimmer" style={{ width: 12, height: 12, borderRadius: 999 }} /></td>
      <td style={{ padding: "12px 10px" }}><div className="skeleton-shimmer" style={{ width: 86, height: 14, borderRadius: 999 }} /></td>
      <td style={{ padding: "12px 10px" }}><div className="skeleton-shimmer" style={{ width: 92, height: 14, borderRadius: 999 }} /></td>
      <td style={{ padding: "12px 10px" }}><div className="skeleton-shimmer" style={{ width: 34, height: 14, borderRadius: 999, marginLeft: "auto" }} /></td>
      <td style={{ padding: "12px 18px 12px 10px" }}><div className="skeleton-shimmer" style={{ width: 34, height: 14, borderRadius: 999, marginLeft: "auto" }} /></td>
    </tr>
  ));
}

function YouTubePostsUnavailable() {
  return (
    <div style={{ minHeight: 380, display: "grid", placeItems: "center", color: "var(--slate)", background: "var(--white)", borderTop: "1px solid rgba(20,20,19,0.08)" }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ width: 150, height: 118, margin: "0 auto 16px", display: "grid", placeItems: "center", overflow: "hidden" }}>
          <img src={stickers.Posts} alt="" style={{ width: 150, height: 118, objectFit: "contain", mixBlendMode: "multiply", transform: "translateX(12px)" }} />
        </div>
        <h3 style={{ margin: 0, color: "var(--ink)", fontSize: 20, fontWeight: 850 }}>Posts sync is not supported by YouTube</h3>
        <p style={{ margin: "10px 0 0", fontSize: 15, lineHeight: 1.5 }}>
          YouTube only exposes videos, shorts, playlists and channel stats through the official API. Your posted videos will appear in Videos or Shorts.
        </p>
      </div>
    </div>
  );
}

function CustomSelect({ value, options, onChange, renderValue, style, dropdownStyle }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef();

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div style={{ position: "relative", ...style }} ref={containerRef}>
      <button
        onClick={(e) => { e.preventDefault(); setOpen(!open); }}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", cursor: "pointer", color: "inherit", fontSize: "inherit", padding: 0, fontWeight: "inherit", outline: "none" }}
      >
        {renderValue ? renderValue(value) : value}
        <ChevronDown size={14} style={{ color: "var(--slate)" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", zIndex: 50, background: "var(--white)", border: "1px solid rgba(20,20,19,0.12)", borderRadius: 6, boxShadow: "0 10px 24px rgba(20,20,19,0.12)", padding: "4px 0", minWidth: "100%", ...dropdownStyle }}>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={(e) => { e.preventDefault(); onChange(opt.value); setOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: dropdownStyle?.textAlign || "left", padding: "8px 14px", background: value === opt.value ? "var(--canvas-lifted)" : "transparent", border: "none", cursor: "pointer", fontSize: 13, color: "var(--ink)", outline: "none" }}
              onMouseEnter={(e) => e.target.style.background = "var(--canvas-lifted)"}
              onMouseLeave={(e) => e.target.style.background = value === opt.value ? "var(--canvas-lifted)" : "transparent"}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function YouTubeManagerPage() {
  const [accounts, setAccounts] = useState([]);
  const [activeId, setActiveId] = useState(() => localStorage.getItem(ACTIVE_ACCOUNT_KEY));
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [query, setQuery] = useState("");
  const [accountQuery, setAccountQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(() => localStorage.getItem(WELCOME_KEY) !== "1");
  const [updatingVideoId, setUpdatingVideoId] = useState("");
  const [error, setError] = useState("");
  const [errorAction, setErrorAction] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(30);

  const loadAccounts = async () => {
    setLoading(true);
    setError("");
    setErrorAction("");
    try {
      const { data } = await apiClient.get("/api/youtube/accounts");
      const nextAccounts = data.accounts || [];
      setAccounts(nextAccounts);
      setActiveId((current) => nextAccounts.some((account) => String(account.id) === String(current)) ? current : nextAccounts[0]?.id || null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load YouTube accounts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
    const handleBroadcastCompleted = () => {
      loadAccounts();
    };
    window.addEventListener("quickpost_broadcast_completed", handleBroadcastCompleted);
    return () => {
      window.removeEventListener("quickpost_broadcast_completed", handleBroadcastCompleted);
    };
  }, []);

  useEffect(() => {
    if (activeId) localStorage.setItem(ACTIVE_ACCOUNT_KEY, activeId);
  }, [activeId]);

  const active = useMemo(
    () => accounts.find((account) => String(account.id) === String(activeId)) || accounts[0],
    [accounts, activeId],
  );
  const health = active?.youtube;
  const allVideos = active?.videos || [];
  const videos = useMemo(() => {
    const source = activeTab === "Shorts"
      ? allVideos.filter((video) => durationSeconds(video.duration) <= 60)
      : allVideos;
    const normalized = query.trim().toLowerCase();
    if (!normalized) return source;
    return source.filter((video) =>
      `${video.title} ${video.description}`.toLowerCase().includes(normalized)
    );
  }, [allVideos, activeTab, query]);

  const paginatedVideos = useMemo(() => {
    return videos.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [videos, page, rowsPerPage]);

  useEffect(() => {
    setPage(0);
  }, [activeTab, query]);

  const latestVideo = allVideos[0];
  const topVideo = [...allVideos].sort((a, b) => Number(b.views || 0) - Number(a.views || 0))[0];
  const status = statusCopy(health?.capabilities?.longUploadsStatus);
  const StatusIcon = status.icon;
  const requiredActions = health?.requiredActions || active?.requiredActions || [];
  const visibleAccounts = accounts.filter((account) =>
    (account.username || "YouTube channel").toLowerCase().includes(accountQuery.trim().toLowerCase())
  );

  const dismissWelcome = () => {
    localStorage.setItem(WELCOME_KEY, "1");
    setShowWelcome(false);
  };

  const updateVisibility = async (videoId, privacyStatus) => {
    if (!active?.id) return;
    setUpdatingVideoId(videoId);
    setError("");
    setErrorAction("");
    try {
      const { data } = await apiClient.patch(`/api/youtube/videos/${videoId}/visibility`, {
        accountId: active.id,
        privacyStatus,
      });
      const nextStatus = data.privacyStatus || privacyStatus;
      setAccounts((current) => current.map((account) => String(account.id) !== String(active.id) ? account : {
        ...account,
        videos: (account.videos || []).map((video) => video.id === videoId ? { ...video, privacyStatus: nextStatus } : video),
      }));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update video visibility");
      setErrorAction(err.response?.data?.action || "");
    } finally {
      setUpdatingVideoId("");
    }
  };

  const reconnectYouTube = () => {
    const token = localStorage.getItem("quickpost_token");
    if (!token) {
      setError("Please log in again before reconnecting YouTube.");
      return;
    }
    window.location.href = `/api/auth/youtube?token=${encodeURIComponent(token)}`;
  };

  const pageBackground = "var(--canvas)";
  const panel = {
    background: "var(--white)",
    border: "1px solid rgba(20,20,19,0.12)",
    borderRadius: 8,
  };

  return (
    <div style={{ minHeight: "100vh", background: pageBackground, color: "var(--ink)", padding: "28px clamp(16px, 3vw, 36px) 44px" }}>
      {showWelcome && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(20,20,19,0.72)", backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", display: "grid", placeItems: "center", padding: 20 }}>
          <section style={{ width: "min(704px, 100%)", borderRadius: 22, background: "var(--white)", padding: "34px 34px 30px", textAlign: "center", boxShadow: "0 30px 80px rgba(20,20,19,0.32)" }}>
            <div style={{ width: "100%", height: 220, display: "grid", placeItems: "center", marginBottom: 18, overflow: "hidden" }}>
              <img src="https://illustrations.popsy.co/amber/video-call.svg" alt="" style={{ width: 330, maxWidth: "84%", maxHeight: 210, objectFit: "contain", mixBlendMode: "multiply" }} />
            </div>
            <h2 style={{ margin: "0 0 10px", fontSize: 30, lineHeight: 1.1, fontWeight: 900 }}>Welcome to your YouTube workspace</h2>
            <p style={{ margin: "0 auto", maxWidth: 520, color: "var(--slate)", fontSize: 16, lineHeight: 1.45 }}>Manage connected channels, videos, shorts, analytics, publishing access and visibility from one workspace.</p>
            <button onClick={dismissWelcome} style={{ marginTop: 22, height: 40, border: 0, borderRadius: 999, background: "linear-gradient(135deg, var(--arc) 0%, var(--color-arc-400) 100%)", color: "#fff", padding: "0 22px", fontWeight: 850, cursor: "pointer" }}>Continue</button>
          </section>
        </div>
      )}
      <header style={{ display: "flex", justifyContent: "space-between", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ width: 42, height: 42, borderRadius: 10, background: "var(--white)", display: "grid", placeItems: "center", border: "1px solid rgba(20,20,19,0.1)", boxShadow: "0 10px 26px rgba(20,20,19,0.08)" }}>
              <img src={YOUTUBE_ICON} alt="" style={{ width: 26, height: 26, objectFit: "contain" }} />
            </span>
            <span>
              <strong style={{ display: "block", fontSize: 13 }}>YouTube Manager</strong>
              <span style={{ color: "var(--slate)", fontSize: 12 }}>Multi-account workspace</span>
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(30px, 4vw, 44px)", lineHeight: 1, letterSpacing: 0, fontWeight: 900 }}>
            {activeTab === "Dashboard" ? "Channel dashboard" : "Channel content"}
          </h1>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <button
              onClick={() => setPickerOpen((open) => !open)}
              style={{ minWidth: 280, width: "100%", maxWidth: 380, height: 56, borderRadius: 8, border: "1px solid rgba(20,20,19,0.12)", background: "var(--white)", padding: "0 12px", display: "flex", alignItems: "center", gap: 11, cursor: "pointer", boxShadow: "0 8px 20px rgba(20,20,19,0.06)", outline: "none" }}
            >
              <img src={active?.profilePicture || YOUTUBE_ICON} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", background: "#f4f4f2", border: "1px solid rgba(20,20,19,0.08)" }} />
              <span style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{active?.username || "Select YouTube account"}</strong>
                <span style={{ color: "var(--slate)", fontSize: 11, fontWeight: 700 }}>{formatNumber(health?.statistics?.subscriberCount)} subscribers</span>
              </span>
              <span style={{ borderRadius: 999, background: status.bg, color: status.color, padding: "5px 9px", fontSize: 11, fontWeight: 850 }}>{status.label}</span>
              <ChevronDown size={16} />
            </button>
            {pickerOpen && (
              <div style={{ position: "absolute", top: 64, left: 0, width: 420, maxWidth: "calc(100vw - 32px)", zIndex: 20, ...panel, padding: 0, overflow: "hidden", boxShadow: "0 22px 54px rgba(20,20,19,0.16)" }}>
                <div style={{ padding: 14, borderBottom: "1px solid rgba(20,20,19,0.08)", background: "var(--white)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                    <div>
                      <strong style={{ display: "block", fontSize: 14 }}>Switch channel</strong>
                      <span style={{ color: "var(--slate)", fontSize: 12 }}>{accounts.length} connected YouTube accounts</span>
                    </div>
                    <span style={{ width: 32, height: 32, borderRadius: 8, background: "var(--canvas-lifted)", display: "grid", placeItems: "center" }}>
                      <img src={YOUTUBE_ICON} alt="" style={{ width: 20, height: 20 }} />
                    </span>
                  </div>
                  <label style={{ height: 38, display: "flex", alignItems: "center", gap: 8, border: "1px solid rgba(20,20,19,0.12)", borderRadius: 8, padding: "0 10px", background: "var(--canvas)" }}>
                    <Search size={15} color="var(--slate)" />
                    <input
                      value={accountQuery}
                      onChange={(event) => setAccountQuery(event.target.value)}
                      placeholder="Search account"
                      style={{ flex: 1, border: 0, outline: "none", background: "transparent", color: "var(--ink)", fontSize: 13 }}
                    />
                  </label>
                </div>
                <div style={{ maxHeight: 390, overflowY: "auto", padding: 8 }}>
                  {visibleAccounts.length === 0 ? (
                    <p style={{ margin: 0, padding: 14, color: "var(--slate)", fontSize: 13 }}>No account matched.</p>
                  ) : visibleAccounts.map((account) => {
                    const accountStatus = statusCopy(account.youtube?.capabilities?.longUploadsStatus);
                    const selected = account.id === active?.id;
                    return (
                      <div
                        key={account.id}
                        style={{ width: "100%", border: selected ? "1px solid rgba(20,20,19,0.18)" : "1px solid transparent", borderRadius: 8, background: selected ? "var(--canvas-lifted)" : "transparent", padding: "9px 10px", marginBottom: 2 }}
                      >
                        <button
                          onClick={() => { setActiveId(account.id); setPickerOpen(false); setAccountQuery(""); }}
                          style={{ width: "100%", display: "grid", gridTemplateColumns: "42px minmax(0,1fr) auto 18px", alignItems: "center", gap: 10, cursor: "pointer", textAlign: "left", outline: "none", background: "transparent", border: "none", padding: 0 }}
                        >
                          <img src={account.profilePicture || YOUTUBE_ICON} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", background: "#f4f4f2", border: "1px solid rgba(20,20,19,0.08)" }} />
                          <span style={{ minWidth: 0 }}>
                            <strong style={{ display: "block", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{account.username || "YouTube channel"}</strong>
                            <span style={{ color: "var(--slate)", fontSize: 11, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                              {formatNumber(account.youtube?.statistics?.subscriberCount)} subscribers · {formatNumber(account.youtube?.statistics?.videoCount)} videos · {formatNumber(account.youtube?.statistics?.viewCount)} views
                            </span>
                          </span>
                          <span style={{ borderRadius: 999, background: accountStatus.bg, color: accountStatus.color, padding: "5px 8px", fontSize: 11, fontWeight: 850, whiteSpace: "nowrap" }}>{accountStatus.label}</span>
                          {selected ? <Check size={16} color="var(--ink)" /> : <span />}
                        </button>
                        {accountStatus.label === "Action needed" && (
                          <div style={{ marginTop: 10, marginBottom: 2, padding: "8px 12px", background: accountStatus.bg, borderRadius: 6, fontSize: 12, color: accountStatus.color, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                            <span style={{ lineHeight: 1.4 }}>{accountStatus.text}</span>
                            <a
                              href={accountStatus.text.includes("Phone verification") ? "https://www.youtube.com/verify" : "https://studio.youtube.com"}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: accountStatus.color, fontWeight: 800, textDecoration: "underline", whiteSpace: "nowrap" }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              Fix this
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          <button onClick={loadAccounts} disabled={loading} style={{ height: 58, borderRadius: 10, border: "1px solid rgba(20,20,19,0.14)", background: "var(--white)", color: "var(--ink)", padding: "0 16px", display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 850, cursor: "pointer", outline: "none" }}>
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </header>

      <nav style={{ display: "flex", gap: 34, marginTop: 26, borderBottom: "1px solid rgba(20,20,19,0.12)", overflowX: "auto" }}>
        {tabs.map((tab) => {
          const selected = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: "transparent",
                border: 0,
                borderBottom: selected ? "2px solid var(--ink)" : "2px solid transparent",
                color: selected ? "var(--ink)" : "var(--slate)",
                padding: "0 0 13px",
                fontSize: 14,
                fontWeight: selected ? 700 : 600,
                lineHeight: 1,
                cursor: "pointer",
                whiteSpace: "nowrap",
                outline: "none",
              }}
            >
              {tab}
            </button>
          );
        })}
      </nav>

      {error && (
        <div style={{ marginTop: 16, border: "1px solid rgba(239,68,68,0.28)", background: "#fff1f2", color: "#991b1b", borderRadius: 8, padding: 14, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <span>{error}</span>
          {errorAction === "reconnect_youtube" && (
            <button onClick={reconnectYouTube} style={{ border: 0, borderRadius: 999, background: "linear-gradient(135deg, var(--arc) 0%, var(--color-arc-400) 100%)", color: "#fff", height: 34, padding: "0 14px", fontWeight: 850, cursor: "pointer" }}>Reconnect YouTube</button>
          )}
        </div>
      )}

      {activeTab === "Dashboard" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 395px))", justifyContent: "start", gap: 24, marginTop: 26, alignItems: "start" }}>
          <section style={{ ...panel, padding: 24 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 850 }}>Latest video performance</h2>
            {latestVideo ? (
              <>
                <a href={latestVideo.url} target="_blank" rel="noreferrer" style={{ marginTop: 18, height: 194, borderRadius: 8, overflow: "hidden", display: "block", position: "relative", background: "#111", color: "#fff" }}>
                  {(latestVideo.thumbnail || latestVideo.id) && (
                    <img
                      src={latestVideo.thumbnail || `https://i.ytimg.com/vi/${latestVideo.id}/hqdefault.jpg`}
                      alt={latestVideo.title}
                      onError={(e) => {
                        if (latestVideo.id && !e.target.src.includes('hqdefault.jpg')) {
                          e.target.src = `https://i.ytimg.com/vi/${latestVideo.id}/hqdefault.jpg`;
                        }
                      }}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
                  <strong style={{ position: "absolute", left: 24, bottom: 22, width: "78%", fontSize: 16, lineHeight: 1.2 }}>{latestVideo.title}</strong>
                </a>
                <div style={{ display: "flex", gap: 22, marginTop: 14, color: "var(--slate)", alignItems: "center" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><BarChart3 size={17} /> {formatNumber(latestVideo.views)}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><MessageSquare size={17} /> {formatNumber(latestVideo.comments)}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}><ThumbsUp size={17} /> {formatNumber(latestVideo.likes)}</span>
                </div>
                <div style={{ borderTop: "1px solid rgba(20,20,19,0.12)", marginTop: 18, paddingTop: 18, display: "grid", gap: 12, fontSize: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Views</span><strong>{formatNumber(latestVideo.views)}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Comments</span><strong>{formatNumber(latestVideo.comments)}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Likes</span><strong>{formatNumber(latestVideo.likes)}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between", textTransform: "capitalize" }}><span>Visibility</span><strong>{latestVideo.privacyStatus}</strong></div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>Published</span><strong>{formatDate(latestVideo.publishedAt)}</strong></div>
                </div>
              </>
            ) : <EmptyState type="Videos" />}
          </section>

          <section style={{ ...panel, padding: 24, alignSelf: "start" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 850 }}>Channel analytics</h2>
            <p style={{ margin: "18px 0 0", color: "var(--slate)" }}>Current subscribers</p>
            <strong style={{ display: "block", fontSize: 40, marginTop: 6 }}>{formatNumber(health?.statistics?.subscriberCount)}</strong>
            <div style={{ borderTop: "1px solid rgba(20,20,19,0.12)", marginTop: 28, paddingTop: 18, display: "grid", gap: 14 }}>
              <strong>Summary</strong>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Views</span><span>{formatNumber(health?.statistics?.viewCount)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Videos</span><span>{formatNumber(health?.statistics?.videoCount)}</span></div>
            </div>
            <div style={{ borderTop: "1px solid rgba(20,20,19,0.12)", marginTop: 22, paddingTop: 18 }}>
              <strong>Top content</strong>
              {allVideos.slice(0, 2).map((video) => (
                <div key={video.id} style={{ display: "flex", justifyContent: "space-between", gap: 16, marginTop: 14 }}>
                  <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{video.title}</span>
                  <strong>{formatNumber(video.views)}</strong>
                </div>
              ))}
              <button onClick={() => setActiveTab("Analytics")} style={{ marginTop: 22, border: 0, borderRadius: 999, background: "var(--canvas-lifted)", color: "var(--ink)", height: 38, padding: "0 18px", fontWeight: 800 }}>Go to channel analytics</button>
            </div>
          </section>
        </div>
      )}

      {activeTab === "Analytics" && (
        <section style={{ marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 }}>
          {[
            ["Subscribers", health?.statistics?.subscriberCount],
            ["Total views", health?.statistics?.viewCount],
            ["Videos", health?.statistics?.videoCount],
            ["Top video views", topVideo?.views],
          ].map(([label, value]) => (
            <div key={label} style={{ ...panel, padding: 18 }}>
              <p style={{ margin: 0, color: "var(--slate)", fontSize: 12, fontWeight: 850, textTransform: "uppercase" }}>{label}</p>
              <strong style={{ display: "block", fontSize: 30, marginTop: 10 }}>{formatNumber(value)}</strong>
            </div>
          ))}
        </section>
      )}

      {activeTab === "Access" && (
        <section style={{ ...panel, marginTop: 24, padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 44, height: 44, borderRadius: 8, background: status.bg, color: status.color, display: "grid", placeItems: "center" }}><StatusIcon size={22} /></span>
              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>Publishing access</h2>
                <p style={{ margin: "4px 0 0", color: "var(--slate)" }}>{status.text}</p>
              </div>
            </div>
            {requiredActions[0]?.url && <a href={requiredActions[0].url} target="_blank" rel="noreferrer" style={{ color: "var(--ink)", fontWeight: 850, display: "inline-flex", gap: 8, alignItems: "center" }}>Open YouTube Studio <ExternalLink size={15} /></a>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginTop: 18 }}>
            {[
              ["Long uploads", health?.capabilities?.longUploadsAllowed ? "Allowed" : "Needs action"],
              ["Phone verification", health?.capabilities?.needsPhoneVerification ? "Required" : "OK"],
              ["Made for kids", health?.capabilities?.madeForKids ? "Enabled" : "Not declared"],
            ].map(([label, value]) => (
              <div key={label} style={{ border: "1px solid rgba(20,20,19,0.1)", borderRadius: 8, padding: 14, background: "var(--canvas-lifted)" }}>
                <ShieldCheck size={18} style={{ color: "var(--slate)", marginBottom: 12 }} />
                <strong style={{ display: "block" }}>{label}</strong>
                <span style={{ color: "var(--slate)", fontSize: 13 }}>{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {["Videos", "Shorts", "Posts", "Playlists"].includes(activeTab) && (
        <>
          <section style={{ marginTop: 0, borderBottom: "1px solid rgba(20,20,19,0.12)", background: "var(--white)", minHeight: 52, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "8px 14px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
              <Info size={18} />
              <span style={{ fontSize: 14 }}>The improved Content tab helps you track video performance, eligibility, and notices in one place</span>
              <span style={{ borderRadius: 999, background: status.bg, color: status.color, padding: "5px 10px", fontSize: 12, fontWeight: 900 }}>{status.label}</span>
            </div>
            {requiredActions[0]?.url && <a href={requiredActions[0].url} target="_blank" rel="noreferrer" style={{ height: 34, borderRadius: 999, border: "1px solid rgba(20,20,19,0.12)", color: "var(--ink)", display: "inline-flex", alignItems: "center", gap: 8, padding: "0 14px", fontSize: 13, fontWeight: 850, background: "var(--white)" }}>Check it out <ExternalLink size={14} /></a>}
          </section>

          <section style={{ padding: "14px", display: "flex", alignItems: "center", gap: 24, borderBottom: "1px solid rgba(20,20,19,0.12)", flexWrap: "wrap", background: "var(--canvas)" }}>
            <button style={{ background: "transparent", color: "var(--ink)", border: 0, display: "inline-flex", alignItems: "center", gap: 12, fontWeight: 850, outline: "none" }}>
              <Filter size={20} /> Filter
            </button>
            {(activeTab === "Videos" || activeTab === "Shorts") && (
              <label style={{ minWidth: 260, flex: "1 1 320px", maxWidth: 560, display: "flex", alignItems: "center", gap: 10, color: "var(--slate)" }}>
                <Search size={18} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search channel content" style={{ width: "100%", height: 38, background: "var(--white)", border: "1px solid rgba(20,20,19,0.12)", borderRadius: 8, color: "var(--ink)", outline: "none", fontSize: 14, padding: "0 12px" }} />
              </label>
            )}
          </section>

          {activeTab === "Posts" ? (
            <YouTubePostsUnavailable />
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", minWidth: 1040, borderCollapse: "collapse", background: "var(--white)" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(20,20,19,0.12)", color: "var(--ink)" }}>
                      {(tableHeaders[activeTab] || tableHeaders.Videos).map((header, idx) => (
                        <th key={header} style={{ width: idx === 0 ? "auto" : 120, padding: "16px 10px", textAlign: "left", fontWeight: 500, fontSize: 13, color: "var(--slate)" }}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <TableSkeletonRows />
                    ) : activeTab === "Playlists" || videos.length === 0 ? (
                      <tr><td colSpan={6}><EmptyState type={activeTab} /></td></tr>
                    ) : paginatedVideos.map((video) => (
                      <tr key={video.id} style={{ borderBottom: "1px solid rgba(20,20,19,0.12)", color: "var(--ink)" }}>
                        <td style={{ padding: "10px", verticalAlign: "top" }}>
                          <a href={video.url} target="_blank" rel="noreferrer" style={{ display: "grid", gridTemplateColumns: "120px minmax(240px, 1fr)", gap: 16, color: "var(--ink)", textDecoration: "none" }}>
                            <span style={{ position: "relative", width: 120, height: 68, borderRadius: 7, overflow: "hidden", background: "#111", display: "block" }}>
                              {(video.thumbnail || video.id) && (
                                <img
                                  src={video.thumbnail || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                                  alt=""
                                  onError={(e) => {
                                    if (video.id && !e.target.src.includes('hqdefault.jpg')) {
                                      e.target.src = `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
                                    }
                                  }}
                                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                />
                              )}
                              {video.duration && <span style={{ position: "absolute", right: 5, bottom: 5, background: "rgba(0,0,0,0.85)", color: "#fff", borderRadius: 3, padding: "1px 5px", fontSize: 12, fontWeight: 500 }}>{parseDuration(video.duration)}</span>}
                            </span>
                            <span style={{ minWidth: 0, paddingTop: 4 }}>
                              <span style={{ display: "block", fontSize: 14, fontWeight: 500, lineHeight: 1.35, maxWidth: 640, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{video.title}</span>
                              <span style={{ display: "block", marginTop: 5, color: "var(--slate)", fontSize: 12, lineHeight: 1.45, maxWidth: 640, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{video.description || "No description"}</span>
                              <span style={{ display: "flex", gap: 14, marginTop: 10, color: "var(--slate)" }}>
                                <Pencil size={16} /><BarChart3 size={16} /><MessageSquare size={16} />
                              </span>
                            </span>
                          </a>
                        </td>
                        <td style={{ padding: "10px", verticalAlign: "middle", color: "var(--slate)" }}>-</td>
                        <td style={{ padding: "10px", verticalAlign: "middle" }}>
                          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
                            {visibilityIcon(video.privacyStatus)}
                            <CustomSelect
                              value={video.privacyStatus}
                              options={[
                                { value: "public", label: "Public" },
                                { value: "unlisted", label: "Unlisted" },
                                { value: "private", label: "Private" },
                              ]}
                              onChange={(val) => {
                                if (updatingVideoId !== video.id) updateVisibility(video.id, val);
                              }}
                              renderValue={(val) => <span style={{ textTransform: "capitalize" }}>{val}</span>}
                              dropdownStyle={{ top: "100%", left: 0, marginTop: 4, minWidth: 100 }}
                            />
                          </label>
                        </td>
                        <td style={{ padding: "10px", verticalAlign: "middle" }}><span style={{ display: "block", fontSize: 13, fontWeight: 500 }}>{formatDate(video.publishedAt)}</span><span style={{ display: "block", marginTop: 5, color: "var(--slate)", fontSize: 12, textTransform: "capitalize" }}>{video.uploadStatus}</span></td>
                        <td style={{ padding: "10px", verticalAlign: "middle", textAlign: "left", fontSize: 13 }}>{formatNumber(video.views)}</td>
                        <td style={{ padding: "10px 18px 10px 10px", verticalAlign: "middle", textAlign: "left", fontSize: 13 }}>{formatNumber(video.comments)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {activeTab !== "Playlists" && videos.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 32, padding: "12px 24px", color: "var(--slate)", fontSize: 13, borderTop: "1px solid rgba(20,20,19,0.12)", background: "var(--white)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span>Rows per page:</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                      <CustomSelect
                        value={rowsPerPage}
                        options={[
                          { value: 10, label: "10" },
                          { value: 30, label: "30" },
                          { value: 50, label: "50" },
                        ]}
                        onChange={(val) => { setRowsPerPage(val); setPage(0); }}
                        dropdownStyle={{ bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 8, minWidth: 60, textAlign: "center" }}
                      />
                    </div>
                  </div>

                  <span>{`${page * rowsPerPage + 1}-${Math.min((page + 1) * rowsPerPage, videos.length)} of ${videos.length}`}</span>

                  <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                    <button disabled={page === 0} onClick={() => setPage(0)} style={{ background: "transparent", border: "none", padding: 0, cursor: page === 0 ? "default" : "pointer", color: page === 0 ? "rgba(20,20,19,0.2)" : "var(--slate)", display: "flex", alignItems: "center" }}>
                      <ChevronsLeft size={20} />
                    </button>
                    <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ background: "transparent", border: "none", padding: 0, cursor: page === 0 ? "default" : "pointer", color: page === 0 ? "rgba(20,20,19,0.2)" : "var(--slate)", display: "flex", alignItems: "center" }}>
                      <ChevronLeft size={20} />
                    </button>
                    <button disabled={(page + 1) * rowsPerPage >= videos.length} onClick={() => setPage(p => p + 1)} style={{ background: "transparent", border: "none", padding: 0, cursor: (page + 1) * rowsPerPage >= videos.length ? "default" : "pointer", color: (page + 1) * rowsPerPage >= videos.length ? "rgba(20,20,19,0.2)" : "var(--slate)", display: "flex", alignItems: "center" }}>
                      <ChevronRight size={20} />
                    </button>
                    <button disabled={(page + 1) * rowsPerPage >= videos.length} onClick={() => setPage(Math.ceil(videos.length / rowsPerPage) - 1)} style={{ background: "transparent", border: "none", padding: 0, cursor: (page + 1) * rowsPerPage >= videos.length ? "default" : "pointer", color: (page + 1) * rowsPerPage >= videos.length ? "rgba(20,20,19,0.2)" : "var(--slate)", display: "flex", alignItems: "center" }}>
                      <ChevronsRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
