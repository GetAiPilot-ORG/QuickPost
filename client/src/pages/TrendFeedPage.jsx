import { useSearchParams } from "react-router-dom";
import { ScheduledMediaGallery } from "../components/ScheduledMedia";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  CheckCircle2,
  X,
  Globe,
  Layers,
  FileText,
  ListOrdered,
  Lightbulb,
  Volume2,
  VolumeX,
  ArrowUpRight,
  ArrowRight,
  ChevronDown,
  Eye,
  Heart,
  Share2,
  Zap,
  Sparkles,
  Repeat2,
  History,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import apiClient from "../utils/apiClient";
import ComposerModal from "../components/ComposerModal";

const PAGE_SIZE = 24;
const MAX_SEEN_IDS = 50;

const SKELETON_HEIGHTS = [
  "h-64 sm:h-72",
  "h-76 sm:h-84",
  "h-56 sm:h-64",
  "h-80 sm:h-92",
  "h-68 sm:h-76",
  "h-60 sm:h-68",
];

function useFeedColumns() {
  const [colCount, setColCount] = useState(() => {
    if (typeof window === "undefined") return 3;
    const w = window.innerWidth;
    if (w < 640) return 1;
    if (w < 1024) return 2;
    if (w < 1440) return 3;
    return 4;
  });

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      const next = w < 640 ? 1 : w < 1024 ? 2 : w < 1440 ? 3 : 4;
      setColCount(next);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return colCount;
}

const FORMAT_TABS = [
  { id: "all", label: "All Trends" },
  { id: "shorts", label: "YouTube Shorts", iconSvg: "/icons/youtube-color-icon.svg" },
  { id: "pinterest", label: "Pinterest", iconSvg: "/icons/pinterest-round-color-icon.svg" },
  { id: "bluesky", label: "Bluesky", iconSvg: "/icons/bluesky-circle-color-icon.svg" },
  { id: "videos", label: "Reels & Videos", icon: Video },
  { id: "visuals", label: "Visuals & Photos", icon: ImageIcon },
  { id: "news", label: "News & Stories", icon: Newspaper },
  { id: "searches", label: "Search Trends", icon: TrendingUp },
];

const NICHE_PILLS = [
  { id: "all", label: "All Topics", emoji: "✨" },
  { id: "tech_ai", label: "AI & Tech", emoji: "🤖" },
  { id: "business_finance", label: "Business & Wealth", emoji: "📈" },
  { id: "marketing_creators", label: "Creator Economy", emoji: "📱" },
  { id: "entertainment", label: "Entertainment", emoji: "🍿" },
  { id: "health_fitness", label: "Health & Fitness", emoji: "🏋️" },
  { id: "design_art", label: "Design & Art", emoji: "🎨" },
  { id: "gaming", label: "Gaming", emoji: "🎮" },
  { id: "science_space", label: "Science & Space", emoji: "🚀" },
];

const REGION_OPTIONS = [
  { code: "IN", label: "India", flag: "🇮🇳" },
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "GLOBAL", label: "Global", flag: "🌐" },
  { code: "GB", label: "United Kingdom", flag: "🇬🇧" },
  { code: "CA", label: "Canada", flag: "🇨🇦" },
  { code: "AU", label: "Australia", flag: "🇦🇺" },
];

const TREND_INTEREST_TOPICS = [
  // 1. Tech & AI
  { id: "ai_chatgpt", label: "AI & ChatGPT", emoji: "🤖", category: "Tech & AI", keywords: "ai, chatgpt, llm, artificial intelligence, claude, midjourney, prompt, openai, generative ai" },
  { id: "tech_gadgets", label: "Tech & Gadgets", emoji: "⚡", category: "Tech & AI", keywords: "tech, gadgets, apple, smartphone, setup, hardware, devices, desk setup" },
  { id: "coding_dev", label: "Coding & Dev", emoji: "💻", category: "Tech & AI", keywords: "coding, programmer, developer, software, web development, python, javascript, code, github" },
  { id: "science_space", label: "Future & Space", emoji: "🚀", category: "Tech & AI", keywords: "science, future, space, astrophysics, robotics, astronomy, nasa, spacex" },
  { id: "robotics_hardware", label: "Robotics & Hardware", emoji: "🦾", category: "Tech & AI", keywords: "robotics, hardware, engineering, arduino, raspberry pi, drones, automation, sensors" },
  { id: "cybersecurity_privacy", label: "Cyber & Security", emoji: "🛡️", category: "Tech & AI", keywords: "cybersecurity, hacking, security, privacy, encryption, infosec, ethical hacking, malware" },
  { id: "apple_ecosystem", label: "Apple Ecosystem", emoji: "🍎", category: "Tech & AI", keywords: "apple, iphone, macbook, ios, ipad, apple watch, macos, airpods, tim cook" },
  { id: "crypto_bitcoin", label: "Crypto & Bitcoin", emoji: "🪙", category: "Tech & AI", keywords: "crypto, bitcoin, ethereum, blockchain, web3, solana, crypto news, defi" },

  // 2. Business & Wealth
  { id: "startups_saas", label: "Startups & SaaS", emoji: "🏢", category: "Business & Wealth", keywords: "startups, saas, founder, indie hacker, entrepreneurship, building in public, business" },
  { id: "marketing_growth", label: "Marketing & Growth", emoji: "📈", category: "Business & Wealth", keywords: "marketing, growth, seo, copywriting, sales, advertising, branding, funnel, viral growth" },
  { id: "finance_stocks", label: "Investing & Stocks", emoji: "💵", category: "Business & Wealth", keywords: "investing, stocks, wealth, portfolio, passive income, market, etf, finance, dividends" },
  { id: "real_estate", label: "Real Estate & Homes", emoji: "🏠", category: "Business & Wealth", keywords: "real estate, property, housing, architecture, rental properties, real estate investing, mortgage" },
  { id: "ecommerce_dropship", label: "E-Commerce & Brands", emoji: "🛍️", category: "Business & Wealth", keywords: "ecommerce, shopify, amazon fba, dropshipping, direct to consumer, retail, store" },
  { id: "creator_economy", label: "Creator Economy", emoji: "📱", category: "Business & Wealth", keywords: "creator, monetization, youtube growth, hooks, editing, viral, content creator, sponsorships" },
  { id: "side_hustles", label: "Side Hustles & Wealth", emoji: "💼", category: "Business & Wealth", keywords: "side hustle, passive income, make money online, freelancing, solopreneur, work from home" },
  { id: "business_strategy", label: "Business Strategy", emoji: "📊", category: "Business & Wealth", keywords: "business strategy, economics, case studies, corporate, management, venture capital, market analysis" },

  // 3. Creative & Media
  { id: "reels_video", label: "Reels & Short Video", emoji: "🎥", category: "Creative & Media", keywords: "video editing, reels, tiktok, capcut, cinematography, shortform, broll, viral video" },
  { id: "video_editing_vfx", label: "Video Editing & VFX", emoji: "🎬", category: "Creative & Media", keywords: "premiere pro, after effects, davinci resolve, vfx, color grading, sound design, transitions" },
  { id: "design_3d", label: "Design & 3D Art", emoji: "🎨", category: "Creative & Media", keywords: "design, ui, ux, 3d, blender, graphic design, animation, typography, aesthetic, figma" },
  { id: "photography_gear", label: "Photo & Cameras", emoji: "📸", category: "Creative & Media", keywords: "photography, camera, lighting, portraits, aesthetic, photo, cinematic photo, sony, canon" },
  { id: "architecture_interiors", label: "Interior & Architecture", emoji: "🏛️", category: "Creative & Media", keywords: "architecture, interior design, home decor, modern home, minimal living, aesthetic room" },
  { id: "typography_branding", label: "Branding & Logos", emoji: "✒️", category: "Creative & Media", keywords: "branding, logos, typography, visual identity, poster design, aesthetic fonts, creative director" },
  { id: "animation_motion", label: "Motion & Animation", emoji: "✨", category: "Creative & Media", keywords: "animation, motion graphics, 2d animation, stop motion, anime aesthetic, cgi, motion design" },
  { id: "filmmaking_cinema", label: "Filmmaking & Directing", emoji: "🎞️", category: "Creative & Media", keywords: "filmmaking, director, cinematography, indie film, screenwriting, camera gear, movie scenes" },

  // 4. Lifestyle & Health
  { id: "fitness_gym", label: "Fitness & Gym", emoji: "🏋️", category: "Lifestyle & Health", keywords: "fitness, gym, workout, muscle, bodybuilding, health, training, nutrition, lifting" },
  { id: "running_cardio", label: "Running & Cardio", emoji: "🏃", category: "Lifestyle & Health", keywords: "running, marathon, sprint, cardio, endurance, trail running, athletics, runner" },
  { id: "yoga_mindfulness", label: "Yoga & Mindfulness", emoji: "🧘", category: "Lifestyle & Health", keywords: "yoga, meditation, mindfulness, breathing, flexibility, calm, mental health, zen" },
  { id: "nutrition_mealprep", label: "Nutrition & Diet", emoji: "🥗", category: "Lifestyle & Health", keywords: "nutrition, healthy food, meal prep, high protein, clean eating, diet, macros, vitamins" },
  { id: "biohacking_sleep", label: "Biohacking & Sleep", emoji: "🧬", category: "Lifestyle & Health", keywords: "biohacking, sleep optimization, longevity, recovery, cold plunge, sauna, circadian rhythm" },
  { id: "productivity_habits", label: "Productivity & Focus", emoji: "💡", category: "Lifestyle & Health", keywords: "productivity, habits, focus, notion, daily routine, systems, deep work, time management" },
  { id: "mindset_selfhelp", label: "Mindset & Motivation", emoji: "🧠", category: "Lifestyle & Health", keywords: "motivation, discipline, psychology, mindset, self improvement, stoicism, mental toughness" },
  { id: "books_learning", label: "Books & Knowledge", emoji: "📚", category: "Lifestyle & Health", keywords: "books, reading, non fiction, book recommendations, learning, philosophy, summary" },
  { id: "skincare_beauty", label: "Skincare & Self-Care", emoji: "✨", category: "Lifestyle & Health", keywords: "skincare, beauty, grooming, morning routine, dermatologists, glow, self care" },

  // 5. Travel, Food & Style
  { id: "travel_nomad", label: "Travel & Nomad", emoji: "✈️", category: "Travel & Culture", keywords: "travel, nomad, adventure, explore, destinations, vacation, digital nomad, wanderlust" },
  { id: "luxury_hiddenplaces", label: "Luxury Escapes", emoji: "🏝️", category: "Travel & Culture", keywords: "luxury travel, hidden gems, resorts, islands, hotels, first class, scenic views" },
  { id: "food_cooking", label: "Food & Recipes", emoji: "🍔", category: "Travel & Culture", keywords: "food, cooking, recipes, street food, baking, chef, restaurant, meal prep, gourmet" },
  { id: "coffee_drinks", label: "Specialty Coffee", emoji: "☕", category: "Travel & Culture", keywords: "coffee, espresso, latte art, cafe, barista, pour over, cocktails, matchalatte" },
  { id: "fashion_style", label: "Fashion & Streetwear", emoji: "👟", category: "Travel & Culture", keywords: "fashion, streetwear, outfits, styling, sneakers, luxury, drip, lookbook" },
  { id: "sneakerhead_drops", label: "Sneakers & Kicks", emoji: "🔥", category: "Travel & Culture", keywords: "sneakers, sneakerhead, jordan, nike, yeezy, kicks, unboxing, sneaker collection" },
  { id: "gardening_plants", label: "Plants & Gardening", emoji: "🌿", category: "Travel & Culture", keywords: "gardening, house plants, urban garden, botany, nature, plant care, balcony garden" },
  { id: "diy_crafting", label: "DIY & Woodworking", emoji: "🔨", category: "Travel & Culture", keywords: "diy, woodworking, carpentry, crafting, handmade, restoration, maker, workshop" },

  // 6. Entertainment & Pop
  { id: "gaming_stream", label: "Gaming & Esports", emoji: "🎮", category: "Entertainment", keywords: "gaming, gta, playstation, twitch, steam, esports, xbox, pc gaming, gameplay" },
  { id: "retro_nintendo", label: "Retro & Nintendo", emoji: "👾", category: "Entertainment", keywords: "retro gaming, nintendo, zelda, pokemon, mario, game boy, arcade, nostalgic gaming" },
  { id: "cinema_movies", label: "Cinema & TV Shows", emoji: "🍿", category: "Entertainment", keywords: "movies, cinema, trailer, series, netflix, hollywood, film, box office, actors" },
  { id: "anime_manga", label: "Anime & Manga", emoji: "⛩️", category: "Entertainment", keywords: "anime, manga, animation, japan, otaku, cosplay, shonen, studio ghibli" },
  { id: "comedy_memes", label: "Comedy & Memes", emoji: "😂", category: "Entertainment", keywords: "comedy, memes, jokes, funny, skits, relatable, humor, viral jokes, laugh" },
  { id: "music_audio", label: "Music & Viral Audio", emoji: "🎵", category: "Entertainment", keywords: "music, beats, trending audio, sound, artists, live music, new album, concert" },
  { id: "hiphop_beats", label: "Hip Hop & Beatmaking", emoji: "🎧", category: "Entertainment", keywords: "hip hop, rap, beatmaker, fl studio, producer, instrumentals, trap, sampling" },
  { id: "podcasts_talks", label: "Podcasts & Interviews", emoji: "🎙️", category: "Entertainment", keywords: "podcasts, interview, conversation, longform, creator talks, speech, discussion" },
  { id: "cars_supercars", label: "Supercars & Racing", emoji: "🏎️", category: "Entertainment", keywords: "cars, supercars, automotive, racing, f1, vehicles, tuning, ferrari, porsche" },
  { id: "motorcycles_biker", label: "Motorcycles & Moto", emoji: "🏍️", category: "Entertainment", keywords: "motorcycles, biker, moto, cafe racer, harley, ducati, superbike, riding" },
  { id: "history_lore", label: "History & Lore", emoji: "📜", category: "Entertainment", keywords: "history, ancient history, mythology, warfare, historical facts, deep lore, empires" },
  { id: "pets_cuteanimals", label: "Cute Pets & Animals", emoji: "🐾", category: "Entertainment", keywords: "pets, dogs, cats, puppies, kittens, cute animals, wildlife, pet memes" },
  { id: "nature_exploration", label: "Nature & Wildlife", emoji: "🌲", category: "Entertainment", keywords: "nature, wildlife, ocean, deep sea, national parks, animals, documentary, planet" },
];

