-- ====================================================================
-- GAP SocialGrowth — Admin Financial & Customer Intelligence Schema
-- ====================================================================

-- 1. Create sg_admin_analytics table for persistent financial auditing
CREATE TABLE IF NOT EXISTS public.sg_admin_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_customers INTEGER NOT NULL DEFAULT 0,
  total_revenue_billed NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  total_provider_spend NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  net_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  profit_margin_pct NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
  total_orders_count INTEGER NOT NULL DEFAULT 0,
  total_wallet_liability NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  telesmm_live_balance NUMERIC(12, 2) DEFAULT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create index for fast date querying
CREATE INDEX IF NOT EXISTS idx_sg_admin_analytics_date ON public.sg_admin_analytics(snapshot_date);

-- 3. Enable RLS
ALTER TABLE public.sg_admin_analytics ENABLE ROW LEVEL SECURITY;

-- 4. Service role full access policy
CREATE POLICY "Allow service_role full access to sg_admin_analytics"
  ON public.sg_admin_analytics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
