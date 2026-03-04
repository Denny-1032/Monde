# Monde App — Production Roadmap & Implementation Plan

> Last updated: 2025-07-17
> Status: Pre-production audit complete, roadmap for national launch

---

## Part 1: Current State Assessment

### What's Built & Working

| Feature | Status | Notes |
|---------|--------|-------|
| **Phone + PIN Authentication** | ✅ Complete | Supabase phone auth, Twilio Verify OTP, PIN-to-password conversion |
| **User Registration** | ✅ Complete | Phone, name, PIN, OTP verification, provider detection |
| **User Login** | ✅ Complete | Phone + PIN, session persistence, stale token handling |
| **Forgot PIN / Reset** | ✅ Complete | OTP-based recovery, 4-step flow |
| **User Profiles** | ✅ Complete | Name, phone, avatar upload, @handle, balance display |
| **Edit Profile** | ✅ Complete | Name, handle, avatar with image picker + Supabase storage |
| **QR Code Payments** | ✅ Complete | Generate QR, scan QR, auto-fill payment details |
| **Tap to Pay (NFC)** | ⚠️ Demo only | Simulated — real NFC not implemented |
| **Send Money (P2P)** | ✅ Complete | Contact search, Monde user lookup, handle lookup, PIN auth |
| **Receive Money** | ✅ Complete | QR generation with optional amount, share functionality |
| **Top Up Wallet** | ✅ Complete | Linked account selection, test deposit, fee display |
| **Withdraw from Wallet** | ✅ Complete | Linked account selection, test withdraw, fee + balance checks |
| **Transaction History** | ✅ Complete | Cursor-based pagination, filters, date grouping, pull-to-refresh |
| **Transaction Details** | ✅ Complete | Full detail view with share/receipt functionality |
| **Linked Accounts** | ✅ Complete | Add, remove, set default; provider-specific |
| **Fee System** | ✅ Complete | Top-up 1%+K1, Withdraw 1.5%+K2, P2P free≤K500/0.5%>K500 |
| **Fee Collection (Monde Admin)** | ✅ Complete | Atomic fee collection in all RPCs, monde_fees ledger |
| **Admin Dashboard** | ✅ Complete | Fee summary, float summary, fee ledger, revenue withdrawal |
| **Admin Flag System** | ✅ Complete | is_admin flag, all RPCs check flag, not hardcoded UUID |
| **Dark Mode** | ✅ Complete | System/light/dark, persisted preference, theme-aware throughout |
| **Biometric Auth** | ✅ Complete | Face ID / Fingerprint for unlock + transaction authorization |
| **Auto-Lock** | ✅ Complete | 2-minute background timeout, LockScreen overlay |
| **PIN Rate Limiting** | ✅ Complete | 5 attempts → 30s lockout on PinConfirm + LockScreen |
| **Offline Banner** | ✅ Complete | Network status detection, visual indicator |
| **Skeleton Loaders** | ✅ Complete | Home screen loading state |
| **Real-time Updates** | ✅ Complete | Supabase Realtime for transactions + balance |
| **Input Sanitization** | ✅ Complete | sanitizeText(), HTML stripping, note length limits |
| **DB Security** | ✅ Complete | RLS on all tables, SECURITY DEFINER RPCs with auth.uid() checks |
| **DB Constraints** | ✅ Complete | Non-negative balance, amount range, handle format |
| **Onboarding** | ✅ Complete | 3-slide carousel for first-time users |
| **Terms & Privacy** | ✅ Complete | ToS acceptance on registration, viewable screen |
| **Accessibility Labels** | ✅ Complete | Key components have accessibility attributes |
| **Test Wallet** | ✅ Complete | Test deposit + test withdraw for development/testing |

### What's NOT Built (Gaps for Production)

