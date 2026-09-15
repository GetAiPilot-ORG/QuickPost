import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Masonry from "react-masonry-css";
import {
  Sparkles,
  Flame,
  Search,
  RefreshCw,
  Bookmark,
  BookmarkCheck,
  Send,
  SlidersHorizontal,
  ExternalLink,
  Play,
  Video,
  Newspaper,
  TrendingUp,
  Image as ImageIcon,
  MessageSquare,
  Copy,
  Check,
  X,
  Globe,
  Film,
  Zap,
  Layers,
  FileText,
  ListOrdered,
  Lightbulb,
  Volume2,
  VolumeX,
  ArrowUpRight,
  ChevronDown,
  LayoutGrid,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import apiClient from "../utils/apiClient";
import ComposerModal from "../components/ComposerModal";
import InfoHelp from "../components/InfoHelp";

const PAGE_SIZE = 25;
const MAX_SEEN_IDS = 300;

// Pinterest Responsive Masonry Breakpoints
const MASONRY_BREAKPOINTS = {
  default: 5,
  1680: 5,
  1380: 4,
  1024: 3,
  640: 2,
  440: 1,
};

const FORMAT_TABS = [
  { id: "all", label: "All Pins", icon: LayoutGrid },
  { id: "videos", label: "Videos & Reels", icon: Video },
  { id: "visuals", label: "Visuals", icon: ImageIcon },
  { id: "news", label: "News", icon: Newspaper },
  { id: "searches", label: "Trending Searches", icon: TrendingUp },
];

const NICHE_PILLS = [
  { id: "all", label: "All Niches" },
  { id: "tech_ai", label: "AI & Tech" },
  { id: "business_finance", label: "Business & Finance" },
  { id: "marketing_creators", label: "Creator Economy" },
  { id: "entertainment", label: "Entertainment" },
  { id: "health_fitness", label: "Health & Fitness" },
  { id: "design_art", label: "Design & Art" },
  { id: "gaming", label: "Gaming" },
  { id: "science_space", label: "Science & Space" },
];

const REGION_OPTIONS = [
  { code: "US", label: "United States" },
  { code: "IN", label: "India" },
  { code: "GB", label: "United Kingdom" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
  { code: "GLOBAL", label: "Global" },
];

function emptyProfile() {
  return { work: "", interests: "", goal: "" };
}

function getHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function formatDate(value) {
  if (!value) return "Live Now";
  try {
    const date = new Date(value);
    const now = new Date();
    const diffHours = Math.round((now - date) / (1000 * 60 * 60));
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
  } catch {
    return "Trending";
  }
}

function getYouTubeVideoId(post) {
  if (!post) return null;
  if (post.source_platform === "youtube" && post.video_id && post.video_id.length === 11) {
    return post.video_id;
  }
  const candidates = [post.source_url, post.embed_html, post.id];
  for (const value of candidates) {
    if (!value || typeof value !== "string") continue;
    try {
      const match = value.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
      if (match?.[1]) return match[1];
    } catch {
      // ignore
    }
  }
  return null;
}

// -----------------------------------------------------------------------------
// PINTEREST PIN MEDIA (Native HTML5 Video on Hover + YouTube Hover Autoplay)
// -----------------------------------------------------------------------------
function PinterestPinMedia({ post, onOpenLightbox, onRemix, onCompose, onSave, isSaved }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isHoverPlaying, setIsHoverPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);

  const videoId = post.source_platform === "youtube" ? getYouTubeVideoId(post) : null;
  const isPexels = post.source_platform === "pexels" && Boolean(post.video_url);
  const isVideoPin = isPexels || Boolean(videoId);
  const isShortOrReel = post.content_type === "short" || post.source_url?.includes("/shorts/") || isPexels;

  // Debounce hover playback slightly for YouTube to prevent flash/stutter on swift scroll
  useEffect(() => {
    let timer;
    if (isHovered && videoId) {
      timer = setTimeout(() => {
        setIsHoverPlaying(true);
      }, 100);
    } else {
      setIsHoverPlaying(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isHovered, videoId]);

  // Play/pause Pexels HTML5 video smoothly on hover
  useEffect(() => {
    if (!isPexels || !videoRef.current) return;
    if (isHovered) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isHovered, isPexels]);

  const getAspectRatioClass = () => {
    if (isPexels || isShortOrReel) return "aspect-[9/16]";
    if (post.source_platform === "unsplash") {
      const ar = parseFloat(post.aspect_ratio || "0.8");
      if (ar < 0.75) return "aspect-[9/16]";
      if (ar < 0.9) return "aspect-[3/4]";
      if (ar < 1.15) return "aspect-[4/5]";
      return "aspect-[16/10]";
    }
    if (post.content_type === "visual") return "aspect-[3/4]";
    if (post.source_platform === "google_trends") return "aspect-[4/3]";
    if (videoId) return "aspect-[16/10]";
    return "aspect-[4/3]";
  };

  return (
    <div
      className={`relative w-full ${getAspectRatioClass()} rounded-2xl overflow-hidden bg-neutral-900 group cursor-pointer shadow-sm hover:shadow-md transition-shadow duration-300`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onOpenLightbox(post)}
    >
      {/* 1. NATIVE VIDEO LAYER (Pexels) OR HOVER YOUTUBE PLAYER OR CRISP THUMBNAIL */}
      {isPexels ? (
        <video
          ref={videoRef}
          src={post.video_url}
          poster={post.thumbnail_url}
          muted={isMuted}
          playsInline
          loop
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : videoId && isHoverPlaying ? (
        <div className="w-full h-full relative overflow-hidden bg-black flex items-center justify-center">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=1&controls=0&modestbranding=1&loop=1&playlist=${videoId}&playsinline=1&enablejsapi=1`}
            title={post.title || "YouTube Preview"}
            className="w-[140%] h-[140%] -ml-[20%] -mt-[20%] object-cover border-0 pointer-events-none"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
      ) : post.thumbnail_url ? (
        <img
          src={post.thumbnail_url}
          alt={post.title || ""}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : post.source_platform === "google_trends" ? (
        <div className="w-full h-full p-5 bg-[#171614] border border-white/10 flex flex-col justify-between text-white rounded-2xl group-hover:border-neutral-700 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-bold text-neutral-300">
              <Flame size={13} className="text-orange-400" />
              <span>Trending Search</span>
            </div>
            <span className="text-[11px] font-bold text-neutral-400">
              #{post.metrics?.rank || "1"}
            </span>
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1">
              Search Surge
            </span>
            <h3 className="text-lg font-bold leading-snug text-white line-clamp-2 group-hover:text-orange-400 transition-colors">
              {post.title}
            </h3>
            <span className="text-xs text-neutral-400 font-medium mt-1.5 inline-block">
              {post.metrics?.searchVolume || "50K+"} searches
            </span>
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-neutral-900 text-neutral-400">
          <Sparkles size={28} className="text-orange-400 mb-2" />
          <span className="text-xs font-bold uppercase">{post.source_platform}</span>
        </div>
      )}

      {/* Discrete Video Badge in Bottom-Left (Clean Pinterest Style) */}
      {isVideoPin && (
        <div className="absolute bottom-2.5 left-2.5 px-2 py-0.8 rounded-md bg-black/60 backdrop-blur-md text-white text-[10px] font-semibold flex items-center gap-1 shadow-sm pointer-events-none">
          <Play size={10} className="fill-current text-white" />
          <span>{isPexels ? "Reel" : isShortOrReel ? "Short" : "Video"}</span>
        </div>
      )}

      {/* Top-Right Quick Remix Button on Hover */}
      <div
        className={`absolute top-2.5 right-2.5 transition-opacity duration-200 z-10 ${
          isHovered ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemix(post);
          }}
          className="px-3 py-1 rounded-full bg-neutral-900/90 hover:bg-neutral-900 text-white text-xs font-semibold shadow-lg backdrop-blur-md hover:scale-105 active:scale-95 transition-all flex items-center gap-1"
          title="Remix with AI"
        >
          <Zap size={11} className="text-orange-400 fill-current" />
          <span>Remix</span>
        </button>
      </div>

      {/* Discrete Sound Toggle for Pexels video (Bottom right corner, no blur) */}
      {isPexels && isHovered && (
        <div className="absolute bottom-2.5 right-2.5 z-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            className="p-1.5 rounded-full bg-black/70 hover:bg-black text-white/90 hover:text-white border border-white/20 transition-transform hover:scale-110"
            title={isMuted ? "Unmute sound" : "Mute"}
          >
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// PINTEREST STYLE PIN CARD
// -----------------------------------------------------------------------------
function PinterestPinCard({ post, onRemix, onCompose, onSave, isSaved, onOpenLightbox }) {
  return (
    <div className="mb-6 flex flex-col group">
      {/* Pin Media (Clean, 100% HD, Zero blur) */}
      <PinterestPinMedia
        post={post}
        onOpenLightbox={onOpenLightbox}
        onRemix={onRemix}
        onCompose={onCompose}
        onSave={onSave}
        isSaved={isSaved}
      />

      {/* Pin Footer */}
      <div className="pt-2.5 px-1">
        <h4
          onClick={() => onOpenLightbox(post)}
          className="text-[14px] sm:text-[15px] font-bold text-neutral-900 leading-snug line-clamp-2 cursor-pointer hover:text-orange-600 transition-colors"
        >
          {post.title || post.caption}
        </h4>

        <div className="flex items-center justify-between gap-2 mt-2 text-xs text-neutral-500">
          <div className="flex items-center gap-1.5 truncate">
            <div className="w-4 h-4 rounded-full bg-neutral-200 flex items-center justify-center text-[9px] font-black text-neutral-700 flex-shrink-0 uppercase">
              {post.creator?.[0] || post.source_platform?.[0] || "P"}
            </div>
            <span className="font-semibold text-neutral-700 truncate">
              {post.creator || post.source_platform}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Quick Source Link */}
            {post.source_url && (
              <a
                href={post.source_url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] font-semibold text-neutral-400 hover:text-neutral-700 flex items-center gap-0.5 transition-colors mr-0.5"
                title={`Open on ${getHost(post.source_url)}`}
              >
                <span>{getHost(post.source_url)}</span>
                <ArrowUpRight size={11} />
              </a>
            )}

            {/* Save Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSave(post);
              }}
              className={`p-1.5 rounded-full transition-all ${
                isSaved
                  ? "bg-amber-500 text-white shadow-sm"
                  : "hover:bg-neutral-200/70 text-neutral-500 hover:text-neutral-900"
              }`}
              title={isSaved ? "Saved" : "Save Pin"}
            >
              {isSaved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
            </button>

            {/* Compose Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCompose(post);
              }}
              className="p-1.5 rounded-full hover:bg-neutral-200/70 text-neutral-500 hover:text-neutral-900 transition-all"
              title="Compose Post with this Trend"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// CINEMATIC LIGHTBOX MODAL (Official clean YouTube & HTML5 Player)
// -----------------------------------------------------------------------------
function InspirationLightbox({ isOpen, onClose, post, onRemix, onCompose, onSave, isSaved }) {
  if (!isOpen || !post) return null;

  const videoId = post.source_platform === "youtube" ? getYouTubeVideoId(post) : null;
  const mediaUrl = post.video_url || post.full_image_url || post.thumbnail_url;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 lg:p-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative w-full max-w-5xl max-h-[90vh] bg-[#141210] border border-white/15 rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row z-10 text-white"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/70 hover:bg-black text-white backdrop-blur-md border border-white/15"
          >
            <X size={18} />
          </button>

          {/* Clean Player */}
          <div className="md:w-3/5 bg-black flex items-center justify-center overflow-hidden relative min-h-[300px]">
            {videoId ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`}
                title={post.title || "YouTube Player"}
                className="w-full aspect-video border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : post.video_url ? (
              <video
                src={post.video_url}
                autoPlay
                loop
                controls
                playsInline
                className="w-full max-h-[80vh] object-contain"
              />
            ) : mediaUrl ? (
              <img src={mediaUrl} alt="" className="w-full max-h-[80vh] object-contain" />
            ) : (
              <div className="p-10 text-center">
                <Flame size={48} className="mx-auto text-orange-500 mb-3" />
                <h3 className="text-xl font-bold">{post.title}</h3>
              </div>
            )}
          </div>

          {/* Details & Actions */}
          <div className="md:w-2/5 p-6 sm:p-8 flex flex-col justify-between bg-[#191714] border-t md:border-t-0 md:border-l border-white/10 overflow-y-auto custom-scrollbar">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 text-xs font-black uppercase tracking-wider">
                  {post.source_platform}
                </span>
                <span className="text-xs text-neutral-400">
                  {formatDate(post.published_at || post.ingested_at)}
                </span>
              </div>

              <h2 className="text-xl sm:text-2xl font-black leading-tight text-white mb-3">
                {post.title || post.caption}
              </h2>

              {post.caption && (
                <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed mb-4 whitespace-pre-wrap">
                  {post.caption}
                </p>
              )}

              {post.related_queries?.length > 0 && (
                <div className="mb-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                    Trending Search Keywords
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {post.related_queries.map((q, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-lg bg-white/10 text-white text-xs font-medium"
                      >
                        #{q}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-white/10 space-y-3">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onRemix(post);
                }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-600/30"
              >
                <Zap size={16} className="fill-current" />
                <span>Remix Idea with AI (Hooks & Script)</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCompose(post);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-950 font-bold text-xs flex items-center justify-center gap-1.5"
                >
                  <Send size={14} />
                  <span>Send to Post Composer</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSave(post)}
                  className={`p-2.5 rounded-xl border ${
                    isSaved
                      ? "bg-amber-500 text-white border-amber-600"
                      : "bg-white/10 border-white/20 text-white hover:bg-white/20"
                  }`}
                  title="Save idea"
                >
                  {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
                </button>

                <a
                  href={post.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 rounded-xl bg-white/10 border border-white/20 text-white hover:bg-white/20"
                  title="Open source"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// -----------------------------------------------------------------------------
// AI CREATIVE REMIX DRAWER
// -----------------------------------------------------------------------------
function TrendRemixDrawer({ isOpen, onClose, trendPost, onSendToComposer }) {
  const [loading, setLoading] = useState(false);
  const [remixData, setRemixData] = useState(null);
  const [activeTab, setActiveTab] = useState("hooks");
  const [copiedKey, setCopiedKey] = useState(null);

  const fetchRemix = useCallback(async (post) => {
    if (!post) return;
    setLoading(true);
    setRemixData(null);
    try {
      const { data } = await apiClient.post("/api/trends/remix", {
        title: post.title || post.caption || "Trend Inspiration",
        caption: post.caption || "",
        source_platform: post.source_platform || "trend",
        source_url: post.source_url || "",
        niche: (post.niche_tags || []).join(", ") || "creator",
      });
      if (data.success && data.remix) {
        setRemixData(data.remix);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || "Failed to generate AI remix.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen && trendPost) {
      fetchRemix(trendPost);
    }
  }, [isOpen, trendPost, fetchRemix]);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (!isOpen || !trendPost) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 220 }}
          className="relative w-full max-w-2xl h-full bg-[#faf7f2] border-l border-[#e2dcce] shadow-2xl flex flex-col z-10"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-[#e2dcce] bg-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="p-2.5 rounded-2xl bg-gradient-to-br from-orange-600 via-amber-600 to-orange-500 text-white shadow-lg shadow-orange-600/30">
                <Zap size={20} className="fill-current animate-pulse" />
              </span>
              <div>
                <h2 className="text-xl font-black text-neutral-950 leading-tight">
                  AI Creative Remix Studio
                </h2>
                <p className="text-xs text-neutral-500 font-medium">
                  Instant viral hooks, reel scripts, carousel blueprints & ready captions.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Context Snippet */}
          <div className="p-4 bg-orange-500/10 border-b border-orange-200/50 flex items-center gap-3">
            {trendPost.thumbnail_url && (
              <img
                src={trendPost.thumbnail_url}
                alt=""
                className="w-16 h-12 object-cover rounded-xl border border-orange-200 shadow-sm flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-black uppercase tracking-widest text-orange-800">
                Original Signal: {trendPost.source_platform}
              </span>
              <h4 className="text-xs font-bold text-neutral-950 truncate">
                {trendPost.title || trendPost.caption}
              </h4>
            </div>
            <button
              onClick={() => fetchRemix(trendPost)}
              disabled={loading}
              className="p-2 rounded-xl bg-white hover:bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-all"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Regenerate</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="px-5 pt-3 bg-white border-b border-[#e2dcce] flex gap-2 overflow-x-auto custom-scrollbar">
            {[
              { id: "hooks", label: "Viral Hooks (3)", icon: Lightbulb },
              { id: "script", label: "Reel / Short Script", icon: Video },
              { id: "thread", label: "Thread Breakdown", icon: ListOrdered },
              { id: "carousel", label: "Carousel Concept", icon: Layers },
              { id: "caption", label: "Ready Caption", icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-3 px-3 text-xs font-extrabold border-b-2 inline-flex items-center gap-1.5 transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "border-orange-600 text-orange-700 scale-[1.02]"
                      : "border-transparent text-neutral-500 hover:text-neutral-900"
                  }`}
                >
                  <Icon size={14} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 custom-scrollbar">
            {loading ? (
              <div className="h-72 flex flex-col items-center justify-center gap-3 text-center">
                <div className="p-4 rounded-3xl bg-orange-600/15 text-orange-600 animate-pulse">
                  <Sparkles size={32} />
                </div>
                <h4 className="text-base font-extrabold text-neutral-900">
                  Engineering Viral Remix Hooks...
                </h4>
                <p className="text-xs text-neutral-500 max-w-xs leading-relaxed">
                  Synthesizing pattern interrupts, pacing, and retention frameworks with OpenAI.
                </p>
              </div>
            ) : !remixData ? (
              <div className="text-center py-16 text-neutral-400 text-sm">
                No remix generated. Click Regenerate.
              </div>
            ) : (
              <div className="space-y-4">
                {/* 1. VIRAL HOOKS */}
                {activeTab === "hooks" && (
                  <div className="space-y-3.5">
                    <p className="text-xs font-semibold text-neutral-600">
                      High-converting pattern interrupts to stop the scroll in under 2 seconds:
                    </p>
                    {remixData.viral_hooks?.map((hookItem, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-white border border-[#e2dcce] rounded-2xl shadow-sm hover:border-orange-300 transition-all group"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2.5 py-0.5 rounded-lg bg-orange-100 text-orange-800 text-[10px] font-black uppercase tracking-wider">
                            {hookItem.style}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => copyToClipboard(hookItem.hook, `hook_${idx}`)}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100"
                              title="Copy hook"
                            >
                              {copiedKey === `hook_${idx}` ? <Check size={15} /> : <Copy size={15} />}
                            </button>
                            <button
                              onClick={() =>
                                onSendToComposer({
                                  caption: `${hookItem.hook}\n\n${trendPost.caption || ""}\n\nSource: ${trendPost.source_url}`,
                                  mediaUrl: trendPost.thumbnail_url || trendPost.video_url,
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-neutral-950 text-white text-xs font-bold inline-flex items-center gap-1 hover:bg-neutral-800 shadow"
                            >
                              <Send size={11} />
                              <span>Compose</span>
                            </button>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-neutral-900 leading-relaxed">
                          "{hookItem.hook}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. REEL / SHORT SCRIPT */}
                {activeTab === "script" && remixData.reel_script && (
                  <div className="p-5 bg-white border border-[#e2dcce] rounded-2xl space-y-4 shadow-sm">
                    <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
                          Vertical Video Script Blueprint
                        </span>
                        <h3 className="text-base font-black text-neutral-950">
                          {remixData.reel_script.title}
                        </h3>
                      </div>
                      <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-800 text-xs font-black">
                        ⏱️ {remixData.reel_script.estimated_duration}
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="p-3.5 bg-orange-500/10 rounded-xl border border-orange-200">
                        <span className="text-[11px] font-black uppercase text-orange-800 block mb-1">
                          0–3s Visual Hook
                        </span>
                        <p className="text-xs font-bold text-neutral-900">
                          {remixData.reel_script.hook}
                        </p>
                      </div>

                      <div>
                        <span className="text-[11px] font-black uppercase text-neutral-500 block mb-1.5">
                          Body Breakdown (Key Points)
                        </span>
                        <ul className="space-y-2">
                          {remixData.reel_script.body_points?.map((pt, idx) => (
                            <li
                              key={idx}
                              className="text-xs text-neutral-900 bg-neutral-50 p-3 rounded-xl border border-neutral-100 flex items-start gap-2.5 font-medium"
                            >
                              <span className="font-black text-orange-600">{idx + 1}.</span>
                              <span>{pt}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200">
                        <span className="text-[11px] font-black uppercase text-amber-900 block mb-1">
                          Call To Action (CTA)
                        </span>
                        <p className="text-xs text-amber-950 font-bold">
                          {remixData.reel_script.call_to_action}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        onSendToComposer({
                          caption: `🎬 REEL SCRIPT: ${remixData.reel_script.title}\n\n[HOOK]: ${remixData.reel_script.hook}\n\n[BODY POINTS]:\n${remixData.reel_script.body_points?.join("\n")}\n\n[CTA]: ${remixData.reel_script.call_to_action}\n\n#reels #viral #creator`,
                          mediaUrl: trendPost.thumbnail_url || trendPost.video_url,
                        })
                      }
                      className="w-full py-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black flex items-center justify-center gap-2 transition-all shadow-md"
                    >
                      <Send size={13} />
                      <span>Use Reel Script in Post Composer</span>
                    </button>
                  </div>
                )}

                {/* 3. THREAD BREAKDOWN */}
                {activeTab === "thread" && remixData.thread_angle && (
                  <div className="p-5 bg-white border border-[#e2dcce] rounded-2xl space-y-4 shadow-sm">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-600">
                        Opening Lead-In Post
                      </span>
                      <p className="text-xs font-bold text-neutral-950 mt-1.5 p-3.5 bg-neutral-50 rounded-xl border border-neutral-200">
                        {remixData.thread_angle.opening_post}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                        Thread Insights & Lessons
                      </span>
                      <div className="space-y-2 mt-1.5">
                        {remixData.thread_angle.key_insights?.map((insight, idx) => (
                          <div
                            key={idx}
                            className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 text-xs text-neutral-900 font-medium"
                          >
                            <span className="font-black text-orange-600 mr-2">#{idx + 1}</span>
                            {insight}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                        Closing Engagement Post
                      </span>
                      <p className="text-xs text-neutral-900 font-medium mt-1.5 p-3 bg-neutral-50 rounded-xl border border-neutral-100">
                        {remixData.thread_angle.closing_post}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        onSendToComposer({
                          caption: `${remixData.thread_angle.opening_post}\n\n${remixData.thread_angle.key_insights?.map((i, idx) => `${idx + 1}/ ${i}`).join("\n\n")}\n\n${remixData.thread_angle.closing_post}`,
                          mediaUrl: trendPost.thumbnail_url,
                        })
                      }
                      className="w-full py-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black flex items-center justify-center gap-2"
                    >
                      <Send size={13} />
                      <span>Send Thread to Post Composer</span>
                    </button>
                  </div>
                )}

                {/* 4. CAROUSEL CONCEPT */}
                {activeTab === "carousel" && remixData.carousel_concept && (
                  <div className="p-5 bg-white border border-[#e2dcce] rounded-2xl space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-black text-neutral-950">
                        {remixData.carousel_concept.topic}
                      </h4>
                      <span className="text-xs font-black text-orange-700 bg-orange-100 px-2.5 py-0.5 rounded-full">
                        5 Slides
                      </span>
                    </div>

                    <div className="space-y-2">
                      {remixData.carousel_concept.slides?.map((slide) => (
                        <div
                          key={slide.slide}
                          className="p-3 bg-neutral-50 rounded-xl border border-neutral-100 flex items-start gap-3"
                        >
                          <span className="w-6 h-6 rounded-full bg-neutral-950 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {slide.slide}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-neutral-950 block">
                              {slide.heading}
                            </span>
                            <p className="text-xs text-neutral-600 mt-0.5">{slide.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() =>
                        onSendToComposer({
                          caption: `📊 CAROUSEL: ${remixData.carousel_concept.topic}\n\n${remixData.carousel_concept.slides?.map((s) => `[Slide ${s.slide}: ${s.heading}]\n${s.text}`).join("\n\n")}\n\nSave this post! 📌`,
                          mediaUrl: trendPost.thumbnail_url,
                        })
                      }
                      className="w-full py-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black flex items-center justify-center gap-2"
                    >
                      <Send size={13} />
                      <span>Use Carousel in Composer</span>
                    </button>
                  </div>
                )}

                {/* 5. READY CAPTION */}
                {activeTab === "caption" && remixData.ready_to_post_caption && (
                  <div className="p-5 bg-white border border-[#e2dcce] rounded-2xl space-y-3.5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-widest text-orange-600">
                        Polished Post Caption
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(remixData.ready_to_post_caption, "full_caption")
                        }
                        className="text-xs text-neutral-700 hover:text-neutral-950 font-bold inline-flex items-center gap-1.5"
                      >
                        {copiedKey === "full_caption" ? <Check size={14} /> : <Copy size={14} />}
                        <span>Copy Draft</span>
                      </button>
                    </div>

                    <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-900 whitespace-pre-wrap leading-relaxed font-medium">
                      {remixData.ready_to_post_caption}
                    </div>

                    <button
                      onClick={() =>
                        onSendToComposer({
                          caption: remixData.ready_to_post_caption,
                          mediaUrl: trendPost.thumbnail_url || trendPost.video_url,
                        })
                      }
                      className="w-full py-3 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black flex items-center justify-center gap-2"
                    >
                      <Send size={13} />
                      <span>Open in Post Composer</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// -----------------------------------------------------------------------------
// SAVED INSPIRATION BOARD DRAWER
// -----------------------------------------------------------------------------
function SavedIdeasDrawer({ isOpen, onClose, savedPosts, onRemove, onRemix, onCompose, onClearAll }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex justify-end">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 220 }}
          className="relative w-full max-w-lg h-full bg-[#faf7f2] border-l border-[#e2dcce] shadow-2xl flex flex-col z-10"
        >
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-[#e2dcce] bg-white flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600">
                <BookmarkCheck size={20} />
              </span>
              <div>
                <h2 className="text-xl font-black text-neutral-950">Inspiration Board</h2>
                <p className="text-xs text-neutral-500 font-medium">
                  {savedPosts.length} saved trend spark{savedPosts.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {savedPosts.length > 0 && (
                <button
                  onClick={onClearAll}
                  className="text-xs text-red-600 hover:text-red-700 font-bold px-2 py-1"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-neutral-400 hover:text-neutral-900 rounded-xl hover:bg-neutral-100"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 custom-scrollbar">
            {savedPosts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-neutral-400">
                <Bookmark size={40} className="mb-2 opacity-40" />
                <p className="text-sm font-bold text-neutral-800">Your board is empty</p>
                <p className="text-xs mt-1 max-w-xs">
                  Click the bookmark button on any trend spark to save it for your next posting run.
                </p>
              </div>
            ) : (
              savedPosts.map((post) => (
                <div
                  key={post.id}
                  className="p-3.5 bg-white border border-[#e2dcce] rounded-2xl shadow-sm flex items-start gap-3.5 hover:border-amber-300 transition-all"
                >
                  {post.thumbnail_url && (
                    <img
                      src={post.thumbnail_url}
                      alt=""
                      className="w-18 h-16 object-cover rounded-xl flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 block">
                      {post.source_platform}
                    </span>
                    <h4 className="text-xs font-bold text-neutral-950 line-clamp-2 mt-0.5">
                      {post.title || post.caption}
                    </h4>
                    <div className="flex items-center gap-2 mt-2.5">
                      <button
                        onClick={() => {
                          onClose();
                          onRemix(post);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-orange-600 text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-sm"
                      >
                        <Zap size={11} />
                        <span>Remix</span>
                      </button>
                      <button
                        onClick={() => {
                          onClose();
                          onCompose(post);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-neutral-950 text-white text-[11px] font-bold inline-flex items-center gap-1"
                      >
                        <Send size={11} />
                        <span>Compose</span>
                      </button>
                      <button
                        onClick={() => onRemove(post.id)}
                        className="text-[11px] text-neutral-400 hover:text-red-600 ml-auto font-semibold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// -----------------------------------------------------------------------------
// MAIN PINTEREST TREND PAGE
// -----------------------------------------------------------------------------
export default function TrendFeedPage() {
  const { user } = useAuth();

  // Feed State
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState("");

  // Filters State
  const [selectedFormat, setSelectedFormat] = useState("all");
  const [selectedNiche, setSelectedNiche] = useState("all");
  const [selectedRegion, setSelectedRegion] = useState("US");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Hot Topics Radar Ticker
  const [hotTopics, setHotTopics] = useState([]);

  // Creator Personalization
  const [profile, setProfile] = useState(emptyProfile);
  const [draftProfile, setDraftProfile] = useState(emptyProfile);
  const [showProfileModal, setShowProfileModal] = useState(false);

  // Saved Inspiration Board
  const [savedIdeas, setSavedIdeas] = useState([]);
  const [showSavedDrawer, setShowSavedDrawer] = useState(false);

  // AI Remix Studio Drawer
  const [remixPost, setRemixPost] = useState(null);
  const [showRemixDrawer, setShowRemixDrawer] = useState(false);

  // Lightbox Preview
  const [lightboxPost, setLightboxPost] = useState(null);

  // Post Composer Modal
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerInitialData, setComposerInitialData] = useState({
    caption: "",
    mediaUrls: [],
    hashtags: [],
  });

  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const pageRef = useRef(1);
  const cursorRef = useRef(null);
  const seenRef = useRef(new Set());

  const userKey = user?.userId || user?.email || "anon";
  const seenStorageKey = `qp_trend_seen_${userKey}`;
  const profileStorageKey = `qp_trend_profile_${userKey}`;
  const savedIdeasStorageKey = `qp_trend_saved_ideas_${userKey}`;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load localStorage state
  useEffect(() => {
    try {
      seenRef.current = new Set(JSON.parse(localStorage.getItem(seenStorageKey) || "[]"));
    } catch {
      seenRef.current = new Set();
    }

    try {
      const saved = JSON.parse(localStorage.getItem(profileStorageKey) || "null");
      if (saved?.interests) {
        setProfile(saved);
        setDraftProfile(saved);
      }
    } catch {
      // ignore
    }

    try {
      const savedIdeasRaw = JSON.parse(localStorage.getItem(savedIdeasStorageKey) || "[]");
      setSavedIdeas(Array.isArray(savedIdeasRaw) ? savedIdeasRaw : []);
    } catch {
      setSavedIdeas([]);
    }
  }, [seenStorageKey, profileStorageKey, savedIdeasStorageKey]);

  // Load Hot Topics Radar
  useEffect(() => {
    async function loadHotTopics() {
      try {
        const { data } = await apiClient.get("/api/trends/hot-topics", {
          params: { geo: selectedRegion },
        });
        if (data.success && Array.isArray(data.hotTopics)) {
          setHotTopics(data.hotTopics);
        }
      } catch (err) {
        console.warn("Hot topics radar error:", err);
      }
    }
    loadHotTopics();
  }, [selectedRegion]);

  const rememberSeen = useCallback(
    (posts) => {
      const seen = seenRef.current;
      posts.forEach((post) => {
        if (post?.id) seen.add(post.id);
      });
      const trimmed = Array.from(seen).slice(-MAX_SEEN_IDS);
      seenRef.current = new Set(trimmed);
      localStorage.setItem(seenStorageKey, JSON.stringify(trimmed));
    },
    [seenStorageKey]
  );

  // Load page with true infinite pagination
  const loadPage = useCallback(
    async ({ reset = false } = {}) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError("");

      const targetPage = reset ? 1 : pageRef.current;
      const targetCursor = reset ? null : cursorRef.current;

      try {
        const interestQuery = [profile.work, profile.interests, profile.goal]
          .filter(Boolean)
          .join(",");

        const { data } = await apiClient.get("/api/trends/feed", {
          params: {
            limit: PAGE_SIZE,
            page: targetPage,
            cursor: targetCursor || undefined,
            type: selectedFormat,
            category: selectedNiche,
            region: selectedRegion,
            search: debouncedSearch || undefined,
            seen: Array.from(seenRef.current).join(",") || undefined,
            interests: interestQuery || undefined,
          },
        });

        const nextItems = data.items || [];
        rememberSeen(nextItems);

        setItems((current) => {
          if (reset) return nextItems;
          const existingIds = new Set(current.map((item) => item.id));
          const filtered = nextItems.filter((item) => !existingIds.has(item.id));
          return [...current, ...filtered];
        });

        cursorRef.current = data.nextCursor || null;
        const nextP = targetPage + 1;
        pageRef.current = nextP;

        setInitialLoaded(true);
      } catch (err) {
        setError(err.response?.data?.error || err.message || "Failed to load trend sparks.");
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [selectedFormat, selectedNiche, selectedRegion, debouncedSearch, profile, rememberSeen]
  );

  // Trigger reset reload on filter changes
  useEffect(() => {
    pageRef.current = 1;
    cursorRef.current = null;
    loadPage({ reset: true });
  }, [selectedFormat, selectedNiche, selectedRegion, debouncedSearch, loadPage]);

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !loadingRef.current) {
          loadPage({ reset: false });
        }
      },
      { rootMargin: "1200px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadPage]);

  // Bookmark / Save
  const toggleSaveIdea = (post) => {
    setSavedIdeas((current) => {
      const exists = current.some((item) => item.id === post.id);
      let updated;
      if (exists) {
        updated = current.filter((item) => item.id !== post.id);
        toast("Removed from Inspiration Board", { icon: "🗑️" });
      } else {
        updated = [post, ...current];
        toast.success("Saved to Inspiration Board!");
      }
      localStorage.setItem(savedIdeasStorageKey, JSON.stringify(updated));
      return updated;
    });
  };

  const clearAllSavedIdeas = () => {
    setSavedIdeas([]);
    localStorage.removeItem(savedIdeasStorageKey);
    toast("Inspiration Board cleared");
  };

  const handleOpenRemix = (post) => {
    setRemixPost(post);
    setShowRemixDrawer(true);
  };

  const handleOpenComposer = (postOrPayload) => {
    if (postOrPayload.caption && postOrPayload.mediaUrl !== undefined) {
      setComposerInitialData({
        caption: postOrPayload.caption,
        mediaUrls: postOrPayload.mediaUrl ? [postOrPayload.mediaUrl] : [],
        hashtags: [],
      });
    } else {
      const post = postOrPayload;
      const initialText = `${post.title || post.caption || "Trending insight"}\n\nVia ${post.source_platform.toUpperCase()} (${post.source_url})`;
      const media = post.thumbnail_url || post.video_url || post.full_image_url;
      setComposerInitialData({
        caption: initialText,
        mediaUrls: media ? [media] : [],
        hashtags: (post.niche_tags || []).filter((t) => t && !t.includes(" ")),
      });
    }
    setComposerOpen(true);
  };

  const handleSaveProfile = (e) => {
    e.preventDefault();
    const nextProfile = {
      work: draftProfile.work.trim(),
      interests: draftProfile.interests.trim(),
      goal: draftProfile.goal.trim(),
    };
    setProfile(nextProfile);
    localStorage.setItem(profileStorageKey, JSON.stringify(nextProfile));
    setShowProfileModal(false);
    toast.success("Personalization saved!");
    pageRef.current = 1;
    cursorRef.current = null;
    loadPage({ reset: true });
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-neutral-900 p-4 sm:p-6 lg:p-8">
      {/* 1. MACOS CLEAN COMMAND HEADER */}
      <header className="mb-6 space-y-3.5">
        {/* Row 1: Title & Main Actions */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900 leading-tight inline-flex items-center gap-2">
              Inspiration Feed
              <InfoHelp text="Curated real-time trending content, viral hooks, and creative formats discovered from YouTube, Pinterest, and social streams" />
            </h1>
            <p className="text-xs text-neutral-500 mt-0.5 font-normal">
              Trending videos, reels, and creative inspiration from across the web.
            </p>
          </div>

          {/* Right Toolbar: Search + Tools */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search topics, creators, hooks..."
                className="w-full h-9 pl-9 pr-8 rounded-lg bg-white border border-neutral-200 text-xs font-normal text-neutral-900 placeholder:text-neutral-400 shadow-sm outline-none focus:border-neutral-400 focus:ring-1 focus:ring-neutral-200 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 p-0.5"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Region Dropdown */}
            <div className="relative">
              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value)}
                className="h-9 pl-3 pr-7 rounded-lg bg-white border border-neutral-200 text-xs font-medium text-neutral-700 shadow-sm outline-none focus:border-neutral-400 cursor-pointer appearance-none hover:bg-neutral-50 transition-colors"
              >
                {REGION_OPTIONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={13}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
              />
            </div>

            {/* Saved Board */}
            <button
              type="button"
              onClick={() => setShowSavedDrawer(true)}
              className="h-9 px-3 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-700 shadow-sm inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
            >
              <BookmarkCheck size={14} className="text-neutral-600" />
              <span>Saved</span>
              {savedIdeas.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-neutral-900 text-white text-[10px] font-bold">
                  {savedIdeas.length}
                </span>
              )}
            </button>

            {/* Personalize */}
            <button
              type="button"
              onClick={() => setShowProfileModal(true)}
              className="h-9 px-3 rounded-lg bg-white border border-neutral-200 hover:bg-neutral-50 text-xs font-medium text-neutral-700 shadow-sm inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              title="Personalize niches"
            >
              <SlidersHorizontal size={13} />
              <span>Personalize</span>
            </button>

            {/* Refresh */}
            <button
              type="button"
              onClick={() => {
                pageRef.current = 1;
                cursorRef.current = null;
                loadPage({ reset: true });
              }}
              disabled={loading}
              className="h-9 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-medium shadow-sm inline-flex items-center gap-1.5 transition-all disabled:opacity-50 whitespace-nowrap"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Row 2: Unified Filter & Niche Ribbon */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {/* Format Segmented Tab */}
          <div className="bg-neutral-200/70 p-0.5 rounded-lg flex items-center gap-0.5 border border-neutral-300/40 flex-shrink-0">
            {FORMAT_TABS.map((tab) => {
              const active = selectedFormat === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedFormat(tab.id)}
                  className={`h-7 px-2.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${
                    active
                      ? "bg-white text-neutral-950 shadow-sm font-semibold"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-white/40"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="h-5 w-px bg-neutral-300 flex-shrink-0 mx-1" />

          {/* Niche Categories Ribbon */}
          <div className="flex items-center gap-1.5 flex-1">
            {NICHE_PILLS.map((niche) => {
              const active = selectedNiche === niche.id;
              return (
                <button
                  key={niche.id}
                  onClick={() => setSelectedNiche(niche.id)}
                  className={`h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    active
                      ? "bg-neutral-900 text-white shadow-sm font-semibold"
                      : "bg-white text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 border border-neutral-200/80"
                  }`}
                >
                  {niche.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Subtle Trending Ticker */}
        {hotTopics.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-neutral-500 overflow-hidden pt-0.5">
            <span className="font-semibold text-neutral-700 text-[11px] uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
              <Flame size={12} className="text-orange-500 fill-current" />
              <span>Trending:</span>
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 py-0.5">
              {hotTopics.map((topic, idx) => (
                <button
                  key={idx}
                  onClick={() => setSearchQuery(topic.query)}
                  className={`px-2 py-0.5 rounded text-xs whitespace-nowrap transition-colors ${
                    searchQuery === topic.query
                      ? "bg-neutral-900 text-white font-medium"
                      : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60"
                  }`}
                >
                  {topic.query}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* 4. REAL PINTEREST MASONRY */}
      {error ? (
        <div className="p-8 text-center bg-white rounded-3xl border border-red-200 text-red-600 font-bold shadow-sm max-w-lg mx-auto my-8">
          {error}
        </div>
      ) : !initialLoaded && loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="mb-6 rounded-2xl bg-white border border-[#e2dcce] p-3 flex flex-col gap-2.5 animate-pulse"
            >
              <div className={`w-full ${i % 2 === 0 ? "h-64" : "h-44"} bg-neutral-200 rounded-xl`} />
              <div className="w-4/5 h-4 bg-neutral-200 rounded mt-1" />
              <div className="w-1/2 h-3 bg-neutral-200 rounded" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-[#e2dcce] shadow-sm max-w-md mx-auto my-12">
          <Sparkles size={40} className="mx-auto text-orange-500 mb-3 opacity-80" />
          <h3 className="text-lg font-black text-neutral-950">No inspiration found</h3>
          <p className="text-xs text-neutral-500 mt-1 mb-5 leading-relaxed font-medium">
            Try switching format tabs, selecting another niche, or clearing your search term.
          </p>
          <button
            onClick={() => {
              setSelectedFormat("all");
              setSelectedNiche("all");
              setSearchQuery("");
            }}
            className="px-5 py-2.5 rounded-xl bg-neutral-950 text-white text-xs font-black shadow-md"
          >
            Reset All Filters
          </button>
        </div>
      ) : (
        <Masonry
          breakpointCols={MASONRY_BREAKPOINTS}
          className="flex w-auto -ml-5"
          columnClassName="pl-5 bg-clip-padding"
        >
          {items.map((post) => (
            <PinterestPinCard
              key={post.id}
              post={post}
              onRemix={handleOpenRemix}
              onCompose={handleOpenComposer}
              onSave={toggleSaveIdea}
              isSaved={savedIdeas.some((item) => item.id === post.id)}
              onOpenLightbox={(p) => setLightboxPost(p)}
            />
          ))}
        </Masonry>
      )}

      {/* 5. INFINITE SCROLL SENTINEL */}
      <div ref={sentinelRef} className="h-20 flex items-center justify-center my-6">
        {loading && initialLoaded && (
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-white border border-[#e2dcce] shadow-sm text-xs font-black text-neutral-800">
            <RefreshCw size={15} className="animate-spin text-orange-600" />
            <span>Loading more inspiration pins...</span>
          </div>
        )}
      </div>

      {/* 6. CINEMATIC LIGHTBOX MODAL */}
      <InspirationLightbox
        isOpen={Boolean(lightboxPost)}
        onClose={() => setLightboxPost(null)}
        post={lightboxPost}
        onRemix={handleOpenRemix}
        onCompose={handleOpenComposer}
        onSave={toggleSaveIdea}
        isSaved={lightboxPost ? savedIdeas.some((item) => item.id === lightboxPost.id) : false}
      />

      {/* 7. AI REMIX STUDIO DRAWER */}
      <TrendRemixDrawer
        isOpen={showRemixDrawer}
        onClose={() => setShowRemixDrawer(false)}
        trendPost={remixPost}
        onSendToComposer={(payload) => {
          setShowRemixDrawer(false);
          handleOpenComposer(payload);
        }}
      />

      {/* 8. SAVED IDEAS BOARD DRAWER */}
      <SavedIdeasDrawer
        isOpen={showSavedDrawer}
        onClose={() => setShowSavedDrawer(false)}
        savedPosts={savedIdeas}
        onRemove={(id) => {
          setSavedIdeas((cur) => {
            const updated = cur.filter((p) => p.id !== id);
            localStorage.setItem(savedIdeasStorageKey, JSON.stringify(updated));
            return updated;
          });
        }}
        onRemix={handleOpenRemix}
        onCompose={handleOpenComposer}
        onClearAll={clearAllSavedIdeas}
      />

      {/* 9. POST COMPOSER MODAL */}
      <ComposerModal
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        initialCaption={composerInitialData.caption}
        initialMediaUrls={composerInitialData.mediaUrls}
        initialHashtags={composerInitialData.hashtags}
      />

      {/* 10. TUNE MY FEED PERSONALIZATION MODAL */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-[#fffdfa] rounded-3xl border border-[#e2dcce] shadow-2xl p-6 sm:p-7"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-orange-600 text-white shadow-md shadow-orange-600/30">
                  <SlidersHorizontal size={18} />
                </span>
                <h3 className="text-xl font-black text-neutral-950">Tune Your Inspiration</h3>
              </div>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-1.5 text-neutral-400 hover:text-neutral-900 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-neutral-600 mb-5 leading-relaxed font-medium">
              Specify your creator role, favorite topics, and primary content formats. Our algorithm
              boosts matching signals directly to the top of your infinite feed.
            </p>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-neutral-800 uppercase tracking-wider mb-1.5">
                  Your Role / Agency / Brand
                </label>
                <input
                  type="text"
                  value={draftProfile.work}
                  onChange={(e) =>
                    setDraftProfile((cur) => ({ ...cur, work: e.target.value }))
                  }
                  placeholder="e.g. AI SaaS Founder, Tech YouTuber, Fitness Coach"
                  className="w-full h-11 px-3.5 rounded-xl bg-neutral-50 border border-[#e2dcce] text-xs font-semibold text-neutral-900 outline-none focus:border-orange-600"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-neutral-800 uppercase tracking-wider mb-1.5">
                  Core Topics / Keywords
                </label>
                <input
                  type="text"
                  value={draftProfile.interests}
                  onChange={(e) =>
                    setDraftProfile((cur) => ({ ...cur, interests: e.target.value }))
                  }
                  placeholder="e.g. AI tools, productivity, trading, video editing"
                  className="w-full h-11 px-3.5 rounded-xl bg-neutral-50 border border-[#e2dcce] text-xs font-semibold text-neutral-900 outline-none focus:border-orange-600"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-black text-neutral-800 uppercase tracking-wider mb-1.5">
                  Target Content Formats
                </label>
                <input
                  type="text"
                  value={draftProfile.goal}
                  onChange={(e) =>
                    setDraftProfile((cur) => ({ ...cur, goal: e.target.value }))
                  }
                  placeholder="e.g. 30s Reels, Twitter threads, Carousels, Stories"
                  className="w-full h-11 px-3.5 rounded-xl bg-neutral-50 border border-[#e2dcce] text-xs font-semibold text-neutral-900 outline-none focus:border-orange-600"
                />
              </div>

              <button
                type="submit"
                className="w-full h-11 mt-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-xs font-black transition-all shadow-md"
              >
                Save & Tune Infinite Feed
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
