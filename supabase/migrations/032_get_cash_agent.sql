-- ============================================
-- 032: Get Cash — Agent Cash-Out System
-- Adds is_agent flag, cash_out_requests table,
-- and RPCs for the Get Cash feature.
-- Agent gets 70% of fee (75% if 50+ daily txns).
-- Monde gets the remainder. Instant commission.
-- ============================================

-- 1. Add is_agent flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_agent BOOLEAN DEFAULT false;

-- 2. Add 'cash_out' to transaction_type enum
DO $$ BEGIN
  ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'cash_out';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 3. Add 'agent' to payment_method enum
DO $$ BEGIN
  ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'agent';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Cash-out requests table
CREATE TABLE IF NOT EXISTS public.cash_out_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  agent_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
  monde_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  token TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'cancelled')),
  agent_id UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + interval '15 minutes',
  completed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_cash_out_requests_token ON public.cash_out_requests(token) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_cash_out_requests_customer ON public.cash_out_requests(customer_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_cash_out_requests_expires ON public.cash_out_requests(expires_at);

-- RLS
ALTER TABLE public.cash_out_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own cash out requests"
  ON public.cash_out_requests FOR INSERT
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Anyone can read cash out requests"
  ON public.cash_out_requests FOR SELECT
  USING (true);

CREATE POLICY "Customers can cancel own requests"
  ON public.cash_out_requests FOR UPDATE
  USING (customer_id = auth.uid() OR (SELECT is_agent FROM public.profiles WHERE id = auth.uid()));

-- ============================================
-- Helper: Calculate Get Cash fee (tiered, flat)
-- Returns: total_fee, agent_share, monde_share
-- ============================================
CREATE OR REPLACE FUNCTION public.calc_get_cash_fee(p_amount NUMERIC, p_agent_daily_count INT DEFAULT 0)
RETURNS JSON
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_fee NUMERIC(12,2);
  v_agent_pct NUMERIC(3,2);
  v_agent_share NUMERIC(12,2);
  v_monde_share NUMERIC(12,2);
BEGIN
  -- Tiered flat fee
  IF p_amount <= 150 THEN v_fee := 2.50;
  ELSIF p_amount <= 300 THEN v_fee := 5.00;
  ELSIF p_amount <= 500 THEN v_fee := 10.00;
  ELSIF p_amount <= 1000 THEN v_fee := 20.00;
  ELSIF p_amount <= 3000 THEN v_fee := 30.00;
  ELSIF p_amount <= 5000 THEN v_fee := 50.00;
  ELSE v_fee := 50.00; -- cap at K50
  END IF;

  -- Volume bonus: 75% if agent has 50+ completed today, else 70%
  v_agent_pct := CASE WHEN p_agent_daily_count >= 50 THEN 0.75 ELSE 0.70 END;

  v_agent_share := ROUND(v_fee * v_agent_pct, 2);
  v_monde_share := v_fee - v_agent_share;

  RETURN json_build_object(
    'fee', v_fee,
    'agent_commission', v_agent_share,
    'monde_fee', v_monde_share
  );
END;
$$;

-- ============================================
-- RPC: Create cash-out request (customer)
-- ============================================
CREATE OR REPLACE FUNCTION public.create_cash_out_request(p_amount NUMERIC)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token TEXT;
  v_id UUID;
  v_fee_info JSON;
  v_fee NUMERIC(12,2);
  v_customer RECORD;
  v_attempts INT := 0;
BEGIN
  -- Validate caller
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;
  IF p_amount > 5000 THEN
    RETURN json_build_object('success', false, 'error', 'Maximum Get Cash amount is K5,000');
  END IF;

  -- Calculate fee (use 0 for daily count — customer sees default 70/30)
  v_fee_info := calc_get_cash_fee(p_amount, 0);
  v_fee := (v_fee_info->>'fee')::NUMERIC;

  -- Check customer balance
  SELECT * INTO v_customer FROM profiles WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Profile not found');
  END IF;
  IF v_customer.balance < (p_amount + v_fee) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance. You need K' || (p_amount + v_fee)::TEXT);
  END IF;

  -- Generate unique 6-digit token
  LOOP
    v_token := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM cash_out_requests
      WHERE token = v_token AND status = 'pending' AND expires_at > now()
    );
    v_attempts := v_attempts + 1;
    IF v_attempts > 10 THEN
      RETURN json_build_object('success', false, 'error', 'Could not generate unique code. Try again.');
    END IF;
  END LOOP;

  -- Expire any existing pending requests from this customer
  UPDATE cash_out_requests SET status = 'expired'
  WHERE customer_id = auth.uid() AND status = 'pending';

  -- Insert new request
  INSERT INTO cash_out_requests (customer_id, amount, fee, token)
  VALUES (auth.uid(), p_amount, v_fee, v_token)
  RETURNING id INTO v_id;

  RETURN json_build_object(
    'success', true,
    'request_id', v_id,
    'token', v_token,
    'amount', p_amount,
    'fee', v_fee,
    'total', p_amount + v_fee
  );
