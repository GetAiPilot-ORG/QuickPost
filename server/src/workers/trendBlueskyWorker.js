import { pathToFileURL } from "url";
import { connectBlueskyJetstream } from "../services/trendBlueskyClient.js";
import { normalizeBlueskyPostsToTrendPosts } from "../services/trendPostNormalizer.js";
import { insertNewTrendPosts } from "../services/trendPostStore.js";

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_FLUSH_MS = 10000;

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function startBlueskyTrendWorker(options = {}) {
  const logger = options.logger || console;
  if (process.env.TREND_BLUESKY_ENABLED !== "true") {
    logger.log("[TREND-BLUESKY] Worker is disabled by default. Set TREND_BLUESKY_ENABLED=true to run.");
    return {
      socket: null,
      flush: async () => {},
      stop: () => {},
    };
  }
  const insertPosts = options.insertPosts || insertNewTrendPosts;
  const batchSize = toPositiveInt(options.batchSize || process.env.TREND_BLUESKY_BATCH_SIZE, DEFAULT_BATCH_SIZE);
  const flushMs = toPositiveInt(options.flushMs || process.env.TREND_BLUESKY_FLUSH_MS, DEFAULT_FLUSH_MS);
  let buffer = [];
  let flushing = false;

  async function flush() {
    if (flushing || buffer.length === 0) return;
    flushing = true;
    const posts = buffer;
    buffer = [];
    try {
      const normalized = normalizeBlueskyPostsToTrendPosts(posts);
      const write = await insertPosts(normalized);
      logger.log("[TREND-BLUESKY] inserted firehose batch", {
        received: posts.length,
        inserted: write.inserted.length,
        skipped: write.skipped,
      });
    } catch (error) {
      logger.error("[TREND-BLUESKY] batch insert failed", { error: error?.message || String(error) });
    } finally {
      flushing = false;
    }
  }

  const interval = setInterval(flush, flushMs);
  const socket = connectBlueskyJetstream({
    ...options,
    onPost(post) {
      buffer.push(post);
      if (buffer.length >= batchSize) void flush();
      options.onPost?.(post);
    },
    onError(error) {
      logger.error("[TREND-BLUESKY] stream error", { error: error?.message || String(error) });
      options.onError?.(error);
    },
    onClose(event) {
      clearInterval(interval);
      void flush();
      logger.log("[TREND-BLUESKY] stream closed", { code: event?.code, reason: event?.reason });
      options.onClose?.(event);
    },
  });

  logger.log("[TREND-BLUESKY] worker connected");
  return {
    socket,
    flush,
    stop() {
      clearInterval(interval);
      socket.close?.();
      return flush();
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startBlueskyTrendWorker();
}
