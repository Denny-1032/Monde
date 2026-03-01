-- ============================================
-- 006: Disable email confirmation for phone-derived emails
-- Since we use synthetic emails (e.g. 260971234567@monde.app),
-- we need to auto-confirm them so users can sign in immediately.
-- ============================================

-- Auto-confirm new users on signup
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-confirm email for monde.app synthetic emails
  IF NEW.email LIKE '%@monde.app' THEN
    NEW.email_confirmed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_confirm ON auth.users;

CREATE TRIGGER on_auth_user_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user();
