-- ============================================
-- 035: Add frozen checks to process_topup, process_withdraw, create_cash_out_request
--
-- Migration 034 added frozen checks to process_payment, process_agent_cash_in,
-- agent_to_agent_transfer, and process_cash_out. This migration completes
-- the coverage so ALL users (not just agents) are blocked when frozen.
-- ============================================

-- 1. process_topup — add frozen check after auth check
CREATE OR REPLACE FUNCTION public.process_topup(
  p_user_id UUID,
  p_amount NUMERIC,
  p_provider TEXT DEFAULT 'airtel',
  p_note TEXT DEFAULT NULL
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
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- FROZEN CHECK
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND is_frozen = true) THEN
    RETURN json_build_object('success', false, 'error', 'Your account has been frozen. Contact support.');
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

  -- Flat 3% fee (no minimum)
  v_total_fee := ROUND(p_amount * 0.03, 2);
  v_lipila_fee := ROUND(p_amount * 0.025, 2);
  v_monde_fee := GREATEST(v_total_fee - v_lipila_fee, 0);

  SELECT * INTO v_user FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  v_reference := 'TOP-' || gen_random_uuid()::TEXT;

  UPDATE public.profiles
    SET balance = balance + p_amount
    WHERE id = p_user_id;

  UPDATE public.profiles
    SET balance = balance + v_monde_fee
    WHERE id = v_monde_admin_id;

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
    'success', true,
    'transaction_id', v_txn_id,
    'reference', v_reference,
    'amount', p_amount,
    'fee', v_total_fee,
    'monde_fee', v_monde_fee,
    'new_balance', v_user.balance + p_amount
  );
END;
$$;

-- 2. process_withdraw — add frozen check after auth check
CREATE OR REPLACE FUNCTION public.process_withdraw(
  p_user_id UUID,
  p_amount NUMERIC,
  p_provider TEXT DEFAULT 'airtel',
  p_destination_phone TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL
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
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- FROZEN CHECK
  IF EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND is_frozen = true) THEN
    RETURN json_build_object('success', false, 'error', 'Your account has been frozen. Contact support.');
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

  -- Flat 3% fee (no minimum)
  v_total_fee := ROUND(p_amount * 0.03, 2);
  v_lipila_fee := ROUND(p_amount * 0.015, 2);
  v_monde_fee := GREATEST(v_total_fee - v_lipila_fee, 0);

  SELECT * INTO v_user FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  IF v_user.balance < (p_amount + v_total_fee) THEN
    RETURN json_build_object('success', false, 'error',
      'Insufficient balance. Need K' || (p_amount + v_total_fee) || ' (K' || p_amount || ' + K' || v_total_fee || ' fee)');
  END IF;

  v_dest_phone := COALESCE(p_destination_phone, v_user.phone);
  v_reference := 'WDR-' || gen_random_uuid()::TEXT;

  UPDATE public.profiles
    SET balance = balance - (p_amount + v_total_fee)
    WHERE id = p_user_id;

  UPDATE public.profiles
    SET balance = balance + v_monde_fee
    WHERE id = v_monde_admin_id;

  INSERT INTO public.transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    p_user_id, p_user_id, 'withdraw', p_amount, v_user.currency,
    COALESCE(v_provider_rec.name, p_provider), v_dest_phone, p_provider,
    'completed', 'wallet',
    COALESCE(p_note, 'Withdraw to ' || COALESCE(v_provider_rec.name, p_provider)),
    v_reference, v_total_fee, now()
  ) RETURNING id INTO v_txn_id;

  INSERT INTO public.monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
  VALUES (v_txn_id, 'withdraw_fee', p_amount, v_monde_fee, v_user.currency, p_user_id);

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'reference', v_reference,
    'amount', p_amount,
    'fee', v_total_fee,
    'monde_fee', v_monde_fee,
    'new_balance', v_user.balance - (p_amount + v_total_fee)
  );
END;
$$;

-- 3. create_cash_out_request — add frozen check after auth check
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
BEGIN
  -- Validate caller
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- FROZEN CHECK
  IF EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_frozen = true) THEN
    RETURN json_build_object('success', false, 'error', 'Your account has been frozen. Contact support.');
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;
  IF p_amount > 5000 THEN
    RETURN json_build_object('success', false, 'error', 'Maximum Get Cash amount is K5,000');
  END IF;

  -- Calculate fee (use 0 for daily count — customer sees default 70/30)
  v_fee_info := calc_get_cash_fee(p_amount, 0);
  v_fee := (v_fee_info->>'fee')::NUMERIC;

  -- Check customer balance
  SELECT * INTO v_customer FROM profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;
  IF v_customer.balance < (p_amount + v_fee) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance. You need K' || (p_amount + v_fee)::TEXT);
  END IF;

  -- Generate unique 6-digit token
  LOOP
    v_token := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM cash_out_requests
      WHERE token = v_token AND status = 'pending' AND expires_at > now()
    );
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RETURN json_build_object('success', false, 'error', 'Could not generate unique code. Try again.');
    END IF;
  END LOOP;

  -- Expire any existing pending requests from this customer
  UPDATE cash_out_requests SET status = 'expired'
  WHERE customer_id = auth.uid() AND status = 'pending';

  -- Insert new request
  INSERT INTO cash_out_requests (customer_id, amount, fee, token)
  VALUES (auth.uid(), p_amount, v_fee, v_token)
  RETURNING id INTO v_id;

  RETURN json_build_object(
    'success', true,
    'request_id', v_id,
    'token', v_token,
    'amount', p_amount,
    'fee', v_fee,
    'total', p_amount + v_fee
  );
END;
$$;
