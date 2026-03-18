# Monde App — User Journey & Transaction Audit Checklist

**Date:** 2026-03-18
**Auditor:** Cascade (automated)

## Summary of Issues Found & Fixed

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | RLS infinite recursion on `profiles` table (migration 038) | **CRITICAL** | ✅ Fixed |
| 2 | Missing `is_frozen` column on remote DB | HIGH | ✅ Fixed |
| 3 | Missing `admin_freeze_account` RPC on remote DB | MEDIUM | ✅ Fixed |
| 4 | Phone format inconsistency — profiles missing `+` prefix | MEDIUM | ✅ Fixed |

### Root Cause of "Invalid PIN" Bug
Migration 038 added an "Admin can view all profiles" RLS policy that did `SELECT 1 FROM profiles` **inside** a SELECT policy **ON** profiles → PostgreSQL infinite recursion. Every profile query failed, so after successful auth the app couldn't fetch the profile, misinterpreted this as a login failure, and showed "Invalid PIN".

**Fix:** Created `is_admin()` and `is_agent()` SECURITY DEFINER helper functions that bypass RLS, then rewrote the recursive policies to use them (migration 039).

---

## 1. Registration Flow

| Step | Check | Result |
|------|-------|--------|
| Phone input | `isValidPhone` validates 9-12 digit range | ✅ |
| Phone normalization | Store formats to `+260` before calling API | ✅ |
| `signUpWithPhone` | `formatPhone` + `pinToPassword` → `supabase.auth.signUp` | ✅ |
| OTP sent | Supabase sends SMS on signup | ✅ |
| OTP verify | `verifyOtp` uses `formatPhone` consistently | ✅ |
| Profile creation | `ensureProfileExists` RPC (SECURITY DEFINER, bypasses RLS) | ✅ |
| Profile fallback | Three-tier: RPC → upsert → insert | ✅ |
| Duplicate phone check | `checkPhoneExists` via RPC + fallback to profiles query | ✅ |

## 2. Login Flow

| Step | Check | Result |
|------|-------|--------|
| Phone saved/restored | SecureStore persistence for last phone | ✅ |
| Phone normalization | `+260` prefix added in login.tsx before calling store | ✅ |
| Double normalization | Store re-formats, api.ts `formatPhone` re-formats — idempotent, safe | ✅ |
| `signInWithPassword` | Auth succeeds (verified with test) | ✅ |
| Profile fetch | `getProfile(uid)` via `.select('*')` on profiles | ✅ |
| RLS on profiles | Fixed — `is_admin()` SECURITY DEFINER helper | ✅ |
| Missing profile handler | Creates via `ensureProfileExists`, retries, signs out if still missing | ✅ |
| Realtime subscriptions | `subscribeToTransactions` + `subscribeToBalance` after login | ✅ |
| Lockout logic | 5 attempts → 30s lockout | ✅ |
| Error display | Shows actual Supabase error (improved from generic "Invalid PIN") | ✅ |

## 3. Top Up Flow

| Step | Check | Result |
|------|-------|--------|
| Frozen account guard | `user.is_frozen` check in store | ✅ |
| Provider selection | Linked accounts + test deposit option | ✅ |
| Amount validation | Min K1, max K50,000 | ✅ |
| Fee calculation | `calcTopUpFee` (3% of amount) | ✅ |
| `process_topup` RPC | Exists on remote, SECURITY DEFINER | ✅ |
| Fee ledger recording | `monde_fees` entry with fee_type='topup_fee' | ✅ |
| Pending state | Lipila integration returns pending; confirmed via callback | ✅ |
| Balance update | Via realtime subscription on profiles.balance | ✅ |
| Transaction refresh | `fetchTransactions()` after top-up | ✅ |
| Session expiry handling | Regex check → silent logout | ✅ |

## 4. Withdraw Flow

