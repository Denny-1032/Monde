-- ============================================
-- Migration 044: Security Audit Fixes
-- ============================================
-- M8: Fix non-functional RLS policy on lipila_callbacks
-- The policy using auth.uid() = UUID-0 is unreachable since that UUID
-- cannot authenticate. Drop it. The admin read policy already works.
-- Service role key (used by Edge Function) bypasses RLS anyway.

DROP POLICY IF EXISTS "Service role full access on lipila_callbacks" ON public.lipila_callbacks;
