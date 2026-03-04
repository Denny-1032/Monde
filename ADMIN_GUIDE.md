# Monde Admin Functions Guide

> Last updated: 2026-03-04

## Overview

Monde uses a **system admin account** to collect transaction fees. All fee-related admin functions are **service_role only** — they cannot be called from the client app. You interact with them via:

1. **Supabase Dashboard** → SQL Editor
2. **Supabase Edge Functions** (for building an admin API)
3. **Server-side code** using the `service_role` key

---

## Architecture

### Admin Account

### Admin User (You)

Any user can be promoted to admin by setting `is_admin = TRUE` in their profile. The admin user:
- Sees the **"Administration"** section in their Profile tab
- Can access the **Admin Dashboard** to view fees, float, and revenue
- Uses their normal phone number and PIN to log in

To promote a user to admin, run in **Supabase SQL Editor**:
```sql
UPDATE profiles SET is_admin = TRUE WHERE phone = '+260XXXXXXXXX';
```

### Fee Collection Account (System)

| Field | Value |
|---|---|
| **UUID** | `00000000-0000-0000-0000-000000000000` |
| **Phone** | `+260000000000` |
| **Handle** | `@monde` |

This is a **ledger account only** — it cannot be logged into. All transaction fees are credited to this account's balance. The admin dashboard reads from this account to display revenue.

### Fee Ledger (`monde_fees` table)

Every fee charged is recorded in the `monde_fees` table:

| Column | Type | Description |
|---|---|---|
| `id` | UUID | Primary key |
| `transaction_id` | UUID | Links to the `transactions` table |
| `fee_type` | TEXT | `topup_fee`, `withdraw_fee`, or `payment_fee` |
| `gross_amount` | NUMERIC(12,2) | The original transaction amount |
| `fee_amount` | NUMERIC(12,2) | The fee charged |
| `currency` | TEXT | Always `ZMW` |
| `user_id` | UUID | The user who paid the fee |
| `created_at` | TIMESTAMPTZ | When the fee was recorded |

**RLS is enabled** with no user-facing policies — only `SECURITY DEFINER` functions and `service_role` can read this table.

### Fee Schedule

| Transaction | Fee Formula | Example (K1,000) |
|---|---|---|
| **Top-up** | 1% + K1.00 flat | K11.00 |
| **Withdrawal** | 1.5% + K2.00 flat | K17.00 |
| **P2P ≤ K500** | Free | K0.00 |
| **P2P > K500** | 0.5% | K5.00 |

---

## Admin RPC Functions

All functions below are **service_role only**. They are `REVOKE`d from `authenticated` and `anon` roles.

### 1. `get_monde_fee_summary()`

Returns **lifetime** fee totals and admin account balance.

**SQL Editor:**
```sql
SELECT public.get_monde_fee_summary();
```

**Response:**
```json
{
  "total_fees_collected": 1250.50,
  "topup_fees": 450.00,
  "withdraw_fees": 520.50,
  "payment_fees": 280.00,
  "admin_balance": 1250.50,
  "total_fee_transactions": 342
}
```

---

### 2. `get_monde_fees_by_period(p_start, p_end)`

Returns fee totals **within a date range**. Defaults to the last 30 days.

**Last 7 days:**
```sql
SELECT public.get_monde_fees_by_period(
  now() - INTERVAL '7 days',
  now()
);
```

**Specific month:**
```sql
SELECT public.get_monde_fees_by_period(
  '2026-02-01'::timestamptz,
  '2026-03-01'::timestamptz
);
```

**Today only:**
```sql
SELECT public.get_monde_fees_by_period(
  date_trunc('day', now()),
  now()
);
```

**Response:**
```json
{
  "period_start": "2026-02-25T00:00:00+00:00",
  "period_end": "2026-03-04T14:30:00+00:00",
  "total_fees": 185.25,
  "topup_fees": 72.00,
  "withdraw_fees": 88.25,
  "payment_fees": 25.00,
  "fee_transactions": 47
}
```

---

### 3. `get_monde_total_float()`

