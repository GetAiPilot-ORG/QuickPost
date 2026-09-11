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
} from "lucide-react";
import apiClient from "../utils/apiClient";
import { useAuth } from "../context/AuthContext";

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

export default function SocialInboxPage() {
  const { user } = useAuth();
  const [selectedPlatform, setSelectedPlatform] = useState("all");
  const [selectedAccount, setSelectedAccount] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all"); // all, unread, replied, starred
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState([]);
  const [platformStatuses, setPlatformStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState(null);

  // Session-only states (Stateless requirements)
  const [repliedIds, setRepliedIds] = useState(new Set());
  const [starredIds, setStarredIds] = useState(new Set());
  const [unreadIds, setUnreadIds] = useState(new Set());

  // Reply Composer state
  const [replyText, setReplyText] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replySuccessMsg, setReplySuccessMsg] = useState(null);
  const [replyErrorMsg, setReplyErrorMsg] = useState(null);
  const [generatingAi, setGeneratingAi] = useState(false);

  // Load Inbox Stream from API
  const loadInboxStream = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await apiClient.get("/api/inbox/stream");
      if (res.data?.success) {
        const aggregatedItems = res.data.items || [];
        setItems(aggregatedItems);
        setPlatformStatuses(res.data.platformStatuses || {});
        
        // Initialize unread IDs for items marked unread
        const initialUnread = new Set(
          aggregatedItems.filter((i) => i.unread).map((i) => i.id)
        );
        setUnreadIds(initialUnread);

        // Auto-select first item if none selected
        if (aggregatedItems.length > 0 && !selectedItemId) {
          setSelectedItemId(aggregatedItems[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load inbox stream:", err);
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedItemId]);

  useEffect(() => {
    loadInboxStream();
  }, [loadInboxStream]);

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
    return items.find((i) => i.id === selectedItemId) || filteredItems[0] || null;
  }, [items, selectedItemId, filteredItems]);

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
        postId: selectedItem.postId,
        text: replyText.trim(),
      };

      const res = await apiClient.post("/api/inbox/reply", payload);
      if (res.data?.success) {
        // Increment confirmed reply count safely in session state
        setRepliedIds((prev) => new Set(prev).add(selectedItem.id));
        setReplySuccessMsg("Reply posted successfully!");
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
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 64px)",
        background: "var(--canvas, #f5f1ec)",
        fontFamily: "var(--font-body, system-ui)",
        color: "var(--ink, #111)",
        overflow: "hidden",
      }}
    >
      {/* ── Unified Prominent Page Header ── */}
      <div
        style={{
          background: "#ffffff",
          borderBottom: "1px solid #d3cec6",
          padding: "24px 32px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {/* Top Row: Title + Description (Left) | Replied Status Card (Right) */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, lineHeight: 1.1, letterSpacing: "-0.03em", color: "var(--ink, #111111)" }}>
              Social Inbox
            </h1>
            <p style={{ fontSize: 14, color: "var(--slate, #626260)", margin: "4px 0 0", fontWeight: 500 }}>
              Manage cross-platform comments, audience threads, and instant AI copilot responses in real time.
            </p>
          </div>

          {/* Replied Status Card */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              background: "#ffffff",
              padding: "12px 22px",
              borderRadius: 12,
              border: "1px solid #d3cec6",
              boxShadow: "0 4px 16px rgba(20,20,19,0.04)",
            }}
          >
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, color: "var(--slate)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Replied Status
              </div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "var(--ink)", marginTop: 2 }}>
                {confirmedX} <span style={{ fontWeight: 500, color: "var(--slate)", fontSize: 14 }}>/ {totalY}</span>
              </div>
            </div>
            <div style={{ width: 140, height: 8, background: "rgba(20,20,19,0.08)", borderRadius: 4, overflow: "hidden" }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.4 }}
                style={{ height: "100%", background: "linear-gradient(90deg, var(--arc, #ff5600), #ff7a38)" }}
              />
            </div>
            <button
              onClick={() => loadInboxStream(true)}
              disabled={refreshing}
              style={{
                border: "1px solid rgba(20,20,19,0.12)",
                background: "rgba(20,20,19,0.02)",
                borderRadius: 8,
                cursor: "pointer",
                color: "var(--slate)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 8,
                transition: "all 0.2s",
              }}
              title="Refresh stream"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
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
          style={{
            width: "clamp(320px, 26vw, 380px)",
            flexShrink: 0,
            borderRight: "1px solid #d3cec6",
            background: "#ffffff",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
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
                <div style={{ fontSize: 13 }}>Aggregating live comments...</div>
              </div>
            ) : filteredItems.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--slate)" }}>
                <MessageCircle size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>No comments found</div>
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
                    onClick={() => setSelectedItemId(item.id)}
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
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1, overflow: "hidden" }}>
                        <img src={getPlatformIcon(item.platform)} style={{ width: 16, height: 16, flexShrink: 0 }} alt="" />
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.authorName}
                        </span>
                        {showHandle && (
                          <span style={{ fontSize: 11, color: "var(--slate)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {item.authorHandle}
                          </span>
                        )}
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
        <div className="no-scrollbar" style={{ flex: 1, background: "var(--canvas, #f5f1ec)", overflowY: "auto", msOverflowStyle: "none", scrollbarWidth: "none", padding: 24, minHeight: 0 }}>
          {selectedItem ? (
            <div style={{ maxWidth: 820, margin: "0 auto" }}>
              {/* Post Context Banner */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  padding: 16,
                  border: "1px solid #d3cec6",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                {selectedItem.postThumbnail && (
                  <img
                    src={selectedItem.postThumbnail}
                    style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
                    alt=""
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <img src={getPlatformIcon(selectedItem.platform)} style={{ width: 16, height: 16, flexShrink: 0 }} alt="" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--slate)", textTransform: "capitalize" }}>
                      {selectedItem.platform} Post Context
                    </span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {selectedItem.postTitle}
                  </div>
                </div>
              </div>

              {/* Original Comment Card */}
              <div
                style={{
                  background: "#ffffff",
                  borderRadius: 12,
                  padding: 20,
                  border: "1px solid #d3cec6",
                  marginBottom: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  {selectedItem.authorAvatar ? (
                    <img src={selectedItem.authorAvatar} style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} alt="" />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "rgba(20,20,19,0.08)", display: "grid", placeItems: "center", fontWeight: 700, flexShrink: 0 }}>
                      {selectedItem.authorName?.[0] || "U"}
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 750, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {selectedItem.authorName}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--slate)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {selectedItem.authorHandle && selectedItem.authorHandle.toLowerCase() !== selectedItem.authorName.toLowerCase() ? `${selectedItem.authorHandle} · ` : ""}{timeAgo(selectedItem.createdAt)}
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.5, margin: "0 0 16px" }}>
                  {selectedItem.text}
                </p>

                {/* AI Copilot Action Buttons */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, pt: 12, borderTop: "1px solid rgba(20,20,19,0.06)" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "var(--slate)", display: "flex", alignItems: "center", gap: 4 }}>
                    <Sparkles size={13} style={{ color: "var(--arc, #ff5600)" }} /> AI Suggestions:
                  </span>
                  <button
                    onClick={() => handleAiCopilot("friendly")}
                    disabled={generatingAi}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 14,
                      border: "1px solid rgba(20,20,19,0.1)",
                      background: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Friendly
                  </button>
                  <button
                    onClick={() => handleAiCopilot("professional")}
                    disabled={generatingAi}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 14,
                      border: "1px solid rgba(20,20,19,0.1)",
                      background: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Professional
                  </button>
                  <button
                    onClick={() => handleAiCopilot("quick_thanks")}
                    disabled={generatingAi}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 14,
                      border: "1px solid rgba(20,20,19,0.1)",
                      background: "#fff",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Quick Thanks
                  </button>
                </div>
              </div>

              {/* Replies Thread */}
              {selectedItem.replies?.length > 0 && (
                <div style={{ paddingLeft: 18, borderLeft: "3px solid var(--arc, #ff5600)", marginBottom: 20, display: "grid", gap: 12 }}>
                  {selectedItem.replies.map((r) => {
                    const rName = r.authorName || selectedItem.accountName || "Account Owner";
                    const rHandle = r.authorHandle || `@${rName.toLowerCase().replace(/\s+/g, '')}`;
                    return (
                      <div key={r.id} style={{ background: "#ffffff", padding: 14, borderRadius: 10, border: "1px solid #d3cec6" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
                            {r.authorAvatar ? (
                              <img src={r.authorAvatar} style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0 }} alt="" />
                            ) : (
                              <div style={{ width: 26, height: 26, borderRadius: "50%", background: "rgba(255,86,0,0.1)", color: "var(--arc, #ff5600)", display: "grid", placeItems: "center", fontWeight: 750, fontSize: 11, flexShrink: 0 }}>
                                {rName[0]?.toUpperCase() || "A"}
                              </div>
                            )}
                            <span style={{ fontSize: 13, fontWeight: 750, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {rName}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--slate)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {rHandle}
                            </span>
                          </div>
                          <span style={{ fontSize: 11, color: "var(--slate)", flexShrink: 0 }}>{timeAgo(r.createdAt)}</span>
                        </div>
                        <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.45, paddingLeft: 34 }}>{r.text}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Reply Composer Box */}
              <div style={{ background: "#ffffff", borderRadius: 12, padding: 16, border: "1px solid #d3cec6" }}>
                <textarea
                  rows={4}
                  placeholder={`Replying to ${selectedItem.authorHandle}...`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  style={{
                    width: "100%",
                    border: "none",
                    outline: "none",
                    resize: "vertical",
                    fontSize: 14,
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />

                {replyErrorMsg && (
                  <div style={{ color: "#dc2626", fontSize: 12, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                    <AlertCircle size={14} /> {replyErrorMsg}
                  </div>
                )}
                {replySuccessMsg && (
                  <div style={{ color: "#16a34a", fontSize: 12, marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                    <CheckCircle2 size={14} /> {replySuccessMsg}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, pt: 12, borderTop: "1px solid rgba(20,20,19,0.06)" }}>
                  <span style={{ fontSize: 11, color: "var(--slate)" }}>{replyText.length} / 1248</span>
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sendingReply}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: replyText.trim() ? "var(--arc, #ff5600)" : "rgba(20,20,19,0.1)",
                      color: "#ffffff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: replyText.trim() ? "pointer" : "not-allowed",
                      transition: "all 0.2s",
                    }}
                  >
                    {sendingReply ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    {sendingReply ? "Sending..." : "Send Reply"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--slate)" }}>
              <div style={{ textAlign: "center" }}>
                <MessagesSquare size={48} style={{ opacity: 0.3, margin: "0 auto 12px" }} />
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>Select a comment thread to view details</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
