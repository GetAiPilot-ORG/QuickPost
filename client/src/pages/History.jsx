import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Image as ImageIcon,
  Video,
  Search,
  Filter,
  Calendar,
  ChevronDown,
  ChevronUp,
  Share2,
  Trash2,
} from "lucide-react";
import apiClient from "../utils/apiClient";
import InfoHelp from "../components/InfoHelp";
import { Skeleton } from "boneyard-js/react";
import { formatUserFriendlyError } from "../components/Analytics";

const API_BASE_URL = "/";

function History() {
  const { user } = useAuth();
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/api/broadcasts");
      setBroadcasts(response.data.broadcasts || []);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleDeletePost = async (id, e) => {
    e?.stopPropagation();
    const post = broadcasts.find((b) => b.id === id);
    const hasYt = post?.youtube_success || post?.youtube_video_id || post?.platform_data?.youtube?.videoId;
    const confirmMsg = hasYt
      ? "Are you sure you want to delete this post from QuickPost and YouTube?"
      : "Are you sure you want to delete this post?";
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await apiClient.delete(`/api/broadcasts/${id}`);
      if (res.data.success) {
        setBroadcasts((prev) => prev.filter((b) => b.id !== id));
      } else {
        alert(res.data?.error || "Failed to delete post.");
      }
    } catch (error) {
      console.error("Failed to delete post:", error);
      alert("Failed to delete post.");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Date unavailable";
    const date = new Date(dateString);
    if (!Number.isFinite(date.getTime())) return "Date unavailable";
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPlatformIcon = (id) => {
    const iconClass = "w-4 h-4 object-contain";
    switch (id.toLowerCase()) {
      case "facebook":
        return (
          <img
            src="/icons/facebook-round-color-icon.svg"
            className={iconClass}
            alt="Facebook"
          />
        );
      case "instagram":
        return (
          <img
            src="/icons/ig-instagram-icon.svg"
            className={iconClass}
            alt="Instagram"
          />
        );
      case "x":
        return (
          <img
            src="/icons/x-social-media-round-icon.svg"
            className={iconClass}
            alt="X"
          />
        );
      case "linkedin":
        return (
          <img
            src="/icons/linkedin-icon.svg"
            className={iconClass}
            alt="LinkedIn"
          />
        );

      case "youtube":
        return (
          <img
            src="/icons/youtube-color-icon.svg"
            className={iconClass}
            alt="YouTube"
          />
        );
      case "pinterest":
        return (
          <img
            src="/icons/pinterest-round-color-icon.svg"
            className={iconClass}
            alt="Pinterest"
          />
        );
      case "threads":
        return (
          <img
            src="/icons/threads-icon.svg"
            className={iconClass}
            alt="Threads"
          />
        );
      case "mastodon":
        return (
          <img
            src="/icons/mastodon-round-icon.svg"
            className={iconClass}
            alt="Mastodon"
          />
        );
      case "bluesky":
        return (
          <img
            src="/icons/bluesky-circle-color-icon.svg"
            className={iconClass}
            alt="Bluesky"
          />
        );
      case "reddit":
        return (
          <img
            src="/icons/reddit-icon.svg"
            className={iconClass}
            alt="Reddit"
          />
        );
      default:
        return <Share2 className="w-4 h-4" />;
    }
  };

  const filteredBroadcasts = broadcasts.filter((b) =>
    b.caption?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <div className="history-page">
      <style>{`
        .history-page {
          width: 100%;
          max-width: 1380px;
          margin: 0 auto;
          padding: 24px;
          color: var(--ink, #111);
        }
        .history-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }
        .history-title {
          margin: 0 0 6px;
          color: var(--ink, #111);
          font-size: 28px;
          font-weight: 650;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }
        .history-subtitle {
          margin: 0;
          color: var(--slate, #626260);
          font-size: 14px;
        }
        .history-toolbar {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        }
        .history-search {
          position: relative;
          width: min(280px, 42vw);
        }
        .history-search svg {
          position: absolute;
          left: 12px;
          top: 50%;
          width: 16px;
          height: 16px;
          color: var(--slate, #626260);
          transform: translateY(-50%);
          pointer-events: none;
        }
        .history-search input {
          width: 100%;
          min-height: 42px;
          padding: 9px 12px 9px 38px;
          border: 1px solid var(--dust, #d3cec6);
          border-radius: 8px;
          background: #fff;
          color: var(--ink, #111);
          font-size: 14px;
          outline: none;
          box-shadow: none;
        }
        .history-filter-btn {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--dust, #d3cec6);
          border-radius: 8px;
          background: #fff;
          color: var(--ink, #111);
          cursor: pointer;
        }
        .history-list {
          display: grid;
          gap: 12px;
        }
        .history-card {
          overflow: hidden;
          border: 1px solid var(--dust, #d3cec6);
          border-radius: 8px;
          background: #fff;
          box-shadow: none;
          transition: border-color 160ms ease, background 160ms ease;
        }
        .history-card:hover,
        .history-card.is-expanded {
          border-color: #bdb6ad;
          background: #fffefa;
        }
        .history-row {
          display: flex;
          align-items: center;
          gap: 16px;
          min-height: 108px;
          padding: 16px 20px;
          cursor: pointer;
        }
        .history-thumb {
          width: 72px;
          height: 72px;
          border: 1px solid var(--dust, #d3cec6);
          border-radius: 8px;
          flex-shrink: 0;
          overflow: hidden;
          position: relative;
          background: #ebe7e1;
        }
        .history-chevron {
          width: 32px;
          height: 32px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 0;
          border-radius: 50%;
          background: #f0ebe4;
          color: var(--slate, #626260);
          flex-shrink: 0;
        }
        .history-empty {
          padding: 48px 20px;
          border: 1px solid var(--dust, #d3cec6);
          border-radius: 8px;
          background: #fff;
          text-align: center;
        }
        .history-expanded {
          padding: 16px 20px 20px;
          border-top: 1px solid rgba(20,20,19,0.08);
          background: #faf8f5;
        }
        .history-detail-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 10px;
        }
        .history-detail-card {
          padding: 14px;
          border: 1px solid var(--dust, #d3cec6);
          border-radius: 8px;
          background: #fff;
        }
        .history-detail-card h4 {
          margin: 0 0 10px;
          color: var(--slate, #626260);
          font-size: 11px;
          font-weight: 650;
        }
        .history-meta {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 240px;
          gap: 10px;
          margin-top: 12px;
        }
        .history-meta-card {
          min-width: 0;
          padding: 14px;
          border: 1px solid var(--dust, #d3cec6);
          border-radius: 8px;
          background: #fff;
        }
        .history-meta-card h4 {
          margin: 0 0 10px;
          color: var(--slate, #626260);
          font-size: 11px;
          font-weight: 650;
        }
        .history-date {
          display: flex;
          align-items: center;
          gap: 7px;
          color: var(--slate, #626260);
          font-size: 11px;
          font-weight: 650;
          letter-spacing: 0;
          text-transform: none;
        }
        .history-caption {
          margin: 8px 0 12px;
          color: var(--ink, #111);
          font-size: 18px;
          font-weight: 650;
          line-height: 1.25;
        }
        .history-status-pill {
          padding: 4px 8px;
          border: 1px solid #cfd6ff;
          border-radius: 999px;
          background: #eef1ff;
          color: #4f58b8;
          font-size: 10px;
          font-weight: 650;
        }
        .history-platform-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 9px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 650;
        }
        .history-platform-pill.success {
          border: 1px solid #bfe8cc;
          background: #effbf3;
          color: #087832;
        }
        .history-platform-pill.failed {
          border: 1px solid #fac7c2;
          background: #fff1ef;
          color: #b62216;
        }
        @media (max-width: 768px) {
          .history-page { padding: 18px 14px 32px; }
          .history-header { align-items: stretch; flex-direction: column; }
          .history-toolbar { width: 100%; }
          .history-search { width: 100%; flex: 1 1 auto; }
          .history-row { align-items: flex-start; padding: 14px; }
          .history-thumb { width: 62px; height: 62px; }
          .history-caption { font-size: 16px; }
          .history-meta { grid-template-columns: 1fr; }
        }
      `}</style>
      <div className="history-header">
        <div>
          <h1 className="history-title" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            Post History
            <InfoHelp text="Chronological ledger of all completed multi-channel social broadcasts with delivery status and live URLs" />
          </h1>
          <p className="history-subtitle">Review and track your multi-platform broadcasts</p>
        </div>

        <div className="history-toolbar">
          <div className="history-search">
            <Search />
            <input
              type="text"
              placeholder="Search posts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button type="button" className="history-filter-btn" aria-label="Filter posts">
            <Filter className="w-5 h-5" />
          </button>
        </div>
      </div>

      <Skeleton
        name="history-list"
        loading={loading}
        fixture={
          <div className="history-list">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-28 bg-white rounded-lg border border-gray-200"
              />
            ))}
          </div>
        }
      >
        {filteredBroadcasts.length === 0 ? (
          <div className="history-empty">
            <img src="https://illustrations.popsy.co/amber/success.svg" alt="No posts found" className="h-40 object-contain mx-auto mb-6" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No posts found
            </h3>
            <p className="text-gray-600 mb-8">
              You haven't broadcasted anything yet.
            </p>
          </div>
        ) : (
          <div className="history-list">
            {filteredBroadcasts.map((post) => {
              const selectedBasePlatforms = new Set([
                ...(post.selected_channels || []),
                ...(post.platform_data?.selectedChannels || []),
              ].map((channel) => String(channel).split(":")[0]));
              const platforms = [
                {
                  id: "linkedin",
                  success: post.linkedin_success,
                  name: "LinkedIn",
                  error: post.linkedin_error,
                  url: post.linkedin_url,
                },
                {
                  id: "youtube",
                  success: post.youtube_success,
                  name: "YouTube",
                  error: post.youtube_error,
                  url: post.youtube_shorts_url || post.youtube_url,
                },
                {
                  id: "instagram",
                  success: post.instagram_success || (selectedBasePlatforms.has("instagram") && post.status === "sent"),
                  name: "Instagram",
                  error: post.instagram_error,
                  url: post.instagram_url,
                },
                {
                  id: "facebook",
                  success: post.facebook_success,
                  name: "Facebook",
                  error: post.facebook_error,
                  url: post.facebook_url,
                },

                {
                  id: "mastodon",
                  success: post.mastodon_success,
                  name: "Mastodon",
                  error: post.mastodon_error,
                  url: post.mastodon_url,
                },
                {
                  id: "bluesky",
                  success: post.bluesky_success,
                  name: "Bluesky",
                  error: post.bluesky_error,
                  url: post.bluesky_url,
                },
                {
                  id: "pinterest",
                  success: post.pinterest_success,
                  name: "Pinterest",
                  error: post.pinterest_error,
                  url: post.pinterest_url,
                },
                {
                  id: "threads",
                  success: post.threads_success,
                  name: "Threads",
                  error: post.threads_error,
                  url: post.threads_url,
                },
                {
                  id: "x",
                  success: post.x_success,
                  name: "X",
                  error: post.x_error,
                  url: post.x_url,
                },
                {
                  id: "reddit",
                  success: post.reddit_success,
                  name: "Reddit",
                  error: post.reddit_error,
                  url: post.reddit_url,
                },
              ].map((platform) => ({
                ...platform,
                selected: selectedBasePlatforms.has(platform.id),
              })).filter(
                (p) => p.selected || p.success || (p.error && p.error !== "Not selected"),
              );

              return (
                <div
                  key={post.id}
                  className={`history-card ${expandedId === post.id ? "is-expanded" : ""}`}
                >
                  <div
                    className="history-row"
                    onClick={() => toggleExpand(post.id)}
                  >
                    {/* Media Preview */}
                    <div className="history-thumb">
                      {post.media_url ? (
                        <img
                          src={post.media_url}
                          alt="Preview"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src =
                              "https://placehold.co/150x150?text=Invalid+Image";
                          }}
                        />
                      ) : post.media_type === "image" ||
                        (post.video_filename &&
                          /\.(jpg|jpeg|png|gif|webp)$/i.test(
                            post.video_filename,
                          )) ? (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-blue-50">
                          <ImageIcon className="w-8 h-8 text-blue-200 mb-1" />
                          <span className="text-[10px] text-blue-300 font-bold uppercase tracking-widest">
                            Image
                          </span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900">
                          <Video className="w-8 h-8 text-white opacity-50 mb-1" />
                          <span className="text-[10px] text-white/50 font-bold uppercase">
                            Video
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content Summary */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="history-date">
                          <Calendar className="w-3.5 h-3.5" />
                          {post.status === "scheduled"
                            ? `Scheduled for ${formatDate(post.scheduled_for)}`
                            : formatDate(post.posted_at || post.created_at)}
                        </div>
                        <div className="flex items-center gap-2">
                          {post.status === "scheduled" && (
                            <span className="history-status-pill">
                              Scheduled
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDeletePost(post.id, e)}
                            className="p-1.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                            title="Delete Post"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="history-chevron">
                            {expandedId === post.id ? (
                              <ChevronUp className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      <h3 className="history-caption line-clamp-1 pr-8">
                        {post.caption || "Untitled Broadcast"}
                      </h3>

                      {/* Platform Quick Status (Only show attempted ones) */}
                      <div className="flex flex-wrap gap-2">
                        {platforms.map((platform) => (
                          <div
                            key={platform.id}
                            className={`history-platform-pill ${
                              platform.success
                                ? "success"
                                : "failed"
                            }`}
                          >
                            {getPlatformIcon(platform.id)}
                            <span>{platform.name}</span>
                            {platform.success ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : (
                              <XCircle className="w-3 h-3" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Breakdown */}
                  {expandedId === post.id && (
                    <div className="history-expanded animate-in slide-in-from-top-2 duration-300">
                      <div className="history-detail-grid">
                        {platforms.map((platform) => (
                          <div
                            key={platform.id}
                            className="history-detail-card"
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2 text-sm">
                                {getPlatformIcon(platform.id)}
                                <span className="font-bold text-gray-800">
                                  {platform.name}
                                </span>
                              </div>
                              {platform.success ? (
                                <span className="text-[9px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter shadow-sm border border-green-200">
                                  Success
                                </span>
                              ) : (
                                <span className="text-[9px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter shadow-sm border border-red-200">
                                  Failed
                                </span>
                              )}
                            </div>

                            {platform.success ? (
                              <div className="space-y-3">
                                {platform.url && (
                                  <a
                                    href={platform.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 font-bold transition-colors group"
                                  >
                                    <span>View Live Post</span>
                                    <ExternalLink className="w-3 h-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                  </a>
                                )}
                              </div>
                            ) : (
                              <div className="text-[11px] text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200 leading-snug">
                                {formatUserFriendlyError(platform.error || post.last_error, platform.id) ||
                                  "Failed to publish to this channel"}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Meta Data */}
                      <div className="history-meta">
                        <div className="history-meta-card">
                          <h4>
                            Full Caption
                          </h4>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                            {post.caption || "(Empty caption)"}
                          </p>
                        </div>

                        <div className="history-meta-card flex flex-col items-center justify-center text-center">
                          <h4>
                            Media Data
                          </h4>
                          {post.media_type === "image" ||
                          (post.video_filename &&
                            /\.(jpg|jpeg|png|gif|webp)$/i.test(
                              post.video_filename,
                            )) ? (
                            <ImageIcon className="w-8 h-8 text-blue-100 mb-2" />
                          ) : (
                            <Video className="w-8 h-8 text-blue-100 mb-2" />
                          )}
                          <span className="text-xs font-bold text-gray-600 uppercase">
                            {post.media_type}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono mt-1 break-all">
                            {post.video_filename}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Skeleton>
    </div>
  );
}

export default History;
