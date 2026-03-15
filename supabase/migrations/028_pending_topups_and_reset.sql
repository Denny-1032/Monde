-- ============================================
-- 028: Pending top-ups + withdrawal reversals + account reset
-- ============================================
-- Top-ups are now two-phase:
--   1. create_pending_topup — called by client after Lipila collect is accepted
--      Creates a 'pending' transaction, NO balance change
--   2. confirm_pending_topup — called by lipila-callback when Lipila says "Successful"
--      Credits user wallet, collects fees, marks completed
--
-- Withdrawals: if Lipila callback says "Failed", reverse_failed_withdraw
-- refunds the user's balance.
--
-- Account reset: zero all balances and clear transaction history for clean audit.

-- ============================================================
-- 1. create_pending_topup (called by authenticated user)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_pending_topup(
  p_user_id UUID,
  p_amount NUMERIC,
  p_provider TEXT DEFAULT 'airtel',
  p_note TEXT DEFAULT NULL,
  p_lipila_reference TEXT DEFAULT NULL
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
  v_total_fee NUMERIC(12,2);
  v_provider_rec RECORD;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized');
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

  v_total_fee := ROUND(p_amount * 0.03, 2);

  SELECT * INTO v_user FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User profile not found');
  END IF;

  v_reference := 'TOP-' || gen_random_uuid()::TEXT;

  -- Create PENDING transaction — NO balance changes yet
  INSERT INTO public.transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, lipila_reference_id
  ) VALUES (
    p_user_id, p_user_id, 'topup', p_amount, v_user.currency,
    'Monde Wallet', v_user.phone, p_provider, 'pending', 'wallet',
    COALESCE(p_note, 'Top up from ' || COALESCE(v_provider_rec.name, p_provider)),
    v_reference, v_total_fee, p_lipila_reference
  ) RETURNING id INTO v_txn_id;

  RETURN json_build_object(
    'success', true,
    'transaction_id', v_txn_id,
    'reference', v_reference,
    'amount', p_amount,
    'fee', v_total_fee,
    'status', 'pending'
  );
END;
$$;

-- ============================================================
-- 2. confirm_pending_topup (called by lipila-callback via service role)
-- ============================================================
CREATE OR REPLACE FUNCTION public.confirm_pending_topup(p_transaction_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn RECORD;
  v_monde_fee NUMERIC(12,2);
  v_lipila_fee NUMERIC(12,2);
  v_monde_admin_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- Only callable by service role (auth.uid() is NULL with service_role_key)
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Not authorized — service role only';
  END IF;

  SELECT * INTO v_txn FROM public.transactions
  WHERE id = p_transaction_id AND status = 'pending' AND type = 'topup'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found or already processed');
  END IF;

  -- Fee split: total 3%, Lipila takes ~2.5%, Monde keeps ~0.5%
  v_lipila_fee := ROUND(v_txn.amount * 0.025, 2);
  v_monde_fee := GREATEST(COALESCE(v_txn.fee, ROUND(v_txn.amount * 0.03, 2)) - v_lipila_fee, 0);

  -- Credit user's wallet with the full top-up amount
  UPDATE public.profiles SET balance = balance + v_txn.amount WHERE id = v_txn.sender_id;

  -- Credit Monde's fee share to admin account
  UPDATE public.profiles SET balance = balance + v_monde_fee WHERE id = v_monde_admin_id;

  -- Mark transaction completed
  UPDATE public.transactions SET status = 'completed', completed_at = now() WHERE id = p_transaction_id;

  -- Record fee in ledger
  INSERT INTO public.monde_fees (transaction_id, fee_type, gross_amount, fee_amount, currency, user_id)
  VALUES (p_transaction_id, 'topup_fee', v_txn.amount, v_monde_fee, v_txn.currency, v_txn.sender_id);

  RETURN jsonb_build_object('success', true, 'user_id', v_txn.sender_id, 'amount', v_txn.amount);
END;
$$;

-- ============================================================
-- 3. reverse_failed_withdraw (called by lipila-callback via service role)
-- ============================================================
CREATE OR REPLACE FUNCTION public.reverse_failed_withdraw(p_transaction_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn RECORD;
  v_monde_fee NUMERIC(12,2);
  v_lipila_fee NUMERIC(12,2);
  v_total_fee NUMERIC(12,2);
  v_monde_admin_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  -- Only callable by service role
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Not authorized — service role only';
  END IF;

  SELECT * INTO v_txn FROM public.transactions
  WHERE id = p_transaction_id AND type = 'withdraw'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found');
  END IF;

  IF v_txn.status = 'failed' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Already reversed');
  END IF;

  v_total_fee := COALESCE(v_txn.fee, ROUND(v_txn.amount * 0.03, 2));
  v_lipila_fee := ROUND(v_txn.amount * 0.015, 2);
  v_monde_fee := GREATEST(v_total_fee - v_lipila_fee, 0);

  -- Refund user: return amount + total fee
  UPDATE public.profiles SET balance = balance + v_txn.amount + v_total_fee WHERE id = v_txn.sender_id;

  -- Debit Monde's fee share from admin account
  UPDATE public.profiles SET balance = GREATEST(balance - v_monde_fee, 0) WHERE id = v_monde_admin_id;

  -- Mark transaction as failed
  UPDATE public.transactions
  SET status = 'failed',
      note = COALESCE(p_reason, 'Withdrawal reversed: disbursement failed')
  WHERE id = p_transaction_id;

  -- Remove the fee ledger entry
  DELETE FROM public.monde_fees WHERE transaction_id = p_transaction_id;

  RETURN jsonb_build_object('success', true, 'user_id', v_txn.sender_id, 'refunded', v_txn.amount + v_total_fee);
END;
$$;

-- ============================================================
-- 4. RESET: Zero all balances and clear transaction history
-- ============================================================
-- Delete fee ledger first (FK to transactions)
DELETE FROM public.monde_fees;
-- Delete all transactions
DELETE FROM public.transactions;
-- Delete unmatched callbacks
DELETE FROM public.lipila_callbacks WHERE true;
-- Reset all balances to zero (users + admin)
UPDATE public.profiles SET balance = 0;
