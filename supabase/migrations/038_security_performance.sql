-- ============================================
-- Migration 038: Security Hardening & Performance
-- ============================================

-- ============================================
-- 1. SECURITY: Restrict cash_out_requests SELECT policy
--    Currently USING(true) — any user can read ALL requests
-- ============================================
DROP POLICY IF EXISTS "Anyone can read cash out requests" ON public.cash_out_requests;

CREATE POLICY "Users can view own or agent cash out requests"
  ON public.cash_out_requests FOR SELECT
  USING (
    customer_id = auth.uid()
    OR agent_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_agent = true)
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ============================================
-- 2. SECURITY: Add admin SELECT policy for profiles
--    Admin needs to see all profiles for account management
--    Normal users only need phone/name for recipient lookup
-- ============================================
-- Keep existing "Users can lookup profiles by phone" (auth.uid() IS NOT NULL)
-- but add explicit admin policy for clarity
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin can view all profiles' AND tablename = 'profiles') THEN
    CREATE POLICY "Admin can view all profiles"
      ON public.profiles FOR SELECT
      USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
  END IF;
END $$;

-- ============================================
-- 3. PERFORMANCE: Add indexes for common query patterns
-- ============================================

-- Index for getTransactions OR query (sender_id OR recipient_id)
CREATE INDEX IF NOT EXISTS idx_transactions_recipient_id
  ON public.transactions(recipient_id);

-- Already have idx on sender_id from creation, but ensure it exists
CREATE INDEX IF NOT EXISTS idx_transactions_sender_id
  ON public.transactions(sender_id);

-- Composite index for transaction type + status + date filtering (admin_list_agents subqueries)
CREATE INDEX IF NOT EXISTS idx_transactions_type_status_completed
  ON public.transactions(type, status, completed_at)
  WHERE status = 'completed';

-- Index for agent cash-in daily limit check
CREATE INDEX IF NOT EXISTS idx_transactions_cashin_daily
  ON public.transactions(sender_id, type, status, completed_at)
  WHERE type = 'cash_in' AND status = 'completed';

-- Index for agent transfer volume check
CREATE INDEX IF NOT EXISTS idx_transactions_agent_transfer
  ON public.transactions(sender_id, type, status, completed_at)
  WHERE type = 'agent_transfer' AND status = 'completed';

-- Index for cash_out_requests agent performance
CREATE INDEX IF NOT EXISTS idx_cashout_agent_completed
  ON public.cash_out_requests(agent_id, status, completed_at)
  WHERE status = 'completed';

-- Index for phone lookup (used in P2P, deposits, transfers)
CREATE INDEX IF NOT EXISTS idx_profiles_phone
  ON public.profiles(phone);

-- Index for agent listing
CREATE INDEX IF NOT EXISTS idx_profiles_is_agent
  ON public.profiles(is_agent)
  WHERE is_agent = true;

-- Index for admin search by agent_code
CREATE INDEX IF NOT EXISTS idx_profiles_agent_code
  ON public.profiles(agent_code)
  WHERE agent_code IS NOT NULL;

-- Index for monde_fees reporting
CREATE INDEX IF NOT EXISTS idx_monde_fees_type
  ON public.monde_fees(fee_type, created_at);

-- ============================================
-- 4. SECURITY: Harden admin_toggle_agent with agent_code generation
--    Re-create to ensure it uses digits-only codes
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_toggle_agent(
  p_user_id UUID,
  p_is_agent BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: admin only');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Cannot make admin an agent
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND is_admin = true) THEN
    RETURN json_build_object('success', false, 'error', 'Cannot toggle agent status on admin accounts');
  END IF;

  IF p_is_agent THEN
    v_code := generate_agent_code();
    UPDATE profiles SET is_agent = true, agent_code = v_code WHERE id = p_user_id;
  ELSE
    UPDATE profiles SET is_agent = false WHERE id = p_user_id;
  END IF;

  RETURN json_build_object('success', true, 'is_agent', p_is_agent, 'agent_code', v_code);
END;
$$;

