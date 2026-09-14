import fs from 'fs';
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import { default as supabase } from './supabase.js';
import { executeBroadcast } from './postingService.js';
import { downloadMedia } from '../utils/download.js';
import { supermailbox } from './supermailbox.js';

const QUEUE_NAME = process.env.BROADCAST_QUEUE_NAME || 'broadcast-publish';
const getRedisUrl = () => process.env.REDIS_URL || process.env.BULLMQ_REDIS_URL;
const WORKER_CONCURRENCY = Number(process.env.BROADCAST_WORKER_CONCURRENCY || 5);
const MAX_ATTEMPTS = Number(process.env.BROADCAST_MAX_ATTEMPTS || 5);
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const PERMANENT_ERROR_CODES = [
  'ACCOUNT_DISCONNECTED',
  'INVALID_MEDIA',
  'REAUTH_REQUIRED',
  'INVALID_CAPTION',
  'UNSUPPORTED_COMBINATION',
  'UNAUTHORIZED',
  '401',
];
const PERMANENT_ERROR_PATTERNS = [
  'NO YOUTUBE CHANNEL',
  'YOUTUBESIGNUPREQUIRED',
  'CHANNELNOTFOUND',
  'UNAUTHORIZED',
  'INVALID_GRANT',
  'ASPECT RATIO IS NOT SUPPORTED',
  'INVALID ASPECT RATIO',
  'UNSUPPORTED ASPECT RATIO',
  'MEDIA ID IS NOT AVAILABLE',
  'MEDIA URL IS NOT AVAILABLE',
  'MEDIA TYPE IS NOT SUPPORTED',
  'THE IMAGE FORMAT IS NOT SUPPORTED',
  'THE VIDEO FORMAT IS NOT SUPPORTED',
];

let queue;
let worker;
let queueConnection;
let workerConnection;

function log(level, broadcastId, msg, meta = {}) {
  const idStr = broadcastId ? `[${String(broadcastId).slice(0, 8)}]` : '';
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    `⏰ [BROADCAST-QUEUE]${idStr} ${msg}`,
    Object.keys(meta).length ? meta : ''
  );
}

function getConnection() {
  const url = getRedisUrl();
  if (!url) return null;
  return new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

export function isBroadcastQueueEnabled() {
  return Boolean(getRedisUrl());
}

export function getBroadcastQueue() {
  if (!getRedisUrl()) return null;
  if (!queue) {
    queueConnection = queueConnection || getConnection();
    queue = new Queue(QUEUE_NAME, {
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: { age: 60 * 60 * 24, count: 1000 },
        removeOnFail: { age: 60 * 60 * 24 * 7, count: 5000 },
      },
    });
  }
  return queue;
}

export async function enqueueBroadcastJob(broadcastId) {
  const broadcastQueue = getBroadcastQueue();
  if (!broadcastQueue) {
    throw new Error('Redis is not configured. Set REDIS_URL to enable BullMQ broadcast queue.');
  }

  return broadcastQueue.add(
    'publish',
    { broadcastId },
    {
      jobId: `broadcast-${broadcastId}-${Date.now()}`,
    }
  );
}

function cleanupFiles(filePaths = []) {
  try {
    let cleaned = 0;
    for (const filePath of filePaths) {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        cleaned += 1;
      }
    }
    if (cleaned > 0) log('log', null, `Cleaned up ${cleaned} temp file(s) after scheduled post`);
  } catch (error) {
    log('error', null, 'File cleanup error', { error: error.message });
  }
}

async function setStatus(id, status, extras = {}) {
  const { error } = await supabase
    .from('broadcasts')
    .update({ status, ...extras })
    .eq('id', id);

  if (error) {
    log('error', id, `setStatus(${status}) failed`, { error: error.message });
  }
}

function isRetryable(error) {
  const msg = (error?.message || '').toUpperCase();
  const code = error?.code || error?.statusCode;

  if (PERMANENT_ERROR_CODES.some((permanentCode) => msg.includes(permanentCode))) return false;
  if (PERMANENT_ERROR_PATTERNS.some((pattern) => msg.includes(pattern))) return false;
  if (RETRYABLE_STATUS_CODES.has(Number(code))) return true;
  if (msg.includes('NETWORK') || msg.includes('TIMEOUT') || msg.includes('ECONNRESET')) return true;
  return true;
}

