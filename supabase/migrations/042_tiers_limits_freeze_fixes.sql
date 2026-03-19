-- ============================================
-- 042: Account tiers, per-agent limits, frozen checks, agent send block, commission fix
-- ============================================

-- 0. Drop old function overloads that have different signatures
DROP FUNCTION IF EXISTS public.process_topup(UUID, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.process_withdraw(UUID, NUMERIC, TEXT, TEXT, TEXT);

-- 1. Add tier and per-user limit override columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS account_tier TEXT DEFAULT 'copper';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_deposit_limit INT DEFAULT 3;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS daily_withdraw_limit INT DEFAULT 3;

-- Add check constraint for tier values (safe: only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_account_tier_check') THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_account_tier_check CHECK (account_tier IN ('copper', 'gold', 'platinum'));
  END IF;
END $$;

-- 2. Helper: get tier balance cap and daily transaction cap
CREATE OR REPLACE FUNCTION public.get_tier_limits(p_tier TEXT)
RETURNS TABLE(balance_cap NUMERIC, daily_cap NUMERIC)
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  CASE p_tier
    WHEN 'gold' THEN
      balance_cap := 250000; daily_cap := 50000;
    WHEN 'platinum' THEN
      balance_cap := 500000; daily_cap := 100000;
    ELSE -- copper (default)
      balance_cap := 100000; daily_cap := 20000;
  END CASE;
  RETURN NEXT;
END;
$$;

-- 3. Helper: get user's daily outgoing transaction total (sends, withdrawals, cash_out fees)
CREATE OR REPLACE FUNCTION public.get_daily_outgoing(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN type IN ('send', 'withdraw', 'cash_out', 'agent_transfer') THEN amount + COALESCE(fee, 0)
      ELSE 0
    END
  ), 0) INTO v_total
  FROM transactions
  WHERE sender_id = p_user_id
    AND status = 'completed'
    AND completed_at >= CURRENT_DATE;
  RETURN v_total;
END;
$$;

-- ============================================
-- 4. Fix process_payment
--    - Block sends TO agent accounts
--    - Add tier balance cap check for recipient
--    - Add tier daily cap check for sender
-- ============================================
CREATE OR REPLACE FUNCTION public.process_payment(
  p_sender_id UUID,
  p_recipient_phone TEXT,
  p_amount NUMERIC,
  p_method public.payment_method DEFAULT 'qr',
  p_note TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender RECORD;
  v_recipient RECORD;
  v_txn_id UUID;
  v_reference TEXT;
  v_fee NUMERIC(12,2) := 0.00;
  v_monde_admin_id UUID := '00000000-0000-0000-0000-000000000000';
  v_normalized_phone TEXT;
  v_tier_limits RECORD;
  v_daily_out NUMERIC;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_sender_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;
  IF p_amount > 50000 THEN
    RETURN json_build_object('success', false, 'error', 'Amount exceeds maximum of K50,000');
  END IF;

  -- Normalize recipient phone
  v_normalized_phone := regexp_replace(p_recipient_phone, '[^0-9+]', '', 'g');
  IF v_normalized_phone LIKE '0%' THEN
    v_normalized_phone := '+260' || substring(v_normalized_phone from 2);
  ELSIF v_normalized_phone LIKE '260%' AND NOT v_normalized_phone LIKE '+%' THEN
    v_normalized_phone := '+' || v_normalized_phone;
  ELSIF v_normalized_phone NOT LIKE '+%' AND length(v_normalized_phone) = 9 THEN
    v_normalized_phone := '+260' || v_normalized_phone;
  END IF;

  -- Prevent send-to-self
  SELECT phone INTO v_sender FROM public.profiles WHERE id = p_sender_id;
  IF v_sender.phone = v_normalized_phone THEN
    RETURN json_build_object('success', false, 'error', 'Cannot send money to yourself');
  END IF;

  -- Block system accounts
  IF v_normalized_phone IN ('+260000000000', '+260000000001') THEN
    RETURN json_build_object('success', false, 'error', 'Cannot send money to system accounts');
  END IF;

  -- Fee: free <= K500, 0.5% above K500
  IF p_amount > 500 THEN
    v_fee := ROUND(p_amount * 0.005, 2);
  END IF;

  -- Lock sender
  SELECT * INTO v_sender FROM public.profiles WHERE id = p_sender_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Sender profile not found');
  END IF;

  -- Frozen check
  IF v_sender.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'Your account has been frozen. Contact support.');
  END IF;

  -- Block agents from P2P
  IF v_sender.is_agent THEN
    RETURN json_build_object('success', false, 'error', 'Agent accounts cannot send money directly. Use Deposit or Agent Transfer.');
  END IF;

  -- Tier: daily outgoing cap
  SELECT * INTO v_tier_limits FROM get_tier_limits(COALESCE(v_sender.account_tier, 'copper'));
  v_daily_out := get_daily_outgoing(p_sender_id);
  IF (v_daily_out + p_amount + v_fee) > v_tier_limits.daily_cap THEN
    RETURN json_build_object('success', false, 'error',
      'Daily transaction limit of K' || v_tier_limits.daily_cap || ' reached for your ' || COALESCE(v_sender.account_tier, 'copper') || ' tier. Used today: K' || v_daily_out);
  END IF;

  -- Balance check
  IF v_sender.balance < (p_amount + v_fee) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Find recipient (flexible: with or without + prefix)
  SELECT * INTO v_recipient FROM public.profiles
    WHERE (phone = v_normalized_phone OR phone = regexp_replace(v_normalized_phone, '^\+', ''))
      AND id != p_sender_id
    LIMIT 1;

  -- Block sends TO agent accounts
  IF v_recipient.id IS NOT NULL AND v_recipient.is_agent THEN
    RETURN json_build_object('success', false, 'error', 'Cannot send money to agent accounts. Visit the agent to make a deposit instead.');
  END IF;

  -- Tier: balance cap for recipient
  IF v_recipient.id IS NOT NULL THEN
    DECLARE v_recip_tier RECORD;
    BEGIN
      SELECT * INTO v_recip_tier FROM get_tier_limits(COALESCE(v_recipient.account_tier, 'copper'));
      IF (v_recipient.balance + p_amount) > v_recip_tier.balance_cap THEN
        RETURN json_build_object('success', false, 'error',
          'Recipient wallet would exceed their K' || v_recip_tier.balance_cap || ' balance limit');
      END IF;
    END;
  END IF;

  v_reference := 'TXN-' || gen_random_uuid()::TEXT;

  -- Deduct from sender
  UPDATE public.profiles SET balance = balance - (p_amount + v_fee) WHERE id = p_sender_id;

  -- Credit recipient
  IF v_recipient.id IS NOT NULL THEN
    UPDATE public.profiles SET balance = balance + p_amount WHERE id = v_recipient.id;
  END IF;

  -- Credit fee to Monde
  IF v_fee > 0 THEN
    UPDATE public.profiles SET balance = balance + v_fee WHERE id = v_monde_admin_id;
  END IF;

  -- Sender transaction
  INSERT INTO public.transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    p_sender_id, v_recipient.id, 'send', p_amount, v_sender.currency,
    COALESCE(v_recipient.full_name, 'External'), v_normalized_phone, 'monde',
    'completed', p_method, COALESCE(p_note, ''), v_reference, v_fee, now()
  ) RETURNING id INTO v_txn_id;

  -- Recipient mirror transaction
  IF v_recipient.id IS NOT NULL THEN
    INSERT INTO public.transactions (
      sender_id, recipient_id, type, amount, currency,
      recipient_name, recipient_phone, provider, status, method,
      note, reference, fee, completed_at
    ) VALUES (
      v_recipient.id, p_sender_id, 'receive', p_amount, v_recipient.currency,
      v_sender.full_name, v_sender.phone, 'monde', 'completed', p_method,
      COALESCE(p_note, ''), v_reference || '-R', 0.00, now()
    );
  END IF;

  -- Fee record
  IF v_fee > 0 THEN
    INSERT INTO public.monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
    VALUES (v_txn_id, 'payment_fee', p_amount, v_fee, v_sender.currency, p_sender_id);
  END IF;

  RETURN json_build_object(
    'success', true, 'transaction_id', v_txn_id, 'reference', v_reference,
    'amount', p_amount, 'fee', v_fee,
    'recipient_name', COALESCE(v_recipient.full_name, 'External'),
    'new_balance', v_sender.balance - (p_amount + v_fee)
  );