| Gap | Severity | Impact |
|-----|----------|--------|
| No real mobile money integration (Airtel/MTN/Zamtel) | 🔴 Critical | Users can't actually deposit/withdraw real money |
| No KYC / identity verification | 🔴 Critical | Regulatory requirement for financial services in Zambia |
| No transaction limits enforcement per user tier | 🔴 Critical | BOZ compliance requires tiered limits |
| No real NFC implementation | 🟡 Medium | Tap to Pay is demo-only |
| No push notifications | 🟡 Medium | Users don't get notified of incoming payments |
| No in-app help/FAQ system | 🟡 Medium | Only Alert-based support contact |
| No multi-language support | 🟡 Medium | Zambia has 7+ major languages |
| No transaction dispute/reversal system | 🟡 Medium | Users can't report issues |
| No Sentry/error tracking activated | 🟡 Medium | Scaffolded but not wired |
| No analytics activated | 🟡 Medium | Scaffolded but not wired |
| No rate limiting on API calls | 🟡 Medium | Supabase has basic limits but no per-user throttling |
| No email notifications/receipts | 🟢 Low | Nice-to-have |
| No scheduled/recurring payments | 🟢 Low | Future feature |
| No merchant QR codes (static) | 🟢 Low | Future feature |

---

## Part 2: Fixes Applied This Session

| # | Fix | File | Type |
|---|-----|------|------|
| 1 | Added PIN rate limiting to LockScreen (5 attempts → 30s lockout) | `LockScreen.tsx` | Security |
| 2 | Fixed hardcoded `Colors.error` in LockScreen error text (dark mode broken) | `LockScreen.tsx` | Dark mode |
| 3 | Fixed hardcoded `Colors.error`/`Colors.primary` in PinConfirm cancel/biometric text | `PinConfirm.tsx` | Dark mode |
| 4 | Fixed hardcoded `Colors.error`/`Colors.white` in OfflineBanner | `OfflineBanner.tsx` | Dark mode |
| 5 | TypeScript type-check: passes clean (0 errors) | All | Quality |

---

## Part 3: Production Readiness Roadmap

### Phase A: Regulatory & Compliance (MUST HAVE before launch)

> **Timeline: 4-8 weeks** — Cannot launch without these

#### A1. Bank of Zambia (BOZ) Compliance
- [ ] Obtain Electronic Money Issuer (EMI) license or partner with licensed entity
- [ ] Implement KYC tiers per BOZ National Payment Systems Directive:
  - **Tier 1 (Basic)**: Phone + Name → K5,000/day, K20,000/month
  - **Tier 2 (Standard)**: + National ID photo + selfie → K25,000/day, K100,000/month  
  - **Tier 3 (Enhanced)**: + Address proof + income docs → K100,000/day, K500,000/month
- [ ] Implement transaction limits enforcement in RPCs based on KYC tier
- [ ] Implement daily/monthly cumulative limit tracking
- [ ] Add suspicious transaction monitoring (amounts > threshold, rapid-fire transactions)
- [ ] Create audit trail exports for regulatory reporting
- [ ] Implement AML (Anti-Money Laundering) screening on large transactions
- [ ] Add mandatory cooling-off period for new accounts (first 24h: reduced limits)

#### A2. KYC Implementation
- [ ] Create `kyc_submissions` table (id, user_id, tier_requested, id_type, id_number, id_photo_url, selfie_url, address_proof_url, status, reviewed_by, reviewed_at, rejection_reason)
- [ ] Create KYC submission screen (photo capture for NRC/passport, selfie, address proof)
- [ ] Create admin KYC review screen (approve/reject with reason)
- [ ] Integrate with identity verification API (e.g., Smile Identity, Onfido, or local provider)
- [ ] Add KYC status badge on profile
- [ ] Gate transaction limits based on KYC tier
- [ ] Add KYC reminder banners when approaching tier limits

#### A3. Terms of Service & Privacy Policy
- [ ] Engage legal counsel to draft Zambia-compliant ToS and Privacy Policy
- [ ] Include data processing agreements per Zambia Data Protection Act 2021
- [ ] Add versioned ToS with re-acceptance on major changes
- [ ] Implement data export (GDPR-like right to data portability)
- [ ] Implement account deletion with data retention policy (7 years for financial records per BOZ)

---

### Phase B: Mobile Money Integration (MUST HAVE before launch)

> **Timeline: 6-12 weeks** — Core functionality

