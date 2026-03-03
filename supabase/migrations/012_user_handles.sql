-- ============================================
-- 012: User Handles (@username)
-- ============================================
-- Adds unique handles to profiles for Venmo-style transactions

-- Add handle column to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS handle TEXT UNIQUE;

-- Index for fast handle lookups
CREATE INDEX IF NOT EXISTS idx_profiles_handle ON public.profiles(handle);

-- Function to generate a default handle from full_name on signup
CREATE OR REPLACE FUNCTION public.generate_default_handle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_handle TEXT;
  candidate TEXT;
  suffix INT := 0;
BEGIN
  -- Generate base handle from full_name: lowercase, replace spaces with dots, strip non-alphanumeric
  base_handle := lower(regexp_replace(
    regexp_replace(NEW.full_name, '\s+', '.', 'g'),
    '[^a-z0-9.]', '', 'g'
  ));
  
  -- Ensure minimum length
  IF length(base_handle) < 3 THEN
    base_handle := base_handle || 'user';
  END IF;
  
  -- Truncate to 20 chars max for the base
  base_handle := left(base_handle, 20);
  
  candidate := base_handle;
  
  -- Check for uniqueness and append a number if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = candidate AND id != NEW.id) LOOP
    suffix := suffix + 1;
    candidate := base_handle || suffix::TEXT;
  END LOOP;
  
  NEW.handle := candidate;
  RETURN NEW;
END;
$$;

-- Trigger: auto-generate handle on INSERT if not provided
CREATE TRIGGER on_profile_generate_handle
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.handle IS NULL)
  EXECUTE FUNCTION public.generate_default_handle();

-- Function to lookup a user by handle (for payments)
CREATE OR REPLACE FUNCTION public.lookup_by_handle(p_handle TEXT)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  -- Must be authenticated
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('found', false, 'error', 'Not authenticated');
  END IF;
  
  SELECT json_build_object(
    'found', true,
    'id', p.id,
    'phone', p.phone,
    'full_name', p.full_name,
    'handle', p.handle,
    'avatar_url', p.avatar_url
  ) INTO result
  FROM public.profiles p
  WHERE p.handle = lower(p_handle);
  
  IF result IS NULL THEN
    RETURN json_build_object('found', false);
  END IF;
  
  RETURN result;
END;
$$;
