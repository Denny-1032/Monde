-- ============================================
-- 034: Account Freeze + Admin Agent Management
--
-- 1. Add is_frozen column to profiles
-- 2. Admin RPC to freeze/unfreeze accounts
-- 3. Admin RPC to list all agents with stats
-- 4. Update all transaction RPCs to check is_frozen
-- ============================================

-- 1. Add is_frozen column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;

-- 2. Admin freeze/unfreeze account
CREATE OR REPLACE FUNCTION public.admin_freeze_account(
  p_user_id UUID,
  p_freeze BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target RECORD;
BEGIN
  -- Only admin can freeze
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: admin only');
  END IF;

  SELECT * INTO v_target FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Cannot freeze admin or fee ledger
  IF v_target.is_admin OR p_user_id = '00000000-0000-0000-0000-000000000000'::UUID THEN
    RETURN json_build_object('success', false, 'error', 'Cannot freeze this account');
  END IF;

  UPDATE profiles SET is_frozen = p_freeze WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'user_id', p_user_id,
    'is_frozen', p_freeze,
    'full_name', v_target.full_name
  );
END;
$$;

-- 3. Admin list agents with stats
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
      p.balance,
      p.is_frozen,
      p.created_at,
      -- Cash-out stats (today)
      COALESCE((
        SELECT COUNT(*) FROM cash_out_requests
        WHERE agent_id = p.id AND status = 'completed'
        AND completed_at >= CURRENT_DATE
      ), 0) AS cashouts_today,
      -- Cash-in stats (today)
      COALESCE((
        SELECT COUNT(*) FROM transactions
        WHERE type = 'cash_in' AND recipient_id = p.id
        AND status = 'completed'
        AND completed_at >= CURRENT_DATE
      ), 0) AS cashin_today,
      -- Total commissions earned (all time from cash-out)
      COALESCE((
        SELECT SUM(agent_commission) FROM cash_out_requests
        WHERE agent_id = p.id AND status = 'completed'
      ), 0) AS total_cashout_commission,
      -- Agent transfers today volume
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

-- 4. Add is_frozen checks to all transaction RPCs
-- Update process_payment to check frozen
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
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_sender_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- FROZEN CHECK
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_sender_id AND is_frozen = true) THEN
    RETURN json_build_object('success', false, 'error', 'Your account has been frozen. Contact support.');
  END IF;

  -- AGENT RESTRICTION
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_sender_id AND is_agent = true) THEN
    RETURN json_build_object('success', false, 'error',
      'Agent accounts cannot send money directly. Use "Deposit" to credit a customer or "Agent Transfer" to send to another agent.');
  END IF;

  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;
  IF p_amount > 50000 THEN
    RETURN json_build_object('success', false, 'error', 'Amount exceeds maximum of K50,000');
  END IF;

  SELECT phone INTO v_sender FROM public.profiles WHERE id = p_sender_id;
  IF v_sender.phone = p_recipient_phone THEN
    RETURN json_build_object('success', false, 'error', 'Cannot send money to yourself');
  END IF;

  IF p_recipient_phone = '+260000000000' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot send money to this account');
  END IF;

  IF p_amount > 500 THEN
    v_fee := ROUND(p_amount * 0.005, 2);
  END IF;

  SELECT * INTO v_sender FROM public.profiles WHERE id = p_sender_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Sender profile not found');
  END IF;

  IF v_sender.balance < (p_amount + v_fee) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  SELECT * INTO v_recipient FROM public.profiles
    WHERE phone = p_recipient_phone AND id != p_sender_id LIMIT 1;

  v_reference := 'TXN-' || gen_random_uuid()::TEXT;

  UPDATE public.profiles SET balance = balance - (p_amount + v_fee) WHERE id = p_sender_id;

  IF v_recipient.id IS NOT NULL THEN
    UPDATE public.profiles SET balance = balance + p_amount WHERE id = v_recipient.id;
  END IF;

  IF v_fee > 0 THEN
    UPDATE public.profiles SET balance = balance + v_fee WHERE id = v_monde_admin_id;
  END IF;

  INSERT INTO public.transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    p_sender_id, v_recipient.id, 'send', p_amount, v_sender.currency,
    COALESCE(v_recipient.full_name, 'External User'), p_recipient_phone,
    v_sender.provider, 'completed', p_method, p_note, v_reference, v_fee, now()
  ) RETURNING id INTO v_txn_id;

  IF v_recipient.id IS NOT NULL THEN
    INSERT INTO public.transactions (
      sender_id, recipient_id, type, amount, currency,
      recipient_name, recipient_phone, provider, status, method,
      note, reference, fee, completed_at
    ) VALUES (
      v_recipient.id, p_sender_id, 'receive', p_amount, v_sender.currency,
      v_sender.full_name, v_sender.phone, v_recipient.provider,
      'completed', p_method, p_note, v_reference || '-R', 0.00, now()
    );
  END IF;

  IF v_fee > 0 THEN
    INSERT INTO public.monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
    VALUES (v_txn_id, 'payment_fee', p_amount, v_fee, v_sender.currency, p_sender_id);
  END IF;

  RETURN json_build_object(
    'success', true, 'transaction_id', v_txn_id, 'reference', v_reference,
    'amount', p_amount, 'fee', v_fee, 'new_balance', v_sender.balance - (p_amount + v_fee)
  );