END;
$$;

-- ============================================
-- 5. Fix process_topup — add frozen check + tier balance cap
-- ============================================
CREATE OR REPLACE FUNCTION public.process_topup(
  p_user_id UUID,
  p_amount NUMERIC,
  p_provider TEXT,
  p_note TEXT DEFAULT NULL,
  p_linked_account_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_txn_id UUID;
  v_reference TEXT;
  v_total_fee NUMERIC(12,2) := 0.00;
  v_monde_fee NUMERIC(12,2) := 0.00;
  v_lipila_fee NUMERIC(12,2) := 0.00;
  v_provider_rec RECORD;
  v_monde_admin_id UUID := '00000000-0000-0000-0000-000000000000';
  v_tier_limits RECORD;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF p_amount < 5 THEN
    RETURN json_build_object('success', false, 'error', 'Minimum top-up amount is K5');
  END IF;
  IF p_amount > 50000 THEN
    RETURN json_build_object('success', false, 'error', 'Amount exceeds maximum of K50,000');
  END IF;

  SELECT * INTO v_provider_rec FROM public.providers WHERE id = p_provider;
  IF FOUND THEN
    IF p_amount < v_provider_rec.min_amount THEN
      RETURN json_build_object('success', false, 'error', 'Amount below minimum of K' || v_provider_rec.min_amount);
    END IF;
    IF p_amount > v_provider_rec.max_amount THEN
      RETURN json_build_object('success', false, 'error', 'Amount exceeds maximum of K' || v_provider_rec.max_amount);
    END IF;
  END IF;

  -- Flat 3% fee
  v_total_fee := ROUND(p_amount * 0.03, 2);
  v_lipila_fee := ROUND(p_amount * 0.025, 2);
  v_monde_fee := GREATEST(v_total_fee - v_lipila_fee, 0);

  SELECT * INTO v_user FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- FROZEN CHECK
  IF v_user.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'Your account has been frozen. Contact support.');
  END IF;

  -- TIER: balance cap check
  SELECT * INTO v_tier_limits FROM get_tier_limits(COALESCE(v_user.account_tier, 'copper'));
  IF (v_user.balance + p_amount) > v_tier_limits.balance_cap THEN
    RETURN json_build_object('success', false, 'error',
      'Top-up would exceed your K' || v_tier_limits.balance_cap || ' balance limit (' || COALESCE(v_user.account_tier, 'copper') || ' tier). Current balance: K' || v_user.balance);
  END IF;

  v_reference := 'TOP-' || gen_random_uuid()::TEXT;

  UPDATE public.profiles SET balance = balance + p_amount WHERE id = p_user_id;
  UPDATE public.profiles SET balance = balance + v_monde_fee WHERE id = v_monde_admin_id;

  INSERT INTO public.transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    p_user_id, p_user_id, 'topup', p_amount, v_user.currency,
    'Monde Wallet', v_user.phone, p_provider, 'completed', 'wallet',
    COALESCE(p_note, 'Top up from ' || COALESCE(v_provider_rec.name, p_provider)),
    v_reference, v_total_fee, now()
  ) RETURNING id INTO v_txn_id;

  INSERT INTO public.monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
  VALUES (v_txn_id, 'topup_fee', p_amount, v_monde_fee, v_user.currency, p_user_id);

  RETURN json_build_object(
    'success', true, 'transaction_id', v_txn_id, 'reference', v_reference,
    'amount', p_amount, 'fee', v_total_fee, 'monde_fee', v_monde_fee,
    'new_balance', v_user.balance + p_amount
  );
