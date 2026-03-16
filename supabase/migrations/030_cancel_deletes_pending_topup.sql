-- ============================================
-- 030: Cancel pending top-up now DELETES the record
-- ============================================

CREATE OR REPLACE FUNCTION public.cancel_pending_topup(p_transaction_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn RECORD;
BEGIN
  SELECT * INTO v_txn FROM public.transactions
  WHERE id = p_transaction_id
    AND sender_id = auth.uid()
    AND type = 'topup'
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Pending top-up not found');
  END IF;

  -- Delete the pending transaction — no balance was ever credited, so no reversal needed
  DELETE FROM public.transactions WHERE id = p_transaction_id;

  RETURN json_build_object('success', true, 'transaction_id', p_transaction_id);
END;
$$;