END;
$$;

-- Update process_agent_cash_in to check frozen
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
  v_daily_deposits INT;
BEGIN
  IF v_agent_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- FROZEN CHECK
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_agent_id AND is_frozen = true) THEN
    RETURN json_build_object('success', false, 'error', 'Your account has been frozen. Contact support.');
  END IF;

  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;
  IF p_amount > 5000 THEN
    RETURN json_build_object('success', false, 'error', 'Maximum cash-in amount is K5,000');
  END IF;

  SELECT * INTO v_agent FROM profiles WHERE id = v_agent_id FOR UPDATE;
  IF NOT v_agent.is_agent THEN
    RETURN json_build_object('success', false, 'error', 'Only Monde agents can process deposits');
  END IF;

  IF v_agent.balance < p_amount THEN
    RETURN json_build_object('success', false, 'error',
      'Insufficient wallet balance. You need at least K' || p_amount::TEXT || ' to process this deposit.');
  END IF;

  SELECT * INTO v_customer FROM profiles WHERE phone = p_customer_phone FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Customer not found. They must have a Monde account.');
  END IF;

  -- Check if customer is frozen
  IF v_customer.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'This customer account is frozen.');
  END IF;

  IF v_customer.id = v_agent_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot deposit to your own account');
  END IF;

  SELECT COUNT(*) INTO v_daily_deposits FROM transactions
  WHERE type = 'cash_in' AND sender_id = v_customer.id
    AND status = 'completed' AND completed_at >= CURRENT_DATE;

  IF v_daily_deposits >= 3 THEN
    RETURN json_build_object('success', false, 'error',
      'This customer has reached the daily deposit limit (3 deposits per day).');
  END IF;

  v_commission := ROUND(p_amount * 0.005, 2);

  SELECT balance INTO v_monde_balance FROM profiles WHERE id = v_monde_admin_id;
  IF COALESCE(v_monde_balance, 0) < v_commission THEN
    v_commission := 0;
  END IF;

  v_reference := 'CI-' || UPPER(SUBSTR(gen_random_uuid()::TEXT, 1, 8));

  UPDATE profiles SET balance = balance - p_amount WHERE id = v_agent_id;
  UPDATE profiles SET balance = balance + p_amount WHERE id = v_customer.id;

  IF v_commission > 0 THEN
    UPDATE profiles SET balance = balance - v_commission WHERE id = v_monde_admin_id;
    UPDATE profiles SET balance = balance + v_commission WHERE id = v_agent_id;
  END IF;

  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_customer.id, v_agent_id, 'cash_in', p_amount, v_customer.currency,
    v_agent.full_name, v_agent.phone, v_customer.provider, 'completed', 'agent',
    'Cash deposit via Monde Agent', v_reference, 0, now()
  ) RETURNING id INTO v_customer_txn_id;

  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_agent_id, v_customer.id, 'send', p_amount, v_agent.currency,
    v_customer.full_name, v_customer.phone, v_agent.provider, 'completed', 'agent',
    'Cash-In deposit — Commission K' || v_commission::TEXT, v_reference || '-A', 0, now()
  );

  IF v_commission > 0 THEN
    INSERT INTO monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
    VALUES (v_customer_txn_id, 'cashin_fee', p_amount, -v_commission, v_customer.currency, v_customer.id);
  END IF;

  RETURN json_build_object(
    'success', true, 'reference', v_reference, 'amount', p_amount,
    'commission', v_commission, 'customer_name', v_customer.full_name,
    'customer_phone', v_customer.phone
  );
END;
$$;

-- Update agent_to_agent_transfer to check frozen
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
  v_sender_id UUID := auth.uid();
  v_sender RECORD;
  v_recipient RECORD;
  v_daily_volume NUMERIC;
  v_reference TEXT;
  v_txn_id UUID;
