import { Providers } from '../constants/theme';

// ============================================
// Input Validation & Security Utilities
// ============================================

const ZAMBIAN_PREFIXES: Record<string, string> = {
  '097': 'airtel',
  '077': 'airtel',
  '096': 'mtn',
  '076': 'mtn',
  '095': 'zamtel',
  '075': 'zamtel',
};

/**
 * Detect provider from Zambian phone number prefix
 * Handles: 0971234567, 971234567, +260971234567, 260971234567
 */
export function detectProvider(phone: string): string | null {
  const cleaned = phone.replace(/[^0-9]/g, '');
  let local: string;
  if (cleaned.startsWith('260') && cleaned.length >= 12) {
    local = '0' + cleaned.slice(3);
  } else if (cleaned.length === 9 && /^[79]/.test(cleaned)) {
    // 9 digits without leading 0 (e.g., 971234567 or 961234567)
    local = '0' + cleaned;
  } else {
    local = cleaned;
  }
  const prefix = local.slice(0, 3);
  return ZAMBIAN_PREFIXES[prefix] || null;
}

/**
 * Get provider display info from phone number
 */
export function getProviderInfo(phone: string) {
  const id = detectProvider(phone);
  if (!id) return null;
  return Providers.find((p) => p.id === id) || null;
}

/**
 * Validate Zambian phone number (9-10 digits after country code)
 */
export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[^0-9]/g, '');
  // Accept: 0971234567 (10), 971234567 (9), +260971234567 (12), 260971234567 (12)
  return cleaned.length >= 9 && cleaned.length <= 12;
}

/**
 * Sanitize user text input (name, note) — strip control chars
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/[<>{}]/g, '') // Remove potential HTML/injection chars
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
    .trim();
}

/**
 * Validate transaction amount
 */
export function validateAmount(amount: number, balance: number): { valid: boolean; error?: string } {
  if (isNaN(amount) || amount <= 0) {
    return { valid: false, error: 'Please enter a valid amount.' };
  }
  if (amount < 1) {
    return { valid: false, error: 'Minimum transaction amount is K1.00.' };
  }
  if (amount > 50000) {
    return { valid: false, error: 'Maximum transaction amount is K50,000.' };
  }
  if (amount > balance) {
    return { valid: false, error: 'Insufficient balance for this transaction.' };
  }
  return { valid: true };
}

/**
 * Convert 4-digit PIN to a secure password for Supabase
 * Supabase requires 6+ character passwords
 */
export function pinToPassword(pin: string): string {
  return `Mn!${pin}#Zk`;
}

/**
 * Validate PIN format (exactly 4 digits)
 */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * Format phone for display: +260 97 123 4567
 */
export function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('260') && cleaned.length === 12) {
    return `+260 ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
  }
  return phone;
}
