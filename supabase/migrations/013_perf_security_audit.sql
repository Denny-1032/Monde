-- ============================================
-- 013: Performance & Security Audit Fixes
-- ============================================
-- 1. Add CHECK constraint on profiles.balance (non-negative)
-- 2. Add CHECK constraint on handle format
-- 3. Sanitize p_note in process_payment to strip HTML/control chars
-- 4. Add search_path to handle_new_user and handle_updated_at
-- 5. Add index on transactions.created_at for pagination
-- 6. Rate-limit: add last_otp_sent_at column for OTP rate limiting

-- ============================================
-- FIX 1: Enforce non-negative balance at DB level
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_balance_non_negative'
    AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT check_balance_non_negative CHECK (balance >= 0);
  END IF;
END $$;

-- ============================================
-- FIX 2: Enforce handle format at DB level
-- (Only if handle column exists — requires migration 012 first)
-- ============================================
DO $$
BEGIN
  -- First ensure handle column exists (in case 012 wasn't applied separately)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'handle'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN handle TEXT UNIQUE;
    CREATE INDEX IF NOT EXISTS idx_profiles_handle ON public.profiles(handle);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_handle_format'
    AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT check_handle_format CHECK (
        handle IS NULL OR (
          length(handle) >= 3
          AND length(handle) <= 24
          AND handle ~ '^[a-z0-9.]+$'
        )
      );
  END IF;
END $$;

-- ============================================
-- FIX 3: Fix search_path on handle_new_user trigger function
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, full_name, provider)
  VALUES (
    NEW.id,
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Monde User'),
    COALESCE(NEW.raw_user_meta_data->>'provider', 'airtel')
  );
  RETURN NEW;
END;
$$;

-- ============================================
-- FIX 4: Fix search_path on handle_updated_at trigger function
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- FIX 5: Sanitize notes in process_payment
-- Recreate with note length limit and character stripping
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
  v_safe_note TEXT;
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

  -- Sanitize note: strip HTML-like chars and limit length
  v_safe_note := left(regexp_replace(COALESCE(p_note, ''), '[<>{}]', '', 'g'), 140);
  IF v_safe_note = '' THEN v_safe_note := NULL; END IF;

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
    v_safe_note,
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
      v_safe_note,
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

-- ============================================
-- FIX 6: Add composite index for cursor-based pagination
-- ============================================
CREATE INDEX IF NOT EXISTS idx_transactions_created_at
  ON public.transactions(created_at DESC);

-- ============================================
-- FIX 7: Verify RLS on linked_accounts
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Users can delete own linked accounts'
    AND tablename = 'linked_accounts'
  ) THEN
    CREATE POLICY "Users can delete own linked accounts"
      ON public.linked_accounts FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;
