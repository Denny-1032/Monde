import { supabase, supabaseVerify, isSupabaseConfigured } from './supabase';
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
  // Use isolated client so main session is never rotated
  const { error } = await supabaseVerify.auth.signInWithPassword({
    email,
    password: securePassword,
  });
  // Immediately sign out the verify client to clean up
  if (!error) supabaseVerify.auth.signOut().catch(() => {});
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function requestPinReset(phone: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: true };
  const email = phoneToEmail(phone);
  // Use Supabase password reset — sends OTP/magic link to the derived email
  // In production, this should be replaced with SMS OTP (Task #13)
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function resetPinWithToken(phone: string, newPin: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: true };
  const securePassword = pinToPassword(newPin);
  // Update the user's password (requires an active session from OTP/reset link)
  const { error } = await supabase.auth.updateUser({ password: securePassword });
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
// Phone existence check (for registration)
// ============================================

export async function checkPhoneExists(phone: string): Promise<{ exists: boolean }> {
  if (!isSupabaseConfigured) return { exists: false };
  const formatted = phone.startsWith('+260') ? phone : `+260${phone.replace(/^0/, '')}`;
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', formatted)
    .maybeSingle();
  if (error) return { exists: false };
  return { exists: !!data };
}

// ============================================
// OTP Verification
// Requires SMS provider (Twilio/MessageBird) configured in Supabase
// ============================================

let _lastOtpSentAt = 0;
const OTP_COOLDOWN_MS = 60_000;

export async function sendOtp(phone: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: true };
  const now = Date.now();
  if (now - _lastOtpSentAt < OTP_COOLDOWN_MS) {
    const remaining = Math.ceil((OTP_COOLDOWN_MS - (now - _lastOtpSentAt)) / 1000);
    return { success: false, error: `Please wait ${remaining}s before requesting another OTP.` };
  }
  const formattedPhone = phone.startsWith('+260') ? phone : `+260${phone.replace(/^0/, '')}`;
  const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
  if (error) return { success: false, error: error.message };
  _lastOtpSentAt = now;
  return { success: true };
}

export async function verifyOtp(phone: string, token: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: true };
  const formattedPhone = phone.startsWith('+260') ? phone : `+260${phone.replace(/^0/, '')}`;
  const { error } = await supabase.auth.verifyOtp({ phone: formattedPhone, token, type: 'sms' });
  if (error) return { success: false, error: error.message };
  return { success: true };
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
      handle: data.handle,
      provider: data.provider,
      balance: parseFloat(data.balance),
      currency: data.currency,
      avatar_url: data.avatar_url,
      created_at: data.created_at,
    },
  };
}

export async function updateProfile(userId: string, updates: Partial<Pick<UserProfile, 'full_name' | 'provider' | 'avatar_url' | 'handle'>>) {
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

export async function lookupByHandle(handle: string): Promise<{ found: boolean; id?: string; phone?: string; full_name?: string; handle?: string; avatar_url?: string }> {
  if (!isSupabaseConfigured) return { found: false };

  const cleanHandle = handle.replace(/^@/, '').toLowerCase();
  const { data, error } = await supabase.rpc('lookup_by_handle', { p_handle: cleanHandle });
  if (error || !data) return { found: false };
  return data;
}

export async function checkHandleAvailable(handle: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  const clean = handle.replace(/^@/, '').toLowerCase();
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('handle', clean)
    .maybeSingle();
  return !data;
}

export async function searchProfilesByPhone(phone: string): Promise<{ data: { id: string; phone: string; full_name: string; avatar_url?: string }[] }> {
  if (!isSupabaseConfigured) return { data: [] };

  const formatted = phone.startsWith('+260') ? phone : phone.startsWith('260') ? `+${phone}` : `+260${phone.replace(/^0/, '')}`;
  // Extract last 9 digits and sanitize to prevent ilike pattern injection
  const last9 = formatted.slice(-9).replace(/[^0-9]/g, '');
  if (last9.length < 3) return { data: [] };

  const { data, error } = await supabase
    .from('profiles')
    .select('id, phone, full_name, avatar_url')
    .ilike('phone', `%${last9}%`)
    .limit(5);

  if (error) return { data: [] };
  return { data: data || [] };
}

// ============================================
// Transaction Functions
// ============================================

export async function getTransactions(
  userId: string,
  limit = 20,
  cursor?: string
): Promise<{ data: Transaction[]; nextCursor?: string; error?: string }> {
  if (!isSupabaseConfigured) return { data: [] };

  let query = supabase
    .from('transactions')
    .select('*')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(limit + 1); // fetch one extra to detect if there's a next page

  if (cursor) {
    query = query.lt('created_at', cursor);
  }

  const { data, error } = await query;

  if (error) return { data: [], error: error.message };

  const rows = data || [];
  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1].created_at : undefined;

  return {
    data: pageRows.map((t: any) => ({
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
    nextCursor,
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
  linkedAccountId?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

  const { data, error } = await supabase.rpc('process_topup', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_provider: params.provider,
    p_note: params.linkedAccountId
      ? `Top up from linked account ${params.linkedAccountId}`
      : (params.note || null),
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
  linkedAccountId?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

  const { data, error } = await supabase.rpc('process_withdraw', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_provider: params.provider,
    p_destination_phone: params.destinationPhone || null,
    p_note: params.linkedAccountId
      ? `Withdraw to linked account ${params.linkedAccountId}`
      : (params.note || null),
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