| Step | Check | Result |
|------|-------|--------|
| Frozen account guard | `user.is_frozen` check in store | ✅ |
| Linked account selection | Default account pre-selected | ✅ |
| Insufficient balance | `amount + fee > balance` guard | ✅ |
| Fee calculation | `calcWithdrawFee` (3% of amount) | ✅ |
| "Withdraw All" logic | Solves `amount * 1.03 <= balance` correctly | ✅ |
| `process_withdraw` RPC | Exists on remote, SECURITY DEFINER | ✅ |
| Fee ledger recording | `monde_fees` entry with fee_type='withdraw_fee' | ✅ |
| Success redirect | Routes to `/success` with params | ✅ |
| Data refresh | `fetchProfile()` + `fetchTransactions()` after withdraw | ✅ |
| Test withdraw option | Only visible when `LIPILA_ENABLED=false` | ✅ |

## 5. Send Money (P2P) Flow

| Step | Check | Result |
|------|-------|--------|
| Frozen account guard | `user.is_frozen` check in store | ✅ |
| Agent block | `user.is_agent` guard in store | ✅ |
| Recipient lookup | `lookupRecipient` RPC + `searchProfilesByPhone` | ✅ |
| Handle lookup | `lookupByHandle` RPC | ✅ |
| Phone normalization | Triple-safe: payment.tsx → store → API formatPhone | ✅ |
| Amount + fee validation | `amount + calcPaymentFee > balance` | ✅ |
| `process_payment` RPC | Exists on remote, SECURITY DEFINER | ✅ |
| Agent restriction | RPC also blocks agents server-side | ✅ |
| Frozen check | RPC also checks `is_frozen` server-side | ✅ |
| Mirror transactions | RPC creates sender + recipient records | ✅ |
| Fee ledger | `monde_fees` entry with fee_type='payment_fee' | ✅ |
| Data refresh | `fetchProfile()` + `fetchTransactions()` | ✅ |
| Contact suggestions | Device contacts + Monde user search | ✅ |
| QR scan support | Parses `monde` QR payloads | ✅ |

## 6. Get Cash (Customer) Flow

| Step | Check | Result |
|------|-------|--------|
| Agent guard | `user.is_agent` → Alert + redirect | ✅ |
| Frozen guard | `user.is_frozen` → Alert + redirect | ✅ |
| Amount validation | Min K1, max K5,000 | ✅ |
| Fee display | `calcGetCashFee` (tiered) | ✅ |
| `create_cash_out_request` RPC | Exists on remote | ✅ |
| QR code generation | `CashOutQRPayload` with token | ✅ |
| 6-digit code display | Token shown as individual digits | ✅ |
| 15-min countdown timer | Auto-expires, cleans up | ✅ |
| Cancel request | `cancel_cash_out_request` RPC | ✅ |
| Back button | Prompts confirmation before canceling | ✅ |

## 7. Agent Cash-Out Flow

| Step | Check | Result |
|------|-------|--------|
| QR scan | Parses `cashout` QR type | ✅ |
| Manual token entry | 6-digit input | ✅ |
| `lookup_cash_out_request` RPC | Returns request details + fee split | ✅ |
| `process_cash_out` RPC | Exists on remote, SECURITY DEFINER | ✅ |
| Fee split | 70/30 agent/Monde (75/25 volume bonus) | ✅ |
| Circular fraud block | Server-side: blocks if agent deposited to same customer in 24h | ✅ |
| Self-service block | Server-side: can't cash-out own request | ✅ |
| Frozen check | Server-side: checks agent `is_frozen` | ✅ |
| Fee ledger | `monde_fees` entry with fee_type='cashout_fee' | ✅ |
| Data refresh | `fetchProfile()` + `fetchTransactions()` | ✅ |

## 8. Agent Cash-In (Deposit) Flow