#### B1. Airtel Money API Integration
- [ ] Apply for Airtel Money API sandbox access
- [ ] Implement Airtel Money Collection API (user → Monde wallet)
- [ ] Implement Airtel Money Disbursement API (Monde wallet → user)
- [ ] Handle async callbacks (transaction status webhooks)
- [ ] Implement transaction reconciliation (match API response to internal transaction)
- [ ] Add retry logic for failed/timeout API calls
- [ ] Create Supabase Edge Function for webhook handler
- [ ] Test with Airtel sandbox thoroughly

#### B2. MTN MoMo API Integration
- [ ] Apply for MTN MoMo API sandbox access
- [ ] Implement MTN Collection API
- [ ] Implement MTN Disbursement API
- [ ] Handle MTN-specific callback format
- [ ] Implement MTN transaction reconciliation

#### B3. Zamtel Kwacha Integration
- [ ] Apply for Zamtel API access
- [ ] Implement Zamtel Collection + Disbursement
- [ ] Handle Zamtel callbacks

#### B4. Transaction Status Management
- [ ] Replace instant `completed` status with `pending` → poll/webhook → `completed`/`failed`
- [ ] Add `process_external_topup` RPC that creates pending transaction, returns reference
- [ ] Add `confirm_external_topup` RPC called by webhook to mark complete + credit balance
- [ ] Add `fail_external_transaction` RPC for failed external transactions
- [ ] Add timeout handler: auto-fail pending transactions after 15 minutes
- [ ] Add transaction status polling screen (loading spinner → success/failure)
- [ ] Implement refund/reversal for failed withdrawals where money left wallet

#### B5. Bank Integration (Phase 2)
- [ ] FNB Zambia API integration
- [ ] Zanaco API integration
- [ ] Absa Bank API integration
- [ ] Bank transfer reconciliation

---

### Phase C: Infrastructure & Operations (MUST HAVE before launch)

> **Timeline: 2-4 weeks** — Can run parallel with Phase B

#### C1. Error Tracking & Monitoring
- [ ] Activate Sentry (`lib/errorTracking.ts` scaffold exists)
  - Install `@sentry/react-native`
  - Configure DSN, environment, release tracking
  - Add error boundaries to key screens
  - Set up Sentry alerts for critical errors
- [ ] Set up Supabase monitoring dashboard
  - Database connection pool monitoring
  - RPC execution time alerts
  - Auth rate limiting alerts
- [ ] Add health check endpoint (Edge Function)

#### C2. Analytics
- [ ] Activate analytics (`lib/analytics.ts` scaffold exists)
  - Install Mixpanel or Amplitude SDK
  - Track: registration, login, payment sent/received, top-up, withdraw, KYC completion
  - Track: feature usage (QR scan, Tap to Pay, linked accounts)
  - Track: error rates, drop-off points in flows

#### C3. Push Notifications
- [ ] Activate push notifications (`lib/pushNotifications.ts` scaffold exists)
  - Install `expo-notifications`
  - Configure FCM (Android) + APNs (iOS)
  - Store push tokens in `profiles` table
  - Send notifications for: incoming payment, top-up complete, withdraw complete, KYC status change
- [ ] Create notification preferences screen
- [ ] Add Edge Function to send push notifications on transaction events

#### C4. Database Scaling
- [ ] Add database connection pooling configuration
- [ ] Create database indexes for common query patterns:
  - `idx_transactions_recipient_created` (for incoming transaction queries)
  - `idx_profiles_kyc_status` (for admin review queries)
- [ ] Set up database backups (automated daily + before migrations)
- [ ] Configure Supabase branching for staging environment
- [ ] Set up read replicas if needed for high traffic

#### C5. Security Hardening
- [ ] Enable Supabase rate limiting on auth endpoints
- [ ] Add per-user rate limiting on RPC calls (Edge Function middleware)
- [ ] Implement device fingerprinting (detect account sharing)
- [ ] Add login notification (email/SMS when new device signs in)
- [ ] Implement session management (view active sessions, remote logout)
- [ ] Add IP-based geo-blocking for admin functions
- [ ] Conduct penetration testing with third-party security firm
- [ ] Set up WAF (Web Application Firewall) rules

