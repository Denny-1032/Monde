-- ============================================
-- 016: Defer Profile Creation to After OTP Verification
-- ============================================
-- Previously, handle_new_user() auto-created a profile row on every
-- auth.users INSERT. This caused:
--   1. Profiles appearing before OTP verification
--   2. 'Monde User' placeholder names when metadata was missing
--   3. Duplicate profiles for phone-auth vs email-auth users
--
-- Now: profiles are created by the app AFTER OTP verification succeeds,
-- via the ensureProfileExists RPC. The handle generation trigger on
-- profiles INSERT still fires normally.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No-op: profile creation is now handled by the app after OTP verification.
  -- The generate_default_handle trigger on profiles INSERT still fires.
  RETURN NEW;
END;
$$;
