-- ============================================
-- 018: Fix RPCs for Phone-Based Auth
-- ============================================
-- After switching from email-based to phone-based auth:
-- 1. check_phone_registered: also check auth.users.phone (not just derived email)
-- 2. ensure_profile_exists: remove 'Monde User' default

-- Fix check_phone_registered to work with phone-based auth
CREATE OR REPLACE FUNCTION public.check_phone_registered(p_phone TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check profiles table
  IF EXISTS (SELECT 1 FROM public.profiles WHERE phone = p_phone) THEN
    RETURN true;
  END IF;

  -- Check auth.users by phone field (phone-based auth)
  IF EXISTS (SELECT 1 FROM auth.users WHERE phone = p_phone) THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Fix ensure_profile_exists: remove 'Monde User' default
CREATE OR REPLACE FUNCTION public.ensure_profile_exists(
  p_user_id UUID,
  p_phone TEXT,
  p_full_name TEXT DEFAULT 'User',
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
