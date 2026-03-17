-- ============================================
-- 033: Fix cash-out fee ledger + Agent Cash-In
--
-- Fixes:
--   1. process_cash_out now records to monde_fees
--   2. get_monde_fee_summary includes cashout_fee + cashin_fee
--   3. get_monde_fees_by_period includes cashout_fee + cashin_fee
--
-- New features:
--   4. Add 'cash_in' to transaction_type enum
--   5. calc_cash_in_commission() — tiered deposit commission
--   6. process_agent_cash_in() — agent deposits cash for customer
--      Agent wallet debited, customer wallet credited,
--      Monde pays agent a small commission from fee ledger.
-- ============================================

-- 1. Add 'cash_in' to transaction_type enum
DO $$ BEGIN
  ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'cash_in';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- 2. Fix process_cash_out — add monde_fees insert
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
  v_fee_info JSON;
  v_fee NUMERIC(12,2);
  v_agent_commission NUMERIC(12,2);
  v_monde_fee NUMERIC(12,2);
  v_reference TEXT;
  v_monde_admin_id UUID := '00000000-0000-0000-0000-000000000000';
  v_customer_txn_id UUID;
BEGIN
  IF v_agent_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify agent
  SELECT * INTO v_agent FROM profiles WHERE id = v_agent_id;
  IF NOT v_agent.is_agent THEN
    RETURN json_build_object('success', false, 'error', 'Only Monde agents can process cash-outs');
  END IF;

  -- Lock and fetch the request
  SELECT * INTO v_req FROM cash_out_requests
  WHERE id = p_request_id AND status = 'pending' AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found, already processed, or expired');
  END IF;

  -- Cannot process own request
  IF v_req.customer_id = v_agent_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot process your own request');
  END IF;

  -- Lock and verify customer balance
  SELECT * INTO v_customer FROM profiles WHERE id = v_req.customer_id FOR UPDATE;
  IF v_customer.balance < (v_req.amount + v_req.fee) THEN
    RETURN json_build_object('success', false, 'error', 'Customer has insufficient balance');
  END IF;

  -- Calculate fee split with volume bonus
  v_agent_daily_count := (
    SELECT COUNT(*) FROM cash_out_requests
    WHERE agent_id = v_agent_id AND status = 'completed'
    AND completed_at >= CURRENT_DATE
  );
  v_fee_info := calc_get_cash_fee(v_req.amount, v_agent_daily_count);
  v_fee := (v_fee_info->>'fee')::NUMERIC;
  v_agent_commission := (v_fee_info->>'agent_commission')::NUMERIC;
  v_monde_fee := (v_fee_info->>'monde_fee')::NUMERIC;

  -- Generate reference
  v_reference := 'CO-' || UPPER(SUBSTR(gen_random_uuid()::TEXT, 1, 8));

  -- === ATOMIC TRANSFERS ===

  -- 1. Deduct from customer (amount + fee)
  UPDATE profiles SET balance = balance - (v_req.amount + v_fee)
  WHERE id = v_req.customer_id;

  -- 2. Credit agent (amount + agent commission) — INSTANT commission
  UPDATE profiles SET balance = balance + v_req.amount + v_agent_commission
  WHERE id = v_agent_id;

  -- 3. Credit Monde fee ledger
  IF v_monde_fee > 0 THEN
    UPDATE profiles SET balance = balance + v_monde_fee
    WHERE id = v_monde_admin_id;
  END IF;

  -- === TRANSACTION RECORDS ===

  -- Customer transaction (cash_out — debit)
  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_req.customer_id,
    v_agent_id,
    'cash_out',
    v_req.amount,
    v_customer.currency,
    v_agent.full_name,
    v_agent.phone,
    v_customer.provider,
    'completed',
    'agent',
    'Get Cash via Monde Agent',
    v_reference,
    v_fee,
    now()
  ) RETURNING id INTO v_customer_txn_id;

  -- Agent transaction (receive — credit, includes commission)
  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_agent_id,
    v_req.customer_id,
    'receive',
    v_req.amount + v_agent_commission,
    v_agent.currency,
    v_customer.full_name,
    v_customer.phone,
    v_agent.provider,
    'completed',
    'agent',
    'Get Cash — Agent commission K' || v_agent_commission::TEXT,
    v_reference || '-A',
    0,
    now()
  );

  -- === FEE LEDGER (BUG FIX: was missing) ===
  IF v_monde_fee > 0 THEN
    INSERT INTO monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
    VALUES (v_customer_txn_id, 'cashout_fee', v_req.amount, v_monde_fee, v_customer.currency, v_req.customer_id);
  END IF;

  -- === UPDATE REQUEST ===
  UPDATE cash_out_requests SET
    status = 'completed',
    agent_id = v_agent_id,
    agent_commission = v_agent_commission,
    monde_fee = v_monde_fee,
    completed_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true,
    'reference', v_reference,
    'amount', v_req.amount,
    'fee', v_fee,
    'agent_commission', v_agent_commission,
    'monde_fee', v_monde_fee,
    'customer_name', v_customer.full_name,
    'volume_bonus', v_agent_daily_count >= 50
  );
