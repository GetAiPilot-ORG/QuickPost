import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing in environment variables');
}

// In-process lock implementation to prevent NavigatorLockAcquireTimeoutError
// caused by browser Web Locks API contention across tabs, iframes, or fast refreshes.
const activeLocks = new Map();

const memoryLock = async (name, acquireTimeout, fn) => {
  const previous = activeLocks.get(name) || Promise.resolve();
  const current = (async () => {
    try {
      await previous;
    } catch {
      // Ignore previous errors so the queue doesn't break
    }
    return await fn();
  })();

  activeLocks.set(name, current);
  try {
    return await current;
  } finally {
    if (activeLocks.get(name) === current) {
      activeLocks.delete(name);
    }
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    lock: memoryLock,
  },
});
