-- ============================================
-- 036: Add unique 6-digit Monde Agent Code
--
-- Each agent gets a unique code like "MND-123456" assigned
-- when admin grants agent status. This code serves as
-- the agent's handle for transactions.
-- ============================================

-- Add agent_code column
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS agent_code TEXT UNIQUE;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_agent_code ON profiles(agent_code) WHERE agent_code IS NOT NULL;

-- Helper: generate a unique 6-digit agent code
CREATE OR REPLACE FUNCTION public.generate_agent_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_attempts INT := 0;
BEGIN
  LOOP
    v_code := 'MND-' || LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE agent_code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'Could not generate unique agent code';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

-- Update admin_toggle_agent to assign/clear agent code
CREATE OR REPLACE FUNCTION public.admin_toggle_agent(p_user_id UUID, p_is_agent BOOLEAN)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  IF p_is_agent THEN
    -- Assign agent code if not already set
    SELECT agent_code INTO v_code FROM profiles WHERE id = p_user_id;
    IF v_code IS NULL THEN
      v_code := generate_agent_code();
    END IF;
    UPDATE profiles SET is_agent = true, agent_code = v_code, handle = v_code WHERE id = p_user_id;
  ELSE
    -- Remove agent status but keep the code for audit trail
    UPDATE profiles SET is_agent = false WHERE id = p_user_id;
    v_code := NULL;
  END IF;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN json_build_object('success', true, 'is_agent', p_is_agent, 'agent_code', v_code);
END;
$$;

-- Backfill: assign codes to existing agents that don't have one
DO $$
DECLARE
  r RECORD;
  v_code TEXT;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE is_agent = true AND agent_code IS NULL LOOP
    v_code := generate_agent_code();
    UPDATE profiles SET agent_code = v_code, handle = v_code WHERE id = r.id;
  END LOOP;
END;
$$;