BEGIN
  IF v_sender_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- FROZEN CHECK
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_sender_id AND is_frozen = true) THEN
    RETURN json_build_object('success', false, 'error', 'Your account has been frozen. Contact support.');
  END IF;

  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;
  IF p_amount > 50000 THEN
    RETURN json_build_object('success', false, 'error', 'Maximum transfer is K50,000');
  END IF;

  SELECT * INTO v_sender FROM profiles WHERE id = v_sender_id FOR UPDATE;
  IF NOT v_sender.is_agent THEN
    RETURN json_build_object('success', false, 'error', 'Only agents can use agent transfer');
  END IF;

  IF v_sender.balance < p_amount THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  SELECT * INTO v_recipient FROM profiles
  WHERE phone = p_recipient_phone AND id != v_sender_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Recipient not found');
  END IF;

  IF NOT v_recipient.is_agent THEN
    RETURN json_build_object('success', false, 'error',
      'Recipient is not an agent. Use "Deposit" to send to customers.');
  END IF;

  -- Check recipient frozen
  IF v_recipient.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'Recipient account is frozen.');
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_daily_volume FROM transactions
  WHERE type = 'agent_transfer' AND sender_id = v_sender_id
    AND status = 'completed' AND completed_at >= CURRENT_DATE;

  IF (v_daily_volume + p_amount) > 50000 THEN
    RETURN json_build_object('success', false, 'error',
      'Daily agent transfer limit reached (K50,000). Remaining: K' || (50000 - v_daily_volume)::TEXT);
  END IF;

  v_reference := 'AT-' || UPPER(SUBSTR(gen_random_uuid()::TEXT, 1, 8));

  UPDATE profiles SET balance = balance - p_amount WHERE id = v_sender_id;
  UPDATE profiles SET balance = balance + p_amount WHERE id = v_recipient.id;

  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_sender_id, v_recipient.id, 'agent_transfer', p_amount, v_sender.currency,
    v_recipient.full_name, v_recipient.phone, v_sender.provider, 'completed', 'agent',
    COALESCE(p_note, 'Agent float transfer'), v_reference, 0, now()
  ) RETURNING id INTO v_txn_id;

  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_recipient.id, v_sender_id, 'receive', p_amount, v_recipient.currency,
    v_sender.full_name, v_sender.phone, v_recipient.provider, 'completed', 'agent',
    COALESCE(p_note, 'Agent float received'), v_reference || '-R', 0, now()
  );

  RETURN json_build_object(
    'success', true, 'transaction_id', v_txn_id, 'reference', v_reference,
    'amount', p_amount, 'recipient_name', v_recipient.full_name,
    'new_balance', v_sender.balance - p_amount
  );
END;
$$;

-- Update process_cash_out to check frozen
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
  v_recent_deposit INT;
BEGIN
  IF v_agent_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- FROZEN CHECK
  IF EXISTS (SELECT 1 FROM profiles WHERE id = v_agent_id AND is_frozen = true) THEN
    RETURN json_build_object('success', false, 'error', 'Your account has been frozen. Contact support.');
  END IF;

  SELECT * INTO v_agent FROM profiles WHERE id = v_agent_id;
  IF NOT v_agent.is_agent THEN
    RETURN json_build_object('success', false, 'error', 'Only Monde agents can process cash-outs');
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

  -- ANTI-FRAUD: circular deposit→cashout
  SELECT COUNT(*) INTO v_recent_deposit FROM transactions
  WHERE type = 'cash_in' AND sender_id = v_req.customer_id AND recipient_id = v_agent_id
    AND status = 'completed' AND completed_at > now() - INTERVAL '24 hours';

  IF v_recent_deposit > 0 THEN
    RETURN json_build_object('success', false, 'error',
      'Cannot process cash-out: you deposited to this customer recently. Please wait 24 hours.');
  END IF;

  SELECT * INTO v_customer FROM profiles WHERE id = v_req.customer_id FOR UPDATE;
  IF v_customer.balance < (v_req.amount + v_req.fee) THEN
    RETURN json_build_object('success', false, 'error', 'Customer has insufficient balance');
  END IF;

  v_agent_daily_count := (
    SELECT COUNT(*) FROM cash_out_requests
    WHERE agent_id = v_agent_id AND status = 'completed' AND completed_at >= CURRENT_DATE
  );
  v_fee_info := calc_get_cash_fee(v_req.amount, v_agent_daily_count);
  v_fee := (v_fee_info->>'fee')::NUMERIC;
  v_agent_commission := (v_fee_info->>'agent_commission')::NUMERIC;
  v_monde_fee := (v_fee_info->>'monde_fee')::NUMERIC;

  v_reference := 'CO-' || UPPER(SUBSTR(gen_random_uuid()::TEXT, 1, 8));

  UPDATE profiles SET balance = balance - (v_req.amount + v_fee) WHERE id = v_req.customer_id;
  UPDATE profiles SET balance = balance + v_req.amount + v_agent_commission WHERE id = v_agent_id;

  IF v_monde_fee > 0 THEN
    UPDATE profiles SET balance = balance + v_monde_fee WHERE id = v_monde_admin_id;
  END IF;

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

  IF v_monde_fee > 0 THEN
    INSERT INTO monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
    VALUES (v_customer_txn_id, 'cashout_fee', v_req.amount, v_monde_fee, v_customer.currency, v_req.customer_id);
  END IF;

  UPDATE cash_out_requests SET
    status = 'completed', agent_id = v_agent_id,
    agent_commission = v_agent_commission, monde_fee = v_monde_fee,
    completed_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true, 'reference', v_reference, 'amount', v_req.amount,
    'fee', v_fee, 'agent_commission', v_agent_commission, 'monde_fee', v_monde_fee,
    'customer_name', v_customer.full_name, 'volume_bonus', v_agent_daily_count >= 50
  );
END;
$$;
