/**
 * Canonical Trend Topics Registry & Personalization Helper
 * Maps user interest selections to high-yield search terms, platforms, and relevance keywords.
 */

export const TREND_TOPIC_REGISTRY = [
  // 1. Tech & AI
  {
    id: "ai_chatgpt",
    label: "AI & ChatGPT",
    emoji: "🤖",
    category: "Tech & AI",
    searchQuery: "AI ChatGPT artificial intelligence LLM",
    keywords: ["ai", "chatgpt", "llm", "artificial intelligence", "claude", "midjourney", "prompt", "openai", "generative ai"],
    youtubeCategory: "28",
    subCategory: "tech_ai",
  },
  {
    id: "tech_gadgets",
    label: "Tech & Gadgets",
    emoji: "⚡",
    category: "Tech & AI",
    searchQuery: "tech gadgets smartphone setup hardware",
    keywords: ["tech", "gadgets", "apple", "smartphone", "setup", "hardware", "devices", "desk setup"],
    youtubeCategory: "28",
    subCategory: "tech_ai",
  },
  {
    id: "coding_dev",
    label: "Coding & Software",
    emoji: "💻",
    category: "Tech & AI",
    searchQuery: "coding programmer developer software webdev",
    keywords: ["coding", "programmer", "developer", "software", "web development", "python", "javascript", "code", "github"],
    youtubeCategory: "28",
    subCategory: "tech_ai",
  },
  {
    id: "science_space",
    label: "Future & Space",
    emoji: "🚀",
    category: "Tech & AI",
    searchQuery: "space astronomy astrophysics science future",
    keywords: ["science", "future", "space", "astrophysics", "robotics", "astronomy", "nasa", "spacex"],
    youtubeCategory: "28",
    subCategory: "science_space",
  },
  {
    id: "robotics_hardware",
    label: "Robotics & Hardware",
    emoji: "🦾",
    category: "Tech & AI",
    searchQuery: "robotics hardware engineering automation drones",
    keywords: ["robotics", "hardware", "engineering", "arduino", "raspberry pi", "drones", "automation", "sensors"],
    youtubeCategory: "28",
    subCategory: "tech_ai",
  },
  {
    id: "cybersecurity_privacy",
    label: "Cyber & Security",
    emoji: "🛡️",
    category: "Tech & AI",
    searchQuery: "cybersecurity ethical hacking security privacy",
    keywords: ["cybersecurity", "hacking", "security", "privacy", "encryption", "infosec", "ethical hacking", "malware"],
    youtubeCategory: "28",
    subCategory: "tech_ai",
  },
  {
    id: "apple_ecosystem",
    label: "Apple Ecosystem",
    emoji: "🍎",
    category: "Tech & AI",
    searchQuery: "apple iphone macbook ios ipad macos",
    keywords: ["apple", "iphone", "macbook", "ios", "ipad", "apple watch", "macos", "airpods", "tim cook"],
    youtubeCategory: "28",
    subCategory: "tech_ai",
  },
  {
    id: "crypto_bitcoin",
    label: "Crypto & Bitcoin",
    emoji: "🪙",
    category: "Tech & AI",
    searchQuery: "crypto bitcoin ethereum web3 solana",
    keywords: ["crypto", "bitcoin", "ethereum", "blockchain", "web3", "solana", "crypto news", "defi"],
    youtubeCategory: "27",
    subCategory: "business_finance",
  },

  // 2. Business & Wealth
  {
    id: "startups_saas",
    label: "Startups & SaaS",
    emoji: "🏢",
    category: "Business & Wealth",
    searchQuery: "startups saas founder entrepreneurship building in public",
    keywords: ["startups", "saas", "founder", "indie hacker", "entrepreneurship", "building in public", "business"],
    youtubeCategory: "27",
    subCategory: "business_finance",
  },
  {
    id: "marketing_growth",
    label: "Marketing & Growth",
    emoji: "📈",
    category: "Business & Wealth",
    searchQuery: "marketing growth seo copywriting sales advertising",
    keywords: ["marketing", "growth", "seo", "copywriting", "sales", "advertising", "branding", "funnel", "viral growth"],
    youtubeCategory: "27",
    subCategory: "business_finance",
  },
  {
    id: "finance_stocks",
    label: "Investing & Stocks",
    emoji: "💵",
    category: "Business & Wealth",
    searchQuery: "investing stocks wealth portfolio market finance",
    keywords: ["investing", "stocks", "wealth", "portfolio", "passive income", "market", "etf", "finance", "dividends"],
    youtubeCategory: "27",
    subCategory: "business_finance",
  },
  {
    id: "real_estate",
    label: "Real Estate & Homes",
    emoji: "🏠",
    category: "Business & Wealth",
    searchQuery: "real estate property housing architecture investing",
    keywords: ["real estate", "property", "housing", "architecture", "rental properties", "real estate investing", "mortgage"],
    youtubeCategory: "27",
    subCategory: "business_finance",
  },
  {
    id: "ecommerce_dropship",
    label: "E-Commerce & Brands",
    emoji: "🛍️",
    category: "Business & Wealth",
    searchQuery: "ecommerce shopify dropshipping amazon fba retail",
    keywords: ["ecommerce", "shopify", "amazon fba", "dropshipping", "direct to consumer", "retail", "store"],
    youtubeCategory: "27",
    subCategory: "business_finance",
  },
  {
    id: "creator_economy",
    label: "Creator Economy",
    emoji: "📱",
    category: "Business & Wealth",
    searchQuery: "creator economy monetization youtube growth viral hooks",
    keywords: ["creator", "monetization", "youtube growth", "hooks", "editing", "viral", "content creator", "sponsorships"],
    youtubeCategory: "24",
    subCategory: "marketing_creators",
  },
  {
    id: "side_hustles",
    label: "Side Hustles & Wealth",
    emoji: "💼",
    category: "Business & Wealth",
    searchQuery: "side hustle passive income solopreneur freelancing",
    keywords: ["side hustle", "passive income", "make money online", "freelancing", "solopreneur", "work from home"],
    youtubeCategory: "27",
    subCategory: "business_finance",
  },
  {
    id: "business_strategy",
    label: "Business Strategy",
    emoji: "📊",
    category: "Business & Wealth",
    searchQuery: "business strategy economics case studies venture capital",
    keywords: ["business strategy", "economics", "case studies", "corporate", "management", "venture capital", "market analysis"],
    youtubeCategory: "27",
    subCategory: "business_finance",
  },

  // 3. Creative & Media
  {
    id: "reels_video",
    label: "Reels & Short Video",
    emoji: "🎥",
    category: "Creative & Media",
    searchQuery: "reels short video capcut editing cinematography",
    keywords: ["video editing", "reels", "tiktok", "capcut", "cinematography", "shortform", "broll", "viral video"],
    youtubeCategory: "24",
    subCategory: "marketing_creators",
  },
  {
    id: "video_editing_vfx",
    label: "Video Editing & VFX",
    emoji: "🎬",
    category: "Creative & Media",
    searchQuery: "video editing vfx premiere pro after effects davinci",
    keywords: ["premiere pro", "after effects", "davinci resolve", "vfx", "color grading", "sound design", "transitions"],
    youtubeCategory: "24",
    subCategory: "design_art",
  },
  {
    id: "design_3d",
    label: "Design & 3D Art",
    emoji: "🎨",
    category: "Creative & Media",
    searchQuery: "graphic design ui ux 3d blender architecture figma",
    keywords: ["design", "ui", "ux", "3d", "blender", "graphic design", "animation", "typography", "visual design", "figma"],
    youtubeCategory: "26",
    subCategory: "design_art",
  },
  {
    id: "photography_gear",
    label: "Photo & Cameras",
    emoji: "📸",
    category: "Creative & Media",
    searchQuery: "photography camera lighting portraits cinematic sony canon",
    keywords: ["photography", "camera", "lighting", "portraits", "photographer", "cinematic photo", "sony", "canon", "camera lens"],
    youtubeCategory: "26",
    subCategory: "design_art",
  },
  {
    id: "architecture_interiors",
    label: "Interior & Architecture",
    emoji: "🏛️",
    category: "Creative & Media",
    searchQuery: "architecture interior design modern home room decor",
    keywords: ["architecture", "interior design", "home decor", "modern home", "minimal living", "architect", "floor plan"],
    youtubeCategory: "26",
    subCategory: "design_art",
  },
  {
    id: "typography_branding",
    label: "Branding & Logos",
    emoji: "✒️",
    category: "Creative & Media",
    searchQuery: "branding logos typography visual identity aesthetic fonts",
    keywords: ["branding", "logos", "typography", "visual identity", "poster design", "aesthetic fonts", "creative director"],
    youtubeCategory: "26",
    subCategory: "design_art",
  },
  {
    id: "animation_motion",
    label: "Motion & Animation",
    emoji: "✨",
    category: "Creative & Media",
    searchQuery: "motion graphics animation 2d animation cgi motion design",
    keywords: ["animation", "motion graphics", "2d animation", "stop motion", "anime aesthetic", "cgi", "motion design"],
    youtubeCategory: "24",
    subCategory: "design_art",
  },
  {
    id: "filmmaking_cinema",
    label: "Filmmaking & Directing",
    emoji: "🎞️",
    category: "Creative & Media",
    searchQuery: "filmmaking cinematography indie film directing screenwriting",
    keywords: ["filmmaking", "director", "cinematography", "indie film", "screenwriting", "camera gear", "movie scenes"],
    youtubeCategory: "24",
    subCategory: "entertainment",
  },

  // 4. Lifestyle & Health
  {
    id: "fitness_gym",
    label: "Fitness & Gym",
    emoji: "🏋️",
    category: "Lifestyle & Health",
    searchQuery: "fitness gym workout bodybuilding training lifting",
    keywords: ["fitness", "gym", "workout", "muscle", "bodybuilding", "health", "training", "nutrition", "lifting"],
    youtubeCategory: "17",
    subCategory: "health_fitness",
  },
  {
    id: "running_cardio",
    label: "Running & Cardio",
    emoji: "🏃",
    category: "Lifestyle & Health",
    searchQuery: "running marathon sprint cardio endurance runner",
    keywords: ["running", "marathon", "sprint", "cardio", "endurance", "trail running", "athletics", "runner"],
    youtubeCategory: "17",
    subCategory: "health_fitness",
  },
  {
    id: "yoga_mindfulness",
    label: "Yoga & Mindfulness",
    emoji: "🧘",
    category: "Lifestyle & Health",
    searchQuery: "yoga meditation mindfulness breathing mental health",
    keywords: ["yoga", "meditation", "mindfulness", "breathing", "flexibility", "calm", "mental health", "zen"],
    youtubeCategory: "26",
    subCategory: "health_fitness",
  },
  {
    id: "nutrition_mealprep",
    label: "Nutrition & Diet",
    emoji: "🥗",
    category: "Lifestyle & Health",
    searchQuery: "nutrition healthy food meal prep clean eating macros",
    keywords: ["nutrition", "healthy food", "meal prep", "high protein", "clean eating", "diet", "macros", "vitamins"],
    youtubeCategory: "26",
    subCategory: "health_fitness",
  },
  {
    id: "biohacking_sleep",
    label: "Biohacking & Sleep",
    emoji: "🧬",
    category: "Lifestyle & Health",
    searchQuery: "biohacking sleep optimization longevity recovery cold plunge",
    keywords: ["biohacking", "sleep optimization", "longevity", "recovery", "cold plunge", "sauna", "circadian rhythm"],
    youtubeCategory: "28",
    subCategory: "health_fitness",
  },
  {
    id: "productivity_habits",
    label: "Productivity & Focus",
    emoji: "💡",
    category: "Lifestyle & Health",
    searchQuery: "productivity habits focus notion routine systems deep work",
    keywords: ["productivity", "habits", "focus", "notion", "daily routine", "systems", "deep work", "time management"],
    youtubeCategory: "27",
    subCategory: "health_fitness",
  },
  {
    id: "mindset_selfhelp",
    label: "Mindset & Motivation",
    emoji: "🧠",
    category: "Lifestyle & Health",
    searchQuery: "mindset motivation discipline psychology self improvement stoicism",
    keywords: ["motivation", "discipline", "psychology", "mindset", "self improvement", "stoicism", "mental toughness"],
    youtubeCategory: "27",
    subCategory: "health_fitness",
  },
  {
    id: "books_learning",
    label: "Books & Knowledge",
    emoji: "📚",
    category: "Lifestyle & Health",
    searchQuery: "books reading book recommendations learning philosophy",
    keywords: ["books", "reading", "non fiction", "book recommendations", "learning", "philosophy", "summary"],
    youtubeCategory: "27",
    subCategory: "entertainment",
  },
  {
    id: "skincare_beauty",
    label: "Skincare & Self-Care",
    emoji: "✨",
    category: "Lifestyle & Health",
    searchQuery: "skincare beauty grooming morning routine self care glow",
    keywords: ["skincare", "beauty", "grooming", "morning routine", "dermatologists", "glow", "self care"],
    youtubeCategory: "26",
    subCategory: "fashion",
  },

  // 5. Travel, Food & Style
  {
    id: "travel_nomad",
    label: "Travel & Nomad",
    emoji: "✈️",
    category: "Travel & Culture",
    searchQuery: "travel nomad adventure explore destinations vacation",
    keywords: ["travel", "nomad", "adventure", "explore", "destinations", "vacation", "digital nomad", "wanderlust"],
    youtubeCategory: "19",
    subCategory: "travel",
  },
  {
    id: "luxury_hiddenplaces",
    label: "Luxury Escapes",
    emoji: "🏝️",
    category: "Travel & Culture",
    searchQuery: "luxury travel hidden gems scenic resorts vacation",
    keywords: ["luxury travel", "hidden gems", "resorts", "islands", "hotels", "first class", "scenic views"],
    youtubeCategory: "19",
    subCategory: "travel",
  },
  {
    id: "food_cooking",
    label: "Food & Recipes",
    emoji: "🍔",
    category: "Travel & Culture",
    searchQuery: "food recipes cooking streetfood baking chef gourmet",
    keywords: ["food", "cooking", "recipes", "street food", "baking", "chef", "restaurant", "meal prep", "gourmet"],
    youtubeCategory: "26",
    subCategory: "food",
  },
  {
    id: "coffee_drinks",
    label: "Specialty Coffee",
    emoji: "☕",
    category: "Travel & Culture",
    searchQuery: "coffee espresso latte art cafe barista pour over",
    keywords: ["coffee", "espresso", "latte art", "cafe", "barista", "pour over", "cocktails", "matchalatte"],
    youtubeCategory: "26",
    subCategory: "food",
  },
  {
    id: "fashion_style",
    label: "Fashion & Streetwear",
    emoji: "👟",
    category: "Travel & Culture",
    searchQuery: "fashion streetwear outfits styling luxury drip lookbook",
    keywords: ["fashion", "streetwear", "outfits", "styling", "sneakers", "luxury", "drip", "lookbook"],
    youtubeCategory: "26",
    subCategory: "fashion",
  },
  {
    id: "sneakerhead_drops",
    label: "Sneakers & Kicks",
    emoji: "🔥",
    category: "Travel & Culture",
    searchQuery: "sneakers sneakerhead jordan nike yeezy kicks unboxing",
    keywords: ["sneakers", "sneakerhead", "jordan", "nike", "yeezy", "kicks", "unboxing", "sneaker collection"],
    youtubeCategory: "26",
    subCategory: "fashion",
  },
  {
    id: "gardening_plants",
    label: "Plants & Gardening",
    emoji: "🌿",
    category: "Travel & Culture",
    searchQuery: "gardening house plants urban garden botany nature",
    keywords: ["gardening", "house plants", "urban garden", "botany", "nature", "plant care", "balcony garden"],
    youtubeCategory: "26",
    subCategory: "design_art",
  },
  {
    id: "diy_crafting",
    label: "DIY & Woodworking",
    emoji: "🔨",
    category: "Travel & Culture",
    searchQuery: "diy woodworking carpentry crafting handmade workshop",
    keywords: ["diy", "woodworking", "carpentry", "crafting", "handmade", "restoration", "maker", "workshop"],
    youtubeCategory: "26",
    subCategory: "design_art",
  },

  // 6. Entertainment & Pop
  {
    id: "gaming_stream",
    label: "Gaming & Esports",
    emoji: "🎮",
    category: "Entertainment",
    searchQuery: "gaming gta playstation twitch steam esports xbox gameplay",
    keywords: ["gaming", "gta", "playstation", "twitch", "steam", "esports", "xbox", "pc gaming", "gameplay"],
    youtubeCategory: "20",
    subCategory: "gaming",
  },
  {
    id: "retro_nintendo",
    label: "Retro & Nintendo",
    emoji: "👾",
    category: "Entertainment",
    searchQuery: "retro gaming nintendo zelda pokemon mario gameboy",
    keywords: ["retro gaming", "nintendo", "zelda", "pokemon", "mario", "game boy", "arcade", "nostalgic gaming"],
    youtubeCategory: "20",
    subCategory: "gaming",
  },
  {
    id: "cinema_movies",
    label: "Cinema & TV Shows",
    emoji: "🍿",
    category: "Entertainment",
    searchQuery: "movies cinema trailer series netflix hollywood film",
    keywords: ["movies", "cinema", "trailer", "series", "netflix", "hollywood", "film", "box office", "actors"],
    youtubeCategory: "24",
    subCategory: "entertainment",
  },
  {
    id: "anime_manga",
    label: "Anime & Manga",
    emoji: "⛩️",
    category: "Entertainment",
    searchQuery: "anime manga animation japan otaku cosplay shonen",
    keywords: ["anime", "manga", "animation", "japan", "otaku", "cosplay", "shonen", "studio ghibli"],
    youtubeCategory: "24",
    subCategory: "entertainment",
  },
  {
    id: "comedy_memes",
    label: "Comedy & Memes",
    emoji: "😂",
    category: "Entertainment",
    searchQuery: "comedy memes jokes funny skits relatable humor",
    keywords: ["comedy", "memes", "jokes", "funny", "skits", "relatable", "humor", "viral jokes", "laugh"],
    youtubeCategory: "24",
    subCategory: "entertainment",
  },
  {
    id: "music_audio",
    label: "Music & Viral Audio",
    emoji: "🎵",
    category: "Entertainment",
    searchQuery: "music beats trending audio sound artists live concert",
    keywords: ["music", "beats", "trending audio", "sound", "artists", "live music", "new album", "concert"],
    youtubeCategory: "10",
    subCategory: "entertainment",
  },
  {
    id: "hiphop_beats",
    label: "Hip Hop & Beatmaking",
    emoji: "🎧",
    category: "Entertainment",
    searchQuery: "hip hop rap beatmaker fl studio producer instrumentals",
    keywords: ["hip hop", "rap", "beatmaker", "fl studio", "producer", "instrumentals", "trap", "sampling"],
    youtubeCategory: "10",
    subCategory: "entertainment",
  },
  {
    id: "podcasts_talks",
    label: "Podcasts & Interviews",
    emoji: "🎙️",
    category: "Entertainment",
    searchQuery: "podcasts interview conversation creator talks deep dive",
    keywords: ["podcasts", "interview", "conversation", "longform", "creator talks", "speech", "discussion"],
    youtubeCategory: "24",
    subCategory: "entertainment",
  },
  {
    id: "cars_supercars",
    label: "Supercars & Racing",
    emoji: "🏎️",
    category: "Entertainment",
    searchQuery: "cars supercars automotive racing f1 vehicles tuning",
    keywords: ["cars", "supercars", "automotive", "racing", "f1", "vehicles", "tuning", "ferrari", "porsche"],
    youtubeCategory: "2",
    subCategory: "entertainment",
  },
  {
    id: "motorcycles_biker",
    label: "Motorcycles & Moto",
    emoji: "🏍️",
    category: "Entertainment",
    searchQuery: "motorcycles biker moto cafe racer ducati superbike",
    keywords: ["motorcycles", "biker", "moto", "cafe racer", "harley", "ducati", "superbike", "riding"],
    youtubeCategory: "2",
    subCategory: "entertainment",
  },
  {
    id: "history_lore",
    label: "History & Lore",
    emoji: "📜",
    category: "Entertainment",
    searchQuery: "history ancient warfare mythology deep lore historical",
    keywords: ["history", "ancient history", "mythology", "warfare", "historical facts", "deep lore", "empires"],
    youtubeCategory: "27",
    subCategory: "entertainment",
  },
  {
    id: "pets_cuteanimals",
    label: "Cute Pets & Animals",
    emoji: "🐾",
    category: "Entertainment",
    searchQuery: "pets dogs cats puppies kittens cute animals wildlife",
    keywords: ["pets", "dogs", "cats", "puppies", "kittens", "cute animals", "wildlife", "pet memes"],
    youtubeCategory: "15",
    subCategory: "entertainment",
  },
  {
    id: "nature_exploration",
    label: "Nature & Wildlife",
    emoji: "🌲",
    category: "Entertainment",
    searchQuery: "nature wildlife ocean deep sea national parks planet",
    keywords: ["nature", "wildlife", "ocean", "deep sea", "national parks", "animals", "documentary", "planet"],
    youtubeCategory: "15",
    subCategory: "science_space",
  },
];