END;
$$;

-- ============================================
-- 6. Fix process_withdraw — add frozen check + tier daily cap
-- ============================================
CREATE OR REPLACE FUNCTION public.process_withdraw(
  p_user_id UUID,
  p_amount NUMERIC,
  p_provider TEXT,
  p_destination_phone TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_linked_account_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
  v_txn_id UUID;
  v_reference TEXT;
  v_total_fee NUMERIC(12,2) := 0.00;
  v_monde_fee NUMERIC(12,2) := 0.00;
  v_lipila_fee NUMERIC(12,2) := 0.00;
  v_provider_rec RECORD;
  v_dest_phone TEXT;
  v_monde_admin_id UUID := '00000000-0000-0000-0000-000000000000';
  v_tier_limits RECORD;
  v_daily_out NUMERIC;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF p_amount < 5 THEN
    RETURN json_build_object('success', false, 'error', 'Minimum withdrawal amount is K5');
  END IF;
  IF p_amount > 50000 THEN
    RETURN json_build_object('success', false, 'error', 'Amount exceeds maximum of K50,000');
  END IF;

  SELECT * INTO v_provider_rec FROM public.providers WHERE id = p_provider;
  IF FOUND THEN
    IF p_amount < v_provider_rec.min_amount THEN
      RETURN json_build_object('success', false, 'error', 'Amount below minimum of K' || v_provider_rec.min_amount);
    END IF;
    IF p_amount > v_provider_rec.max_amount THEN
      RETURN json_build_object('success', false, 'error', 'Amount exceeds maximum of K' || v_provider_rec.max_amount);
    END IF;
  END IF;

  -- Flat 3% fee
  v_total_fee := ROUND(p_amount * 0.03, 2);
  v_lipila_fee := ROUND(p_amount * 0.015, 2);
  v_monde_fee := GREATEST(v_total_fee - v_lipila_fee, 0);

  SELECT * INTO v_user FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- FROZEN CHECK
  IF v_user.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'Your account has been frozen. Contact support.');
  END IF;

  -- TIER: daily outgoing cap
  SELECT * INTO v_tier_limits FROM get_tier_limits(COALESCE(v_user.account_tier, 'copper'));
  v_daily_out := get_daily_outgoing(p_user_id);
  IF (v_daily_out + p_amount + v_total_fee) > v_tier_limits.daily_cap THEN
    RETURN json_build_object('success', false, 'error',
      'Daily transaction limit of K' || v_tier_limits.daily_cap || ' reached for your ' || COALESCE(v_user.account_tier, 'copper') || ' tier. Used today: K' || v_daily_out);
  END IF;

  -- Balance check
  IF v_user.balance < (p_amount + v_total_fee) THEN
    RETURN json_build_object('success', false, 'error',
      'Insufficient balance. Need K' || (p_amount + v_total_fee) || ' (K' || p_amount || ' + K' || v_total_fee || ' fee)');
  END IF;

  v_dest_phone := COALESCE(p_destination_phone, v_user.phone);
  v_reference := 'WDR-' || gen_random_uuid()::TEXT;

  UPDATE public.profiles SET balance = balance - (p_amount + v_total_fee) WHERE id = p_user_id;
  UPDATE public.profiles SET balance = balance + v_monde_fee WHERE id = v_monde_admin_id;

  INSERT INTO public.transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    p_user_id, p_user_id, 'withdraw', p_amount, v_user.currency,
    COALESCE(v_provider_rec.name, p_provider), v_dest_phone, p_provider, 'completed', 'wallet',
    COALESCE(p_note, 'Withdraw to ' || COALESCE(v_provider_rec.name, p_provider)),
    v_reference, v_total_fee, now()
  ) RETURNING id INTO v_txn_id;

  INSERT INTO public.monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
  VALUES (v_txn_id, 'withdraw_fee', p_amount, v_monde_fee, v_user.currency, p_user_id);

  RETURN json_build_object(
    'success', true, 'transaction_id', v_txn_id, 'reference', v_reference,
    'amount', p_amount, 'fee', v_total_fee, 'monde_fee', v_monde_fee,
    'new_balance', v_user.balance - (p_amount + v_total_fee)
  );
