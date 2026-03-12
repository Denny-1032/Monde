-- ============================================
-- Migration 025: Add lipila_reference_id to transactions
-- ============================================
-- Stores the Lipila-generated referenceId so the callback handler
-- can match async status updates back to the correct transaction.

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS lipila_reference_id TEXT;

-- Index for fast lookup by Lipila referenceId (used by callback handler)
CREATE INDEX IF NOT EXISTS idx_transactions_lipila_ref
  ON public.transactions(lipila_reference_id)
  WHERE lipila_reference_id IS NOT NULL;
