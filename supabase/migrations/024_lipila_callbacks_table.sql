-- ============================================
-- Migration 024: Lipila Callbacks Table
-- ============================================
-- Stores async callback payloads from Lipila payment gateway
-- for reconciliation when a transaction cannot be matched by referenceId.

CREATE TABLE IF NOT EXISTS public.lipila_callbacks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reference_id TEXT NOT NULL,
  status TEXT NOT NULL,
  amount NUMERIC(12,2),
  account_number TEXT,
  payment_type TEXT,
  transaction_type TEXT,
  identifier TEXT,
  message TEXT,
  external_id TEXT,
  raw_payload JSONB,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for lookup by reference_id
CREATE INDEX IF NOT EXISTS idx_lipila_callbacks_reference_id ON public.lipila_callbacks(reference_id);
CREATE INDEX IF NOT EXISTS idx_lipila_callbacks_processed ON public.lipila_callbacks(processed) WHERE processed = false;

-- RLS: only service role / admin can read/write
ALTER TABLE public.lipila_callbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on lipila_callbacks"
  ON public.lipila_callbacks
  FOR ALL
  USING (auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid)
  WITH CHECK (auth.uid() = '00000000-0000-0000-0000-000000000000'::uuid);

-- Admin read access
CREATE POLICY "Admin read lipila_callbacks"
  ON public.lipila_callbacks
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
