/**
 * Relevance & Quality Filter for Search Results (Ported from TrendPulse)
 * Ensures results retrieved from Bluesky, Pinterest, and other platforms
 * match the user query with high semantic relevance and zero spam.
 */

const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any',
  'are', 'aren\'t', 'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below',
  'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot', 'could', 'couldn\'t',
  'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have',
  'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s',
  'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll',
  'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
  'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves',
  'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should',
  'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll',
  'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up',
  'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t',
  'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while', 'who',
  'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you',
  'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Tokenize query into meaningful search keywords
 */
export function extractKeywords(query) {
  if (!query) return [];
  return String(query)
    .toLowerCase()
    .replace(/[^a-z0-9#\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

/**
 * Calculate relevance score for a given post/pin
 */
export function calculateRelevance(item, query) {
  if (!query || !String(query).trim()) return 10;

  const rawQuery = String(query).toLowerCase().trim();
  const keywords = extractKeywords(query);

  const title = (item.title || '').toLowerCase();
  const text = (item.caption || item.text || '').toLowerCase();
  const handle = (item.author?.handle || item.creator_url || '').toLowerCase();
  const authorName = (item.creator || item.author?.name || '').toLowerCase();
  const tags = Array.isArray(item.niche_tags) ? item.niche_tags.join(' ').toLowerCase() : '';
  const combined = `${title} ${text} ${handle} ${authorName} ${tags}`;

  const platform = (item.source_platform || item.platform || '').toLowerCase();

  if (platform === 'pinterest') {
    // Spam filler titles
    const spamTitles = ['dm for edit', 'vroom vroom', 'explore', 'untitled', 'click here'];
    if (spamTitles.some((s) => title.includes(s))) return 0;
    if (!item.thumbnail_url && !item.full_image_url && !item.image && !item.thumb) return 0;
  }

  let score = 0;

  // 1. Exact phrase match in combined text (+50)
  if (combined.includes(rawQuery)) {
    score += 50;
  }

  // 2. Keyword coverage
  let matchedCount = 0;
  for (const kw of keywords) {
    const isTag = kw.startsWith('#');
    const term = isTag ? kw.slice(1) : kw;
    const wordRegex = new RegExp(`\\b${term}`, 'i');

    let matched = false;
    if (wordRegex.test(title)) {
      score += 25;
      matched = true;
    } else if (wordRegex.test(text)) {
      score += 15;
      matched = true;
    } else if (wordRegex.test(handle) || wordRegex.test(authorName)) {
      score += 10;
      matched = true;
    } else if (wordRegex.test(tags)) {
      score += 12;
      matched = true;
    }

    if (matched) matchedCount++;
  }

  // If query had keywords, verify match criteria
  if (keywords.length > 0) {
    // If not even a single keyword matched in text/title/author, reject!
    if (matchedCount === 0) return 0;

    // Multi-word query: at least 45% of terms must match to be considered relevant
    if (keywords.length > 1) {
      const matchRatio = matchedCount / keywords.length;
      const minRatio = (platform === 'pinterest' || platform === 'youtube') ? 0.3 : 0.45;
      if (matchRatio < minRatio) return 0;
      score *= matchRatio;
    }
  }

  if (platform === 'pinterest' || platform === 'youtube') {
    // Verified search results get a solid baseline relevance score
    score = Math.max(score, 35);
  }

  if (platform === 'pinterest') {
    if (text && text.length > 20) {
      score += 10;
    }
    const saves = item.metrics?.saves || item.stats?.saves || 0;
    score += Math.min(Math.log10(Number(saves) + 1) * 4, 15);
  }

  return score;
}

/**
 * Filter and rank results by relevance and quality,
 * while preventing author monopolization.
 */
export function filterAndRankPosts(items, query) {
  if (!items || items.length === 0) return [];
  if (!query || !String(query).trim()) return items;

  // Compute scores
  const scored = [];
  for (const item of items) {
    const score = calculateRelevance(item, query);
    if (score > 0) {
      scored.push({ item, score });
    }
  }

  // Sort by relevance score descending
  scored.sort((a, b) => b.score - a.score);

  // Author diversification: generous limit for visual platforms like Pinterest
  const diversified = [];
  const authorCounts = new Map();

  for (const { item } of scored) {
    const platform = item.source_platform || item.platform || 'platform';
    const author = item.creator || item.author?.handle || item.author?.name || 'unknown';
    const authorKey = `${platform}:${author}`;
    const count = authorCounts.get(authorKey) || 0;
    const maxPerAuthor = platform === 'pinterest' || platform === 'bluesky' ? 12 : 3;
    if (count < maxPerAuthor) {
      diversified.push(item);
      authorCounts.set(authorKey, count + 1);
    }
  }

  return diversified;
}
