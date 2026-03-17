-- ============================================
-- Migration 037: Payment & Agent Code Fixes
-- ============================================
-- 1. Fix process_payment phone normalization (P2P broken)
-- 2. Agent codes → digits only (no MND- prefix)
-- 3. Fix admin_list_agents to be more resilient
-- ============================================

-- ============================================
-- 1. Fix process_payment: normalize recipient phone
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

  -- NORMALIZE PHONE: convert 0XXX or 260XXX to +260XXX
  v_normalized_phone := regexp_replace(p_recipient_phone, '[^0-9+]', '', 'g');
  IF v_normalized_phone LIKE '0%' THEN
    v_normalized_phone := '+260' || substring(v_normalized_phone from 2);
  ELSIF v_normalized_phone LIKE '260%' AND NOT v_normalized_phone LIKE '+%' THEN
    v_normalized_phone := '+' || v_normalized_phone;
  ELSIF v_normalized_phone NOT LIKE '+%' AND length(v_normalized_phone) = 9 THEN
    v_normalized_phone := '+260' || v_normalized_phone;
  END IF;

  SELECT phone INTO v_sender FROM public.profiles WHERE id = p_sender_id;
  IF v_sender.phone = v_normalized_phone THEN
    RETURN json_build_object('success', false, 'error', 'Cannot send money to yourself');
  END IF;

  IF v_normalized_phone = '+260000000000' THEN
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

  -- Use normalized phone for recipient lookup
  SELECT * INTO v_recipient FROM public.profiles
    WHERE phone = v_normalized_phone AND id != p_sender_id LIMIT 1;

  IF v_recipient.id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Recipient not found on Monde. They need to register first.');
  END IF;

  -- Check recipient frozen
  IF v_recipient.is_frozen = true THEN
    RETURN json_build_object('success', false, 'error', 'Recipient account is frozen.');
  END IF;

  v_reference := 'TXN-' || gen_random_uuid()::TEXT;

  UPDATE public.profiles SET balance = balance - (p_amount + v_fee) WHERE id = p_sender_id;
  UPDATE public.profiles SET balance = balance + p_amount WHERE id = v_recipient.id;

  IF v_fee > 0 THEN
    UPDATE public.profiles SET balance = balance + v_fee WHERE id = v_monde_admin_id;
  END IF;

  INSERT INTO public.transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    p_sender_id, v_recipient.id, 'send', p_amount, v_sender.currency,
    COALESCE(v_recipient.full_name, 'External User'), v_normalized_phone,
    v_sender.provider, 'completed', p_method, p_note, v_reference, v_fee, now()
  ) RETURNING id INTO v_txn_id;

  INSERT INTO public.transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_recipient.id, p_sender_id, 'receive', p_amount, v_sender.currency,
    v_sender.full_name, v_sender.phone, v_recipient.provider,
    'completed', p_method, p_note, v_reference || '-R', 0.00, now()
  );

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

-- ============================================
-- 2. Agent codes → digits only (6 digits, no prefix)
-- ============================================
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
    v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE agent_code = v_code);
    v_attempts := v_attempts + 1;
    IF v_attempts > 20 THEN
      RAISE EXCEPTION 'Could not generate unique agent code';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

-- Update existing MND- codes to digits only
UPDATE profiles SET agent_code = regexp_replace(agent_code, '^MND-', '')
WHERE agent_code LIKE 'MND-%';

-- Also update handles that were set to MND- codes
UPDATE profiles SET handle = NULL
WHERE handle LIKE 'MND-%';

-- ============================================
-- 3. Fix process_agent_cash_in phone normalization
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

  -- Daily deposit limit (max 3 per customer per day)
  SELECT COUNT(*) INTO v_daily_deposits FROM transactions
  WHERE type = 'cash_in' AND sender_id = v_customer.id
    AND status = 'completed' AND completed_at >= CURRENT_DATE;

  IF v_daily_deposits >= 3 THEN
    RETURN json_build_object('success', false, 'error',
      'Daily deposit limit reached for this customer (max 3 per day)');
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
