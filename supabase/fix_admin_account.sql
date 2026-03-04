-- ============================================
-- ONE-SHOT FIX: Admin Account Setup
-- ============================================
-- Run this in Supabase SQL Editor to fix/create the admin account.
-- Safe to run multiple times (uses ON CONFLICT / upsert).
--
-- Admin login:
--   Phone: +260000000000  (enter as 000000000 in the app)
--   PIN:   0000
--
-- After running this, apply 020_monde_admin_fees.sql and
-- 021_admin_security_and_helpers.sql if not already applied.
-- ============================================

-- 1. Clean up any partial state from failed migration
DELETE FROM auth.identities WHERE user_id = '00000000-0000-0000-0000-000000000000';
DELETE FROM public.profiles WHERE id = '00000000-0000-0000-0000-000000000000';
DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000000';

-- 2. Create auth user with correct password
-- PIN 0000 → pinToPassword('0000') → 'Mn!0000#Zk'
INSERT INTO auth.users (
  id, instance_id, aud, role, phone,
  encrypted_password, email_confirmed_at, phone_confirmed_at,
  created_at, updated_at, raw_app_meta_data, raw_user_meta_data
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  'authenticated',
  'authenticated',
  '+260000000000',
  crypt('Mn!0000#Zk', gen_salt('bf')),
  now(), now(), now(), now(),
  '{"provider": "phone", "providers": ["phone"], "is_admin": true}'::jsonb,
  '{"full_name": "Monde", "is_system_account": true}'::jsonb
);

-- 3. Create identity record (required by Supabase phone auth)
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000000',
  '{"sub": "00000000-0000-0000-0000-000000000000", "phone": "+260000000000"}'::jsonb,
  'phone',
  '+260000000000',
  now(), now(), now()
);

-- 4. Create profile
INSERT INTO public.profiles (id, phone, full_name, handle, provider, balance, currency)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  '+260000000000',
  'Monde',
  'monde',
  'monde',
  0.00,
  'ZMW'
) ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  handle = EXCLUDED.handle;

-- 5. Verify it worked
SELECT
  u.id,
  u.phone,
  u.phone_confirmed_at IS NOT NULL AS phone_confirmed,
  p.full_name,
  p.handle,
  p.balance,
  i.provider AS identity_provider
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN auth.identities i ON i.user_id = u.id
WHERE u.id = '00000000-0000-0000-0000-000000000000';
