-- ============================================================
-- QuickPost — Drop Redundant social_tokens Composite Index Migration
-- Run this in your Supabase SQL Editor (one-time cleanup)
-- ============================================================

-- ── 1. Drop only the redundant composite index ───────────────
DROP INDEX IF EXISTS idx_social_tokens_user_provider;

-- ── 2. Verification query ───────────────────────────────────
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'social_tokens'
ORDER BY indexname;
