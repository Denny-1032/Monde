---
description: Thorough audit of all Monde features after making changes - run this to verify nothing is broken
---

# Monde Change Audit Workflow

Run this workflow after making any code changes to verify everything works together.

## 1. TypeScript Compilation Check
// turbo
```bash
npx tsc --noEmit
```
- Must exit with code 0 and no errors
- If errors exist, fix them before proceeding

## 2. File Structure Integrity
Verify these critical files exist and are not empty:
- `lib/api.ts` — API functions (auth, transactions, Lipila, linked accounts)
- `lib/supabase.ts` — Supabase client setup
- `lib/helpers.ts` — Fee calculations, formatters
- `lib/validation.ts` — Input validation, PIN conversion
- `store/useStore.ts` — Zustand global store
- `supabase/functions/lipila-payments/index.ts` — Lipila Edge Function
- `supabase/functions/lipila-callback/index.ts` — Lipila callback handler

## 3. Fee Calculation Consistency
Verify client-side fees in `lib/helpers.ts` match server-side fees in SQL RPCs:

| Transaction | Client Formula | Server RPC | Migration File |
|---|---|---|---|
| Top-up | `(amount * 0.01) + 1.00` | `ROUND((p_amount * 0.01) + 1.00, 2)` | `023_fix_topup_fee_logic.sql` |
| Withdraw | `(amount * 0.015) + 2.00` | `ROUND((p_amount * 0.015) + 2.00, 2)` | `020_monde_admin_fees.sql` |
| P2P ≤ K500 | `0` | `0` | `020_monde_admin_fees.sql` |
| P2P > K500 | `amount * 0.005` | `ROUND(p_amount * 0.005, 2)` | `020_monde_admin_fees.sql` |

- Read `lib/helpers.ts` lines 85-100 (calcTopUpFee, calcWithdrawFee, calcPaymentFee)
- Read `supabase/migrations/023_fix_topup_fee_logic.sql` line 58 (topup fee)
- Read `supabase/migrations/020_monde_admin_fees.sql` line 269 (withdraw fee) and line 385-387 (payment fee)
- Confirm all formulas match exactly

## 4. Transaction Query Audit
Verify `getTransactions` in `lib/api.ts` queries by `sender_id` ONLY (not OR recipient_id):
- The `process_payment` RPC creates two rows per P2P payment with `sender_id` set to the owner of each row
- Querying by both `sender_id` and `recipient_id` causes duplicate display
- The realtime subscription `subscribeToTransactions` must also filter by `sender_id` only

Check:
- `lib/api.ts` → `getTransactions()` uses `.eq('sender_id', userId)` NOT `.or(...)`
- `lib/api.ts` → `subscribeToTransactions()` only has ONE `postgres_changes` listener on `sender_id`

## 5. Lipila Integration Check
Verify the Lipila Edge Function pipeline:

### 5a. Client-side (`lib/api.ts`)
- `LIPILA_ENABLED` reads from `process.env.EXPO_PUBLIC_LIPILA_ENABLED`
- `callLipila()` skips when: test provider, Supabase not configured, OR `!LIPILA_ENABLED`
- `callLipila()` passes: `action`, `amount`, `accountNumber`, `currency`, `narration`
- `processTopUp` and `processWithdraw` store `lipilaResult.referenceId` in `lipila_reference_id` column after RPC

### 5b. Edge Function (`supabase/functions/lipila-payments/index.ts`)
- Auth: verifies Supabase session via `Authorization` header
- Config: reads `LIPILA_MODE`, `LIPILA_SANDBOX_API_KEY` / `LIPILA_LIVE_API_KEY`, `LIPILA_CALLBACK_URL`
- Endpoints: `POST /api/v1/collections/mobile-money` (collect), `POST /api/v1/disbursements/mobile-money` (disburse)
- Headers to Lipila: `x-api-key`, `callbackUrl`, `Content-Type`, `accept`
- Body to Lipila: `referenceId`, `amount`, `accountNumber`, `currency`, `narration`
- **All application errors return HTTP 200** with `success: false` (NOT non-2xx)
- Diagnostic `console.log` at every step for debugging

