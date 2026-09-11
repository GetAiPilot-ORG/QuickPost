import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { consumeUsage } from './src/services/entitlements.js';

dotenv.config({ path: './.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testEntitlements() {
  const userId = 'c4ce9261-3b4b-4898-9aa8-97a5d673eafa';
  console.log("=== Checking Entitlements for User:", userId);
  try {
    const usage = await consumeUsage(userId, 'autodm_replies_per_month', 0, 'month');
    console.log("Usage result:", JSON.stringify(usage, null, 2));
  } catch (err) {
    console.error("Entitlements Error:", err);
  }
}

testEntitlements();