END;
$$;

-- ============================================
-- 7. Fix process_agent_cash_in
--    - Per-agent limit (not global) + respect per-user override
--    - Tier balance cap for customer
-- ============================================
CREATE OR REPLACE FUNCTION public.process_agent_cash_in(
  p_customer_phone TEXT,
  p_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_agent_id UUID;
  v_agent RECORD;
  v_customer RECORD;
  v_commission NUMERIC(12,2);
  v_reference TEXT;
  v_txn_id UUID;
  v_daily_deposits_from_agent INT;
  v_monde_admin_id UUID := '00000000-0000-0000-0000-000000000000';
  v_normalized_phone TEXT;
  v_deposit_limit INT;
  v_tier_limits RECORD;
BEGIN
  v_agent_id := auth.uid();
  IF v_agent_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_agent FROM profiles WHERE id = v_agent_id AND is_agent = true;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Not an agent');
  END IF;

  IF v_agent.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'Your account has been frozen. Contact support.');
  END IF;

  IF p_amount <= 0 OR p_amount > 5000 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be between K1 and K5,000');
  END IF;

  IF v_agent.balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient float balance');
  END IF;

  -- Normalize phone
  v_normalized_phone := regexp_replace(p_customer_phone, '[^0-9+]', '', 'g');
  IF v_normalized_phone LIKE '0%' THEN
    v_normalized_phone := '+260' || substring(v_normalized_phone from 2);
  ELSIF v_normalized_phone LIKE '260%' AND NOT v_normalized_phone LIKE '+%' THEN
    v_normalized_phone := '+' || v_normalized_phone;
  ELSIF v_normalized_phone NOT LIKE '+%' AND length(v_normalized_phone) = 9 THEN
    v_normalized_phone := '+260' || v_normalized_phone;
  END IF;

  SELECT * INTO v_customer FROM profiles WHERE phone = v_normalized_phone;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Customer not found on Monde');
  END IF;

  IF v_customer.id = v_agent_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot deposit to your own account');
  END IF;

  IF v_customer.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'Customer account is frozen');
  END IF;

  -- TIER: balance cap for customer
  SELECT * INTO v_tier_limits FROM get_tier_limits(COALESCE(v_customer.account_tier, 'copper'));
  IF (v_customer.balance + p_amount) > v_tier_limits.balance_cap THEN
    RETURN json_build_object('success', false, 'error',
      'Deposit would exceed customer wallet limit of K' || v_tier_limits.balance_cap || ' (' || COALESCE(v_customer.account_tier, 'copper') || ' tier)');
  END IF;

  -- Per-AGENT daily deposit limit for this customer (uses customer's override or default 3)
  v_deposit_limit := COALESCE(v_customer.daily_deposit_limit, 3);
  SELECT COUNT(*) INTO v_daily_deposits_from_agent FROM transactions
  WHERE type = 'cash_in' AND sender_id = v_customer.id AND recipient_id = v_agent_id
    AND status = 'completed' AND completed_at > now() - INTERVAL '24 hours';

  IF v_daily_deposits_from_agent >= v_deposit_limit THEN
    RETURN json_build_object('success', false, 'error',
      'Deposit limit reached: max ' || v_deposit_limit || ' deposits from this agent per 24 hours');
  END IF;

  -- Commission: 0.5%
  v_commission := ROUND(p_amount * 0.005, 2);
  v_reference := 'CIN-' || gen_random_uuid()::TEXT;

  -- Debit agent, credit customer
  UPDATE profiles SET balance = balance - p_amount WHERE id = v_agent_id;
  UPDATE profiles SET balance = balance + p_amount WHERE id = v_customer.id;

  -- Pay agent commission from fee ledger
  UPDATE profiles SET balance = balance + v_commission WHERE id = v_agent_id;
  UPDATE profiles SET balance = balance - v_commission WHERE id = v_monde_admin_id;

  -- Record transactions
  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_customer.id, v_agent_id, 'cash_in', p_amount, v_customer.currency,
    v_agent.full_name, v_agent.phone, v_customer.provider, 'completed', 'agent',
    'Cash deposit by agent', v_reference, 0.00, now()
  );

  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_agent_id, v_customer.id, 'send', p_amount, v_agent.currency,
    v_customer.full_name, v_customer.phone, v_agent.provider, 'completed', 'agent',
    'Cash deposit to customer', v_reference || '-A', 0.00, now()
  );

  -- Record commission in monde_fees
  INSERT INTO monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
  VALUES (
    (SELECT id FROM transactions WHERE reference = v_reference LIMIT 1),
    'cashin_fee', p_amount, -v_commission, v_customer.currency, v_agent_id
  );

  RETURN json_build_object(
    'success', true, 'reference', v_reference, 'amount', p_amount,
    'commission', v_commission,
    'customer_name', v_customer.full_name, 'customer_phone', v_customer.phone
  );
