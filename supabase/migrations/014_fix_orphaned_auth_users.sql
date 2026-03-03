-- ============================================
-- 014: Fix orphaned auth users (profile deleted but auth.users entry remains)
-- ============================================
-- 1. RPC to check if phone is registered at auth level (not just profiles)
-- 2. RPC to recreate a missing profile for an existing auth user

-- ============================================
-- check_phone_registered: checks BOTH profiles and auth.users
-- Used during registration to detect orphaned auth entries
-- ============================================
CREATE OR REPLACE FUNCTION public.check_phone_registered(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT;
BEGIN
  -- Check profiles table first
  IF EXISTS (SELECT 1 FROM public.profiles WHERE phone = p_phone) THEN
    RETURN true;
  END IF;

  -- Check auth.users by derived email (phone → email format used by Monde)
  v_email := regexp_replace(p_phone, '[^0-9]', '', 'g') || '@monde.app';
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- ============================================
-- ensure_profile_exists: recreates a missing profile for an authenticated user
-- Called after sign-in if the profile row is missing (orphaned auth user)
-- ============================================
CREATE OR REPLACE FUNCTION public.ensure_profile_exists(
  p_user_id UUID,
  p_phone TEXT,
  p_full_name TEXT DEFAULT 'Monde User',
  p_provider TEXT DEFAULT 'airtel'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  -- Must be authenticated as this user
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Check if profile already exists
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_user_id;
  IF FOUND THEN
    RETURN json_build_object('success', true, 'action', 'existing');
  END IF;

  -- Create the missing profile
  INSERT INTO public.profiles (id, phone, full_name, provider, balance, currency)
  VALUES (p_user_id, p_phone, p_full_name, p_provider, 0.00, 'ZMW')
  ON CONFLICT (id) DO NOTHING;

  RETURN json_build_object('success', true, 'action', 'created');
END;
$$;
