export type Provider = {
  id: string;
  name: string;
  color: string;
  prefix: string;
};

export type Transaction = {
  id: string;
  type: 'send' | 'receive' | 'payment' | 'topup' | 'withdraw' | 'cash_out' | 'cash_in' | 'agent_transfer';
  amount: number;
  currency: string;
  recipient_name: string;
  recipient_phone: string;
  provider: string;
  status: 'pending' | 'completed' | 'failed';
  method: 'qr' | 'nfc' | 'manual' | 'wallet' | 'agent';
  note?: string;
  fee?: number;
  reference?: string;
  balance_after?: number;
  created_at: string;
};

export type UserProfile = {
  id: string;
  phone: string;
  full_name: string;
  handle?: string;
  provider: string;
  balance: number;
  currency: string;
  avatar_url?: string;
  is_admin?: boolean;
  is_agent?: boolean;
  is_frozen?: boolean;
  created_at: string;
};

export type LinkedAccount = {
  id: string;
  user_id: string;
  provider: string;
  account_name: string;
  account_phone: string;
  swift_code?: string;
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

export type CashOutQRPayload = {
  app: 'monde';
  v: number;
  type: 'cashout';
  token: string;
  phone: string;
  name: string;
  amount?: number;
};

export type CashOutRequest = {
  id: string;
  customer_id: string;
  amount: number;
  fee: number;
  agent_commission: number;
  monde_fee: number;
  token: string;
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  agent_id?: string;
  created_at: string;
  expires_at: string;
  completed_at?: string;
};

// Admin types
// MONDE_FEE_ACCOUNT_ID is the ledger account that collects fees (not a login account)
export const MONDE_FEE_ACCOUNT_ID = '00000000-0000-0000-0000-000000000000';
// Legacy alias for backwards compatibility
export const MONDE_ADMIN_ID = MONDE_FEE_ACCOUNT_ID;

export type FeeSummary = {
  success: boolean;
  total_fees_collected: number;
  topup_fees: number;
  withdraw_fees: number;
  payment_fees: number;
  cashout_fees: number;
  cashin_fees: number;
  admin_balance: number;
  total_fee_transactions: number;
  error?: string;
};

export type FloatSummary = {
  success: boolean;
  total_float: number;
  admin_balance: number;
  system_total: number;
  users_with_balance: number;
  total_users: number;
  error?: string;
};

export type FeeDetail = {
  id: string;
  transaction_id: string;
  fee_type: string;
  gross_amount: number;
  fee_amount: number;
  currency: string;
  user_id: string;
  user_name: string;
  user_phone: string;
  created_at: string;
};

export type FeeDetailsResponse = {
  success: boolean;
  data: FeeDetail[];
  total: number;
  limit: number;
  offset: number;
  error?: string;
};
