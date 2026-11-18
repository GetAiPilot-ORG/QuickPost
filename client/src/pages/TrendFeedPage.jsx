import { useSearchParams } from "react-router-dom";
import { ScheduledMediaGallery } from "../components/ScheduledMedia";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Masonry from "react-masonry-css";
import {
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
  Layers,
  FileText,
  ListOrdered,
  Lightbulb,
  Volume2,
  VolumeX,
  ArrowUpRight,
  ChevronDown,
  Eye,
  Heart,
  Share2,
  Zap,
  Sparkles,
  Repeat2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import apiClient from "../utils/apiClient";
import ComposerModal from "../components/ComposerModal";

const PAGE_SIZE = 24;
const MAX_SEEN_IDS = 300;

// Editorial Mobile-First Breakpoints: Strictly 1 column on mobile (< 640px, e.g. 390px iPhone)
const MASONRY_BREAKPOINTS = {
  default: 3,
  1440: 3,
  1024: 2,
  640: 1,
};

const FORMAT_TABS = [
  { id: "all", label: "All Trends" },
  { id: "pinterest", label: "Pinterest", iconSvg: "/icons/pinterest-round-color-icon.svg" },
  { id: "bluesky", label: "Bluesky", iconSvg: "/icons/bluesky-circle-color-icon.svg" },
  { id: "videos", label: "Reels & Videos", icon: Video },
  { id: "visuals", label: "Visuals & Photos", icon: ImageIcon },
  { id: "news", label: "News & Stories", icon: Newspaper },
  { id: "searches", label: "Search Trends", icon: TrendingUp },
];

const NICHE_PILLS = [
  { id: "all", label: "All Topics" },
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
  { code: "GLOBAL", label: "Global", flag: "🌐" },
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "IN", label: "India", flag: "🇮🇳" },
  { code: "GB", label: "United Kingdom", flag: "🇬🇧" },
  { code: "CA", label: "Canada", flag: "🇨🇦" },
  { code: "AU", label: "Australia", flag: "🇦🇺" },
];

const TREND_INTEREST_CATEGORIES = [
  "All",
  "Tech & AI",
  "Business & Wealth",
  "Creative & Media",
  "Lifestyle & Health",
  "Entertainment",
];