END;
$$;

-- ============================================
-- 8. Fix create_cash_out_request — add frozen check + tier daily cap
-- ============================================
CREATE OR REPLACE FUNCTION public.create_cash_out_request(p_amount NUMERIC)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_id UUID;
  v_fee_info JSON;
  v_fee NUMERIC(12,2);
  v_customer RECORD;
  v_attempts INT := 0;
  v_tier_limits RECORD;
  v_daily_out NUMERIC;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;
  IF p_amount > 5000 THEN
    RETURN json_build_object('success', false, 'error', 'Maximum Get Cash amount is K5,000');
  END IF;

  v_fee_info := calc_get_cash_fee(p_amount, 0);
  v_fee := (v_fee_info->>'fee')::NUMERIC;

  SELECT * INTO v_customer FROM profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;

  -- FROZEN CHECK
  IF v_customer.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'Your account has been frozen. Contact support.');
  END IF;

  -- TIER: daily outgoing cap
  SELECT * INTO v_tier_limits FROM get_tier_limits(COALESCE(v_customer.account_tier, 'copper'));
  v_daily_out := get_daily_outgoing(auth.uid());
  IF (v_daily_out + p_amount + v_fee) > v_tier_limits.daily_cap THEN
    RETURN json_build_object('success', false, 'error',
      'Daily transaction limit of K' || v_tier_limits.daily_cap || ' reached for your ' || COALESCE(v_customer.account_tier, 'copper') || ' tier');
  END IF;

  -- Balance check
  IF v_customer.balance < (p_amount + v_fee) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance. You need K' || (p_amount + v_fee)::TEXT);
  END IF;

  -- Generate unique 6-digit token
  LOOP
    v_token := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM cash_out_requests WHERE token = v_token AND status = 'pending' AND expires_at > now()
    );
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RETURN json_build_object('success', false, 'error', 'Could not generate unique code. Try again.');
    END IF;
  END LOOP;

  -- Expire existing pending requests
  UPDATE cash_out_requests SET status = 'expired' WHERE customer_id = auth.uid() AND status = 'pending';

  INSERT INTO cash_out_requests (customer_id, amount, fee, token)
  VALUES (auth.uid(), p_amount, v_fee, v_token)
  RETURNING id INTO v_id;

  RETURN json_build_object(
    'success', true, 'request_id', v_id, 'token', v_token,
    'amount', p_amount, 'fee', v_fee, 'total', p_amount + v_fee
  );
