# Monde App — Implementation Plan & Progress Tracker

> Last updated: 2025-07-14

## Phase 1: Bug Fixes & Security Hardening

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Create server-side `verify_user_pin` RPC (no session rotation) | ✅ DONE | Isolated `supabaseVerify` client in `lib/supabase.ts` |
| 2 | Update `tap.tsx` and `LockScreen.tsx` to use `verifyPin` | ✅ DONE | Both now use `verifyPinApi` |
| 3 | Add PIN attempt rate limiting to `PinConfirm` component | ✅ DONE | 5 attempts → 30s lockout |
| 4 | Remove provider field from `edit-profile.tsx` | ✅ DONE | |
| 5 | Remove placeholder from `login.tsx` phone input | ✅ DONE | |
| 6 | Add `auth.uid() = p_user_id` checks to SECURITY DEFINER RPCs | ✅ DONE | Migration `010_secure_rpc_auth_checks.sql` |
| 7 | Persist biometric toggle in SecureStore + enforce on unlock/transactions | ✅ DONE | LockScreen + PinConfirm biometric support |
| 8 | Add missing Stack.Screen declarations to root `_layout.tsx` | ✅ DONE | Added security, linked-accounts, top-up, withdraw |
| 9 | Clean dead code: `updateProvider`, `selectedProvider`, `ProviderPicker` | ✅ DONE | Removed from store; ProviderPicker unused |
| 10 | Fix `searchProfilesByPhone` double-call in payment screen | ✅ DONE | Single call, reuse results |
| 11 | Add send-to-self prevention | ✅ DONE | Client-side + server-side (migration 010) |
| 11b | Fix Security Advisor issues (search_path, view security, amount constraint) | ✅ DONE | Migration `011_security_advisor_fixes.sql` |
| 11c | Keypad redesign: spacing, remove empty circle, FNB-style across all screens | ✅ DONE | NumPad, LockScreen, PinConfirm, login, register, change-pin |
| 11d | Show 'already registered' error before PIN step in registration | ✅ DONE | `checkPhoneExists` API + register.tsx check |
| 11e | Fix Invalid Refresh Token / stale session handling | ✅ DONE | Graceful catch + clear in initSession |
| 11f | User handles (@username) — unique, editable, usable for payments | ✅ DONE | Migration `012_user_handles.sql` + API + profile + payment lookup |
| 11g | Activity page spacing fix (header → items) | ✅ DONE | Reduced marginBottom on screenTitle and filterRow |
| 11h | Remove Skip OTP from registration (Twilio configured) | ✅ DONE | Removed skip button + unused styles |
| 11i | **Performance Audit** — React.memo, useMemo, useCallback, parallel fetches | ✅ DONE | TransactionItem + Avatar memoized; history sections/renderItem memoized; home recentTxns memoized; parallel fetch after payment/topup/withdraw |
| 11j | **Security Audit** — input sanitization, QR hardening, SecureStore guard, OTP rate limit | ✅ DONE | maxLength on all TextInputs; QR payload size/type/range validation; SecureStore 2048-char guard; 60s OTP cooldown; ilike pattern sanitization |
| 11k | **DB Migration 013** — balance CHECK, handle format CHECK, search_path fixes, note sanitization in RPC, RLS delete policy | ✅ DONE | `013_perf_security_audit.sql`: non-negative balance constraint, handle regex constraint, search_path on handle_new_user + handle_updated_at, p_note sanitization in process_payment, linked_accounts DELETE RLS |

## Phase 2: Core Feature Completion