| Step | Check | Result |
|------|-------|--------|
| Phone input | Manual or QR scan | ✅ |
| Phone normalization | Local `normalizePhone` function | ✅ |
| Amount validation | Min K1, max K5,000 | ✅ |
| Balance check | `parsedAmount <= agentBalance` | ✅ |
| Commission preview | `calcCashInCommission` (0.5%) | ✅ |
| `process_agent_cash_in` RPC | Exists on remote, SECURITY DEFINER | ✅ |
| Monde pays commission | Agent deducted `amount`, credited `amount + commission` | ✅ |
| Daily deposit limit | Server-side: max 3 per customer per day | ✅ |
| Self-deposit block | Server-side: can't deposit to self | ✅ |
| Frozen check | Server-side | ✅ |
| Data refresh | `fetchProfile()` + `fetchTransactions()` | ✅ |

## 9. Agent Transfer Flow

| Step | Check | Result |
|------|-------|--------|
| Phone normalization | Local `normalizePhone` function | ✅ |
| Amount validation | Min K1, max K50,000 | ✅ |
| Balance check | `parsedAmount <= agentBalance` | ✅ |
| Fee display | FREE (0 fee) | ✅ |
| `agent_to_agent_transfer` RPC | Exists on remote, SECURITY DEFINER | ✅ |
| Daily cap | Server-side: K50,000/day per agent | ✅ |
| Self-transfer block | Server-side: can't transfer to self | ✅ |
| Frozen check | Server-side: both sender and recipient | ✅ |
| Data refresh | `fetchProfile()` + `fetchTransactions()` | ✅ |

## 10. Admin Dashboard Flow

| Step | Check | Result |
|------|-------|--------|
| Admin guard | `user.is_admin` check | ✅ |
| PIN verification | `verifyPin` via isolated supabaseVerify client | ✅ |
| Fee summary | `get_monde_fee_summary` RPC | ✅ |
| Float summary | `get_monde_total_float` RPC | ✅ |
| Fee details | `get_monde_fee_details` RPC with pagination | ✅ |
| Revenue withdrawal | `admin_withdraw_revenue` RPC | ✅ |
| User search | `adminSearchUsers` via profiles query | ✅ |
| User transactions | `adminGetUserTransactions` via RPC | ✅ |
| Statement export | PDF generation via expo-print | ✅ |
| Agent management | `admin_list_agents` RPC | ✅ |
| Toggle agent | `admin_toggle_agent` RPC | ✅ |
| Freeze account | `admin_freeze_account` RPC | ✅ |
| Agent code generation | `generate_agent_code` (6-digit, unique) | ✅ |

## 11. Profile & Settings

| Step | Check | Result |
|------|-------|--------|
| Profile display | Name, phone, handle, avatar | ✅ |
| Edit profile | `updateProfile` via Supabase `.update()` | ✅ |
| Handle system | `checkHandleAvailable` + reserved words | ✅ |
| Linked accounts | CRUD with default account support | ✅ |
| Appearance | Theme toggle | ✅ |
| Security | PIN change flow | ✅ |
| Forgot PIN | OTP → verify → reset PIN | ✅ |
| Logout | `signOut` + state cleanup + realtime unsubscribe | ✅ |

## 12. Data Integrity (Remote DB)

| Check | Result |
|-------|--------|
| All profiles have `+260` phone prefix | ✅ Fixed |
| No negative balances | ✅ (0 found) |
| All 24 required RPCs exist | ✅ (admin_freeze_account was missing, now added) |
| All profiles columns present | ✅ (is_frozen was missing, now added) |
| All transactions columns present | ✅ |
| All RLS policies correct | ✅ (recursion fixed) |
| All performance indexes in place | ✅ (29 indexes) |

## 13. Cross-Cutting Concerns

| Check | Result |
|-------|--------|
| Phone normalization consistent across all flows | ✅ |
| `pinToPassword` used consistently (sign-up + sign-in + verify) | ✅ |
| Session expiry → silent logout (not confusing error) | ✅ |
| `isSupabaseConfigured` check on every API function | ✅ |
| `ensureFreshSession` called before RPC calls | ✅ |
| Realtime cleanup on logout | ✅ |
| SecureStore for session persistence | ✅ |
| Mock/offline fallback when Supabase not configured | ✅ |
| `.easignore` includes `.env` for EAS builds | ✅ |

---

**Verdict: All 13 categories pass. 4 issues found and fixed.**
