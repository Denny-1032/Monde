-- ============================================
-- Migration 039: Fix RLS infinite recursion on profiles
-- ============================================
-- ROOT CAUSE: Migration 038 added "Admin can view all profiles" policy
-- that does SELECT on profiles inside a SELECT policy ON profiles → infinite recursion.
-- FIX: Use SECURITY DEFINER helper functions that bypass RLS.

-- ============================================
-- 1. Create SECURITY DEFINER helpers for admin/agent checks
--    These bypass RLS so they don't trigger policy recursion
-- ============================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true);
$$;

CREATE OR REPLACE FUNCTION public.is_agent()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_agent = true);
$$;

-- ============================================
-- 2. Drop the recursive admin profiles policy
-- ============================================
DROP POLICY IF EXISTS "Admin can view all profiles" ON public.profiles;

-- ============================================
-- 3. Recreate admin profiles policy using the SECURITY DEFINER helper
-- ============================================
CREATE POLICY "Admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (is_admin());

-- ============================================
-- 4. Fix cash_out_requests policy to use helpers instead of subqueries
-- ============================================
DROP POLICY IF EXISTS "Users can view own or agent cash out requests" ON public.cash_out_requests;

CREATE POLICY "Users can view own or agent cash out requests"
  ON public.cash_out_requests FOR SELECT
  USING (
    customer_id = auth.uid()
    OR agent_id = auth.uid()
    OR is_agent()
    OR is_admin()
  );

-- ============================================
-- 5. Ensure is_frozen column exists (may be missing if 034 wasn't applied)
-- ============================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_frozen'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_frozen BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;