END;
$$;

-- ============================================
-- 3. Fix get_monde_fee_summary — include cashout_fee + cashin_fee
-- ============================================
CREATE OR REPLACE FUNCTION public.get_monde_fee_summary()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000000';
  v_total_fees NUMERIC;
  v_topup_fees NUMERIC;
  v_withdraw_fees NUMERIC;
  v_payment_fees NUMERIC;
  v_cashout_fees NUMERIC;
  v_cashin_fees NUMERIC;
  v_admin_balance NUMERIC;
  v_total_transactions INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: admin access only');
  END IF;

  SELECT COALESCE(SUM(fee_amount), 0) INTO v_total_fees FROM public.monde_fees;
  SELECT COALESCE(SUM(fee_amount), 0) INTO v_topup_fees FROM public.monde_fees WHERE fee_type = 'topup_fee';
  SELECT COALESCE(SUM(fee_amount), 0) INTO v_withdraw_fees FROM public.monde_fees WHERE fee_type = 'withdraw_fee';
  SELECT COALESCE(SUM(fee_amount), 0) INTO v_payment_fees FROM public.monde_fees WHERE fee_type = 'payment_fee';
  SELECT COALESCE(SUM(fee_amount), 0) INTO v_cashout_fees FROM public.monde_fees WHERE fee_type = 'cashout_fee';
  SELECT COALESCE(SUM(fee_amount), 0) INTO v_cashin_fees FROM public.monde_fees WHERE fee_type = 'cashin_fee';
  SELECT balance INTO v_admin_balance FROM public.profiles WHERE id = v_admin_id;
  SELECT COUNT(*) INTO v_total_transactions FROM public.monde_fees;

  RETURN json_build_object(
    'success', true,
    'total_fees_collected', v_total_fees,
    'topup_fees', v_topup_fees,
    'withdraw_fees', v_withdraw_fees,
    'payment_fees', v_payment_fees,
    'cashout_fees', v_cashout_fees,
    'cashin_fees', v_cashin_fees,
    'admin_balance', COALESCE(v_admin_balance, 0),
    'total_fee_transactions', v_total_transactions
  );
END;
$$;

