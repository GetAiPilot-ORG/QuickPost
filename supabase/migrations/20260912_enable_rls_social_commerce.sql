-- ============================================================================
-- SQL Migration: Enable Row Level Security (RLS) on Social Commerce & Lead Tables
-- Tables Fixed:
--   1. public.social_payments
--   2. public.leads
--   3. public.products
--   4. public.orders
-- ============================================================================

-- Helper: Ensure is_admin() function exists
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()), 
    false
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 1. Table: public.social_payments
-- ============================================================================
ALTER TABLE IF EXISTS public.social_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and manage own social payments" ON public.social_payments;
CREATE POLICY "Users can view and manage own social payments"
  ON public.social_payments
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Admins have full access to social payments" ON public.social_payments;
CREATE POLICY "Admins have full access to social payments"
  ON public.social_payments
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role has full access to social payments" ON public.social_payments;
CREATE POLICY "Service role has full access to social payments"
  ON public.social_payments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 2. Table: public.leads
-- ============================================================================
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and manage own leads" ON public.leads;
CREATE POLICY "Users can view and manage own leads"
  ON public.leads
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Admins have full access to leads" ON public.leads;
CREATE POLICY "Admins have full access to leads"
  ON public.leads
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role has full access to leads" ON public.leads;
CREATE POLICY "Service role has full access to leads"
  ON public.leads
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 3. Table: public.products
-- ============================================================================
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and manage own products" ON public.products;
CREATE POLICY "Users can view and manage own products"
  ON public.products
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Admins have full access to products" ON public.products;
CREATE POLICY "Admins have full access to products"
  ON public.products
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role has full access to products" ON public.products;
CREATE POLICY "Service role has full access to products"
  ON public.products
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- 4. Table: public.orders
-- ============================================================================
ALTER TABLE IF EXISTS public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view and manage own orders" ON public.orders;
CREATE POLICY "Users can view and manage own orders"
  ON public.orders
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

DROP POLICY IF EXISTS "Admins have full access to orders" ON public.orders;
CREATE POLICY "Admins have full access to orders"
  ON public.orders
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Service role has full access to orders" ON public.orders;
CREATE POLICY "Service role has full access to orders"
  ON public.orders
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