export const TOPIC_MAP = new Map(
  TREND_TOPIC_REGISTRY.map((topic) => [topic.id, topic])
);

/**
 * Find topic by ID or fuzzy name
 */
export function getTopicDefinition(idOrName) {
  if (!idOrName) return null;
  const clean = String(idOrName).trim().toLowerCase();
  if (TOPIC_MAP.has(clean)) return TOPIC_MAP.get(clean);

  return (
    TREND_TOPIC_REGISTRY.find(
      (t) =>
        t.label.toLowerCase() === clean ||
        t.id.toLowerCase() === clean ||
        t.keywords.some((kw) => kw === clean)
    ) || null
  );
}

/**
 * Resolve target topics, search queries, and relevance keywords from request parameters & DB profile
 */
export function resolveTargetTopics({ topics = "", topic = "", interests = "", recentSearches = [] } = {}) {
  const targetTopics = [];
  const searchQueries = [];
  const keywordSet = new Set();

  // 1. Single active topic filter
  if (topic && String(topic).trim()) {
    const single = getTopicDefinition(topic);
    if (single) {
      targetTopics.push(single);
      searchQueries.push(single.searchQuery);
      single.keywords.forEach((k) => keywordSet.add(k));
    } else {
      searchQueries.push(String(topic).trim());
      keywordSet.add(String(topic).trim().toLowerCase());
    }
    return {
      targetTopics,
      searchQueries,
      keywords: Array.from(keywordSet),
      isFilteredToSingleTopic: true,
      activeTopic: targetTopics[0] || null,
    };
  }

  // 2. Comma-separated topic IDs or labels
  if (topics && String(topics).trim()) {
    const rawTokens = String(topics)
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    for (const token of rawTokens) {
      const def = getTopicDefinition(token);
      if (def && !targetTopics.some((t) => t.id === def.id)) {
        targetTopics.push(def);
        searchQueries.push(def.searchQuery);
        def.keywords.forEach((k) => keywordSet.add(k));
      } else if (!def && token.length > 2) {
        searchQueries.push(token);
        keywordSet.add(token.toLowerCase());
      }
    }
  }

  // 3. Explicit Tuned Keywords & Interests from "Tune Feed" modal (work role, custom keywords, formats)
  const tunedTopics = [];
  const formatWords = new Set(["reel", "reels", "short", "shorts", "carousel", "carousels", "thread", "threads", "video", "videos", "post", "posts", "30s"]);

  if (interests && String(interests).trim()) {
    const rawInterests = String(interests)
      .split(",")
      .map((i) => i.trim())
      .filter((i) => i.length > 1);

    for (const item of rawInterests) {
      const cleanItem = item.trim();
      const lower = cleanItem.toLowerCase();
      // If it's a pure format word, record it for format boosts
      if (formatWords.has(lower)) {
        keywordSet.add(lower);
        continue;
      }

      const def = getTopicDefinition(cleanItem);
      if (def && !tunedTopics.some((t) => t.id === def.id)) {
        tunedTopics.push(def);
        def.keywords.forEach((k) => keywordSet.add(k));
      } else if (!def && cleanItem.length > 1) {
        // Build first-class custom topic definition for user's explicit tuned keyword (e.g. "spiderman")
        const slug = lower.replace(/[^a-z0-9]+/g, "_").slice(0, 36);
        const tokens = lower
          .split(/\s+/)
          .filter((w) => w.length > 2 && !["the", "for", "and", "with", "all"].includes(w));

        const customDef = {
          id: `tuned_${slug}`,
          label: cleanItem,
          searchQuery: cleanItem,
          keywords: Array.from(new Set([lower, ...tokens])),
          emoji: "🎯",
          subCategory: "all",
          isTunedKeyword: true,
        };

        if (!tunedTopics.some((t) => t.id === customDef.id || t.label.toLowerCase() === lower)) {
          tunedTopics.push(customDef);
        }
        customDef.keywords.forEach((k) => keywordSet.add(k));
      }
    }

    // Place tuned topics in original entered order at the VERY FRONT of targetTopics and searchQueries
    for (let i = tunedTopics.length - 1; i >= 0; i--) {
      const t = tunedTopics[i];
      if (!targetTopics.some((existing) => existing.id === t.id)) {
        targetTopics.unshift(t);
      }
      if (!searchQueries.includes(t.searchQuery)) {
        searchQueries.unshift(t.searchQuery);
      }
    }
  }

  // 4. Incorporate recent search queries from database to personalize feed to user's latest interests
  if (Array.isArray(recentSearches) && recentSearches.length > 0) {
    for (const s of recentSearches.slice(0, 8)) {
      const cleanS = String(s || "").trim();
      if (cleanS.length > 1) {
        if (!searchQueries.includes(cleanS)) {
          searchQueries.push(cleanS);
        }
        // If it matches a predefined topic, ensure it is added to targetTopics
        const def = getTopicDefinition(cleanS);
        if (def && !targetTopics.some((t) => t.id === def.id)) {
          targetTopics.push(def);
          def.keywords.forEach((k) => keywordSet.add(k));
        }
        // Extract meaningful search tokens for keyword scoring
        cleanS
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 1 && !["the", "for", "and", "with", "how"].includes(w))
          .forEach((w) => keywordSet.add(w));
      }
    }
  }

  return {
    targetTopics,
    tunedTopics,
    searchQueries: searchQueries.slice(0, 10),
    keywords: Array.from(keywordSet),
    isFilteredToSingleTopic: false,
    activeTopic: null,
  };
}

