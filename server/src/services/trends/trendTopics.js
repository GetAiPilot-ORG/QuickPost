/**
 * Canonical Trend Topics Registry & Personalization Helper
 * Maps user interest selections to high-yield search terms, platforms, and relevance keywords.
 */

export const TREND_TOPIC_REGISTRY = [
  // Tech & AI
  {
    id: "ai_chatgpt",
    label: "AI & ChatGPT",
    emoji: "🤖",
    category: "Tech & AI",
    searchQuery: "AI ChatGPT artificial intelligence",
    keywords: ["ai", "chatgpt", "llm", "artificial intelligence", "claude", "midjourney", "prompt", "openai", "generative ai"],
    youtubeCategory: "28", // Science & Tech
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
    label: "Coding & Dev",
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

  // Business & Wealth
  {
    id: "startups_saas",
    label: "Startups & SaaS",
    emoji: "🏢",
    category: "Business & Wealth",
    searchQuery: "startups saas founder entrepreneurship",
    keywords: ["startups", "saas", "founder", "indie hacker", "entrepreneurship", "building in public", "business"],
    youtubeCategory: "27", // Education / Business
    subCategory: "business_finance",
  },
  {
    id: "marketing_growth",
    label: "Marketing & Growth",
    emoji: "📈",
    category: "Business & Wealth",
    searchQuery: "marketing growth seo copywriting sales",
    keywords: ["marketing", "growth", "seo", "copywriting", "sales", "advertising", "branding", "funnel"],
    youtubeCategory: "27",
    subCategory: "business_finance",
  },
  {
    id: "finance_stocks",
    label: "Investing & Stocks",
    emoji: "💵",
    category: "Business & Wealth",
    searchQuery: "investing stocks wealth portfolio market",
    keywords: ["investing", "stocks", "wealth", "portfolio", "passive income", "market", "etf", "finance"],
    youtubeCategory: "27",
    subCategory: "business_finance",
  },
  {
    id: "crypto_bitcoin",
    label: "Crypto & Bitcoin",
    emoji: "🪙",
    category: "Business & Wealth",
    searchQuery: "crypto bitcoin ethereum web3 solana",
    keywords: ["crypto", "bitcoin", "ethereum", "blockchain", "web3", "solana", "crypto news"],
    youtubeCategory: "27",
    subCategory: "business_finance",
  },

  // Creative & Media
  {
    id: "creator_economy",
    label: "Creator Economy",
    emoji: "📱",
    category: "Creative & Media",
    searchQuery: "creator economy monetization youtube viral hooks",
    keywords: ["creator", "monetization", "youtube growth", "hooks", "editing", "viral", "content creator"],
    youtubeCategory: "24", // Entertainment
    subCategory: "marketing_creators",
  },
  {
    id: "reels_video",
    label: "Reels & Short Video",
    emoji: "🎥",
    category: "Creative & Media",
    searchQuery: "reels short video capcut editing cinematography",
    keywords: ["video editing", "reels", "tiktok", "capcut", "cinematography", "shortform", "broll"],
    youtubeCategory: "24",
    subCategory: "marketing_creators",
  },
  {
    id: "design_3d",
    label: "Design & 3D Art",
    emoji: "🎨",
    category: "Creative & Media",
    searchQuery: "graphic design ui ux 3d blender architecture",
    keywords: ["design", "ui", "ux", "3d", "blender", "graphic design", "animation", "typography", "aesthetic"],
    youtubeCategory: "26", // Howto & Style
    subCategory: "design_art",
  },
  {
    id: "photography_gear",
    label: "Photo & Cameras",
    emoji: "📸",
    category: "Creative & Media",
    searchQuery: "photography camera lighting portraits aesthetic",
    keywords: ["photography", "camera", "lighting", "portraits", "aesthetic", "photo", "cinematic photo"],
    youtubeCategory: "26",
    subCategory: "design_art",
  },

  // Lifestyle & Health
  {
    id: "fitness_gym",
    label: "Fitness & Gym",
    emoji: "🏋️",
    category: "Lifestyle & Health",
    searchQuery: "fitness gym workout bodybuilding training",
    keywords: ["fitness", "gym", "workout", "muscle", "bodybuilding", "health", "training", "nutrition"],
    youtubeCategory: "17", // Sports
    subCategory: "health_fitness",
  },
  {
    id: "productivity_habits",
    label: "Productivity & Focus",
    emoji: "💡",
    category: "Lifestyle & Health",
    searchQuery: "productivity habits focus notion routine systems",
    keywords: ["productivity", "habits", "focus", "notion", "daily routine", "systems", "deep work"],
    youtubeCategory: "27",
    subCategory: "health_fitness",
  },
  {
    id: "mindset_selfhelp",
    label: "Mindset & Motivation",
    emoji: "🧠",
    category: "Lifestyle & Health",
    searchQuery: "mindset motivation discipline psychology self improvement",
    keywords: ["motivation", "discipline", "psychology", "mindset", "self improvement", "stoicism"],
    youtubeCategory: "27",
    subCategory: "health_fitness",
  },
  {
    id: "travel_nomad",
    label: "Travel & Nomad",
    emoji: "✈️",
    category: "Lifestyle & Health",
    searchQuery: "travel nomad adventure destinations explore",
    keywords: ["travel", "nomad", "adventure", "explore", "destinations", "vacation", "digital nomad"],
    youtubeCategory: "19", // Travel & Events
    subCategory: "travel",
  },
  {
    id: "food_cooking",
    label: "Food & Recipes",
    emoji: "🍔",
    category: "Lifestyle & Health",
    searchQuery: "food recipes cooking streetfood baking chef",
    keywords: ["food", "cooking", "recipes", "street food", "baking", "chef", "restaurant", "meal prep"],
    youtubeCategory: "26",
    subCategory: "food",
  },
  {
    id: "fashion_style",
    label: "Fashion & Outfits",
    emoji: "👟",
    category: "Lifestyle & Health",
    searchQuery: "fashion streetwear outfits styling sneakers drip",
    keywords: ["fashion", "streetwear", "outfits", "styling", "sneakers", "luxury", "drip", "lookbook"],
    youtubeCategory: "26",
    subCategory: "fashion",
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
 * Resolve target topics, search queries, and relevance keywords from request parameters
 */
export function resolveTargetTopics({ topics = "", topic = "", interests = "" } = {}) {
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

  // 3. Fallback/supplement with interests string if topics empty or additional keywords provided
  if (interests && String(interests).trim()) {
    const rawInterests = String(interests)
      .split(",")
      .map((i) => i.trim())
      .filter((i) => i.length > 1);

    for (const item of rawInterests) {
      const def = getTopicDefinition(item);
      if (def && !targetTopics.some((t) => t.id === def.id)) {
        targetTopics.push(def);
        searchQueries.push(def.searchQuery);
        def.keywords.forEach((k) => keywordSet.add(k));
      } else {
        keywordSet.add(item.toLowerCase());
        if (searchQueries.length < 3 && item.length > 2) {
          searchQueries.push(item);
        }
      }
    }
  }

  return {
    targetTopics,
    searchQueries: searchQueries.slice(0, 6),
    keywords: Array.from(keywordSet),
    isFilteredToSingleTopic: false,
    activeTopic: null,
  };
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

  // If item already carries matched_topic or interest_topic from source query
  if (item.matched_topic || item.interest_topic) {
    const found = getTopicDefinition(item.matched_topic || item.interest_topic);
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
