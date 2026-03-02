-- ============================================
-- 011: Security Advisor Fixes
-- Resolves all Supabase Security Advisor warnings and errors:
-- 1. Fix "Function Search Path Mutable" on all 6 functions
-- 2. Fix "Security Definer View" on transaction_history
-- 3. Add transaction amount CHECK constraint (SECURITY_AUDIT HIGH #2)
-- ============================================

-- ============================================
-- FIX 1: Set search_path on all SECURITY DEFINER functions
-- This prevents search_path injection attacks
-- ============================================

-- Fix get_balance
CREATE OR REPLACE FUNCTION public.get_balance(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT balance FROM public.profiles WHERE id = p_user_id;
$$;

-- Fix lookup_recipient
CREATE OR REPLACE FUNCTION public.lookup_recipient(p_phone TEXT)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
BEGIN
  SELECT id, full_name, phone, provider, avatar_url
    INTO v_profile
    FROM public.profiles
    WHERE phone = p_phone AND is_active = true
    LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('found', false);
  END IF;

  RETURN json_build_object(
    'found', true,
    'id', v_profile.id,
    'full_name', v_profile.full_name,
    'phone', v_profile.phone,
    'provider', v_profile.provider,
    'avatar_url', v_profile.avatar_url
  );
END;
$$;

-- Fix ensure_single_default_account (trigger function)
CREATE OR REPLACE FUNCTION public.ensure_single_default_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.linked_accounts
      SET is_default = false
      WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = true;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- Fix process_payment
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

  -- Prevent send-to-self
  SELECT phone INTO v_sender FROM public.profiles WHERE id = p_sender_id;
  IF v_sender.phone = p_recipient_phone THEN
    RETURN json_build_object('success', false, 'error', 'Cannot send money to yourself');
  END IF;

  -- Lock and fetch sender profile
  SELECT * INTO v_sender FROM public.profiles WHERE id = p_sender_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Sender profile not found');
  END IF;

  -- Check sufficient balance
  IF v_sender.balance < (p_amount + v_fee) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Try to find recipient by phone
  SELECT * INTO v_recipient FROM public.profiles
    WHERE phone = p_recipient_phone AND id != p_sender_id
    LIMIT 1;

  -- Generate reference
  v_reference := 'TXN-' || gen_random_uuid()::TEXT;

  -- Deduct from sender
  UPDATE public.profiles
    SET balance = balance - (p_amount + v_fee)
    WHERE id = p_sender_id;

  -- Credit recipient if found in system
  IF v_recipient.id IS NOT NULL THEN
    UPDATE public.profiles
      SET balance = balance + p_amount
      WHERE id = v_recipient.id;
  END IF;

  -- Create sender transaction record (send)
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
    COALESCE(v_recipient.full_name, 'External User'),
    p_recipient_phone,
    v_sender.provider,
    'completed',
    p_method,
    p_note,
    v_reference,
    v_fee,
    now()
  ) RETURNING id INTO v_txn_id;

  -- Create recipient transaction record (receive) if internal user
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
      v_sender.currency,
      v_sender.full_name,
      v_sender.phone,
      v_recipient.provider,
      'completed',
      p_method,
      p_note,
      v_reference || '-R',
      0.00,
      now()
    );
  END IF;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'reference', v_reference,
    'amount', p_amount,
    'fee', v_fee,
    'new_balance', v_sender.balance - (p_amount + v_fee)
  );
END;
$$;

-- Fix process_topup
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

-- Fix process_withdraw
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
  v_fee NUMERIC(12,2) := 0.00;
  v_provider_rec RECORD;
  v_dest_phone TEXT;
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

-- ============================================
-- FIX 2: Fix Security Definer View on transaction_history
-- Use security_invoker = true so RLS is enforced through the view
-- ============================================
ALTER VIEW public.transaction_history SET (security_invoker = true);

-- ============================================
-- FIX 3: Add transaction amount CHECK constraint
-- SECURITY_AUDIT HIGH Priority #2: Server-side max amount enforcement
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_amount_positive' 
    AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT check_amount_positive CHECK (amount > 0 AND amount <= 50000);
  END IF;
END $$;
