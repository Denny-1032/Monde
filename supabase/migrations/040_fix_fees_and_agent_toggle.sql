-- ============================================
-- 040: Fix monde_fees constraints, agent toggle, and payment blocks
-- ============================================

-- 1. Fix monde_fees CHECK constraints
--    - Allow cashin_fee and cashout_fee fee types
--    - Allow negative fee_amount (for cashin commission paid BY Monde)
ALTER TABLE public.monde_fees DROP CONSTRAINT IF EXISTS monde_fees_fee_amount_check;
ALTER TABLE public.monde_fees DROP CONSTRAINT IF EXISTS monde_fees_fee_type_check;

ALTER TABLE public.monde_fees ADD CONSTRAINT monde_fees_fee_type_check
  CHECK (fee_type IN ('topup_fee', 'withdraw_fee', 'payment_fee', 'cashout_fee', 'cashin_fee'));

-- No fee_amount constraint needed — cashin_fee is negative (Monde pays agent)

-- 2. Fix admin_toggle_agent: allow toggling agent on ANY account including admins
CREATE OR REPLACE FUNCTION public.admin_toggle_agent(
  p_user_id UUID,
  p_is_agent BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_target RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: admin only');
  END IF;

  SELECT * INTO v_target FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Block toggling on fee ledger account
  IF p_user_id = '00000000-0000-0000-0000-000000000000'::UUID THEN
    RETURN json_build_object('success', false, 'error', 'Cannot modify system accounts');
  END IF;

  IF p_is_agent THEN
    v_code := generate_agent_code();
    UPDATE profiles SET is_agent = true, agent_code = v_code WHERE id = p_user_id;
  ELSE
    UPDATE profiles SET is_agent = false WHERE id = p_user_id;
  END IF;

  RETURN json_build_object('success', true, 'is_agent', p_is_agent, 'agent_code', v_code);
END;
$$;

-- 3. Fix process_payment: also block fee ledger phone
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

  -- Block payments to system accounts (admin + fee ledger)
  IF p_recipient_phone IN ('+260000000000', '+260000000001') THEN
    RETURN json_build_object('success', false, 'error', 'Cannot send money to system accounts');
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

  -- Block frozen accounts
  IF v_sender.is_frozen THEN
    RETURN json_build_object('success', false, 'error', 'Your account has been frozen. Contact support.');
  END IF;

  -- Block agents from P2P
  IF v_sender.is_agent THEN
    RETURN json_build_object('success', false, 'error', 'Agent accounts cannot send money directly. Use Deposit or Agent Transfer.');
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
    COALESCE(v_recipient.full_name, 'External'),
    p_recipient_phone,
    v_sender.provider,
    'completed',
    p_method,
    COALESCE(p_note, ''),
    v_reference,
    v_fee,
    now()
  ) RETURNING id INTO v_txn_id;

  -- Create recipient mirror transaction (receive)
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
      v_recipient.currency,
      v_sender.full_name,
      v_sender.phone,
      v_recipient.provider,
      'completed',
      p_method,
      COALESCE(p_note, ''),
      v_reference || '-R',
      0.00,
      now()
    );
  END IF;

  -- Record fee
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
    'recipient_name', COALESCE(v_recipient.full_name, 'External'),
    'new_balance', v_sender.balance - (p_amount + v_fee)
  );
END;
$$;

-- 4. Fix admin_freeze_account: also allow freezing admin accounts (but not fee ledger)
CREATE OR REPLACE FUNCTION public.admin_freeze_account(
  p_user_id UUID,
  p_freeze BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target RECORD;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: admin only');
  END IF;

  SELECT * INTO v_target FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  -- Cannot freeze fee ledger
  IF p_user_id = '00000000-0000-0000-0000-000000000000'::UUID THEN
    RETURN json_build_object('success', false, 'error', 'Cannot freeze system accounts');
  END IF;

  UPDATE profiles SET is_frozen = p_freeze WHERE id = p_user_id;

  RETURN json_build_object(
    'success', true,
    'user_id', p_user_id,
    'is_frozen', p_freeze,
    'full_name', v_target.full_name
  );
END;
$$;
