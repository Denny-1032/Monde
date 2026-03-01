-- ============================================
-- 002: Transactions Table
-- ============================================

CREATE TYPE public.transaction_type AS ENUM ('send', 'receive', 'payment');
CREATE TYPE public.transaction_status AS ENUM ('pending', 'completed', 'failed');
CREATE TYPE public.payment_method AS ENUM ('qr', 'nfc', 'manual');

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

-- Index for user transaction history queries
CREATE INDEX IF NOT EXISTS idx_transactions_sender ON public.transactions(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_recipient ON public.transactions(recipient_id, created_at DESC);

-- Index for status-based queries
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);

-- Composite index for filtered history
CREATE INDEX IF NOT EXISTS idx_transactions_sender_type ON public.transactions(sender_id, type, created_at DESC);

-- ============================================
-- RLS Policies for transactions
-- ============================================
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users can view transactions where they are sender or recipient
CREATE POLICY "Users can view own transactions"
  ON public.transactions FOR SELECT
  USING (
    auth.uid() = sender_id OR auth.uid() = recipient_id
  );

-- Users can create transactions where they are the sender
CREATE POLICY "Users can create transactions as sender"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Only system (via functions) can update transaction status
CREATE POLICY "Users can update own pending transactions"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = sender_id AND status = 'pending');