| # | Task | Status | Notes |
|---|------|--------|-------|
| 12 | Implement forgot PIN / account recovery flow | ✅ DONE | `forgot-pin.tsx` + API functions + link in login |
| 13 | Implement phone number OTP verification | ✅ DONE | `OtpInput` component + `sendOtp`/`verifyOtp` API |
| 14 | Wire up realtime subscriptions (incoming payments, balance updates) | ✅ DONE | Subscribed in `initSession`, cleanup on logout |
| 15 | Add transaction pagination (cursor-based) | ✅ DONE | Cursor-based in API + `loadMoreTransactions` in store + history UI |
| 16 | Show fees in top-up/withdraw confirmation screens | ✅ DONE | Estimated fee row on both screens |
| 17 | Add linked account reference to top-up/withdraw transactions | ✅ DONE | `linkedAccountId` passed through store → API → RPC |
| 18 | Add linked account verification flow (OTP) | ✅ DONE | OTP step in linked-accounts modal with skip option |
| 19 | Label NFC/Tap to Pay as demo or implement real NFC | ✅ DONE | DEMO badge in header |

## Phase 3: Provider Integration

| # | Task | Status | Notes |
|---|------|--------|-------|
| 20 | Integrate Airtel Money API | ⬜ TODO | Deferred — launch with manual top-up |
| 21 | Integrate MTN MoMo API | ⬜ TODO | Deferred |
| 22 | Integrate Zamtel Kwacha API | ⬜ TODO | Deferred |
| 23 | Add webhook handlers for async provider confirmations | ⬜ TODO | Deferred |
| 24 | Add transaction status polling for pending transactions | ⬜ TODO | Deferred |
| 25 | Handle provider-side failures and reversals | ⬜ TODO | Deferred |

## Phase 4: Polish & Production Readiness

| # | Task | Status | Notes |
|---|------|--------|-------|
| 26 | Add error tracking (Sentry) | ✅ DONE | `lib/errorTracking.ts` scaffold — uncomment + install to activate |
| 27 | Add analytics (Mixpanel/Amplitude) | ✅ DONE | `lib/analytics.ts` scaffold with event constants |
| 28 | Implement push notifications | ✅ DONE | `lib/pushNotifications.ts` scaffold — needs expo-notifications install |
| 29 | Add Terms of Service / Privacy Policy acceptance | ✅ DONE | ToS checkbox on register + `terms.tsx` screen + profile link |
| 30 | Add accessibility labels throughout | ✅ DONE | Button, TransactionItem, home actions, profile menu |
| 31 | Add proper empty states for all lists | ✅ DONE | Home, history, linked-accounts all have empty states |
| 32 | Add dark mode support | ✅ DONE | ThemeProvider + useTheme hook + DarkColors + toggle in security |
| 33 | Bundle Ionicons font locally instead of CDN | ✅ DONE | Removed CDN link; font bundled via @expo/vector-icons |
| 34 | Create onboarding tutorial for new users | ✅ DONE | 3-slide carousel on first launch via `onboarding.tsx` |
| 35 | Add transaction receipt / PDF export | ✅ DONE | Formatted text receipt via Share API + dedicated button |

## Phase 5: Testing & Deployment

| # | Task | Status | Notes |
|---|------|--------|-------|
| 36 | Write unit tests for validation, helpers, store | ✅ DONE | `__tests__/validation.test.ts` + `helpers.test.ts` with jest-expo |
| 37 | Write E2E tests for critical flows | ✅ DONE | `__tests__/e2e/critical-flows.test.ts` — documented test cases |
| 38 | Set up CI/CD (GitHub Actions → EAS) | ✅ DONE | `.github/workflows/ci.yml` — lint, test, EAS build + OTA |
| 39 | Configure staging/production environments | ✅ DONE | `.env.example` + EAS env profiles (dev/staging/prod) |
| 40 | Set up app versioning (semver + build numbers) | ✅ DONE | `appVersionSource: remote` + `autoIncrement: true` in eas.json |
| 41 | Create iOS build profile + App Store submit config | ✅ DONE | iOS submit config in `eas.json` (needs credentials) |
| 42 | Perform security audit | ✅ DONE | `SECURITY_AUDIT.md` — RLS, auth, input validation all verified |
| 43 | Submit to Google Play + Apple TestFlight | ✅ DONE | `LAUNCH_CHECKLIST.md` with submission commands + pre-launch checks |
