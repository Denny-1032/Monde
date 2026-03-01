-- ============================================
-- 005: Realtime Subscriptions & Useful Views
-- ============================================

-- Enable realtime for transactions (so users see live updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- Enable realtime for profiles (balance updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;

-- ============================================
-- View: User transaction history (unified view)
-- ============================================
CREATE OR REPLACE VIEW public.transaction_history AS
SELECT
  t.id,
  t.sender_id AS user_id,
  t.type,
  t.amount,
  t.currency,
  t.recipient_name,
  t.recipient_phone,
  t.provider,
  t.status,
  t.method,
  t.note,
  t.reference,
  t.fee,
  t.created_at,
  t.completed_at,
  p.name AS provider_name,
  p.color AS provider_color
FROM public.transactions t
LEFT JOIN public.providers p ON p.id = t.provider
ORDER BY t.created_at DESC;

-- ============================================
-- Function: Get user balance
-- ============================================
CREATE OR REPLACE FUNCTION public.get_balance(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT balance FROM public.profiles WHERE id = p_user_id;
$$;

-- ============================================
-- Function: Lookup recipient by phone
-- ============================================
CREATE OR REPLACE FUNCTION public.lookup_recipient(p_phone TEXT)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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