/**
 * Generate high-yield Pinterest search query for a topic definition.
 * Pinterest BaseSearchResource works best with 1-2 punchy visual keywords.
 */
export function getPinterestTopicQuery(topicDef) {
  if (!topicDef) return "";
  if (topicDef.pinterestQuery) return topicDef.pinterestQuery;

  // Filter out multi-word or overly generic keywords, pick top 1-2 single words
  const singleWords = (topicDef.keywords || [])
    .filter((k) => !k.includes(" ") && k.length > 3)
    .slice(0, 2);

  if (singleWords.length > 0) {
    return singleWords.join(" ");
  }

  // Fallback: take first 2 clean words from label
  return topicDef.label
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && w.toLowerCase() !== "and")
    .slice(0, 2)
    .join(" ");
}

/**
 * Generate high-yield Bluesky search query for a topic definition.
 * Bluesky searchPosts works best with boolean OR syntax between top terms.
 */
export function getBlueskyTopicQuery(topicDef) {
  if (!topicDef) return "";
  if (topicDef.blueskyQuery) return topicDef.blueskyQuery;

  const topKeywords = (topicDef.keywords || []).slice(0, 3);
  if (topKeywords.length > 0) {
    return topKeywords
      .map((k) => (k.includes(" ") ? `"${k}"` : k))
      .join(" OR ");
  }

  return topicDef.label;
}

