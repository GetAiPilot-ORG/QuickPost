import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Masonry from "react-masonry-css";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabase";
import {
  Plus,
  Search,
  Clock,
  Share2,
  CheckCircle2,
  XCircle,
  Video,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Play,
  Eye,
  X,
  Lock,
  ShieldCheck,
  Link2Off,
  Edit3,
} from "lucide-react";
import apiClient from "../utils/apiClient";
import ComposerModal from "./ComposerModal";
import PostPreviewModal from "./PostPreviewModal";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

/* ── token shortcuts ── */
const css = {
  canvas: "#f5f1ec",
  lifted: "#ffffff",
  surface2: "#ebe7e1",
  hairline: "#d3cec6",
  ink: "#111111",
  white: "#ffffff",
  slate: "#626260",
  dust: "#7b7b78",
  arc: "#ff5600",
  shadow: "none",
  r_btn: "8px",
  r_hero: "16px",
  r_pill: "var(--r-pill)",
};

const PLATFORM_COLORS = {
  instagram: "#E4405F",
  facebook: "#1877F2",
  x: "#000000",
  linkedin: "#0A66C2",
  youtube: "#FF0000",
  threads: "#000000",
  pinterest: "#BD081C",
  bluesky: "#0085FF",
  mastodon: "#6364FF",
  reddit: "#FF4500",
  "google-business": "#4285F4",
};

const PLATFORM_HERO_LOGOS = {
  instagram: "/assets/voxel-instagram-logo.png",
  facebook: "/assets/voxel-facebook-logo.png",
  linkedin: "/assets/voxel-linkedin-logo.png",
  youtube: "/assets/voxel-youtube-logo.png",
  threads: "/assets/voxel-thread-logo.png",
  bluesky: "/assets/voxel-bludesky-logo.png",
  mastodon: "/assets/voxel-mastdon-logo.png",
};

const DASHBOARD_MASONRY_COLS = {
  default: 4,
  1500: 4,
  1280: 3,
  900: 2,
  560: 1,
};

const SKELETON_HEIGHTS = [
  280, 190, 340, 230, 310, 255, 370, 210, 295, 330, 180, 245,
];

const LOAD_MORE_SKELETON_HEIGHTS = [260, 190, 315, 225, 285, 205, 335, 240];

/* ── Platform helpers ── */
function getPlatformIcon(id, size = 14) {
  const s = { width: size, height: size, objectFit: "contain", display: "block" };
  const baseId = id.split(':')[0];
  switch (baseId) {
    case "facebook":
      return (
        <img
          src="/icons/facebook-round-color-icon.svg"
          style={s}
          alt="Facebook"
        />
      );
    case "instagram":
      return (
        <img src="/icons/ig-instagram-icon.svg" style={s} alt="Instagram" />
      );
    case "x":
      return (
        <img src="/icons/x-social-media-round-icon.svg" style={s} alt="X" />
      );
    case "linkedin":
      return <img src="/icons/linkedin-icon.svg" style={s} alt="LinkedIn" />;

    case "youtube":
      return (
        <img src="/icons/youtube-color-icon.svg" style={s} alt="YouTube" />
      );
    case "pinterest":
      return (
        <img
          src="/icons/pinterest-round-color-icon.svg"
          style={s}
          alt="Pinterest"
        />
      );
    case "threads":
      return <img src="/icons/threads-icon.svg" style={s} alt="Threads" />;
    case "mastodon":
      return (
        <img src="/icons/mastodon-round-icon.svg" style={s} alt="Mastodon" />
      );
    case "bluesky":
      return (
        <img
          src="/icons/bluesky-circle-color-icon.svg"
          style={s}
          alt="Bluesky"
        />
      );
    case "reddit":
      return <img src="/icons/reddit-icon.svg" style={s} alt="Reddit" />;
    case "google-business":
      return <img src="/icons/google-icon.svg" style={s} alt="Google" />;
    default:
      return <Share2 size={14} />;
  }
}

function getPlatformName(id, connectedAccounts) {
  const baseId = id.split(":")[0];
  if (baseId === "instagram") {
    if (id.includes(":")) {
      const igId = id.split(":")[1];
      const acc = connectedAccounts?.instagramAccounts?.find((a) => a.id === igId);
      return acc?.username ? `Instagram (@${acc.username})` : "Instagram Account";
    }
    return "Instagram";
  }
  if (baseId === "google-business") return "Google Business";
  if (baseId === "x") return "X";
  return baseId.charAt(0).toUpperCase() + baseId.slice(1);
}

function PlatformHeroLogo({ platformId, label }) {
  const baseId = platformId.split(":")[0];
  const logo = PLATFORM_HERO_LOGOS[baseId];

  if (logo) {
    return (
      <img
        src={logo}
        alt={`${label} logo`}
        style={{
          width: "clamp(128px, 14vw, 184px)",
          height: "auto",
          maxHeight: "clamp(92px, 10vw, 128px)",
          objectFit: "contain",
          display: "block",
        }}
      />
    );
  }

  return (
    <div
      aria-label={`${label} logo`}
      style={{
        width: "clamp(96px, 10vw, 132px)",
        height: "clamp(96px, 10vw, 132px)",
        display: "grid",
        placeItems: "center",
      }}
    >
      {getPlatformIcon(baseId, 86)}
    </div>
  );
}

function getPostPreviewRatio(post) {
  const savedRatio =
    post.platform_data?.selected_aspect_ratio ||
    post.platform_data?.selectedAspectRatio;
  if (typeof savedRatio === "string" && savedRatio.includes(":")) {
    return savedRatio.replace(":", " / ");
  }
  if (Array.isArray(post.media_urls) && post.media_urls.length > 1) return "1 / 1";
  if (post.media_type === "video") {
    const isShort =
      post.platform_data?.youtube?.type === "short" ||
      String(post.platform_data?.selected_post_size_preset || "").includes("short");
    return isShort ? "9 / 16" : "16 / 9";
  }
  if (post.media_type === "image") return "4 / 5";
  return "4 / 5";
}

function buildPlatforms(post) {
  const selectedChannels = Array.isArray(post.selected_channels) ? post.selected_channels : [];
  const isScheduled = post.status === 'scheduled';

  const platformMeta = [
    { id: "linkedin", name: "LinkedIn", success: isScheduled ? false : post.linkedin_success, error: isScheduled ? null : post.linkedin_error, url: post.linkedin_url },
    { id: "youtube", name: "YouTube", success: isScheduled ? false : post.youtube_success, error: isScheduled ? null : post.youtube_error, url: post.youtube_shorts_url || post.youtube_url },
    { id: "facebook", name: "Facebook", success: isScheduled ? false : post.facebook_success, error: isScheduled ? null : post.facebook_error, url: post.facebook_url },
    { id: "mastodon", name: "Mastodon", success: isScheduled ? false : post.mastodon_success, error: isScheduled ? null : post.mastodon_error, url: post.mastodon_url },
    { id: "bluesky", name: "Bluesky", success: isScheduled ? false : post.bluesky_success, error: isScheduled ? null : post.bluesky_error, url: post.bluesky_url },
    { id: "pinterest", name: "Pinterest", success: isScheduled ? false : post.pinterest_success, error: isScheduled ? null : post.pinterest_error, url: post.pinterest_url },
    { id: "threads", name: "Threads", success: isScheduled ? false : post.threads_success, error: isScheduled ? null : post.threads_error, url: post.threads_url },
    { id: "x", name: "X", success: isScheduled ? false : post.x_success, error: isScheduled ? null : post.x_error, url: post.x_url },
    { id: "reddit", name: "Reddit", success: isScheduled ? false : post.reddit_success, error: isScheduled ? null : post.reddit_error, url: post.reddit_url },
  ];

  const results = [];

  // Instagram channels (generic + account specific)
  let instagramChannels = selectedChannels.filter(c => c === 'instagram' || c.startsWith('instagram:'));
  if (instagramChannels.some(c => c.startsWith('instagram:'))) {
    instagramChannels = instagramChannels.filter(c => c !== 'instagram');
  }
  if (instagramChannels.length === 0 && (post.instagram_success || post.instagram_error)) {
    instagramChannels = ['instagram'];
  }
  instagramChannels.forEach(igId => {
    results.push({
      id: igId,
      name: "Instagram",
      success: isScheduled ? false : post.instagram_success,
      error: isScheduled ? null : post.instagram_error,
      url: post.instagram_url,
    });
  });

  // Standard platforms (matching generic ID or specific sub-channel IDs)
  platformMeta.forEach(pm => {
    let subChannels = selectedChannels.filter(c => c === pm.id || c.startsWith(`${pm.id}:`));
    if (subChannels.some(c => c.startsWith(`${pm.id}:`))) {
      // Prefer specific account channel over generic platform name
      subChannels = subChannels.filter(c => c !== pm.id);
    }
    if (subChannels.length > 0) {
      subChannels.forEach(scId => {
        results.push({
          id: scId,
          name: pm.name,
          success: pm.success,
          error: pm.error,
          url: pm.url,
        });
      });
    } else if (pm.success || (pm.error && pm.error !== "Not selected")) {
      results.push(pm);
    }
  });

  // Unique by channel ID to prevent double badges
  const seenIds = new Set();
  return results.filter(item => {
    if (seenIds.has(item.id)) return false;
    seenIds.add(item.id);
    return true;
  });
}

