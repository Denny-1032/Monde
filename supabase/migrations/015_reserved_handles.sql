-- ============================================
-- 015: Reserved Handles & Handle Cleanup
-- ============================================
-- Reserves system handles (e.g. @monde, @admin) and updates
-- the handle generation trigger to avoid assigning reserved names.

-- Update the default handle generator to skip reserved handles
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
  reserved TEXT[] := ARRAY[
    'monde', 'admin', 'support', 'help', 'system', 'official',
    'moderator', 'mod', 'staff', 'team', 'bot', 'api', 'app',
    'user', 'test', 'root', 'null', 'undefined', 'mondeuser',
    'monde.user', 'monde.app', 'mondeapp'
  ];
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
  
  -- If the candidate is reserved, start with suffix 1
  IF candidate = ANY(reserved) THEN
    suffix := 1;
    candidate := base_handle || suffix::TEXT;
  END IF;
  
  -- Check for uniqueness and append a number if needed
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = candidate AND id != NEW.id)
        OR candidate = ANY(reserved) LOOP
    suffix := suffix + 1;
    candidate := base_handle || suffix::TEXT;
  END LOOP;
  
  NEW.handle := candidate;
  RETURN NEW;
END;
$$;

-- Update any existing profiles that have reserved handles
UPDATE public.profiles
SET handle = handle || floor(random() * 9000 + 1000)::TEXT
WHERE handle IN (
  'monde', 'admin', 'support', 'help', 'system', 'official',
  'moderator', 'mod', 'staff', 'team', 'bot', 'api', 'app',
  'user', 'test', 'root', 'null', 'undefined', 'mondeuser',
  'monde.user', 'monde.app', 'mondeapp'
);
