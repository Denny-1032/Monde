# Monde - Mobile Payment Service for Zambia

**Pay. Tap. Done.**

Monde is a mobile payment app focused on two core features: **QR Code payments** and **Tap to Pay (NFC)**. It's designed to be interoperable across all Zambian payment providers — Airtel Money, MTN MoMo, Zamtel Kwacha, FNB, Zanaco, and Absa.

## Features

- **Scan QR Code** — Point your camera, scan, and pay in seconds
- **Tap to Pay** — Hold phones together to transfer money instantly
- **Receive Money** — Generate your personal QR code for others to scan
- **Send Money** — Manual send with recipient details
- **Transaction History** — Full activity log with filters
- **Multi-Provider** — Works with Airtel, MTN, Zamtel, FNB, Zanaco, Absa
- **PIN Security** — 4-digit PIN authentication

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

## Project Structure

```
Monde/
├── app/                    # Expo Router screens
│   ├── (auth)/             # Authentication screens
│   │   ├── welcome.tsx     # Welcome/onboarding
│   │   ├── login.tsx       # PIN login
│   │   └── register.tsx    # Registration
│   ├── (tabs)/             # Main tab screens
│   │   ├── index.tsx       # Home (balance + quick actions)
│   │   ├── history.tsx     # Transaction history
│   │   └── profile.tsx     # User profile & settings
│   ├── scan.tsx            # QR code scanner
│   ├── receive.tsx         # QR code display for receiving
│   ├── tap.tsx             # Tap to Pay (NFC)
│   ├── payment.tsx         # Send money flow
│   └── success.tsx         # Transaction success
├── components/             # Reusable UI components
├── constants/              # Theme, types, config
├── lib/                    # Utilities & Supabase client
└── store/                  # Zustand state management
```

## Payment Flow (Minimal Clicks)

### QR Code Payment (2 taps)
1. Tap "Scan QR" → Camera opens
2. Scan QR → Auto-navigates to confirm → Done

### Tap to Pay (3 taps)
1. Tap "Tap to Pay"
2. Enter amount → Tap "Ready"
3. Hold phones together → Done

### Receive Money (1 tap)
1. Tap "Receive" → QR code displayed → Done

## License

MIT
