import { supabase, isSupabaseConfigured } from './supabase';
import { Transaction, UserProfile, LinkedAccount } from '../constants/types';
import { pinToPassword, sanitizeText } from './validation';

// ============================================
// Auth Functions
// Uses email auth with phone-derived emails
// (no SMS provider needed — works out of the box)
// ============================================

function phoneToEmail(phone: string): string {
  // Convert +260971234567 → 260971234567@monde.app
  return `${phone.replace(/[^0-9]/g, '')}@monde.app`;
}

export async function signUpWithPhone(phone: string, pin: string, metadata: {
  full_name: string;
  provider: string;
}) {
  if (!isSupabaseConfigured) return { error: 'Supabase not configured' };

  const email = phoneToEmail(phone);
  const securePassword = pinToPassword(pin);
  const { data, error } = await supabase.auth.signUp({
    email,
    password: securePassword,
    options: {
      data: { full_name: sanitizeText(metadata.full_name), provider: metadata.provider, phone },
    },
  });
  return { data, error: error?.message };
}

export async function signInWithPhone(phone: string, pin: string) {
  if (!isSupabaseConfigured) return { error: 'Supabase not configured' };

  const email = phoneToEmail(phone);
  const securePassword = pinToPassword(pin);
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: securePassword,
  });
  return { data, error: error?.message };
}

export async function verifyPin(phone: string, pin: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: true };

  const email = phoneToEmail(phone);
  const securePassword = pinToPassword(pin);
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: securePassword,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function signOut() {
  if (!isSupabaseConfigured) return;
  await supabase.auth.signOut();
}

export async function getSession() {
  if (!isSupabaseConfigured) return { session: null };
  const { data } = await supabase.auth.getSession();
  return { session: data.session };
}

// ============================================
// Profile Functions
// ============================================

export async function getProfile(userId: string): Promise<{ data: UserProfile | null; error?: string }> {
  if (!isSupabaseConfigured) return { data: null, error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) return { data: null, error: error.message };

  return {
    data: {
      id: data.id,
      phone: data.phone,
      full_name: data.full_name,
      provider: data.provider,
      balance: parseFloat(data.balance),
      currency: data.currency,
      avatar_url: data.avatar_url,
      created_at: data.created_at,
    },
  };
}

export async function updateProfile(userId: string, updates: Partial<Pick<UserProfile, 'full_name' | 'provider' | 'avatar_url'>>) {
  if (!isSupabaseConfigured) return { error: 'Supabase not configured' };

  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  return { error: error?.message };
}

export async function lookupRecipient(phone: string) {
  if (!isSupabaseConfigured) return { found: false };

  const { data, error } = await supabase.rpc('lookup_recipient', { p_phone: phone });
  if (error) return { found: false };
  return data;
}

// ============================================
// Transaction Functions
// ============================================

export async function getTransactions(userId: string, limit = 50): Promise<{ data: Transaction[]; error?: string }> {
  if (!isSupabaseConfigured) return { data: [], error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };

  return {
    data: (data || []).map((t: any) => ({
      id: t.id,
      type: t.type,
      amount: parseFloat(t.amount),
      currency: t.currency,
      recipient_name: t.recipient_name,
      recipient_phone: t.recipient_phone,
      provider: t.provider,
      status: t.status,
      method: t.method,
      note: t.note,
      created_at: t.created_at,
    })),
  };
}

export async function processPayment(params: {
  senderId: string;
  recipientPhone: string;
  amount: number;
  method: 'qr' | 'nfc' | 'manual';
  note?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

  const { data, error } = await supabase.rpc('process_payment', {
    p_sender_id: params.senderId,
    p_recipient_phone: params.recipientPhone,
    p_amount: params.amount,
    p_method: params.method,
    p_note: params.note || null,
  });

  if (error) return { success: false, error: error.message };
  return data;
}

// ============================================
// Wallet Functions (Top-Up / Withdraw)
// ============================================

export async function processTopUp(params: {
  userId: string;
  amount: number;
  provider: string;
  note?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

  const { data, error } = await supabase.rpc('process_topup', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_provider: params.provider,
    p_note: params.note || null,
  });

  if (error) return { success: false, error: error.message };
  return data;
}

export async function processWithdraw(params: {
  userId: string;
  amount: number;
  provider: string;
  destinationPhone?: string;
  note?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

  const { data, error } = await supabase.rpc('process_withdraw', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_provider: params.provider,
    p_destination_phone: params.destinationPhone || null,
    p_note: params.note || null,
  });

  if (error) return { success: false, error: error.message };
  return data;
}

// ============================================
// Linked Accounts
// ============================================

export async function getLinkedAccounts(userId: string): Promise<{ data: LinkedAccount[]; error?: string }> {
  if (!isSupabaseConfigured) return { data: [] };

  const { data, error } = await supabase
    .from('linked_accounts')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return { data: [], error: error.message };
  return { data: (data || []) as LinkedAccount[] };
}

export async function addLinkedAccount(params: {
  userId: string;
  provider: string;
  accountName: string;
  accountPhone: string;
  isDefault?: boolean;
}): Promise<{ success: boolean; data?: LinkedAccount; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('linked_accounts')
    .insert({
      user_id: params.userId,
      provider: params.provider,
      account_name: params.accountName,
      account_phone: params.accountPhone,
      is_default: params.isDefault || false,
      is_verified: true, // Auto-verify for now (real verification would involve OTP)
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as LinkedAccount };
}

export async function updateLinkedAccount(
  accountId: string,
  updates: { account_name?: string; is_default?: boolean }
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

  const { error } = await supabase
    .from('linked_accounts')
    .update(updates)
    .eq('id', accountId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteLinkedAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

  const { error } = await supabase
    .from('linked_accounts')
    .delete()
    .eq('id', accountId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ============================================
// Realtime Subscriptions
// ============================================

export function subscribeToTransactions(userId: string, callback: (txn: any) => void) {
  if (!isSupabaseConfigured) return { unsubscribe: () => {} };

  const channel = supabase
    .channel('user-transactions')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'transactions',
        filter: `sender_id=eq.${userId}`,
      },
      (payload) => callback(payload.new)
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'transactions',
        filter: `recipient_id=eq.${userId}`,
      },
      (payload) => callback(payload.new)
    )
    .subscribe();

  return {
    unsubscribe: () => supabase.removeChannel(channel),
  };
}

export function subscribeToBalance(userId: string, callback: (balance: number) => void) {
  if (!isSupabaseConfigured) return { unsubscribe: () => {} };

  const channel = supabase
    .channel('user-balance')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${userId}`,
      },
      (payload) => callback(parseFloat((payload.new as any).balance))
    )
    .subscribe();

  return {
    unsubscribe: () => supabase.removeChannel(channel),
  };
}