-- ============================================
-- 5. PERFORMANCE: Optimize admin_list_agents with proper subquery structure
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_list_agents()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agents JSON;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: admin only');
  END IF;

  SELECT json_agg(row_to_json(a)) INTO v_agents FROM (
    SELECT
      p.id,
      p.phone,
      p.full_name,
      p.handle,
      p.agent_code,
      p.balance,
      p.is_frozen,
      p.is_agent,
      p.created_at,
      COALESCE((
        SELECT COUNT(*) FROM cash_out_requests
        WHERE agent_id = p.id AND status = 'completed'
        AND completed_at >= CURRENT_DATE
      ), 0) AS cashouts_today,
      COALESCE((
        SELECT COUNT(*) FROM transactions
        WHERE type = 'cash_in' AND recipient_id = p.id
        AND status = 'completed'
        AND completed_at >= CURRENT_DATE
      ), 0) AS cashin_today,
      COALESCE((
        SELECT SUM(agent_commission) FROM cash_out_requests
        WHERE agent_id = p.id AND status = 'completed'
      ), 0) AS total_cashout_commission,
      COALESCE((
        SELECT SUM(amount) FROM transactions
        WHERE type = 'agent_transfer' AND sender_id = p.id
        AND status = 'completed'
        AND completed_at >= CURRENT_DATE
      ), 0) AS transfer_volume_today
    FROM profiles p
    WHERE p.is_agent = true
    ORDER BY p.full_name
  ) a;

  RETURN json_build_object('success', true, 'agents', COALESCE(v_agents, '[]'::JSON));
END;
$$;

-- ============================================
-- 6. SECURITY: Add phone normalization helper for reuse
-- ============================================
CREATE OR REPLACE FUNCTION public.normalize_zambian_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_clean TEXT;
BEGIN
  v_clean := regexp_replace(p_phone, '[^0-9+]', '', 'g');
  IF v_clean LIKE '0%' THEN
    RETURN '+260' || substring(v_clean from 2);
  ELSIF v_clean LIKE '260%' AND NOT v_clean LIKE '+%' THEN
    RETURN '+' || v_clean;
  ELSIF v_clean NOT LIKE '+%' AND length(v_clean) = 9 THEN
    RETURN '+260' || v_clean;
  END IF;
  RETURN v_clean;
END;
$$;

-- ============================================
-- 7. SECURITY: Update agent_to_agent_transfer with phone normalization
-- ============================================
CREATE OR REPLACE FUNCTION public.agent_to_agent_transfer(
  p_recipient_phone TEXT,
  p_amount NUMERIC,
  p_note TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID;
  v_sender RECORD;
  v_recipient RECORD;
  v_reference TEXT;
  v_daily_volume NUMERIC;
  v_normalized_phone TEXT;
BEGIN
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_sender FROM profiles WHERE id = v_sender_id AND is_agent = true;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Only agents can transfer to other agents');
  END IF;

  IF v_sender.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'Your account has been frozen');
  END IF;

  IF p_amount <= 0 OR p_amount > 50000 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be between K1 and K50,000');
  END IF;

  IF v_sender.balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient float balance');
  END IF;

  -- Normalize phone
  v_normalized_phone := normalize_zambian_phone(p_recipient_phone);

  SELECT * INTO v_recipient FROM profiles WHERE phone = v_normalized_phone AND is_agent = true;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Recipient agent not found');
  END IF;

  IF v_recipient.id = v_sender_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot transfer to yourself');
  END IF;

  IF v_recipient.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'Recipient agent account is frozen');
  END IF;

  -- Daily cap check
  SELECT COALESCE(SUM(amount), 0) INTO v_daily_volume FROM transactions
  WHERE type = 'agent_transfer' AND sender_id = v_sender_id
    AND status = 'completed' AND completed_at >= CURRENT_DATE;

  IF (v_daily_volume + p_amount) > 50000 THEN
    RETURN json_build_object('success', false, 'error',
      'Daily agent transfer limit of K50,000 reached. Transferred today: K' || v_daily_volume);
  END IF;

  v_reference := 'ATR-' || gen_random_uuid()::TEXT;

  UPDATE profiles SET balance = balance - p_amount WHERE id = v_sender_id;
  UPDATE profiles SET balance = balance + p_amount WHERE id = v_recipient.id;

  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_sender_id, v_recipient.id, 'agent_transfer', p_amount, v_sender.currency,
    v_recipient.full_name, v_recipient.phone, v_sender.provider, 'completed', 'agent',
    COALESCE(p_note, 'Agent transfer'), v_reference, 0.00, now()
  );

  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_recipient.id, v_sender_id, 'receive', p_amount, v_recipient.currency,
    v_sender.full_name, v_sender.phone, v_recipient.provider, 'completed', 'agent',
    COALESCE(p_note, 'Agent transfer received'), v_reference || '-R', 0.00, now()
  );

  RETURN json_build_object(
    'success', true,
    'reference', v_reference,
    'amount', p_amount,
    'recipient_name', v_recipient.full_name,
    'new_balance', v_sender.balance - p_amount
  );
END;
$$;
