import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessagesSquare,
  Search,
  RefreshCw,
  Sparkles,
  AlertCircle,
  Loader2,
  MessageCircle,
  Layers,
  Clock,
  X,
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

function formatMsgTime(dateString) {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
  } catch {
    return "";
  }
}

function formatDateHeader(dateString) {
  if (!dateString) return "Today";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "Today";
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  } catch {
    return "Today";
  }
}

function getAvatarColor(str) {
  if (!str) return 'hsl(0, 0%, 40%)';
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 65%, 45%)`;
}

function AuthorAvatar({ src, name, size = 40 }) {
  const [imgError, setImgError] = useState(false);
  const initial = (name || "U").replace(/^@/, "")[0]?.toUpperCase() || "U";
  const avatarBg = getAvatarColor(name);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  const cleanSrc = src ? String(src).replace(/^http:\/\//i, "https://") : null;
  const currentSrc = cleanSrc && (cleanSrc.includes('cdninstagram.com') || cleanSrc.includes('fbcdn.net'))
    ? `/api/inbox/avatar-proxy?url=${encodeURIComponent(cleanSrc)}`
    : cleanSrc;

  if (currentSrc && !imgError) {
    return (
      <img
        src={currentSrc}
        alt={name || ""}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
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
        borderRadius: "50%",
        background: avatarBg,
        color: "#ffffff",
        display: "grid",
        placeItems: "center",
        fontWeight: 700,
        fontSize: size <= 28 ? 11 : size <= 36 ? 13 : 15,
        flexShrink: 0,
      }}
    >
      {initial}
    </div>
  );
}

export default function SocialInboxPage() {
  const { user, connectedAccounts } = useAuth();
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState([]);
  const [platformStatuses, setPlatformStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [starredIds, setStarredIds] = useState(new Set());
  const [unreadIds, setUnreadIds] = useState(new Set());

  // Composer state
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replyErrorMsg, setReplyErrorMsg] = useState(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [showWindowPolicyModal, setShowWindowPolicyModal] = useState(false);

  const selectedItemRef = useRef(null);
  const chatScrollRef = useRef(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedItemId]);

  // Load conversations list from backend
  const loadInboxStream = useCallback(async (isRefresh = false, isSilent = false) => {
    if (isRefresh) setRefreshing(true);
    else if (!isSilent && items.length === 0) setLoading(true);

    try {
      let res;
      if (isRefresh) {
        res = await apiClient.get("/api/inbox/stream", { params: { refresh: 1 } });
      } else {
        try {
          res = await apiClient.get("/api/inbox/conversations", { params: { limit: 50 } });
          if (!(res.data?.items || []).length) {
            res = await apiClient.get("/api/inbox/stream");
          }
        } catch {
          res = await apiClient.get("/api/inbox/stream");
        }
      }

      if (res.data?.success) {
        const aggregatedItems = res.data.items || [];
        setPlatformStatuses(res.data.platformStatuses || {});
        setItems((currentItems) => {
          const currentById = new Map(currentItems.map((item) => [item.id, item]));
          return aggregatedItems.map((item) => {
            const current = currentById.get(item.id);
            return {
              ...item,
              authorAvatar: item.authorAvatar || current?.authorAvatar || null,
              authorName: item.authorName || current?.authorName || "User",
              replies: current?.threadLoaded ? (current.replies || []) : item.replies,
              threadLoaded: Boolean(current?.threadLoaded),
            };
          });
        });
      }
    } catch (err) {
      console.error("Failed to load inbox stream:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [items.length]);

  // Initial load on mount
  useEffect(() => {
    loadInboxStream();
  }, [loadInboxStream]);

  // Fetch thread messages for active conversation
  const fetchThreadForConversation = useCallback(async (item, isBackground = false) => {
    if (!item) return;
    if (!isBackground && !(item.replies || []).length) setThreadLoading(true);

    try {
      let threadReplies = [];
      const conversationId = String(item.commentId || item.id).replace(/^(ig|fb):/, "");

      if (["instagram", "facebook"].includes(item.platform)) {
        try {
          const response = await apiClient.get("/api/inbox/thread", {
            params: {
              platform: item.platform,
              accountId: item.accountId,
              conversationId,
              externalConversationId: item.externalConversationId,
            },
          });
          if (response.data?.success && response.data?.replies?.length) {
            threadReplies = response.data.replies;
          }
        } catch (threadErr) {
          console.warn("Live thread fetch fallback to database:", threadErr.message);
        }
      }

      if (!threadReplies.length && item.databaseId) {
        try {
          const response = await apiClient.get(`/api/inbox/conversations/${item.databaseId}/messages`, {
            params: { limit: 50 },
          });
          if (response.data?.success && response.data?.messages?.length) {
            threadReplies = response.data.messages;
          }
        } catch {}
      }

      if (item.databaseId) {
        void apiClient.post(`/api/inbox/conversations/${item.databaseId}/read`).catch(() => {});
      }

      if (threadReplies.length > 0) {
        setItems((currentItems) =>
          currentItems.map((currentItem) => {
            if (currentItem.id !== item.id) return currentItem;
            return {
              ...currentItem,
              replies: threadReplies,
              threadLoaded: true,
            };
          })
        );
        setTimeout(scrollToBottom, 50);
      }
    } catch (error) {
      console.error("Failed to load conversation thread:", error);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  // Handle selecting a conversation
  const handleSelectItem = (item) => {
    setSelectedItemId(item.id);
    setReplyErrorMsg(null);
    setReplyText("");
    setUnreadIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
    fetchThreadForConversation(item, false);
  };

  // Real-time SSE listener
  useEffect(() => {
    let eventSource;
    try {
      eventSource = new EventSource("/api/instapilot/stream");
      eventSource.onmessage = (event) => {
        if (event.data === "refresh") {
          void loadInboxStream(false, true);
          if (selectedItemRef.current) {
            void fetchThreadForConversation(selectedItemRef.current, true);
          }
        }
      };
    } catch (e) {
      console.warn("SSE stream connection warning:", e);
    }

    return () => {
      if (eventSource) eventSource.close();
    };
  }, [loadInboxStream, fetchThreadForConversation]);

  // Derived selected item
  const selectedItem = useMemo(() => {
    return items.find((i) => i.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  useEffect(() => {
    selectedItemRef.current = selectedItem;
  }, [selectedItem]);

  // Filtered dataset
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        if (selectedPlatform !== "all" && item.platform !== selectedPlatform) return false;
        if (selectedAccount !== "all" && item.accountId !== selectedAccount && item.accountName !== selectedAccount) return false;
        if (statusFilter === "unread" && !unreadIds.has(item.id)) return false;
        if (statusFilter === "starred" && !starredIds.has(item.id)) return false;
        if (statusFilter === "replied" && !item.replied) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match = item.text?.toLowerCase().includes(q) ||
            item.authorName?.toLowerCase().includes(q) ||
            item.authorHandle?.toLowerCase().includes(q);
          if (!match) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [items, selectedPlatform, selectedAccount, statusFilter, searchQuery, unreadIds, starredIds]);

  // Unique Accounts list
  const availableAccounts = useMemo(() => {
    const pool = selectedPlatform === "all" ? items : items.filter((i) => i.platform === selectedPlatform);
    const accMap = new Map();
    for (const item of pool) {
      const key = item.accountId || item.accountName;
      if (key && !accMap.has(key)) {
        accMap.set(key, { id: key, name: item.accountName || key, platform: item.platform });
      }
    }
    return Array.from(accMap.values());
  }, [items, selectedPlatform]);

  // Disconnected state
  const isAccountDisconnected = useMemo(() => {
    if (!selectedItem) return false;
    if (selectedItem.accountConnected === false) return true;
    const plat = selectedItem.platform;
    return Boolean(connectedAccounts?.[plat] && connectedAccounts[plat].connected === false);
  }, [selectedItem, connectedAccounts]);

  // Send reply
  const handleSendReply = async () => {
    if (!selectedItem || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
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
        const textSent = replyText.trim();
        setReplyText("");
        setItems((prevItems) =>
          prevItems.map((item) => {
            if (item.id === selectedItem.id) {
              return {
                ...item,
                replied: true,
                replies: [
                  ...(item.replies || []),
                  {
                    id: res.data.replyId || `rep_${Date.now()}`,
                    authorName: user?.name || "You",
                    authorAvatar: user?.profilePicture || null,
                    text: textSent,
                    createdAt: new Date().toISOString(),
                    isSelf: true,
                  },
                ],
              };
            }
            return item;
          })
        );
        setTimeout(scrollToBottom, 50);
      } else {
        const rawMsg = res.data?.message || "Failed to post reply";
        const isWindow = res.data?.code === "OUTSIDE_24H_WINDOW" || /24-hour|allowed window/i.test(rawMsg);
        setReplyErrorMsg(isWindow ? "Meta 24-Hour Policy: Replies can only be sent within 24 hours of the user's last message." : rawMsg);
        if (isWindow) setShowWindowPolicyModal(true);
      }
    } catch (err) {
      const rawMsg = err.response?.data?.message || err.message || "Failed to send reply";
      const isWindow = /24-hour|allowed window/i.test(rawMsg);
      setReplyErrorMsg(isWindow ? "Meta 24-Hour Policy: Replies can only be sent within 24 hours of the user's last message." : rawMsg);
      if (isWindow) setShowWindowPolicyModal(true);
    } finally {
      setSendingReply(false);
    }
  };

  // AI Copilot
  const handleAiCopilot = async (style) => {
    if (!selectedItem || generatingAi) return;
    setGeneratingAi(true);
    try {
      const res = await apiClient.post("/api/inbox/copilot", {
        commentText: selectedItem.text,
        style,
      });
      if (res.data?.suggestion) setReplyText(res.data.suggestion);
    } catch (err) {
      console.warn("AI Copilot error:", err.message);
    } finally {
      setGeneratingAi(false);
    }
  };

  const confirmedCount = items.filter((i) => i.replied).length;
  const progressPercent = items.length > 0 ? Math.round((confirmedCount / items.length) * 100) : 0;

  return (
    <div
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
      {/* ── Top Header & Navigation ── */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #d3cec6", flexShrink: 0 }}>
        <div style={{ padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0, display: "inline-flex", alignItems: "center", gap: 8 }}>
            Social Inbox
            <InfoHelp text="Unified inbox consolidating incoming comments and direct messages across all connected social channels" />
          </h1>

          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--canvas, #f5f1ec)", padding: "6px 12px", borderRadius: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--slate)", textTransform: "uppercase" }}>Replied</span>
              <span style={{ fontSize: 14, fontWeight: 800 }}>{confirmedCount} <span style={{ color: "var(--slate)", fontWeight: 500 }}>/ {items.length}</span></span>
              <div style={{ width: 70, height: 6, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${progressPercent}%`, height: "100%", background: "var(--arc, #ff5600)" }} />
              </div>
            </div>
            <button
              onClick={() => loadInboxStream(true)}
              disabled={refreshing}
              style={{ padding: "8px", borderRadius: 8, border: "1px solid #d3cec6", background: "#ffffff", cursor: "pointer" }}
              title="Refresh Inbox"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            </button>
          </div>
        </div>

        {/* Platform tabs */}
        <div className="no-scrollbar" style={{ display: "flex", alignItems: "center", gap: 8, overflowX: "auto", padding: "0 24px 10px" }}>
          {PLATFORMS.map((plat) => {
            const isActive = selectedPlatform === plat.id;
            return (
              <button
                key={plat.id}
                onClick={() => setSelectedPlatform(plat.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 14px",
                  borderRadius: 20,
                  fontSize: 12.5,
                  fontWeight: isActive ? 750 : 600,
                  border: isActive ? "1px solid var(--arc, #ff5600)" : "1px solid rgba(20,20,19,0.12)",
                  background: isActive ? "rgba(255, 86, 0, 0.08)" : "#ffffff",
                  color: isActive ? "var(--arc, #ff5600)" : "var(--ink)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {plat.id === "all" ? <Layers size={14} /> : <img src={plat.icon} style={{ width: 14, height: 14 }} alt="" />}
                <span>{plat.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 2-Pane Main View ── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {/* Left Column: Conversations List */}
        <div style={{ width: 340, borderRight: "1px solid #d3cec6", background: "#ffffff", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid rgba(0,0,0,0.06)", display: "flex", gap: 6 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: 9, color: "var(--slate)" }} />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "5px 8px 5px 30px", borderRadius: 6, border: "1px solid #d3cec6", fontSize: 12, outline: "none" }}
              />
            </div>
            {availableAccounts.length > 1 && (
              <select
                value={selectedAccount}
                onChange={(e) => setSelectedAccount(e.target.value)}
                style={{ padding: "4px 6px", borderRadius: 6, border: "1px solid #d3cec6", fontSize: 11.5, background: "#fff", maxWidth: 100 }}
              >
                <option value="all">Accounts</option>
                {availableAccounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>{acc.name}</option>
                ))}
              </select>
            )}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: "4px 6px", borderRadius: 6, border: "1px solid #d3cec6", fontSize: 11.5, background: "#fff" }}
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="replied">Replied</option>
            </select>
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--slate)" }}>
                <Loader2 size={20} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                <div style={{ fontSize: 12 }}>Loading inbox...</div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--slate)" }}>
                <MessageCircle size={28} style={{ margin: "0 auto 8px", opacity: 0.4 }} />
                <div style={{ fontSize: 13, fontWeight: 600 }}>No conversations found</div>
              </div>
            ) : (
              filteredItems.map((item) => {
                const isSelected = item.id === selectedItem?.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid rgba(0,0,0,0.06)",
                      background: isSelected ? "rgba(255, 86, 0, 0.05)" : "#ffffff",
                      borderLeft: isSelected ? "3px solid var(--arc, #ff5600)" : "3px solid transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <div style={{ position: "relative" }}>
                          <AuthorAvatar src={item.authorAvatar} name={item.authorName} size={30} />
                          <img src={getPlatformIcon(item.platform)} style={{ width: 12, height: 12, position: "absolute", bottom: -2, right: -2, borderRadius: "50%", background: "#fff" }} alt="" />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.authorName}
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--slate)" }}>{timeAgo(item.createdAt)}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--slate)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.text || "Direct message"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Active Conversation */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#fafafa" }}>
          {selectedItem ? (
            <>
              {/* Active Conversation Header */}
              <div style={{ padding: "12px 20px", background: "#ffffff", borderBottom: "1px solid #d3cec6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AuthorAvatar src={selectedItem.authorAvatar} name={selectedItem.authorName} size={36} />
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>{selectedItem.authorName}</div>
                    <div style={{ fontSize: 11.5, color: "var(--slate)" }}>{selectedItem.authorHandle || selectedItem.platform}</div>
                  </div>
                </div>
              </div>

              {/* Chat Thread Messages */}
              <div ref={chatScrollRef} style={{ flex: 1, padding: "20px 28px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, background: "#ffffff" }}>
                {threadLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 24, color: "var(--slate)" }}>
                    <Loader2 size={20} className="animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Date separator chip */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", margin: "4px 0 12px", position: "relative" }}>
                      <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: "#f1f5f9", zIndex: 0 }} />
                      <span style={{ position: "relative", zIndex: 1, background: "#ffffff", padding: "3px 14px", border: "1px solid #e2e8f0", borderRadius: 14, fontSize: 11.5, fontWeight: 600, color: "#64748b", boxShadow: "0 1px 2px rgba(0,0,0,0.02)" }}>
                        {formatDateHeader(selectedItem.createdAt)}
                      </span>
                    </div>

                    {(selectedItem.replies?.length > 0 ? selectedItem.replies : [selectedItem]).map((msg, idx) => {
                      const isSelf = msg.isSelf || false;
                      let text = (msg.text !== undefined && msg.text !== null ? msg.text : (msg.body || "")).trim();
                      let imageUrl = msg.imageUrl || msg.mediaUrl || msg.rawPayload?.imageUrl || msg.rawPayload?.image_url || null;
                      let buttons = (msg.buttons && msg.buttons.length) ? msg.buttons : (msg.rawPayload?.buttons || []);

                      // Extract template card properties if JSON string
                      if (text && text.startsWith("{")) {
                        try {
                          const parsed = JSON.parse(text);
                          const el = parsed.elements?.[0] || {};
                          text = el.title || "";
                          if (el.subtitle) text += "\n" + el.subtitle;
                          if (el.image_url && !imageUrl) imageUrl = el.image_url;
                          if (el.buttons && el.buttons.length && !buttons.length) buttons = el.buttons;
                        } catch {}
                      }

                      // Extract Cloudinary image link from text if present
                      if (!imageUrl && text) {
                        const match = text.match(/(https?:\/\/[^\s]+(?:\.(?:png|jpg|jpeg|webp|gif)|res\.cloudinary\.com\/[^\s]+)[^\s]*)/i);
                        if (match) {
                          imageUrl = match[0];
                          text = text.split(imageUrl).join("").trim();
                        }
                      }

                      // Never render phantom messages with no content
                      if (!text && !imageUrl && buttons.length === 0) {
                        return null;
                      }

                      // Special handling for subtle automation system notice
                      const isAttributionNotice = text && /^⚡\s*Automation is/i.test(text);
                      if (isAttributionNotice) {
                        return (
                          <div
                            key={msg.id || idx}
                            style={{
                              alignSelf: "center",
                              margin: "2px 0",
                              padding: "3px 12px",
                              background: "#f8fafc",
                              border: "1px solid #e2e8f0",
                              borderRadius: 12,
                              fontSize: 11,
                              fontWeight: 600,
                              color: "#64748b",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            {text}
                          </div>
                        );
                      }

                      const authorAvatarUrl = isSelf ? (user?.profilePicture || null) : selectedItem.authorAvatar;
                      const msgTimeStr = formatMsgTime(msg.createdAt || selectedItem.createdAt);

                      return (
                        <div
                          key={msg.id || idx}
                          style={{
                            display: "flex",
                            flexDirection: isSelf ? "row-reverse" : "row",
                            gap: 8,
                            alignItems: "flex-end",
                            maxWidth: "75%",
                            alignSelf: isSelf ? "flex-end" : "flex-start",
                          }}
                        >
                          {!isSelf && <AuthorAvatar src={authorAvatarUrl} name={selectedItem.authorName} size={28} />}
                          <div style={{ display: "flex", flexDirection: "column", alignItems: isSelf ? "flex-end" : "flex-start" }}>
                            {/* Minimal Message Bubble */}
                            <div
                              style={{
                                background: isSelf ? "#f1f3fd" : "#f3f4f6",
                                color: "#1e293b",
                                padding: "12px 16px",
                                borderRadius: 16,
                                borderBottomRightRadius: isSelf ? 4 : 16,
                                borderBottomLeftRadius: !isSelf ? 4 : 16,
                                fontSize: 13.5,
                                lineHeight: 1.5,
                                wordBreak: "break-word",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                              }}
                            >
                              {/* Cloudinary or Attached Image */}
                              {imageUrl && (
                                <a href={imageUrl} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: text ? 8 : 0 }}>
                                  <img
                                    src={imageUrl}
                                    alt="Attachment"
                                    referrerPolicy="no-referrer"
                                    style={{
                                      width: "100%",
                                      maxWidth: 320,
                                      maxHeight: 220,
                                      borderRadius: 10,
                                      objectFit: "cover",
                                      display: "block",
                                    }}
                                  />
                                </a>
                              )}

                              {/* Message Text */}
                              {text && <div style={{ whiteSpace: "pre-wrap" }}>{text}</div>}

                              {/* Interactive Buttons */}
                              {buttons.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                                  {buttons.map((btn, bIdx) => (
                                    <div
                                      key={bIdx}
                                      style={{
                                        background: "#ffffff",
                                        border: "1px solid #dcdfe4",
                                        padding: "7px 14px",
                                        borderRadius: 8,
                                        fontSize: 12.5,
                                        fontWeight: 600,
                                        textAlign: "center",
                                        color: "#2563eb",
                                        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                                      }}
                                    >
                                      {btn.title || btn.payload || "Interactive Button"}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Optional subtle timestamp */}
                            {msgTimeStr && (
                              <span style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3, paddingLeft: 4, paddingRight: 4 }}>
                                {msgTimeStr}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>

              {/* ── Reply Composer ── */}
              <div style={{ background: "#ffffff", padding: "12px 20px 20px", borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                {isAccountDisconnected ? (
                  <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9a3412", fontWeight: 600 }}>
                      <AlertCircle size={16} color="#ea580c" />
                      Account Disconnected (Read-only)
                    </div>
                    <Link to="/connect" style={{ background: "#ea580c", color: "#fff", padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
                      Reconnect
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Quick AI Suggestions */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--arc)", display: "flex", alignItems: "center", gap: 4 }}>
                        <Sparkles size={13} /> AI:
                      </span>
                      {["Friendly", "Professional", "Quick Thanks"].map((mood) => (
                        <button
                          key={mood}
                          onClick={() => handleAiCopilot(mood.toLowerCase().replace(" ", "_"))}
                          disabled={generatingAi}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 14,
                            background: "#f1f5f9",
                            border: "none",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {generatingAi ? <Loader2 size={10} className="animate-spin" /> : mood}
                        </button>
                      ))}
                    </div>

                    {replyErrorMsg && (
                      <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", color: "#c2410c", padding: "6px 12px", borderRadius: 8, fontSize: 12, marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span>{replyErrorMsg}</span>
                        <button type="button" onClick={() => setReplyErrorMsg(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#c2410c" }}>
                          <X size={13} />
                        </button>
                      </div>
                    )}

                    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, background: "#f1f5f9", padding: "8px 14px", borderRadius: 20 }}>
                      <textarea
                        rows={1}
                        placeholder="Write a message..."
                        value={replyText}
                        onChange={(e) => {
                          setReplyText(e.target.value);
                          e.target.style.height = "auto";
                          e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`;
                        }}
                        style={{ flex: 1, border: "none", outline: "none", resize: "none", fontSize: 14, background: "transparent", color: "var(--ink)", lineHeight: 1.4 }}
                      />
                      {replyText.trim() && (
                        <button
                          onClick={handleSendReply}
                          disabled={sendingReply}
                          style={{ background: "transparent", border: "none", color: "var(--arc, #ff5600)", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                        >
                          {sendingReply ? <Loader2 size={16} className="animate-spin" /> : "Send"}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--slate)" }}>
              <div style={{ textAlign: "center" }}>
                <MessagesSquare size={48} strokeWidth={1.5} style={{ margin: "0 auto 12px", color: "var(--ink)" }} />
                <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>Your Messages</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>Select a conversation to view chat history</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Meta 24-Hour Policy Modal ── */}
      <AnimatePresence>
        {showWindowPolicyModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 100,
              display: "grid",
              placeItems: "center",
              padding: 16,
              background: "rgba(0, 0, 0, 0.45)",
              backdropFilter: "blur(4px)",
            }}
            onClick={() => setShowWindowPolicyModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "#ffffff",
                borderRadius: 16,
                maxWidth: 440,
                width: "100%",
                padding: "20px",
                boxShadow: "0 20px 40px rgba(0,0,0,0.15)",
                display: "flex",
                flexDirection: "column",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 700 }}>
                  <Clock size={18} color="#ea580c" /> Meta 24-Hour Policy
                </div>
                <button type="button" onClick={() => setShowWindowPolicyModal(false)} style={{ background: "transparent", border: "none", cursor: "pointer" }}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
                Meta allows API responses only within <strong>24 hours</strong> of the customer&apos;s latest message. To resume chatting, the user can message your account again.
              </div>
              <button
                type="button"
                onClick={() => setShowWindowPolicyModal(false)}
                style={{ background: "#ea580c", color: "#ffffff", border: "none", padding: "8px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}
              >
                Got it
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
