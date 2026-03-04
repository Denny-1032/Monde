-- ============================================
-- 019: Restore handle_new_user Trigger for Phone-Based Auth
-- ============================================
-- Migration 016 made handle_new_user() a no-op, deferring profile creation
-- to the app (ensureProfileExists RPC after OTP verification). However,
-- the app-side path is fragile — it depends on the client having a valid
-- session token at exactly the right moment after verifyOtp. If auth.uid()
-- is null or mismatched for ANY reason (timing, race, token propagation),
-- all fallback tiers fail silently and the profile is never created.
--
-- The trigger is the most reliable path because:
--   1. It's SECURITY DEFINER — bypasses RLS entirely
--   2. It fires automatically on every auth.users INSERT (signUp)
--   3. It doesn't depend on client session state
--
-- Original concerns from migration 016 are no longer valid:
--   - "Profiles before OTP" → harmless; user can't log in until verified
--   - "Placeholder names" → signUp now passes full_name in metadata
--   - "Duplicate profiles" → irrelevant; fully on phone-based auth now
--
-- ON CONFLICT ensures idempotency with the app-side ensureProfileExists backup.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, full_name, provider, balance, currency)
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'provider', 'airtel'),
    0.00,
    'ZMW'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