---

### Phase D: User Experience Polish (SHOULD HAVE before launch)

> **Timeline: 2-4 weeks** — Can run parallel

#### D1. Real NFC Implementation
- [ ] Implement actual NFC peer-to-peer using `react-native-nfc-manager`
- [ ] Create NFC payment protocol (NDEF message format for Monde)
- [ ] Handle NFC permission request flow
- [ ] Add NFC availability detection (not all phones have it)
- [ ] Test across multiple Android devices (iOS has limited NFC P2P support)

#### D2. Multi-Language Support
- [ ] Install `i18next` + `react-i18next` + `expo-localization`
- [ ] Extract all user-facing strings to translation files
- [ ] Add translations for:
  - English (default)
  - Bemba (largest local language)
  - Nyanja (second most common)
  - Tonga
- [ ] Add language selector in settings (currently shows "English" with Alert)
- [ ] Persist language preference

#### D3. Help & Support System
- [ ] Replace Alert-based help with in-app help center
- [ ] Create FAQ screen with searchable categories
- [ ] Add in-app chat support (Intercom, Freshdesk, or custom)
- [ ] Create transaction dispute flow:
  - User reports issue on transaction detail screen
  - Creates support ticket linked to transaction_id
  - Admin can view and resolve disputes
- [ ] Add feedback/rating system after transactions

#### D4. Improved Onboarding
- [ ] Add interactive tutorial overlays for first-time use of key features
- [ ] Add "Complete your profile" nudge cards on home screen
- [ ] Add KYC upgrade prompts when approaching limits
- [ ] Create referral system (invite friends, earn bonus)

#### D5. Enhanced Transaction Experience
- [ ] Add transaction search (by name, amount, reference)
- [ ] Add transaction export (CSV/PDF for date range)
- [ ] Add scheduled/recurring payments
- [ ] Add payment requests (send request, recipient approves)
- [ ] Add favorite recipients (quick send)
- [ ] Add transaction categories/tags

#### D6. Merchant Features (Phase 2)
- [ ] Static merchant QR codes (permanent, no amount)
- [ ] Merchant dashboard (sales summary, settlement)
- [ ] Merchant registration flow
- [ ] Merchant fee structure (different from P2P)

---

### Phase E: Testing & Launch (MUST DO before launch)

> **Timeline: 2-3 weeks** — After Phases A-C

#### E1. Comprehensive Testing
- [ ] Unit tests for all fee calculations (exists: `helpers.test.ts`)
- [ ] Unit tests for all validation functions (exists: `validation.test.ts`)
- [ ] Integration tests for all RPC functions
- [ ] End-to-end tests for critical flows:
  - Registration → OTP → Login
  - Top-up → Send → Receive → Withdraw
  - KYC submission → approval → limit increase
  - Admin revenue withdrawal
- [ ] Load testing: simulate 1000+ concurrent users
- [ ] Security penetration testing
- [ ] Accessibility audit (screen reader, font scaling)
- [ ] Cross-device testing (various Android versions, iOS versions)
- [ ] Offline/poor network testing

