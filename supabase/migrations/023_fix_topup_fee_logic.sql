-- ============================================
-- 023: Fix Top-Up Fee Logic
-- ============================================
-- Previously, top-up credited (amount - fee) to user wallet.
-- Now: user receives the FULL amount in their wallet.
-- Fee is charged from the external source (mobile money), not from the deposit.
-- The fee is still recorded in monde_fees and credited to admin account.
--
-- Example: User tops up K50
--   Before: wallet += K48.50 (K50 - K1.50 fee)
--   After:  wallet += K50.00 (full amount), fee K1.50 credited to admin from source

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
  v_fee NUMERIC(12,2) := 0.00;
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

  -- Check provider limits (optional — provider may not exist)
  SELECT * INTO v_provider_rec FROM public.providers WHERE id = p_provider;
  IF FOUND THEN
    IF p_amount < v_provider_rec.min_amount THEN
      RETURN json_build_object('success', false, 'error', 'Amount below minimum of K' || v_provider_rec.min_amount);
    END IF;
    IF p_amount > v_provider_rec.max_amount THEN
      RETURN json_build_object('success', false, 'error', 'Amount exceeds maximum of K' || v_provider_rec.max_amount);
    END IF;
  END IF;

  -- Calculate Monde fee: 1% + K1 flat
  v_fee := ROUND((p_amount * 0.01) + 1.00, 2);

  -- Lock and fetch user profile
  SELECT * INTO v_user FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Generate reference
  v_reference := 'TOP-' || gen_random_uuid()::TEXT;

  -- Credit user the FULL requested amount (fee is charged from external source)
  UPDATE public.profiles
    SET balance = balance + p_amount
    WHERE id = p_user_id;

  -- Credit fee to Monde admin account
  UPDATE public.profiles
    SET balance = balance + v_fee
    WHERE id = v_monde_admin_id;

  -- Create transaction record
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
    v_fee,
    now()
  ) RETURNING id INTO v_txn_id;

  -- Record fee in ledger
  INSERT INTO public.monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
  VALUES (v_txn_id, 'topup_fee', p_amount, v_fee, v_user.currency, p_user_id);

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'reference', v_reference,
    'amount', p_amount,
    'fee', v_fee,
    'new_balance', v_user.balance + p_amount
  );
END;
$$;

-- ============================================
-- Admin Revenue Withdrawal
-- ============================================
-- Allows an admin (is_admin = TRUE) to transfer funds from the
-- fee collection account (UUID 0) to their own personal balance.
-- This is how the admin "withdraws" revenue they've earned from fees.

CREATE OR REPLACE FUNCTION public.admin_withdraw_revenue(
  p_amount NUMERIC
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_caller RECORD;
  v_admin_balance NUMERIC(12,2);
  v_monde_admin_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- Verify caller is authenticated
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  -- Verify caller is an admin
  SELECT * INTO v_caller FROM public.profiles WHERE id = v_caller_id;
  IF NOT FOUND OR v_caller.is_admin IS NOT TRUE THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;

  -- Check fee collection account balance
  SELECT balance INTO v_admin_balance FROM public.profiles
    WHERE id = v_monde_admin_id FOR UPDATE;

  IF v_admin_balance IS NULL OR v_admin_balance < p_amount THEN
    RETURN json_build_object('success', false, 'error',
      'Insufficient revenue balance. Available: K' || COALESCE(v_admin_balance, 0));
  END IF;

  -- Transfer from fee collection account to admin's personal balance
  UPDATE public.profiles SET balance = balance - p_amount WHERE id = v_monde_admin_id;
  UPDATE public.profiles SET balance = balance + p_amount WHERE id = v_caller_id;

  -- Record as a transaction for audit trail
  INSERT INTO public.transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_monde_admin_id,
    v_caller_id,
    'send',
    p_amount,
    'ZMW',
    v_caller.full_name,
    v_caller.phone,
    'monde',
    'completed',
    'wallet',
    'Admin revenue withdrawal',
    'ADM-' || gen_random_uuid()::TEXT,
    0,
    now()
  );

  RETURN json_build_object(
    'success', true,
    'amount', p_amount,
    'new_admin_balance', v_admin_balance - p_amount,
    'new_user_balance', v_caller.balance + p_amount
  );
END;
$$;