Returns the **total money held** across all user wallets. Critical for regulatory compliance — the trust account at the bank must match this number.

```sql
SELECT public.get_monde_total_float();
```

**Response:**
```json
{
  "total_float": 892450.00,
  "admin_balance": 1250.50,
  "system_total": 893700.50,
  "users_with_balance": 1847,
  "total_users": 2103
}
```

| Field | Meaning |
|---|---|
| `total_float` | Sum of all user balances (excl. admin) — **this must match the trust account** |
| `admin_balance` | Monde's accumulated fee revenue |
| `system_total` | `total_float + admin_balance` — total money in the system |
| `users_with_balance` | Users with balance > 0 |
| `total_users` | All registered users |

---

### 4. `get_monde_fee_details(p_limit, p_offset, p_fee_type, p_start, p_end)`

Returns **individual fee records** with user details. Supports pagination and filtering.

**Latest 20 fees:**
```sql
SELECT public.get_monde_fee_details(20, 0);
```

**Only withdrawal fees, page 2:**
```sql
SELECT public.get_monde_fee_details(50, 50, 'withdraw_fee');
```

**Top-up fees this month:**
```sql
SELECT public.get_monde_fee_details(
  100, 0, 'topup_fee',
  '2026-03-01'::timestamptz,
  now()
);
```

**All fee types, last 7 days:**
```sql
SELECT public.get_monde_fee_details(
  100, 0, NULL,
  now() - INTERVAL '7 days',
  now()
);
```

**Response:**
```json
{
  "data": [
    {
      "id": "abc-123...",
      "transaction_id": "def-456...",
      "fee_type": "topup_fee",
      "gross_amount": 1000.00,
      "fee_amount": 11.00,
      "currency": "ZMW",
      "user_id": "user-uuid...",
      "user_name": "John Banda",
      "user_phone": "+260971234567",
      "created_at": "2026-03-04T12:30:00+00:00"
    }
  ],
  "total": 342,
  "limit": 100,
  "offset": 0
}
```

---

## Quick Queries (SQL Editor)

These can be run directly in the **Supabase Dashboard → SQL Editor**.

### Check admin account balance
```sql
SELECT balance, full_name FROM profiles
WHERE id = '00000000-0000-0000-0000-000000000000';
```

### Daily fee breakdown (last 7 days)
```sql
SELECT
  date_trunc('day', created_at) AS day,
  fee_type,
  COUNT(*) AS txn_count,
  SUM(fee_amount) AS total_fees,
  SUM(gross_amount) AS total_volume
FROM monde_fees
WHERE created_at >= now() - INTERVAL '7 days'
GROUP BY day, fee_type
ORDER BY day DESC, fee_type;
```

### Top fee-paying users (all time)
```sql
SELECT
  mf.user_id,
  p.full_name,
  p.phone,
  COUNT(*) AS fee_count,
  SUM(mf.fee_amount) AS total_fees_paid,
  SUM(mf.gross_amount) AS total_volume
FROM monde_fees mf
JOIN profiles p ON p.id = mf.user_id
GROUP BY mf.user_id, p.full_name, p.phone
ORDER BY total_fees_paid DESC
LIMIT 20;
```

### Transaction volume by type (this month)
```sql
SELECT
  type,
  COUNT(*) AS count,
  SUM(amount) AS volume,
  SUM(COALESCE(fee, 0)) AS fees
FROM transactions
WHERE created_at >= date_trunc('month', now())
  AND status = 'completed'
GROUP BY type
ORDER BY volume DESC;
```

### Verify system integrity (fees match admin balance)
```sql
SELECT
  (SELECT COALESCE(SUM(fee_amount), 0) FROM monde_fees) AS ledger_total,
  (SELECT balance FROM profiles WHERE id = '00000000-0000-0000-0000-000000000000') AS admin_balance,
  (SELECT COALESCE(SUM(fee_amount), 0) FROM monde_fees) -
  (SELECT balance FROM profiles WHERE id = '00000000-0000-0000-0000-000000000000') AS discrepancy;
```

> ⚠️ `discrepancy` should always be **0.00**. If not, there's a bug in fee collection.

