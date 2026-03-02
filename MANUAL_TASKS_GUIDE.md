# Monde — Manual Tasks Guide

Everything that requires your hands-on action to get the app fully production-ready.

---

## 1. Supabase Project Setup

### 1.1 Create/Verify Your Supabase Project
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Open your project (or create a new one in the `us-east-1` or nearest region)
3. Copy your **Project URL** and **anon (public) key** from **Settings → API**

### 1.2 Set Environment Variables
1. Create a `.env` file in the project root (copy from `.env.example`):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```
2. **Never commit `.env`** — it's already in `.gitignore`

### 1.3 Run Database Migrations
Apply the SQL migrations in order. In the Supabase SQL Editor (Dashboard → SQL Editor):

1. Open and run each file from `supabase/migrations/` **in numeric order**:
   - `000_repair.sql`
   - `001_create_profiles.sql`
   - `002_create_transactions.sql`
   - `003_create_providers.sql`
   - `004_process_payment_function.sql`
   - `005_realtime_and_views.sql`
   - `006_disable_email_confirm.sql`
   - `007_avatars_storage.sql`
   - `008_wallet_topup_withdraw.sql`
   - `009_linked_accounts.sql`
   - `010_secure_rpc_auth_checks.sql`

2. After running all migrations, verify in **Table Editor** that these tables exist:
   - `profiles`
   - `transactions`
   - `providers`
   - `linked_accounts`

### 1.4 Enable Realtime
1. Go to **Database → Replication**
2. Enable realtime for:
   - `profiles` (for balance updates)
   - `transactions` (for new transaction notifications)

### 1.5 Create Avatars Storage Bucket
1. Go to **Storage → Buckets**
2. Verify `avatars` bucket exists (migration 007 creates it)
3. If not, create a **public** bucket named `avatars`

---

## 2. SMS/OTP Provider (Optional but Recommended)

The app currently uses email-based auth (phone → derived email). For real SMS OTP:

1. Go to **Authentication → Providers** in Supabase
2. Enable **Phone** provider
3. Choose an SMS provider:
   - **Twilio** (recommended): Sign up at [twilio.com](https://twilio.com), get Account SID, Auth Token, and a phone number
   - **MessageBird**: Alternative option
4. Enter credentials in Supabase Phone provider settings
5. The app's OTP functions in `lib/api.ts` (`sendOtp`, `verifyOtp`) are already wired up

---

## 3. Expo & EAS Setup

### 3.1 Install Expo CLI & EAS CLI
```bash
npm install -g expo-cli eas-cli
```

### 3.2 Log In to Expo
```bash
eas login
```

### 3.3 Configure EAS Project
```bash
eas init
```
This will create or link your Expo project. Update the `projectId` in `app.json` → `extra.eas.projectId` with the real value.

### 3.4 Create Your First Build
```bash
# Development build (for testing on device)
eas build --platform android --profile development