END;
$$;

-- ============================================
-- 9. Fix process_cash_out — add frozen check for agent + per-agent withdraw limit
-- ============================================
CREATE OR REPLACE FUNCTION public.process_cash_out(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_agent_id UUID := auth.uid();
  v_agent RECORD;
  v_customer RECORD;
  v_agent_daily_count INT;
  v_customer_cashouts_from_agent INT;
  v_fee_info JSON;
  v_fee NUMERIC(12,2);
  v_agent_commission NUMERIC(12,2);
  v_monde_fee NUMERIC(12,2);
  v_reference TEXT;
  v_monde_admin_id UUID := '00000000-0000-0000-0000-000000000000';
  v_customer_txn_id UUID;
  v_recent_deposit INT;
  v_withdraw_limit INT;
BEGIN
  IF v_agent_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_agent FROM profiles WHERE id = v_agent_id;
  IF NOT v_agent.is_agent THEN
    RETURN json_build_object('success', false, 'error', 'Only Monde agents can process cash-outs');
  END IF;

  -- FROZEN CHECK for agent
  IF v_agent.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'Your agent account has been frozen. Contact support.');
  END IF;

  SELECT * INTO v_req FROM cash_out_requests
  WHERE id = p_request_id AND status = 'pending' AND expires_at > now()
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found, already processed, or expired');
  END IF;

  IF v_req.customer_id = v_agent_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot process your own request');
  END IF;

  -- Anti-fraud: circular deposit→cashout
  SELECT COUNT(*) INTO v_recent_deposit FROM transactions
  WHERE type = 'cash_in' AND sender_id = v_req.customer_id AND recipient_id = v_agent_id
    AND status = 'completed' AND completed_at > now() - INTERVAL '24 hours';
  IF v_recent_deposit > 0 THEN
    RETURN json_build_object('success', false, 'error',
      'Cannot process cash-out: you deposited to this customer recently. Please wait 24 hours.');
  END IF;

  -- Per-AGENT withdraw limit for this customer (uses customer's override or default 3)
  SELECT * INTO v_customer FROM profiles WHERE id = v_req.customer_id FOR UPDATE;
  v_withdraw_limit := COALESCE(v_customer.daily_withdraw_limit, 3);

  SELECT COUNT(*) INTO v_customer_cashouts_from_agent FROM cash_out_requests
  WHERE customer_id = v_req.customer_id AND agent_id = v_agent_id
    AND status = 'completed' AND completed_at > now() - INTERVAL '24 hours';

  IF v_customer_cashouts_from_agent >= v_withdraw_limit THEN
    RETURN json_build_object('success', false, 'error',
      'Withdraw limit reached: max ' || v_withdraw_limit || ' cash-outs from this agent per 24 hours');
  END IF;

  -- Balance check
  IF v_customer.balance < (v_req.amount + v_req.fee) THEN
    RETURN json_build_object('success', false, 'error', 'Customer has insufficient balance');
  END IF;

  -- Fee split with volume bonus
  v_agent_daily_count := (
    SELECT COUNT(*) FROM cash_out_requests
    WHERE agent_id = v_agent_id AND status = 'completed' AND completed_at >= CURRENT_DATE
  );
  v_fee_info := calc_get_cash_fee(v_req.amount, v_agent_daily_count);
  v_fee := (v_fee_info->>'fee')::NUMERIC;
  v_agent_commission := (v_fee_info->>'agent_commission')::NUMERIC;
  v_monde_fee := (v_fee_info->>'monde_fee')::NUMERIC;

  v_reference := 'CO-' || UPPER(SUBSTR(gen_random_uuid()::TEXT, 1, 8));

  -- Atomic transfers
  UPDATE profiles SET balance = balance - (v_req.amount + v_fee) WHERE id = v_req.customer_id;
  UPDATE profiles SET balance = balance + v_req.amount + v_agent_commission WHERE id = v_agent_id;
  IF v_monde_fee > 0 THEN
    UPDATE profiles SET balance = balance + v_monde_fee WHERE id = v_monde_admin_id;
  END IF;

  -- Transaction records
  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_req.customer_id, v_agent_id, 'cash_out', v_req.amount, v_customer.currency,
    v_agent.full_name, v_agent.phone, v_customer.provider, 'completed', 'agent',
    'Get Cash via Monde Agent', v_reference, v_fee, now()
  ) RETURNING id INTO v_customer_txn_id;

  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_agent_id, v_req.customer_id, 'receive', v_req.amount + v_agent_commission, v_agent.currency,
    v_customer.full_name, v_customer.phone, v_agent.provider, 'completed', 'agent',
    'Get Cash — Agent commission K' || v_agent_commission::TEXT, v_reference || '-A', 0, now()
  );

  -- Fee ledger
  IF v_monde_fee > 0 THEN
    INSERT INTO monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
    VALUES (v_customer_txn_id, 'cashout_fee', v_req.amount, v_monde_fee, v_customer.currency, v_req.customer_id);
  END IF;

  -- Update request
  UPDATE cash_out_requests SET
    status = 'completed', agent_id = v_agent_id,
    agent_commission = v_agent_commission, monde_fee = v_monde_fee,
    completed_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true, 'reference', v_reference,
    'amount', v_req.amount, 'fee', v_fee,
    'agent_commission', v_agent_commission, 'monde_fee', v_monde_fee,
    'customer_name', v_customer.full_name,
    'volume_bonus', v_agent_daily_count >= 50
  );