/**
 * Check if a post/pin content is genuinely relevant to a topic definition
 */
export function isItemRelevantToTopic(item, topicDef) {
  if (!item || !topicDef) return false;

  const targetLabel = (topicDef.label || "").toLowerCase().replace(/^#/, "").trim();
  const targetId = (topicDef.id || "").toLowerCase().trim();

  // If item is already explicitly tagged as this topic from a direct topic query
  if (item.matched_topic) {
    const itemLabel = item.matched_topic.toLowerCase().replace(/^#/, "").trim();
    if (itemLabel === targetLabel) return true;
  }
  if (item.interest_topic) {
    const itemId = String(item.interest_topic).toLowerCase().trim();
    if (itemId === targetId) return true;
  }

  const title = (item.title || "").toLowerCase();
  const caption = (item.caption || item.text || "").toLowerCase();
  const tags = Array.isArray(item.niche_tags) ? item.niche_tags.join(" ").toLowerCase() : "";
  const combined = `${title} ${caption} ${tags}`.trim();
  if (!combined) return false;

  // 1. Direct label match
  if (targetLabel.length >= 2 && combined.includes(targetLabel)) return true;

  // 2. Meaningful words in label (length > 2, exclude generic stop words)
  const stopWords = new Set(["and", "the", "for", "with", "from", "video", "shorts", "trend", "trending", "viral"]);
  const labelWords = targetLabel
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
  for (const w of labelWords) {
    if (combined.includes(w)) return true;
  }

  // 3. Keywords in topic
  for (const kw of topicDef.keywords || []) {
    const k = kw.toLowerCase().trim();
    if (k.length > 2 && combined.includes(k)) {
      return true;
    }
  }

  // 4. Query words in topic definition
  if (topicDef.searchQuery) {
    const qWords = topicDef.searchQuery
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
    for (const qw of qWords) {
      if (combined.includes(qw)) return true;
    }
  }

  return false;
}

/**
 * Calculate how well an item matches the user's active topics
 */
export function calculateItemTopicMatch(item, targetTopics = [], targetKeywords = []) {
  if ((!targetTopics || targetTopics.length === 0) && (!targetKeywords || targetKeywords.length === 0)) {
    return { matchedTopic: null, matchCount: 0, matchedKeywords: [] };
  }

  const title = (item.title || "").toLowerCase();
  const text = (item.caption || item.text || "").toLowerCase();
  const tags = Array.isArray(item.niche_tags) ? item.niche_tags.join(" ").toLowerCase() : "";
  const combined = `${title} ${text} ${tags}`;

  // If item already carries matched_topic or interest_topic from source query, check if it belongs to targetTopics
  if (item.matched_topic || item.interest_topic) {
    const topicName = (item.matched_topic || item.interest_topic || "").toLowerCase().replace(/^#/, "");
    const found = targetTopics.find(
      (t) =>
        (t.id && t.id.toLowerCase() === topicName) ||
        (t.label && t.label.toLowerCase().replace(/^#/, "") === topicName)
    );

    if (found) {
      return { matchedTopic: found, matchCount: 3, matchedKeywords: [found.label] };
    }
  }

  let bestTopic = null;
  let maxTopicScore = 0;

  for (const topic of targetTopics) {
    let topicScore = 0;
    // Exact topic label
    if (combined.includes(topic.label.toLowerCase())) {
      topicScore += 5;
    }
    // Topic keywords
    for (const kw of topic.keywords) {
      const reg = new RegExp(`\\b${kw}\\b`, "i");
      if (reg.test(combined)) {
        topicScore += 1;
      }
    }
    if (topicScore > maxTopicScore) {
      maxTopicScore = topicScore;
      bestTopic = topic;
    }
  }

  const matchedKeywords = [];
  for (const kw of targetKeywords) {
    if (kw.length > 2 && combined.includes(kw.toLowerCase())) {
      matchedKeywords.push(kw);
    }
  }

  return {
    matchedTopic: bestTopic,
    matchCount: maxTopicScore + matchedKeywords.length,
    matchedKeywords: matchedKeywords.slice(0, 5),
  };
}
