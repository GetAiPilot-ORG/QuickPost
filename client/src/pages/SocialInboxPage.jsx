import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessagesSquare,
  Search,
  RefreshCw,
  Send,
  Sparkles,
  Star,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
  ExternalLink,
  MessageCircle,
  Filter,
  Layers,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";
import apiClient from "../utils/apiClient";
import { useAuth } from "../context/AuthContext";
import InfoHelp from "../components/InfoHelp";

const PLATFORMS = [
  { id: "all", label: "All channels", icon: "/icons/share-icon.svg" },
  { id: "instagram", label: "Instagram", icon: "/icons/ig-instagram-icon.svg" },
  { id: "facebook", label: "Facebook", icon: "/icons/facebook-round-color-icon.svg" },
  { id: "linkedin", label: "LinkedIn", icon: "/icons/linkedin-icon.svg" },
  { id: "threads", label: "Threads", icon: "/icons/threads-icon.svg" },
  { id: "bluesky", label: "Bluesky", icon: "/icons/bluesky-circle-color-icon.svg" },
  { id: "x", label: "X (Twitter)", icon: "/icons/x-social-media-round-icon.svg" },
  { id: "googleBusiness", label: "Google Business", icon: "/icons/google-icon.svg" },
  { id: "youtube", label: "YouTube", icon: "/icons/youtube-color-icon.svg" },
  { id: "mastodon", label: "Mastodon", icon: "/icons/mastodon-round-icon.svg" },
];

const INBOX_CLIENT_CACHE_TTL_MS = 60_000;
const inboxClientCache = new Map();

function getPlatformIcon(platformId) {
  const match = PLATFORMS.find((p) => p.id === platformId);
  return match?.icon || "/icons/share-icon.svg";
}

function timeAgo(dateString) {
  if (!dateString) return "just now";
  const date = new Date(dateString);
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getAvatarColor(str) {
  if (!str) return 'hsl(0, 0%, 40%)';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
}

function AuthorAvatar({ src, name, size = 40, style = {} }) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || "U").replace(/^@/, "")[0]?.toUpperCase() || "U";

  useEffect(() => {
    setImgError(false);
  }, [src]);

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name || ""}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
          ...style,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: "rgba(20,20,19,0.08)",
        color: "var(--ink)",
        display: "grid",
        placeItems: "center",
        fontWeight: 750,
        fontSize: size <= 28 ? 11 : 14,
        flexShrink: 0,
        ...style,
      }}
    >
      {initial}
    </div>
  );
}