function emptyProfile() {
  return { work: "", interests: "", goal: "" };
}

function sanitizeSavedInterests(str) {
  if (!str || typeof str !== "string") return "";
  // If the string contains the legacy accumulated search queries from previous test sessions, clear it
  if (str.includes("gta6") && str.includes("footbal")) return "";
  return str;
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
  if ((post.source_platform === "youtube" || post.target_platform === "youtube") && post.video_id && post.video_id.length === 11) {
    return post.video_id;
  }
  const candidates = [post.video_id, post.source_url, post.embed_html, post.id];
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
    case "socialpilot":
      return {
        name: "GAP Social-pilot",
        iconSvg: "/logo.png",
        fallbackIcon: Flame,
        color: "text-amber-500",
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
// REDESIGNED TREND CARD (Pinterest Style: Image-First, Exact Natural Proportions, Zero Cropping)
// -----------------------------------------------------------------------------
function TrendCard({ post, onUseIdea, onRemix, onCompose, onSave, isSaved, onOpenDetails }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [imageError, setImageError] = useState(false);
  const videoRef = useRef(null);

  const videoId = (post.source_platform === "youtube" || post.target_platform === "youtube") ? getYouTubeVideoId(post) : null;
  const isPexels = post.source_platform === "pexels" && Boolean(post.video_url);
  const directVideoUrl = post.video_url || (post.media_type === "video" ? post.media_urls?.[0] : null);
  const hasDirectVideo = Boolean(directVideoUrl);
  const isVideo = isPexels || hasDirectVideo || Boolean(videoId);
  const isYouTubeShort = (post.source_platform === "youtube" || post.target_platform === "youtube") && (post.content_type === "short" || post.source_url?.includes("/shorts/") || post.is_short);
  const isReel = isYouTubeShort || post.content_type === "short" || post.source_url?.includes("/shorts/") || post.media_type === "video" || isPexels;
  const effectivePlatform = post.target_platform || (post.source_platform === "socialpilot"
    ? (post.creator?.startsWith("@") ? "instagram" : "socialpilot")
    : post.source_platform);
  const platformMeta = getPlatformMeta(effectivePlatform);

  // Engagement stats
  const views = formatCompactNumber(post.metrics?.viewCount ?? post.metrics?.views);
  const likes = formatCompactNumber(post.metrics?.likeCount ?? post.metrics?.likes);
  const comments = formatCompactNumber(post.metrics?.commentCount ?? post.metrics?.comments ?? post.metrics?.replies);
  const saves = formatCompactNumber(post.metrics?.saveCount ?? post.metrics?.saves);
  const reposts = formatCompactNumber(post.metrics?.repostCount ?? post.metrics?.reposts);
  const searchVolume = post.metrics?.searchVolume || post.metrics?.formattedTraffic;
  const rank = post.metrics?.rank;

  // Auto-play / pause video on hover
  useEffect(() => {
    if ((!isPexels && !hasDirectVideo) || !videoRef.current) return;
    if (isHovered) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => { });
    } else {
      videoRef.current.pause();
    }
  }, [isHovered, isPexels, hasDirectVideo]);

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

  const handleOpenSource = (e) => {
    e.stopPropagation();
    if (post.source_url) {
      window.open(post.source_url, "_blank", "noopener,noreferrer");
    }
  };

  const ytThumb = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
  const isVideoMedia = post.media_type === "video" || hasDirectVideo || (typeof post.media_urls?.[0] === "string" && (post.media_urls[0].includes("/video/upload/") || post.media_urls[0].endsWith(".mp4")));
  const autoVideoThumb = isVideoMedia && typeof post.media_urls?.[0] === "string" ? post.media_urls[0].replace(/\.[^/.]+$/, ".jpg") : null;
  const initialMedia = post.thumbnail_url || ytThumb || autoVideoThumb || post.full_image_url;
  const [imgSrc, setImgSrc] = useState(initialMedia);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImgSrc(post.thumbnail_url || ytThumb || autoVideoThumb || post.full_image_url);
    setImageFailed(false);
  }, [post.thumbnail_url, ytThumb, autoVideoThumb, post.full_image_url]);

  const handleImageError = () => {
    // If highRes 736x failed, try fallback to 564x or 236x or post.thumbnail_url
    if (imgSrc && imgSrc.includes("/736x/")) {
      setImgSrc(imgSrc.replace(/\/736x\//, "/564x/"));
      return;
    }
    if (imgSrc && imgSrc.includes("/564x/")) {
      setImgSrc(imgSrc.replace(/\/564x\//, "/236x/"));
      return;
    }
    if (post.thumbnail_url && imgSrc !== post.thumbnail_url) {
      setImgSrc(post.thumbnail_url);
      return;
    }
    setImageFailed(true);
  };

  const hasMedia = Boolean(imgSrc || isPexels || hasDirectVideo || videoId);

  return (
    <article
      className="group relative flex flex-col w-full rounded-2xl bg-white dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.08] shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_28px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_12px_28px_rgba(0,0,0,0.4)] transition-all duration-200 overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 1. MEDIA PREVIEW (Pinterest style: Top of card, Exact Natural Size, Zero Cropping) */}
      {hasMedia ? (
        <div
          className="relative w-full bg-neutral-100 dark:bg-neutral-900 cursor-pointer overflow-hidden"
          onClick={() => onOpenDetails(post)}
        >
          {isPexels || hasDirectVideo ? (
            <video
              ref={videoRef}
              src={isPexels ? post.video_url : directVideoUrl}
              poster={imgSrc}
              muted={isMuted}
              playsInline
              loop
              className="w-full h-auto block max-h-[750px] object-cover transition-transform duration-300 group-hover:scale-[1.01]"
            />
          ) : !imageFailed && imgSrc ? (
            <img
              src={imgSrc}
              alt={post.title || ""}
              loading="lazy"
              onError={handleImageError}
              className="w-full h-auto max-h-[650px] object-cover block transition-transform duration-300 group-hover:scale-[1.01]"
            />
          ) : (
            /* Elegant Pinterest-style media placeholder if image URL is unreachable */
            <div className="w-full min-h-[200px] flex flex-col items-center justify-center p-6 bg-gradient-to-br from-neutral-100 to-neutral-200/70 dark:from-neutral-900 dark:to-neutral-800 text-neutral-400">
              {platformMeta.iconSvg ? (
                <img src={platformMeta.iconSvg} alt="" className="w-8 h-8 object-contain mb-2 opacity-50" />
              ) : (
                <Sparkles size={24} className="mb-2 opacity-50 text-amber-500" />
              )}
              <span className="text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">
                {platformMeta.name} Inspiration
              </span>
            </div>
          )}

          {/* Pinterest-style Hover Overlay */}
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none" />

          {/* Top-Right: Quick Save / Bookmark Button */}
          <div className="absolute top-2.5 right-2.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSave(post);
              }}
              className={`h-8 px-3 rounded-full text-xs font-bold shadow-md backdrop-blur-md transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer ${isSaved
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-white/95 hover:bg-white text-neutral-900 hover:text-black dark:bg-neutral-900/90 dark:hover:bg-neutral-900 dark:text-white"
                }`}
              title={isSaved ? "Saved to Inspiration Board" : "Bookmark idea"}
            >
              {isSaved ? (
                <>
                  <BookmarkCheck size={13} className="fill-current text-white" />
                  <span>Saved</span>
                </>
              ) : (
                <>
                  <Bookmark size={13} />
                  <span>Save</span>
                </>
              )}
            </button>
          </div>

          {/* Top-Left: Platform Tag (Discrete Pill on Hover) */}
          <div className="absolute top-2.5 left-2.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="h-7 px-2.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[11px] font-medium flex items-center gap-1.5 shadow-sm pointer-events-none">
              {platformMeta.iconSvg ? (
                <img src={platformMeta.iconSvg} alt="" className="w-3.5 h-3.5 object-contain" />
              ) : null}
              <span>{platformMeta.name}</span>
            </div>
          </div>

          {/* Bottom-Right: External Link Button */}
          {post.source_url && (
            <div className="absolute bottom-2.5 right-2.5 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                type="button"
                onClick={handleOpenSource}
                className="p-2 rounded-full bg-white/95 hover:bg-white text-neutral-900 dark:bg-neutral-900/90 dark:hover:bg-neutral-900 dark:text-white shadow-md backdrop-blur-md transition-all active:scale-95 cursor-pointer"
                title={`Open on ${getHost(post.source_url)}`}
              >
                <ArrowUpRight size={14} />
              </button>
            </div>
          )}

          {/* Video Type Chip */}
          {isYouTubeShort ? (
            <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-red-600/90 backdrop-blur-md text-white text-[10px] font-semibold flex items-center gap-1 shadow-sm pointer-events-none">
              <img src="/icons/youtube-color-icon.svg" alt="" className="w-3 h-3 object-contain" />
              <span>YouTube Short</span>
            </div>
          ) : isVideo && (
            <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-white text-[10px] font-medium flex items-center gap-1 shadow-sm pointer-events-none">
              <Play size={9} className="fill-current text-white" />
              <span>{isReel ? "Short / Reel" : "Video"}</span>
            </div>
          )}

          {/* Video Sound Toggle */}
          {(isPexels || hasDirectVideo) && isHovered && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMuted(!isMuted);
              }}
              className="absolute bottom-2.5 left-20 p-1.5 rounded-full bg-black/70 hover:bg-black text-white/90 hover:text-white border border-white/20 transition-transform hover:scale-110"
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <VolumeX size={12} /> : <Volume2 size={12} />}
            </button>
          )}
        </div>
      ) : post.source_platform === "bluesky" ? (
        /* Text-only Bluesky Post */
        <div
          onClick={() => onOpenDetails(post)}
          className="w-full p-4 sm:p-5 bg-gradient-to-br from-sky-950 via-slate-900 to-sky-900 text-white flex flex-col justify-between min-h-[160px] cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-sky-400 truncate max-w-[160px]">
              @{post.creator || "bluesky"}
            </span>
            <span className="text-[10px] text-sky-300/70 font-mono">
              ATProto Post
            </span>
          </div>
          <p className="my-auto py-2 text-xs sm:text-sm font-medium text-slate-100 line-clamp-4 leading-relaxed">
            "{post.caption || post.title}"
          </p>
          <div className="text-[10px] text-sky-300/70 font-mono">
            Official ATProto Post
          </div>
        </div>
      ) : post.source_platform === "google_trends" ? (
        /* Google Trends Search Surge */
        <div
          onClick={() => onOpenDetails(post)}
          className="w-full p-4 sm:p-5 bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 text-white flex flex-col justify-between min-h-[160px] cursor-pointer"
        >
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
      ) : null}

      {/* 2. CARD BODY: Compact Title, Creator Info, Stats & Actions */}
      <div className="px-2.5 py-2 sm:px-3 sm:py-2.5 flex flex-col gap-1.5">
        <div>
          {post.matched_topic && post.matched_topic !== "Community Spark" && (
            <div className="flex items-center gap-1 mb-0.5 text-[10px] sm:text-[11px] font-semibold text-sky-600 dark:text-sky-400 leading-none">
              <span className="text-[11px]">{post.topic_emoji || "✨"}</span>
              <span className="truncate">{post.matched_topic}</span>
            </div>
          )}
          <h3
            onClick={() => onOpenDetails(post)}
            className="text-xs sm:text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 leading-snug line-clamp-2 cursor-pointer hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
          >
            {post.title || post.caption || "Trending post"}
          </h3>
        </div>

        {/* Creator Info & Minimal Metrics */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-4 h-4 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {platformMeta.iconSvg ? (
                <img src={platformMeta.iconSvg} alt={platformMeta.name} className="w-3 h-3 object-contain" />
              ) : platformMeta.fallbackIcon ? (
                <platformMeta.fallbackIcon size={11} className={platformMeta.color} />
              ) : (
                <span className="text-[8px] font-bold text-neutral-600 dark:text-neutral-400">
                  {(post.creator || post.source_platform)?.[0]?.toUpperCase()}
                </span>
              )}
            </div>

            <span className="text-[10px] sm:text-[11px] font-medium text-neutral-500 dark:text-neutral-400 truncate max-w-[130px]">
              {post.creator || platformMeta.name}
            </span>
          </div>

          {/* Minimal Engagement Metrics */}
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-neutral-400 dark:text-neutral-500 flex-shrink-0">
            {views && (
              <span className="inline-flex items-center gap-0.5" title={`${views} views`}>
                <Eye size={11} className="text-neutral-400" />
                <span>{views}</span>
              </span>
            )}
            {saves && (
              <span className="inline-flex items-center gap-0.5 text-rose-500 font-semibold" title={`${saves} saves`}>
                <Bookmark size={10} className="fill-current" />
                <span>{saves}</span>
              </span>
            )}
            {likes && !saves && (
              <span className="inline-flex items-center gap-0.5" title={`${likes} likes`}>
                <Heart size={10} className="text-neutral-400 fill-current" />
                <span>{likes}</span>
              </span>
            )}
          </div>
        </div>

        {/* 3. ACTIONS ROW: Compact "Use Idea" & Quick Utilities */}
        <div className="pt-1.5 mt-0.5 border-t border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={() => onUseIdea(post)}
            className="flex-1 h-7 px-2 rounded-md bg-neutral-950 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-100 text-[11px] font-medium inline-flex items-center justify-center gap-1 transition-all active:scale-95 cursor-pointer"
          >
            <Zap size={11} className="text-amber-400 fill-amber-400" />
            <span>Use Idea</span>
          </button>

          {/* Quick AI Remix */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemix(post);
            }}
            className="w-7 h-7 rounded-md border border-black/[0.07] dark:border-white/[0.08] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 inline-flex items-center justify-center transition-colors cursor-pointer"
            title="Remix with AI"
          >
            <Lightbulb size={12} />
          </button>

          {/* Quick Compose */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCompose(post);
            }}
            className="w-7 h-7 rounded-md border border-black/[0.07] dark:border-white/[0.08] hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 inline-flex items-center justify-center transition-colors cursor-pointer"
            title="Open in Composer"
          >
            <Send size={12} />
          </button>

          {/* Mobile Bookmark fallback (when hover not available) */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSave(post);
            }}
            className={`sm:hidden w-7 h-7 rounded-md border border-black/[0.07] dark:border-white/[0.08] inline-flex items-center justify-center transition-colors cursor-pointer ${isSaved
              ? "text-amber-500 bg-amber-500/10 border-amber-500/30"
              : "text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              }`}
            title={isSaved ? "Saved" : "Save"}
          >
            {isSaved ? <BookmarkCheck size={12} className="fill-current text-amber-500" /> : <Bookmark size={12} />}
          </button>
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

  const isYouTubeShort =
    (post.source_platform === "youtube" || post.target_platform === "youtube") &&
    (post.content_type === "short" || post.source_url?.includes("/shorts/") || post.is_short);
  const videoId =
    post.source_platform === "youtube" || post.target_platform === "youtube"
      ? getYouTubeVideoId(post)
      : null;
  const mediaUrl = post.video_url || post.full_image_url || post.thumbnail_url;
  const effectivePlatform = post.source_platform === "socialpilot"
    ? (post.target_platform || (post.creator?.startsWith("@") ? "instagram" : "socialpilot"))
    : post.source_platform;
  const platformMeta = getPlatformMeta(effectivePlatform);
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
            {/* Player / Preview (Clean, Hugging Image with Zero Dark Letterboxing) */}
            {isYouTubeShort && videoId ? (
              <div className="w-full flex flex-col items-center justify-center py-1">
                <div className="w-full max-w-[340px] aspect-[9/16] rounded-2xl overflow-hidden bg-black shadow-2xl relative border border-white/10">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&loop=1&playlist=${videoId}&rel=0&modestbranding=1`}
                    title={post.title || "YouTube Short Preview"}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <a
                    href={post.source_url || `https://www.youtube.com/shorts/${videoId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md active:scale-95"
                  >
                    <Play size={12} className="fill-current text-white" />
                    <span>Watch on YouTube Shorts ↗</span>
                  </a>
                </div>
              </div>
            ) : videoId ? (
              <div className="w-full rounded-2xl overflow-hidden bg-neutral-950 aspect-video shadow-sm">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
                  title={post.title || "YouTube Preview"}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : post.video_url ? (
              <div className="flex items-center justify-center w-full py-1">
                <div className="relative inline-block max-w-full rounded-2xl overflow-hidden shadow-sm bg-neutral-950">
                  <video
                    src={post.video_url}
                    autoPlay
                    loop
                    controls
                    playsInline
                    className="max-h-[58vh] w-auto max-w-full h-auto object-contain block mx-auto rounded-2xl"
                  />
                </div>
              </div>
            ) : mediaUrl ? (
              <div className="flex items-center justify-center w-full py-1">
                <div className="relative inline-block max-w-full rounded-2xl overflow-hidden shadow-md bg-neutral-100 dark:bg-neutral-900 border border-black/[0.06] dark:border-white/[0.08]">
                  <img
                    src={mediaUrl}
                    alt={post.title || ""}
                    className="max-h-[58vh] w-auto max-w-full h-auto object-contain block mx-auto rounded-2xl"
                  />
                  {isYouTubeShort && (
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600/90 text-white text-[11px] font-bold tracking-wider backdrop-blur-md shadow-md pointer-events-none">
                      <img src="/icons/youtube-color-icon.svg" alt="" className="w-3.5 h-3.5 object-contain" />
                      <span>YouTube Short</span>
                    </div>
                  )}
                  {post.source_platform === "pinterest" && (
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-600/90 text-white text-[11px] font-bold uppercase tracking-wider backdrop-blur-md shadow-md pointer-events-none">
                      <img src="/icons/pinterest-round-color-icon.svg" alt="" className="w-3.5 h-3.5 object-contain" />
                      <span>Pinterest Pin</span>
                    </div>
                  )}
                  {post.source_platform === "bluesky" && (
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-600/90 text-white text-[11px] font-bold tracking-wider backdrop-blur-md shadow-md pointer-events-none">
                      <img src="/icons/bluesky-circle-color-icon.svg" alt="" className="w-3.5 h-3.5 object-contain" />
                      <span>Bluesky Media</span>
                    </div>
                  )}
                </div>
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
              <div className="p-8 text-center text-white bg-neutral-900 rounded-2xl">
                <Flame size={40} className="mx-auto text-amber-500 mb-2" />
                <h4 className="text-base font-bold">{post.title}</h4>
              </div>
            )}

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
// PINTEREST-STYLE SKELETON CARD (Image-First, Exact Card Proportions)
// -----------------------------------------------------------------------------
function TrendCardSkeleton({ heightClass = "h-72" }) {
  return (
    <div className="w-full rounded-2xl bg-white dark:bg-[#161B22] border border-black/[0.06] dark:border-white/[0.08] overflow-hidden shadow-xs animate-pulse flex flex-col">
      {/* 1. Image Preview at Top */}
      <div className={`w-full ${heightClass} bg-gradient-to-b from-neutral-200 to-neutral-300/80 dark:from-neutral-800 dark:to-neutral-800/60`} />

      {/* 2. Body: Topic Tag, Title Lines, Creator & Actions */}
      <div className="p-3 sm:p-3.5 space-y-2.5">
        <div className="w-20 h-2.5 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="w-5/6 h-3.5 bg-neutral-200 dark:bg-neutral-800 rounded" />
        <div className="w-3/5 h-2.5 bg-neutral-200/70 dark:bg-neutral-800/70 rounded" />

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-neutral-200 dark:bg-neutral-800" />
            <div className="w-20 h-2.5 bg-neutral-200 dark:bg-neutral-800 rounded" />
          </div>
          <div className="w-8 h-2.5 bg-neutral-200 dark:bg-neutral-800 rounded" />
        </div>

        <div className="w-full h-8 bg-neutral-200/80 dark:bg-neutral-800/80 rounded-lg mt-1" />
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// HIGH-PERFORMANCE CREATOR INTEREST ONBOARDING & TUNING MODAL
// -----------------------------------------------------------------------------
function CreatorInterestModal({
  isOpen,
  mode = "onboarding", // "onboarding" | "tune"
  initialTopicIds = [],
  initialProfile = { work: "", interests: "", goal: "" },
  onSave,
  onSkip,
  onClose,
}) {
  const [localTopicIds, setLocalTopicIds] = useState(initialTopicIds);
  const [localProfile, setLocalProfile] = useState(() => ({
    work: initialProfile?.work || "",
    interests: initialProfile?.interests || "",
    goal: initialProfile?.goal || "",
  }));

  useEffect(() => {
    if (isOpen) {
      setLocalTopicIds(initialTopicIds || []);
      setLocalProfile({
        work: initialProfile?.work || "",
        interests: initialProfile?.interests || "",
        goal: initialProfile?.goal || "",
      });
    }
  }, [isOpen, initialTopicIds, initialProfile, mode]);

  if (!isOpen) return null;

  const toggleTopic = (topicId) => {
    setLocalTopicIds((prev) =>
      prev.includes(topicId) ? prev.filter((id) => id !== topicId) : [...prev, topicId]
    );
  };

  const handleSave = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    onSave(localTopicIds, localProfile);
  };

  const isTune = mode === "tune";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose || onSkip}
        className="fixed inset-0 bg-black/75 backdrop-blur-sm"
      />

      {/* Modal Container: Compact width for Tune modal, wide for topic niches */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className={`relative w-full ${isTune ? "max-w-lg" : "max-w-3xl"
          } max-h-[90vh] sm:max-h-[85vh] bg-white dark:bg-[#12161F] rounded-3xl border border-black/[0.08] dark:border-white/[0.12] shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex flex-col z-10 overflow-hidden text-neutral-900 dark:text-neutral-100`}
      >
        {/* Glowing Top Brand Rainbow Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 shadow-[0_2px_10px_rgba(245,158,11,0.35)] flex-shrink-0" />

        {/* Header */}
        <div className="relative px-5 sm:px-6 py-3.5 sm:py-4 border-b border-black/[0.06] dark:border-white/[0.08] flex-shrink-0 bg-neutral-50/70 dark:bg-white/[0.02]">
          <div className="flex items-center justify-between gap-3">
            <div>
              {!isTune && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 dark:bg-orange-500/15 border border-orange-500/25 text-orange-700 dark:text-orange-400 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shadow-[0_0_6px_rgba(249,115,22,0.6)]" />
                  <span>Creator Inspiration Engine</span>
                </div>
              )}
              <h2 className="text-xl sm:text-2xl font-black text-neutral-900 dark:text-neutral-100 tracking-tight leading-snug">
                {isTune ? "Tune Your Inspiration Feed" : "What topics do you create or love?"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose || onSkip}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex-shrink-0 cursor-pointer"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        {isTune ? (
          /* Tune Button View: Clean, compact 3 inputs without secondary lines or card boxes (Original UI) */
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 custom-scrollbar overscroll-contain">
            <div>
              <label className="block text-xs sm:text-[13px] font-normal text-neutral-700 dark:text-neutral-300 mb-1.5">
                Your creator / brand role
              </label>
              <input
                type="text"
                value={localProfile.work || ""}
                onChange={(e) => setLocalProfile((cur) => ({ ...cur, work: e.target.value }))}
                placeholder="e.g. AI SaaS Founder, YouTube Creator, Agency Lead"
                className="w-full h-10 px-3.5 rounded-xl bg-white dark:bg-white/[0.04] border border-neutral-300 dark:border-white/10 text-xs sm:text-[13px] font-normal text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-[13px] font-normal text-neutral-700 dark:text-neutral-300 mb-1.5">
                Additional custom keywords (comma-separated)
              </label>
              <input
                type="text"
                value={localProfile.interests || ""}
                onChange={(e) => setLocalProfile((cur) => ({ ...cur, interests: e.target.value }))}
                placeholder="e.g. prompt engineering, notion templates, blender tutorials"
                className="w-full h-10 px-3.5 rounded-xl bg-white dark:bg-white/[0.04] border border-neutral-300 dark:border-white/10 text-xs sm:text-[13px] font-normal text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-[13px] font-normal text-neutral-700 dark:text-neutral-300 mb-1.5">
                Preferred content formats
              </label>
              <input
                type="text"
                value={localProfile.goal || ""}
                onChange={(e) => setLocalProfile((cur) => ({ ...cur, goal: e.target.value }))}
                placeholder="e.g. 30s Viral Reels, Carousels, Twitter/X Threads"
                className="w-full h-10 px-3.5 rounded-xl bg-white dark:bg-white/[0.04] border border-neutral-300 dark:border-white/10 text-xs sm:text-[13px] font-normal text-neutral-900 dark:text-white placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15 transition-all"
              />
            </div>
          </div>
        ) : (
          /* First-Time Visit Onboarding: Strictly Topic Niches (Only shown one time!) */
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 custom-scrollbar space-y-4 overscroll-contain">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {TREND_INTEREST_TOPICS.map((topic) => {
                const isSelected = localTopicIds.includes(topic.id);
                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => toggleTopic(topic.id)}
                    className={`relative flex items-center gap-3 p-3 rounded-2xl border text-left transition-all duration-150 active:scale-[0.98] hover:-translate-y-0.5 group overflow-hidden cursor-pointer select-none ${isSelected
                      ? "bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-rose-500/5 dark:from-amber-400/20 dark:via-orange-400/10 dark:to-transparent border-amber-500/60 dark:border-amber-400/50 shadow-[0_4px_16px_rgba(245,158,11,0.14)]"
                      : "bg-neutral-50/70 dark:bg-white/[0.03] text-neutral-700 dark:text-neutral-300 border-black/[0.06] dark:border-white/[0.07] hover:border-black/[0.15] dark:hover:border-white/[0.15] hover:bg-neutral-100/80 dark:hover:bg-white/[0.05]"
                      }`}
                  >
                    {/* Emoji Badge with Smooth Animation */}
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 transition-transform duration-150 group-hover:scale-105 ${isSelected
                        ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20 shadow-xs"
                        : "bg-black/[0.04] dark:bg-white/[0.05]"
                        }`}
                    >
                      <span>{topic.emoji}</span>
                    </div>

                    {/* Topic Details */}
                    <div className="min-w-0 flex-1">
                      <h4
                        className={`text-xs font-bold truncate leading-snug transition-colors ${isSelected
                          ? "text-neutral-950 dark:text-white"
                          : "text-neutral-800 dark:text-neutral-200"
                          }`}
                      >
                        {topic.label}
                      </h4>
                      <p
                        className={`text-[10px] truncate transition-colors ${isSelected
                          ? "text-amber-700 dark:text-amber-300/80 font-medium"
                          : "text-neutral-400 dark:text-neutral-500"
                          }`}
                      >
                        {topic.category}
                      </p>
                    </div>

                    {/* Tactile Checkbox Pill with Instant CSS Animation */}
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-150 ${isSelected
                        ? "bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-xs scale-100"
                        : "border-2 border-black/[0.15] dark:border-white/[0.15] opacity-50 group-hover:opacity-100 group-hover:border-amber-500/60 scale-95"
                        }`}
                    >
                      {isSelected && (
                        <Check size={11} strokeWidth={3} className="transition-transform duration-150" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Sticky Footer */}
        <div className="p-3.5 sm:px-6 sm:py-3.5 border-t border-black/[0.06] dark:border-white/[0.08] bg-neutral-50/95 dark:bg-[#12161F]/95 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={isTune ? (onClose || onSkip) : onSkip}
              className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              {isTune ? "Cancel" : "Skip for now"}
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Visual Progress Meter (Onboarding mode only) */}
            {!isTune && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-20 h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-500 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.min((localTopicIds.length / 3) * 100, 100)}%` }}
                  />
                </div>
                {localTopicIds.length >= 3 ? (
                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                    <CheckCircle2 size={12} className="text-emerald-500" />
                    <span>Ready ({localTopicIds.length})</span>
                  </span>
                ) : (
                  <span className="text-[11px] font-medium text-neutral-400">
                    {localTopicIds.length} / 3 recommended
                  </span>
                )}
              </div>
            )}

            {/* Gradient CTA Button */}
            <button
              type="button"
              onClick={handleSave}
              className="relative h-10 px-6 rounded-xl bg-gradient-to-r from-[#FF5600] via-[#FF6D1A] to-[#F59E0B] hover:from-[#FF6A1A] hover:via-[#FF7D2B] hover:to-[#FBBF24] text-white text-[13px] font-bold tracking-wide shadow-[0_4px_18px_rgba(255,86,0,0.32)] hover:shadow-[0_6px_22px_rgba(255,86,0,0.45)] border border-white/20 transition-all duration-150 active:scale-[0.98] inline-flex items-center gap-2 group cursor-pointer"
            >
              <span>{isTune ? "Save & Apply Tuning" : "Personalize Feed"}</span>
              <ArrowRight
                size={14}
                strokeWidth={2.5}
                className="text-white/90 group-hover:translate-x-1 transition-transform duration-200"
              />
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// MAIN REDESIGNED TREND FEED COMPONENT
// -----------------------------------------------------------------------------
export default function TrendFeedPage() {
  const { user, loading: authLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Feed State
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState("");

  const colCount = useFeedColumns();

  // Pure equal round-robin distribution across all columns (Pinterest Waterfall)
  const columns = useMemo(() => {
    const effectiveCols = (loading || items.length === 0)
      ? colCount
      : Math.min(items.length, colCount);
    const cols = Array.from({ length: effectiveCols }, () => []);
    items.forEach((item, index) => {
      cols[index % effectiveCols].push(item);
    });
    return cols;
  }, [items, colCount, loading]);

  // Filters State
  const [selectedFormat, setSelectedFormat] = useState("all");
  const [selectedNiche, setSelectedNiche] = useState("all");
  const [selectedRegion, setSelectedRegion] = useState(() => {
    try {
      return localStorage.getItem("qp_trend_region") || "IN";
    } catch {
      return "IN";
    }
  });
  const [regionOpen, setRegionOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Hot Topics Radar Ticker
  const [hotTopics, setHotTopics] = useState([]);

  const userKey = user?.userId || user?.id || user?.email || "anon";
  const seenStorageKey = `qp_trend_seen_${userKey}`;
  const profileStorageKey = `qp_trend_profile_${userKey}`;
  const savedIdeasStorageKey = `qp_trend_saved_ideas_${userKey}`;
  const onboardingStorageKey = `qp_trend_onboarded_${userKey}`;
  const onboardingTriggeredRef = useRef(false);

  // Creator Personalization & Interest Onboarding
  const [profile, setProfile] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(profileStorageKey) || "null");
      if (saved && (saved.interests || saved.work || saved.goal || saved.selectedTopicIds)) {
        return {
          work: saved.work || "",
          interests: sanitizeSavedInterests(saved.interests),
          goal: saved.goal || "",
          selectedTopicIds: Array.isArray(saved.selectedTopicIds) ? saved.selectedTopicIds : [],
        };
      }
    } catch { }
    return emptyProfile();
  });
  const [draftProfile, setDraftProfile] = useState(() => profile);
  const [interestModalMode, setInterestModalMode] = useState("onboarding"); // "onboarding" | "tune"
  const [showInterestModal, setShowInterestModal] = useState(false);
  const [selectedTopicIds, setSelectedTopicIds] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(profileStorageKey) || "null");
      if (saved && Array.isArray(saved.selectedTopicIds) && saved.selectedTopicIds.length > 0) {
        return saved.selectedTopicIds;
      }
    } catch { }
    return [];
  });
  const [selectedTopicFilter, setSelectedTopicFilter] = useState(null);
  const [feedMode, setFeedMode] = useState("personalized");

  // Saved Inspiration Board
  const [savedIdeas, setSavedIdeas] = useState([]);
  const [showSavedDrawer, setShowSavedDrawer] = useState(false);

  // AI Remix Studio Drawer
  const [remixPost, setRemixPost] = useState(null);
  const [showRemixDrawer, setShowRemixDrawer] = useState(false);

  // Details Bottom Sheet
  const [detailsPost, setDetailsPost] = useState(null);

  // Recent DB Searches for personalization
  const [recentDbSearches, setRecentDbSearches] = useState([]);

  // Total topics count combining user-selected interest topics + unique searched interest topics
  const totalTopicsCount = useMemo(() => {
    const uniqueSearches = recentDbSearches.filter((term) => {
      const lower = term.toLowerCase().replace(/^#/, "");
      return !selectedTopicIds.some((id) => {
        const def = TREND_INTEREST_TOPICS.find((t) => t.id === id);
        return def && (def.id.toLowerCase() === lower || def.label.toLowerCase() === lower);
      });
    }).length;
    return selectedTopicIds.length + uniqueSearches;
  }, [selectedTopicIds, recentDbSearches]);

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

  // Stable refs to eliminate infinite re-render loops in loadPage and effects
  const recentDbSearchesRef = useRef(recentDbSearches);
  recentDbSearchesRef.current = recentDbSearches;
  const selectedTopicIdsRef = useRef(selectedTopicIds);
  selectedTopicIdsRef.current = selectedTopicIds;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const selectedTopicFilterRef = useRef(selectedTopicFilter);
  selectedTopicFilterRef.current = selectedTopicFilter;
  const selectedFormatRef = useRef(selectedFormat);
  selectedFormatRef.current = selectedFormat;
  const selectedNicheRef = useRef(selectedNiche);
  selectedNicheRef.current = selectedNiche;
  const selectedRegionRef = useRef(selectedRegion);
  selectedRegionRef.current = selectedRegion;
  const debouncedSearchRef = useRef(debouncedSearch);
  debouncedSearchRef.current = debouncedSearch;
  const feedModeRef = useRef(feedMode);
  feedModeRef.current = feedMode;
  const loadPageRef = useRef(null);

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
        const cleanProf = {
          work: saved.work || "",
          interests: sanitizeSavedInterests(saved.interests),
          goal: saved.goal || "",
          selectedTopicIds: Array.isArray(saved.selectedTopicIds) ? saved.selectedTopicIds : [],
        };
        if (cleanProf.interests || cleanProf.work || cleanProf.goal) {
          setProfile(cleanProf);
          setDraftProfile(cleanProf);
        }
        if (cleanProf.selectedTopicIds.length > 0) {
          setSelectedTopicIds(cleanProf.selectedTopicIds);
        }
      }
    } catch {
      // ignore
    }

    // Load local storage saved profile & saved ideas
    try {
      const savedIdeasRaw = JSON.parse(localStorage.getItem(savedIdeasStorageKey) || "[]");
      setSavedIdeas(Array.isArray(savedIdeasRaw) ? savedIdeasRaw : []);
    } catch {
      setSavedIdeas([]);
    }
  }, [seenStorageKey, profileStorageKey, savedIdeasStorageKey]);

  // Load user's saved trend preferences & search history strictly for this specific user from Supabase DB
  useEffect(() => {
    let isMounted = true;

    async function loadDbPreferences() {
      try {
        const { data } = await apiClient.get("/api/trends/preferences");
        if (!isMounted || !data?.success) return;

        const dbPrefs = data.preferences;
        const hasDbTopics = Array.isArray(dbPrefs?.selectedTopicIds) && dbPrefs.selectedTopicIds.length > 0;
        const hasDbInterests = hasDbTopics || Boolean(dbPrefs?.interests?.trim());

        if (hasDbInterests) {
          // User HAS saved interests in DB - populate and do not prompt onboarding
          setSelectedTopicIds(dbPrefs.selectedTopicIds || []);
          const dbProfile = {
            work: dbPrefs.work || "",
            interests: sanitizeSavedInterests(dbPrefs.interests || ""),
            goal: dbPrefs.goal || "",
            selectedTopicIds: dbPrefs.selectedTopicIds || [],
            onboarded: true,
          };
          setProfile(dbProfile);
          setDraftProfile(dbProfile);
          try {
            localStorage.setItem(profileStorageKey, JSON.stringify(dbProfile));
            localStorage.setItem(onboardingStorageKey, "true");
            onboardingTriggeredRef.current = true;
          } catch { }
          setShowInterestModal(false);
        } else {
          // DB ME USKA INTEREST KHALI H: Show onboarding modal on page refresh as long as DB interest is empty
          setSelectedTopicIds([]);
          setProfile(emptyProfile());
          setDraftProfile(emptyProfile());
          try {
            localStorage.removeItem(onboardingStorageKey);
            localStorage.removeItem(profileStorageKey);
          } catch { }

          if (!onboardingTriggeredRef.current) {
            onboardingTriggeredRef.current = true;
            const timer = setTimeout(() => {
              if (isMounted) {
                setInterestModalMode("onboarding");
                setShowInterestModal(true);
              }
            }, 300);
            return () => clearTimeout(timer);
          }
        }

        if (Array.isArray(dbPrefs?.recentSearches) && dbPrefs.recentSearches.length > 0) {
          setRecentDbSearches(dbPrefs.recentSearches);
        }
      } catch (err) {
        // Fallback to per-user localStorage check if network / auth fails
        const userLocalOnboarded = localStorage.getItem(onboardingStorageKey);
        if (userLocalOnboarded !== "true" && !onboardingTriggeredRef.current) {
          onboardingTriggeredRef.current = true;
          const timer = setTimeout(() => {
            if (isMounted) {
              setInterestModalMode("onboarding");
              setShowInterestModal(true);
            }
          }, 300);
          return () => clearTimeout(timer);
        }
      }
    }

    if (!authLoading) {
      if (user?.userId || user?.email) {
        loadDbPreferences();
      } else {
        // Anonymous visitor first-time check
        const anonOnboarded = localStorage.getItem(onboardingStorageKey);
        if (anonOnboarded !== "true" && !onboardingTriggeredRef.current) {
          onboardingTriggeredRef.current = true;
          const timer = setTimeout(() => {
            if (isMounted) {
              setInterestModalMode("onboarding");
              setShowInterestModal(true);
            }
          }, 300);
          return () => clearTimeout(timer);
        }
      }
    }

    return () => {
      isMounted = false;
    };
  }, [user?.userId, user?.email, authLoading, profileStorageKey, onboardingStorageKey]);

  // Automatically add search topic to DB, to user's interests, and to active topics rail
  const registerSearchTopic = useCallback((rawQuery) => {
    const term = String(rawQuery || "").trim();
    if (term.length < 2) return;

    const cleanLower = term.toLowerCase().replace(/^#/, "");

    // 1. Check if it matches any predefined registered topic in TREND_INTEREST_TOPICS
    const matched = TREND_INTEREST_TOPICS.find(
      (t) =>
        t.id.toLowerCase() === cleanLower ||
        t.label.toLowerCase() === cleanLower ||
        t.keywords.toLowerCase().includes(cleanLower)
    );

    // If matched, add to selectedTopicIds if not already present
    if (matched) {
      setSelectedTopicIds((prev) => {
        if (prev.includes(matched.id)) return prev;
        const next = [...prev, matched.id];
        try {
          const stored = JSON.parse(localStorage.getItem(profileStorageKey) || "{}");
          stored.selectedTopicIds = next;
          localStorage.setItem(profileStorageKey, JSON.stringify(stored));
        } catch { }
        return next;
      });
    } else {
      // Custom search topic (e.g. Spiderman, Batman) - add to user's interests keywords
      setProfile((prev) => {
        const curList = prev?.interests ? prev.interests.split(",").map((s) => s.trim()).filter(Boolean) : [];
        if (!curList.some((s) => s.toLowerCase() === cleanLower)) {
          const nextInterests = [...curList, term].join(", ");
          const next = { ...prev, interests: nextInterests };
          try {
            const stored = JSON.parse(localStorage.getItem(profileStorageKey) || "{}");
            stored.interests = nextInterests;
            localStorage.setItem(profileStorageKey, JSON.stringify(stored));
          } catch { }
          return next;
        }
        return prev;
      });
    }

    // 2. Add to recent searched topics (avoid prefix fragments)
    setRecentDbSearches((prev) => {
      const filtered = prev.filter(
        (q) =>
          q.toLowerCase() !== term.toLowerCase() &&
          !term.toLowerCase().startsWith(q.toLowerCase()) &&
          !q.toLowerCase().startsWith(term.toLowerCase())
      );
      return [term, ...filtered].slice(0, 10);
    });

    // 3. Save to database (/api/trends/search-history records query in DB and adds to user's interests)
    apiClient
      .post("/api/trends/search-history", { query: term })
      .then((res) => {
        const prefs = res.data?.preferences;
        if (prefs) {
          if (Array.isArray(prefs.selectedTopicIds) && prefs.selectedTopicIds.length > 0) {
            setSelectedTopicIds((prev) => {
              const merged = Array.from(new Set([...prev, ...prefs.selectedTopicIds]));
              try {
                const stored = JSON.parse(localStorage.getItem(profileStorageKey) || "{}");
                stored.selectedTopicIds = merged;
                localStorage.setItem(profileStorageKey, JSON.stringify(stored));
              } catch { }
              return merged;
            });
          }
          if (prefs.interests) {
            setProfile((prev) => {
              const next = { ...prev, interests: prefs.interests };
              try {
                const stored = JSON.parse(localStorage.getItem(profileStorageKey) || "{}");
                stored.interests = prefs.interests;
                localStorage.setItem(profileStorageKey, JSON.stringify(stored));
              } catch { }
              return next;
            });
          }
        }
      })
      .catch(() => { });
  }, [profileStorageKey]);

  // Persist search queries to Supabase database whenever user searches
  useEffect(() => {
    if (debouncedSearch && debouncedSearch.trim().length >= 2) {
      registerSearchTopic(debouncedSearch.trim());
    }
  }, [debouncedSearch, registerSearchTopic]);

  // Load Hot Topics Radar
  const loadHotTopics = useCallback(async (geoParam = null) => {
    try {
      const geo = geoParam || selectedRegionRef.current || "IN";
      const { data } = await apiClient.get("/api/trends/hot-topics", {
        params: { geo },
      });
      if (data.success && Array.isArray(data.hotTopics)) {
        setHotTopics(data.hotTopics);
      }
    } catch (err) {
      console.warn("Hot topics radar error:", err);
    }
  }, []);

  useEffect(() => {
    loadHotTopics(selectedRegion);
  }, [selectedRegion, loadHotTopics]);

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

  // Load page with true infinite pagination (stable callback, reads current filter states safely via refs)
  const loadPage = useCallback(
    async ({
      reset = false,
      overrideProfile = null,
      overrideTopic = undefined,
      overrideMode = null,
      overrideRegion = null,
    } = {}) => {
      if (loadingRef.current || (!reset && exhaustedRef.current)) return;
      if (reset) {
        exhaustedRef.current = false;
        setItems([]);
      }
      loadingRef.current = true;
      setLoading(true);
      setError("");

      const targetPage = reset ? 1 : pageRef.current;
      const targetCursor = reset ? null : cursorRef.current;

      const activeProfile = overrideProfile || profileRef.current;
      const activeTopic = overrideTopic !== undefined ? overrideTopic : selectedTopicFilterRef.current;
      const activeMode = overrideMode || feedModeRef.current;
      const activeFormat = selectedFormatRef.current;
      const activeNiche = selectedNicheRef.current;
      const activeRegion = overrideRegion || selectedRegionRef.current || "IN";
      const activeSearch = debouncedSearchRef.current;

      try {
        const topicIds = activeProfile?.selectedTopicIds || selectedTopicIdsRef.current || [];
        const searches = recentDbSearchesRef.current || [];
        const isPersonalized =
          activeMode === "personalized" && (topicIds.length > 0 || activeProfile?.interests || searches.length > 0);

        const interestQuery = [activeProfile?.work, activeProfile?.interests, activeProfile?.goal]
          .filter(Boolean)
          .join(",");

        const params = {
          limit: PAGE_SIZE,
          page: targetPage,
          cursor: targetCursor || undefined,
          type: activeFormat,
          category: activeNiche,
          region: activeRegion,
          search: activeSearch || undefined,
          seen: Array.from(seenRef.current).slice(-20).join(",") || undefined,
        };

        if (!activeSearch) {
          if (isPersonalized) {
            if (activeTopic) {
              params.topic = activeTopic;
            } else {
              if (topicIds.length > 0) {
                params.topics = topicIds.join(",");
              }
              if (searches.length > 0) {
                params.searches = searches.join(",");
              }
            }
          }
          if (interestQuery) {
            params.interests = interestQuery;
          }
        }

        const { data } = await apiClient.get("/api/trends/feed", { params });

        const nextItems = data.items || [];
        rememberSeen(nextItems);

        if (Array.isArray(data.recentSearches) && data.recentSearches.length > 0) {
          setRecentDbSearches((prev) => {
            const prevStr = prev.join("|");
            const nextStr = data.recentSearches.join("|");
            if (prevStr === nextStr) return prev;
            return Array.from(new Set([...prev, ...data.recentSearches])).slice(0, 10);
          });
        }

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
    [rememberSeen]
  );
  loadPageRef.current = loadPage;

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

  const handleSaveInterests = (nextSelectedTopicIds = selectedTopicIds, updatedProfile = draftProfile) => {
    const customInterests = updatedProfile?.interests?.trim() || "";
    const hasSavedInterests = (Array.isArray(nextSelectedTopicIds) && nextSelectedTopicIds.length > 0) || Boolean(customInterests);

    if (hasSavedInterests) {
      try {
        localStorage.setItem(onboardingStorageKey, "true");
        onboardingTriggeredRef.current = true;
      } catch { }
    } else {
      try {
        localStorage.removeItem(onboardingStorageKey);
      } catch { }
    }

    setSelectedTopicIds(nextSelectedTopicIds);

    const nextProfile = {
      work: updatedProfile?.work?.trim() || "",
      interests: customInterests,
      goal: updatedProfile?.goal?.trim() || "",
      selectedTopicIds: nextSelectedTopicIds,
      onboarded: hasSavedInterests,
    };

    setProfile(nextProfile);
    setDraftProfile(nextProfile);
    setSelectedTopicFilter(null);
    setFeedMode("personalized");
    try {
      localStorage.setItem(profileStorageKey, JSON.stringify(nextProfile));
    } catch {
      // ignore
    }

    // Persist strictly to Supabase for this user
    apiClient
      .post("/api/trends/preferences", nextProfile)
      .catch((err) => console.warn("[TREND-FEED] Could not save preferences to database:", err?.message));

    setShowInterestModal(false);
    toast.success(
      interestModalMode === "tune"
        ? "Tuning saved to database & feed refreshed!"
        : (nextSelectedTopicIds.length > 0
          ? `Saved ${nextSelectedTopicIds.length} topic${nextSelectedTopicIds.length === 1 ? "" : "s"} & personalized feed!`
          : "Preferences saved to database!")
    );
    if (interestModalMode === "tune") {
      seenRef.current = new Set();
      setItems([]);
    }
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
      // Do NOT save permanent onboarding to localStorage on skip
      localStorage.removeItem(onboardingStorageKey);
      onboardingTriggeredRef.current = true;
    } catch {
      // ignore
    }
    // Do NOT post onboarded: true to DB! Keep DB interests empty so next refresh will show modal again
    setShowInterestModal(false);
  };

  const handleCloseModal = () => {
    if (interestModalMode === "onboarding") {
      try {
        // Do NOT save permanent onboarding to localStorage on close without saving
        localStorage.removeItem(onboardingStorageKey);
        onboardingTriggeredRef.current = true;
      } catch { }
      // Do NOT send onboarded: true to DB! Keep DB interests empty so next refresh will show modal again
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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const term = searchQuery.trim();
                if (term) {
                  setDebouncedSearch(term);
                  setSelectedTopicFilter(null);
                  registerSearchTopic(term);
                }
              }
            }}
            placeholder="Search topics, creators, hooks..."
            className="w-full h-8 sm:h-9 pl-8 pr-7 rounded-xl bg-white dark:bg-[#161B22] border border-black/[0.08] dark:border-white/[0.08] text-xs font-normal text-neutral-900 dark:text-white placeholder:text-neutral-400 shadow-sm outline-none focus:border-neutral-400 dark:focus:border-neutral-600 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setDebouncedSearch("");
              }}
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
            <span>{REGION_OPTIONS.find((r) => r.code === selectedRegion)?.flag || "🇮🇳"}</span>
            <span className="hidden md:inline text-xs">
              {REGION_OPTIONS.find((r) => r.code === selectedRegion)?.label || "India"}
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
                        selectedRegionRef.current = r.code;
                        try {
                          localStorage.setItem("qp_trend_region", r.code);
                        } catch { }
                        setRegionOpen(false);
                        seenRef.current = new Set();
                        pageRef.current = 1;
                        cursorRef.current = null;
                        setItems([]);
                        loadHotTopics(r.code);
                        loadPage({ reset: true, overrideRegion: r.code });
                        toast.success(`Country switched to ${r.label}`);
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

        {/* Personalize Interests / Tune Button */}
        <button
          type="button"
          onClick={() => {
            setInterestModalMode("tune");
            setShowInterestModal(true);
          }}
          className="h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl bg-white dark:bg-[#161B22] border border-black/[0.08] dark:border-white/[0.08] hover:bg-neutral-50 dark:hover:bg-neutral-800 text-xs font-medium text-neutral-700 dark:text-neutral-300 shadow-sm inline-flex items-center gap-1 sm:gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          title="Fine-tune keywords, role & topics"
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
            seenRef.current.clear();
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

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-1.5 sm:pt-2">
        {/* Fallback inline header if portal target not mounted */}
        {!headerPortalEl && (
          <header className="mb-2 space-y-2">
            {headerContent}
          </header>
        )}

        {/* 2. UNIFIED COMPACT CREATOR COMMAND BAR: FIXED TABS + ONLY HASHTAGS SCROLLABLE */}
        <div className="rounded-xl bg-white/95 dark:bg-[#161B22]/95 backdrop-blur-md border border-black/[0.07] dark:border-white/[0.08] shadow-xs px-2.5 sm:px-3 py-1.5 sm:py-2 mb-2 sm:mb-2.5">
          <div className="flex items-center gap-2 w-full min-w-0">
            {/* Format / Platform Tabs (Fixed on left, never scrolls off) */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {FORMAT_TABS.map((tab) => {
                const active = selectedFormat === tab.id;
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedFormat(tab.id)}
                    className={`h-7 px-2.5 sm:px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all inline-flex items-center gap-1.5 ${active
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-xs"
                      : "bg-neutral-100/70 hover:bg-neutral-200/80 dark:bg-neutral-800/60 dark:hover:bg-neutral-700/80 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                      }`}
                  >
                    {tab.iconSvg ? (
                      <img src={tab.iconSvg} alt="" className="w-3.5 h-3.5 object-contain flex-shrink-0" />
                    ) : Icon ? (
                      <Icon size={12} className="flex-shrink-0" />
                    ) : null}
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Divider between platform tabs and trending tags */}
            {hotTopics.length > 0 && (
              <span className="w-px h-4 bg-black/10 dark:bg-white/10 flex-shrink-0 mx-0.5" />
            )}

            {/* Hot Topics Section: Fixed Label + ONLY Hashtags Scrollable */}
            {hotTopics.length > 0 && (
              <div className="flex items-center gap-1.5 flex-1 min-w-0 text-xs overflow-hidden">
                {/* Fixed Label without blinking dot */}
                <div className="flex items-center gap-1 flex-shrink-0 text-[10px] font-bold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider pl-0.5 select-none">
                  <Flame size={12} className="text-amber-500 fill-amber-500 flex-shrink-0" />
                  <span className="hidden sm:inline">TRENDING:</span>
                </div>

                {/* ONLY Trending Hashtags Scrollable */}
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 py-0.5">
                  {hotTopics.map((topic, idx) => {
                    const isCurrent = searchQuery.toLowerCase() === topic.query.toLowerCase();
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          if (isCurrent) {
                            setSearchQuery("");
                            setDebouncedSearch("");
                          } else {
                            setSelectedNiche("all");
                            setSelectedTopicFilter(null);
                            setSearchQuery(topic.query);
                            setDebouncedSearch(topic.query);
                            registerSearchTopic(topic.query);
                          }
                        }}
                        className={`h-6.5 px-2.5 rounded-full text-[11px] whitespace-nowrap transition-all border flex items-center gap-1 flex-shrink-0 ${isCurrent
                          ? "bg-amber-500 text-white border-amber-500 font-bold shadow-xs"
                          : "bg-black/[0.02] dark:bg-white/[0.03] border-black/[0.06] dark:border-white/[0.08] text-neutral-600 dark:text-neutral-300 hover:border-amber-500/50 hover:text-amber-600 dark:hover:text-amber-400"
                          }`}
                        title={topic.volume ? `${topic.volume} searches/mentions` : "Live trend"}
                      >
                        <span>#{topic.query}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Search Active Status Banner */}
          {debouncedSearch && (
            <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/30 border border-sky-200/60 dark:border-sky-800/50 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Search size={12} className="text-sky-600 dark:text-sky-400 flex-shrink-0" />
                <span className="text-neutral-600 dark:text-neutral-300 text-[11px]">Searching</span>
                <span className="font-bold text-neutral-900 dark:text-white truncate text-[11px]">"{debouncedSearch}"</span>
                {items.length > 0 && (
                  <span className="text-[10px] font-semibold text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                    • {items.length} results
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setDebouncedSearch("");
                }}
                className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 hover:underline px-1.5 py-0.5 transition-colors flex-shrink-0 cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}
        </div>

        {/* 2B. USER'S CURATED & SEARCHED TOPICS RAIL */}
        {totalTopicsCount > 0 && (
          <div className="rounded-xl bg-white/95 dark:bg-[#161B22]/95 backdrop-blur-md border border-black/[0.07] dark:border-white/[0.08] shadow-xs px-2.5 sm:px-3 py-1.5 mb-2 sm:mb-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              {/* All Topics Combined Pill */}
              <button
                type="button"
                onClick={() => {
                  setSelectedTopicFilter(null);
                  if (debouncedSearch) {
                    setSearchQuery("");
                    setDebouncedSearch("");
                  }
                }}
                className={`h-7 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all inline-flex items-center gap-1.5 flex-shrink-0 cursor-pointer ${
                  selectedTopicFilter === null && !debouncedSearch
                    ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 shadow-xs"
                    : "bg-neutral-100/70 hover:bg-neutral-200/80 dark:bg-neutral-800/60 dark:hover:bg-neutral-700/80 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                }`}
              >
                <Sparkles size={11} className={selectedTopicFilter === null && !debouncedSearch ? "text-amber-400 fill-amber-400" : "text-neutral-400"} />
                <span>All My Topics ({totalTopicsCount})</span>
              </button>

              {/* Selected Onboarding Topics */}
              {selectedTopicIds.map((topicId) => {
                const topicDef = TREND_INTEREST_TOPICS.find((t) => t.id === topicId);
                if (!topicDef) return null;
                const isSelected = selectedTopicFilter === topicId;
                return (
                  <button
                    key={topicId}
                    type="button"
                    onClick={() => {
                      const next = isSelected ? null : topicId;
                      setSelectedTopicFilter(next);
                      if (debouncedSearch) {
                        setSearchQuery("");
                        setDebouncedSearch("");
                      }
                    }}
                    className={`h-7 px-2.5 sm:px-3 rounded-lg text-xs font-medium whitespace-nowrap transition-all inline-flex items-center gap-1.5 flex-shrink-0 border cursor-pointer ${
                      isSelected
                        ? "bg-sky-600 text-white border-sky-600 font-bold shadow-xs"
                        : "bg-neutral-100/70 hover:bg-neutral-200/80 dark:bg-neutral-800/60 dark:hover:bg-neutral-700/80 text-neutral-700 dark:text-neutral-300 border-black/[0.04] dark:border-white/[0.06]"
                    }`}
                  >
                    <span>{topicDef.emoji}</span>
                    <span>{topicDef.label}</span>
                  </button>
                );
              })}

              {/* Searched Topics (Auto Added-On!) */}
              {recentDbSearches.map((term) => {
                const isCurrentSearch = debouncedSearch.toLowerCase() === term.toLowerCase();
                return (
                  <div
                    key={term}
                    className={`h-7 pl-2.5 pr-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all inline-flex items-center gap-1 flex-shrink-0 border ${
                      isCurrentSearch
                        ? "bg-amber-500 text-white border-amber-500 font-bold shadow-xs"
                        : "bg-neutral-100/70 hover:bg-neutral-200/80 dark:bg-neutral-800/60 dark:hover:bg-neutral-700/80 text-neutral-700 dark:text-neutral-300 border-black/[0.04] dark:border-white/[0.06]"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isCurrentSearch) {
                          setSearchQuery("");
                          setDebouncedSearch("");
                        } else {
                          setSelectedTopicFilter(null);
                          setSearchQuery(term);
                          setDebouncedSearch(term);
                        }
                      }}
                      className="inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Search size={10} className={isCurrentSearch ? "text-white" : "text-amber-500"} />
                      <span>{term}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRecentDbSearches((prev) => prev.filter((q) => q !== term));
                        apiClient.delete("/api/trends/search-history", { data: { query: term } }).catch(() => { });
                        if (debouncedSearch.toLowerCase() === term.toLowerCase()) {
                          setSearchQuery("");
                          setDebouncedSearch("");
                        }
                      }}
                      className="p-0.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-md transition-colors cursor-pointer text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
                      title={`Remove "${term}"`}
                    >
                      <X size={10} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
        ) : items.length === 0 && !loading ? (
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
          /* Pure Equal-Distribution Multi-Column Pinterest Waterfall */
          <div className="flex w-full gap-4 sm:gap-5 items-start">
            {columns.map((colItems, colIdx) => (
              <div key={colIdx} className="flex-1 min-w-0 flex flex-col gap-4 sm:gap-5">
                {colItems.map((post) => (
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

                {/* Skeletons distributed simultaneously in all columns while loading */}
                {loading && (
                  <>
                    <TrendCardSkeleton
                      heightClass={SKELETON_HEIGHTS[(colIdx * 2) % SKELETON_HEIGHTS.length]}
                    />
                    <TrendCardSkeleton
                      heightClass={SKELETON_HEIGHTS[(colIdx * 2 + 1) % SKELETON_HEIGHTS.length]}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 4. INFINITE SCROLL SENTINEL WITH SUBTLE STATUS */}
        <div ref={sentinelRef} className="min-h-[50px] flex items-center justify-center my-4 w-full">
          {loading && (
            <div className="flex items-center gap-2 py-2 select-none pointer-events-none">
              <motion.span
                animate={{ scale: [0.75, 1.25, 0.75], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: 0, ease: "easeInOut" }}
                className="w-2.5 h-2.5 rounded-full bg-[#FF5600] shadow-[0_1px_6px_rgba(255,86,0,0.45)]"
              />
              <motion.span
                animate={{ scale: [0.75, 1.25, 0.75], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: 0.2, ease: "easeInOut" }}
                className="w-2.5 h-2.5 rounded-full bg-neutral-900 dark:bg-white shadow-[0_1px_4px_rgba(0,0,0,0.15)]"
              />
              <motion.span
                animate={{ scale: [0.75, 1.25, 0.75], opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 0.9, repeat: Infinity, delay: 0.4, ease: "easeInOut" }}
                className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_1px_6px_rgba(245,158,11,0.45)]"
              />
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
        onPostCreated={() => {
          seenRef.current.clear();
          pageRef.current = 1;
          cursorRef.current = null;
          loadPageRef.current && loadPageRef.current({ reset: true });
        }}
      />

      {/* 9. ATTRACTIVE ONBOARDING & TUNE MODAL */}
      <AnimatePresence>
        {showInterestModal && (
          <CreatorInterestModal
            isOpen={showInterestModal}
            mode={interestModalMode}
            initialTopicIds={selectedTopicIds}
            initialProfile={draftProfile}
            onSave={handleSaveInterests}
            onSkip={handleSkipInterests}
            onClose={handleCloseModal}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
