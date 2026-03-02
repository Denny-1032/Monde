# Monde Security Audit

**Date:** 2026-03-02
**Auditor:** Cascade AI
**Scope:** Full application codebase + Supabase backend

---

## 1. Authentication & Authorization

| Area | Status | Notes |
|------|--------|-------|
| PIN stored as hashed password via Supabase Auth | ✅ Pass | `pinToPassword()` wraps 4-digit PIN into 10-char password |
| Session tokens stored in SecureStore (native) | ✅ Pass | `expo-secure-store` encrypts at OS level |
| Session tokens in localStorage (web) | ⚠️ Warning | Web uses localStorage — acceptable for dev, consider httpOnly cookies for prod web |
| Auto-lock after 2min background | ✅ Pass | `useAutoLock` in `_layout.tsx` |
| Biometric auth gate | ✅ Pass | Optional via `expo-local-authentication` |
| Auth state listener prevents stale sessions | ✅ Pass | `onAuthStateChange` in root layout |
| PIN verification uses isolated Supabase client | ✅ Pass | `supabaseVerify` prevents session rotation |

## 2. Database Security (Supabase)

| Area | Status | Notes |
|------|--------|-------|
| RLS enabled on `profiles` | ✅ Pass | Users can only read/update own profile |
| RLS enabled on `transactions` | ✅ Pass | Users see only their own transactions |
| RLS enabled on `linked_accounts` | ✅ Pass | Full CRUD restricted to owner |
| RLS enabled on `providers` | ✅ Pass | Read-only for all authenticated users |
| Storage (avatars) RLS | ✅ Pass | Users can only manage their own avatar |
| RPCs use `SECURITY DEFINER` with `auth.uid()` checks | ✅ Pass | `process_payment`, `process_topup`, `process_withdraw` all verify caller |
| RPC search_path hardened | ✅ Pass | All 6 SECURITY DEFINER functions use `SET search_path = public` (migration 011) |
| Views use security_invoker | ✅ Pass | `transaction_history` view uses `security_invoker = true` (migration 011) |
| Row locking (`FOR UPDATE`) on balance operations | ✅ Pass | Prevents race conditions on concurrent transactions |
| Prevent send-to-self | ✅ Pass | Checked in `process_payment` RPC |

## 3. Input Validation

| Area | Status | Notes |
|------|--------|-------|
| Phone number format validation | ✅ Pass | `isValidPhone()` checks length 9-12 |
| Amount validation (min/max/balance) | ✅ Pass | `validateAmount()` + server-side checks in RPCs |
| Text sanitization (XSS prevention) | ✅ Pass | `sanitizeText()` strips `<>{}` and control chars |
| PIN format validation (4 digits) | ✅ Pass | `isValidPin()` regex check |
| Provider limits enforced server-side | ✅ Pass | RPCs check min/max from `providers` table |

## 4. Data Protection

| Area | Status | Notes |
|------|--------|-------|
| `.env` in `.gitignore` | ✅ Pass | Secrets not committed |
| `.env.example` has placeholder values | ✅ Pass | No real keys in example |
| Supabase anon key is publishable (not secret) | ✅ Pass | RLS provides actual security |
| No hardcoded API keys in source | ✅ Pass | `app.json` `extra` uses env var placeholders; actual values from `.env` only |
| Phone masking for display | ✅ Pass | `maskPhone()` hides middle digits |

## 5. Network & Transport

| Area | Status | Notes |
|------|--------|-------|
| All Supabase calls over HTTPS | ✅ Pass | Enforced by Supabase client |
| No plaintext transmission of PINs | ✅ Pass | PIN → password transform before network call |
| Session auto-refresh | ✅ Pass | `autoRefreshToken: true` in Supabase config |

## 6. Identified Risks & Recommendations

### HIGH Priority
1. **Rate limiting on PIN attempts** — ✅ FIXED. Client-side: 5 attempts → 30s lockout in `login.tsx` and `PinConfirm`. Server-side: Supabase rate limits configured (3 sign-ins/5min).
2. **Transaction amount upper bound** — ✅ FIXED. Server-side RPCs now enforce K50,000 max. `CHECK` constraint added to `transactions` table (migration 011).

### MEDIUM Priority (Deferred — implement before production scale)
3. **Audit logging** — No dedicated audit log table for security events (failed logins, PIN changes, account linking). Add `audit_log` table. *Deferred: requires new table + triggers + UI.*
4. **Session revocation** — No mechanism to remotely revoke all sessions (e.g., if device is stolen). Consider adding a "Sign out all devices" feature. *Deferred: requires Supabase Admin API integration.*
5. **Certificate pinning** — Not implemented. Consider for production to prevent MITM attacks. *Deferred: requires native build configuration.*

### LOW Priority (Deferred — address in future iterations)
6. **QR code payload validation** — `parseQRData` checks for `app: 'monde'` but doesn't validate payload version or signature. Consider signing QR payloads.
7. **Offline mode security** — Cached data in Zustand store is not encrypted at rest on web. Native SecureStore handles this.
8. **Deep link validation** — Expo Router scheme `monde://` should validate incoming deep links to prevent injection.

## 7. Compliance Notes

- **Data privacy:** User data stored in Supabase (hosted infrastructure). For Zambia deployment, verify compliance with Data Protection Act 2021.
- **Financial regulations:** Mobile money operations in Zambia require Bank of Zambia approval. Ensure proper licensing before production launch.
- **PCI DSS:** Not applicable — Monde doesn't process card payments directly.

---

## Summary

**Overall Rating:** ✅ Good — All HIGH priority items resolved. Core security patterns are solid with RLS, auth checks, input validation, secure storage, hardened search_path, and server-side amount enforcement. MEDIUM/LOW items are documented for future iterations.