### 5c. Callback Handler (`supabase/functions/lipila-callback/index.ts`)
- Searches transactions by `lipila_reference_id` first, then `reference` as fallback
- Updates transaction status to `completed` or `failed`
- Stores unmatched callbacks in `lipila_callbacks` table

## 6. Store ↔ API Integration
Verify store actions in `store/useStore.ts` correctly call API functions:

- `sendPayment` → `api.processPayment()` → RPC `process_payment`
- `topUp` → `api.processTopUp()` → `callLipila()` + RPC `process_topup`
- `withdraw` → `api.processWithdraw()` → `callLipila()` + RPC `process_withdraw`
- All three refresh profile + transactions after success: `Promise.all([fetchProfile(), fetchTransactions()])`
- Offline mock paths create correct transaction objects with proper types and fees

## 7. RLS Policy Check
Verify Row Level Security policies allow the correct access patterns:
- `transactions` table: users can SELECT where `sender_id = auth.uid() OR recipient_id = auth.uid()`
- `transactions` table: users can INSERT only where `sender_id = auth.uid()`
- `profiles` table: users can SELECT/UPDATE their own profile
- `monde_fees` table: NO user-facing SELECT policy (admin-only)
- `lipila_callbacks` table: service_role only

## 8. Balance Update Verification
For each transaction type, verify balance math:

- **Top-up K100**: `user.balance += 100`, `admin.balance += fee(1.01)`
- **Withdraw K100**: `user.balance -= (100 + 3.50)`, `admin.balance += 3.50`
- **P2P Send K200 (≤K500)**: `sender.balance -= 200`, `recipient.balance += 200`, fee = 0
- **P2P Send K1000 (>K500)**: `sender.balance -= 1005`, `recipient.balance += 1000`, `admin.balance += 5`

## 9. Environment Variables Check
Verify `.env.example` documents all required variables:
- `EXPO_PUBLIC_SUPABASE_URL` — Supabase project URL
- `EXPO_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `EXPO_PUBLIC_LIPILA_ENABLED` — Enable/disable Lipila integration
- Supabase secrets (set via dashboard): `LIPILA_MODE`, `LIPILA_SANDBOX_API_KEY`, `LIPILA_LIVE_API_KEY`, `LIPILA_CALLBACK_URL`

## 10. UI Screen Validation
Spot-check that key screens reference correct functions and display correct data:
- `app/top-up.tsx` — uses `calcTopUpFee`, shows "Fee (1% + K1)", calls `store.topUp()`
- `app/withdraw.tsx` — uses `calcWithdrawFee`, shows "Fee (1.5% + K2)", calls `store.withdraw()`
- `app/payment.tsx` — uses `calcPaymentFee`, calls `store.sendPayment()`
- `components/TransactionItem.tsx` — displays correct +/- prefix based on `type`
- `app/(tabs)/history.tsx` — calls `getTransactions` and `loadMoreTransactions`

## 11. Migration Ordering Check
Verify migrations are numbered sequentially and don't conflict:
// turbo
```bash
dir supabase\migrations\*.sql /b | sort
```
- Check no duplicate numbers
- Check that later migrations don't recreate functions already overridden by earlier ones
- Latest function versions: `process_topup` → 023, `process_withdraw` → 020, `process_payment` → 020

## Summary Checklist
After completing all steps, confirm:
- [ ] TypeScript compiles clean
- [ ] Fee formulas match client ↔ server
- [ ] No duplicate transaction queries
- [ ] Lipila pipeline correct (or gracefully skipped)
- [ ] Store actions call correct API functions
- [ ] Balance math verified for all transaction types
- [ ] Environment variables documented
- [ ] Migrations ordered correctly
