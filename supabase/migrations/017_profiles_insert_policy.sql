-- ============================================
-- 017: Add INSERT RLS Policy for Profiles
-- ============================================
-- Previously, profiles were auto-created by the handle_new_user trigger
-- (SECURITY DEFINER, bypasses RLS). Now that profile creation is deferred
-- to after OTP verification, the app needs to INSERT profiles directly.
-- Without this policy, profile creation fails silently → blank home screen.

-- Allow authenticated users to insert their own profile (id must match auth.uid())
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);