#### E2. App Store Preparation
- [ ] Create app icons (1024x1024 master + all sizes)
- [ ] Create screenshots for Play Store (phone + tablet)
- [ ] Create screenshots for App Store (6.7", 6.5", 5.5")
- [ ] Write app store description (English + local languages)
- [ ] Create promotional video/graphics
- [ ] Set up app signing keys (Android keystore, iOS certificates)
- [ ] Configure EAS build profiles for production
- [ ] Set age rating (financial apps: typically 17+)
- [ ] Prepare privacy policy URL for store listings

#### E3. Beta Testing
- [ ] Internal alpha: team testing (1 week)
- [ ] Closed beta: 50-100 invited users (2 weeks)
  - Use EAS Update for OTA patches during beta
  - Collect feedback via in-app form
  - Monitor Sentry for crashes
  - Monitor analytics for drop-offs
- [ ] Open beta: 500-1000 users (2 weeks)
  - Real mobile money transactions with small amounts
  - Monitor transaction success rates
  - Monitor support ticket volume

#### E4. Launch
- [ ] Submit to Google Play Store
- [ ] Submit to Apple App Store
- [ ] Configure OTA update channel (production)
- [ ] Set up status page (e.g., statuspage.io)
- [ ] Prepare launch marketing materials
- [ ] Set up social media accounts
- [ ] Launch monitoring dashboard (Sentry + Analytics + Supabase)

---

## Part 4: Priority Implementation Order

### Sprint 1 (Weeks 1-2): Foundation
1. Activate Sentry error tracking
2. Activate analytics
3. Set up staging Supabase project
4. Begin KYC database schema + submission screen
5. Begin Airtel Money sandbox integration

### Sprint 2 (Weeks 3-4): KYC + Airtel
6. Complete KYC submission flow
7. Create admin KYC review screen
8. Implement transaction limit enforcement by KYC tier
9. Complete Airtel Money collection + disbursement
10. Implement webhook handler (Edge Function)

### Sprint 3 (Weeks 5-6): More Providers + Notifications
11. Complete MTN MoMo integration
12. Begin Zamtel integration
13. Activate push notifications
14. Implement pending → completed transaction flow
15. Add transaction status polling screen

### Sprint 4 (Weeks 7-8): Polish + Security
16. Complete Zamtel integration
17. Multi-language support (English + Bemba + Nyanja)
18. Help center / FAQ screen
19. Security penetration testing
20. Rate limiting implementation

### Sprint 5 (Weeks 9-10): Testing + Beta
21. Complete integration tests
22. Load testing
23. App store assets preparation
24. Internal alpha testing
25. Bug fixes from alpha

### Sprint 6 (Weeks 11-12): Beta + Launch
26. Closed beta launch (50-100 users)
27. Bug fixes + performance tuning
28. Open beta (500-1000 users)
29. Final security audit
30. App store submission

---

## Part 5: Technical Debt & Maintenance

### Known Technical Debt
| Item | Priority | Effort |
|------|----------|--------|
| `OfflineBanner` polls Google every 15s — replace with `@react-native-community/netinfo` | Medium | 1h |
| `tap.tsx` NFC simulation sends empty phone to RPC | Low | 30min |
| `ThemeContext.tsx` `setMode` function recreated per render | Low | 15min |
| Replace `process.env.EXPO_PUBLIC_*` with proper config system | Low | 2h |
| Add proper TypeScript strict mode checks | Low | 4h |
| Migrate from `expo-camera` barcode scanning to `expo-barcode-scanner` (if deprecated) | Low | 2h |

### Ongoing Maintenance
- Weekly: Review Sentry errors, analytics dashboards
- Monthly: Update dependencies (Expo SDK, Supabase client)
- Quarterly: Security audit, penetration test
- Per release: Regression testing, staging deployment

---

## Part 6: Cost Estimates

| Item | Monthly Cost (USD) |
|------|-------------------|
| Supabase Pro | $25 |
| Twilio Verify (SMS OTP) | $0.05/verification × volume |
| Sentry (Team) | $26 |
| Mixpanel (Starter) | Free up to 20M events |
| Push notifications (FCM/APNs) | Free |
| Airtel Money API | Per-transaction fees |
| MTN MoMo API | Per-transaction fees |
| Apple Developer Account | $99/year |
| Google Play Developer | $25 one-time |
| **Total (base, excl. transaction fees)** | **~$60/month** |

---

## Summary

The Monde app has a **solid foundation** with all core wallet features implemented and secured. The primary gap is **real money integration** — currently all transactions are simulated. For a national launch in Zambia, the critical path is:

1. **Regulatory compliance** (BOZ license, KYC) — legal blocker
2. **Mobile money APIs** (Airtel, MTN, Zamtel) — functional blocker
3. **Infrastructure** (error tracking, notifications, monitoring) — operational blocker
4. **Beta testing** with real money — quality blocker

Estimated timeline to production: **10-12 weeks** with a small team (1-2 developers + 1 designer + legal support).
