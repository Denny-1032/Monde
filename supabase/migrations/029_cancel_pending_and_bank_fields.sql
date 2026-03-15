-- ============================================
-- 029: Cancel pending top-ups + bank linking fields
-- ============================================

-- ============================================================
-- 1. cancel_pending_topup (called by authenticated user)
-- ============================================================
CREATE OR REPLACE FUNCTION public.cancel_pending_topup(p_transaction_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn RECORD;
BEGIN
  -- User must own the transaction
  SELECT * INTO v_txn FROM public.transactions
  WHERE id = p_transaction_id
    AND sender_id = auth.uid()
    AND type = 'topup'
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Pending top-up not found');
  END IF;

  -- Mark as cancelled — no balance was ever credited, so no reversal needed
  UPDATE public.transactions
  SET status = 'failed',
      note = 'Cancelled by user'
  WHERE id = p_transaction_id;

  RETURN json_build_object('success', true, 'transaction_id', p_transaction_id);
END;
$$;

-- ============================================================
-- 2. expire_stale_pending_topups (service role only)
--    Auto-expire pending top-ups older than N minutes
-- ============================================================
CREATE OR REPLACE FUNCTION public.expire_stale_pending_topups(p_max_age_minutes INTEGER DEFAULT 15)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Only callable by service role (auth.uid() is NULL)
  IF auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Not authorized — service role only';
  END IF;

  UPDATE public.transactions
  SET status = 'failed',
      note = 'Expired: no payment confirmation received'
  WHERE type = 'topup'
    AND status = 'pending'
    AND created_at < now() - (p_max_age_minutes || ' minutes')::INTERVAL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'expired_count', v_count);
END;
$$;

-- ============================================================
-- 3. Add swift_code column to linked_accounts for bank accounts
-- ============================================================
ALTER TABLE public.linked_accounts
  ADD COLUMN IF NOT EXISTS swift_code TEXT;

-- Backfill existing bank accounts based on provider
UPDATE public.linked_accounts SET swift_code = 'FIRNZMLX' WHERE provider = 'fnb' AND swift_code IS NULL;
UPDATE public.linked_accounts SET swift_code = 'ZNCOZMLU' WHERE provider = 'zanaco' AND swift_code IS NULL;
UPDATE public.linked_accounts SET swift_code = 'BARCZMLU' WHERE provider = 'absa' AND swift_code IS NULL;
