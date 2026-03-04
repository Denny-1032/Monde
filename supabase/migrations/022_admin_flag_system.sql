-- ============================================
-- Migration 022: Admin Flag System
-- ============================================
-- Replaces hardcoded UUID 0 admin with flexible is_admin flag.
-- Any user can be promoted to admin by setting is_admin = true.
-- Fee collection still goes to the Monde system account (UUID 0).
-- ============================================

-- 1. Add is_admin column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- 2. Create index for admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON public.profiles(is_admin) WHERE is_admin = TRUE;

-- 3. Update admin RPC functions to check is_admin flag instead of hardcoded UUID
-- This allows any admin user to call these functions from the app

CREATE OR REPLACE FUNCTION public.get_monde_fee_summary()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_admin BOOLEAN;
  v_result JSON;
BEGIN
  -- Check if caller is admin
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = v_caller_id;
    IF NOT COALESCE(v_is_admin, FALSE) THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized: admin access only');
    END IF;
  ELSE
    -- No auth context = service_role, allow
    NULL;
  END IF;

  SELECT json_build_object(
    'success', true,
    'total_fees_collected', COALESCE(SUM(fee_amount), 0),
    'topup_fees', COALESCE(SUM(CASE WHEN fee_type = 'topup_fee' THEN fee_amount ELSE 0 END), 0),
    'withdraw_fees', COALESCE(SUM(CASE WHEN fee_type = 'withdraw_fee' THEN fee_amount ELSE 0 END), 0),
    'payment_fees', COALESCE(SUM(CASE WHEN fee_type = 'payment_fee' THEN fee_amount ELSE 0 END), 0),
    'admin_balance', (SELECT COALESCE(balance, 0) FROM profiles WHERE id = '00000000-0000-0000-0000-000000000000'),
    'total_fee_transactions', COUNT(*)
  ) INTO v_result
  FROM monde_fees;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_monde_fees_by_period(
  p_start TIMESTAMPTZ DEFAULT NULL,
  p_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_admin BOOLEAN;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_result JSON;
BEGIN
  -- Check if caller is admin
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = v_caller_id;
    IF NOT COALESCE(v_is_admin, FALSE) THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized: admin access only');
    END IF;
  END IF;

  v_start := COALESCE(p_start, NOW() - INTERVAL '30 days');
  v_end := COALESCE(p_end, NOW());

  SELECT json_build_object(
    'success', true,
    'period_start', v_start,
    'period_end', v_end,
    'total_fees', COALESCE(SUM(fee_amount), 0),
    'topup_fees', COALESCE(SUM(CASE WHEN fee_type = 'topup_fee' THEN fee_amount ELSE 0 END), 0),
    'withdraw_fees', COALESCE(SUM(CASE WHEN fee_type = 'withdraw_fee' THEN fee_amount ELSE 0 END), 0),
    'payment_fees', COALESCE(SUM(CASE WHEN fee_type = 'payment_fee' THEN fee_amount ELSE 0 END), 0),
    'transaction_count', COUNT(*)
  ) INTO v_result
  FROM monde_fees
  WHERE created_at >= v_start AND created_at <= v_end;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_monde_total_float()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_admin BOOLEAN;
  v_result JSON;
BEGIN
  -- Check if caller is admin
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = v_caller_id;
    IF NOT COALESCE(v_is_admin, FALSE) THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized: admin access only');
    END IF;
  END IF;

  SELECT json_build_object(
    'success', true,
    'total_float', COALESCE(SUM(CASE WHEN id != '00000000-0000-0000-0000-000000000000' THEN balance ELSE 0 END), 0),
    'admin_balance', COALESCE(SUM(CASE WHEN id = '00000000-0000-0000-0000-000000000000' THEN balance ELSE 0 END), 0),
    'system_total', COALESCE(SUM(balance), 0),
    'users_with_balance', COUNT(*) FILTER (WHERE balance > 0 AND id != '00000000-0000-0000-0000-000000000000'),
    'total_users', COUNT(*) FILTER (WHERE id != '00000000-0000-0000-0000-000000000000')
  ) INTO v_result
  FROM profiles;

  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_monde_fee_details(
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_fee_type TEXT DEFAULT NULL,
  p_start TIMESTAMPTZ DEFAULT NULL,
  p_end TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_is_admin BOOLEAN;
  v_result JSON;
  v_total INT;
BEGIN
  -- Check if caller is admin
  v_caller_id := auth.uid();
  IF v_caller_id IS NOT NULL THEN
    SELECT is_admin INTO v_is_admin FROM profiles WHERE id = v_caller_id;
    IF NOT COALESCE(v_is_admin, FALSE) THEN
      RETURN json_build_object('success', false, 'error', 'Unauthorized: admin access only');
    END IF;
  END IF;

  -- Get total count
  SELECT COUNT(*) INTO v_total
  FROM monde_fees mf
  WHERE (p_fee_type IS NULL OR mf.fee_type = p_fee_type)
    AND (p_start IS NULL OR mf.created_at >= p_start)
    AND (p_end IS NULL OR mf.created_at <= p_end);

  -- Get paginated results with user info
  SELECT json_build_object(
    'success', true,
    'data', COALESCE(json_agg(row_to_json(t)), '[]'::json),
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  ) INTO v_result
  FROM (
    SELECT 
      mf.id,
      mf.transaction_id,
      mf.fee_type,
      mf.gross_amount,
      mf.fee_amount,
      mf.currency,
      mf.user_id,
      p.full_name AS user_name,
      p.phone AS user_phone,
      mf.created_at
    FROM monde_fees mf
    LEFT JOIN profiles p ON p.id = mf.user_id
    WHERE (p_fee_type IS NULL OR mf.fee_type = p_fee_type)
      AND (p_start IS NULL OR mf.created_at >= p_start)
      AND (p_end IS NULL OR mf.created_at <= p_end)
    ORDER BY mf.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) t;

  RETURN v_result;
END;
$$;

-- 4. Helper function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  SELECT is_admin INTO v_is_admin 
  FROM profiles 
  WHERE id = auth.uid();
  
  RETURN COALESCE(v_is_admin, FALSE);
END;
$$;

-- Grant execute to authenticated users (the function itself checks admin status)
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

-- 5. Clean up orphaned admin identity (the auth.users row doesn't exist)
DELETE FROM auth.identities 
WHERE user_id = '00000000-0000-0000-0000-000000000000';

-- 6. Ensure Monde fee collection account exists in profiles only (no auth needed)
-- This is just a ledger account, not a login account
INSERT INTO public.profiles (id, phone, full_name, handle, provider, balance, currency, is_admin)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '+260000000000',
  'Monde',
  'monde',
  'monde',
  0.00,
  'ZMW',
  FALSE  -- The fee collection account is NOT an admin user
) ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  handle = EXCLUDED.handle,
  is_admin = FALSE;

-- Done! Now run this to promote a user to admin:
-- UPDATE profiles SET is_admin = TRUE WHERE phone = '+260970627630';
