import { QRPayload } from '../constants/types';

export function formatCurrency(amount: number, currency: string = 'ZMW'): string {
  return `K${amount.toLocaleString('en-ZM', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPhone(phone: string): string {
  if (phone.startsWith('+260')) {
    const local = phone.slice(4);
    return `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return phone;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-ZM', { day: 'numeric', month: 'short' });
}

export function generateQRData(payload: QRPayload): string {
  return JSON.stringify(payload);
}

export function parseQRData(data: string): QRPayload | null {
  try {
    if (data.length > 1024) return null;
    const parsed = JSON.parse(data);
    if (parsed.app !== 'monde' || typeof parsed.phone !== 'string') return null;
    const phone = parsed.phone.replace(/[^0-9+]/g, '');
    if (phone.length < 9 || phone.length > 15) return null;
    return {
      app: 'monde',
      v: parsed.v || 1,
      phone,
      name: typeof parsed.name === 'string' ? parsed.name.replace(/[<>{}]/g, '').slice(0, 100) : '',
      provider: typeof parsed.provider === 'string' ? parsed.provider.slice(0, 20) : '',
      amount: typeof parsed.amount === 'number' && parsed.amount > 0 && parsed.amount <= 50000 ? parsed.amount : undefined,
    };
  } catch {
    return null;
  }
}

export function generateTransactionId(): string {
  return `txn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getProviderByPhone(phone: string): string {
  if (phone.includes('097') || phone.includes('077')) return 'airtel';
  if (phone.includes('096') || phone.includes('076')) return 'mtn';
  if (phone.includes('095') || phone.includes('075')) return 'zamtel';
  return 'unknown';
}

export function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return phone.slice(0, 4) + '****' + phone.slice(-3);
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================
// Fee Calculations (must match server-side migration 027)
//
// Top-up & Withdraw: flat 3% (no minimum)
//   Top-up:   Lipila keeps ~2.5%, Monde keeps ~0.5%
//   Withdraw: Lipila keeps ~1.5%, Monde keeps ~1.5%
// P2P Payment: free ≤ K500, 0.5% above K500
// ============================================

const FEE_RATE = 0.03;       // 3%

/** Top-up fee: flat 3% */
export function calcTopUpFee(amount: number): number {
  if (amount <= 0) return 0;
  return Math.round(amount * FEE_RATE * 100) / 100;
}

/** Withdraw fee: flat 3% */
export function calcWithdrawFee(amount: number): number {
  if (amount <= 0) return 0;
  return Math.round(amount * FEE_RATE * 100) / 100;
}

/** Monde's share of top-up fee (0.5% of amount) */
export function calcMondeFeeTopUp(amount: number): number {
  if (amount <= 0) return 0;
  const totalFee = calcTopUpFee(amount);
  // Lipila takes 2.5%, Monde takes remainder
  const lipilaFee = Math.round(amount * 0.025 * 100) / 100;
  return Math.max(Math.round((totalFee - lipilaFee) * 100) / 100, 0);
}

/** Monde's share of withdraw fee (1.5% of amount) */
export function calcMondeFeeWithdraw(amount: number): number {
  if (amount <= 0) return 0;
  const totalFee = calcWithdrawFee(amount);
  // Lipila takes 1.5%, Monde takes remainder
  const lipilaFee = Math.round(amount * 0.015 * 100) / 100;
  return Math.max(Math.round((totalFee - lipilaFee) * 100) / 100, 0);
}

/** P2P payment fee: free ≤ K500, 0.5% above K500 */
export function calcPaymentFee(amount: number): number {
  if (amount <= 0 || amount <= 500) return 0;
  return Math.round((amount * 0.005) * 100) / 100;
}
