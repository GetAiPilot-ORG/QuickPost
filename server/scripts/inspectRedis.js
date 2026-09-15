import dotenv from 'dotenv';
dotenv.config();
import IORedis from 'ioredis';

const url = process.env.REDIS_URL || process.env.BULLMQ_REDIS_URL || 'redis://localhost:6379';
const redis = new IORedis(url, { maxRetriesPerRequest: 1 });

async function main() {
  console.log(`\n🔌 Connecting to Redis at ${url}...`);
  try {
    const pong = await redis.ping();
    console.log(`✅ Redis Status: ${pong}\n`);

    const keys = await redis.keys('*');
    if (keys.length === 0) {
      console.log('📭 Redis is currently empty (no active cached keys).\n');
      process.exit(0);
    }

    const categories = {
      '💬 Social Inbox Cache (60s TTL)': keys.filter(k => k.startsWith('inbox:')),
      '🚀 Broadcast Publishing Queue (BullMQ)': keys.filter(k => k.startsWith('bull:broadcast-publish')),
      '📧 Email Delivery Queues (BullMQ / Supermailbox)': keys.filter(k => k.startsWith('bull:campaign') || k.startsWith('bull:transactional') || k.includes('email')),
      '📈 Trends & Feeds Cache': keys.filter(k => k.startsWith('trend') || k.startsWith('youtube:')),
      '🔒 Idempotency & Locks': keys.filter(k => k.startsWith('idempotency:') || k.startsWith('lock:')),
      '📦 System & Other Keys': keys.filter(k => !k.startsWith('inbox:') && !k.startsWith('bull:') && !k.startsWith('trend') && !k.startsWith('youtube:') && !k.startsWith('idempotency:') && !k.startsWith('lock:')),
    };

    console.log(`============================================================`);
    console.log(`⚡ QuickPost Redis Architecture Breakdown (Total: ${keys.length} keys)`);
    console.log(`============================================================\n`);

    for (const [sectionName, secKeys] of Object.entries(categories)) {
      if (secKeys.length === 0) continue;
      console.log(`\n┌─ ${sectionName} [${secKeys.length} key(s)]`);
      for (const key of secKeys) {
        const type = await redis.type(key);
        const ttl = await redis.ttl(key);
        const ttlStr = ttl === -1 ? 'Persistent' : `${ttl}s TTL`;
        console.log(`│  🔑 ${key} (${type}, ${ttlStr})`);
        if (key.startsWith('inbox:')) {
          const val = await redis.get(key);
          try {
            const parsed = JSON.parse(val);
            console.log(`│     └─ Cached: ${parsed.items?.length || 0} chats, Total Loaded: ${parsed.totalLoaded || 0}`);
          } catch {}
        }
      }
      console.log(`└───────────────────────────────────────────────────────────`);
    }
    console.log(`\n💡 Tip: Open http://localhost:5000/redis in your browser for the visual UI.\n`);
  } catch (err) {
    console.error('❌ Redis inspection failed:', err.message);
  } finally {
    redis.disconnect();
    process.exit(0);
  }
}

main();
