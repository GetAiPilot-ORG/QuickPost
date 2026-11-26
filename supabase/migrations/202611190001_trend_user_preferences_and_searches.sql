-- Migration: Trend Feed User Personalization & Search History
-- Allows users to save favorite creator niches in database and records recent searches
-- to personalize their infinite trend inspiration feed.

-- 1. Table for User Trend Preferences (Selected topics, niches, goals)
CREATE TABLE IF NOT EXISTS public.user_trend_preferences (
  user_id TEXT PRIMARY KEY,
  selected_topic_ids TEXT[] DEFAULT '{}',
  interests TEXT DEFAULT '',
  work TEXT DEFAULT '',
  goal TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on user_id for high-speed lookups
CREATE INDEX IF NOT EXISTS idx_user_trend_preferences_user_id ON public.user_trend_preferences(user_id);

-- Enable Row Level Security
ALTER TABLE public.user_trend_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own trend preferences" ON public.user_trend_preferences;
CREATE POLICY "Users can read own trend preferences"
  ON public.user_trend_preferences FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can upsert own trend preferences" ON public.user_trend_preferences;
CREATE POLICY "Users can upsert own trend preferences"
  ON public.user_trend_preferences FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. Table for User Trend Searches (Search history & trending intent)
CREATE TABLE IF NOT EXISTS public.user_trend_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  search_count INT DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_trend_searches_user_id ON public.user_trend_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trend_searches_created_at ON public.user_trend_searches(created_at DESC);

ALTER TABLE public.user_trend_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own trend searches" ON public.user_trend_searches;
CREATE POLICY "Users can read own trend searches"
  ON public.user_trend_searches FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own trend searches" ON public.user_trend_searches;
CREATE POLICY "Users can insert own trend searches"
  ON public.user_trend_searches FOR INSERT
  WITH CHECK (true);
