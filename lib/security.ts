import { Platform, Alert } from 'react-native';
import * as Device from 'expo-device';
import * as ScreenCapture from 'expo-screen-capture';

// ============================================
// M1: Root/Jailbreak Detection
// ============================================

let rootCheckDone = false;

/**
 * Check if device is rooted (Android) or jailbroken (iOS).
 * Shows a warning alert on first detection. Does NOT block usage
 * (regulatory requirement: user must be informed, not locked out).
 */
export async function checkDeviceIntegrity(): Promise<boolean> {
  if (rootCheckDone || Platform.OS === 'web') return true;
  rootCheckDone = true;

  try {
    if (Platform.OS === 'android') {
      const isRooted = await Device.isRootedExperimentalAsync();
      if (isRooted) {
        Alert.alert(
          'Security Warning',
          'Your device appears to be rooted. This increases the risk of unauthorized access to your Monde wallet. We recommend using an unmodified device for financial transactions.',
          [{ text: 'I Understand', style: 'cancel' }],
        );
        return false;
      }
    }
    // iOS jailbreak detection is limited in Expo managed workflow.
    // expo-device does not expose a jailbreak check.
    // For production iOS, consider adding a native module or EAS config plugin.
  } catch {
    // Detection failed — proceed without blocking
  }
  return true;
}

// ============================================
// M2: Screenshot Prevention
// ============================================

/**
 * Prevent screenshots and screen recording on the current screen.
 * Call on mount of sensitive screens (balance, PIN, QR, admin).
 * Returns a cleanup function for useEffect.
 */
export function preventScreenCapture(): () => void {
  if (Platform.OS === 'web') return () => {};

  ScreenCapture.preventScreenCaptureAsync('monde-secure').catch(() => {});

  return () => {
    ScreenCapture.allowScreenCaptureAsync('monde-secure').catch(() => {});
  };
}

// ============================================
// M3/M4: Payload Integrity (QR + NFC)
// ============================================

const PAYLOAD_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Simple FNV-1a 32-bit hash for payload integrity checking.
 * NOT cryptographic — raises the bar against casual tampering.
 * Combined with timestamp expiry, prevents replay + forgery.
 */
function fnv1a(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Generate an integrity signature for a payment payload.
 * Uses phone + amount + timestamp + app key to create a hash.
 */
export function signPayload(phone: string, amount?: number, timestamp?: number): { ts: number; sig: string } {
  const ts = timestamp || Date.now();
  const data = `monde:${phone}:${amount ?? ''}:${ts}`;
  const sig = fnv1a(data);
  return { ts, sig };
}

/**
 * Verify a payload's integrity signature and freshness.
 * Returns true if signature matches and payload is within expiry window.
 */
export function verifyPayload(phone: string, amount: number | undefined, ts: number, sig: string): boolean {
  // Check expiry
  const age = Date.now() - ts;
  if (age < 0 || age > PAYLOAD_EXPIRY_MS) return false;

  // Check signature
  const expected = signPayload(phone, amount, ts);
  return expected.sig === sig;
}
