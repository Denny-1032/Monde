-- ============================================
-- 020: Monde Admin Account & Fee Collection System
-- ============================================
-- Creates the Monde system account for collecting transaction fees,
-- a fee ledger table for audit trail, and updates all RPCs to:
--   1. Calculate real fees (not zero)
--   2. Deduct fees ON TOP of the specified amount (mobile money style)
--   3. Credit fees to the Monde admin account
--   4. Record every fee in the monde_fees ledger
--
-- Fee model (mobile money style):
--   Top-up K1,000  → wallet gets K1,000, fee deducted from balance on top → Monde gets fee
--   Withdraw K1,000 → K1,000 sent out, fee deducted from balance on top → Monde gets fee
--   P2P ≤ K500     → free
--   P2P > K500     → 0.5% fee on sender, on top of amount
--
-- Fee schedule:
--   Top-up:   1.0% + K1.00 flat
--   Withdraw: 1.5% + K2.00 flat
--   P2P:      Free ≤ K500, 0.5% above K500

-- ============================================
-- 1. Monde System Admin Auth User + Profile
-- ============================================
-- Uses a well-known UUID so RPCs can reference it directly.
-- The handle 'monde' is already reserved by migration 015.
-- Must insert into auth.users FIRST (profiles.id FK references auth.users).

-- Admin PIN is 0000. The app converts PINs via pinToPassword(pin) → 'Mn!{pin}#Zk'
-- So PIN 0000 → password 'Mn!0000#Zk'. The encrypted_password must match this.
INSERT INTO auth.users (
  id, instance_id, aud, role, phone,
  encrypted_password, email_confirmed_at, phone_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  '+260000000000',
  crypt('Mn!0000#Zk', gen_salt('bf')),
  now(), now(), now(), now(),
  '{"provider": "phone", "providers": ["phone"], "is_admin": true}'::jsonb,
  '{"full_name": "Monde", "is_system_account": true}'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- Supabase requires an identity record for phone auth to work
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  '{"sub": "00000000-0000-0000-0000-000000000000", "phone": "+260000000000"}'::jsonb,
  'phone',
  '+260000000000',
  now(), now(), now()
) ON CONFLICT (provider, provider_id) DO NOTHING;

INSERT INTO public.profiles (id, phone, full_name, handle, provider, balance, currency)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '+260000000000',
  'Monde',
  'monde',
  'monde',
  0.00,
  'ZMW'
) ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  handle = EXCLUDED.handle;

-- ============================================
-- 2. Fee Ledger Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.monde_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  fee_type TEXT NOT NULL CHECK (fee_type IN ('topup_fee', 'withdraw_fee', 'payment_fee')),
  gross_amount NUMERIC(12,2) NOT NULL,
  fee_amount NUMERIC(12,2) NOT NULL CHECK (fee_amount >= 0),
  currency TEXT NOT NULL DEFAULT 'ZMW',
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_monde_fees_created ON public.monde_fees(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_monde_fees_type ON public.monde_fees(fee_type);
CREATE INDEX IF NOT EXISTS idx_monde_fees_user ON public.monde_fees(user_id);

-- RLS: users cannot read fee records (admin-only via service role)
ALTER TABLE public.monde_fees ENABLE ROW LEVEL SECURITY;

-- No user-facing SELECT policy — only service_role or SECURITY DEFINER functions can access

-- ============================================
-- 3. Constants: Monde Admin UUID
-- ============================================
-- Used by all RPCs below. Defined as a constant here for clarity.
-- UUID: 00000000-0000-0000-0000-000000000000

-- ============================================
-- 4. Updated process_topup with fee collection
-- ============================================
-- Fee model: 1% + K1 flat, deducted ON TOP of the credited amount
-- User gets p_amount credited, then fee is deducted from balance
-- Net effect: balance += p_amount - fee
-- Fee goes to Monde admin account

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

  -- Credit user the full requested amount, then deduct fee on top
  -- Net effect: balance += (p_amount - v_fee)
  UPDATE public.profiles
    SET balance = balance + p_amount - v_fee
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
    'new_balance', v_user.balance + p_amount - v_fee
  );
