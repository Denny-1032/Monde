-- ============================================
-- 045: Tier-based agent limits + commission display fix
-- ============================================
-- 1. Per-agent cash-out and deposit limits now based on CUSTOMER account tier:
--    copper=5, gold=7, platinum=10 (per agent per 24h)
-- 2. Agent cash-out transaction: store amount separately from commission
--    amount = cash given, fee = -commission (negative = earned)
-- 3. Agent cash-in transaction: store commission in fee field
--    fee = -commission (negative = earned)

-- ============================================
-- 1. Helper: get tier-based per-agent transaction limit
-- ============================================
CREATE OR REPLACE FUNCTION public.get_tier_agent_limit(p_tier TEXT)
RETURNS INT
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  CASE p_tier
    WHEN 'gold' THEN RETURN 7;
    WHEN 'platinum' THEN RETURN 10;
    ELSE RETURN 5; -- copper (default)
  END CASE;
END;
$$;

-- ============================================
-- 2. Fix process_cash_out
--    - Use tier-based per-agent limits
--    - Store amount and commission separately in agent transaction
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
  v_agent_limit INT;
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

  -- Lock customer + get tier-based limit
  SELECT * INTO v_customer FROM profiles WHERE id = v_req.customer_id FOR UPDATE;
  v_agent_limit := get_tier_agent_limit(COALESCE(v_customer.account_tier, 'copper'));

  SELECT COUNT(*) INTO v_customer_cashouts_from_agent FROM cash_out_requests
  WHERE customer_id = v_req.customer_id AND agent_id = v_agent_id
    AND status = 'completed' AND completed_at > now() - INTERVAL '24 hours';

  IF v_customer_cashouts_from_agent >= v_agent_limit THEN
    RETURN json_build_object('success', false, 'error',
      'Cash-out limit reached: max ' || v_agent_limit || ' per agent per 24h (' || COALESCE(v_customer.account_tier, 'copper') || ' tier)');
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

  -- Customer transaction (unchanged)
  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_req.customer_id, v_agent_id, 'cash_out', v_req.amount, v_customer.currency,
    v_agent.full_name, v_agent.phone, v_customer.provider, 'completed', 'agent',
    'Get Cash via Monde Agent', v_reference, v_fee, now()
  ) RETURNING id INTO v_customer_txn_id;

  -- Agent transaction: amount = cash given, fee = negative commission (earned)
  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_agent_id, v_req.customer_id, 'receive', v_req.amount, v_agent.currency,
    v_customer.full_name, v_customer.phone, v_agent.provider, 'completed', 'agent',
    'Get Cash — Commission K' || v_agent_commission::TEXT, v_reference || '-A',
    -v_agent_commission, now()
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
-- 3. Fix process_agent_cash_in
--    - Use tier-based per-agent limits
--    - Store commission in agent transaction fee field (negative = earned)
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
  v_agent_limit INT;
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

  -- Tier-based per-agent deposit limit
  v_agent_limit := get_tier_agent_limit(COALESCE(v_customer.account_tier, 'copper'));
  SELECT COUNT(*) INTO v_daily_deposits_from_agent FROM transactions
  WHERE type = 'cash_in' AND sender_id = v_customer.id AND recipient_id = v_agent_id
    AND status = 'completed' AND completed_at > now() - INTERVAL '24 hours';

  IF v_daily_deposits_from_agent >= v_agent_limit THEN
    RETURN json_build_object('success', false, 'error',
      'Deposit limit reached: max ' || v_agent_limit || ' per agent per 24h (' || COALESCE(v_customer.account_tier, 'copper') || ' tier)');
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

  -- Customer transaction (unchanged)
  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_customer.id, v_agent_id, 'cash_in', p_amount, v_customer.currency,
    v_agent.full_name, v_agent.phone, v_customer.provider, 'completed', 'agent',
    'Cash deposit by agent', v_reference, 0.00, now()
  );

  -- Agent transaction: fee = negative commission (earned)
  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_agent_id, v_customer.id, 'send', p_amount, v_agent.currency,
    v_customer.full_name, v_customer.phone, v_agent.provider, 'completed', 'agent',
    'Cash deposit to customer', v_reference || '-A', -v_commission, now()
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
