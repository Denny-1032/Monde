-- ============================================
-- 008: Wallet Top-Up and Withdraw Functions
-- Adds 'topup' and 'withdraw' to transaction_type enum
-- Creates process_topup and process_withdraw DB functions
-- ============================================

-- Add new enum values to transaction_type
DO $$ BEGIN
  ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'topup';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'withdraw';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add 'wallet' to payment_method for internal wallet operations
DO $$ BEGIN
  ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'wallet';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Process Top-Up: Fund Monde wallet from provider
-- ============================================
CREATE OR REPLACE FUNCTION public.process_topup(
  p_user_id UUID,
  p_amount NUMERIC,
  p_provider TEXT DEFAULT 'airtel',
  p_note TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user RECORD;
  v_txn_id UUID;
  v_reference TEXT;
  v_fee NUMERIC(12,2) := 0.00;
  v_provider_rec RECORD;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
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
    -- Calculate fee
    v_fee := ROUND((p_amount * v_provider_rec.fee_percent) + v_provider_rec.fee_flat, 2);
  END IF;

  -- Lock and fetch user profile
  SELECT * INTO v_user FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Generate reference
  v_reference := 'TOP-' || gen_random_uuid()::TEXT;

  -- Credit user balance
  UPDATE public.profiles
    SET balance = balance + p_amount
    WHERE id = p_user_id;

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
-- Process Withdraw: Cash out from Monde wallet to provider
-- ============================================
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
AS $$
DECLARE
  v_user RECORD;
  v_txn_id UUID;
  v_reference TEXT;
  v_fee NUMERIC(12,2) := 0.00;
  v_provider_rec RECORD;
  v_dest_phone TEXT;
BEGIN
  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
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
    v_fee := ROUND((p_amount * v_provider_rec.fee_percent) + v_provider_rec.fee_flat, 2);
  END IF;

  -- Lock and fetch user profile
  SELECT * INTO v_user FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Check sufficient balance (amount + fee)
  IF v_user.balance < (p_amount + v_fee) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Use user phone if no destination provided
  v_dest_phone := COALESCE(p_destination_phone, v_user.phone);

  -- Generate reference
  v_reference := 'WDR-' || gen_random_uuid()::TEXT;

  -- Deduct from user balance
  UPDATE public.profiles
    SET balance = balance - (p_amount + v_fee)
    WHERE id = p_user_id;

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
    v_fee,
    now()
  ) RETURNING id INTO v_txn_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'reference', v_reference,
    'amount', p_amount,
    'fee', v_fee,
    'new_balance', v_user.balance - (p_amount + v_fee)
  );
END;
$$;