END;
$$;

-- ============================================
-- 5. Updated process_withdraw with fee collection
-- ============================================
-- Fee model: 1.5% + K2 flat, deducted ON TOP of the withdrawal amount
-- User gets p_amount sent to provider, fee deducted from remaining balance
-- Net effect: balance -= (p_amount + fee)
-- Fee goes to Monde admin account

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

  -- Calculate Monde fee: 1.5% + K2 flat
  v_fee := ROUND((p_amount * 0.015) + 2.00, 2);

  -- Lock and fetch user profile
  SELECT * INTO v_user FROM public.profiles WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Check sufficient balance (amount + fee)
  IF v_user.balance < (p_amount + v_fee) THEN
    RETURN json_build_object('success', false, 'error',
      'Insufficient balance. Need K' || (p_amount + v_fee) || ' (K' || p_amount || ' + K' || v_fee || ' fee)');
  END IF;

  -- Use user phone if no destination provided
  v_dest_phone := COALESCE(p_destination_phone, v_user.phone);

  -- Generate reference
  v_reference := 'WDR-' || gen_random_uuid()::TEXT;

  -- Deduct amount + fee from user balance
  UPDATE public.profiles
    SET balance = balance - (p_amount + v_fee)
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

  -- Record fee in ledger
  INSERT INTO public.monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
  VALUES (v_txn_id, 'withdraw_fee', p_amount, v_fee, v_user.currency, p_user_id);

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
-- 6. Updated process_payment with fee collection
-- ============================================
-- Fee model: Free for amounts ≤ K500, 0.5% for amounts > K500
-- Sender pays the fee on top of the transfer amount
-- Recipient gets the full p_amount
-- Fee goes to Monde admin account

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

  -- Calculate fee: free ≤ K500, 0.5% above K500
  IF p_amount > 500 THEN
    v_fee := ROUND(p_amount * 0.005, 2);
  END IF;

  -- Lock and fetch sender profile
  SELECT * INTO v_sender FROM public.profiles WHERE id = p_sender_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Sender profile not found');
  END IF;

  -- Check sufficient balance (amount + fee)
  IF v_sender.balance < (p_amount + v_fee) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;

  -- Try to find recipient by phone
  SELECT * INTO v_recipient FROM public.profiles
    WHERE phone = p_recipient_phone AND id != p_sender_id
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

  -- Record fee in ledger (only if fee > 0)
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
    'new_balance', v_sender.balance - (p_amount + v_fee)
  );
END;
$$;

-- ============================================
-- 7. Helper: Get Monde fee summary (for admin dashboard)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_monde_fee_summary()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_fees NUMERIC(12,2);
  v_topup_fees NUMERIC(12,2);
  v_withdraw_fees NUMERIC(12,2);
  v_payment_fees NUMERIC(12,2);
  v_admin_balance NUMERIC(12,2);
  v_total_transactions BIGINT;
BEGIN
  SELECT COALESCE(SUM(fee_amount), 0) INTO v_total_fees FROM public.monde_fees;
  SELECT COALESCE(SUM(fee_amount), 0) INTO v_topup_fees FROM public.monde_fees WHERE fee_type = 'topup_fee';
  SELECT COALESCE(SUM(fee_amount), 0) INTO v_withdraw_fees FROM public.monde_fees WHERE fee_type = 'withdraw_fee';
  SELECT COALESCE(SUM(fee_amount), 0) INTO v_payment_fees FROM public.monde_fees WHERE fee_type = 'payment_fee';
  SELECT balance INTO v_admin_balance FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000000';
  SELECT COUNT(*) INTO v_total_transactions FROM public.monde_fees;

  RETURN json_build_object(
    'total_fees_collected', v_total_fees,
    'topup_fees', v_topup_fees,
    'withdraw_fees', v_withdraw_fees,
    'payment_fees', v_payment_fees,
    'admin_balance', v_admin_balance,
    'total_fee_transactions', v_total_transactions
  );
END;
$$;
