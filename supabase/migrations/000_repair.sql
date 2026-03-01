-- ============================================
-- 000: REPAIR SCRIPT
-- Run this ONCE in the SQL Editor to fix any
-- partial migration state, then re-run 002-005
-- ============================================

-- Drop the view that depends on providers (will be recreated by 005)
DROP VIEW IF EXISTS public.transaction_history;

-- Drop functions that will be recreated
DROP FUNCTION IF EXISTS public.process_payment;
DROP FUNCTION IF EXISTS public.get_balance;
DROP FUNCTION IF EXISTS public.lookup_recipient;

-- Safely ensure enums exist (skip if already created)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_type') THEN
    CREATE TYPE public.transaction_type AS ENUM ('send', 'receive', 'payment');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'transaction_status') THEN
    CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'failed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE public.payment_method AS ENUM ('qr', 'nfc', 'manual');
  END IF;
END $$;

-- Ensure transactions table exists
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type public.transaction_type NOT NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'ZMW',
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'airtel',
  status public.transaction_status NOT NULL DEFAULT 'pending',
  method public.payment_method NOT NULL DEFAULT 'qr',
  note TEXT,
  reference TEXT UNIQUE DEFAULT ('TXN-' || gen_random_uuid()::TEXT),
  fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_transactions_sender ON public.transactions(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_recipient ON public.transactions(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_sender_type ON public.transactions(sender_id, type, created_at DESC);

-- Ensure RLS policies exist
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own transactions' AND tablename = 'transactions') THEN
    CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT
      USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create transactions as sender' AND tablename = 'transactions') THEN
    CREATE POLICY "Users can create transactions as sender" ON public.transactions FOR INSERT
      WITH CHECK (auth.uid() = sender_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own pending transactions' AND tablename = 'transactions') THEN
    CREATE POLICY "Users can update own pending transactions" ON public.transactions FOR UPDATE
      USING (auth.uid() = sender_id AND status = 'pending');
  END IF;
END $$;

-- Ensure providers table exists with seed data
CREATE TABLE IF NOT EXISTS public.providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#000000',
  prefix TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  min_amount NUMERIC(12, 2) NOT NULL DEFAULT 1.00,
  max_amount NUMERIC(12, 2) NOT NULL DEFAULT 50000.00,
  fee_percent NUMERIC(5, 4) NOT NULL DEFAULT 0.0000,
  fee_flat NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can view providers' AND tablename = 'providers') THEN
    CREATE POLICY "Anyone can view providers" ON public.providers FOR SELECT USING (true);
  END IF;
END $$;

INSERT INTO public.providers (id, name, color, prefix, is_active) VALUES
  ('airtel', 'Airtel Money', '#ED1C24', '097', true),
  ('mtn', 'MTN MoMo', '#FFCB05', '096', true),
  ('zamtel', 'Zamtel Kwacha', '#00A650', '095', true),
  ('fnb', 'FNB Zambia', '#009FDA', '', true),
  ('zanaco', 'Zanaco', '#003B71', '', true),
  ('absa', 'Absa Bank', '#AF1832', '', true)
ON CONFLICT (id) DO NOTHING;

-- Now create the view (providers table exists now)
CREATE OR REPLACE VIEW public.transaction_history AS
SELECT
  t.id, t.sender_id AS user_id, t.type, t.amount, t.currency,
  t.recipient_name, t.recipient_phone, t.provider, t.status, t.method,
  t.note, t.reference, t.fee, t.created_at, t.completed_at,
  p.name AS provider_name, p.color AS provider_color
FROM public.transactions t
LEFT JOIN public.providers p ON p.id = t.provider
ORDER BY t.created_at DESC;

-- Process payment function
CREATE OR REPLACE FUNCTION public.process_payment(
  p_sender_id UUID, p_recipient_phone TEXT, p_amount NUMERIC,
  p_method public.payment_method DEFAULT 'qr', p_note TEXT DEFAULT NULL
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sender RECORD; v_recipient RECORD;
  v_txn_id UUID; v_reference TEXT; v_fee NUMERIC(12,2) := 0.00;
BEGIN
  IF p_amount <= 0 THEN
    RETURN json_build_object('success', false, 'error', 'Amount must be greater than zero');
  END IF;
  SELECT * INTO v_sender FROM public.profiles WHERE id = p_sender_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Sender profile not found');
  END IF;
  IF v_sender.balance < (p_amount + v_fee) THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient balance');
  END IF;
  SELECT * INTO v_recipient FROM public.profiles
    WHERE phone = p_recipient_phone AND id != p_sender_id LIMIT 1;
  v_reference := 'TXN-' || gen_random_uuid()::TEXT;
  UPDATE public.profiles SET balance = balance - (p_amount + v_fee) WHERE id = p_sender_id;
  IF v_recipient.id IS NOT NULL THEN
    UPDATE public.profiles SET balance = balance + p_amount WHERE id = v_recipient.id;
  END IF;
  INSERT INTO public.transactions (
    sender_id, recipient_id, type, amount, currency, recipient_name, recipient_phone,
    provider, status, method, note, reference, fee, completed_at
  ) VALUES (
    p_sender_id, v_recipient.id, 'send', p_amount, v_sender.currency,
    COALESCE(v_recipient.full_name, 'External User'), p_recipient_phone,
    v_sender.provider, 'completed', p_method, p_note, v_reference, v_fee, now()
  ) RETURNING id INTO v_txn_id;
  IF v_recipient.id IS NOT NULL THEN
    INSERT INTO public.transactions (
      sender_id, recipient_id, type, amount, currency, recipient_name, recipient_phone,
      provider, status, method, note, reference, fee, completed_at
    ) VALUES (
      v_recipient.id, p_sender_id, 'receive', p_amount, v_sender.currency,
      v_sender.full_name, v_sender.phone, v_recipient.provider, 'completed',
      p_method, p_note, v_reference || '-R', 0.00, now()
    );
  END IF;
  RETURN json_build_object(
    'success', true, 'transaction_id', v_txn_id, 'reference', v_reference,
    'amount', p_amount, 'fee', v_fee, 'new_balance', v_sender.balance - (p_amount + v_fee)
  );
END;
$$;

-- Helper functions
CREATE OR REPLACE FUNCTION public.get_balance(p_user_id UUID)
RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT balance FROM public.profiles WHERE id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.lookup_recipient(p_phone TEXT)
RETURNS JSON LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE v_profile RECORD;
BEGIN
  SELECT id, full_name, phone, provider, avatar_url INTO v_profile
    FROM public.profiles WHERE phone = p_phone AND is_active = true LIMIT 1;
  IF NOT FOUND THEN RETURN json_build_object('found', false); END IF;
  RETURN json_build_object(
    'found', true, 'id', v_profile.id, 'full_name', v_profile.full_name,
    'phone', v_profile.phone, 'provider', v_profile.provider, 'avatar_url', v_profile.avatar_url
  );
END;
$$;

-- Enable realtime (ignore errors if already added)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Auto-confirm synthetic emails (@monde.app)
-- Required for phone+PIN auth to work without email verification
-- ============================================
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email LIKE '%@monde.app' THEN
    NEW.email_confirmed_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_confirm ON auth.users;

CREATE TRIGGER on_auth_user_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_confirm_user();