async function claimBroadcastForProcessing(broadcastId) {
  const { data, error } = await supabase
    .rpc('claim_queued_broadcast', { p_id: broadcastId })
    .maybeSingle();

  if (error) {
    throw new Error(`Failed marking broadcast processing: ${error.message}`);
  }

  if (!data) {
    const { data: current, error: fetchError } = await supabase
      .from('broadcasts')
      .select('id, status')
      .eq('id', broadcastId)
      .maybeSingle();

    if (fetchError) throw new Error(`Failed loading broadcast status: ${fetchError.message}`);
    if (!current) throw new Error('Broadcast not found');
    log('warn', broadcastId, `Skipping job because broadcast status is ${current.status}`);
    return null;
  }

  return data;
}

export async function processBroadcastJob(broadcastId) {
  const post = await claimBroadcastForProcessing(broadcastId);
  if (!post) return;

  const {
    id,
    user_id,
    caption,
    media_url,
    media_urls,
    platform_data,
    media_type,
    attempt_count = 1,
  } = post;

  const currentAttempt = Math.max(Number(attempt_count) || 1, 1);
  const channels = platform_data?.selectedChannels || [];
  const filePaths = platform_data?.filePaths || [];
  const startTime = Date.now();
  const resolvedMediaUrls = Array.isArray(media_urls) && media_urls.length > 0
    ? media_urls
    : media_url
      ? [media_url]
      : [];

  log('log', id, `Worker processing attempt ${currentAttempt}`, { channels });

  let processingFilePaths = filePaths.filter((filePath) => filePath && fs.existsSync(filePath));

  try {
    const missingFiles = filePaths.filter((filePath) => filePath && !fs.existsSync(filePath));
    if (missingFiles.length > 0 && resolvedMediaUrls.length > 0) {
      log('log', id, `Local files missing, downloading from Cloudinary just-in-time...`);
      processingFilePaths = await downloadMedia(resolvedMediaUrls, filePaths);
    }

    await executeBroadcast(
      id,
      user_id,
      caption,
      resolvedMediaUrls,
      processingFilePaths,
      channels,
      platform_data,
      media_type
    );

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log('log', id, `Success in ${elapsed}s`);
    cleanupFiles(processingFilePaths);

    // Notify user via SupermailBox
    try {
      const { data: user } = await supabase
        .from('users')
        .select('email, name')
        .eq('id', user_id)
        .maybeSingle();

      if (user?.email) {
        supermailbox.sendEmail({
          to: user.email,
          templateKey: 'broadcast_notification',
          idempotencyKey: `broadcast_${id}`,
          variables: {
            campaign_name: 'Broadcast Published successfully',
            full_name: user.name || user.email,
            email: user.email,
            caption: caption?.substring(0, 100) || 'New post published',
            platforms: channels?.join(', ') || 'Connected channels'
          }
        }).catch(err => log('warn', id, `SupermailBox notification failed: ${err?.message}`));
      }
    } catch (mailErr) {
      log('warn', id, `Failed sending SupermailBox notification: ${mailErr?.message}`);
    }
  } catch (error) {
    const errorMsg = error?.message || String(error);
    log('error', id, `Failed attempt ${currentAttempt}/${MAX_ATTEMPTS}`, { error: errorMsg });

    if (currentAttempt >= MAX_ATTEMPTS || !isRetryable(error)) {
      await setStatus(id, 'failed', {
        last_error: `[Attempt ${currentAttempt}] ${errorMsg}`,
        processing_started_at: null,
      });
      cleanupFiles(processingFilePaths);
      return;
    }

    const backoffSeconds = Math.pow(2, currentAttempt) * 15;
    await setStatus(id, 'scheduled', {
      last_error: `[Attempt ${currentAttempt}] ${errorMsg}`,
      processing_started_at: null,
      scheduled_for: new Date(Date.now() + backoffSeconds * 1000).toISOString(),
    });
    
    cleanupFiles(processingFilePaths);
  }
}

export function initBroadcastWorker() {
  if (!getRedisUrl()) {
    log('warn', null, 'Redis not configured; BullMQ worker disabled. Set REDIS_URL to enable it.');
    return null;
  }

  if (worker) return worker;

  workerConnection = workerConnection || getConnection();
  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      await processBroadcastJob(job.data.broadcastId);
    },
    {
      connection: workerConnection,
      concurrency: WORKER_CONCURRENCY,
      lockDuration: Number(process.env.BROADCAST_WORKER_LOCK_MS || 10 * 60 * 1000),
    }
  );

  worker.on('completed', (job) => {
    log('log', job.data.broadcastId, 'Job completed');
  });

  worker.on('failed', (job, error) => {
    log('error', job?.data?.broadcastId, 'Job failed unexpectedly', { error: error.message });
  });

  worker.on('error', (error) => {
    log('error', null, 'Worker error', { error: error.message });
  });

  log('log', null, `Worker running (queue ${QUEUE_NAME}, concurrency ${WORKER_CONCURRENCY})`);
  return worker;
}
