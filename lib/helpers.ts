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
