export type Provider = {
  id: string;
  name: string;
  color: string;
  prefix: string;
};

export type Transaction = {
  id: string;
  type: 'send' | 'receive' | 'payment' | 'topup' | 'withdraw';
  amount: number;
  currency: string;
  recipient_name: string;
  recipient_phone: string;
  provider: string;
  status: 'pending' | 'completed' | 'failed';
  method: 'qr' | 'nfc' | 'manual' | 'wallet';
  note?: string;
  created_at: string;
};

export type UserProfile = {
  id: string;
  phone: string;
  full_name: string;
  provider: string;
  balance: number;
  currency: string;
  avatar_url?: string;
  created_at: string;
};

export type LinkedAccount = {
  id: string;
  user_id: string;
  provider: string;
  account_name: string;
  account_phone: string;
  is_default: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
};

export type PaymentRequest = {
  amount: number;
  currency: string;
  recipient_phone: string;
  recipient_name: string;
  provider: string;
  method: 'qr' | 'nfc';
  note?: string;
};

export type QRPayload = {
  app: 'monde';
  v: number;
  phone: string;
  name: string;
  provider: string;
  amount?: number;
  note?: string;
};