function PostThumbnailImage({ src, platform, postId, size = 64 }) {
  const [imgSrc, setImgSrc] = useState(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setFailed(false);
  }, [src, postId]);

  const handleError = () => {
    if (platform === "youtube" && postId && !imgSrc?.includes("hqdefault.jpg")) {
      setImgSrc(`https://i.ytimg.com/vi/${postId}/hqdefault.jpg`);
    } else {
      setFailed(true);
    }
  };

  if (imgSrc && !failed) {
    return (
      <img
        src={imgSrc}
        alt=""
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
        onError={handleError}
        style={{
          width: size,
          height: size,
          borderRadius: 8,
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: "rgba(20,20,19,0.06)",
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <img
        src={getPlatformIcon(platform)}
        style={{ width: size * 0.45, height: size * 0.45 }}
        alt=""
      />
    </div>
  );
}

export default function SocialInboxPage() {
  const { user } = useAuth();
  const clientCacheKey = user?.id || user?.userId || "anonymous";
  const cachedInbox = inboxClientCache.get(clientCacheKey);
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // all, unread, replied, starred
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState(() => cachedInbox?.items || []);
  const [platformStatuses, setPlatformStatuses] = useState(() => cachedInbox?.platformStatuses || {});
  const [loading, setLoading] = useState(() => !cachedInbox);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [threadLoadingId, setThreadLoadingId] = useState(null);

  // Session-only states (Stateless requirements)
  const [repliedIds, setRepliedIds] = useState(new Set());
  const [starredIds, setStarredIds] = useState(new Set());
  const [unreadIds, setUnreadIds] = useState(() => new Set(
    (cachedInbox?.items || []).filter((item) => item.unread).map((item) => item.id)
  ));

  // Reply Composer state
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replySuccessMsg, setReplySuccessMsg] = useState(null);
  const [replyErrorMsg, setReplyErrorMsg] = useState(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  // Load Inbox Stream from API
  const loadInboxStream = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (!inboxClientCache.has(clientCacheKey)) setLoading(true);

    try {
      let res;
      if (isRefresh) {
        res = await apiClient.get("/api/inbox/stream", { params: { refresh: 1 } });
      } else {
        try {
          res = await apiClient.get("/api/inbox/conversations", { params: { limit: 50 } });
          if (!(res.data?.items || []).length) {
            res = await apiClient.get("/api/inbox/stream", { params: { refresh: 1 } });
          }
        } catch (databaseError) {
          res = await apiClient.get("/api/inbox/stream");
        }
      }
      if (res.data?.success) {
        const aggregatedItems = res.data.items || [];
        setItems(aggregatedItems);
        setPlatformStatuses(res.data.platformStatuses || {});
        inboxClientCache.set(clientCacheKey, {
          items: aggregatedItems,
          platformStatuses: res.data.platformStatuses || {},
          cachedAt: Date.now(),
        });

        // Initialize unread IDs for items marked unread
        const initialUnread = new Set(
          aggregatedItems.filter((i) => i.unread).map((i) => i.id)
        );
        setUnreadIds(initialUnread);
      }
    } catch (err) {
      console.error("Failed to load inbox stream:", err);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [clientCacheKey]);

  useEffect(() => {
    const cached = inboxClientCache.get(clientCacheKey);
    if (!cached || Date.now() - cached.cachedAt >= INBOX_CLIENT_CACHE_TTL_MS) {
      loadInboxStream();
    }
  }, [clientCacheKey, loadInboxStream]);

  // Unique Accounts list based on current platform selection
  const availableAccounts = useMemo(() => {
    const pool = selectedPlatform === "all" ? items : items.filter((i) => i.platform === selectedPlatform);
    const accMap = new Map();
    for (const item of pool) {
      const key = item.accountId || item.accountName;
      if (key && !accMap.has(key)) {
        accMap.set(key, {
          id: key,
          name: item.accountName || key,
          platform: item.platform,
        });
      }
    }
    return Array.from(accMap.values());
  }, [items, selectedPlatform]);

  // Filtered dataset
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // Platform filter
      if (selectedPlatform !== "all" && item.platform !== selectedPlatform) {
        return false;
      }
      // Account filter
      if (selectedAccount !== "all" && item.accountId !== selectedAccount && item.accountName !== selectedAccount) {
        return false;
      }
      // Status filter
      if (statusFilter === "unread" && !unreadIds.has(item.id)) return false;
      if (statusFilter === "starred" && !starredIds.has(item.id)) return false;
      if (statusFilter === "replied" && !repliedIds.has(item.id) && !item.replied) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const textMatch = item.text?.toLowerCase().includes(q);
        const authorMatch = item.authorName?.toLowerCase().includes(q) || item.authorHandle?.toLowerCase().includes(q);
        const titleMatch = item.postTitle?.toLowerCase().includes(q);
        if (!textMatch && !authorMatch && !titleMatch) return false;
      }
      return true;
    });
  }, [items, selectedPlatform, selectedAccount, statusFilter, searchQuery, unreadIds, starredIds, repliedIds]);

  const selectedItem = useMemo(() => {
    return items.find((i) => i.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  const handleSelectItem = useCallback(async (item) => {
    setSelectedItemId(item.id);
    setUnreadIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
    if (item.threadLoaded) return;

    setThreadLoadingId(item.id);
    try {
      let data;
      if (item.persisted && item.databaseId) {
        const response = await apiClient.get(`/api/inbox/conversations/${item.databaseId}/messages`, {
          params: { limit: 50 },
        });
        data = { success: response.data?.success, replies: response.data?.messages || [] };
        void apiClient.post(`/api/inbox/conversations/${item.databaseId}/read`).catch(() => {});
      }
      if (["instagram", "facebook"].includes(item.platform) && (!item.threadComplete || !data?.replies?.length)) {
        const conversationId = String(item.commentId || item.id).replace(/^(ig|fb):/, "");
        const response = await apiClient.get("/api/inbox/thread", {
          params: {
            platform: item.platform,
            accountId: item.accountId,
            conversationId,
            externalConversationId: item.externalConversationId,
          },
        });
        data = response.data;
      }
      if (data?.success) {
        setItems((currentItems) => currentItems.map((currentItem) =>
          currentItem.id === item.id
            ? { ...currentItem, replies: data.replies || [], threadLoaded: true }
            : currentItem
        ));
      }
    } catch (error) {
      console.error("Failed to load conversation thread:", error);
    } finally {
      setThreadLoadingId((currentId) => currentId === item.id ? null : currentId);
    }
  }, []);

  // Reply Progress Calculation (Replied X / Y)
  const totalY = items.length;
  const confirmedX = useMemo(() => {
    return items.filter((i) => i.replied || repliedIds.has(i.id)).length;
  }, [items, repliedIds]);
  const progressPercent = totalY > 0 ? Math.round((confirmedX / totalY) * 100) : 0;

  // Handle Reply Submission
  const handleSendReply = async () => {
    if (!selectedItem || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    setReplySuccessMsg(null);
    setReplyErrorMsg(null);

    try {
      const payload = {
        platform: selectedItem.platform,
        accountId: selectedItem.accountId,
        commentId: selectedItem.commentId,
        recipientId: selectedItem.replyRecipientId,
        postId: selectedItem.postId,
        text: replyText.trim(),
      };

      const res = await apiClient.post("/api/inbox/reply", payload);
      if (res.data?.success) {
        // Increment confirmed reply count safely in session state
        setRepliedIds((prev) => new Set(prev).add(selectedItem.id));
        setReplyText("");

        // Append to local replies list
        setItems((prevItems) =>
          prevItems.map((item) => {
            if (item.id === selectedItem.id) {
              return {
                ...item,
                replied: true,
                replies: [
                  ...item.replies,
                  {
                    id: res.data.replyId || `rep_${Date.now()}`,
                    authorName: user?.name || "You",
                    authorAvatar: user?.profilePicture || null,
                    text: payload.text,
                    createdAt: new Date().toISOString(),
                    isSelf: true
                  },
                ],
              };
            }
            return item;
          })
        );
      } else {
        setReplyErrorMsg(res.data?.message || "Failed to post reply");
      }
    } catch (err) {
      setReplyErrorMsg(err.response?.data?.message || err.message || "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  };

  // Handle AI Copilot Suggestions
  const handleAiCopilot = async (style) => {
    if (!selectedItem || generatingAi) return;
    setGeneratingAi(true);
    try {
      const res = await apiClient.post("/api/inbox/copilot", {
        commentText: selectedItem.text,
        style,
      });
      if (res.data?.suggestion) {
        setReplyText(res.data.suggestion);
      }
    } catch (err) {
      console.warn("AI Copilot error:", err.message);
    } finally {
      setGeneratingAi(false);
    }
  };

  // Toggle Star / Unread
  const toggleStar = (id) => {
    setStarredIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className={selectedItem ? "max-md:fixed max-md:inset-0 max-md:z-[60] max-md:!h-[100dvh]" : ""}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100dvh - 64px)",
        background: "var(--canvas, #f5f1ec)",
        fontFamily: "var(--font-body, system-ui)",
        color: "var(--ink, #111)",
        overflow: "hidden",
      }}
    >
      {/* ── Compact Page Header ── */}
      <div
        className={selectedItem ? "max-md:hidden" : ""}
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #d3cec6",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            padding: "10px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", color: "var(--ink, #111111)", display: "inline-flex", alignItems: "center", gap: 8 }}>
            Social Inbox
            <InfoHelp text="Unified inbox consolidating incoming comments and direct messages across all connected social channels" />
          </h1>

          {/* Replied Status & Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--canvas, #f5f1ec)", padding: "6px 12px", borderRadius: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--slate)", textTransform: "uppercase", letterSpacing: "0.04em", display: "inline-flex", alignItems: "center", gap: 4 }}>
                Replied
                <InfoHelp text="Tracks the ratio of conversations and audience comments that have received replies" />
              </span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "var(--ink)" }}>{confirmedX} <span style={{ color: "var(--slate)", fontWeight: 500 }}>/ {totalY}</span></span>
              <div style={{ width: 80, height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.4 }}
                  style={{ height: "100%", background: "var(--arc, #ff5600)" }}
                />
              </div>
            </div>
            <button
              onClick={() => loadInboxStream(true)}
              disabled={refreshing}
              style={{
                padding: "8px",
                borderRadius: 8,
                border: "1px solid #d3cec6",
                background: "#ffffff",
                cursor: refreshing ? "default" : "pointer",
                color: refreshing ? "var(--slate)" : "var(--ink)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.2s"
              }}
              title="Refresh Inbox"
            >
              <RefreshCw size={16} className={refreshing ? "spin" : ""} />
            </button>
          </div>
        </div>

        {/* Divider Line */}
        <div style={{ height: 1, background: "#d3cec6", width: "100%", opacity: 0.8 }} />

        {/* Bottom Row: Integrated Platform Filter Navigation Bar */}
        <div
          className="no-scrollbar"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            overflowX: "auto",
            paddingTop: 4,
          }}
        >
          {PLATFORMS.map((plat) => {
            const isActive = selectedPlatform === plat.id;
            const status = platformStatuses[plat.id];
            const isConnected = plat.id === "all" || status?.connected;

            return (
              <button
                key={plat.id}
                onClick={() => setSelectedPlatform(plat.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 20px",
                  borderRadius: 24,
                  fontSize: 13,
                  fontWeight: isActive ? 750 : 600,
                  border: isActive ? "1px solid var(--arc, #ff5600)" : "1px solid rgba(20,20,19,0.12)",
                  background: isActive ? "rgba(255, 86, 0, 0.08)" : "#ffffff",
                  color: isActive ? "var(--arc, #ff5600)" : isConnected ? "var(--ink)" : "var(--slate)",
                  opacity: isConnected ? 1 : 0.5,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  boxSizing: "border-box",
                  lineHeight: 1,
                  transition: "all 0.2s",
                  boxShadow: isActive ? "0 2px 10px rgba(255,86,0,0.15)" : "none",
                }}
              >
                {plat.id === "all" ? (
                  <Layers size={16} style={{ color: isActive ? "var(--arc, #ff5600)" : "var(--slate)" }} />
                ) : (
                  <img src={plat.icon} style={{ width: 18, height: 18, objectFit: "contain" }} alt="" />
                )}
                <span>{plat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main Buffer-Style 2-Pane Content Area ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {/* ── Left Pane: Comment & Thread List ── */}
        <div
          className={`w-full md:w-[320px] md:max-w-[320px] flex-shrink-0 border-r border-[#d3cec6] bg-white min-h-0 ${selectedItem ? "hidden md:flex" : "flex"} flex-col`}
        >
          {/* Controls: Search, Account & Status Filter */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(20,20,19,0.06)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 120 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--slate)" }} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 10px 6px 30px",
                  borderRadius: 6,
                  border: "1px solid #d3cec6",
                  fontSize: 12,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>
            {availableAccounts.length > 1 && (
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  border: "1px solid #d3cec6",
                  fontSize: 12,
                  fontWeight: 600,
                  background: "#ffffff",
                  color: "var(--ink)",
                  outline: "none",
                  cursor: "pointer",
                  flexShrink: 0,
                  maxWidth: 130,
                  textOverflow: "ellipsis",
                }}
                title="Filter by connected account"
              >
                <option value="all">All Accounts ({availableAccounts.length})</option>
                {availableAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            )}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid #d3cec6",
                fontSize: 12,
                background: "#ffffff",
                color: "var(--ink)",
                outline: "none",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              <option value="all">All Status</option>
              <option value="unread">Unread</option>
              <option value="replied">Replied</option>
              <option value="starred">Starred</option>
            </select>
          </div>

          {/* Comment List */}
          <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", msOverflowStyle: "none", scrollbarWidth: "none" }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--slate)" }}>
                <Loader2 size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                <div style={{ fontSize: 13 }}>Loading conversations...</div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--slate)" }}>
                <MessageCircle size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>No conversations found</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>Try selecting another platform or clearing search</div>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === selectedItem?.id;
                const isReplied = item.replied || repliedIds.has(item.id);
                const isStarred = starredIds.has(item.id);
                const showHandle = item.authorHandle && item.authorHandle.toLowerCase() !== item.authorName.toLowerCase() && `@${item.authorName.toLowerCase()}` !== item.authorHandle.toLowerCase();

                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    style={{
                      padding: "14px 16px",
                      borderBottom: "1px solid rgba(20,20,19,0.06)",
                      background: isSelected ? "rgba(255, 86, 0, 0.04)" : "#ffffff",
                      borderLeft: isSelected ? "3px solid var(--arc, #ff5600)" : "3px solid transparent",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      boxSizing: "border-box",
                    }}
                  >
                    {/* Header: Platform icon + Author + Timestamp */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1, overflow: "hidden" }}>
                        <div style={{ position: "relative" }}>
                          {item.authorAvatar ? (
                            <img src={item.authorAvatar} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} alt="" />
                          ) : (
                            <div style={{ width: 32, height: 32, borderRadius: "50%", background: getAvatarColor(item.authorName), color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 13 }}>
                              {item.authorName?.[0]?.toUpperCase() || "U"}
                            </div>
                          )}
                          <img src={getPlatformIcon(item.platform)} style={{ width: 14, height: 14, position: "absolute", bottom: -2, right: -2, border: "2px solid #fff", borderRadius: "50%" }} alt="" />
                        </div>
                        <div style={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {item.authorName}
                          </span>
                          {showHandle && (
                            <span style={{ fontSize: 11, color: "var(--slate)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {item.authorHandle}
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--slate)", flexShrink: 0, whiteSpace: "nowrap" }}>
                        {timeAgo(item.createdAt)}
                      </span>
                    </div>

                    {/* Comment text preview */}
                    <p
                      style={{
                        fontSize: 13,
                        color: "var(--ink)",
                        margin: "0 0 8px",
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {item.text}
                    </p>

                    {/* Footer Badges & Star button */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {isReplied ? (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", background: "#f0fdf4", padding: "2px 8px", borderRadius: 10 }}>
                            Replied
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#d97706", background: "#fffbeb", padding: "2px 8px", borderRadius: 10 }}>
                            Unanswered
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleStar(item.id);
                        }}
                        style={{ border: "none", background: "transparent", cursor: "pointer", color: isStarred ? "#eab308" : "var(--slate)" }}
                      >
                        <Star size={14} fill={isStarred ? "#eab308" : "none"} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Pane: Thread Detail & Reply Composer ── */}
        <div className={`${!selectedItem ? "hidden md:flex" : "flex"} flex-1 flex-col h-full overflow-hidden`} style={{ background: "#ffffff" }}>
          {selectedItem ? (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, width: "100%", maxWidth: 900, margin: "0 auto", height: "100%", overflow: "hidden", background: "#ffffff", borderLeft: "1px solid rgba(0,0,0,0.06)", borderRight: "1px solid rgba(0,0,0,0.06)" }}>
              
              {/* ── Instagram-Style Header ── */}
              <div style={{ background: "#ffffff", padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.08)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, zIndex: 10 }}>
                <button onClick={() => setSelectedItemId(null)} className="md:hidden flex items-center justify-center p-2 -ml-2 rounded-full hover:bg-slate-100" style={{ color: "var(--ink)", border: "none", background: "transparent", cursor: "pointer" }}>
                  <ArrowLeft size={24} strokeWidth={2} />
                </button>
                <AuthorAvatar src={selectedItem.authorAvatar} name={selectedItem.authorName} size={40} />
                <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", lineHeight: "1.2" }}>
                    {selectedItem.authorName}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--slate)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    {selectedItem.authorHandle} • <img src={getPlatformIcon(selectedItem.platform)} style={{ width: 12, height: 12 }} alt="" title={selectedItem.platform} />
                  </div>
                </div>
              </div>

              {/* ── Chat Messages Area ── */}
              <div className="no-scrollbar" style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 6, marginTop: "auto" }}>
                  
                  {/* Post Context Embedded Card */}
                  <div style={{ alignSelf: "center", maxWidth: "85%", width: "100%", background: "#f8f9fa", borderRadius: 16, padding: 12, marginBottom: 24, border: "1px solid rgba(0,0,0,0.05)", display: "flex", gap: 12, alignItems: "center" }}>
                    <PostThumbnailImage src={selectedItem.postThumbnail} platform={selectedItem.platform} postId={selectedItem.postId} size={56} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--slate)", textTransform: "capitalize", marginBottom: 2 }}>Replying to {selectedItem.platform} Post</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{selectedItem.postTitle}</div>
                    </div>
                  </div>

                  {/* Original Message and Replies */}
                  {threadLoadingId === selectedItem.id ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: 24, color: "var(--slate)" }}>
                      <Loader2 size={22} className="animate-spin" />
                    </div>
                  ) : (selectedItem.replies?.length > 0 ? selectedItem.replies : [selectedItem]).map((msg, idx, arr) => {
                    const isSelf = msg.isSelf || false;
                    const rawText = msg.text || selectedItem.text || "";
                    const msgText = rawText.trim() === "" ? "[📸 Media Attachment]" : rawText;
                    const nextMsg = arr[idx + 1];
                    const isLastInGroup = !nextMsg || nextMsg.isSelf !== isSelf;

                    return (
                      <div key={msg.id || idx} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexDirection: isSelf ? "row-reverse" : "row", width: "100%", marginBottom: isLastInGroup ? 16 : 2 }}>
                        {!isSelf && (
                          <div style={{ flexShrink: 0, width: 28, height: 28 }}>
                            {isLastInGroup && (
                              <AuthorAvatar src={selectedItem.authorAvatar} name={selectedItem.authorName} size={28} />
                            )}
                          </div>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: isSelf ? "flex-end" : "flex-start", maxWidth: "75%" }}>
                          <div
                            style={{
                              background: isSelf ? "var(--arc, #ff5600)" : "#efefef",
                              color: isSelf ? "#ffffff" : "var(--ink)",
                              padding: "10px 16px",
                              borderRadius: 22,
                              borderBottomRightRadius: isSelf && isLastInGroup ? 4 : 22,
                              borderBottomLeftRadius: !isSelf && isLastInGroup ? 4 : 22,
                              fontSize: 15,
                              lineHeight: 1.4,
                              wordBreak: "break-word"
                            }}
                          >
                            {msgText}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Composer Area ── */}
              <div style={{ background: "#ffffff", padding: "12px 16px 24px", flexShrink: 0, zIndex: 10, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                
                {/* Copilot Suggestions */}
                <div className="no-scrollbar" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, overflowX: "auto", paddingBottom: 4 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--arc)", display: "flex", alignItems: "center", gap: 4, flexShrink: 0, paddingRight: 4 }}>
                    <Sparkles size={14} /> AI
                  </div>
                  {["Friendly", "Professional", "Quick Thanks"].map(mood => (
                    <button
                      key={mood}
                      onClick={() => handleAiCopilot(mood.toLowerCase().replace(" ", "_"))}
                      disabled={generatingAi}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 20,
                        background: "#f1f5f9",
                        border: "none",
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ink)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexShrink: 0,
                        transition: "background 0.2s"
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = "#e2e8f0"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "#f1f5f9"}
                    >
                      {generatingAi ? <Loader2 size={12} className="animate-spin" /> : mood}
                    </button>
                  ))}
                </div>

                {replyErrorMsg && (
                  <div style={{ color: "#dc2626", fontSize: 12, marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
                    <AlertCircle size={14} /> {replyErrorMsg}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "flex-end", gap: 10, background: "#f1f5f9", padding: "10px 16px", borderRadius: 24 }}>
                  <textarea
                    rows={1}
                    placeholder="Message..."
                    value={replyText}
                    onChange={(e) => {
                      setReplyText(e.target.value);
                      e.target.style.height = "auto";
                      e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                    }}
                    style={{
                      flex: 1,
                      border: "none",
                      outline: "none",
                      resize: "none",
                      fontSize: 15,
                      fontFamily: "inherit",
                      background: "transparent",
                      padding: "4px 0",
                      maxHeight: 120,
                      color: "var(--ink)",
                      lineHeight: 1.4
                    }}
                  />
                  {replyText.trim() ? (
                    <button
                      onClick={handleSendReply}
                      disabled={sendingReply}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--link, #0095f6)",
                        fontSize: 15,
                        fontWeight: 700,
                        cursor: sendingReply ? "default" : "pointer",
                        padding: "4px 4px 4px 12px",
                        flexShrink: 0,
                        transition: "opacity 0.2s",
                        opacity: sendingReply ? 0.5 : 1
                      }}
                    >
                      {sendingReply ? <Loader2 size={18} className="animate-spin" /> : "Send"}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--slate)" }}>
              <div style={{ textAlign: "center" }}>
                <MessagesSquare size={64} strokeWidth={1} style={{ margin: "0 auto 16px", color: "var(--ink)" }} />
                <div style={{ fontSize: 20, fontWeight: 700, color: "var(--ink)" }}>Your Messages</div>
                <div style={{ fontSize: 14, marginTop: 8 }}>Select a conversation to start chatting</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