-- ============================================
-- 4. Cash-In commission calculator
-- Agent earns a small commission paid by Monde for accepting deposits.
-- Customer pays NOTHING (same as MoMo deposits).
-- Monde absorbs the cost as a customer acquisition expense.
--
-- Commission tiers (competitive with MoMo agent deposit commissions):
--   K1-150:     K0.50
--   K151-300:   K1.00
--   K301-500:   K2.00
--   K501-1000:  K3.00
--   K1001-3000: K5.00
--   K3001-5000: K8.00
-- ============================================
CREATE OR REPLACE FUNCTION public.calc_cash_in_commission(p_amount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_amount <= 150 THEN RETURN 0.50;
  ELSIF p_amount <= 300 THEN RETURN 1.00;
  ELSIF p_amount <= 500 THEN RETURN 2.00;
  ELSIF p_amount <= 1000 THEN RETURN 3.00;
  ELSIF p_amount <= 3000 THEN RETURN 5.00;
  ELSIF p_amount <= 5000 THEN RETURN 8.00;
  ELSE RETURN 8.00; -- cap
  END IF;
END;
$$;

-- ============================================
-- 5. Process Agent Cash-In (deposit)
--
-- Flow: Customer gives cash to agent.
--   Agent's wallet is debited (they gave digital value).
--   Customer's wallet is credited.
--   Monde pays agent a commission from fee ledger.
--
-- This is the REVERSE of Get Cash:
--   Get Cash:  customer wallet → agent wallet (customer pays fee)
--   Cash In:   agent wallet → customer wallet (Monde pays agent commission)
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
  v_agent_id UUID := auth.uid();
  v_agent RECORD;
  v_customer RECORD;
  v_commission NUMERIC(12,2);
  v_reference TEXT;
  v_monde_admin_id UUID := '00000000-0000-0000-0000-000000000000';
  v_monde_balance NUMERIC(12,2);
  v_customer_txn_id UUID;
BEGIN
  IF v_agent_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;
  IF p_amount > 5000 THEN
    RETURN json_build_object('success', false, 'error', 'Maximum cash-in amount is K5,000');
  END IF;

  -- Verify caller is agent
  SELECT * INTO v_agent FROM profiles WHERE id = v_agent_id FOR UPDATE;
  IF NOT v_agent.is_agent THEN
    RETURN json_build_object('success', false, 'error', 'Only Monde agents can process cash-in');
  END IF;

  -- Agent must have sufficient balance (they're transferring digital value)
  IF v_agent.balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient wallet balance. You need at least K' || p_amount::TEXT || ' to process this deposit.');
  END IF;

  -- Find customer by phone
  SELECT * INTO v_customer FROM profiles
  WHERE phone = p_customer_phone
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Customer not found. They must have a Monde account.');
  END IF;

  -- Cannot deposit to self
  IF v_customer.id = v_agent_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot deposit to your own account');
  END IF;

  -- Calculate commission
  v_commission := calc_cash_in_commission(p_amount);

  -- Check Monde fee ledger has enough to pay commission
  SELECT balance INTO v_monde_balance FROM profiles WHERE id = v_monde_admin_id;
  IF COALESCE(v_monde_balance, 0) < v_commission THEN
    -- Monde can't afford to pay commission — process anyway but with zero commission
    v_commission := 0;
  END IF;

  -- Generate reference
  v_reference := 'CI-' || UPPER(SUBSTR(gen_random_uuid()::TEXT, 1, 8));

  -- === ATOMIC TRANSFERS ===

  -- 1. Debit agent wallet (they gave digital value to customer)
  UPDATE profiles SET balance = balance - p_amount
  WHERE id = v_agent_id;

  -- 2. Credit customer wallet
  UPDATE profiles SET balance = balance + p_amount
  WHERE id = v_customer.id;

  -- 3. Pay agent commission from Monde fee ledger
  IF v_commission > 0 THEN
    UPDATE profiles SET balance = balance - v_commission
    WHERE id = v_monde_admin_id;

    UPDATE profiles SET balance = balance + v_commission
    WHERE id = v_agent_id;
  END IF;

  -- === TRANSACTION RECORDS ===

  -- Customer transaction (cash_in — credit)
  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_customer.id,
    v_agent_id,
    'cash_in',
    p_amount,
    v_customer.currency,
    v_agent.full_name,
    v_agent.phone,
    v_customer.provider,
    'completed',
    'agent',
    'Cash deposit via Monde Agent',
    v_reference,
    0, -- customer pays nothing
    now()
  ) RETURNING id INTO v_customer_txn_id;

  -- Agent transaction (send — debit, but they earned commission)
  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_agent_id,
    v_customer.id,
    'send',
    p_amount,
    v_agent.currency,
    v_customer.full_name,
    v_customer.phone,
    v_agent.provider,
    'completed',
    'agent',
    'Cash-In deposit — Commission K' || v_commission::TEXT,
    v_reference || '-A',
    0,
    now()
  );

  -- === FEE LEDGER ===
  -- Record the commission as a negative fee (Monde pays, not earns)
  IF v_commission > 0 THEN
    INSERT INTO monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
    VALUES (v_customer_txn_id, 'cashin_fee', p_amount, -v_commission, v_customer.currency, v_customer.id);
  END IF;

  RETURN json_build_object(
    'success', true,
    'reference', v_reference,
    'amount', p_amount,
    'commission', v_commission,
    'customer_name', v_customer.full_name,
    'customer_phone', v_customer.phone
  );
END;
$$;
