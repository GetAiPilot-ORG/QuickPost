import cron from 'node-cron';
import { default as supabase } from './supabase.js';
import {
  enqueueBroadcastJob,
  initBroadcastWorker,
  isBroadcastQueueEnabled,
  processBroadcastJob,
} from './broadcastQueue.js';

const STALE_PROCESSING_MINUTES = Number(process.env.SCHEDULER_STALE_PROCESSING_MINUTES || 15);
const SCHEDULER_BATCH_SIZE = Number(process.env.SCHEDULER_BATCH_SIZE || 25);
const FALLBACK_DIRECT_CONCURRENCY = Number(process.env.SCHEDULER_DIRECT_CONCURRENCY || 3);
const SCHEDULER_CRON = process.env.SCHEDULER_CRON || '* * * * *';

function log(level, broadcastId, msg, meta = {}) {
  const idStr = broadcastId ? `[${String(broadcastId).slice(0, 8)}]` : '';
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    `⏰ [SCHEDULER]${idStr} ${msg}`,
    Object.keys(meta).length ? meta : ''
  );
}

async function claimBroadcast(id) {
  const { data, error } = await supabase.rpc('claim_scheduled_broadcast', { p_id: id });
  if (error) {
    log('error', id, 'claimBroadcast RPC error', { error: error.message });
    return false;
  }
  return data === true;
}

async function recoverStalePosts() {
  const { data, error } = await supabase.rpc('recover_stale_broadcasts', {
    p_stale_minutes: STALE_PROCESSING_MINUTES,
  });
  if (error) {
    log('error', null, 'Recovery RPC error', { error: error.message });
    return 0;
  }
  if (data > 0) {
    log('warn', null, `Recovered ${data} stale processing post(s)`);
  }
  return data || 0;
}

async function resetClaimedBroadcast(id, reason) {
  const { error } = await supabase
    .from('broadcasts')
    .update({
      status: 'scheduled',
      processing_started_at: null,
      last_error: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    log('error', id, 'Failed resetting claimed broadcast', { error: error.message });
  }
}

async function enqueueClaimedPost(post) {
  const claimed = await claimBroadcast(post.id);
  if (!claimed) {
    log('log', post.id, 'Skipped; already claimed by another worker or no longer due');
    return false;
  }

  if (!isBroadcastQueueEnabled()) {
    log('warn', post.id, 'Redis not configured; processing directly as fallback');
    await processBroadcastJob(post.id);
    return true;
  }

  try {
    await enqueueBroadcastJob(post.id);
    log('log', post.id, 'Enqueued broadcast job');
    return true;
  } catch (error) {
    const message = error?.message || String(error);
    log('error', post.id, 'Failed enqueueing broadcast job', { error: message });
    await resetClaimedBroadcast(post.id, `[Queue enqueue failed] ${message}`);
    return false;
  }
}

async function processDirectFallback(duePosts) {
  const queue = [...duePosts];
  const workers = Array.from({ length: Math.min(FALLBACK_DIRECT_CONCURRENCY, queue.length) }, async () => {
    while (queue.length > 0) {
      const post = queue.shift();
      if (post) await enqueueClaimedPost(post);
    }
  });
  await Promise.allSettled(workers);
}

async function pollAndProcess() {
  try {
    await recoverStalePosts();

    const now = new Date().toISOString();
    const { data: duePosts, error } = await supabase
      .from('broadcasts')
      .select('id, scheduled_for')
      .eq('status', 'scheduled')
      .lte('scheduled_for', now)
      .order('scheduled_for', { ascending: true })
      .limit(SCHEDULER_BATCH_SIZE);

    if (error) {
      log('error', null, 'Error querying due posts', { error: error.message });
      return;
    }

    if (!duePosts || duePosts.length === 0) return;

    log('log', null, `Found ${duePosts.length} due post(s). ${isBroadcastQueueEnabled() ? 'Enqueueing' : 'Processing fallback'}...`);

    if (!isBroadcastQueueEnabled()) {
      await processDirectFallback(duePosts);
      return;
    }

    await Promise.allSettled(duePosts.map(enqueueClaimedPost));
  } catch (error) {
    log('error', null, 'Unexpected scheduler error', { error: error?.message || String(error) });
  }
}

export function initScheduler() {
  log('log', null, 'Initializing BullMQ-backed Post Scheduler...');
  initBroadcastWorker();
  cron.schedule(SCHEDULER_CRON, pollAndProcess);
  void pollAndProcess();
  log('log', null, `Scheduler running (${SCHEDULER_CRON}, batch ${SCHEDULER_BATCH_SIZE})`);
}
