-- ============================================
-- 047: Platinum tier bypasses circular deposit→cashout fraud check
-- ============================================
-- Problem: Even after upgrading both agent and customer to platinum,
-- the anti-fraud check "you deposited to this customer recently"
-- still blocks cash-outs. Platinum agents are trusted/verified and
-- should be exempt from this restriction.
--
-- Fix: Only apply the 24h circular fraud block for non-platinum agents.
-- Platinum agents can process cash-outs even if they recently deposited
-- to the same customer.

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

  -- Anti-fraud: circular deposit→cashout (Platinum agents are exempt)
  IF COALESCE(v_agent.account_tier, 'copper') != 'platinum' THEN
    SELECT COUNT(*) INTO v_recent_deposit FROM transactions
    WHERE type = 'cash_in' AND sender_id = v_req.customer_id AND recipient_id = v_agent_id
      AND status = 'completed' AND completed_at > now() - INTERVAL '24 hours';
    IF v_recent_deposit > 0 THEN
      RETURN json_build_object('success', false, 'error',
        'Cannot process cash-out: you deposited to this customer recently. Please wait 24 hours.');
    END IF;
  END IF;

  -- Lock customer + get tier-based limit (reads CURRENT tier, not cached)
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

  -- Customer transaction
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
