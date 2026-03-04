# Monde - Mobile Payment Service for Zambia

**Tap. Pay. Done.**

Monde is a mobile payment app focused on two core features: **QR Code payments** and **Tap to Pay (NFC)**. It's designed to be interoperable across all Zambian payment providers — Airtel Money, MTN MoMo, Zamtel Kwacha, FNB, Zanaco, and Absa.

> Every feature completes in ≤ 3 taps. No feature requires more than 3 user interactions.

## Features

### Core Payments
- **Scan QR Code** — Point your camera, scan, and pay in seconds
- **Tap to Pay** — Hold phones together to transfer money instantly (NFC simulation)
- **Receive Money** — Generate your personal QR code with optional amount
- **Send Money** — Manual send with recipient details and provider auto-detection
- **Cross-Provider** — Send between Airtel, MTN, Zamtel, FNB, Zanaco, Absa with visual badges

### Security
- **PIN Authentication** — 4-digit PIN converted to secure password for Supabase
- **PIN Confirmation** — Required before every send payment (QR, manual, NFC)
- **Auto-Lock** — App locks after 2 minutes of background inactivity
- **Lock Screen** — Full PIN re-entry required to unlock
- **Login Rate Limiting** — 5 attempts max, 30-second lockout
- **Input Sanitization** — All text inputs sanitized against injection
- **Amount Validation** — Min K1, max K50,000 with balance check
- **Balance Hidden** — Tap to reveal for privacy
- **Row-Level Security** — All database tables protected with RLS policies

### User Experience
- **Edit Profile** — Change display name, view phone & provider
- **Change PIN** — 3-step secure flow (verify → new → confirm)
- **Change Provider** — Switch primary provider from profile
- **Transaction Detail** — Full receipt with share button
- **Transaction History** — Date grouping, filters (All/Sent/Received/Payments), pull-to-refresh
- **Loading Skeletons** — Animated placeholders while data loads
- **Empty State CTAs** — Guide new users to their first transaction
- **Offline Banner** — Global notification when device is offline
- **Animated Splash** — Branded spring + fade animation on launch
- **Keyboard Dismiss** — Tap outside inputs to close keyboard

## Tech Stack

- **React Native** with **Expo SDK 52**
- **Expo Router** (file-based navigation)
- **TypeScript**
- **Zustand** (state management)
- **Supabase** (backend — auth, database, real-time)
- **expo-camera** (QR scanning)
- **react-native-qrcode-svg** (QR generation)
- **react-native-reanimated** (animations)

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android emulator) or Expo Go on your phone
- Supabase project (free tier works)

### Installation

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
npx expo start

# Run on Android
npx expo start --android
```

### Environment Variables

Create a `.env` file with:

```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** in your Supabase dashboard
3. Run `supabase/migrations/000_repair.sql` (idempotent — safe to run multiple times)
4. This single script creates all tables, enums, RLS policies, functions, and seed data

Alternatively, run migrations individually in order: `001` → `002` → `003` → `004` → `005`

### Build Android APK

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build preview APK
eas build --platform android --profile preview

# Build production AAB
eas build --platform android --profile production
```

## Project Structure

```
Monde/
├── app/                    # Expo Router screens (16 screens)
│   ├── index.tsx           # Animated splash screen
│   ├── _layout.tsx         # Root layout (auth guard, auto-lock, offline banner)
│   ├── (auth)/             # Authentication screens
│   │   ├── welcome.tsx     # Welcome/onboarding
│   │   ├── login.tsx       # PIN login with rate limiting
│   │   └── register.tsx    # Multi-step registration
│   ├── (tabs)/             # Main tab screens
│   │   ├── _layout.tsx     # Tab bar with floating Pay button
│   │   ├── index.tsx       # Home (balance card + quick actions)
│   │   ├── history.tsx     # Transaction history with filters
│   │   └── profile.tsx     # Profile & settings
│   ├── scan.tsx            # QR code scanner (camera)
│   ├── receive.tsx         # QR code display for receiving
│   ├── tap.tsx             # Tap to Pay (NFC simulation)
│   ├── payment.tsx         # Send money flow with PIN confirm
│   ├── transaction.tsx     # Transaction detail + share
│   ├── success.tsx         # Animated success screen
│   ├── edit-profile.tsx    # Edit profile screen
│   └── change-pin.tsx      # Change PIN flow
├── components/             # Reusable UI components
│   ├── Avatar.tsx          # User avatar with initials
│   ├── Button.tsx          # Themed button variants
│   ├── NumPad.tsx          # Numeric keypad
│   ├── TransactionItem.tsx # Transaction list item
│   ├── PinConfirm.tsx      # PIN confirmation modal
│   ├── LockScreen.tsx      # Auto-lock screen overlay
│   ├── OfflineBanner.tsx   # Network status banner
│   └── SkeletonLoader.tsx  # Loading skeleton animations
├── constants/              # Theme, types, config
│   ├── theme.ts            # Colors, fonts, providers list
│   └── types.ts            # TypeScript interfaces
├── lib/                    # Utilities & Supabase client
│   ├── api.ts              # Supabase API functions
│   ├── supabase.ts         # Supabase client init
│   ├── helpers.ts          # Formatters, QR data, etc.
│   └── validation.ts       # Input validation & security
├── store/                  # Zustand state management
│   └── useStore.ts         # Global store with Supabase actions
└── supabase/migrations/    # Database migrations
    ├── 000_repair.sql       # Idempotent full-state repair
    ├── 001–005              # Individual migrations
    └── 006_disable_email_confirm.sql
```

## Payment Flows (≤ 3 taps)

| Flow | Steps | Taps |
|------|-------|------|
| QR Send | Scan → Confirm → PIN | 3 |
| Manual Send | Details → Review → PIN | 3 |
| NFC Send | Amount → Send → PIN | 3 |
| NFC Receive | Amount → Receive | 2 |
| QR Receive | Open → Show QR | 1 |
| View Transaction | Tap item | 1 |

## Supabase Integration

The app connects to Supabase for:
- **Auth** — Phone + password sign-up/sign-in via `supabase.auth`
- **Database** — Profiles, transactions, providers tables with RLS
- **Realtime** — Live transaction and balance updates
- **RPC** — Atomic `process_payment()` function for safe transfers

The app gracefully falls back to offline mock mode if Supabase is not configured.

## License

MIT