const TREND_INTEREST_TOPICS = [
  // Tech & AI
  { id: "ai_chatgpt", label: "AI & ChatGPT", emoji: "🤖", category: "Tech & AI", keywords: "ai, chatgpt, llm, artificial intelligence, claude, midjourney, prompt" },
  { id: "tech_gadgets", label: "Tech & Gadgets", emoji: "⚡", category: "Tech & AI", keywords: "tech, gadgets, apple, smartphone, setup, hardware, devices" },
  { id: "coding_dev", label: "Coding & Dev", emoji: "💻", category: "Tech & AI", keywords: "coding, programmer, developer, software, web development, python, code" },
  { id: "science_space", label: "Future & Space", emoji: "🚀", category: "Tech & AI", keywords: "science, future, space, astrophysics, robotics, astronomy" },

  // Business & Wealth
  { id: "startups_saas", label: "Startups & SaaS", emoji: "🏢", category: "Business & Wealth", keywords: "startups, saas, founder, indie hacker, entrepreneurship, building in public" },
  { id: "marketing_growth", label: "Marketing & Growth", emoji: "📈", category: "Business & Wealth", keywords: "marketing, growth, seo, copywriting, sales, advertising, branding" },
  { id: "finance_stocks", label: "Investing & Stocks", emoji: "💵", category: "Business & Wealth", keywords: "investing, stocks, wealth, portfolio, passive income, market" },
  { id: "crypto_bitcoin", label: "Crypto & Bitcoin", emoji: "🪙", category: "Business & Wealth", keywords: "crypto, bitcoin, ethereum, blockchain, web3, solana" },

  // Creative & Media
  { id: "creator_economy", label: "Creator Economy", emoji: "📱", category: "Creative & Media", keywords: "creator, monetization, youtube growth, hooks, editing, viral" },
  { id: "reels_video", label: "Reels & Short Video", emoji: "🎥", category: "Creative & Media", keywords: "video editing, reels, tiktok, capcut, cinematography, shortform" },
  { id: "design_3d", label: "Design & 3D Art", emoji: "🎨", category: "Creative & Media", keywords: "design, ui, ux, 3d, blender, graphic design, animation, typography" },
  { id: "photography_gear", label: "Photo & Cameras", emoji: "📸", category: "Creative & Media", keywords: "photography, camera, lighting, portraits, aesthetic, photo" },

  // Lifestyle & Health
  { id: "fitness_gym", label: "Fitness & Gym", emoji: "🏋️", category: "Lifestyle & Health", keywords: "fitness, gym, workout, muscle, bodybuilding, health, training" },
  { id: "productivity_habits", label: "Productivity & Focus", emoji: "💡", category: "Lifestyle & Health", keywords: "productivity, habits, focus, notion, daily routine, systems" },
  { id: "mindset_selfhelp", label: "Mindset & Motivation", emoji: "🧠", category: "Lifestyle & Health", keywords: "motivation, discipline, psychology, mindset, self improvement" },
  { id: "travel_nomad", label: "Travel & Nomad", emoji: "✈️", category: "Lifestyle & Health", keywords: "travel, nomad, adventure, explore, destinations, vacation" },
  { id: "food_cooking", label: "Food & Recipes", emoji: "🍔", category: "Lifestyle & Health", keywords: "food, cooking, recipes, street food, baking, chef, restaurant" },
  { id: "fashion_style", label: "Fashion & Outfits", emoji: "👟", category: "Lifestyle & Health", keywords: "fashion, streetwear, outfits, styling, sneakers, luxury, drip" },

  // Entertainment
  { id: "gaming_stream", label: "Gaming & Esports", emoji: "🎮", category: "Entertainment", keywords: "gaming, gta, playstation, twitch, steam, esports, xbox" },
  { id: "cinema_movies", label: "Cinema & TV Shows", emoji: "🍿", category: "Entertainment", keywords: "movies, cinema, trailer, series, netflix, hollywood, film" },
  { id: "comedy_memes", label: "Comedy & Memes", emoji: "😂", category: "Entertainment", keywords: "comedy, memes, jokes, funny, skits, relatable, humor" },
  { id: "music_audio", label: "Music & Trending Audio", emoji: "🎵", category: "Entertainment", keywords: "music, beats, hiphop, trending audio, sound, artists" },
  { id: "cars_supercars", label: "Cars & Supercars", emoji: "🏎️", category: "Entertainment", keywords: "cars, supercars, automotive, racing, f1, vehicles, tuning" },
  { id: "anime_manga", label: "Anime & Manga", emoji: "⛩️", category: "Entertainment", keywords: "anime, manga, animation, japan, otaku, cosplay" },
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

function formatCompactNumber(num) {
  if (num === null || num === undefined || num === "") return null;
  const n = typeof num === "string" ? parseFloat(num.replace(/[^0-9.]/g, "")) : Number(num);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return n.toLocaleString();
}

function formatTimeAgo(value) {
  if (!value) return "Live";
  try {
    const date = new Date(value);
    const now = new Date();
    const diffHours = Math.round((now - date) / (1000 * 60 * 60));
    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.round(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
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

function getBestMediaUrl(post) {
  if (!post) return null;
  const videoId = getYouTubeVideoId(post);
  const ytThumb = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  return post.thumbnail_url || ytThumb || post.video_url || post.full_image_url || null;
}

function getPlatformMeta(platform) {
  const p = String(platform || "").toLowerCase();
  switch (p) {
    case "youtube":
      return {
        name: "YouTube",
        iconSvg: "/icons/youtube-color-icon.svg",
        color: "text-red-600",
      };
    case "pinterest":
      return {
        name: "Pinterest",
        iconSvg: "/icons/pinterest-round-color-icon.svg",
        color: "text-rose-600",
      };
    case "bluesky":
      return {
        name: "Bluesky",
        iconSvg: "/icons/bluesky-circle-color-icon.svg",
        color: "text-sky-500",
      };
    case "instagram":
      return {
        name: "Instagram",
        iconSvg: "/icons/ig-instagram-icon.svg",
        color: "text-pink-600",
      };
    case "reddit":
      return {
        name: "Reddit",
        iconSvg: "/icons/reddit-icon.svg",
        color: "text-orange-600",
      };
    case "bluesky":
      return {
        name: "Bluesky",
        iconSvg: "/icons/bluesky-circle-color-icon.svg",
        color: "text-sky-500",
      };
    case "google_trends":
      return {
        name: "Google Trends",
        iconSvg: "/icons/google-icon.svg",
        color: "text-blue-600",
      };
    case "pexels":
      return {
        name: "Pexels",
        iconSvg: null,
        fallbackIcon: Video,
        color: "text-emerald-600",
      };
    case "unsplash":
      return {
        name: "Unsplash",
        iconSvg: null,
        fallbackIcon: ImageIcon,
        color: "text-neutral-900 dark:text-neutral-100",
      };
    case "news":
      return {
        name: "News",
        iconSvg: null,
        fallbackIcon: Newspaper,
        color: "text-amber-600",
      };
    default:
      return {
        name: platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : "Trend",
        iconSvg: null,
        fallbackIcon: Flame,
        color: "text-neutral-700",
      };
  }
}

// -----------------------------------------------------------------------------
// PREMIUM TREND CARD (Editorial Single-Column Mobile, Clean Multi-Column Desktop)
// -----------------------------------------------------------------------------
function TrendCard({ post, onUseIdea, onRemix, onCompose, onSave, isSaved, onOpenDetails }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef(null);

  const videoId = post.source_platform === "youtube" ? getYouTubeVideoId(post) : null;
  const isPexels = post.source_platform === "pexels" && Boolean(post.video_url);
  const isVideo = isPexels || Boolean(videoId);
  const isReel = post.content_type === "short" || post.source_url?.includes("/shorts/") || isPexels;
  const platformMeta = getPlatformMeta(post.source_platform);

  // Engagement stats
  const views = formatCompactNumber(post.metrics?.viewCount ?? post.metrics?.views);
  const likes = formatCompactNumber(post.metrics?.likeCount ?? post.metrics?.likes);
  const comments = formatCompactNumber(post.metrics?.commentCount ?? post.metrics?.comments ?? post.metrics?.replies);
  const saves = formatCompactNumber(post.metrics?.saveCount ?? post.metrics?.saves);
  const reposts = formatCompactNumber(post.metrics?.repostCount ?? post.metrics?.reposts);
  const searchVolume = post.metrics?.searchVolume || post.metrics?.formattedTraffic;
  const rank = post.metrics?.rank;

  // Auto-play / pause Pexels video on hover
  useEffect(() => {
    if (!isPexels || !videoRef.current) return;
    if (isHovered) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => { });
    } else {
      videoRef.current.pause();
    }
  }, [isHovered, isPexels]);

  // Clean aspect ratio tailored to content
  const getAspectRatioClass = () => {
    if (isPexels || isReel) return "aspect-[4/5] sm:aspect-[9/16]";
    if (post.source_platform === "pinterest") return "aspect-[2/3] sm:aspect-[3/4]";
    if (post.source_platform === "google_trends") return "aspect-[16/10]";
    if (videoId) return "aspect-[16/9]";
    if (post.content_type === "visual" || post.source_platform === "unsplash") return "aspect-[4/5]";
    if (post.source_platform === "bluesky" && !post.thumbnail_url) return "aspect-[16/10]";
    return "aspect-[16/10]";
  };

  const handleShare = (e) => {
    e.stopPropagation();
    const url = post.source_url || window.location.href;
    if (navigator.share) {
      navigator.share({ title: post.title, url }).catch(() => { });
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard!");
    }
  };

  return (
    <article
      className="group relative flex flex-col w-full mb-5 rounded-2xl bg-white dark:bg-[#161B22] border border-black/[0.07] dark:border-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_8px_24px_rgba(0,0,0,0.4)] transition-all duration-200 overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 1. CARD HEADER: Creator & Platform in clean minimal bar */}
      <div className="flex items-center justify-between px-3.5 py-3 border-b border-black/[0.04] dark:border-white/[0.06] bg-neutral-50/50 dark:bg-white/[0.02]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {platformMeta.iconSvg ? (
              <img src={platformMeta.iconSvg} alt={platformMeta.name} className="w-4 h-4 object-contain" />
            ) : platformMeta.fallbackIcon ? (
              <platformMeta.fallbackIcon size={13} className={platformMeta.color} />
            ) : (
              <span className="text-[10px] font-bold text-neutral-600 dark:text-neutral-400">
                {(post.creator || post.source_platform)?.[0]?.toUpperCase()}
              </span>
            )}
          </div>

          <div className="min-w-0 flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-[130px] sm:max-w-[170px]">
              {post.creator || platformMeta.name}
            </span>
            <span className="text-neutral-300 dark:text-neutral-600 font-light">•</span>
            <span className="text-neutral-400 dark:text-neutral-500 text-[11px] whitespace-nowrap">
              {formatTimeAgo(post.published_at || post.ingested_at)}
            </span>
          </div>
        </div>

        {/* Top-Right Bookmark Toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSave(post);
          }}
          className={`p-1.5 rounded-lg transition-colors ${isSaved
            ? "text-amber-500 hover:text-amber-600 bg-amber-500/10"
            : "text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
            }`}
          title={isSaved ? "Saved to Inspiration Board" : "Bookmark idea"}
        >
          {isSaved ? <BookmarkCheck size={16} className="fill-current" /> : <Bookmark size={16} />}
        </button>
      </div>

      {/* 2. MEDIA PREVIEW (Large, Crisp, Content-First) */}
      <div
        className={`relative w-full ${getAspectRatioClass()} bg-neutral-100 dark:bg-neutral-900 overflow-hidden cursor-pointer`}
        onClick={() => onOpenDetails(post)}
      >
        {isPexels ? (
          <video
            ref={videoRef}
            src={post.video_url}
            poster={post.thumbnail_url}
            muted={isMuted}
            playsInline
            loop
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : post.thumbnail_url ? (
          <div className="relative w-full h-full">
            <img
              src={post.thumbnail_url}
              alt={post.title || ""}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
            />
            {post.source_platform === "pinterest" && (
              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-rose-600/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1 pointer-events-none">
                <img src="/icons/pinterest-round-color-icon.svg" alt="" className="w-3 h-3 object-contain" />
                <span>Pin</span>
              </div>
            )}
            {post.source_platform === "bluesky" && (
              <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-sky-600/90 backdrop-blur-md text-white text-[10px] font-bold tracking-wider shadow-sm flex items-center gap-1 pointer-events-none">
                <img src="/icons/bluesky-circle-color-icon.svg" alt="" className="w-3 h-3 object-contain" />
                <span>Bluesky</span>
              </div>
            )}
          </div>
        ) : post.source_platform === "bluesky" ? (
          <div className="w-full h-full p-4 sm:p-5 bg-gradient-to-br from-sky-950 via-slate-900 to-sky-900 text-white flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-500/20 text-[10px] font-semibold text-sky-300">
                <img src="/icons/bluesky-circle-color-icon.svg" alt="" className="w-3 h-3" />
                <span>Bluesky Post</span>
              </span>
              <span className="text-[10px] font-bold text-sky-400 truncate max-w-[120px]">
                @{post.creator || "bluesky"}
              </span>
            </div>
            <p className="my-auto text-xs sm:text-sm font-medium text-slate-100 line-clamp-4 leading-relaxed">
              "{post.caption || post.title}"
            </p>
            <div className="text-[10px] text-sky-300/70 font-mono">
              Official ATProto Post
            </div>
          </div>
        ) : post.source_platform === "google_trends" ? (
          <div className="w-full h-full p-4 sm:p-5 bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 text-white flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 text-[11px] font-semibold text-neutral-200">
                <Flame size={12} className="text-amber-400 fill-current" />
                <span>Search Surge</span>
              </span>
              {rank && (
                <span className="text-[11px] font-bold text-neutral-400">
                  #{rank} Rising
                </span>
              )}
            </div>

            <div className="my-auto py-2">
              <h3 className="text-base sm:text-lg font-bold leading-snug text-white line-clamp-2">
                {post.title}
              </h3>
              {searchVolume && (
                <p className="text-xs text-amber-300 font-semibold mt-1">
                  {searchVolume} searches
                </p>
              )}
            </div>

            {post.related_queries?.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-hidden">
                {post.related_queries.slice(0, 3).map((q, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-neutral-300 truncate"
                  >
                    #{q}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-6 text-neutral-400 bg-neutral-100 dark:bg-neutral-900">
            <Flame size={28} className="text-neutral-400 dark:text-neutral-600 mb-1.5" />
            <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              {platformMeta.name}
            </span>
          </div>
        )}

        {/* Video Type Chip (Discrete, Editorial) */}
        {isVideo && (
          <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white text-[10px] font-medium flex items-center gap-1 shadow-sm pointer-events-none">
            <Play size={9} className="fill-current text-white" />
            <span>{isReel ? "Short / Reel" : "Video"}</span>
          </div>
        )}

        {/* Pexels Sound Toggle */}
        {isPexels && isHovered && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMuted(!isMuted);
            }}
            className="absolute bottom-2.5 right-2.5 p-1.5 rounded-full bg-black/70 hover:bg-black text-white/90 hover:text-white border border-white/20 transition-transform hover:scale-110"
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>
        )}
      </div>

      {/* 3. CARD BODY: Title, Stats, and Actions */}
      <div className="p-3.5 sm:p-4 flex flex-col flex-1 justify-between gap-3">
        {/* Title: 2 lines max, readable font weight */}
        <div>
          {post.matched_topic && (
            <div className="flex items-center gap-1.5 mb-1.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
              <span>{post.topic_emoji || "✨"}</span>
              <span className="truncate">{post.matched_topic}</span>
            </div>
          )}
          <h3
            onClick={() => onOpenDetails(post)}
            className="text-[14px] sm:text-[15px] font-bold text-neutral-900 dark:text-neutral-100 leading-snug line-clamp-2 cursor-pointer hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            {post.title || post.caption || "Trending post"}
          </h3>

          {/* Minimal Engagement Statistics */}
          <div className="flex items-center gap-2.5 mt-2 text-[11px] font-medium text-neutral-400 dark:text-neutral-500 flex-wrap">
            {views && (
              <span className="inline-flex items-center gap-1" title={`${views} views`}>
                <Eye size={12} className="text-neutral-400" />
                <span>{views}</span>
              </span>
            )}
            {saves && (
              <span className="inline-flex items-center gap-1 text-rose-500 font-semibold" title={`${saves} saves`}>
                <Bookmark size={12} className="fill-current" />
                <span>{saves}</span>
              </span>
            )}
            {likes && (
              <span className="inline-flex items-center gap-1" title={`${likes} likes`}>
                <Heart size={12} className="text-neutral-400" />
                <span>{likes}</span>
              </span>
            )}
            {reposts && (
              <span className="inline-flex items-center gap-1 text-emerald-500" title={`${reposts} reposts`}>
                <Repeat2 size={12} />
                <span>{reposts}</span>
              </span>
            )}
            {comments && (
              <span className="inline-flex items-center gap-1" title={`${comments} comments`}>
                <MessageSquare size={12} className="text-neutral-400" />
                <span>{comments}</span>
              </span>
            )}
            {searchVolume && !views && !saves && (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
                <Flame size={12} className="fill-current" />
                <span>{searchVolume}</span>
              </span>
            )}
          </div>
        </div>

        {/* 4. ACTIONS FOOTER: Prominent "Use Idea" & Quick Utilities */}
        <div className="pt-2.5 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between gap-2">
          {/* Prominent Use Idea Action */}
          <button
            type="button"
            onClick={() => onUseIdea(post)}
            className="flex-1 h-8 px-3 rounded-lg bg-neutral-950 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95"
          >
            <Zap size={13} className="text-amber-400 fill-current" />
            <span>Use Idea</span>
          </button>

          {/* Quick AI Remix Action */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemix(post);
            }}
            className="w-8 h-8 rounded-lg border border-black/[0.08] dark:border-white/[0.08] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 inline-flex items-center justify-center transition-colors"
            title="Remix with AI"
          >
            <Lightbulb size={14} />
          </button>

          {/* Quick Compose Action */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCompose(post);
            }}
            className="w-8 h-8 rounded-lg border border-black/[0.08] dark:border-white/[0.08] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 inline-flex items-center justify-center transition-colors"
            title="Open in Composer"
          >
            <Send size={13} />
          </button>

          {/* Share / Open External */}
          {post.source_url && (
            <button
              type="button"
              onClick={handleShare}
              className="w-8 h-8 rounded-lg border border-black/[0.08] dark:border-white/[0.08] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-900 dark:hover:text-white inline-flex items-center justify-center transition-colors"
              title={`Open on ${getHost(post.source_url)}`}
            >
              <ArrowUpRight size={14} />
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// -----------------------------------------------------------------------------
// REFINED TREND-DETAILS BOTTOM SHEET (Mobile-First Sheet / Desktop Modal)
// -----------------------------------------------------------------------------
function TrendDetailsBottomSheet({ isOpen, onClose, post, onRemix, onCompose, onSave, isSaved }) {
  if (!isOpen || !post) return null;

  const videoId = post.source_platform === "youtube" ? getYouTubeVideoId(post) : null;
  const mediaUrl = post.video_url || post.full_image_url || post.thumbnail_url;
  const platformMeta = getPlatformMeta(post.source_platform);
  const views = formatCompactNumber(post.metrics?.viewCount ?? post.metrics?.views);
  const likes = formatCompactNumber(post.metrics?.likeCount ?? post.metrics?.likes);
  const comments = formatCompactNumber(post.metrics?.commentCount ?? post.metrics?.comments ?? post.metrics?.replies);
  const saves = formatCompactNumber(post.metrics?.saveCount ?? post.metrics?.saves);
  const reposts = formatCompactNumber(post.metrics?.repostCount ?? post.metrics?.reposts);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        />

        {/* Bottom Sheet on Mobile / Modal on Desktop */}
        <motion.div
          initial={{ y: "100%", opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "100%", opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 280 }}
          className="relative w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[85vh] bg-white dark:bg-[#161B22] rounded-t-3xl sm:rounded-2xl border border-black/[0.08] dark:border-white/[0.08] shadow-2xl flex flex-col z-10 overflow-hidden text-neutral-900 dark:text-neutral-100"
        >
          {/* Mobile Drag Handle */}
          <div className="sm:hidden w-full pt-3 pb-1 flex justify-center cursor-grab">
            <div className="w-10 h-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
          </div>

          {/* Header */}
          <div className="px-5 py-3.5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center overflow-hidden">
                {platformMeta.iconSvg ? (
                  <img src={platformMeta.iconSvg} alt="" className="w-4 h-4 object-contain" />
                ) : (
                  <Flame size={13} className="text-amber-500" />
                )}
              </div>
              <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                {post.creator || platformMeta.name}
              </span>
              <span className="text-neutral-300 dark:text-neutral-600">•</span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                {formatTimeAgo(post.published_at || post.ingested_at)}
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {/* Player / Preview */}
            <div className="rounded-xl overflow-hidden bg-neutral-950 flex items-center justify-center relative min-h-[220px] max-h-[50vh]">
              {videoId ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
                  title={post.title || "YouTube Preview"}
                  className="w-full aspect-video border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : post.video_url ? (
                <video
                  src={post.video_url}
                  autoPlay
                  loop
                  controls
                  playsInline
                  className="w-full max-h-[50vh] object-contain"
                />
              ) : mediaUrl ? (
                <div className="relative w-full h-full flex items-center justify-center">
                  <img src={mediaUrl} alt="" className="w-full max-h-[50vh] object-contain" />
                  {post.source_platform === "pinterest" && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-600/90 text-white text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-lg">
                      <img src="/icons/pinterest-round-color-icon.svg" alt="" className="w-3.5 h-3.5 object-contain" />
                      <span>Pinterest Pin</span>
                    </div>
                  )}
                  {post.source_platform === "bluesky" && (
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-600/90 text-white text-xs font-bold tracking-wider backdrop-blur-md shadow-lg">
                      <img src="/icons/bluesky-circle-color-icon.svg" alt="" className="w-3.5 h-3.5 object-contain" />
                      <span>Bluesky Media</span>
                    </div>
                  )}
                </div>
              ) : post.source_platform === "bluesky" ? (
                <div className="p-8 text-left w-full bg-gradient-to-br from-slate-900 via-slate-950 to-sky-950 text-white rounded-xl">
                  <div className="flex items-center gap-2 mb-4">
                    <img src="/icons/bluesky-circle-color-icon.svg" alt="" className="w-6 h-6 object-contain" />
                    <div>
                      <h4 className="text-sm font-bold text-white">{post.creator}</h4>
                      <p className="text-xs text-sky-400 font-mono">Official Bluesky Post</p>
                    </div>
                  </div>
                  <p className="text-base text-slate-100 whitespace-pre-line leading-relaxed">
                    {post.caption || post.title}
                  </p>
                </div>
              ) : (
                <div className="p-8 text-center text-white">
                  <Flame size={40} className="mx-auto text-amber-500 mb-2" />
                  <h4 className="text-base font-bold">{post.title}</h4>
                </div>
              )}
            </div>

            {/* Title & Description */}
            <div>
              <h2 className="text-lg sm:text-xl font-bold leading-snug text-neutral-900 dark:text-neutral-100 mb-2">
                {post.title || post.caption}
              </h2>

              {/* Engagement Pills */}
              <div className="flex items-center gap-2.5 py-1 text-xs text-neutral-500 dark:text-neutral-400 font-medium flex-wrap">
                {views && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800">
                    <Eye size={13} />
                    <span>{views} views</span>
                  </span>
                )}
                {saves && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-500 font-semibold">
                    <Bookmark size={13} className="fill-current" />
                    <span>{saves} saves</span>
                  </span>
                )}
                {likes && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800">
                    <Heart size={13} />
                    <span>{likes} likes</span>
                  </span>
                )}
                {reposts && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-500 font-semibold">
                    <Repeat2 size={13} />
                    <span>{reposts} reposts</span>
                  </span>
                )}
                {comments && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800">
                    <MessageSquare size={13} />
                    <span>{comments} comments</span>
                  </span>
                )}
              </div>

              {post.caption && (
                <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed mt-3 whitespace-pre-wrap">
                  {post.caption}
                </p>
              )}

              {/* Keywords */}
              {post.related_queries?.length > 0 && (
                <div className="mt-4">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 block mb-2">
                    Rising Keywords
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {post.related_queries.map((q, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-xs font-medium"
                      >
                        #{q}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Action Bar */}
          <div className="p-4 border-t border-black/[0.06] dark:border-white/[0.08] bg-neutral-50/70 dark:bg-neutral-900/40 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => {
                onClose();
                onRemix(post);
              }}
              className="flex-1 h-10 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 font-semibold text-xs inline-flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <Zap size={14} className="text-amber-400 fill-current" />
              <span>Remix Idea with AI (Hooks & Script)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onCompose(post);
              }}
              className="h-10 px-4 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-900 dark:text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-all"
            >
              <Send size={13} />
              <span>Use in Post Composer</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSave(post)}
                className={`h-10 px-3 rounded-xl border transition-colors inline-flex items-center justify-center gap-1.5 text-xs font-medium ${isSaved
                  ? "bg-amber-500 text-white border-amber-600"
                  : "border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
                  }`}
                title="Save idea"
              >
                {isSaved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                <span>{isSaved ? "Saved" : "Save"}</span>
              </button>

              {post.source_url && (
                <a
                  href={post.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="h-10 px-3 rounded-xl border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 inline-flex items-center justify-center gap-1 text-xs font-medium"
                >
                  <span>Source</span>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// -----------------------------------------------------------------------------
// AI CREATIVE REMIX STUDIO DRAWER
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
          transition={{ type: "spring", damping: 26, stiffness: 240 }}
          className="relative w-full max-w-xl h-full bg-white dark:bg-[#161B22] border-l border-black/[0.08] dark:border-white/[0.08] shadow-2xl flex flex-col z-10 text-neutral-900 dark:text-neutral-100"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 flex items-center justify-center">
                <Zap size={16} className="text-amber-400 fill-current" />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 leading-tight">
                  AI Trend Remix Studio
                </h2>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 font-medium">
                  Hooks, reel scripts, carousel blueprints & captions
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <X size={18} />
            </button>
          </div>

          {/* Context Snippet */}
          <div className="px-4 py-3 bg-neutral-50 dark:bg-white/[0.02] border-b border-black/[0.06] dark:border-white/[0.08] flex items-center gap-3">
            {trendPost.thumbnail_url && (
              <img
                src={trendPost.thumbnail_url}
                alt=""
                className="w-12 h-10 object-cover rounded-lg border border-black/[0.08] dark:border-white/[0.08] flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                Source: {trendPost.source_platform}
              </span>
              <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                {trendPost.title || trendPost.caption}
              </h4>
            </div>
            <button
              onClick={() => fetchRemix(trendPost)}
              disabled={loading}
              className="h-7 px-2 rounded-lg border border-black/[0.08] dark:border-white/[0.08] bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-[11px] font-semibold inline-flex items-center gap-1 hover:bg-neutral-50"
            >
              <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
              <span>Regenerate</span>
            </button>
          </div>

          {/* Tabs */}
          <div className="px-4 pt-2.5 border-b border-black/[0.06] dark:border-white/[0.08] flex gap-2 overflow-x-auto no-scrollbar">
            {[
              { id: "hooks", label: "Hooks (3)", icon: Lightbulb },
              { id: "script", label: "Reel Script", icon: Video },
              { id: "thread", label: "Thread", icon: ListOrdered },
              { id: "carousel", label: "Carousel", icon: Layers },
              { id: "caption", label: "Caption", icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`pb-2.5 px-2.5 text-xs font-semibold border-b-2 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${active
                    ? "border-neutral-900 dark:border-white text-neutral-900 dark:text-white"
                    : "border-transparent text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300"
                    }`}
                >
                  <Icon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar">
            {loading ? (
              <div className="h-64 flex flex-col items-center justify-center gap-2.5 text-center">
                <RefreshCw size={24} className="animate-spin text-neutral-900 dark:text-white" />
                <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                  Synthesizing viral remix angles...
                </h4>
                <p className="text-xs text-neutral-400 max-w-xs">
                  Extracting hooks, scripts, and pacing models.
                </p>
              </div>
            ) : !remixData ? (
              <div className="text-center py-16 text-neutral-400 text-xs">
                No remix data. Click Regenerate.
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* 1. VIRAL HOOKS */}
                {activeTab === "hooks" && (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-500 font-medium">
                      Proven scroll-stopping hooks based on this trend:
                    </p>
                    {remixData.viral_hooks?.map((hookItem, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 bg-neutral-50 dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] rounded-xl"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">
                            {hookItem.style}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => copyToClipboard(hookItem.hook, `hook_${idx}`)}
                              className="p-1 rounded-md text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                              title="Copy hook"
                            >
                              {copiedKey === `hook_${idx}` ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                            <button
                              onClick={() =>
                                onSendToComposer({
                                  caption: `${hookItem.hook}\n\n${trendPost.caption || ""}\n\nSource: ${trendPost.source_url}`,
                                  mediaUrl: getBestMediaUrl(trendPost),
                                })
                              }
                              className="px-2 py-0.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-[11px] font-semibold inline-flex items-center gap-1 shadow-sm"
                            >
                              <Send size={10} />
                              <span>Use</span>
                            </button>
                          </div>
                        </div>
                        <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 leading-relaxed">
                          "{hookItem.hook}"
                        </p>
                      </div>
                    ))}
                  </div>
                )}

                {/* 2. REEL / SHORT SCRIPT */}
                {activeTab === "script" && remixData.reel_script && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-black/[0.06] dark:border-white/[0.08] pb-2">
                      <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                        {remixData.reel_script.title}
                      </h3>
                      <span className="text-xs text-neutral-500 font-semibold">
                        ⏱️ {remixData.reel_script.estimated_duration}
                      </span>
                    </div>

                    <div className="p-3 bg-neutral-50 dark:bg-white/[0.03] rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block mb-1">
                        Visual Hook (0–3s)
                      </span>
                      <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        {remixData.reel_script.hook}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                        Key Points
                      </span>
                      <ul className="space-y-1.5">
                        {remixData.reel_script.body_points?.map((pt, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-neutral-700 dark:text-neutral-300 bg-neutral-50 dark:bg-white/[0.02] p-2.5 rounded-lg border border-black/[0.04] dark:border-white/[0.06] flex items-start gap-2"
                          >
                            <span className="font-bold text-neutral-900 dark:text-neutral-100">{idx + 1}.</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-3 bg-neutral-50 dark:bg-white/[0.03] rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 block mb-1">
                        Call to Action
                      </span>
                      <p className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        {remixData.reel_script.call_to_action}
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        onSendToComposer({
                          caption: `🎬 REEL SCRIPT: ${remixData.reel_script.title}\n\n[HOOK]: ${remixData.reel_script.hook}\n\n[BODY POINTS]:\n${remixData.reel_script.body_points?.join("\n")}\n\n[CTA]: ${remixData.reel_script.call_to_action}`,
                          mediaUrl: getBestMediaUrl(trendPost),
                        })
                      }
                      className="w-full h-9 rounded-xl bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Send size={12} />
                      <span>Use Script in Post Composer</span>
                    </button>
                  </div>
                )}

                {/* 3. THREAD BREAKDOWN */}
                {activeTab === "thread" && remixData.thread_angle && (
                  <div className="space-y-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Opening Post
                      </span>
                      <p className="text-xs font-medium text-neutral-900 dark:text-neutral-100 mt-1 p-3 bg-neutral-50 dark:bg-white/[0.03] rounded-xl border border-black/[0.06] dark:border-white/[0.08]">
                        {remixData.thread_angle.opening_post}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Insights
                      </span>
                      <div className="space-y-1.5 mt-1">
                        {remixData.thread_angle.key_insights?.map((insight, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 bg-neutral-50 dark:bg-white/[0.02] rounded-lg border border-black/[0.04] dark:border-white/[0.06] text-xs text-neutral-700 dark:text-neutral-300"
                          >
                            <span className="font-bold text-neutral-900 dark:text-neutral-100 mr-1.5">#{idx + 1}</span>
                            {insight}
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        onSendToComposer({
                          caption: `${remixData.thread_angle.opening_post}\n\n${remixData.thread_angle.key_insights?.map((i, idx) => `${idx + 1}/ ${i}`).join("\n\n")}\n\n${remixData.thread_angle.closing_post}`,
                          mediaUrl: getBestMediaUrl(trendPost),
                        })
                      }
                      className="w-full h-9 rounded-xl bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Send size={12} />
                      <span>Use Thread in Post Composer</span>
                    </button>
                  </div>
                )}

                {/* 4. CAROUSEL CONCEPT */}
                {activeTab === "carousel" && remixData.carousel_concept && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                        {remixData.carousel_concept.topic}
                      </h4>
                      <span className="text-[10px] font-semibold text-neutral-500">
                        5 Slides
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {remixData.carousel_concept.slides?.map((slide) => (
                        <div
                          key={slide.slide}
                          className="p-2.5 bg-neutral-50 dark:bg-white/[0.02] rounded-lg border border-black/[0.04] dark:border-white/[0.06] flex items-start gap-2"
                        >
                          <span className="w-5 h-5 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {slide.slide}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 block">
                              {slide.heading}
                            </span>
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">{slide.text}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      onClick={() =>
                        onSendToComposer({
                          caption: `📊 CAROUSEL: ${remixData.carousel_concept.topic}\n\n${remixData.carousel_concept.slides?.map((s) => `[Slide ${s.slide}: ${s.heading}]\n${s.text}`).join("\n\n")}`,
                          mediaUrl: getBestMediaUrl(trendPost),
                        })
                      }
                      className="w-full h-9 rounded-xl bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Send size={12} />
                      <span>Use Carousel in Composer</span>
                    </button>
                  </div>
                )}

                {/* 5. READY CAPTION */}
                {activeTab === "caption" && remixData.ready_to_post_caption && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Formatted Caption
                      </span>
                      <button
                        onClick={() => copyToClipboard(remixData.ready_to_post_caption, "full_caption")}
                        className="text-xs text-neutral-600 dark:text-neutral-300 font-semibold inline-flex items-center gap-1"
                      >
                        {copiedKey === "full_caption" ? <Check size={13} /> : <Copy size={13} />}
                        <span>Copy</span>
                      </button>
                    </div>

                    <div className="p-3.5 bg-neutral-50 dark:bg-white/[0.03] rounded-xl border border-black/[0.06] dark:border-white/[0.08] text-xs text-neutral-800 dark:text-neutral-200 whitespace-pre-wrap leading-relaxed font-medium">
                      {remixData.ready_to_post_caption}
                    </div>

                    <button
                      onClick={() =>
                        onSendToComposer({
                          caption: remixData.ready_to_post_caption,
                          mediaUrl: getBestMediaUrl(trendPost),
                        })
                      }
                      className="w-full h-9 rounded-xl bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 text-xs font-semibold inline-flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Send size={12} />
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
          transition={{ type: "spring", damping: 26, stiffness: 240 }}
          className="relative w-full max-w-md h-full bg-white dark:bg-[#161B22] border-l border-black/[0.08] dark:border-white/[0.08] shadow-2xl flex flex-col z-10 text-neutral-900 dark:text-neutral-100"
        >
          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-black/[0.06] dark:border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookmarkCheck size={18} className="text-amber-500" />
              <div>
                <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Inspiration Board
                </h2>
                <p className="text-[11px] text-neutral-500">
                  {savedPosts.length} saved trend spark{savedPosts.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {savedPosts.length > 0 && (
                <button
                  onClick={onClearAll}
                  className="text-xs text-red-500 hover:text-red-600 font-semibold px-2 py-1"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
            {savedPosts.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-neutral-400">
                <Bookmark size={32} className="mb-2 opacity-30" />
                <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">
                  Your board is empty
                </p>
                <p className="text-xs text-neutral-400 mt-1 max-w-xs">
                  Click the bookmark icon on any trend card to save it for your next posting run.
                </p>
              </div>
            ) : (
              savedPosts.map((post) => (
                <div
                  key={post.id}
                  className="p-3 bg-neutral-50 dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.08] rounded-xl flex items-start gap-3"
                >
                  {post.thumbnail_url && (
                    <img
                      src={post.thumbnail_url}
                      alt=""
                      className="w-14 h-14 object-cover rounded-lg flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block">
                      {post.source_platform}
                    </span>
                    <h4 className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-1 mt-0.5">
                      {post.title || post.caption}
                    </h4>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => {
                          onClose();
                          onRemix(post);
                        }}
                        className="px-2 py-0.5 rounded-md bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 text-[11px] font-semibold inline-flex items-center gap-1 shadow-sm"
                      >
                        <Zap size={10} className="text-amber-400 fill-current" />
                        <span>Remix</span>
                      </button>
                      <button
                        onClick={() => {
                          onClose();
                          onCompose(post);
                        }}
                        className="px-2 py-0.5 rounded-md border border-black/[0.08] dark:border-white/[0.08] text-neutral-700 dark:text-neutral-300 text-[11px] font-semibold inline-flex items-center gap-1"
                      >
                        <Send size={10} />
                        <span>Compose</span>
                      </button>
                      <button
                        onClick={() => onRemove(post.id)}
                        className="text-[11px] text-neutral-400 hover:text-red-500 ml-auto font-medium"
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
// LOADING SKELETON (Clean Shimmer Cards)
// -----------------------------------------------------------------------------
function TrendFeedSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl bg-white dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.08] p-3.5 space-y-3 animate-pulse"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div className="w-24 h-3 bg-neutral-200 dark:bg-neutral-800 rounded" />
          </div>
          <div className={`w-full ${i % 2 === 0 ? "h-64 sm:h-72" : "h-52 sm:h-60"} bg-neutral-200 dark:bg-neutral-800 rounded-xl`} />
          <div className="w-5/6 h-4 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="w-1/2 h-3 bg-neutral-200 dark:bg-neutral-800 rounded" />
          <div className="flex justify-between items-center pt-2">
            <div className="w-24 h-8 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />
            <div className="w-16 h-8 bg-neutral-200 dark:bg-neutral-800 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// MAIN REDESIGNED TREND FEED COMPONENT
// -----------------------------------------------------------------------------
export default function TrendFeedPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Feed State
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState("");

  // Filters State
  const [selectedFormat, setSelectedFormat] = useState("all");
  const [selectedNiche, setSelectedNiche] = useState("all");
  const [selectedRegion, setSelectedRegion] = useState("US");
  const [regionOpen, setRegionOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Hot Topics Radar Ticker
  const [hotTopics, setHotTopics] = useState([]);

  const userKey = user?.userId || user?.email || "anon";
  const seenStorageKey = `qp_trend_seen_${userKey}`;
  const profileStorageKey = `qp_trend_profile_${userKey}`;
  const savedIdeasStorageKey = `qp_trend_saved_ideas_${userKey}`;
  const onboardingStorageKey = `qp_trend_onboarded_${userKey}`;

  // Creator Personalization & Interest Onboarding
  const [profile, setProfile] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(profileStorageKey) || "null");
      if (saved && (saved.interests || saved.work || saved.goal || saved.selectedTopicIds)) {
        return saved;
      }
    } catch {}
    return emptyProfile;
  });
  const [draftProfile, setDraftProfile] = useState(() => profile);
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [selectedTopicIds, setSelectedTopicIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(profileStorageKey) || "null");
      if (saved && Array.isArray(saved.selectedTopicIds) && saved.selectedTopicIds.length > 0) {
        return saved.selectedTopicIds;
      }
    } catch {}
    return ["ai_chatgpt", "creator_economy", "marketing_growth"];
  });
  const [selectedTopicFilter, setSelectedTopicFilter] = useState(null);
  const [feedMode, setFeedMode] = useState("personalized");
  const [modalCategory, setModalCategory] = useState("All");
  const [modalSearch, setModalSearch] = useState("");
  const [showAdvancedProfile, setShowAdvancedProfile] = useState(false);

  // Saved Inspiration Board
  const [savedIdeas, setSavedIdeas] = useState([]);
  const [showSavedDrawer, setShowSavedDrawer] = useState(false);

  // AI Remix Studio Drawer
  const [remixPost, setRemixPost] = useState(null);
  const [showRemixDrawer, setShowRemixDrawer] = useState(false);

  // Details Bottom Sheet
  const [detailsPost, setDetailsPost] = useState(null);

  // Post Composer Modal
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerInitialData, setComposerInitialData] = useState({
    caption: "",
    mediaUrls: [],
    hashtags: [],
  });

  const sentinelRef = useRef(null);
  const loadingRef = useRef(false);
  const exhaustedRef = useRef(false);
  const pageRef = useRef(1);
  const cursorRef = useRef(null);
  const seenRef = useRef(new Set());

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load localStorage state & First-time visit onboarding
  useEffect(() => {
    try {
      seenRef.current = new Set(JSON.parse(localStorage.getItem(seenStorageKey) || "[]"));
    } catch {
      seenRef.current = new Set();
    }

    try {
      const saved = JSON.parse(localStorage.getItem(profileStorageKey) || "null");
      if (saved) {
        if (saved.interests || saved.work || saved.goal) {
          setProfile(saved);
          setDraftProfile(saved);
        }
        if (Array.isArray(saved.selectedTopicIds) && saved.selectedTopicIds.length > 0) {
          setSelectedTopicIds(saved.selectedTopicIds);
        }
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

    // First time visitor check: trigger the attractive interest selection popup
    try {
      const hasOnboarded = localStorage.getItem(onboardingStorageKey);
      if (!hasOnboarded) {
        const timer = setTimeout(() => {
          setShowInterestModal(true);
        }, 450);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }, [seenStorageKey, profileStorageKey, savedIdeasStorageKey, onboardingStorageKey]);

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
    async ({
      reset = false,
      overrideProfile = null,
      overrideTopic = undefined,
      overrideMode = null,
    } = {}) => {
      if (loadingRef.current || (!reset && exhaustedRef.current)) return;
      if (reset) exhaustedRef.current = false;
      loadingRef.current = true;
      setLoading(true);
      setError("");

      const targetPage = reset ? 1 : pageRef.current;
      const targetCursor = reset ? null : cursorRef.current;

      const activeProfile = overrideProfile || profile;
      const activeTopic = overrideTopic !== undefined ? overrideTopic : selectedTopicFilter;
      const activeMode = overrideMode || feedMode;

      try {
        const topicIds = activeProfile.selectedTopicIds || selectedTopicIds || [];
        const isPersonalized =
          activeMode === "personalized" && (topicIds.length > 0 || activeProfile.interests);

        const interestQuery = [activeProfile.work, activeProfile.interests, activeProfile.goal]
          .filter(Boolean)
          .join(",");

        const params = {
          limit: PAGE_SIZE,
          page: targetPage,
          cursor: targetCursor || undefined,
          type: selectedFormat,
          category: selectedNiche,
          region: selectedRegion,
          search: debouncedSearch || undefined,
          seen: Array.from(seenRef.current).join(",") || undefined,
        };

        if (isPersonalized && !debouncedSearch) {
          if (activeTopic) {
            params.topic = activeTopic;
          } else if (topicIds.length > 0) {
            params.topics = topicIds.join(",");
          }
          if (interestQuery) {
            params.interests = interestQuery;
          }
        }

        const { data } = await apiClient.get("/api/trends/feed", { params });

        const nextItems = data.items || [];
        rememberSeen(nextItems);

        setItems((current) => {
          if (reset) return nextItems;
          const existingIds = new Set(current.map((item) => item.id));
          const filtered = nextItems.filter((item) => !existingIds.has(item.id));
          return [...current, ...filtered];
        });

        cursorRef.current = data.nextCursor || null;
        pageRef.current = targetPage + 1;
        setInitialLoaded(true);
      } catch (err) {
        setError(err.response?.data?.error || err.message || "Failed to load trend sparks.");
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [
      selectedFormat,
      selectedNiche,
      selectedRegion,
      debouncedSearch,
      profile,
      selectedTopicIds,
      selectedTopicFilter,
      feedMode,
      rememberSeen,
    ]
  );

  // Trigger reload on filter changes
  useEffect(() => {
    pageRef.current = 1;
    cursorRef.current = null;
    loadPage({ reset: true });
  }, [
    selectedFormat,
    selectedNiche,
    selectedRegion,
    debouncedSearch,
    selectedTopicFilter,
    feedMode,
    loadPage,
  ]);

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
      { rootMargin: "1000px 0px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadPage]);

  // Bookmark / Save
  const toggleSaveIdea = (post) => {
    const exists = savedIdeas.some((item) => item.id === post.id);
    let updated;
    if (exists) {
      updated = savedIdeas.filter((item) => item.id !== post.id);
      toast("Removed from Inspiration Board", { icon: "🗑️" });
    } else {
      updated = [post, ...savedIdeas];
      toast.success("Saved to Inspiration Board!");
    }
    setSavedIdeas(updated);
    localStorage.setItem(savedIdeasStorageKey, JSON.stringify(updated));
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
      const initialText = `${post.title || post.caption || "Trending insight"}\n\nVia ${post.source_platform?.toUpperCase() || "TREND"} (${post.source_url || ""})`;
      const media = getBestMediaUrl(post);
      setComposerInitialData({
        caption: initialText,
        mediaUrls: media ? [media] : [],
        hashtags: (post.niche_tags || []).filter((t) => t && !t.includes(" ")),
      });
    }
    setComposerOpen(true);
  };

  const handleUseIdea = (post) => {
    // Immediately open Composer with this trend's media and caption!
    handleOpenComposer(post);
  };

  // Filtered Topics for Interest Onboarding Modal
  const filteredTopics = useMemo(() => {
    return TREND_INTEREST_TOPICS.filter((topic) => {
      const matchesCategory =
        modalCategory === "All" || topic.category === modalCategory;
      const q = modalSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        topic.label.toLowerCase().includes(q) ||
        topic.keywords.toLowerCase().includes(q) ||
        topic.category.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [modalCategory, modalSearch]);

  const toggleTopic = (topicId) => {
    setSelectedTopicIds((prev) =>
      prev.includes(topicId)
        ? prev.filter((id) => id !== topicId)
        : [...prev, topicId]
    );
  };

  const selectAllTopics = () => {
    setSelectedTopicIds(TREND_INTEREST_TOPICS.map((t) => t.id));
  };

  const clearAllTopics = () => {
    setSelectedTopicIds([]);
  };

  const handleSaveInterests = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const selectedTopics = TREND_INTEREST_TOPICS.filter((t) =>
      selectedTopicIds.includes(t.id)
    );
    const topicKeywords = selectedTopics.map((t) => t.keywords).join(", ");
    const customInterests = draftProfile.interests?.trim() || "";
    const combinedInterests = [topicKeywords, customInterests].filter(Boolean).join(", ");

    const nextProfile = {
      work: draftProfile.work?.trim() || "",
      interests: combinedInterests,
      goal: draftProfile.goal?.trim() || "",
      selectedTopicIds,
    };

    setProfile(nextProfile);
    setDraftProfile(nextProfile);
    setSelectedTopicFilter(null);
    setFeedMode("personalized");
    try {
      localStorage.setItem(profileStorageKey, JSON.stringify(nextProfile));
      localStorage.setItem(onboardingStorageKey, "true");
    } catch {
      // ignore
    }
    setShowInterestModal(false);
    toast.success(
      selectedTopicIds.length > 0
        ? `Feed personalized with ${selectedTopicIds.length} topic${selectedTopicIds.length === 1 ? "" : "s"}!`
        : "Feed preferences updated!"
    );
    pageRef.current = 1;
    cursorRef.current = null;
    loadPage({
      reset: true,
      overrideProfile: nextProfile,
      overrideTopic: null,
      overrideMode: "personalized",
    });
  };

  const handleSkipInterests = () => {
    try {
      localStorage.setItem(onboardingStorageKey, "true");
    } catch {
      // ignore
    }
    setShowInterestModal(false);
  };

  const [headerPortalEl, setHeaderPortalEl] = useState(() =>
    typeof document !== "undefined" ? document.getElementById("header-left-portal") : null
  );

  useEffect(() => {
    if (!headerPortalEl) {
      const el = document.getElementById("header-left-portal");
      if (el) setHeaderPortalEl(el);
    }
  }, [headerPortalEl]);

  const headerContent = (
    <div className="flex items-center justify-between w-full gap-2 sm:gap-3">
      <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 whitespace-nowrap leading-none">
        Explore Trends
      </h1>

      {/* Header Right Actions: Search + Tools */}
      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 justify-end max-w-xl">
        {/* Integrated Search Bar */}
        <div className="relative w-36 sm:w-52 md:w-64">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search topics, creators, hooks..."
            className="w-full h-8 sm:h-9 pl-8 pr-7 rounded-xl bg-white dark:bg-[#161B22] border border-black/[0.08] dark:border-white/[0.08] text-xs font-normal text-neutral-900 dark:text-white placeholder:text-neutral-400 shadow-sm outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-0.5"
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Minimal Region Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setRegionOpen(!regionOpen)}
            className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-white dark:bg-[#161B22] border border-black/[0.08] dark:border-white/[0.08] text-xs font-medium text-neutral-700 dark:text-neutral-300 shadow-sm inline-flex items-center gap-1 sm:gap-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <span>{REGION_OPTIONS.find((r) => r.code === selectedRegion)?.flag || "🌐"}</span>
            <span className="hidden md:inline text-xs">
              {REGION_OPTIONS.find((r) => r.code === selectedRegion)?.label || "Region"}
            </span>
            <ChevronDown
              size={12}
              className={`text-neutral-400 transition-transform ${regionOpen ? "rotate-180" : ""}`}
            />
          </button>

          <AnimatePresence>
            {regionOpen && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setRegionOpen(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 4, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-[#161B22] border border-black/[0.08] dark:border-white/[0.08] rounded-xl shadow-xl overflow-hidden z-40 py-1"
                >
                  {REGION_OPTIONS.map((r) => (
                    <button
                      key={r.code}
                      type="button"
                      onClick={() => {
                        setSelectedRegion(r.code);
                        setRegionOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs font-medium flex items-center gap-2 transition-colors ${selectedRegion === r.code
                          ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-white font-bold"
                          : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                        }`}
                    >
                      <span>{r.flag}</span>
                      <span>{r.label}</span>
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        {/* Saved Inspiration Board Pill */}
        <button
          type="button"
          onClick={() => setShowSavedDrawer(true)}
          className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-white dark:bg-[#161B22] border border-black/[0.08] dark:border-white/[0.08] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 shadow-sm inline-flex items-center gap-1 sm:gap-1.5 transition-colors whitespace-nowrap"
        >
          <BookmarkCheck size={13} className="text-amber-500" />
          <span className="hidden sm:inline">Saved</span>
          {savedIdeas.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-[10px] font-bold">
              {savedIdeas.length}
            </span>
          )}
        </button>

        {/* Personalize Interests Button */}
        <button
          type="button"
          onClick={() => setShowInterestModal(true)}
          className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-white dark:bg-[#161B22] border border-black/[0.08] dark:border-white/[0.08] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 shadow-sm inline-flex items-center gap-1 sm:gap-1.5 transition-colors whitespace-nowrap"
          title="Personalize interest topics"
        >
          <SlidersHorizontal size={12} />
          <span className="hidden sm:inline">Tune</span>
          {selectedTopicIds.length > 0 && (
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
          )}
        </button>

        {/* Refresh Action */}
        <button
          type="button"
          onClick={() => {
            pageRef.current = 1;
            cursorRef.current = null;
            loadPage({ reset: true });
          }}
          disabled={loading}
          className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 text-xs font-medium shadow-sm inline-flex items-center gap-1 sm:gap-1.5 transition-all disabled:opacity-50 whitespace-nowrap"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-[var(--canvas,#f5f1ec)] dark:bg-[#0B0F17] text-neutral-900 dark:text-neutral-100 transition-colors"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 7rem)",
      }}
    >
      {/* Portals the Explore Trends header row directly into the top Header bar's empty space */}
      {headerPortalEl && createPortal(headerContent, headerPortalEl)}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4">
        {/* Fallback inline header if portal target not mounted */}
        {!headerPortalEl && (
          <header className="mb-4 space-y-3">
            {headerContent}
          </header>
        )}

        {/* 2. MINIMAL HORIZONTAL FILTERS & CATEGORIES */}
        <div className="space-y-2.5">
          {/* My Curated Topics (Personalized Onboarding Interests Bar) */}
          {selectedTopicIds.length > 0 && (
            <div className="p-2.5 sm:p-3 rounded-2xl bg-white/90 dark:bg-[#161B22]/90 border border-black/[0.06] dark:border-white/[0.08] shadow-xs space-y-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[11px] tracking-wide uppercase">
                    <Sparkles size={11} className="fill-current text-amber-500" />
                    <span>My Curated Topics ({selectedTopicIds.length})</span>
                  </span>
                  <span className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate hidden sm:inline">
                    {feedMode === "personalized"
                      ? selectedTopicFilter
                        ? `Filtered specifically to ${TREND_INTEREST_TOPICS.find((t) => t.id === selectedTopicFilter)?.label || selectedTopicFilter}`
                        : "Feed strictly tailored to your selected onboarding topics"
                      : "Viewing global trending"}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Toggle Personalized vs Global */}
                  <button
                    type="button"
                    onClick={() => {
                      const nextMode = feedMode === "personalized" ? "global" : "personalized";
                      setFeedMode(nextMode);
                      setSelectedTopicFilter(null);
                      pageRef.current = 1;
                      cursorRef.current = null;
                      loadPage({ reset: true, overrideMode: nextMode, overrideTopic: null });
                    }}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all inline-flex items-center gap-1 border ${
                      feedMode === "personalized"
                        ? "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400"
                        : "bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                    }`}
                    title="Toggle between your personalized interests and global trending"
                  >
                    <Globe size={11} />
                    <span>{feedMode === "personalized" ? "Personalized Active" : "Global"}</span>
                  </button>

                  {/* Edit Topics Button */}
                  <button
                    type="button"
                    onClick={() => setShowInterestModal(true)}
                    className="px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors inline-flex items-center gap-1"
                  >
                    <SlidersHorizontal size={11} />
                    <span>Customize</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Topic Pills */}
              {feedMode === "personalized" && (
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                  {/* All Topics Combined */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTopicFilter(null);
                      pageRef.current = 1;
                      cursorRef.current = null;
                      loadPage({ reset: true, overrideTopic: null });
                    }}
                    className={`h-7 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-all inline-flex items-center gap-1.5 ${
                      selectedTopicFilter === null
                        ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-xs"
                        : "bg-black/[0.04] dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                    }`}
                  >
                    <Sparkles size={11} className={selectedTopicFilter === null ? "text-amber-400 fill-amber-400" : "text-neutral-400"} />
                    <span>All My Topics Combined</span>
                  </button>

                  {/* Individual Selected Topics */}
                  {selectedTopicIds.map((topicId) => {
                    const topicDef = TREND_INTEREST_TOPICS.find((t) => t.id === topicId);
                    if (!topicDef) return null;
                    const isSelected = selectedTopicFilter === topicId;
                    return (
                      <button
                        key={topicId}
                        type="button"
                        onClick={() => {
                          const nextTopic = isSelected ? null : topicId;
                          setSelectedTopicFilter(nextTopic);
                          pageRef.current = 1;
                          cursorRef.current = null;
                          loadPage({ reset: true, overrideTopic: nextTopic });
                        }}
                        className={`h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-all inline-flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-sky-600 text-white font-bold shadow-xs"
                            : "bg-black/[0.04] dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                        }`}
                      >
                        <span>{topicDef.emoji}</span>
                        <span>{topicDef.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Platform / Format Pills (Smooth Horizontal Bar) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {FORMAT_TABS.map((tab) => {
              const active = selectedFormat === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedFormat(tab.id)}
                  className={`h-8 px-3.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all inline-flex items-center gap-1.5 ${active
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 font-bold shadow-sm"
                    : "bg-white/80 dark:bg-[#161B22]/80 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white border border-black/[0.06] dark:border-white/[0.08]"
                    }`}
                >
                  {tab.iconSvg ? (
                    <img src={tab.iconSvg} alt="" className="w-3.5 h-3.5 object-contain" />
                  ) : Icon ? (
                    <Icon size={13} />
                  ) : null}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Niche Categories Pill Row */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {NICHE_PILLS.map((niche) => {
              const active = selectedNiche === niche.id;
              return (
                <button
                  key={niche.id}
                  onClick={() => setSelectedNiche(niche.id)}
                  className={`h-7 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-all ${active
                    ? "bg-neutral-800 text-white dark:bg-neutral-200 dark:text-neutral-900 font-semibold shadow-xs"
                    : "bg-white/60 dark:bg-[#161B22]/60 text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 border border-black/[0.04] dark:border-white/[0.06]"
                    }`}
                >
                  {niche.label}
                </button>
              );
            })}
          </div>

          {/* Hot Topics Radar Ticker */}
          {hotTopics.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-neutral-500 overflow-hidden pt-1">
              <span className="font-semibold text-neutral-700 dark:text-neutral-300 text-[11px] uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
                <Flame size={12} className="text-amber-500 fill-current" />
                <span>Trending:</span>
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 py-0.5">
                {hotTopics.map((topic, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSearchQuery(topic.query)}
                    className={`px-2 py-0.5 rounded-md text-[11px] whitespace-nowrap transition-colors ${searchQuery === topic.query
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-semibold"
                      : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white bg-black/[0.03] dark:bg-white/[0.05]"
                      }`}
                  >
                    #{topic.query}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search Active Status Banner */}
          {debouncedSearch && (
            <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-white/90 dark:bg-[#161B22]/90 border border-black/[0.06] dark:border-white/[0.08] shadow-xs">
              <div className="flex items-center gap-2 text-xs min-w-0">
                <Search size={13} className="text-sky-500 flex-shrink-0" />
                <span className="text-neutral-500 dark:text-neutral-400 whitespace-nowrap">Results for</span>
                <span className="font-bold text-neutral-900 dark:text-white truncate">"{debouncedSearch}"</span>
                {items.length > 0 && (
                  <span className="text-[11px] font-semibold text-neutral-400 whitespace-nowrap">
                    ({items.length} relevant {selectedFormat !== "all" ? selectedFormat : ""} trends)
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white px-2 py-0.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex-shrink-0"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* 3. TREND FEED CONTENT */}
        {error ? (
          <div className="p-8 text-center bg-white dark:bg-[#161B22] rounded-2xl border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 font-semibold shadow-sm max-w-md mx-auto my-10">
            <p className="text-sm">{error}</p>
            <button
              onClick={() => loadPage({ reset: true })}
              className="mt-3 px-4 py-2 rounded-xl bg-neutral-900 text-white text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        ) : !initialLoaded && loading ? (
          <TrendFeedSkeleton />
        ) : items.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-[#161B22] rounded-2xl border border-black/[0.06] dark:border-white/[0.08] shadow-sm max-w-md mx-auto my-12">
            <Flame size={36} className="mx-auto text-amber-500 mb-2.5 opacity-80" />
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              No trends found
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 mb-5 leading-relaxed font-normal">
              Try switching format tabs, selecting another region, or clearing your search term.
            </p>
            <button
              onClick={() => {
                setSelectedFormat("all");
                setSelectedNiche("all");
                setSearchQuery("");
              }}
              className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 text-xs font-semibold shadow-sm"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          /* Mobile Single-Column Editorial Feed / Desktop Multi-Column Grid */
          <Masonry
            breakpointCols={MASONRY_BREAKPOINTS}
            className="flex w-auto -ml-4 sm:-ml-5"
            columnClassName="pl-4 sm:pl-5 bg-clip-padding"
          >
            {items.map((post) => (
              <TrendCard
                key={post.id}
                post={post}
                onUseIdea={handleUseIdea}
                onRemix={handleOpenRemix}
                onCompose={handleOpenComposer}
                onSave={toggleSaveIdea}
                isSaved={savedIdeas.some((item) => item.id === post.id)}
                onOpenDetails={(p) => setDetailsPost(p)}
              />
            ))}
          </Masonry>
        )}

        {/* 4. INFINITE SCROLL SENTINEL */}
        <div ref={sentinelRef} className="h-16 flex items-center justify-center my-6">
          {loading && initialLoaded && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.08] shadow-sm text-xs font-semibold text-neutral-700 dark:text-neutral-300">
              <RefreshCw size={13} className="animate-spin text-neutral-900 dark:text-white" />
              <span>Loading more trends...</span>
            </div>
          )}
        </div>
      </div>

      {/* 5. REFINED TREND DETAILS BOTTOM SHEET */}
      <TrendDetailsBottomSheet
        isOpen={Boolean(detailsPost)}
        onClose={() => setDetailsPost(null)}
        post={detailsPost}
        onRemix={handleOpenRemix}
        onCompose={handleOpenComposer}
        onSave={toggleSaveIdea}
        isSaved={detailsPost ? savedIdeas.some((item) => item.id === detailsPost.id) : false}
      />

      {/* 6. AI CREATIVE REMIX STUDIO DRAWER */}
      <TrendRemixDrawer
        isOpen={showRemixDrawer}
        onClose={() => setShowRemixDrawer(false)}
        trendPost={remixPost}
        onSendToComposer={(payload) => {
          setShowRemixDrawer(false);
          handleOpenComposer(payload);
        }}
      />

      {/* 7. SAVED IDEAS BOARD DRAWER */}
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

      {/* 8. POST COMPOSER MODAL */}
      <ComposerModal
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        initialCaption={composerInitialData.caption}
        initialMediaUrls={composerInitialData.mediaUrls}
        initialHashtags={composerInitialData.hashtags}
      />

      {/* 9. ATTRACTIVE FIRST-TIME & TUNE INTEREST SELECTION MODAL */}
      <AnimatePresence>
        {showInterestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleSkipInterests}
              className="fixed inset-0 bg-black/75 backdrop-blur-md"
            />

            {/* Modal Container */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 16 }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="relative w-full max-w-2xl max-h-[92vh] sm:max-h-[88vh] bg-white dark:bg-[#12161F] rounded-3xl border border-black/[0.08] dark:border-white/[0.09] shadow-2xl flex flex-col z-10 overflow-hidden text-neutral-900 dark:text-neutral-100"
            >
              {/* Vibrant Top Accent Gradient Line */}
              <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 flex-shrink-0" />

              {/* Header */}
              <div className="px-5 sm:px-6 py-4 sm:py-5 border-b border-black/[0.06] dark:border-white/[0.08] flex-shrink-0">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 text-[11px] font-bold tracking-wide uppercase mb-1">
                      <Sparkles size={11} className="animate-pulse" />
                      <span>Creator Inspiration Onboarding</span>
                    </div>
                    <h2 className="text-lg sm:text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight leading-tight">
                      What topics do you create or love?
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
                      Select your favorite niches. We will curate trending reels, viral hooks, and breakout ideas tailored to your audience.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSkipInterests}
                    className="p-1.5 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex-shrink-0"
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Search Bar & Action Buttons */}
                <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search
                      size={13}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none"
                    />
                    <input
                      type="text"
                      value={modalSearch}
                      onChange={(e) => setModalSearch(e.target.value)}
                      placeholder="Search 24+ creator niches (e.g. AI, Crypto, Reels)..."
                      className="w-full h-8 sm:h-9 pl-8 pr-7 rounded-xl bg-neutral-100/80 dark:bg-white/[0.04] border border-black/[0.06] dark:border-white/[0.08] text-xs text-neutral-900 dark:text-white placeholder:text-neutral-400 outline-none focus:border-neutral-400 dark:focus:border-neutral-600"
                    />
                    {modalSearch && (
                      <button
                        onClick={() => setModalSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={selectAllTopics}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                      Select All
                    </button>
                    <span className="text-neutral-300 dark:text-neutral-700">|</span>
                    <button
                      type="button"
                      onClick={clearAllTopics}
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-neutral-400 hover:text-red-500 transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2.5 -mb-0.5">
                  {TREND_INTEREST_CATEGORIES.map((cat) => {
                    const active = modalCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setModalCategory(cat)}
                        className={`h-7 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                          active
                            ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-sm"
                            : "bg-neutral-100/70 dark:bg-white/[0.03] text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Scrollable Topics Grid */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-4">
                {filteredTopics.length === 0 ? (
                  <div className="py-12 text-center text-neutral-400">
                    <p className="text-sm font-semibold">No matching topics found</p>
                    <p className="text-xs mt-1">Try another keyword or select "All" above.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 sm:gap-2.5">
                    {filteredTopics.map((topic) => {
                      const isSelected = selectedTopicIds.includes(topic.id);
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => toggleTopic(topic.id)}
                          className={`relative flex items-center gap-2.5 p-2.5 sm:p-3 rounded-2xl border text-left transition-all duration-150 group ${
                            isSelected
                              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border-neutral-900 dark:border-white shadow-md scale-[1.01]"
                              : "bg-neutral-50/80 dark:bg-white/[0.03] text-neutral-700 dark:text-neutral-300 border-black/[0.06] dark:border-white/[0.07] hover:border-black/20 dark:hover:border-white/20 hover:bg-neutral-100/80 dark:hover:bg-white/[0.05]"
                          }`}
                        >
                          <span className="text-2xl flex-shrink-0 select-none group-hover:scale-110 transition-transform">
                            {topic.emoji}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs font-bold truncate leading-snug">
                              {topic.label}
                            </h4>
                            <p
                              className={`text-[10px] truncate ${
                                isSelected ? "text-neutral-300 dark:text-neutral-600 font-medium" : "text-neutral-400"
                              }`}
                            >
                              {topic.category}
                            </p>
                          </div>
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                              isSelected
                                ? "bg-white text-neutral-900 dark:bg-neutral-900 dark:text-white"
                                : "border border-black/[0.15] dark:border-white/[0.15] opacity-40 group-hover:opacity-75"
                            }`}
                          >
                            {isSelected && <Check size={11} strokeWidth={3} />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                          {/* Optional Collapsible Advanced Custom Inputs */}
                          <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.08]">
                            <button
                              type="button"
                              onClick={() => setShowAdvancedProfile(!showAdvancedProfile)}
                              className="w-full flex items-center justify-between py-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <SlidersHorizontal size={13} />
                                <span>Advanced Tuning (Role, Custom Keywords & Formats)</span>
                              </span>
                              <ChevronDown
                                size={14}
                                className={`transition-transform duration-200 ${showAdvancedProfile ? "rotate-180" : ""
                                  }`}
                              />
                            </button>

                            {showAdvancedProfile && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="pt-2 pb-1 space-y-3"
                              >
                                <div>
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                                    Your Creator / Brand Role
                                  </label>
                                  <input
                                    type="text"
                                    value={draftProfile.work}
                                    onChange={(e) =>
                                      setDraftProfile((cur) => ({ ...cur, work: e.target.value }))
                                    }
                                    placeholder="e.g. AI SaaS Founder, YouTube Creator, Agency Lead"
                                    className="w-full h-9 px-3 rounded-xl bg-neutral-50 dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] text-xs font-medium text-neutral-900 dark:text-white outline-none focus:border-neutral-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                                    Additional Custom Keywords (comma-separated)
                                  </label>
                                  <input
                                    type="text"
                                    value={draftProfile.interests}
                                    onChange={(e) =>
                                      setDraftProfile((cur) => ({ ...cur, interests: e.target.value }))
                                    }
                                    placeholder="e.g. prompt engineering, notion templates, blender tutorials"
                                    className="w-full h-9 px-3 rounded-xl bg-neutral-50 dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] text-xs font-medium text-neutral-900 dark:text-white outline-none focus:border-neutral-500"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-500 mb-1">
                                    Preferred Content Formats
                                  </label>
                                  <input
                                    type="text"
                                    value={draftProfile.goal}
                                    onChange={(e) =>
                                      setDraftProfile((cur) => ({ ...cur, goal: e.target.value }))
                                    }
                                    placeholder="e.g. 30s Viral Reels, Carousels, Twitter/X Threads"
                                    className="w-full h-9 px-3 rounded-xl bg-neutral-50 dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] text-xs font-medium text-neutral-900 dark:text-white outline-none focus:border-neutral-500"
                                  />
                                </div>
                              </motion.div>
                            )}
                          </div>
                        </div>

                        {/* Sticky Footer */ }
                        <div className="p-3.5 sm:px-6 sm:py-3.5 border-t border-black/[0.06] dark:border-white/[0.08] bg-neutral-50/90 dark:bg-[#161B22]/90 backdrop-blur-sm flex items-center justify-between gap-3 flex-shrink-0">
                          <button
                            type="button"
                            onClick={handleSkipInterests}
                            className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white px-2 py-1 rounded-lg transition-colors"
                          >
                            Skip for now
                          </button>

                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">
                              <strong className="text-neutral-900 dark:text-white font-bold">
                                {selectedTopicIds.length}
                              </strong>{" "}
                              selected
                            </span>
                            <button
                              type="button"
                              onClick={handleSaveInterests}
                              className="h-9 sm:h-10 px-4 sm:px-5 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 text-xs font-bold shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all inline-flex items-center gap-1.5"
                            >
                              <Sparkles size={13} className="text-amber-400 fill-amber-400" />
                              <span>Personalize Feed</span>
                            </button>
                          </div>
                        </div>
            </motion.div>
                  </div>
        )}
                </AnimatePresence>
              </div>
              );
}
