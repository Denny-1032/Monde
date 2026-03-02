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
| No hardcoded API keys in source | ⚠️ Warning | `app.json` has Supabase URL in `extra` — move to env vars only |
| Phone masking for display | ✅ Pass | `maskPhone()` hides middle digits |

## 5. Network & Transport

| Area | Status | Notes |
|------|--------|-------|
| All Supabase calls over HTTPS | ✅ Pass | Enforced by Supabase client |
| No plaintext transmission of PINs | ✅ Pass | PIN → password transform before network call |
| Session auto-refresh | ✅ Pass | `autoRefreshToken: true` in Supabase config |

## 6. Identified Risks & Recommendations

### HIGH Priority
1. **Rate limiting on PIN attempts** — Currently no client-side or server-side rate limiting on failed login attempts. Supabase has built-in rate limiting but consider adding explicit lockout after 5 failed attempts.
2. **Transaction amount upper bound** — Client validates K50,000 max but server-side RPCs don't enforce a global max. Add `CHECK` constraint or RPC validation.

### MEDIUM Priority
3. **Audit logging** — No dedicated audit log table for security events (failed logins, PIN changes, account linking). Add `audit_log` table.
4. **Session revocation** — No mechanism to remotely revoke all sessions (e.g., if device is stolen). Consider adding a "Sign out all devices" feature.
5. **Certificate pinning** — Not implemented. Consider for production to prevent MITM attacks.

### LOW Priority
6. **QR code payload validation** — `parseQRData` checks for `app: 'monde'` but doesn't validate payload version or signature. Consider signing QR payloads.
7. **Offline mode security** — Cached data in Zustand store is not encrypted at rest on web. Native SecureStore handles this.
8. **Deep link validation** — Expo Router scheme `monde://` should validate incoming deep links to prevent injection.

## 7. Compliance Notes

- **Data privacy:** User data stored in Supabase (hosted infrastructure). For Zambia deployment, verify compliance with Data Protection Act 2021.
- **Financial regulations:** Mobile money operations in Zambia require Bank of Zambia approval. Ensure proper licensing before production launch.
- **PCI DSS:** Not applicable — Monde doesn't process card payments directly.

---

## Summary

**Overall Rating:** ✅ Good — Core security patterns are solid with RLS, auth checks, input validation, and secure storage. Address HIGH priority items before production launch.
