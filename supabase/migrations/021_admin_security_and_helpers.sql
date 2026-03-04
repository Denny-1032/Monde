-- ============================================
-- 021: Admin Function Security & Extended Helpers
-- ============================================
-- Fixes:
--   1. SECURITY: Add admin-only auth check to all admin RPCs
--      (only admin user or service_role can call them)
--   2. Update get_monde_fee_summary with admin auth check
--   3. Add get_monde_fees_by_period — date-range filtered fee summary
--   4. Add get_monde_total_float — sum of all non-admin user balances
--   5. Add get_monde_fee_details — paginated fee ledger for auditing
--   6. Prevent regular users from sending money to the admin account

-- Admin UUID constant used in all checks below
-- '00000000-0000-0000-0000-000000000000'

-- ============================================
-- 1. Update get_monde_fee_summary with admin auth check
-- ============================================
CREATE OR REPLACE FUNCTION public.get_monde_fee_summary()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000000';
  v_total_fees NUMERIC(12,2);
  v_topup_fees NUMERIC(12,2);
  v_withdraw_fees NUMERIC(12,2);
  v_payment_fees NUMERIC(12,2);
  v_admin_balance NUMERIC(12,2);
  v_total_transactions BIGINT;
BEGIN
  -- Only admin user or service_role (auth.uid() IS NULL) can call this
  IF auth.uid() IS NOT NULL AND auth.uid() != v_admin_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: admin access only');
  END IF;

  SELECT COALESCE(SUM(fee_amount), 0) INTO v_total_fees FROM public.monde_fees;
  SELECT COALESCE(SUM(fee_amount), 0) INTO v_topup_fees FROM public.monde_fees WHERE fee_type = 'topup_fee';
  SELECT COALESCE(SUM(fee_amount), 0) INTO v_withdraw_fees FROM public.monde_fees WHERE fee_type = 'withdraw_fee';
  SELECT COALESCE(SUM(fee_amount), 0) INTO v_payment_fees FROM public.monde_fees WHERE fee_type = 'payment_fee';
  SELECT balance INTO v_admin_balance FROM public.profiles WHERE id = v_admin_id;
  SELECT COUNT(*) INTO v_total_transactions FROM public.monde_fees;

  RETURN json_build_object(
    'success', true,
    'total_fees_collected', v_total_fees,
    'topup_fees', v_topup_fees,
    'withdraw_fees', v_withdraw_fees,
    'payment_fees', v_payment_fees,
    'admin_balance', v_admin_balance,
    'total_fee_transactions', v_total_transactions
  );
END;
$$;

-- ============================================
-- 2. Fee summary by date range (admin-only)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_monde_fees_by_period(
  p_start TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days'),
  p_end   TIMESTAMPTZ DEFAULT now()
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000000';
  v_total   NUMERIC(12,2);
  v_topup   NUMERIC(12,2);
  v_withdraw NUMERIC(12,2);
  v_payment NUMERIC(12,2);
  v_count   BIGINT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != v_admin_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: admin access only');
  END IF;

  SELECT COALESCE(SUM(fee_amount), 0), COUNT(*)
    INTO v_total, v_count
    FROM public.monde_fees
    WHERE created_at >= p_start AND created_at < p_end;

  SELECT COALESCE(SUM(fee_amount), 0) INTO v_topup
    FROM public.monde_fees
    WHERE fee_type = 'topup_fee' AND created_at >= p_start AND created_at < p_end;

  SELECT COALESCE(SUM(fee_amount), 0) INTO v_withdraw
    FROM public.monde_fees
    WHERE fee_type = 'withdraw_fee' AND created_at >= p_start AND created_at < p_end;

  SELECT COALESCE(SUM(fee_amount), 0) INTO v_payment
    FROM public.monde_fees
    WHERE fee_type = 'payment_fee' AND created_at >= p_start AND created_at < p_end;

  RETURN json_build_object(
    'success', true,
    'period_start', p_start,
    'period_end', p_end,
    'total_fees', v_total,
    'topup_fees', v_topup,
    'withdraw_fees', v_withdraw,
    'payment_fees', v_payment,
    'fee_transactions', v_count
  );
END;
$$;

-- ============================================
-- 3. Total float — all user balances excl. admin (admin-only)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_monde_total_float()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000000';
  v_total_float    NUMERIC(12,2);
  v_admin_balance  NUMERIC(12,2);
  v_user_count     BIGINT;
  v_total_users    BIGINT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != v_admin_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: admin access only');
  END IF;

  SELECT COALESCE(SUM(balance), 0), COUNT(*)
    INTO v_total_float, v_user_count
    FROM public.profiles
    WHERE id != v_admin_id AND balance > 0;

  SELECT COUNT(*) INTO v_total_users
    FROM public.profiles
    WHERE id != v_admin_id;

  SELECT COALESCE(balance, 0) INTO v_admin_balance
    FROM public.profiles
    WHERE id = v_admin_id;

  RETURN json_build_object(
    'success', true,
    'total_float', v_total_float,
    'admin_balance', v_admin_balance,
    'system_total', v_total_float + v_admin_balance,
    'users_with_balance', v_user_count,
    'total_users', v_total_users
  );
END;
$$;

-- ============================================
-- 4. Paginated fee ledger details (admin-only)
-- ============================================
CREATE OR REPLACE FUNCTION public.get_monde_fee_details(
  p_limit  INT DEFAULT 50,
  p_offset INT DEFAULT 0,
  p_fee_type TEXT DEFAULT NULL,
  p_start TIMESTAMPTZ DEFAULT NULL,
  p_end   TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id UUID := '00000000-0000-0000-0000-000000000000';
  v_result JSON;
  v_total BIGINT;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != v_admin_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: admin access only');
  END IF;

  SELECT COUNT(*) INTO v_total
    FROM public.monde_fees mf
    WHERE (p_fee_type IS NULL OR mf.fee_type = p_fee_type)
      AND (p_start IS NULL OR mf.created_at >= p_start)
      AND (p_end IS NULL OR mf.created_at < p_end);

  SELECT json_agg(row_to_json(r)) INTO v_result
  FROM (
    SELECT
      mf.id,
      mf.transaction_id,
      mf.fee_type,
      mf.gross_amount,
      mf.fee_amount,
      mf.currency,
      mf.user_id,
      p.full_name AS user_name,
      p.phone AS user_phone,
      mf.created_at
    FROM public.monde_fees mf
    LEFT JOIN public.profiles p ON p.id = mf.user_id
    WHERE (p_fee_type IS NULL OR mf.fee_type = p_fee_type)
      AND (p_start IS NULL OR mf.created_at >= p_start)
      AND (p_end IS NULL OR mf.created_at < p_end)
    ORDER BY mf.created_at DESC
    LIMIT p_limit
    OFFSET p_offset
  ) r;

  RETURN json_build_object(
    'success', true,
    'data', COALESCE(v_result, '[]'::json),
    'total', v_total,
    'limit', p_limit,
    'offset', p_offset
  );
END;
$$;

-- ============================================
-- 5. Block payments TO the admin account
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

  -- Block payments to the Monde admin account
  IF p_recipient_phone = '+260000000000' THEN
    RETURN json_build_object('success', false, 'error', 'Cannot send money to this account');
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