/* ── Media thumbnail ── */
function MediaThumb({ post, className = "", style = {} }) {
  const isImage =
    post.media_type === "image" ||
    /\.(jpg|jpeg|png|gif|webp)$/i.test(post.video_filename || "");
  const displayUrl = post.thumbnail_url || (isImage ? post.media_url : null);
  return (
    <div
      className={className}
      style={{
        background: "#e8e2da",
        overflow: "hidden",
        position: "relative",
        borderBottom: "1px solid rgba(20,20,19,0.05)",
        ...style,
      }}
    >
      {displayUrl ? (
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          <img
            src={displayUrl}
            alt="Preview"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 0.5s",
              display: "block",
            }}
            onMouseEnter={(e) => (e.target.style.transform = "scale(1.06)")}
            onMouseLeave={(e) => (e.target.style.transform = "scale(1)")}
            onError={(e) => {
              e.target.src = "https://placehold.co/300x300?text=Preview";
            }}
          />
          {post.youtube_success && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(0,0,0,0.12)",
                backdropFilter: "blur(1px)",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  background: "#FF0000",
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 8px 24px rgba(255,0,0,0.3)",
                  border: "2px solid rgba(255,255,255,0.2)",
                }}
              >
                <Play
                  size={20}
                  style={{ color: "#fff", fill: "#fff", marginLeft: 3 }}
                />
              </div>
            </div>
          )}
          {/* Subtle bottom gradient for card transition */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 40,
              background:
                "linear-gradient(to top, rgba(20,20,19,0.04), transparent)",
            }}
          />
        </div>
      ) : post.media_type === "image" ? (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            background: "#e8e2da",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(20,20,19,0.03)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ImageIcon size={22} style={{ color: "#9a9088" }} />
          </div>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "#9a9088",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            No Media
          </span>
        </div>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            background: css.ink,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Video size={22} style={{ color: "rgba(243,240,238,0.5)" }} />
          </div>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: "rgba(243,240,238,0.4)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            No Video
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Platform badge ── */
function PlatformBadge({ platform }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: "var(--r-chip)",
        fontSize: 10,
        fontWeight: 600,
        background: "rgba(20,20,19,0.03)",
        color: css.ink,
        border: "1px solid rgba(20,20,19,0.06)",
        transition: "all 0.2s",
      }}
    >
      {getPlatformIcon(platform.id, 18)}
      <span style={{ opacity: 0.8 }}>{platform.name}</span>
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: platform.success ? "#22c55e" : "#ef4444",
          marginLeft: 2,
        }}
      />
    </div>
  );
}

