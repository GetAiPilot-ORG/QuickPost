import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import broadcastRouter from './routes/broadcast.js';
import authRouter from './routes/auth.js';
import ssoRouter from './routes/sso.js';
import broadcastsRouter from './routes/broadcasts.js';
import dashboardRouter from './routes/dashboard.js';
import onboardingRouter from './routes/onboarding.js';
import jobsRouter from './routes/jobs.js';
import trendFeedRouter from './routes/trendFeed.js';
import aiRouter from './routes/ai.js';
import instapilotRouter from './routes/instapilot.js';
import autodmRouter from './routes/autodm.js';
import billingRouter from './routes/billing.js';
import youtubeRouter from './routes/youtube.js';
import inboxRouter from './routes/inbox.js';
import { initScheduler } from './services/scheduler.js';
import supabase from './services/supabase.js';
import { processInstagramWebhook } from './services/instapilot.js';
import { persistInstagramWebhookToUnifiedInbox } from './services/unifiedInboxWebhook.js';
import { sseClients, broadcastRefresh } from './services/sse.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

// Middleware
const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://social.getaipilot.in',
  'https://api.getaipilot.in',
  'https://getaipilot.in',
  'https://getaipilot.com',
  'https://www.getaipilot.in',
  'https://www.getaipilot.com',
  /https:\/\/.*\.ngrok-free\.dev$/,
  /https:\/\/.*\.vercel\.app$/
];

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'ngrok-skip-browser-warning', 'X-Requested-With']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use((req, res, next) => {
  res.header('ngrok-skip-browser-warning', 'true');
  next();
});

app.use(express.json({
  limit: '100mb',
  verify: (req, res, buf) => {
    if (req.originalUrl?.includes('/webhooks/instagram')) {
      req.rawBody = Buffer.from(buf);
    }
  },
}));

app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Serve uploaded files statically (for Instagram public URL requirement)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/auth', ssoRouter);
app.use('/api', broadcastRouter);
app.use('/api', broadcastsRouter);
app.use('/api', dashboardRouter);
app.use('/api', onboardingRouter);
app.use('/api', jobsRouter);
app.use('/api', trendFeedRouter);
app.use('/api/ai', aiRouter);
app.use('/api/instapilot', instapilotRouter);
app.use('/api/autodm', autodmRouter);
app.use('/api/billing', billingRouter);
app.use('/api/youtube', youtubeRouter);
app.use('/api', inboxRouter);

// SSE Endpoint for InstaPilot Realtime
app.get('/api/instapilot/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const pingInterval = setInterval(() => {
    res.write(':\n\n');
  }, 15000);

  sseClients.push(res);

  req.on('close', () => {
    clearInterval(pingInterval);
    const index = sseClients.indexOf(res);
    if (index !== -1) sseClients.splice(index, 1);
  });
});