# Preview build (for internal testing)
eas build --platform android --profile preview
```

---

## 4. App Assets

You need to create/replace these image files:

| File | Size | Purpose |
|------|------|---------|
| `assets/icon.png` | 1024×1024 | App icon (no transparency) |
| `assets/splash.png` | 1284×2778 | Splash screen |
| `assets/adaptive-icon.png` | 1024×1024 | Android adaptive icon foreground |
| `assets/favicon.png` | 48×48 | Web favicon |

Use a tool like [Figma](https://figma.com) or [EasyAppIcon](https://easyappicon.com) to generate all sizes.

---

## 5. Enable Error Tracking (Sentry)

1. Install the package:
   ```bash
   npx expo install @sentry/react-native
   ```
2. Create a project at [sentry.io](https://sentry.io) → Get DSN
3. Add to `.env`:
   ```
   EXPO_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
   ```
4. Uncomment the Sentry code in `lib/errorTracking.ts` (lines are marked with comments)

---

## 6. Enable Analytics (Mixpanel)

1. Install the package:
   ```bash
   npm install mixpanel-react-native
   ```
2. Create a project at [mixpanel.com](https://mixpanel.com) → Get project token
3. Add to `.env`:
   ```
   EXPO_PUBLIC_MIXPANEL_TOKEN=your-token-here
   ```
4. Uncomment the Mixpanel code in `lib/analytics.ts`

---

## 7. Enable Push Notifications

1. Install packages:
   ```bash
   npx expo install expo-notifications expo-device
   ```
2. **iOS:** Enable Push Notifications capability in Apple Developer Portal
3. **Android:** Create a Firebase project, download `google-services.json`, place in project root
4. Uncomment the code in `lib/pushNotifications.ts`
5. Call `registerForPushNotifications()` after user login (in the store or layout)
6. Store the returned push token server-side (add a `push_token` column to `profiles` table)

---

## 8. CI/CD Setup (GitHub Actions)

1. Push your code to a GitHub repository
2. Go to **Repository → Settings → Secrets and variables → Actions**
3. Add secret: `EXPO_TOKEN`
   - Get it from: `eas credentials` or [expo.dev/accounts/settings](https://expo.dev/accounts/settings) → Access Tokens
4. The workflow file `.github/workflows/ci.yml` will:
   - Run tests on every push/PR
   - Build via EAS on pushes to `main`
   - Push OTA updates on pushes to `develop`

---

## 9. App Store Submission

### 9.1 Google Play Store
1. Create a [Google Play Developer account](https://play.google.com/console) ($25 one-time fee)
2. Create a new app in Play Console
3. Create a service account for automated uploads:
   - Go to **Setup → API access** → Create service account
   - Download the JSON key → save as `google-services.json` in project root
4. Build and submit:
   ```bash
   eas build --platform android --profile production
   eas submit --platform android --profile production
   ```

### 9.2 Apple App Store
1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
2. Create an App ID in Apple Developer Portal with bundle ID `com.monde.pay`
3. Update `eas.json` → `submit.production.ios` with your:
   - `appleId` (your Apple ID email)
   - `ascAppId` (from App Store Connect)
   - `appleTeamId` (from developer portal)
4. Build and submit:
   ```bash
   eas build --platform ios --profile production
   eas submit --platform ios --profile production
   ```

---

## 10. Security Hardening (Before Production)

Refer to `SECURITY_AUDIT.md` for full details. The critical items:

1. **Add rate limiting on login attempts (server-side)**
   - In Supabase Dashboard → Authentication → Rate Limits
   - Set max sign-in attempts per IP (e.g., 10/hour)

2. **Add transaction amount constraint in database**
   ```sql
   -- Run in Supabase SQL Editor:
   ALTER TABLE public.transactions
   ADD CONSTRAINT check_amount_positive CHECK (amount > 0 AND amount <= 50000);
   ```

3. **Run Supabase Advisors**
   - Go to **Database → Advisors** in your Supabase dashboard
   - Review and address any security or performance warnings

4. **Rotate keys if exposed**
   - If your anon key was committed to git, rotate it in **Settings → API → Regenerate**

---

## 11. Testing on Physical Devices

### Android
```bash
# Build APK for testing
eas build --platform android --profile preview
# Download the APK from the build URL and install on device
```

### iOS
```bash
# Build for internal distribution
eas build --platform ios --profile preview
# Register test devices first:
eas device:create
```

### Web (Local)
```bash
npx expo start --web
```

---

## 12. Post-Launch Monitoring

1. **Supabase Dashboard** — Monitor database usage, API calls, and auth events
2. **Sentry** (once enabled) — Monitor crashes and errors
3. **Mixpanel** (once enabled) — Track user engagement and feature usage
4. **EAS Dashboard** — Monitor build status and OTA update adoption
5. **Google Play Console / App Store Connect** — Reviews, ratings, crash reports

---

## Quick Reference: Essential Commands

```bash
# Start development server
npx expo start

# Run tests
npm test

# Build for Android (preview)
eas build --platform android --profile preview

# Build for production
eas build --platform all --profile production

# Submit to stores
eas submit --platform android --profile production
eas submit --platform ios --profile production

# Push OTA update
eas update --branch production --message "description"
```