---

## Security Notes

1. **Admin RPCs have admin-only auth checks** — each function verifies `auth.uid() = admin UUID` before returning data; regular users get "Unauthorized: admin access only"
2. **monde_fees has RLS enabled** with no user policies — users cannot read fee data
3. **Admin account cannot receive payments** — `process_payment` blocks transfers to `+260000000000`
4. **Admin can log in** — full `auth.users` + `auth.identities` + `profiles` entries exist
5. **All RPCs are SECURITY DEFINER** — they run with elevated DB permissions regardless of caller role
6. **All fee operations are atomic** — fee deduction, admin credit, and ledger insert happen in the same DB transaction
7. **Default admin PIN is `0000`** — change it immediately after first login via the app's Change PIN flow

## Calling from Edge Functions

If you build an admin dashboard, use the **service_role** key to call these RPCs:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // NOT the anon key
);

// Get fee summary
const { data } = await supabaseAdmin.rpc('get_monde_fee_summary');

// Get fees for last 7 days
const { data: weekly } = await supabaseAdmin.rpc('get_monde_fees_by_period', {
  p_start: new Date(Date.now() - 7 * 86400000).toISOString(),
  p_end: new Date().toISOString(),
});

// Get total float
const { data: float } = await supabaseAdmin.rpc('get_monde_total_float');

// Get fee details (paginated)
const { data: details } = await supabaseAdmin.rpc('get_monde_fee_details', {
  p_limit: 50,
  p_offset: 0,
  p_fee_type: null,      // or 'topup_fee', 'withdraw_fee', 'payment_fee'
  p_start: null,          // or ISO date string
  p_end: null,
});
```

---

## In-App Admin Dashboard

The Monde app includes a built-in admin dashboard accessible only when logged in as the Monde admin account.

### How to Access

1. Log in with the admin phone number: **+260000000000**
2. Go to the **Profile** tab
3. An **"Administration"** section appears with an **"Admin Dashboard"** menu item
4. Tap it to open the dashboard

> Regular users will never see this menu item. If a non-admin somehow navigates to `/admin`, they see an "Access Denied" screen.

### Dashboard Tabs

| Tab | What it shows |
|---|---|
| **Overview** | Total revenue, fee breakdown (top-up/withdraw/payment), system user stats, ledger integrity check |
| **Fee Ledger** | Paginated list of individual fee records with user details, filterable by fee type |
| **Float** | Total user float (must match trust account), admin balance, system total |

### Dashboard Features

- **Pull-to-refresh** on all tabs
- **Ledger integrity check** — verifies that `monde_fees` ledger total matches admin balance
- **Fee type filters** — filter ledger by top-up, withdrawal, or payment fees
- **Pagination** — "Load More" button for large fee ledgers
- **Dark mode support** — fully themed with dynamic colors

---

## Applying the Migrations

Both migrations must be run **in order**. Migration 020 must succeed before 021.

### Step 1: Apply `020_monde_admin_fees.sql`
This creates the admin auth user, profile, fee ledger table, and updates all 3 RPCs.

### Step 2: Apply `021_admin_security_and_helpers.sql`
This adds admin auth checks to all admin RPCs, adds new helper functions, and blocks payments to admin.

### Option A: Supabase CLI
```bash
supabase db push
```

### Option B: SQL Editor
1. Open **Supabase Dashboard** → **SQL Editor**
2. Copy and run `020_monde_admin_fees.sql` first
3. Then copy and run `021_admin_security_and_helpers.sql`

### Option C: Supabase MCP (from this IDE)
The migrations can be applied via the Supabase MCP tool if your project is connected.

---

## Migrations Reference

| Migration | What it does |
|---|---|
| `020_monde_admin_fees.sql` | Creates admin auth user + profile, `monde_fees` table, updates 3 RPCs with fee collection, adds `get_monde_fee_summary` |
| `021_admin_security_and_helpers.sql` | Adds admin-only auth checks to all admin RPCs, adds `get_monde_fees_by_period`, `get_monde_total_float`, `get_monde_fee_details`, blocks payments to admin phone |