// Dev-only Multi-Service Redis Visualizer Dashboard
app.get('/redis', async (req, res) => {
  try {
    const IORedis = (await import('ioredis')).default;
    const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', { maxRetriesPerRequest: 1 });
    const keys = await redis.keys('*');
    
    // Categorize keys by QuickPost service
    const categories = {
      inbox: { name: '💬 Social Inbox Cache', desc: 'Accelerates /dashboard/inbox by caching aggregated multi-platform comments & chat previews (60s TTL)', items: [] },
      broadcasts: { name: '🚀 Broadcast Publishing Queue (BullMQ)', desc: 'Manages scheduled & bulk social post publishing background jobs and event logs', items: [] },
      email: { name: '📧 Email Delivery Queues (BullMQ)', desc: 'Processes transactional notifications and mass campaign emails via Supermailbox', items: [] },
      trends: { name: '📈 Trends & Feeds Cache', desc: 'Caches YouTube, Reddit, and Bluesky trending data and quota counters', items: [] },
      idempotency: { name: '🔒 Idempotency & Locks', desc: 'Prevents double-posting and concurrent race conditions across worker nodes', items: [] },
      other: { name: '📦 System & Other Keys', desc: 'General key-value store, sessions, or helper metadata', items: [] },
    };

    for (const key of keys) {
      const type = await redis.type(key);
      const ttl = await redis.ttl(key);
      let value = null;
      let summary = '';

      if (type === 'string') {
        const raw = await redis.get(key);
        try { 
          value = JSON.parse(raw); 
          if (Array.isArray(value)) summary = `${value.length} items`;
          else if (value && typeof value === 'object') summary = Object.keys(value).join(', ');
        } catch { 
          value = raw; 
          summary = String(raw).slice(0, 40);
        }
      } else if (type === 'hash') {
        value = await redis.hgetall(key);
        summary = `${Object.keys(value).length} fields`;
      } else if (type === 'zset') {
        const items = await redis.zrange(key, 0, -1, 'WITHSCORES');
        value = items;
        summary = `${items.length / 2} entries`;
      } else if (type === 'stream') {
        const streamData = await redis.xrevrange(key, '+', '-', 'COUNT', 5);
        value = streamData;
        summary = `Recent stream events`;
      } else if (type === 'set') {
        value = await redis.smembers(key);
        summary = `${value.length} members`;
      } else {
        value = `[${type} data]`;
      }

      const item = { key, type, ttl, value, summary };

      if (key.startsWith('inbox:')) categories.inbox.items.push(item);
      else if (key.startsWith('bull:broadcast-publish')) categories.broadcasts.items.push(item);
      else if (key.startsWith('bull:campaign') || key.startsWith('bull:transactional') || key.includes('email')) categories.email.items.push(item);
      else if (key.startsWith('trend') || key.startsWith('youtube:')) categories.trends.items.push(item);
      else if (key.startsWith('idempotency:') || key.startsWith('lock:')) categories.idempotency.items.push(item);
      else categories.other.items.push(item);
    }
    redis.disconnect();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>QuickPost Redis Command Center</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090d16;
      --card: #131b2e;
      --card-header: #19233c;
      --border: #23304d;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --accent: #ff5600;
      --blue: #38bdf8;
      --green: #22c55e;
      --amber: #f59e0b;
      --purple: #a855f7;
    }
    * { box-sizing: border-box; }
    body { font-family: 'Plus Jakarta Sans', sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 28px 36px; -webkit-font-smoothing: antialiased; }
    
    /* Top Bar */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--border); }
    .title-group h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; display: flex; align-items: center; gap: 10px; }
    .title-group p { margin: 6px 0 0; color: var(--text-muted); font-size: 14px; }
    
    /* Stats Row */
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; margin-bottom: 28px; }
    .stat-card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 16px 20px; }
    .stat-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
    .stat-val { font-size: 24px; font-weight: 800; margin-top: 4px; color: #fff; }
    .stat-sub { font-size: 12px; color: var(--green); margin-top: 2px; }

    /* Service Section */
    .section-title-wrap { margin-top: 32px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-end; }
    .section-title { font-size: 18px; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px; }
    .section-desc { font-size: 13px; color: var(--text-muted); margin: 4px 0 0; }
    .count-pill { font-size: 12px; font-weight: 700; background: #1e293b; color: var(--blue); padding: 3px 10px; border-radius: 20px; border: 1px solid var(--border); }

    /* Key Card */
    .key-card { background: var(--card); border: 1px solid var(--border); border-radius: 10px; margin-bottom: 12px; overflow: hidden; transition: border-color 0.2s; }
    .key-card:hover { border-color: #3b82f6; }
    .key-header { padding: 12px 18px; background: var(--card-header); display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; gap: 12px; flex-wrap: wrap; }
    .key-title { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 600; color: var(--blue); display: flex; align-items: center; gap: 8px; }
    .key-badges { display: flex; align-items: center; gap: 8px; }
    .type-badge { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; background: rgba(56, 189, 248, 0.12); color: var(--blue); }
    .ttl-badge { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; background: rgba(245, 158, 11, 0.12); color: var(--amber); }
    .ttl-perm { background: rgba(148, 163, 184, 0.12); color: var(--text-muted); }
    .summary-badge { font-size: 12px; color: var(--text-muted); font-weight: 500; }
    
    pre { margin: 0; padding: 16px 20px; background: #070b12; color: #cbd5e1; font-size: 12.5px; line-height: 1.5; overflow-x: auto; max-height: 380px; font-family: 'JetBrains Mono', monospace; border-top: 1px solid var(--border); }
    
    /* Search & Action Buttons */
    .controls { display: flex; gap: 10px; align-items: center; }
    .search-input { background: var(--card); border: 1px solid var(--border); color: #fff; padding: 9px 14px; border-radius: 8px; font-size: 13px; font-family: inherit; width: 240px; outline: none; }
    .search-input:focus { border-color: var(--blue); }
    .btn { background: var(--accent); color: #fff; border: none; padding: 9px 16px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
    .btn:hover { opacity: 0.9; }
    .btn-secondary { background: var(--card); border: 1px solid var(--border); color: var(--text); }
  </style>
  <script>
    function toggleBody(id) {
      const el = document.getElementById(id);
      if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
    }
    function filterKeys() {
      const q = document.getElementById('search').value.toLowerCase();
      document.querySelectorAll('.key-card').forEach(card => {
        const keyText = card.getAttribute('data-key').toLowerCase();
        card.style.display = keyText.includes(q) ? 'block' : 'none';
      });
    }
  </script>
</head>
<body>
  <div class="header">
    <div class="title-group">
      <h1>⚡ QuickPost Redis Command Center</h1>
      <p>Multi-service Redis architecture: live queues, inbox caching, and background workers</p>
    </div>
    <div class="controls">
      <input type="text" id="search" class="search-input" placeholder="Search keys (e.g. inbox, bull)..." onkeyup="filterKeys()" />
      <a href="/redis" class="btn">🔄 Refresh Data</a>
    </div>
  </div>

  <!-- Realtime Stats Grid -->
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Redis Status</div>
      <div class="stat-val" style="color: var(--green);">ONLINE</div>
      <div class="stat-sub">● redis://localhost:6379</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Active Keys</div>
      <div class="stat-val">${keys.length}</div>
      <div class="stat-sub">Across 5 QuickPost services</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Social Inbox Cache</div>
      <div class="stat-val" style="color: var(--accent);">${categories.inbox.items.length}</div>
      <div class="stat-sub">Active cached tenant(s)</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Publish Queues (BullMQ)</div>
      <div class="stat-val" style="color: var(--blue);">${categories.broadcasts.items.length}</div>
      <div class="stat-sub">Broadcast jobs & streams</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Email Queues</div>
      <div class="stat-val" style="color: var(--purple);">${categories.email.items.length}</div>
      <div class="stat-sub">Campaigns & notifications</div>
    </div>
  </div>

  <!-- Services Sections -->
  ${Object.entries(categories).map(([catKey, cat]) => {
    if (cat.items.length === 0) return '';
    return `
      <div class="section-title-wrap">
        <div>
          <h2 class="section-title">${cat.name}</h2>
          <p class="section-desc">${cat.desc}</p>
        </div>
        <span class="count-pill">${cat.items.length} key${cat.items.length !== 1 ? 's' : ''}</span>
      </div>

      ${cat.items.map((item, idx) => {
        const bodyId = 'val-' + catKey + '-' + idx;
        const isInbox = catKey === 'inbox';
        return `
          <div class="key-card" data-key="${item.key}">
            <div class="key-header" onclick="toggleBody('${bodyId}')">
              <span class="key-title">
                🔑 ${item.key}
              </span>
              <div class="key-badges">
                ${item.summary ? `<span class="summary-badge">${item.summary}</span>` : ''}
                <span class="type-badge">${item.type}</span>
                <span class="ttl-badge ${item.ttl === -1 ? 'ttl-perm' : ''}">
                  ${item.ttl === -1 ? 'Persistent' : '⏳ ' + item.ttl + 's TTL'}
                </span>
                <span style="color: var(--text-muted); font-size: 11px;">▼</span>
              </div>
            </div>
            <div id="${bodyId}" style="display: ${isInbox ? 'block' : 'none'};">
              <pre>${typeof item.value === 'object' ? JSON.stringify(item.value, null, 2) : String(item.value)}</pre>
            </div>
          </div>
        `;
      }).join('')}
    `;
  }).join('')}

</body>
</html>`;
    res.send(html);
  } catch (err) {
    res.status(500).send(`Redis error: ${err.message}`);
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'QuickPost API Server - OAuth Enabled',
    version: '2.0.0',
    endpoints: {
      auth: {
        googleLogin: 'GET /auth/google',
        instagramConnect: 'GET /auth/instagram (requires auth)',
        me: 'GET /auth/me (requires auth)',
        accounts: 'GET /auth/accounts (requires auth)',
        logout: 'POST /auth/logout'
      },
      api: {
        broadcast: 'POST /api/broadcast (requires auth)',
        health: 'GET /api/health',
        redisViewer: 'GET /redis'
      }
    }
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
const server = app.listen(PORT, () => {
  console.log('╔══════════════════════════════════════╗');
  console.log('║     QuickPost API Server             ║');
  console.log('╚══════════════════════════════════════╝');
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Client URL: ${CLIENT_URL}`);
  console.log(`📁 Uploads directory: ${path.join(__dirname, '../uploads')}`);

  // Initialize Post Scheduler
  initScheduler();

  console.log(`\n✨ Ready to broadcast!\n`);
});

// Set server timeout to 5 minutes for large uploads
server.timeout = 300000;
server.keepAliveTimeout = 300000;

const isAutoDMButtonInteraction = (webhookPayload = {}) =>
  Boolean(webhookPayload?.message?.quick_reply?.payload || webhookPayload?.postback);

async function handleWebhookLogRecord(log) {
  if (!log || !log.id) return;
  const logId = log.id;
  if (log.event_type !== 'messages' && log.event_type !== 'messaging_postbacks') {
    return;
  }
  // Skip outbound messages (where sender is the page itself) to prevent infinite loops!
  if (log.payload?.message?.is_echo) {
    return;
  }
  if (isAutoDMButtonInteraction(log.payload)) {
    return;
  }

  // Atomic database claim: only 1 worker/process can ever process this log record!
  const { data: claimed, error: claimError } = await supabase
    .from('webhook_logs')
    .update({ processed: true })
    .eq('id', logId)
    .eq('processed', false)
    .select('id')
    .maybeSingle();

  if (!claimed || claimError) {
    // Already claimed or processed by another worker
    return;
  }

  // Wrap the payload back into standard Meta format
  const metaPayload = {
    object: 'instagram',
    entry: [
      {
        id: log.payload?.recipient?.id,
        time: Math.floor(Date.now() / 1000),
        messaging: [log.payload]
      }
    ]
  };

  try {
    const inboxResults = await persistInstagramWebhookToUnifiedInbox(metaPayload);
    const persistedCount = inboxResults.filter((result) => result.persisted).length;
    if (persistedCount) {
      console.log(`[${logId}] ✅ Unified inbox persisted ${persistedCount} Instagram message(s)`);
    } else {
      console.warn(`[${logId}] ⚠️ Unified inbox could not map Instagram recipient`, {
        recipients: inboxResults.map((result) => result.recipientId).filter(Boolean),
      });
    }
  } catch (e) {
    console.error(`[${logId}] ❌ Unified inbox webhook persistence failed:`, e.message || e);
  }

  // InstaPilot is an optional downstream automation consumer. A missing bot or
  // imported InstaPilot account must never prevent the main Social Inbox write.
  try {
    await processInstagramWebhook(metaPayload);
  } catch (e) {
    console.error(`[${logId}] ❌ Optional InstaPilot processing failed:`, e.message || e);
  }
}

// Setup Supabase Realtime listener for Edge Function Webhooks
// In development, avoid competing with the live deployed production server (api.getaipilot.in) unless explicitly requested.
const isProduction = process.env.NODE_ENV === 'production';
const enableLocalWorker = process.env.ENABLE_LOCAL_WEBHOOK_WORKER === 'true';

if (isProduction || enableLocalWorker) {
  supabase
    .channel('webhook_logs_listener')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'webhook_logs' },
      (payload) => {
        handleWebhookLogRecord(payload.new);
      }
    )
    .subscribe((status) => {
      console.log(`📡 [SUPABASE] webhook_logs listener status: ${status}`);
    });
} else {
  console.log(`ℹ️ [INSTAPILOT] Development mode: Webhook listener passive (Live DMs are handled by cloud server https://api.getaipilot.in).`);
}

// Dedicated listener to refresh the frontend ONLY when actual messages are inserted.
const messagesChannel = supabase
  .channel('instagram_messages_listener')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'instagram_messages' },
    (payload) => {
      setTimeout(() => {
        broadcastRefresh('MessagesListener');
      }, 200);
    }
  )
  .subscribe((status) => {
    console.log(`📡 [SUPABASE] instagram_messages listener status: ${status}`);
  });

export default app;
