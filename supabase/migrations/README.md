# Monde Database Migrations

## How to Apply

### Option A: Supabase Dashboard (SQL Editor)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Run each migration file **in order** (001 → 005)

### Option B: Supabase CLI
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

## Migration Order

| File | Description |
|------|-------------|
| `001_create_profiles.sql` | User profiles table, auto-creation trigger, RLS policies |
| `002_create_transactions.sql` | Transactions table with enums, indexes, RLS |
| `003_create_providers.sql` | Payment providers reference table with seed data |
| `004_process_payment_function.sql` | Atomic payment processing function |
| `005_realtime_and_views.sql` | Realtime subscriptions, views, helper functions |

## Schema Overview

```
profiles
├── id (UUID, FK → auth.users)
├── phone (TEXT, UNIQUE)
├── full_name (TEXT)
├── provider (TEXT)
├── balance (NUMERIC)
├── currency (TEXT, default 'ZMW')
├── pin_hash (TEXT)
├── avatar_url (TEXT)
├── is_active (BOOLEAN)
├── created_at (TIMESTAMPTZ)
└── updated_at (TIMESTAMPTZ)

transactions
├── id (UUID, PK)
├── sender_id (UUID, FK → profiles)
├── recipient_id (UUID, FK → profiles, nullable)
├── type (ENUM: send, receive, payment)
├── amount (NUMERIC)
├── currency (TEXT)
├── recipient_name (TEXT)
├── recipient_phone (TEXT)
├── provider (TEXT)
├── status (ENUM: pending, completed, failed)
├── method (ENUM: qr, nfc, manual)
├── note (TEXT)
├── reference (TEXT, UNIQUE)
├── fee (NUMERIC)
├── created_at (TIMESTAMPTZ)
└── completed_at (TIMESTAMPTZ)

providers
├── id (TEXT, PK)
├── name (TEXT)
├── color (TEXT)
├── prefix (TEXT)
├── logo_url (TEXT)
├── is_active (BOOLEAN)
├── min_amount (NUMERIC)
├── max_amount (NUMERIC)
├── fee_percent (NUMERIC)
├── fee_flat (NUMERIC)
└── created_at (TIMESTAMPTZ)
```

## RPC Functions

- `process_payment(sender_id, recipient_phone, amount, method, note)` — Atomic payment
- `get_balance(user_id)` — Get user balance
- `lookup_recipient(phone)` — Find user by phone number
