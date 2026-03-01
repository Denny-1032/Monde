-- ============================================
-- 003: Payment Providers Reference Table
-- ============================================

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

-- Seed the Zambian payment providers
INSERT INTO public.providers (id, name, color, prefix, is_active) VALUES
  ('airtel', 'Airtel Money', '#ED1C24', '097', true),
  ('mtn', 'MTN MoMo', '#FFCB05', '096', true),
  ('zamtel', 'Zamtel Kwacha', '#00A650', '095', true),
  ('fnb', 'FNB Zambia', '#009FDA', '', true),
  ('zanaco', 'Zanaco', '#003B71', '', true),
  ('absa', 'Absa Bank', '#AF1832', '', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- RLS Policies for providers
-- ============================================
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

-- Everyone can read providers (public reference data)
CREATE POLICY "Anyone can view providers"
  ON public.providers FOR SELECT
  USING (true);
