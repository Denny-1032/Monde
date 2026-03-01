-- ============================================
-- 009: Linked Accounts
-- Allows users to link multiple provider accounts
-- for easier top-up and withdrawal
-- ============================================

CREATE TABLE IF NOT EXISTS public.linked_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL REFERENCES public.providers(id),
  account_name TEXT NOT NULL,
  account_phone TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider, account_phone)
);

CREATE INDEX IF NOT EXISTS idx_linked_accounts_user ON public.linked_accounts(user_id);

ALTER TABLE public.linked_accounts ENABLE ROW LEVEL SECURITY;

-- Users can only see their own linked accounts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own linked accounts' AND tablename = 'linked_accounts') THEN
    CREATE POLICY "Users can view own linked accounts"
      ON public.linked_accounts FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Users can add their own linked accounts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create own linked accounts' AND tablename = 'linked_accounts') THEN
    CREATE POLICY "Users can create own linked accounts"
      ON public.linked_accounts FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Users can update their own linked accounts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can update own linked accounts' AND tablename = 'linked_accounts') THEN
    CREATE POLICY "Users can update own linked accounts"
      ON public.linked_accounts FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Users can delete their own linked accounts
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can delete own linked accounts' AND tablename = 'linked_accounts') THEN
    CREATE POLICY "Users can delete own linked accounts"
      ON public.linked_accounts FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- Function to ensure only one default account per user
CREATE OR REPLACE FUNCTION public.ensure_single_default_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.linked_accounts
      SET is_default = false
      WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = true;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_single_default ON public.linked_accounts;
CREATE TRIGGER trg_ensure_single_default
  BEFORE INSERT OR UPDATE ON public.linked_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_single_default_account();