/* ── Pinterest Masonry Card ── */
function PinterestCard({ post, onOpen, formatDate }) {
  const [hovered, setHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const platforms = buildPlatforms(post);
  const isScheduled = post.status === "scheduled";
  const isImage =
    post.media_type === "image" ||
    /\.(jpg|jpeg|png|gif|webp)$/i.test(post.video_filename || "");
  const displayUrl = post.thumbnail_url || (isImage ? post.media_url : null);
  const hasMedia = !!displayUrl;
  const mediaRatio = getPostPreviewRatio(post);
  const allSuccess = platforms.length > 0 && platforms.every((p) => p.success);

  const ICON_MAP = {
    instagram: "ig-instagram-icon.svg",
    x: "x-social-media-round-icon.svg",
    linkedin: "linkedin-icon.svg",
    youtube: "youtube-color-icon.svg",
    facebook: "facebook-round-color-icon.svg",

    pinterest: "pinterest-round-color-icon.svg",
    threads: "threads-icon.svg",
    mastodon: "mastodon-round-icon.svg",
    bluesky: "bluesky-circle-color-icon.svg",
    reddit: "reddit-icon.svg",
  };

  // Multi-media / carousel detection
  const mediaUrls =
    Array.isArray(post.media_urls) && post.media_urls.length > 1
      ? post.media_urls
      : null;
  const isCarousel = !!mediaUrls;
  const carouselCount = mediaUrls?.length || 1;

  return (
    <div
      className="masonry-card"
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        borderRadius: 16,
        overflow: "hidden",
        cursor: "pointer",
        background: hasMedia ? "transparent" : css.lifted,
        boxShadow: "none",
        transform: hovered ? "translateY(-1px)" : "none",
        transition:
          "border-color 0.2s ease, transform 0.2s ease",
        border: `1px solid ${hovered ? css.ink : css.hairline}`,
        willChange: "transform",
      }}
    >
      {hasMedia ? (
        /* ─── Image-first: no fixed height, aspect ratio preserved ─── */
        <div
          style={{
            position: "relative",
            lineHeight: 0,
            aspectRatio: mediaRatio,
            minHeight: 180,
            background: "rgba(20,20,19,0.045)",
          }}
        >
          {/* Shimmer shown until image loads */}
          {!imgLoaded && (
            <div
              className="skeleton-shimmer"
              style={{
                position: "absolute",
                inset: 0,
                minHeight: 180,
                zIndex: 1,
              }}
            />
          )}
          <img
            src={displayUrl}
            alt={post.caption || "Post"}
            loading="lazy"
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              objectFit: "cover",
              opacity: imgLoaded ? 1 : 0,
              transition:
                "opacity 0.5s ease, transform 0.55s cubic-bezier(0.2,0.8,0.2,1)",
              transform: hovered ? "scale(1.05)" : "scale(1)",
            }}
            onLoad={() => setImgLoaded(true)}
            onError={(e) => {
              setImgLoaded(true);
              e.target.src =
                "https://placehold.co/400x300/e8e2da/9a9088?text=Preview";
            }}
          />

          {/* ── Carousel: 2-up split preview ── */}
          {isCarousel && mediaUrls[1] && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                pointerEvents: "none",
              }}
            >
              {/* Divider line */}
              <div
                style={{
                  position: "absolute",
                  left: "66.6%",
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: "rgba(255,255,255,0.6)",
                  zIndex: 2,
                }}
              />
              {/* Second image peek (right 33%) */}
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: "33.3%",
                  overflow: "hidden",
                  zIndex: 1,
                }}
              >
                <img
                  src={mediaUrls[1]}
                  alt=""
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    opacity: 0.85,
                  }}
                />
              </div>
            </div>
          )}

          {/* ── Multi-media count badge (top-left) ── */}
          {isCarousel && (
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(10,8,6,0.72)",
                backdropFilter: "blur(8px)",
                borderRadius: 20,
                padding: "3px 8px 3px 6px",
                zIndex: 4,
                pointerEvents: "none",
              }}
            >
              <Layers size={11} style={{ color: "#fff" }} />
              <span
                style={{
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                }}
              >
                {carouselCount}
              </span>
            </div>
          )}

          {/* ── Carousel dot strip (bottom) ── */}
          {isCarousel && (
            <div
              style={{
                position: "absolute",
                bottom: 8,
                left: 0,
                right: 0,
                display: "flex",
                justifyContent: "center",
                gap: 4,
                zIndex: 4,
                pointerEvents: "none",
              }}
            >
              {Array.from({ length: Math.min(carouselCount, 5) }).map(
                (_, i) => (
                  <div
                    key={i}
                    style={{
                      width: i === 0 ? 14 : 5,
                      height: 5,
                      borderRadius: 3,
                      background: i === 0 ? "#fff" : "rgba(255,255,255,0.45)",
                      transition: "width 0.2s",
                    }}
                  />
                ),
              )}
              {carouselCount > 5 && (
                <span
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 8,
                    fontWeight: 700,
                  }}
                >
                  +{carouselCount - 5}
                </span>
              )}
            </div>
          )}

          {/* YouTube play badge */}
          {post.youtube_success && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
                width: 48,
                height: 48,
                background: "#FF0000",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 8px 24px rgba(255,0,0,0.4)",
                pointerEvents: "none",
              }}
            >
              <Play
                size={20}
                style={{ color: "#fff", fill: "#fff", marginLeft: 3 }}
              />
            </div>
          )}

          {/* ── Hover overlay ── */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(to top, rgba(10,8,6,0.9) 0%, rgba(10,8,6,0.4) 50%, transparent 100%)",
              opacity: hovered ? 1 : 0,
              transition: "opacity 0.3s ease",
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              padding: 14,
              gap: 8,
              pointerEvents: "none",
            }}
          >
            {/* Caption */}
            {post.caption && (
              <p
                style={{
                  color: "rgba(255,255,255,0.93)",
                  fontSize: 12,
                  fontWeight: 500,
                  lineHeight: 1.5,
                  margin: 0,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  letterSpacing: "-0.01em",
                }}
              >
                {post.caption}
              </p>
            )}

            {/* Bottom row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              {/* Platform icons */}
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                {platforms.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    title={`${p.name}: ${p.success ? "Success" : "Failed"}`}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      background: "#ffffff",
                      boxShadow: "0 1px 6px rgba(0,0,0,0.18)",
                      border: `2px solid ${p.success ? "rgba(34,197,94,0.85)" : "rgba(239,68,68,0.85)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {ICON_MAP[p.id.split(':')[0]] ? (
                      <img
                        src={`/icons/${ICON_MAP[p.id.split(':')[0]]}`}
                        alt={p.name}
                        style={{ width: 19, height: 19, objectFit: "contain", display: "block" }}
                      />
                    ) : (
                      <Share2 size={9} style={{ color: "#fff" }} />
                    )}
                  </div>
                ))}
                {platforms.length > 5 && (
                  <span
                    style={{
                      color: "rgba(255,255,255,0.6)",
                      fontSize: 9,
                      fontWeight: 700,
                    }}
                  >
                    +{platforms.length - 5}
                  </span>
                )}
              </div>

              {/* Date + status dot */}
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: post.status === 'processing'
                      ? "#eab308"
                      : isScheduled
                        ? "#f97316"
                        : allSuccess
                          ? "#22c55e"
                          : "#ef4444",
                    boxShadow: post.status === 'processing'
                      ? "0 0 6px rgba(234,179,8,0.7)"
                      : isScheduled
                        ? "0 0 6px rgba(249,115,22,0.7)"
                        : allSuccess
                          ? "0 0 6px rgba(34,197,94,0.7)"
                          : "0 0 6px rgba(239,68,68,0.7)",
                  }}
                />
                <span
                  style={{
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {new Date(
                    isScheduled ? post.scheduled_for : post.posted_at,
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Media type chip */}
          <div
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              padding: "3px 8px",
              borderRadius: 6,
              background: "rgba(10,8,6,0.65)",
              backdropFilter: "blur(12px)",
              color: "rgba(255,255,255,0.9)",
              fontSize: 8,
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              border: "1px solid rgba(255,255,255,0.12)",
              pointerEvents: "none",
            }}
          >
            {post.platform_data?.postType || post.postType || post.post_type || post.media_type || "media"}
          </div>
        </div>
      ) : (
        /* ─── No media fallback: text card ─── */
        <div style={{ padding: "18px 18px 16px" }}>
          <div
            style={{
              width: "100%",
              paddingBottom: "45%",
              position: "relative",
              borderRadius: 12,
              background:
                post.media_type === "video"
                  ? "linear-gradient(135deg, #1e1c1a 0%, #2a2724 100%)"
                  : "#ede9e4",
              marginBottom: 14,
              overflow: "hidden",
              transition: "opacity 0.3s",
              opacity: hovered ? 0.85 : 1,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              {post.media_type === "video" ? (
                <>
                  <Video size={26} style={{ color: "rgba(243,240,238,0.3)" }} />
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "rgba(243,240,238,0.25)",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Video
                  </span>
                </>
              ) : (
                <>
                  <ImageIcon size={26} style={{ color: "#b8b0a6" }} />
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      color: "#b8b0a6",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    No Media
                  </span>
                </>
              )}
            </div>
          </div>

          <p
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: css.ink,
              margin: "0 0 12px",
              lineHeight: 1.5,
              display: "-webkit-box",
              WebkitLineClamp: 4,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {post.caption || (
              <span style={{ color: css.dust, fontStyle: "italic" }}>
                Untitled post
              </span>
            )}
          </p>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {platforms.slice(0, 3).map((p) => (
              <PlatformBadge key={p.id} platform={p} />
            ))}
            {platforms.length > 3 && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: css.slate,
                  padding: "3px 8px",
                  background: "rgba(20,20,19,0.04)",
                  borderRadius: 6,
                }}
              >
                +{platforms.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {post.status === 'processing' && (
        <>
          {post.step && (
            <div style={{
              position: 'absolute', bottom: 12, left: 8, right: 8, zIndex: 10,
              background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 11, padding: '4px 8px',
              borderRadius: 6, backdropFilter: 'blur(4px)', textAlign: 'center',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
            }}>
              {post.step}
            </div>
          )}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(234,179,8,0.2)', zIndex: 10
          }}>
            <div style={{
              height: '100%', width: `${post.progress || 0}%`, background: '#eab308', transition: 'width 0.5s ease-out'
            }} />
          </div>
        </>
      )}
    </div>
  );
}

/* ── List row ── */
function getPostDateValue(post) {
  if (post.status === "scheduled") {
    return post.scheduled_for || post.created_at || post.posted_at || new Date().toISOString();
  }
  return post.posted_at || post.scheduled_for || post.created_at || new Date().toISOString();
}

function formatTimelineDay(dateString) {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday, ${date.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`;
  }
  return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatTimelineTime(dateString) {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function getMetric(post, keys) {
  const sources = [post, post.analytics, post.metrics, post.platform_data?.analytics, post.platform_data?.metrics];
  for (const source of sources) {
    if (!source) continue;
    for (const key of keys) {
      if (source[key] !== undefined && source[key] !== null) return source[key];
    }
  }
  return null;
}

function resolvePlatformLabel(platform, connectedAccounts) {
  const [baseId, accountId] = platform.id.split(":");
  const account = accountId
    ? (connectedAccounts?.[`${baseId}Accounts`] || []).find((item) => String(item.id) === accountId)
    : connectedAccounts?.[baseId];
  const handle = account?.username || account?.name || account?.channelTitle || account?.title;
  return handle ? `${platform.name} @${handle}` : platform.name;
}

function ListRow({ post, expanded, onToggle, connectedAccounts, onEdit, selectedPlatform }) {
  const navigate = useNavigate();
  const platforms = buildPlatforms(post);
  const isScheduled = post.status === "scheduled";
  const primaryPlatform = platforms.find((p) => p.success) || platforms[0];
  const liveUrl = platforms.find((p) => p.url)?.url;
  const metrics = [
    { label: "Reactions", value: getMetric(post, ["likes", "reactions", "like_count", "instagram_likes"]) },
    { label: "Comments", value: getMetric(post, ["comments", "comment_count", "instagram_comments"]) },
    { label: "Eng. Rate", value: getMetric(post, ["engagement_rate", "engagementRate"]) },
    { label: "Views", value: getMetric(post, ["views", "view_count", "instagram_views", "youtube_views"]) },
    { label: "Shares", value: getMetric(post, ["shares", "share_count"]) },
    { label: "Saves", value: getMetric(post, ["saves", "save_count"]) },
  ].filter((metric) => metric.value !== null && metric.value !== undefined);

  return (
    <div
      className="timeline-card"
      style={{
        background: css.lifted,
        borderRadius: 8,
        border: `1px solid ${expanded ? css.ink : css.hairline}`,
        overflow: "hidden",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        boxShadow: "none",
        position: "relative"
      }}
    >
      <div
        className="timeline-card-main"
        style={{
          padding: "12px 14px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 160px",
          gap: 14,
          cursor: "pointer",
        }}
        onClick={onToggle}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: "transparent",
                border: 0,
                display: "grid",
                placeItems: "center",
                flexShrink: 0,
              }}
            >
              {primaryPlatform ? getPlatformIcon(primaryPlatform.id, 22) : <Share2 size={22} />}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 750, color: css.ink, lineHeight: 1.2 }}>
                {primaryPlatform ? resolvePlatformLabel(primaryPlatform, connectedAccounts) : "Social post"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {isScheduled && (
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 800,
                    color: css.arc,
                    background: "rgba(255, 86, 0, 0.08)",
                    padding: "2px 8px",
                    borderRadius: css.r_pill,
                    textTransform: "uppercase",
                  }}
                >
                  Scheduled
                </div>
              )}
            </div>
          </div>
          <p
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: css.ink,
              margin: 0,
              lineHeight: 1.4,
              whiteSpace: "pre-wrap",
              maxWidth: 680,
            }}
          >
            {post.caption || (
              <span style={{ fontStyle: "italic", color: css.dust }}>
                No caption
              </span>
            )}
          </p>
          {selectedPlatform === "all" && platforms.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {platforms.slice(0, 5).map((p) => (
                <PlatformBadge key={p.id} platform={p} />
              ))}
            </div>
          )}
        </div>
        <MediaThumb
          post={post}
          className="timeline-thumb"
          style={{
            width: "100%",
            height: 96,
            borderRadius: 7,
            flexShrink: 0,
            border: `1px solid ${css.hairline}`,
          }}
        />
      </div>

      <div
        style={{
          borderTop: `1px solid ${css.hairline}`,
          padding: "8px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: "rgba(20,20,19,0.01)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {metrics.map((metric) => (
            <div key={metric.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: css.slate }}>{metric.label}:</span>
              <span style={{ fontSize: 12, fontWeight: 750, color: css.ink }}>{metric.value}</span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isScheduled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onEdit) {
                  onEdit(post);
                } else {
                  navigate("/dashboard/queue");
                }
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 7,
                border: `1px solid ${css.hairline}`,
                color: css.ink,
                fontSize: 13,
                fontWeight: 700,
                background: css.white,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <Edit3 size={14} style={{ color: css.arc }} /> Edit
            </button>
          )}
          {liveUrl && (
            <a
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "8px 14px",
                borderRadius: 7,
                border: `1px solid ${css.hairline}`,
                color: css.ink,
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                background: css.white,
              }}
            >
              <ExternalLink size={14} /> View Post
            </a>
          )}
          <button
            type="button"
            onClick={onToggle}
            style={{
              width: 34,
              height: 34,
              borderRadius: 7,
              border: `1px solid ${css.hairline}`,
              background: css.white,
              color: expanded ? css.arc : css.slate,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${css.hairline}`,
            background: "rgba(245,241,236,0.45)",
            padding: "14px 18px",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}
          >
            {platforms.map((p) => (
              <div
                key={p.id}
                style={{
                  background: css.white,
                  padding: "11px 12px",
                  borderBottom: `1px solid ${css.hairline}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 7,
                      background: "#f3eee8",
                      border: `1px solid ${css.hairline}`,
                      display: "grid",
                      placeItems: "center",
                      flexShrink: 0,
                    }}
                  >
                    {getPlatformIcon(p.id)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: css.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {resolvePlatformLabel(p, connectedAccounts)}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 650, color: p.success ? "#15803d" : isScheduled ? css.slate : "#b91c1c" }}>
                      {p.success ? "Success" : isScheduled ? "Scheduled" : (p.error || "Failed")}
                    </div>
                  </div>
                </div>
                {p.success ? (
                  p.url ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        color: css.arc,
                        fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      View Live Post <ExternalLink size={12} />
                    </a>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        color: css.slate,
                        fontWeight: 600,
                      }}
                    >
                      <Clock size={12} /> Pending Sync
                    </div>
                  )
                ) : isScheduled ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 11,
                      color: css.arc,
                      fontWeight: 600,
                    }}
                  >
                    <Clock size={12} /> Scheduled
                  </div>
                ) : (
                  <span
                    style={{
                      fontSize: 11,
                      color: "#ef4444",
                      fontWeight: 650,
                      textAlign: "right",
                    }}
                  >
                    Action needed
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {post.status === 'processing' && (
        <>
          {post.step && (
            <div style={{ position: 'absolute', bottom: 8, left: 18, fontSize: 11, color: '#eab308', fontWeight: 600 }}>
              {post.step}
            </div>
          )}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(234,179,8,0.2)'
          }}>
            <div style={{
              height: '100%', width: `${post.progress || 0}%`, background: '#eab308', transition: 'width 0.5s ease-out'
            }} />
          </div>
        </>
      )}
    </div>
  );
}

