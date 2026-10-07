/**
 * PreviewPanel.jsx
 * ─────────────────────────────────────────────────────────────────
 * Live post preview panel — renders platform-accurate UI shells
 * using the same overlay components from PostPreviewModal.
 * Integrates platform tabs, format switching, and crossfade transitions.
 *
 * Props:
 *   selectedChannels:         string[]
 *   caption:                  string
 *   mediaFiles:               [{ id, file }]
 *   selectedRatio:            string  e.g. "1:1"
 *   youtubeThumbnail:         File | null
 *   activePlatform:           string
 *   onActivePlatformChange:   fn(platformId)
 *   connectedAccounts:        object
 */

import React, { useState, useEffect, useMemo, useRef, memo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePlatformMetrics } from "../../../utils/metrics";
import {
  Eye,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Share2,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Repeat,
  Film,
  Play,
} from "lucide-react";
import { PLATFORM_META, ASPECT_RATIOS } from "../data/platforms.js";

/* ── Stable blob URL hook ── */
function useBlobUrl(file) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    if (typeof file === "string") {
      setUrl(file);
      return;
    }
    try {
      const u = URL.createObjectURL(file);
      setUrl(u);
      return () => URL.revokeObjectURL(u);
    } catch {
      setUrl(null);
    }
  }, [file]);
  return url;
}

