-- ============================================
-- 041: Fix payment phone lookup, provider, agent limits
-- ============================================

-- 1. Normalize all existing phone numbers to +260 format
UPDATE profiles
SET phone = '+' || phone
WHERE phone LIKE '260%' AND phone NOT LIKE '+%';

-- Also normalize in transactions table
UPDATE transactions
SET recipient_phone = '+' || recipient_phone
WHERE recipient_phone LIKE '260%' AND recipient_phone NOT LIKE '+%';

-- 2. Fix process_payment: normalize phone lookup + use 'monde' provider for P2P
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
BEGIN
  -- Verify caller is the sender
  IF auth.uid() IS NULL OR auth.uid() != p_sender_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  IF p_amount > 50000 THEN
    RETURN json_build_object('success', false, 'error', 'Amount exceeds maximum of K50,000');
  END IF;

  -- Normalize recipient phone to +260 format
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

  -- Block payments to system accounts (admin + fee ledger)
  IF v_normalized_phone IN ('+260000000000', '+260000000001') THEN
    RETURN json_build_object('success', false, 'error', 'Cannot send money to system accounts');
  END IF;

  -- Calculate fee: free <= K500, 0.5% above K500
  IF p_amount > 500 THEN
    v_fee := ROUND(p_amount * 0.005, 2);
  END IF;

  -- Lock and fetch sender profile
  SELECT * INTO v_sender FROM public.profiles WHERE id = p_sender_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Sender profile not found');
  END IF;

  -- Block frozen accounts
  IF v_sender.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'Your account has been frozen. Contact support.');
  END IF;

  -- Block agents from P2P
  IF v_sender.is_agent THEN
    RETURN json_build_object('success', false, 'error', 'Agent accounts cannot send money directly. Use Deposit or Agent Transfer.');
  END IF;

  -- Check sufficient balance (amount + fee)
  IF v_sender.balance < (p_amount + v_fee) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Try to find recipient by normalized phone (also try without + prefix for legacy data)
  SELECT * INTO v_recipient FROM public.profiles
    WHERE (phone = v_normalized_phone OR phone = regexp_replace(v_normalized_phone, '^\+', ''))
      AND id != p_sender_id
    LIMIT 1;

  -- Generate reference
  v_reference := 'TXN-' || gen_random_uuid()::TEXT;

  -- Deduct amount + fee from sender
  UPDATE public.profiles
    SET balance = balance - (p_amount + v_fee)
    WHERE id = p_sender_id;

  -- Credit recipient if found in system (full amount, no fee)
  IF v_recipient.id IS NOT NULL THEN
    UPDATE public.profiles
      SET balance = balance + p_amount
      WHERE id = v_recipient.id;
  END IF;

  -- Credit fee to Monde admin account (only if fee > 0)
  IF v_fee > 0 THEN
    UPDATE public.profiles
      SET balance = balance + v_fee
      WHERE id = v_monde_admin_id;
  END IF;

  -- Create sender transaction record (send)
  -- Provider is 'monde' for in-app P2P transfers
  INSERT INTO public.transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    p_sender_id,
    v_recipient.id,
    'send',
    p_amount,
    v_sender.currency,
    COALESCE(v_recipient.full_name, 'External'),
    v_normalized_phone,
    'monde',
    'completed',
    p_method,
    COALESCE(p_note, ''),
    v_reference,
    v_fee,
    now()
  ) RETURNING id INTO v_txn_id;

  -- Create recipient mirror transaction (receive)
  IF v_recipient.id IS NOT NULL THEN
    INSERT INTO public.transactions (
      sender_id, recipient_id, type, amount, currency,
      recipient_name, recipient_phone, provider, status, method,
      note, reference, fee, completed_at
    ) VALUES (
      v_recipient.id,
      p_sender_id,
      'receive',
      p_amount,
      v_recipient.currency,
      v_sender.full_name,
      v_sender.phone,
      'monde',
      'completed',
      p_method,
      COALESCE(p_note, ''),
      v_reference || '-R',
      0.00,
      now()
    );
  END IF;

  -- Record fee
  IF v_fee > 0 THEN
    INSERT INTO public.monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
    VALUES (v_txn_id, 'payment_fee', p_amount, v_fee, v_sender.currency, p_sender_id);
  END IF;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'reference', v_reference,
    'amount', p_amount,
    'fee', v_fee,
    'recipient_name', COALESCE(v_recipient.full_name, 'External'),
    'new_balance', v_sender.balance - (p_amount + v_fee)
  );
END;
$$;

-- 3. Fix process_agent_cash_in: increase daily deposit limit from 3 to 5
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
  v_daily_deposits INT;
  v_monde_admin_id UUID := '00000000-0000-0000-0000-000000000000';
  v_normalized_phone TEXT;
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

  -- NORMALIZE PHONE
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

  -- Daily deposit limit (max 5 per customer per day)
  SELECT COUNT(*) INTO v_daily_deposits FROM transactions
  WHERE type = 'cash_in' AND sender_id = v_customer.id
    AND status = 'completed' AND completed_at >= CURRENT_DATE;

  IF v_daily_deposits >= 5 THEN
    RETURN json_build_object('success', false, 'error',
      'Daily deposit limit reached for this customer (max 5 per day)');
  END IF;

  -- Commission: 0.5% of amount, paid by Monde (from fee ledger)
  v_commission := ROUND(p_amount * 0.005, 2);
  v_reference := 'CIN-' || gen_random_uuid()::TEXT;

  -- Debit agent float, credit customer
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
    'success', true,
    'reference', v_reference,
    'amount', p_amount,
    'commission', v_commission,
    'customer_name', v_customer.full_name,
    'customer_phone', v_customer.phone
  );
END;
$$;

-- 4. Fix process_cash_out: add max 3 cash-outs per customer per day
-- Drop any incorrect 2-arg overload first
DROP FUNCTION IF EXISTS public.process_cash_out(UUID, UUID);

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
  v_customer_daily_cashouts INT;
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

  -- ANTI-FRAUD: Block circular deposit->cashout
  SELECT COUNT(*) INTO v_recent_deposit FROM transactions
  WHERE type = 'cash_in'
    AND sender_id = v_req.customer_id
    AND recipient_id = v_agent_id
    AND status = 'completed'
    AND completed_at > now() - INTERVAL '24 hours';

  IF v_recent_deposit > 0 THEN
    RETURN json_build_object('success', false, 'error',
      'Cannot process cash-out: you deposited to this customer recently. Please wait 24 hours.');
  END IF;

  -- Daily cash-out limit per customer (max 3 per day)
  SELECT COUNT(*) INTO v_customer_daily_cashouts FROM cash_out_requests
  WHERE customer_id = v_req.customer_id
    AND status = 'completed'
    AND completed_at >= CURRENT_DATE;

  IF v_customer_daily_cashouts >= 3 THEN
    RETURN json_build_object('success', false, 'error',
      'This customer has reached their daily cash-out limit (max 3 per day)');
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
  UPDATE profiles SET balance = balance - (v_req.amount + v_fee) WHERE id = v_req.customer_id;
  UPDATE profiles SET balance = balance + v_req.amount + v_agent_commission WHERE id = v_agent_id;
  IF v_monde_fee > 0 THEN
    UPDATE profiles SET balance = balance + v_monde_fee WHERE id = v_monde_admin_id;
  END IF;

  -- === TRANSACTION RECORDS ===
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

  -- === FEE LEDGER ===
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
