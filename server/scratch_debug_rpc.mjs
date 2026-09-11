import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: './.env' });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsers() {
  console.log("=== Checking users table ===");
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, created_at');
  console.log("Users:", JSON.stringify(users, null, 2), "Error:", error);
}

checkUsers();