/* ── Skeleton card for loading state ── */
function SkeletonCard({ height }) {
  return (
    <div
      className="masonry-card skeleton-card"
      style={{
        borderRadius: 16,
        overflow: "hidden",
        border: `1px solid ${css.hairline}`,
        boxShadow: "none",
      }}
    >
      <div className="skeleton-shimmer" style={{ height, minHeight: 170 }} />
      <div
        style={{
          padding: "12px 14px 14px",
          background: "var(--canvas-lifted)",
        }}
      >
        <div
          className="skeleton-shimmer"
          style={{
            height: 11,
            borderRadius: 6,
            marginBottom: 8,
            width: "75%",
          }}
        />
        <div
          className="skeleton-shimmer"
          style={{
            height: 9,
            borderRadius: 6,
            marginBottom: 6,
            width: "55%",
          }}
        />
        <div
          className="skeleton-shimmer"
          style={{ height: 9, borderRadius: 6, width: "35%" }}
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN DASHBOARD
   ══════════════════════════════════════════════════════ */
function Dashboard() {
  const { user, connectedAccounts, refreshAccounts } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState("sent");
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [selectedPost, setSelectedPost] = useState(null);
  const [queueCount, setQueueCount] = useState(0);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);
  const [isDisconnectingAccount, setIsDisconnectingAccount] = useState(false);

  const BATCH_SIZE = 20;
  const [displayCount, setDisplayCount] = useState(BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef(null);

  const selectedPlatform = searchParams.get("platform") || "all";

  const filtered = useMemo(() => broadcasts.filter((b) => {
    if (activeTab === "queue" && b.status === "sent") return false;
    if (activeTab === "sent" && b.status !== "sent") return false;
    const matchesSearch = (b.caption || "")
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    if (selectedPlatform === "all") return matchesSearch;

    const isSpecificAccount = selectedPlatform.includes(":");
    const baseSelected = selectedPlatform.split(":")[0];

    let matchesPlatform = buildPlatforms(b).some((p) => {
      if (p.id === selectedPlatform) return true;
      if (p.id.split(":")[0] === baseSelected) return true;
      return false;
    }) || (Array.isArray(b.selected_channels) && b.selected_channels.some(c => {
      if (c === selectedPlatform) return true;
      if (c.split(":")[0] === baseSelected) return true;
      return false;
    }));

    return matchesSearch && matchesPlatform;
  }), [broadcasts, searchTerm, selectedPlatform, activeTab]);

  const tabs = [
    {
      id: "sent",
      label: "Sent",
      count: activeTab === "sent" ? filtered.length : 0,
    },
    {
      id: "queue",
      label: "Queue",
      count: activeTab === "queue" ? filtered.length : 0,
    },
    { id: "drafts", label: "Drafts", count: 0 },
    {
      id: "history",
      label: "History",
      count: activeTab === "history" ? filtered.length : 0,
    },
  ];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthError = params.get("error");
    const oauthMessage = params.get("message") || params.get("details");

    const verifyPayment = async () => {
      const paymentLinkStatus = params.get("razorpay_payment_link_status");
      const paymentLinkId = params.get("razorpay_payment_link_id");

      if (params.get("payment") === "success" && paymentLinkId) {
        try {
          const { data, error } = await supabase.functions.invoke('verify-subscription', {
            body: { razorpayPaymentLinkId: paymentLinkId }
          });

          if (error) throw error;

          if (data.success) {
            if (data.status === "paid") {
              await supabase.auth.refreshSession();
              navigate('/dashboard/payment-success');
              return; // Exit so we don't replaceState below
            } else {
              alert("Payment status is: " + data.status + ". Your plan was not upgraded.");
            }
          } else {
            throw new Error(data.error || "Unknown verification error");
          }
        } catch (err) {
          console.error("Payment verification error:", err);
          alert("Payment verification failed: " + (err.message || JSON.stringify(err)));
        } finally {
          window.history.replaceState({}, "", "/dashboard");
        }
      }
    };

    if (params.get("payment") === "success") {
      verifyPayment();
    }

    if (oauthError) {
      const readable =
        oauthMessage || oauthError.replaceAll("_", " ");
      alert(`Connection failed: ${readable}`);
      window.history.replaceState({}, "", "/dashboard");
    }

    if (params.get("success")) {
      refreshAccounts();
      window.history.replaceState({}, "", "/dashboard");
    }

    apiClient
      .get("/api/broadcasts/stats")
      .then((r) => setQueueCount(r.data.pending || 0))
      .catch(() => { });
  }, [refreshAccounts]);

  useEffect(() => {
    fetchBroadcasts();
    setDisplayCount(BATCH_SIZE);
  }, [activeTab]);

  useEffect(() => {
    setDisplayCount(BATCH_SIZE);
  }, [searchTerm]);

  const fetchBroadcasts = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      let params = {};
      if (activeTab === "sent") params.status = "sent";
      // Note: activeTab === "queue" fetches all broadcasts for client-side filtering of non-sent or scheduled posts

      const [resBroadcasts, resJobs] = await Promise.all([
        apiClient.get("/api/broadcasts", { params }),
        apiClient.get("/api/jobs").catch(() => ({ data: { jobs: [] } }))
      ]);

      let bcastData = resBroadcasts.data.broadcasts || [];
      const jobsData = resJobs.data?.jobs || [];

      const activeJobs = jobsData.filter(j => j.status === 'pending' || j.status === 'processing');
      const pseudoBroadcasts = activeJobs.map(job => ({
        id: job.id,
        status: "processing",
        caption: job.meta?.caption || "",
        media_type: job.meta?.mediaType || "image",
        media_url: job.meta?.previewUrl || "",
        thumbnail_url: job.meta?.previewUrl || "",
        selected_channels: job.meta?.channels || [],
        posted_at: job.createdAt ? new Date(job.createdAt).toISOString() : new Date().toISOString(),
        progress: job.progress,
        step: job.step
      }));

      let displayPseudo = [];
      if (activeTab === "queue" || activeTab === "history" || activeTab === "all") {
        displayPseudo = pseudoBroadcasts;
      }

      // Filter out any broadcasts that might already exist with the same sourceJobId (if they just completed)
      const existingJobIds = new Set(bcastData.map(b => b.platform_data?.sourceJobId || b.platform_data?.source_job_id).filter(Boolean));
      const filteredPseudo = displayPseudo.filter(p => !existingJobIds.has(p.id));

      setBroadcasts([...filteredPseudo, ...bcastData]);
    } catch (err) {
      setBroadcasts([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const hasActiveJobs = broadcasts.some(b => b.status === 'processing');
    if (hasActiveJobs) {
      const interval = setInterval(() => {
        fetchBroadcasts(true);
      }, 5000); // Poll every 5s while jobs are active
      return () => clearInterval(interval);
    }
  }, [broadcasts, activeTab, searchTerm]);

  const formatDate = useCallback((dateString) =>
    new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric',
      year: 'numeric', hour: '2-digit', minute: '2-digit',
    }), []);

  const toggleExpand = (id) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const handleDisconnectSelectedAccount = async () => {
    if (!selectedAccountInfo) return;
    setIsDisconnectingAccount(true);
    try {
      const { provider, accountId } = selectedAccountInfo;
      const response = await apiClient.delete(
        `/api/auth/disconnect/${provider}?accountId=${accountId}`
      );
      if (response.data.success) {
        await refreshAccounts();
        setDisconnectConfirmOpen(false);
        navigate("/dashboard");
      } else {
        alert(`Failed to disconnect: ${response.data.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Failed to disconnect account:", error);
      alert("Failed to disconnect account. Please try again.");
    } finally {
      setIsDisconnectingAccount(false);
    }
  };
  const selectedPlatformName = useMemo(
    () => getPlatformName(selectedPlatform, connectedAccounts),
    [selectedPlatform, connectedAccounts],
  );

  const selectedAccountInfo = useMemo(() => {
    if (selectedPlatform === "all") return null;

    const multiAccountProviders = [
      "facebook",
      "youtube",
      "linkedin",
      "threads",
      "mastodon",
      "bluesky",
      "reddit",
      "x",
      "pinterest",
      "googleBusiness",
    ];

    const connectedRows = [
      ...(connectedAccounts?.instagramAccounts || []).map((account) => ({
        id: `instagram:${account.id}`,
        provider: "instagram",
        accountId: account.id,
        label: "Instagram",
        username: account.username,
        profilePicture: account.profilePicture,
      })),
      ...multiAccountProviders.flatMap((provider) =>
        (connectedAccounts?.[`${provider}Accounts`] || []).map((account) => ({
          id: `${provider}:${account.id}`,
          provider,
          accountId: account.id,
          label: provider.charAt(0).toUpperCase() + provider.slice(1),
          username: account.username || account.name || account.channelTitle || account.title,
          profilePicture: account.profilePicture || account.avatarUrl || account.avatar,
        })),
      ),
      ...Object.entries(connectedAccounts || {})
        .filter(([id, data]) =>
          id !== "instagram" &&
          id !== "instagramAccounts" &&
          !id.endsWith("Accounts") &&
          !multiAccountProviders.includes(id) &&
          data?.connected
        )
        .map(([id, data]) => ({
          id,
          provider: id,
          accountId: null,
          label: id.charAt(0).toUpperCase() + id.slice(1),
          username: data.username || data.name || data.title,
          profilePicture: data.profilePicture || data.avatarUrl || data.avatar,
        })),
    ];

    let match = connectedRows.find(r => r.id === selectedPlatform);
    if (!match) {
      const baseId = selectedPlatform.split(":")[0];
      match = connectedRows.find(r => r.provider === baseId);
    }
    return match;
  }, [selectedPlatform, connectedAccounts]);

  const displayedItems = useMemo(
    () => filtered.slice(0, displayCount),
    [filtered, displayCount],
  );
  const hasMore = displayCount < filtered.length;
  const masonryItems = useMemo(() => {
    const posts = displayedItems.map((post) => ({ type: "post", post }));
    if (!isLoadingMore || viewMode !== "grid") return posts;
    return [
      ...posts,
      ...LOAD_MORE_SKELETON_HEIGHTS.map((height, index) => ({
        type: "skeleton",
        height,
        key: `load-more-${displayCount}-${index}`,
      })),
    ];
  }, [displayedItems, displayCount, isLoadingMore, viewMode]);

  useEffect(() => {
    if (!hasMore || isLoadingMore) return;
    const sentinel = loadMoreRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setDisplayCount(prev => Math.min(prev + BATCH_SIZE, filtered.length));
            setIsLoadingMore(false);
          }, 300);
        }
      },
      { rootMargin: '400px', threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, filtered.length]);

  return (
    <div
      className="dashboard-intercom"
      style={{
        minHeight: "100vh",
        background: css.canvas,
        fontFamily: "var(--font-body)",
      }}
    >
      {/* ── Top header ── */}
      <style>{`
        .dashboard-masonry {
          display: flex;
          align-items: flex-start;
          width: auto;
          margin-left: -18px;
        }
        .dashboard-masonry_col {
          padding-left: 18px;
          background-clip: padding-box;
        }
        .dashboard-masonry_col > .masonry-card {
          margin-bottom: 18px;
          break-inside: avoid;
        }
        @media (max-width: 560px) {
          .dashboard-masonry { margin-left: -12px; }
          .dashboard-masonry_col { padding-left: 12px; }
          .dashboard-masonry_col > .masonry-card { margin-bottom: 12px; }
        }
        .timeline-list {
          max-width: 1120px;
          margin: 0 auto;
        }
        .timeline-group {
          display: grid;
          grid-template-columns: 120px minmax(0, 1fr);
          column-gap: 24px;
          align-items: start;
        }
        .timeline-date {
          grid-column: 1 / -1;
          margin: 0 0 18px 120px;
          color: ${css.ink};
          font-size: 17px;
          font-weight: 750;
          letter-spacing: -0.01em;
        }
        .timeline-time {
          color: ${css.ink};
          font-size: 13px;
          font-weight: 700;
          line-height: 1.35;
          padding-top: 6px;
          position: sticky;
          top: 12px;
        }
        .timeline-status {
          color: ${css.slate};
          font-size: 11px;
          font-weight: 500;
          margin-top: 5px;
        }
        .timeline-card-main {
          grid-template-columns: minmax(0, 1fr) 240px;
        }
        @media (max-width: 860px) {
          .timeline-list { max-width: 680px; }
          .timeline-group {
            grid-template-columns: 76px minmax(0, 1fr);
            column-gap: 14px;
          }
          .timeline-date { margin-left: 76px; }
          .timeline-card-main {
            grid-template-columns: minmax(0, 1fr) 156px !important;
            gap: 14px !important;
          }
          .timeline-thumb { height: 112px !important; }
          .timeline-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 620px) {
          .analytics-platform-hero {
            order: 3;
            width: 100%;
            justify-content: flex-start !important;
            min-height: 0 !important;
          }
          .timeline-group {
            display: block;
            margin-bottom: 18px;
          }
          .timeline-date { margin: 0 0 14px; }
          .timeline-time {
            position: static;
            display: flex;
            gap: 8px;
            align-items: baseline;
            margin: 0 0 8px;
            padding-top: 0;
          }
          .timeline-status { margin-top: 0; }
          .timeline-card-main {
            grid-template-columns: 1fr !important;
          }
          .timeline-thumb {
            width: 100% !important;
            height: auto !important;
            aspect-ratio: 16 / 9;
          }
          .timeline-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
      `}</style>
      <div
        style={{
          background: css.lifted,
          borderBottom: `1px solid ${css.hairline}`,
          padding: "clamp(22px, 2.5vw, 26px) clamp(18px, 3vw, 32px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            flex: 1,
            minWidth: 200,
          }}
        >
          <div>
            <div className="eyebrow" style={{ marginBottom: 2 }}>
              Overview
            </div>
            <h1
              style={{
                fontSize: "clamp(36px, 5vw, 56px)",
                fontWeight: 500,
                color: css.ink,
                margin: 0,
                letterSpacing: "-0.025em",
                lineHeight: 1.08,
              }}
            >
              Analytics
            </h1>

          </div>
        </div>
        <AnimatePresence>
          {selectedPlatform !== "all" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="analytics-platform-hero"
              style={{
                minHeight: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "18px",
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.45)",
                  backdropFilter: "blur(20px) saturate(140%)",
                  WebkitBackdropFilter: "blur(20px) saturate(140%)",
                  borderRadius: "16px",
                  border: "1px solid rgba(255, 255, 255, 0.5)",
                  padding: "10px 40px 10px 16px",
                  display: "flex",
                  alignItems: "center",
                  boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
                  width: "280px",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{ flex: 1, minWidth: 0, position: "relative" }}>
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      key={selectedPlatform}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        width: "100%",
                      }}
                    >
                      {/* Profile Image or platform logo */}
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        {selectedAccountInfo?.profilePicture ? (
                          <div style={{ position: "relative", width: 40, height: 40 }}>
                            <img
                              src={selectedAccountInfo.profilePicture}
                              alt={selectedAccountInfo.username || "Profile"}
                              style={{
                                width: "100%",
                                height: "100%",
                                borderRadius: "50%",
                                objectFit: "cover",
                                border: "2px solid #ffffff",
                                boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                              }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                bottom: -2,
                                right: -2,
                                background: "#ffffff",
                                borderRadius: "50%",
                                padding: 2,
                                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {getPlatformIcon(selectedPlatform, 12)}
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "10px",
                              background: "rgba(255, 255, 255, 0.75)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                              overflow: "hidden",
                            }}
                          >
                            {PLATFORM_HERO_LOGOS[selectedPlatform.split(":")[0]] ? (
                              <img
                                src={PLATFORM_HERO_LOGOS[selectedPlatform.split(":")[0]]}
                                alt={selectedPlatformName}
                                style={{
                                  width: 28,
                                  height: 28,
                                  objectFit: "contain",
                                }}
                              />
                            ) : (
                              getPlatformIcon(selectedPlatform, 20)
                            )}
                          </div>
                        )}
                      </div>

                      {/* Account details */}
                      <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            fontSize: "9px",
                            textTransform: "uppercase",
                            letterSpacing: "0.06em",
                            color: css.slate,
                            fontWeight: 700,
                            marginBottom: 1,
                          }}
                        >
                          {selectedAccountInfo?.label || selectedPlatformName.split(" ")[0]} Active
                        </span>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 750,
                            color: css.ink,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            lineHeight: 1.25,
                          }}
                        >
                          {selectedAccountInfo?.username ? `@${selectedAccountInfo.username}` : selectedPlatformName}
                        </span>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Red Disconnect button */}
                <button
                  onClick={() => setDisconnectConfirmOpen(true)}
                  style={{
                    position: "absolute",
                    right: 14,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "none",
                    borderRadius: "50%",
                    width: 24,
                    height: 24,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "#ef4444",
                    padding: 0,
                    transition: "all 0.2s",
                    zIndex: 10,
                  }}
                  title="Disconnect Account"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)";
                    e.currentTarget.style.transform = "translateY(-50%) scale(1.05)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "rgba(239, 68, 68, 0.08)";
                    e.currentTarget.style.transform = "translateY(-50%) scale(1)";
                  }}
                >
                  <Link2Off size={12} />
                </button>
              </div>

              {/* Voxel platform logo container */}
              <div
                style={{
                  flexShrink: 0,
                  position: "relative",
                  width: "clamp(100px, 12vw, 148px)",
                  height: "clamp(70px, 8.5vw, 104px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AnimatePresence mode="popLayout">
                  {PLATFORM_HERO_LOGOS[selectedPlatform.split(":")[0]] && (
                    <motion.img
                      key={selectedPlatform.split(":")[0]}
                      src={PLATFORM_HERO_LOGOS[selectedPlatform.split(":")[0]]}
                      alt={selectedPlatformName}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: 0.04 }}
                      style={{
                        position: "absolute",
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setComposerOpen(true)}
            className="btn-ink"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              padding: "10px 20px",
              borderRadius: css.r_btn,
            }}
          >
            <Plus size={16} />
            <span className="hidden sm:inline">New Post</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div
        style={{
          background: css.canvas,
          borderBottom: `1px solid ${css.hairline}`,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          gap: "clamp(16px, 4vw, 32px)",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          msOverflowStyle: "none",
          scrollbarWidth: "none",
        }}
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
              }}
              style={{
                padding: "14px 0",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "none",
                letterSpacing: 0,
                color: active ? css.ink : css.slate,
                border: "none",
                background: "transparent",
                cursor: "pointer",
                borderBottom: `2.5px solid ${active ? css.ink : "transparent"}`,
                marginBottom: -1,
                transition: "all 0.2s",
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  style={{
                    padding: "1px 6px",
                    borderRadius: css.r_pill,
                    fontSize: 9,
                    fontWeight: 800,
                    background: active ? css.ink : "rgba(20,20,19,0.06)",
                    color: active ? css.canvas : css.slate,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Toolbar ── */}
      {(activeTab === "sent" ||
        activeTab === "queue" ||
        activeTab === "history") &&
        !loading &&
        broadcasts.length > 0 && (
          <div
            style={{
              background: css.canvas,
              borderBottom: `1px solid ${css.hairline}`,
              padding: "12px 16px",
              display: "flex",
              flexDirection: window.innerWidth < 768 ? "column" : "row",
              alignItems: window.innerWidth < 768 ? "stretch" : "center",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                overflowX: "auto",
                paddingBottom: window.innerWidth < 768 ? 4 : 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <Clock size={14} style={{ color: css.arc }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: css.ink }}>
                  {filtered.length}
                </span>
                <span style={{ fontSize: 12, color: css.slate }}>
                  {activeTab === "queue" ? "scheduled" : "total"}
                </span>
              </div>
              <div
                style={{
                  width: 1,
                  height: 16,
                  background: css.hairline,
                  flexShrink: 0,
                }}
              />
              {activeTab !== "queue" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                  }}
                >
                  <CheckCircle2 size={14} style={{ color: "#22c55e" }} />
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: css.ink }}
                  >
                    {
                      filtered.filter((b) =>
                        buildPlatforms(b).some((p) => p.success),
                      ).length
                    }
                  </span>
                  <span style={{ fontSize: 12, color: css.slate }}>
                    success
                  </span>
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                alignSelf: window.innerWidth < 768 ? "stretch" : "auto",
              }}
            >
              <div style={{ position: "relative", flex: 1 }}>
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: css.slate,
                  }}
                />
                <input
                  type="text"
                  placeholder="Search…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: "8px 16px 8px 32px",
                    background: css.lifted,
                    border: `1px solid ${css.hairline}`,
                    borderRadius: css.r_btn,
                    fontSize: 13,
                    color: css.ink,
                    fontFamily: "var(--font)",
                    outline: "none",
                    width: "100%",
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  background: css.lifted,
                  border: `1px solid ${css.hairline}`,
                  borderRadius: css.r_pill,
                  padding: 3,
                  gap: 2,
                }}
              >
                {[
                  { mode: "grid", icon: <LayoutGrid size={13} /> },
                  { mode: "list", icon: <List size={13} /> },
                ].map(({ mode, icon }) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    title={`${mode} view`}
                    style={{
                      padding: "6px 10px",
                      borderRadius: css.r_pill,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      background: viewMode === mode ? css.ink : "transparent",
                      color: viewMode === mode ? css.canvas : css.slate,
                      transition: "all 0.2s",
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

      {/* ── Main content ── */}
      <div
        style={{
          padding: "clamp(16px, 3vw, 28px) clamp(16px, 3vw, 28px) 40px",
        }}
      >
        {loading ? (
          <Masonry
            breakpointCols={DASHBOARD_MASONRY_COLS}
            className="dashboard-masonry"
            columnClassName="dashboard-masonry_col"
          >
            {SKELETON_HEIGHTS.map((h, i) => (
              <SkeletonCard key={i} height={h} />
            ))}
          </Masonry>
        ) : (activeTab === "sent" ||
          activeTab === "queue" ||
          activeTab === "history") &&
          filtered.length > 0 ? (
          <>
            {viewMode === "grid" ? (
              <Masonry
                breakpointCols={DASHBOARD_MASONRY_COLS}
                className="dashboard-masonry"
                columnClassName="dashboard-masonry_col"
              >
                {masonryItems.map((item) =>
                  item.type === "skeleton" ? (
                    <SkeletonCard key={item.key} height={item.height} />
                  ) : (
                    <PinterestCard
                      key={item.post.id}
                      post={item.post}
                      onOpen={() => setSelectedPost(item.post)}
                      formatDate={formatDate}
                    />
                  )
                )}
              </Masonry>
            ) : (
              <div
                className="timeline-list"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 0,
                }}
              >
                {displayedItems.map((post, index) => {
                  const dateValue = getPostDateValue(post);
                  const currentDay = formatTimelineDay(dateValue);
                  const previous = displayedItems[index - 1];
                  const previousDay = previous ? formatTimelineDay(getPostDateValue(previous)) : null;
                  return (
                    <React.Fragment key={post.id}>
                      {currentDay !== previousDay && (
                        <h3
                          className="timeline-date"
                          style={{
                            marginTop: index === 0 ? 0 : 30,
                          }}
                        >
                          {currentDay}
                        </h3>
                      )}
                      <div
                        className="timeline-group"
                        style={{ marginBottom: 18 }}
                      >
                        <div
                          className="timeline-time"
                        >
                          {formatTimelineTime(dateValue)}
                          <div className="timeline-status">
                            {post.status === "scheduled" ? "Scheduled" : "Published"}
                          </div>
                        </div>
                        <div
                          onClick={() => setSelectedPost(post)}
                          style={{ cursor: "pointer", minWidth: 0 }}
                        >
                          <ListRow
                            post={post}
                            expanded={expandedId === post.id}
                            onToggle={(e) => {
                              e?.stopPropagation();
                              toggleExpand(post.id);
                            }}
                            connectedAccounts={connectedAccounts}
                            selectedPlatform={selectedPlatform}
                            onEdit={(p) => {
                              navigate(`/dashboard/queue?edit=${p.id}`);
                            }}
                          />
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* ── Infinite scroll sentinel + skeletons ── */}
            <div ref={loadMoreRef} style={{ marginTop: 8 }} />


            {isLoadingMore && viewMode === "list" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  maxWidth: 860,
                  margin: "0 auto",
                }}
              >
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="skeleton-card"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 20,
                      padding: "20px 24px",
                    }}
                  >
                    <div
                      className="skeleton-shimmer"
                      style={{
                        width: 84,
                        height: 84,
                        borderRadius: 12,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div
                        className="skeleton-shimmer"
                        style={{
                          height: 14,
                          borderRadius: 6,
                          marginBottom: 10,
                          width: "60%",
                        }}
                      />
                      <div
                        className="skeleton-shimmer"
                        style={{
                          height: 11,
                          borderRadius: 6,
                          marginBottom: 8,
                          width: "85%",
                        }}
                      />
                      <div
                        className="skeleton-shimmer"
                        style={{ height: 10, borderRadius: 6, width: "40%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!hasMore && displayedItems.length > 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "32px 0 48px",
                  color: css.slate,
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  opacity: 0.5,
                }}
              >
                ✦ All posts loaded
              </div>
            )}
          </>
        ) : (
          /* ── Empty state ── */
          <div
            style={{
              background: css.lifted,
              borderRadius: css.r_hero,
              border: `1px dashed ${css.hairline}`,
              padding: "80px 40px",
              textAlign: "center",
            }}
          >
            <div
              style={{
                position: "relative",
                display: "inline-block",
                marginBottom: 24,
              }}
            >
              <div
                className="watermark"
                style={{
                  fontSize: 80,
                  position: "absolute",
                  top: "50%",
                  left: "50%",
                  transform: "translate(-50%,-50%)",
                  whiteSpace: "nowrap",
                }}
              >
                ✦
              </div>
              <div
                style={{
                  position: "relative",
                  width: 64,
                  height: 64,
                  borderRadius: css.r_btn,
                  background: css.ink,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto",
                }}
              >
                <Share2 size={26} style={{ color: css.canvas }} />
              </div>
            </div>
            <h3
              style={{
                fontSize: 28,
                fontWeight: 500,
                color: css.ink,
                margin: "0 0 10px",
                letterSpacing: "-0.02em",
              }}
            >
              {activeTab === "queue"
                ? "Your queue is empty"
                : activeTab === "drafts"
                  ? "No drafts yet"
                  : activeTab === "history"
                    ? "No broadcast history yet"
                    : "Ready for your first boost?"}
            </h3>
            <p
              style={{
                fontSize: 14,
                color: css.slate,
                margin: "0 0 28px",
                maxWidth: 300,
                marginLeft: "auto",
                marginRight: "auto",
                lineHeight: 1.5,
              }}
            >
              {activeTab === "sent" || activeTab === "history"
                ? "Create a post and broadcast it across your social channels to see analytics here."
                : "Schedule posts to see them appear here."}
            </p>
            {(activeTab === "sent" || activeTab === "history") && (
              <button
                className="btn-ink"
                onClick={() => setComposerOpen(true)}
                style={{ fontSize: 15, padding: "12px 32px" }}
              >
                Launch your first post
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2.5}
                  style={{ marginLeft: 6 }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 12h14M12 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      <ComposerModal
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        onPostCreated={fetchBroadcasts}
      />
      <AnimatePresence>
        {selectedPost && (
          <PostPreviewModal
            post={selectedPost}
            onClose={() => setSelectedPost(null)}
            onDelete={async (id) => {
              try {
                const res = await apiClient.delete(`/api/broadcasts/${id}`);
                if (res.data.success) {
                  setBroadcasts(prev => prev.filter(b => b.id !== id));
                  setSelectedPost(null);
                }
              } catch (error) {
                console.error("Failed to delete post:", error);
                alert("Failed to delete post.");
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Disconnect Confirmation Modal */}
      <AnimatePresence>
        {disconnectConfirmOpen && selectedAccountInfo && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isDisconnectingAccount && setDisconnectConfirmOpen(false)}
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(20, 20, 19, 0.4)",
                backdropFilter: "blur(8px)",
                WebkitBackdropFilter: "blur(8px)",
              }}
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              style={{
                position: "relative",
                background: "#ffffff",
                borderRadius: "24px",
                padding: "28px 28px 24px",
                width: "100%",
                maxWidth: "420px",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.8)",
                border: "1px solid rgba(20, 20, 19, 0.08)",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                zIndex: 10,
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "20px",
                    fontWeight: 750,
                    color: css.ink,
                    margin: "0 0 8px",
                    letterSpacing: "-0.015em",
                  }}
                >
                  Disconnect Account
                </h3>
                <p
                  style={{
                    fontSize: "14px",
                    color: css.slate,
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  Are you sure you want to disconnect this account? This will stop all scheduled posts and automated replies for this page.
                </p>
              </div>

              {/* Account Card Preview inside modal */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  padding: "12px",
                  background: css.canvas,
                  borderRadius: "16px",
                  border: `1px solid ${css.hairline}`,
                }}
              >
                <div
                  style={{
                    background: "#ffffff",
                    borderRadius: "16px",
                    border: "1px solid rgba(255, 255, 255, 0.5)",
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.02), inset 0 1px 0 rgba(255, 255, 255, 0.6)",
                    width: "280px",
                  }}
                >
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    {selectedAccountInfo.profilePicture ? (
                      <div style={{ position: "relative", width: 40, height: 40 }}>
                        <img
                          src={selectedAccountInfo.profilePicture}
                          alt={selectedAccountInfo.username || "Profile"}
                          style={{
                            width: "100%",
                            height: "100%",
                            borderRadius: "50%",
                            objectFit: "cover",
                            border: "2px solid #ffffff",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                          }}
                        />
                        <div
                          style={{
                            position: "absolute",
                            bottom: -2,
                            right: -2,
                            background: "#ffffff",
                            borderRadius: "50%",
                            padding: 2,
                            boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {getPlatformIcon(selectedPlatform, 12)}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "10px",
                          background: "rgba(255, 255, 255, 0.75)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                          overflow: "hidden",
                        }}
                      >
                        {PLATFORM_HERO_LOGOS[selectedPlatform.split(":")[0]] ? (
                          <img
                            src={PLATFORM_HERO_LOGOS[selectedPlatform.split(":")[0]]}
                            alt={selectedPlatformName}
                            style={{
                              width: 28,
                              height: 28,
                              objectFit: "contain",
                            }}
                          />
                        ) : (
                          getPlatformIcon(selectedPlatform, 20)
                        )}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontSize: "9px",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: css.slate,
                        fontWeight: 700,
                        marginBottom: 1,
                      }}
                    >
                      {selectedAccountInfo.label || selectedPlatformName.split(" ")[0]} Active
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 750,
                        color: css.ink,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        lineHeight: 1.25,
                      }}
                    >
                      {selectedAccountInfo.username ? `@${selectedAccountInfo.username}` : selectedPlatformName}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  disabled={isDisconnectingAccount}
                  onClick={() => setDisconnectConfirmOpen(false)}
                  style={{
                    flex: 1,
                    padding: "12px 18px",
                    borderRadius: "12px",
                    border: `1px solid ${css.hairline}`,
                    background: "#ffffff",
                    color: css.slate,
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#fcfbfa";
                    e.currentTarget.style.color = css.ink;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ffffff";
                    e.currentTarget.style.color = css.slate;
                  }}
                >
                  Keep Connected
                </button>
                <button
                  type="button"
                  disabled={isDisconnectingAccount}
                  onClick={handleDisconnectSelectedAccount}
                  style={{
                    flex: 1,
                    padding: "12px 18px",
                    borderRadius: "12px",
                    border: "none",
                    background: "#ef4444",
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "#dc2626";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "#ef4444";
                  }}
                >
                  {isDisconnectingAccount ? "Disconnecting..." : "Disconnect"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Dashboard;