/* ── Media carousel ── */
const MediaCarousel = memo(function MediaCarousel({ mediaFiles, cssClass }) {
  const [idx, setIdx] = useState(0);
  const [urls, setUrls] = useState([]);

  useEffect(() => {
    if (!mediaFiles?.length) {
      setUrls([]);
      return;
    }
    const created = mediaFiles.map((m) => ({
      id: m.id,
      url: URL.createObjectURL(m.file),
      isVideo: m.file.type.startsWith("video/"),
    }));
    setUrls(created);
    return () => created.forEach((u) => URL.revokeObjectURL(u.url));
  }, [mediaFiles]);

  // Reset index when files change
  useEffect(() => {
    setIdx(0);
  }, [mediaFiles?.length]);

  if (!urls.length) {
    return (
      <div
        className={`w-full ${cssClass} flex flex-col items-center justify-center bg-gray-100`}
      >
        <Film size={24} style={{ color: "#ccc", marginBottom: 4 }} />
        <span style={{ fontSize: 10, color: "#aaa" }}>No media</span>
      </div>
    );
  }

  const current = urls[idx];
  return (
    <div className={`relative w-full ${cssClass} overflow-hidden bg-gray-900`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={current.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{ position: "absolute", inset: 0 }}
        >
          {current.isVideo ? (
            <video
              src={current.url}
              className="w-full h-full object-contain bg-black"
              muted
              playsInline
              autoPlay
              loop
            />
          ) : (
            <img
              src={current.url}
              className="w-full h-full object-contain bg-black"
              alt=""
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Dot indicators */}
      {urls.length > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 6,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 4,
            zIndex: 2,
          }}
        >
          {urls.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              style={{
                width: i === idx ? 16 : 5,
                height: 5,
                borderRadius: 3,
                border: "none",
                background: i === idx ? "white" : "rgba(255,255,255,0.5)",
                transition: "all 0.2s",
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/* ── Platform-specific preview shells ── */

const UserAvatar = ({ user, picture, size = 28, background = "#eee" }) => {
  const [imgError, setImgError] = useState(false);
  const displayPicture = picture || user?.picture;
  const initials = user?.name ? user.name[0].toUpperCase() : "?";

  // Reset error state if picture changes
  useEffect(() => {
    setImgError(false);
  }, [displayPicture]);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        background: (imgError || !displayPicture) ? "var(--ink, #111111)" : background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {displayPicture && !imgError ? (
        <img
          src={displayPicture}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
          alt=""
          onError={() => setImgError(true)}
        />
      ) : (
        <span
          style={{
            fontSize: size * 0.4,
            fontWeight: 800,
            color: "white",
          }}
        >
          {initials}
        </span>
      )}
    </div>
  );
};

const InstagramPreview = memo(
  ({ caption, mediaFiles, cssClass, user, platformPicture, platformUsername, selectedRatio, selectedSizePreset, thumbnailFile }) => {
    const metrics = usePlatformMetrics(caption);
    const username =
      platformUsername ||
      user?.name?.toLowerCase().replace(/\s+/g, "_") ||
      "your_account";

    const isReel = selectedSizePreset === "ig-reel";
    const isStory = selectedSizePreset === "ig-story";

    const primaryVideoMedia = useMemo(() => {
      if (!mediaFiles?.length) return null;
      return (
        mediaFiles.find((m) =>
          m.file?.type?.startsWith("video/") ||
          m.type === "video" ||
          /\.(mp4|mov|webm)$/i.test(m.url || "")
        ) || null
      );
    }, [mediaFiles]);

    const rawVideoSource = primaryVideoMedia?.file || primaryVideoMedia?.url || null;
    const reelVideoUrl = useBlobUrl(rawVideoSource);
    const coverUrl = useBlobUrl(thumbnailFile);

    const [isHovered, setIsHovered] = useState(false);
    const videoRef = useRef(null);

    useEffect(() => {
      const video = videoRef.current;
      if (!video) return;

      if (isHovered && reelVideoUrl) {
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {});
        }
      } else {
        video.pause();
      }
    }, [isHovered, reelVideoUrl]);

    if (isReel) {
      return (
        <div
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => {
            if (!reelVideoUrl) return;
            const video = videoRef.current;
            if (!video) return;
            if (video.paused) {
              video.play().catch(() => {});
              setIsHovered(true);
            } else {
              video.pause();
              setIsHovered(false);
            }
          }}
          style={{
            background: "#000",
            borderRadius: 12,
            overflow: "hidden",
            position: "relative",
            aspectRatio: "9/16",
            cursor: reelVideoUrl ? "pointer" : "default",
          }}
        >
          {reelVideoUrl ? (
            <>
              <video
                ref={videoRef}
                src={reelVideoUrl}
                muted
                playsInline
                loop
                preload="metadata"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  position: "absolute",
                  inset: 0,
                  background: "#000",
                }}
              />
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt="Reel Cover"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    zIndex: 1,
                    transition: "opacity 0.25s ease",
                    opacity: isHovered ? 0 : 1,
                    pointerEvents: "none",
                  }}
                />
              )}
              {/* Subtle play indicator when paused and not hovered */}
              {!isHovered && (
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: 44,
                    height: 44,
                    borderRadius: "50%",
                    background: "rgba(0, 0, 0, 0.45)",
                    backdropFilter: "blur(4px)",
                    WebkitBackdropFilter: "blur(4px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 2,
                    pointerEvents: "none",
                    transition: "opacity 0.2s ease, transform 0.2s ease",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
                    border: "1px solid rgba(255,255,255,0.25)",
                  }}
                >
                  <Play size={20} color="white" style={{ marginLeft: 2 }} />
                </div>
              )}
            </>
          ) : coverUrl ? (
            <img
              src={coverUrl}
              alt="Reel Cover"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <MediaCarousel mediaFiles={mediaFiles} cssClass={cssClass} />
          )}

          {/* Reel Overlays */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "60px 12px 16px",
              background: "linear-gradient(transparent, rgba(0,0,0,0.8))",
              pointerEvents: "none",
              zIndex: 3,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <UserAvatar user={user} picture={platformPicture} size={28} />
              <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>{username}</span>
              <button style={{ border: "1px solid white", background: "none", color: "white", fontSize: 10, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>Follow</button>
            </div>
            <p style={{ color: "white", fontSize: 12, margin: 0, lineHeight: 1.4, maxWidth: "85%", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {caption || "Amazing reel content... #reel #viral"}
            </p>
          </div>
          <div style={{ position: "absolute", right: 10, bottom: 40, display: "flex", flexDirection: "column", gap: 18, alignItems: "center", zIndex: 3 }}>
            <div style={{ textAlign: "center" }}><Heart size={24} color="white" /><span style={{ color: "white", fontSize: 10, marginTop: 2 }}>{metrics.likes}</span></div>
            <div style={{ textAlign: "center" }}><MessageCircle size={24} color="white" /><span style={{ color: "white", fontSize: 10, marginTop: 2 }}>{metrics.comments}</span></div>
            <Send size={24} color="white" />
            <MoreHorizontal size={24} color="white" />
            <div style={{ width: 24, height: 24, borderRadius: 4, border: "2px solid white", overflow: "hidden" }}>
              <UserAvatar user={user} picture={platformPicture} size={24} />
            </div>
          </div>
        </div>
      );
    }

    if (isStory) {
      return (
        <div
          style={{
            background: "#000",
            borderRadius: 12,
            overflow: "hidden",
            position: "relative",
            aspectRatio: "9/16",
          }}
        >
          <MediaCarousel mediaFiles={mediaFiles} cssClass={cssClass} />
          {/* Story Progress Bars */}
          <div style={{ position: "absolute", top: 8, left: 0, right: 0, padding: "0 8px", display: "flex", gap: 4 }}>
            <div style={{ flex: 1, height: 2, background: "white", borderRadius: 2 }} />
            <div style={{ flex: 1, height: 2, background: "rgba(255,255,255,0.4)", borderRadius: 2 }} />
          </div>
          {/* Story Header */}
          <div style={{ position: "absolute", top: 20, left: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <UserAvatar user={user} picture={platformPicture} size={32} />
            <span style={{ color: "white", fontSize: 12, fontWeight: 700 }}>{username}</span>
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: 11 }}>1h</span>
          </div>
          <div style={{ position: "absolute", top: 24, right: 12 }}>
            <MoreHorizontal size={20} color="white" />
          </div>
          {/* Story Bottom Reply */}
          <div style={{ position: "absolute", bottom: 16, left: 12, right: 12, display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, border: "1px solid rgba(255,255,255,0.5)", borderRadius: 20, padding: "8px 16px", color: "white", fontSize: 13 }}>
              Send message
            </div>
            <Heart size={24} color="white" />
            <Send size={24} color="white" />
          </div>
        </div>
      );
    }

    return (
      <div
        style={{
          background: "white",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
          }}
        >
          <UserAvatar
            user={user}
            picture={platformPicture}
            size={28}
            background="linear-gradient(45deg,#f09433,#dc2743,#bc1888)"
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#111" }}>
            {username}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#666" }}>
            Follow
          </span>
        </div>

        <MediaCarousel mediaFiles={mediaFiles} cssClass={cssClass} />

        <div style={{ padding: "8px 12px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <div style={{ display: "flex", gap: 14 }}>
              <Heart size={18} style={{ color: "#111" }} />
              <MessageCircle size={18} style={{ color: "#111" }} />
              <Send size={18} style={{ color: "#111" }} />
            </div>
            <Bookmark size={18} style={{ color: "#111" }} />
          </div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#111",
              margin: "0 0 3px",
            }}
          >
            {metrics.likes.toLocaleString()} likes
          </p>
          {caption && (
            <p
              style={{
                fontSize: 11,
                color: "#111",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              <span style={{ fontWeight: 700, marginRight: 4 }}>
                {username}
              </span>
              {caption}
            </p>
          )}
          <p
            style={{
              fontSize: 10,
              color: "#888",
              marginTop: 4,
            }}
          >
            {metrics.timestamp}
          </p>
        </div>
      </div>
    );
  },
);

const YouTubePreview = memo(
  ({
    caption,
    mediaFiles,
    cssClass,
    user,
    thumbnailFile,
    platformPicture,
    platformUsername,
    selectedRatio,
    selectedSizePreset,
  }) => {
    const thumbUrl = useBlobUrl(thumbnailFile);
    const metrics = usePlatformMetrics(caption);
    const username = platformUsername || user?.name || "Your Channel";
    const isShorts = selectedSizePreset === "yt-shorts";

    if (isShorts) {
      return (
        <div
          style={{
            background: "#000",
            borderRadius: 12,
            overflow: "hidden",
            position: "relative",
            aspectRatio: "9/16",
          }}
        >
          {thumbUrl ? (
            <img
              src={thumbUrl}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              alt="Custom Shorts Thumbnail"
            />
          ) : (
            <MediaCarousel mediaFiles={mediaFiles} cssClass={cssClass} />
          )}
          {/* Shorts Overlay */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "80px 12px 16px",
              background: "linear-gradient(transparent, rgba(0,0,0,0.9))",
              pointerEvents: "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <UserAvatar user={user} picture="/icons/youtube-color-icon.svg" size={36} background="#fff" />
              <span style={{ color: "white", fontSize: 14, fontWeight: 700 }}>@{username.replace(/\s+/g, "").toLowerCase()}</span>
              <button style={{ background: "white", color: "black", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 20 }}>Subscribe</button>
            </div>
            <p style={{ color: "white", fontSize: 14, margin: 0, lineHeight: 1.4, maxWidth: "80%", fontWeight: 500 }}>
              {caption || "This is a YouTube Short #shorts"}
            </p>
          </div>
          <div style={{ position: "absolute", right: 10, bottom: 60, display: "flex", flexDirection: "column", gap: 24, alignItems: "center" }}>
            <div style={{ textAlign: "center" }}><ThumbsUp size={26} color="white" fill="white" /><span style={{ color: "white", fontSize: 11, marginTop: 4, fontWeight: 600 }}>{metrics.likes}</span></div>
            <div style={{ textAlign: "center" }}><ThumbsDown size={26} color="white" fill="white" /><span style={{ color: "white", fontSize: 11, marginTop: 4, fontWeight: 600 }}>Dislike</span></div>
            <div style={{ textAlign: "center" }}><MessageSquare size={26} color="white" fill="white" /><span style={{ color: "white", fontSize: 11, marginTop: 4, fontWeight: 600 }}>{metrics.comments}</span></div>
            <div style={{ textAlign: "center" }}><Share2 size={26} color="white" fill="white" /><span style={{ color: "white", fontSize: 11, marginTop: 4, fontWeight: 600 }}>Share</span></div>
            <div style={{ width: 32, height: 32, borderRadius: 6, border: "2px solid white", overflow: "hidden" }}>
               <UserAvatar user={user} picture="/icons/youtube-color-icon.svg" size={32} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div 
        style={{ 
          background: "white", 
          borderRadius: 12, 
          overflow: "hidden",
          border: "1px solid #e5e7eb",
          boxShadow: "0 2px 8px rgba(0,0,0,0.02)"
        }}
      >
        <div
          className={`relative w-full ${cssClass}`}
          style={{ overflow: "hidden", background: "#f8f9fa" }}
        >
          {thumbUrl ? (
            <img
              src={thumbUrl}
              className="w-full h-full object-contain bg-black"
              alt="Thumbnail"
            />
          ) : (
            <MediaCarousel mediaFiles={mediaFiles} cssClass={cssClass} />
          )}
          <span
            style={{
              position: "absolute",
              bottom: 6,
              right: 6,
              background: "rgba(0,0,0,0.8)",
              color: "white",
              fontSize: 9,
              fontWeight: 800,
              padding: "2px 5px",
              borderRadius: 4,
            }}
          >
            0:00
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, padding: "12px" }}>
          <UserAvatar user={user} picture={platformPicture} size={36} background="#e00" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#0f0f0f",
                margin: 0,
                lineHeight: 1.4,
              }}
            >
              {caption || "Video Title"}
            </p>
            <p style={{ fontSize: 11, color: "#606060", margin: "4px 0 0" }}>
              {username} • {metrics.views.toLocaleString()} views •{" "}
              {metrics.timestamp}
            </p>
          </div>
        </div>
      </div>
    );
  },
);

const FacebookPreview = memo(
  ({ caption, mediaFiles, cssClass, user, platformPicture, platformUsername }) => {
    const metrics = usePlatformMetrics(caption);
    const username = platformUsername || user?.name || "Your Account";

    return (
      <div
        style={{
          background: "white",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 12px",
          }}
        >
          <UserAvatar user={user} picture={platformPicture} size={36} background="#1877F2" />
          <div>
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#111",
                margin: 0,
              }}
            >
              {username}
            </p>
            <p style={{ fontSize: 11, color: "#666", margin: 0 }}>
              {metrics.timestamp} · 🌍
            </p>
          </div>
          <MoreHorizontal
            size={18}
            style={{ color: "#666", marginLeft: "auto" }}
          />
        </div>
        {caption && (
          <p
            style={{
              fontSize: 13,
              color: "#111",
              padding: "0 12px 10px",
              lineHeight: 1.4,
            }}
          >
            {caption}
          </p>
        )}
        <MediaCarousel mediaFiles={mediaFiles} cssClass={cssClass} />
        <div
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid #f0f2f5",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div
              style={{
                background: "#1877F2",
                width: 14,
                height: 14,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ThumbsUp size={8} color="white" fill="white" />
            </div>
            <span style={{ fontSize: 11, color: "#666" }}>
              {metrics.likes.toLocaleString()}
            </span>
          </div>
          <span style={{ fontSize: 11, color: "#666" }}>
            {metrics.comments.toLocaleString()} comments ·{" "}
            {metrics.shares.toLocaleString()} shares
          </span>
        </div>
        <div
          style={{
            display: "flex",
            padding: "4px 0",
          }}
        >
          {[
            ["👍", "Like"],
            ["💬", "Comment"],
            ["↗️", "Share"],
          ].map(([icon, label]) => (
            <button
              key={label}
              style={{
                flex: 1,
                padding: "8px 0",
                background: "none",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                color: "#65676b",
                cursor: "pointer",
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>
      </div>
    );
  },
);

const LinkedInPreview = memo(
  ({ caption, mediaFiles, cssClass, user, platformPicture, platformUsername }) => {
    const metrics = usePlatformMetrics(caption);
    const username = platformUsername || user?.name || "Your Name";

    return (
      <div
        style={{
          background: "white",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            padding: "12px 12px 8px",
            alignItems: "flex-start",
          }}
        >
          <UserAvatar user={user} picture={platformPicture} size={40} background="#0A66C2" />
          <div style={{ flex: 1 }}>
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#111",
                margin: 0,
              }}
            >
              {username}
            </p>
            <p style={{ fontSize: 11, color: "#666", margin: 0 }}>
              Account Manager · 1st
            </p>
            <p style={{ fontSize: 11, color: "#666", margin: 0 }}>
              {metrics.timestamp} · 🌐
            </p>
          </div>
        </div>
        {caption && (
          <p
            style={{
              fontSize: 13,
              color: "#111",
              padding: "0 12px 10px",
              lineHeight: 1.4,
            }}
          >
            {caption}
          </p>
        )}
        <MediaCarousel mediaFiles={mediaFiles} cssClass={cssClass} />
        <div
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid #f0f2f5",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <ThumbsUp size={12} color="#0a66c2" fill="#0a66c2" />
          <Heart size={12} color="#df704d" fill="#df704d" />
          <span style={{ fontSize: 11, color: "#666", marginLeft: 4 }}>
            {metrics.likes.toLocaleString()} ·{" "}
            {metrics.comments.toLocaleString()} comments
          </span>
        </div>
        <div
          style={{
            display: "flex",
            padding: "4px 0",
          }}
        >
          {["👍 Like", "💬 Comment", "🔁 Repost", "↗️ Send"].map((a) => (
            <button
              key={a}
              style={{
                flex: 1,
                padding: "8px 0",
                background: "none",
                border: "none",
                fontSize: 12,
                fontWeight: 600,
                color: "#666",
                cursor: "pointer",
              }}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    );
  },
);

const XPreview = memo(
  ({ caption, mediaFiles, cssClass, user, platformPicture, platformUsername }) => {
    const metrics = usePlatformMetrics(caption);
    const username = platformUsername || user?.name || "Your Name";
    const handle = platformUsername
      ? `@${platformUsername}`
      : `@${user?.name?.toLowerCase().replace(/\s+/g, "") || "handle"}`;

    return (
      <div
        style={{
          background: "#000",
          borderRadius: 12,
          overflow: "hidden",
          padding: "12px",
        }}
      >
        <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
          <UserAvatar user={user} picture={platformPicture} size={36} background="#333" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                gap: 4,
                alignItems: "baseline",
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>
                {username}
              </span>
              <span style={{ fontSize: 12, color: "#71767b" }}>
                @{handle} · 1m
              </span>
            </div>
            {caption && (
              <p
                style={{
                  fontSize: 13,
                  color: "white",
                  margin: "4px 0 8px",
                  lineHeight: 1.5,
                }}
              >
                {caption}
              </p>
            )}
          </div>
        </div>
        <div
          style={{
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid #333",
          }}
        >
          <MediaCarousel mediaFiles={mediaFiles} cssClass={cssClass} />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 10,
            padding: "0 4px",
          }}
        >
          {[
            [MessageSquare, metrics.comments.toLocaleString()],
            [Repeat, metrics.retweets.toLocaleString()],
            [Heart, metrics.likes.toLocaleString()],
            [Share2, ""],
          ].map(([Icon, val], i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                color: "#71767b",
              }}
            >
              <Icon size={16} />
              <span style={{ fontSize: 11 }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    );
  },
);

const ThreadsPreview = memo(
  ({ caption, mediaFiles, cssClass, user, platformPicture, platformUsername }) => {
    const metrics = usePlatformMetrics(caption);
    const username = platformUsername || user?.name?.toLowerCase().replace(/\s+/g, "_") || "yourhandle";

    return (
      <div style={{ background: "white", borderRadius: 8, overflow: "hidden", border: "1px solid #d3d3d3" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, height: 44, padding: "0 14px", color: "#000" }}>
          <span style={{ fontSize: 20, lineHeight: 1 }}>‹</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>Thread</span>
          <MoreHorizontal size={18} style={{ marginLeft: "auto" }} />
        </div>
        <div style={{ border: "1px solid #d9d9d9", borderRadius: 22, margin: "0 8px", padding: 14 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <UserAvatar user={user} picture={platformPicture} size={34} background="#eee" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: "#000" }}>{username}</span>
                <span style={{ fontSize: 12, color: "#8b8b8b" }}>{metrics.timestamp}</span>
                <MoreHorizontal size={16} style={{ marginLeft: "auto", color: "#aaa" }} />
              </div>
              {caption && (
                <p style={{ margin: "0 0 10px", fontSize: 13, lineHeight: 1.35, color: "#000" }}>{caption}</p>
              )}
              <div style={{ borderRadius: 6, overflow: "hidden", border: "1px solid #eee" }}>
                <MediaCarousel mediaFiles={mediaFiles} cssClass={cssClass} />
              </div>
              <div style={{ display: "flex", gap: 18, marginTop: 12, color: "#111" }}>
                <Heart size={18} />
                <MessageCircle size={18} />
                <Repeat size={18} />
                <Send size={18} />
              </div>
            </div>
          </div>
        </div>
        <div style={{ borderLeft: "1px solid #d9d9d9", borderRight: "1px solid #d9d9d9", margin: "0 8px", padding: "14px 16px 18px" }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#8b8b8b" }}>No replies yet</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2e2e2", borderRadius: 999, background: "#f7f7f7", padding: "7px 10px" }}>
            <UserAvatar user={user} picture={platformPicture} size={26} background="#eee" />
            <span style={{ fontSize: 12, color: "#9a9a9a" }}>Reply to {username}...</span>
          </div>
        </div>
      </div>
    );
  },
);

/* Generic fallback for Threads, Bluesky, etc. */
const GenericPreview = memo(
  ({ caption, mediaFiles, cssClass, user, platformPicture, platformId }) => {
    const meta = PLATFORM_META[platformId];
    return (
      <div
        style={{
          background: "white",
          borderRadius: 12,
          overflow: "hidden",
          border: "1px solid #e5e7eb",
        }}
      >
        <div style={{ display: "flex", gap: 8, padding: "10px 12px" }}>
          <UserAvatar
            user={user}
            picture={platformPicture}
            size={28}
            background={meta?.color || "#888"}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#111" }}>
            {user?.name || "Your Account"}
          </span>
        </div>
        <MediaCarousel mediaFiles={mediaFiles} cssClass={cssClass} />
        {caption && (
          <p
            style={{
              fontSize: 12,
              color: "#111",
              padding: "12px",
              lineHeight: 1.4,
            }}
          >
            {caption}
          </p>
        )}
      </div>
    );
  },
);

/* ── Map platformId → preview component ── */
const PREVIEW_MAP = {
  instagram: InstagramPreview,
  youtube: YouTubePreview,
  facebook: FacebookPreview,
  linkedin: LinkedInPreview,
  x: XPreview,
  threads: ThreadsPreview,
};

/* ── Main PreviewPanel ── */
const PreviewPanel = memo(function PreviewPanel({
  user,
  selectedChannels,
  caption,
  mediaFiles,
  selectedRatio,
  selectedSizePreset,
  youtubeThumbnail,
  instagramCover,
  activePlatform,
  onActivePlatformChange,
  connectedAccounts,
}) {
  const activeId = activePlatform || selectedChannels[0] || null;
  const baseActiveId = String(activeId || "").split(":")[0];
  const selectedAccountId = String(activeId || "").includes(":")
    ? String(activeId).split(":")[1]
    : null;
  const selectedInstagramAccount = baseActiveId === "instagram" && selectedAccountId
    ? connectedAccounts?.instagramAccounts?.find((account) => String(account.id) === selectedAccountId)
    : null;
  const selectedPlatformAccount = selectedAccountId
    ? connectedAccounts?.[`${baseActiveId}Accounts`]?.find((account) => String(account.id) === selectedAccountId)
    : null;

  // Compute CSS class for the media container from the selected ratio
  const cssClass = useMemo(() => {
    const found = ASPECT_RATIOS.find((r) => r.id === selectedRatio);
    return found?.cssClass || "aspect-square";
  }, [selectedRatio]);

  const PreviewComponent = PREVIEW_MAP[baseActiveId] || GenericPreview;
  const platformUsername = selectedInstagramAccount?.username || selectedPlatformAccount?.username || connectedAccounts?.[baseActiveId]?.username || "your_account";
  const platformPicture = selectedInstagramAccount?.profilePicture || selectedPlatformAccount?.profilePicture || connectedAccounts?.[baseActiveId]?.profilePicture || user?.picture;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Platform tabs — only shown when multiple platforms selected */}
      {(() => {
        const uniqueBasePlatforms = [];
        const seen = new Set();
        selectedChannels.forEach(pid => {
          const basePid = String(pid || "").split(":")[0];
          if (!seen.has(basePid)) {
            seen.add(basePid);
            uniqueBasePlatforms.push({ basePid, firstPid: pid });
          }
        });

        if (uniqueBasePlatforms.length <= 1) return null;

        return (
          <div
            style={{
              display: "flex",
              gap: 5,
              padding: "8px 12px",
              overflowX: "auto",
              scrollbarWidth: "none",
              borderBottom: "1px solid rgba(20,20,19,0.08)",
              flexShrink: 0,
            }}
          >
            {uniqueBasePlatforms.map(({ basePid, firstPid }) => {
              const meta = PLATFORM_META[basePid];
              if (!meta) return null;
              const isActive = baseActiveId === basePid;
              return (
                <motion.button
                  key={basePid}
                  onClick={() => onActivePlatformChange(firstPid)}
                  title={meta.label}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.94 }}
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    border: "none",
                    cursor: "pointer",
                    background: isActive
                      ? "rgba(20,20,19,0.15)"
                      : "transparent",
                    color: isActive ? "var(--ink)" : "var(--slate, #8a8a82)",
                    transition: "all 0.15s",
                    boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.12)" : "none",
                  }}
                >
                  <img
                    src={meta.icon}
                    style={{
                      width: 20,
                      height: 20,
                      objectFit: "contain",
                      transition: "all 0.2s"
                    }}
                    alt={meta.label}
                    onError={(e) => (e.target.style.display = "none")}
                  />
                </motion.button>
              );
            })}
          </div>
        );
      })()}

      {/* Preview content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "12px 10px",
          scrollbarWidth: "none",
        }}
      >
        {selectedChannels.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "40px 20px",
              textAlign: "center",
            }}
          >
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{
                duration: 2.5,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              style={{
                width: 52,
                height: 52,
                borderRadius: 14,
                background: "rgba(20,20,19,0.05)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <Eye size={22} style={{ color: "#ccc" }} />
            </motion.div>
            <p
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#aaa",
                margin: 0,
              }}
            >
              Select a platform
            </p>
            <p style={{ fontSize: 10, color: "#ccc", marginTop: 4 }}>
              Preview appears here
            </p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={activeId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              <PreviewComponent
                caption={caption}
                mediaFiles={mediaFiles}
                cssClass={cssClass}
                user={user}
                platformId={activeId}
                thumbnailFile={
                  baseActiveId === "youtube"
                    ? youtubeThumbnail
                    : baseActiveId === "instagram"
                    ? instagramCover
                    : null
                }
                platformUsername={platformUsername}
                platformPicture={platformPicture}
                selectedRatio={selectedRatio}
                selectedSizePreset={selectedSizePreset}
              />

              <p
                style={{
                  textAlign: "center",
                  fontSize: 10,
                  color: "rgba(20,20,19,0.2)",
                  fontWeight: 500,
                  marginTop: 10,
                }}
              >
                Live Preview · {PLATFORM_META[baseActiveId]?.label}
              </p>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
});

export default PreviewPanel;
