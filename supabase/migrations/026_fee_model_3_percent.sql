-- ============================================
-- 026: New Fee Model — 3% flat, K10 minimum
-- ============================================
-- Top-up:   User charged amount + 3% fee from MoMo
--           Lipila takes ~2.5% from Monde wallet, Monde keeps ~0.5%
--           User wallet credited full amount
-- Withdraw: User charged amount + 3% fee from Monde wallet
--           Lipila takes ~1.5% from Monde wallet, Monde keeps ~1.5%
--           User receives full amount on MoMo
-- P2P:     Unchanged (free ≤ K500, 0.5% above K500)
--
-- The "monde_fee" recorded in the ledger is Monde's share only,
-- NOT the full 3%. Lipila's share is deducted from the Lipila wallet
-- automatically by Lipila's platform.

-- ============================================
-- 1. Updated process_topup
-- ============================================
-- Fee: 3% of amount, minimum K10
-- Monde's share: total_fee - (2.5% of amount)
-- User receives full p_amount in wallet

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
  -- Verify caller is the user
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  IF p_amount > 50000 THEN
    RETURN json_build_object('success', false, 'error', 'Amount exceeds maximum of K50,000');
  END IF;

  -- Check provider limits (optional)
  SELECT * INTO v_provider_rec FROM public.providers WHERE id = p_provider;
  IF FOUND THEN
    IF p_amount < v_provider_rec.min_amount THEN
      RETURN json_build_object('success', false, 'error', 'Amount below minimum of K' || v_provider_rec.min_amount);
    END IF;
    IF p_amount > v_provider_rec.max_amount THEN
      RETURN json_build_object('success', false, 'error', 'Amount exceeds maximum of K' || v_provider_rec.max_amount);
    END IF;
  END IF;

  -- Calculate fees: 3% total, K10 minimum
  v_total_fee := GREATEST(ROUND(p_amount * 0.03, 2), 10.00);
  -- Lipila takes 2.5% of the amount from Monde's Lipila wallet
  v_lipila_fee := ROUND(p_amount * 0.025, 2);
  -- Monde keeps the remainder
  v_monde_fee := GREATEST(v_total_fee - v_lipila_fee, 0);

  -- Lock and fetch user profile
  SELECT * INTO v_user FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Generate reference
  v_reference := 'TOP-' || gen_random_uuid()::TEXT;

  -- Credit user the FULL requested amount
  UPDATE public.profiles
    SET balance = balance + p_amount
    WHERE id = p_user_id;

  -- Credit Monde's share of the fee to admin account
  UPDATE public.profiles
    SET balance = balance + v_monde_fee
    WHERE id = v_monde_admin_id;

  -- Create transaction record (fee shown is the total 3% fee user paid)
  INSERT INTO public.transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    p_user_id,
    p_user_id,
    'topup',
    p_amount,
    v_user.currency,
    'Monde Wallet',
    v_user.phone,
    p_provider,
    'completed',
    'wallet',
    COALESCE(p_note, 'Top up from ' || COALESCE(v_provider_rec.name, p_provider)),
    v_reference,
    v_total_fee,
    now()
  ) RETURNING id INTO v_txn_id;

  -- Record Monde's fee share in ledger
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

-- ============================================
-- 2. Updated process_withdraw
-- ============================================
-- Fee: 3% of amount, minimum K10
-- Deducted from user's Monde balance: amount + total_fee
-- Monde's share: total_fee - (1.5% of amount)
-- Lipila takes 1.5% from Monde's Lipila wallet

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
  -- Verify caller is the user
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  IF p_amount > 50000 THEN
    RETURN json_build_object('success', false, 'error', 'Amount exceeds maximum of K50,000');
  END IF;

  -- Check provider limits
  SELECT * INTO v_provider_rec FROM public.providers WHERE id = p_provider;
  IF FOUND THEN
    IF p_amount < v_provider_rec.min_amount THEN
      RETURN json_build_object('success', false, 'error', 'Amount below minimum of K' || v_provider_rec.min_amount);
    END IF;
    IF p_amount > v_provider_rec.max_amount THEN
      RETURN json_build_object('success', false, 'error', 'Amount exceeds maximum of K' || v_provider_rec.max_amount);
    END IF;
  END IF;

  -- Calculate fees: 3% total, K10 minimum
  v_total_fee := GREATEST(ROUND(p_amount * 0.03, 2), 10.00);
  -- Lipila takes 1.5% of the amount from Monde's Lipila wallet
  v_lipila_fee := ROUND(p_amount * 0.015, 2);
  -- Monde keeps the remainder
  v_monde_fee := GREATEST(v_total_fee - v_lipila_fee, 0);

  -- Lock and fetch user profile
  SELECT * INTO v_user FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Check sufficient balance (amount + total fee)
  IF v_user.balance < (p_amount + v_total_fee) THEN
    RETURN json_build_object('success', false, 'error',
      'Insufficient balance. Need K' || (p_amount + v_total_fee) || ' (K' || p_amount || ' + K' || v_total_fee || ' fee)');
  END IF;

  -- Use user phone if no destination provided
  v_dest_phone := COALESCE(p_destination_phone, v_user.phone);

  -- Generate reference
  v_reference := 'WDR-' || gen_random_uuid()::TEXT;

  -- Deduct amount + total fee from user balance
  UPDATE public.profiles
    SET balance = balance - (p_amount + v_total_fee)
    WHERE id = p_user_id;

  -- Credit Monde's share of the fee to admin account
  UPDATE public.profiles
    SET balance = balance + v_monde_fee
    WHERE id = v_monde_admin_id;

  -- Create transaction record
  INSERT INTO public.transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    p_user_id,
    p_user_id,
    'withdraw',
    p_amount,
    v_user.currency,
    COALESCE(v_provider_rec.name, p_provider),
    v_dest_phone,
    p_provider,
    'completed',
    'wallet',
    COALESCE(p_note, 'Withdraw to ' || COALESCE(v_provider_rec.name, p_provider)),
    v_reference,
    v_total_fee,
    now()
  ) RETURNING id INTO v_txn_id;

  -- Record Monde's fee share in ledger
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