END;
$$;

-- ============================================
-- RPC: Lookup cash-out request (agent scans/enters token)
-- ============================================
CREATE OR REPLACE FUNCTION public.lookup_cash_out_request(p_token TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_customer RECORD;
  v_agent RECORD;
  v_agent_daily_count INT;
  v_fee_info JSON;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify caller is agent
  SELECT * INTO v_agent FROM profiles WHERE id = auth.uid();
  IF NOT v_agent.is_agent THEN
    RETURN json_build_object('success', false, 'error', 'Only Monde agents can process cash-outs');
  END IF;

  -- Find the request
  SELECT * INTO v_req FROM cash_out_requests
  WHERE token = p_token AND status = 'pending' AND expires_at > now()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired code');
  END IF;

  -- Cannot process own request
  IF v_req.customer_id = auth.uid() THEN
    RETURN json_build_object('success', false, 'error', 'Cannot process your own request');
  END IF;

  -- Get customer profile
  SELECT * INTO v_customer FROM profiles WHERE id = v_req.customer_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Customer not found');
  END IF;

  -- Calculate actual fee split with agent's volume bonus
  v_agent_daily_count := (
    SELECT COUNT(*) FROM cash_out_requests
    WHERE agent_id = auth.uid() AND status = 'completed'
    AND completed_at >= CURRENT_DATE
  );
  v_fee_info := calc_get_cash_fee(v_req.amount, v_agent_daily_count);

  RETURN json_build_object(
    'success', true,
    'request_id', v_req.id,
    'amount', v_req.amount,
    'fee', v_req.fee,
    'agent_commission', (v_fee_info->>'agent_commission')::NUMERIC,
    'monde_fee', (v_fee_info->>'monde_fee')::NUMERIC,
    'customer_name', v_customer.full_name,
    'customer_phone', v_customer.phone,
    'volume_bonus', v_agent_daily_count >= 50,
    'daily_count', v_agent_daily_count
  );
END;
$$;

-- ============================================
-- RPC: Process cash-out (agent confirms cash given)
-- Atomically transfers money and records transactions
-- ============================================
CREATE OR REPLACE FUNCTION public.process_cash_out(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req RECORD;
  v_agent_id UUID := auth.uid();
  v_agent RECORD;
  v_customer RECORD;
  v_agent_daily_count INT;
  v_fee_info JSON;
  v_fee NUMERIC(12,2);
  v_agent_commission NUMERIC(12,2);
  v_monde_fee NUMERIC(12,2);
  v_reference TEXT;
  v_monde_admin_id UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
  IF v_agent_id IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify agent
  SELECT * INTO v_agent FROM profiles WHERE id = v_agent_id;
  IF NOT v_agent.is_agent THEN
    RETURN json_build_object('success', false, 'error', 'Only Monde agents can process cash-outs');
  END IF;

  -- Lock and fetch the request
  SELECT * INTO v_req FROM cash_out_requests
  WHERE id = p_request_id AND status = 'pending' AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found, already processed, or expired');
  END IF;

  -- Cannot process own request
  IF v_req.customer_id = v_agent_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot process your own request');
  END IF;

  -- Lock and verify customer balance
  SELECT * INTO v_customer FROM profiles WHERE id = v_req.customer_id FOR UPDATE;
  IF v_customer.balance < (v_req.amount + v_req.fee) THEN
    RETURN json_build_object('success', false, 'error', 'Customer has insufficient balance');
  END IF;

  -- Calculate fee split with volume bonus
  v_agent_daily_count := (
    SELECT COUNT(*) FROM cash_out_requests
    WHERE agent_id = v_agent_id AND status = 'completed'
    AND completed_at >= CURRENT_DATE
  );
  v_fee_info := calc_get_cash_fee(v_req.amount, v_agent_daily_count);
  v_fee := (v_fee_info->>'fee')::NUMERIC;
  v_agent_commission := (v_fee_info->>'agent_commission')::NUMERIC;
  v_monde_fee := (v_fee_info->>'monde_fee')::NUMERIC;

  -- Generate reference
  v_reference := 'CO-' || UPPER(SUBSTR(gen_random_uuid()::TEXT, 1, 8));

  -- === ATOMIC TRANSFERS ===

  -- 1. Deduct from customer (amount + fee)
  UPDATE profiles SET balance = balance - (v_req.amount + v_fee)
  WHERE id = v_req.customer_id;

  -- 2. Credit agent (amount + agent commission) — INSTANT commission
  UPDATE profiles SET balance = balance + v_req.amount + v_agent_commission
  WHERE id = v_agent_id;

  -- 3. Credit Monde fee ledger
  IF v_monde_fee > 0 THEN
    UPDATE profiles SET balance = balance + v_monde_fee
    WHERE id = v_monde_admin_id;
  END IF;

  -- === TRANSACTION RECORDS ===

  -- Customer transaction (cash_out — debit)
  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_req.customer_id,
    v_agent_id,
    'cash_out',
    v_req.amount,
    v_customer.currency,
    v_agent.full_name,
    v_agent.phone,
    v_customer.provider,
    'completed',
    'agent',
    'Get Cash via Monde Agent',
    v_reference,
    v_fee,
    now()
  );

  -- Agent transaction (receive — credit, includes commission)
  INSERT INTO transactions (
    sender_id, recipient_id, type, amount, currency,
    recipient_name, recipient_phone, provider, status, method,
    note, reference, fee, completed_at
  ) VALUES (
    v_agent_id,
    v_req.customer_id,
    'receive',
    v_req.amount + v_agent_commission,
    v_agent.currency,
    v_customer.full_name,
    v_customer.phone,
    v_agent.provider,
    'completed',
    'agent',
    'Get Cash — Agent commission K' || v_agent_commission::TEXT,
    v_reference || '-A',
    0,
    now()
  );

  -- === UPDATE REQUEST ===
  UPDATE cash_out_requests SET
    status = 'completed',
    agent_id = v_agent_id,
    agent_commission = v_agent_commission,
    monde_fee = v_monde_fee,
    completed_at = now()
  WHERE id = p_request_id;

  RETURN json_build_object(
    'success', true,
    'reference', v_reference,
    'amount', v_req.amount,
    'fee', v_fee,
    'agent_commission', v_agent_commission,
    'monde_fee', v_monde_fee,
    'customer_name', v_customer.full_name,
    'volume_bonus', v_agent_daily_count >= 50
  );
END;
$$;

-- ============================================
-- RPC: Cancel cash-out request (customer)
-- ============================================
CREATE OR REPLACE FUNCTION public.cancel_cash_out_request(p_request_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  UPDATE cash_out_requests SET status = 'cancelled'
  WHERE id = p_request_id AND customer_id = auth.uid() AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- ============================================
-- Admin helper: Toggle is_agent (for admin dashboard)
-- ============================================
CREATE OR REPLACE FUNCTION public.admin_toggle_agent(p_user_id UUID, p_is_agent BOOLEAN)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true) THEN
    RETURN json_build_object('success', false, 'error', 'Admin access required');
  END IF;

  UPDATE profiles SET is_agent = p_is_agent WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  RETURN json_build_object('success', true, 'is_agent', p_is_agent);
END;
$$;
