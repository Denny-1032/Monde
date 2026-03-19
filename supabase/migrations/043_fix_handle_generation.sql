-- ============================================
-- 043: Fix Handle Generation — Uppercase Letters Stripped
-- ============================================
-- Bug: generate_default_handle() applied lower() AFTER stripping [^a-z0-9.],
-- which removed uppercase letters (J, D, etc.) before lowering them.
-- Result: "John Doe" → "ohn.oe" instead of "john.doe".
-- Fix: Apply lower() FIRST, then strip non-alphanumeric characters.
-- Also regenerates broken handles for existing users.

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
  -- Fix: lower() FIRST, then replace spaces with dots, then strip non-alphanumeric
  base_handle := regexp_replace(
    regexp_replace(lower(NEW.full_name), '\s+', '.', 'g'),
    '[^a-z0-9.]', '', 'g'
  );
  
  -- Remove leading/trailing dots and collapse consecutive dots
  base_handle := regexp_replace(base_handle, '\.{2,}', '.', 'g');
  base_handle := trim(BOTH '.' FROM base_handle);
  
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

-- Regenerate broken handles for existing users whose handles look truncated
-- (handles that don't start with the first letter of their name)
DO $$
DECLARE
  r RECORD;
  new_handle TEXT;
  base TEXT;
  candidate TEXT;
  suffix INT;
  reserved TEXT[] := ARRAY[
    'monde', 'admin', 'support', 'help', 'system', 'official',
    'moderator', 'mod', 'staff', 'team', 'bot', 'api', 'app',
    'user', 'test', 'root', 'null', 'undefined', 'mondeuser',
    'monde.user', 'monde.app', 'mondeapp'
  ];
BEGIN
  FOR r IN
    SELECT id, full_name, handle
    FROM public.profiles
    WHERE full_name IS NOT NULL
      AND length(full_name) > 0
      AND handle IS NOT NULL
      -- Handle doesn't start with the expected first letter
      AND left(handle, 1) != left(lower(full_name), 1)
  LOOP
    -- Generate correct handle
    base := regexp_replace(
      regexp_replace(lower(r.full_name), '\s+', '.', 'g'),
      '[^a-z0-9.]', '', 'g'
    );
    base := regexp_replace(base, '\.{2,}', '.', 'g');
    base := trim(BOTH '.' FROM base);
    IF length(base) < 3 THEN base := base || 'user'; END IF;
    base := left(base, 20);
    
    candidate := base;
    suffix := 0;
    
    IF candidate = ANY(reserved) THEN
      suffix := 1;
      candidate := base || suffix::TEXT;
    END IF;
    
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE handle = candidate AND id != r.id)
          OR candidate = ANY(reserved) LOOP
      suffix := suffix + 1;
      candidate := base || suffix::TEXT;
    END LOOP;
    
    UPDATE public.profiles SET handle = candidate WHERE id = r.id;
  END LOOP;
END;
$$;
