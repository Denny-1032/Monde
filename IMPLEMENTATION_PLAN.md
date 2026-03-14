# Monde App — Implementation Plan & Progress Tracker

> Last updated: 2026-03-14 (EAS fix, app icon, NFC UX, PDF export, Lipila go-live, APK build)

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
| 11l | **Fix orphaned auth users** — sign-in/initSession auto-recreate missing profile from auth metadata | ✅ DONE | `ensureProfileExists` RPC + API; store signIn + initSession handle missing profiles; home screen retry mechanism |
| 11m | **Fix checkPhoneExists** — detect orphaned auth entries via `check_phone_registered` RPC | ✅ DONE | Migration `014_fix_orphaned_auth_users.sql`: checks both profiles AND auth.users |
| 11n | **Fix forgot-pin** — OTP verification was accepting any code; now uses sendOtp/verifyOtp | ✅ DONE | Replaced `resetPasswordForEmail` (fake emails) with SMS OTP; actual verification when online |
| 11o | **User journey audit** — max amount validation on top-up/withdraw (K50,000), migration 013 handle column safety | ✅ DONE | Client-side K50,000 cap; migration 013 auto-creates handle column if missing |
| 11p | **Fix duplicate auth users** — registration OTP used `signInWithOtp` creating separate phone-auth users; now uses `updateUser({phone})` to link phone to existing email-auth user | ✅ DONE | `sendRegistrationOtp` / `verifyRegistrationOtp` in api.ts; register.tsx updated |
| 11q | **Fix 'Monde User' placeholder** — `initSession` no longer uses 'Monde User' fallback; looks up existing profile by phone first | ✅ DONE | store/useStore.ts `initSession` rewritten |
| 11r | **Reserved handles** — @monde, @admin, @support etc. blocked in client + DB trigger | ✅ DONE | `RESERVED_HANDLES` list in api.ts; migration `015_reserved_handles.sql` |
| 11s | **Edit profile keyboard fix** — Save button no longer obstructs input fields when keyboard is open | ✅ DONE | Replaced static layout with ScrollView in edit-profile.tsx |
| 11t | **Receive money UX** — shows handle on QR card; clarifies sender chooses amount when none set | ✅ DONE | receive.tsx updated text + share message |
| 11u | **Fix blank home screen** — 3 critical bugs: RPC response check, stale segments closure, silent profile creation failures | ✅ DONE | `ensureProfileExists` 3-tier fallback, `segmentsRef` in `_layout.tsx`, return value checks in store |
| 11v | **Restore profile trigger** — Migration 016 no-op caused missing profiles; migration 019 restores SECURITY DEFINER trigger | ✅ DONE | `019_restore_profile_trigger.sql` with ON CONFLICT idempotency |
| 11w | **Fix SecureStore 2048 limit** — Session data (3-5K chars) silently dropped on mobile → auth.uid() null | ✅ DONE | Removed artificial limit, added try-catch, expo-secure-store v14 handles large values |
| 11x | **Top up: linked accounts only** — Show only linked accounts in provider selector + test deposit for fake money | ✅ DONE | top-up.tsx refactored, test deposit skips PIN |
| 11y | **Motto update** — Changed "Pay. Tap. Done." → "Tap. Pay. Done." | ✅ DONE | splash + README |
| 11z | **Appearance screen** — Moved dark mode from Security to dedicated Appearance screen in Preferences | ✅ DONE | `appearance.tsx` + profile menu updated |
| 11aa | **Subtle tab bar divider** — borderTopWidth hairlineWidth + 40% opacity | ✅ DONE | `(tabs)/_layout.tsx` |
| 11ab | **Web logout** — window.confirm fallback for web platform | ✅ DONE | profile.tsx Platform.OS check |
| 11ac | **Business model** — Revenue analysis, fee structure, admin account architecture | ✅ DONE | `BUSINESS_MODEL.md` |
| 11ad | **Monde admin account + fee collection** — System account UUID 0, `monde_fees` ledger, all 3 RPCs updated to collect fees atomically, `get_monde_fee_summary` helper | ✅ DONE | `020_monde_admin_fees.sql` |
| 11ae | **Client-side fee system** — Shared `calcTopUpFee`/`calcWithdrawFee`/`calcPaymentFee` in helpers.ts, fee breakdowns in top-up/withdraw/payment screens, fees in mock store paths, fee in Transaction type + detail screen + receipt | ✅ DONE | helpers.ts, top-up.tsx, withdraw.tsx, payment.tsx, transaction.tsx, useStore.ts, types.ts |
| 11af | **Fee system audit** — 6 bugs fixed: withdraw-all ignores fee, balance check ignores fee, button disabled ignores fee, receiptBtn missing borderColor, sendAgainBtn missing backgroundColor, payment confirm missing total row; 9 fee unit tests added | ✅ DONE | withdraw.tsx, transaction.tsx, payment.tsx, helpers.test.ts |
| 11ag | **End-to-end audit (pass 1)** — 8 gaps fixed: getTransactions dropped fee+reference fields, subscribeToTransactions passed raw untyped payload, PinConfirm missing overlay/cancel/biometric colors, payment.tsx+tap.tsx balance checks ignored fees, LockScreen error text missing color, OtpInput hardcoded light-mode colors (dark mode broken) | ✅ DONE | api.ts, PinConfirm.tsx, payment.tsx, tap.tsx, LockScreen.tsx, OtpInput.tsx |
| 11ah | **End-to-end audit (pass 2)** — 3 more dark-mode fixes: forgot-pin.tsx hardcoded Colors.* on phone/code inputs (4 TextInputs), edit-profile.tsx cameraOverlay missing borderColor, linked-accounts.tsx chipText missing color | ✅ DONE | forgot-pin.tsx, edit-profile.tsx, linked-accounts.tsx |
| 11ai | **Admin functions audit & fixes** — Fixed 020 FK violation (added auth.users row for admin), rewrote 021 with admin UID auth checks (not REVOKE), added 3 new admin RPCs (fees_by_period, total_float, fee_details), blocked payments to admin phone | ✅ DONE | `020_monde_admin_fees.sql`, `021_admin_security_and_helpers.sql` |
| 11aj | **Admin dashboard** — Full in-app admin dashboard with 3 tabs (Overview/Fee Ledger/Float), fee breakdown cards, integrity check, paginated fee ledger with filters, float summary for regulatory compliance, admin-only access guard | ✅ DONE | `admin.tsx`, `api.ts`, `types.ts`, `profile.tsx` |
| 11ak | **Admin flag system** — Replaced hardcoded UUID 0 admin with `is_admin` flag, all admin RPCs check flag, fee collection account is ledger-only (no auth login) | ✅ DONE | `022_admin_flag_system.sql` |
| 11al | **Top-up fee logic fix** — User receives full amount, fee charged from external source (not deducted from wallet) | ✅ DONE | `023_fix_topup_fee_logic.sql` |
| 11am | **Full security & flow audit** — Fixed admin integrity check (accounts for withdrawn revenue), added admin withdraw input validation, added ScrollView to forgot-pin for keyboard safety, fixed top-up fee display consistency, TypeScript type-check passes clean | ✅ DONE | `admin.tsx`, `forgot-pin.tsx`, `top-up.tsx` |
| 11an | **Production audit** — Added PIN rate limiting to LockScreen (5 attempts → 30s lockout), fixed 4 hardcoded Colors.* for dark mode (LockScreen, PinConfirm cancel/biometric, OfflineBanner), created PRODUCTION_ROADMAP.md with full national-launch plan | ✅ DONE | `LockScreen.tsx`, `PinConfirm.tsx`, `OfflineBanner.tsx`, `PRODUCTION_ROADMAP.md` |
| 11ao | **Remove PIN from payment flows** — Removed redundant PIN confirmation from payment, top-up, withdraw, and tap-to-pay screens for faster UX; direct confirm & send | ✅ DONE | `payment.tsx`, `top-up.tsx`, `withdraw.tsx`, `tap.tsx` |
| 11ap | **Fix LockScreen PIN bug** — verifyPin stale session cleanup; sign out verify client before/after signIn to prevent in-memory session conflicts | ✅ DONE | `lib/api.ts` verifyPin rewritten |
| 11aq | **Admin PIN gate** — Added PIN verification prompt before admin dashboard access; non-admin users see access denied | ✅ DONE | `admin.tsx` PinConfirm + verifyPin gate |
| 11ar | **Real NFC tap-to-pay** — Built lib/nfc.ts (NDEF encode/decode, tag write/listen), rewrote tap.tsx with real NFC support via react-native-nfc-manager, graceful web fallback simulation | ✅ DONE | `lib/nfc.ts`, `tap.tsx` complete rewrite |
| 11as | **Full user journey audit** — Audited all 20+ screens; fixed dark mode bugs in 9 files (hardcoded Colors.* → theme-aware colors); verified test wallet features intact; TypeScript compiles clean | ✅ DONE | `transaction.tsx`, `payment.tsx`, `withdraw.tsx`, `login.tsx`, `register.tsx`, `change-pin.tsx`, `forgot-pin.tsx`, `linked-accounts.tsx`, `edit-profile.tsx` |
| 11at | **Fix admin sign-in** — UUID 00000000... rejected by GoTrue; created real admin user via Auth Admin API; UUID 0 preserved as ledger-only fee account | ✅ DONE | `scripts/diagnose-and-fix.mjs` |
| 11au | **Fix session expiry on top-up** — Added `refreshSession()` before `callLipila` to prevent stale JWT after app lock/unlock | ✅ DONE | `lib/api.ts` callLipila |
| 11av | **Fix fee discrepancy** — Lipila collection now includes Monde fee (amount + fee) so fee is sourced from external provider, not created from thin air | ✅ DONE | `lib/api.ts` processTopUp |
| 11aw | **Balance after transaction** — History screen computes running balance; TransactionItem shows "Bal: KX.XX" below each amount | ✅ DONE | `history.tsx`, `TransactionItem.tsx`, `types.ts` |
| 11ax | **NFC diagnostic logging** — Added clear error message when NFC fails in Expo Go (requires dev build) | ✅ DONE | `lib/nfc.ts` |
| 11ay | **3% fee model** — Unified flat 3% fee with K10 minimum for top-ups and withdrawals; Monde keeps 0.5%/1.5% respectively after Lipila's share; updated helpers, tests (35 pass), SQL migration 026, API, UI labels, withdraw-all formula | ✅ DONE | `helpers.ts`, `helpers.test.ts`, `026_fee_model_3_percent.sql`, `api.ts`, `top-up.tsx`, `withdraw.tsx` |
| 11az | **Admin accounts tab** — User search by name/phone/handle, transaction history with month picker, PDF statement export via Share API; added `adminSearchUsers` + `adminGetUserTransactions` API functions | ✅ DONE | `admin.tsx`, `api.ts` |
| 11ba | **Dark mode audit pass 3** — Fixed 10 hardcoded colors across 7 files: error text (#EF4444), border colors (#E5E7EB), chip text (#6B7280), progress dots (#6C63FF) — all now use dynamic theme colors | ✅ DONE | `login.tsx`, `register.tsx`, `change-pin.tsx`, `forgot-pin.tsx`, `withdraw.tsx`, `payment.tsx`, `linked-accounts.tsx` |
| 11bb | **Fix EAS build demo mode** — Created `.easignore` (excludes `android/`, `ios/` but includes `.env`) so EAS cloud builds receive Supabase credentials instead of falling back to mock data | ✅ DONE | `.easignore` |
| 11bc | **App icon redesign** — Generated proper 1024x1024 icon with bold white "M" + tap/NFC indicator on Monde green; replaced tiny placeholder "M"; favicon also regenerated | ✅ DONE | `assets/icon.png`, `assets/adaptive-icon.png`, `assets/favicon.png`, `scripts/generate-icons.js` |
| 11bd | **NFC UX cleanup** — Removed "NFC ready" success banner from tap.tsx; now only shows errors (unsupported device) or warnings (NFC disabled) | ✅ DONE | `tap.tsx` |
| 11be | **PDF statement export** — Replaced text-based account statement with professional HTML→PDF via `expo-print` + `expo-sharing`; styled header, summary cards, transaction table | ✅ DONE | `admin.tsx`, `expo-print`, `expo-sharing` |
| 11bf | **Lipila go-live script** — Created `scripts/go-live-lipila.mjs` that updates `.env`, pushes secrets to Supabase, validates config; edge function already supports live mode | ✅ DONE | `scripts/go-live-lipila.mjs` |
| 11bg | **app.json cleanup** — Fixed duplicate CAMERA permission, removed unnecessary RECORD_AUDIO; EAS project linked to acecode10 | ✅ DONE | `app.json` |

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
| 19 | Label NFC/Tap to Pay as demo or implement real NFC | ✅ DONE | Real NFC via react-native-nfc-manager + web fallback simulation |

## Phase 3: Provider Integration (Lipila Payment Gateway)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 20 | Integrate Airtel Money API | ✅ DONE | Via Lipila MoMo collections/disbursements (`lipila-payments` Edge Function) |
| 21 | Integrate MTN MoMo API | ✅ DONE | Via Lipila MoMo collections/disbursements (`lipila-payments` Edge Function) |
| 22 | Integrate Zamtel Kwacha API | ✅ DONE | Via Lipila MoMo collections/disbursements (`lipila-payments` Edge Function) |
| 23 | Add webhook handlers for async provider confirmations | ✅ DONE | `lipila-callback` Edge Function + `lipila_callbacks` table (migration 024) |
| 24 | Add transaction status polling for pending transactions | ✅ DONE | Status check action in `lipila-payments` Edge Function (`GET /check-status`) |
| 25 | Handle provider-side failures and reversals | ⬜ TODO | Callback updates transaction status; manual reconciliation via admin dashboard |

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
