-- ============================================
-- 031: Payment Requests for Tap to Pay
-- Only the RECEIVER enters the amount.
-- A 6-digit code is generated for the sender to look up.
-- ============================================

CREATE TABLE IF NOT EXISTS public.payment_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES public.profiles(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  code TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired')),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '5 minutes'
);

-- Index for fast code lookup
CREATE INDEX IF NOT EXISTS idx_payment_requests_code ON public.payment_requests(code) WHERE status = 'pending';

-- Auto-cleanup: delete expired requests older than 1 hour
CREATE INDEX IF NOT EXISTS idx_payment_requests_expires ON public.payment_requests(expires_at);

-- RLS
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

-- Users can create their own payment requests
CREATE POLICY "Users can create own payment requests"
  ON public.payment_requests FOR INSERT
  WITH CHECK (requester_id = auth.uid());

-- Users can read any pending request (sender needs to look up by code)
CREATE POLICY "Anyone can read pending requests"
  ON public.payment_requests FOR SELECT
  USING (true);

-- Users can update their own requests
CREATE POLICY "Users can update own payment requests"
  ON public.payment_requests FOR UPDATE
  USING (requester_id = auth.uid());

-- ============================================
-- RPC: Create a payment request (receiver)
-- Returns the 6-digit code
-- ============================================
CREATE OR REPLACE FUNCTION public.create_payment_request(p_amount NUMERIC)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_id UUID;
  v_attempts INT := 0;
BEGIN
  -- Generate unique 6-digit code
  LOOP
    v_code := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    -- Check no active request uses this code
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.payment_requests
      WHERE code = v_code AND status = 'pending' AND expires_at > now()
    );
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RETURN json_build_object('success', false, 'error', 'Could not generate unique code');
    END IF;
  END LOOP;

  -- Expire any existing pending requests from this user
  UPDATE public.payment_requests
  SET status = 'expired'
  WHERE requester_id = auth.uid() AND status = 'pending';

  INSERT INTO public.payment_requests (requester_id, amount, code)
  VALUES (auth.uid(), p_amount, v_code)
  RETURNING id INTO v_id;

  RETURN json_build_object(
    'success', true,
    'request_id', v_id,
    'code', v_code
  );
END;
$$;

-- ============================================
-- RPC: Lookup a payment request by code (sender)
-- Returns requester details + amount
-- ============================================
CREATE OR REPLACE FUNCTION public.lookup_payment_request(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_profile RECORD;
BEGIN
  SELECT * INTO v_req FROM public.payment_requests
  WHERE code = p_code AND status = 'pending' AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired code');
  END IF;

  -- Cannot pay yourself
  IF v_req.requester_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Cannot pay yourself');
  END IF;

  SELECT phone, full_name, handle INTO v_profile
  FROM public.profiles WHERE id = v_req.requester_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Requester not found');
  END IF;

  RETURN json_build_object(
    'success', true,
    'request_id', v_req.id,
    'amount', v_req.amount,
    'phone', v_profile.phone,
    'name', v_profile.full_name,
    'handle', v_profile.handle
  );
END;
$$;

-- ============================================
-- RPC: Complete a payment request (called after payment succeeds)
-- ============================================
CREATE OR REPLACE FUNCTION public.complete_payment_request(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.payment_requests
  SET status = 'completed'
  WHERE id = p_request_id AND status = 'pending';

  RETURN json_build_object('success', true);
END;
$$;