END;
$$;

-- ============================================
-- 10. Fix admin_list_agents — include cashin commissions
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
      p.id, p.phone, p.full_name, p.handle, p.agent_code, p.balance,
      p.is_frozen, p.is_agent, p.created_at,
      COALESCE((
        SELECT COUNT(*) FROM cash_out_requests
        WHERE agent_id = p.id AND status = 'completed' AND completed_at >= CURRENT_DATE
      ), 0) AS cashouts_today,
      COALESCE((
        SELECT COUNT(*) FROM transactions
        WHERE type = 'cash_in' AND recipient_id = p.id AND status = 'completed' AND completed_at >= CURRENT_DATE
      ), 0) AS cashin_today,
      -- Total earned = cashout commissions + cashin commissions (absolute value of negative fees)
      COALESCE((
        SELECT SUM(agent_commission) FROM cash_out_requests
        WHERE agent_id = p.id AND status = 'completed'
      ), 0) +
      COALESCE((
        SELECT ABS(SUM(fee_amount)) FROM monde_fees
        WHERE fee_type = 'cashin_fee' AND user_id = p.id
      ), 0) AS total_cashout_commission,
      COALESCE((
        SELECT SUM(amount) FROM transactions
        WHERE type = 'agent_transfer' AND sender_id = p.id AND status = 'completed' AND completed_at >= CURRENT_DATE
      ), 0) AS transfer_volume_today
    FROM profiles p
    WHERE p.is_agent = true
    ORDER BY p.full_name
  ) a;

  RETURN json_build_object('success', true, 'agents', COALESCE(v_agents, '[]'::JSON));
END;
$$;

-- ============================================
-- 11. Admin: set user tier
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_set_user_tier(p_user_id UUID, p_tier TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: admin only');
  END IF;

  IF p_tier NOT IN ('copper', 'gold', 'platinum') THEN
    RETURN json_build_object('success', false, 'error', 'Invalid tier. Must be copper, gold, or platinum');
  END IF;

  UPDATE profiles SET account_tier = p_tier, updated_at = now() WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN json_build_object('success', true, 'user_id', p_user_id, 'new_tier', p_tier);
END;
$$;

-- ============================================
-- 12. Admin: set user limits
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_set_user_limits(
  p_user_id UUID,
  p_deposit_limit INT DEFAULT NULL,
  p_withdraw_limit INT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: admin only');
  END IF;

  UPDATE profiles SET
    daily_deposit_limit = COALESCE(p_deposit_limit, daily_deposit_limit),
    daily_withdraw_limit = COALESCE(p_withdraw_limit, daily_withdraw_limit),
    updated_at = now()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN json_build_object('success', true, 'user_id', p_user_id,
    'daily_deposit_limit', COALESCE(p_deposit_limit, 3),
    'daily_withdraw_limit', COALESCE(p_withdraw_limit, 3));
END;
$$;
