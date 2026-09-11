import express from 'express'; // Server reloaded - fixed text deduplication bug
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

// Global SSE clients list for Realtime Frontend Updates
const sseClients = [];

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
        health: 'GET /api/health'
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

// Setup Supabase Realtime listener for Edge Function Webhooks
// Triggering nodemon restart...
supabase
  .channel('webhook_logs_listener')
  .on(
    'postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'webhook_logs' },
    async (payload) => {
      const log = payload.new;
      if (log.event_type === 'messages' || log.event_type === 'messaging_postbacks') {
        // Skip outbound messages (where sender is the page itself) to prevent infinite loops!
        if (log.payload?.message?.is_echo) return;
        if (isAutoDMButtonInteraction(log.payload)) {
          console.log('Skipping InstaPilot for AutoDM button interaction');
          return;
        }
        console.log('⚡ Detected new DM from Edge Function webhook log!');
        // Wrap the payload back into standard Meta format
        const metaPayload = {
          object: 'instagram',
          entry: [
            {
              id: log.payload.recipient?.id,
              time: Math.floor(Date.now() / 1000),
              messaging: [log.payload]
            }
          ]
        };
        try {
          // Process the reconstructed webhook payload
          await processInstagramWebhook(metaPayload);
          console.log('✅ Reconstructed webhook processed successfully');
          // Emit Realtime event to all connected React Frontends
          sseClients.forEach(client => client.write('data: refresh\n\n'));
        } catch (e) {
          console.error('❌ Error processing reconstructed webhook:', e);
        }
      }
    }
  )
  .subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      console.log('📡 Listening for incoming Meta Webhooks from Edge Function...');
    }
  });

export default app;
