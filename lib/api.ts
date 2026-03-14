import { supabase, supabaseVerify, isSupabaseConfigured } from './supabase';
import { Transaction, UserProfile, LinkedAccount, FeeSummary, FloatSummary, FeeDetailsResponse } from '../constants/types';
import { pinToPassword, sanitizeText } from './validation';

const TEST_PROVIDERS = new Set(['test_deposit', 'test_withdraw']);
const LIPILA_ENABLED = process.env.EXPO_PUBLIC_LIPILA_ENABLED === 'true';

async function getLinkedAccountPhone(userId: string, linkedAccountId?: string): Promise<string | undefined> {
  if (!linkedAccountId || !isSupabaseConfigured) return undefined;
  const { data } = await supabase
    .from('linked_accounts')
    .select('account_phone')
    .eq('id', linkedAccountId)
    .eq('user_id', userId)
    .maybeSingle();
  return data?.account_phone || undefined;
}

async function getUserPhone(userId: string): Promise<string | undefined> {
  if (!isSupabaseConfigured) return undefined;
  const { data } = await supabase
    .from('profiles')
    .select('phone')
    .eq('id', userId)
    .maybeSingle();
  return data?.phone || undefined;
}

// Mobile money providers that Lipila supports
const LIPILA_MOMO_PROVIDERS = new Set(['airtel', 'mtn', 'zamtel']);

async function callLipila(params: {
  action: 'collect' | 'disburse';
  amount: number;
  userId: string;
  provider: string;
  linkedAccountId?: string;
  destinationPhone?: string;
  note?: string;
}): Promise<{ success: boolean; referenceId?: string; error?: string }> {
  console.log(`[callLipila] provider=${params.provider}, LIPILA_ENABLED=${LIPILA_ENABLED}, supabaseConfigured=${isSupabaseConfigured}`);

  // Skip Lipila for test providers or when Supabase isn't configured
  if (TEST_PROVIDERS.has(params.provider) || !isSupabaseConfigured) {
    console.log('[callLipila] Skipping: test provider or Supabase not configured');
    return { success: true };
  }

  // Skip Lipila when not enabled (development/testing mode)
  // In this mode, wallet operations proceed without real money movement
  if (!LIPILA_ENABLED) {
    console.log('[callLipila] Skipping: EXPO_PUBLIC_LIPILA_ENABLED is not "true"');
    return { success: true };
  }

  // Only call Lipila for supported MoMo providers (bank providers not yet supported via API)
  if (!LIPILA_MOMO_PROVIDERS.has(params.provider)) {
    console.log(`[callLipila] Skipping: provider "${params.provider}" not a supported MoMo provider`);
    return { success: true };
  }

  console.log(`[callLipila] Calling Edge Function for ${params.action} ${params.amount} via ${params.provider}`);

  // Resolve the account number: destination phone > linked account phone > user's own phone
  const linkedPhone = await getLinkedAccountPhone(params.userId, params.linkedAccountId);
  const userPhone = await getUserPhone(params.userId);
  const accountNumber = params.destinationPhone || linkedPhone || userPhone;
  if (!accountNumber) {
    return { success: false, error: 'No phone/account number available for provider transaction.' };
  }

  const narration =
    params.note ||
    (params.action === 'collect' ? `Monde top-up via ${params.provider}` : `Monde withdrawal via ${params.provider}`);

  // Use raw fetch() instead of supabase.functions.invoke() to avoid
  // the generic "non-2xx status code" wrapping that hides actual errors.
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) {
      return { success: false, error: 'Not authenticated. Please sign in again.' };
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
    const fnUrl = `${supabaseUrl}/functions/v1/lipila-payments`;

    console.log(`[callLipila] POST ${fnUrl}`);
    const response = await fetch(fnUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'apikey': anonKey,
      },
      body: JSON.stringify({
        action: params.action,
        amount: params.amount,
        accountNumber,
        currency: 'ZMW',
        narration,
      }),
    });

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      const text = await response.text().catch(() => '');
      console.error('[callLipila] Non-JSON response:', response.status, text.substring(0, 200));
      return { success: false, error: `Edge Function error (HTTP ${response.status})` };
    }

    console.log(`[callLipila] Response HTTP ${response.status}:`, JSON.stringify(data).substring(0, 300));

    if (!data?.success) {
      console.warn('[callLipila] Lipila error:', data?.error);
      if (data?.lipilaResponse) {
        console.warn('[callLipila] Lipila detail:', JSON.stringify(data.lipilaResponse));
      }
      return { success: false, error: data?.error || 'Payment provider request failed' };
    }
    return { success: true, referenceId: data?.referenceId };
  } catch (err: any) {
    console.error('[callLipila] Fetch error:', err?.message);
    return { success: false, error: err?.message || 'Failed to connect to payment service' };
  }
}

// ============================================
// Auth Functions
// Uses native phone-based auth (Twilio Verify)
// ============================================

function formatPhone(phone: string): string {
  if (phone.startsWith('+260')) return phone;
  if (phone.startsWith('260') && phone.length >= 12) return `+${phone}`;
  return `+260${phone.replace(/^0/, '')}`;
}

export async function signUpWithPhone(phone: string, pin: string, metadata: {
  full_name: string;
  provider: string;
}) {
  if (!isSupabaseConfigured) return { error: 'Supabase not configured' };

  const formattedPhone = formatPhone(phone);
  const securePassword = pinToPassword(pin);
  const { data, error } = await supabase.auth.signUp({
    phone: formattedPhone,
    password: securePassword,
    options: {
      data: { full_name: sanitizeText(metadata.full_name), provider: metadata.provider },
    },
  });
  return { data, error: error?.message };
}

export async function signInWithPhone(phone: string, pin: string) {
  if (!isSupabaseConfigured) return { error: 'Supabase not configured' };

  const formattedPhone = formatPhone(phone);
  const securePassword = pinToPassword(pin);
  const { data, error } = await supabase.auth.signInWithPassword({
    phone: formattedPhone,
    password: securePassword,
  });
  return { data, error: error?.message };
}

export async function verifyPin(phone: string, pin: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: true };

  const formattedPhone = formatPhone(phone);
  if (!formattedPhone || formattedPhone === '+260') return { success: false, error: 'Phone number not available' };

  const securePassword = pinToPassword(pin);
  // Clear any stale session on verify client before attempting sign-in
  try { await supabaseVerify.auth.signOut(); } catch {}
  // Use isolated client so main session is never rotated
  const { error } = await supabaseVerify.auth.signInWithPassword({
    phone: formattedPhone,
    password: securePassword,
  });
  // Clean up the verify client session
  try { await supabaseVerify.auth.signOut(); } catch {}
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function resetPinWithToken(phone: string, newPin: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: true };
  // After OTP verification, we have an active session. updateUser works directly.
  const securePassword = pinToPassword(newPin);
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
  // Use RPC that checks BOTH profiles table AND auth.users
  const { data, error } = await supabase.rpc('check_phone_registered', { p_phone: formatted });
  if (error) {
    // Fallback: check profiles table directly
    const { data: profileData } = await supabase
      .from('profiles')
      .select('id')
      .eq('phone', formatted)
      .maybeSingle();
    return { exists: !!profileData };
  }
  return { exists: !!data };
}

export async function ensureProfileExists(
  userId: string,
  phone: string,
  fullName: string,
  provider: string = 'unknown'
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: true };

  // Try 1: RPC (SECURITY DEFINER — bypasses RLS)
  try {
    const { data, error } = await supabase.rpc('ensure_profile_exists', {
      p_user_id: userId,
      p_phone: phone,
      p_full_name: fullName,
      p_provider: provider,
    });
    // Check BOTH the PostgreSQL error AND the function's JSON response
    if (!error && data && typeof data === 'object' && data.success) {
      return { success: true };
    }
    if (error) console.warn('ensureProfileExists RPC error:', error.message);
    if (data && typeof data === 'object' && !data.success) {
      console.warn('ensureProfileExists RPC returned failure:', data.error);
    }
  } catch (e: any) {
    console.warn('ensureProfileExists RPC exception:', e?.message);
  }

  // Try 2: Direct upsert (needs INSERT RLS policy — migration 017)
  try {
    const { error: upsertErr } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        phone,
        full_name: fullName,
        provider,
        balance: 0,
        currency: 'ZMW',
      }, { onConflict: 'id' });
    if (!upsertErr) return { success: true };
    console.warn('ensureProfileExists upsert error:', upsertErr.message);
  } catch (e: any) {
    console.warn('ensureProfileExists upsert exception:', e?.message);
  }

  // Try 3: Plain insert as last resort
  try {
    const { error: insertErr } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        phone,
        full_name: fullName,
        provider,
        balance: 0,
        currency: 'ZMW',
      });
    if (!insertErr) return { success: true };
    console.warn('ensureProfileExists insert error:', insertErr.message);
    return { success: false, error: insertErr.message };
  } catch (e: any) {
    console.warn('ensureProfileExists insert exception:', e?.message);
    return { success: false, error: e?.message || 'Profile creation failed' };
  }
}

// ============================================
// OTP Verification (Twilio Verify via Supabase)
// ============================================

const OTP_COOLDOWN_MS = 60_000;
const _otpCooldowns = new Map<string, number>();

// Resend signup OTP (for registration flow — signUp already sends the first one)
export async function resendSignUpOtp(phone: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: true };
  const formattedPhone = formatPhone(phone);
  const now = Date.now();
  const lastSent = _otpCooldowns.get(formattedPhone) || 0;
  if (now - lastSent < OTP_COOLDOWN_MS) {
    const remaining = Math.ceil((OTP_COOLDOWN_MS - (now - lastSent)) / 1000);
    return { success: false, error: `Please wait ${remaining}s before requesting another code.` };
  }
  const { error } = await supabase.auth.resend({ type: 'sms', phone: formattedPhone });
  if (error) return { success: false, error: error.message };
  _otpCooldowns.set(formattedPhone, now);
  return { success: true };
}

// Verify OTP (works for both registration and forgot-pin)
export async function verifyOtp(phone: string, token: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: true };
  const formattedPhone = formatPhone(phone);
  const { error } = await supabase.auth.verifyOtp({ phone: formattedPhone, token, type: 'sms' });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// Send OTP for forgot-pin (uses signInWithOtp)
export async function sendOtp(phone: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: true };
  const formattedPhone = formatPhone(phone);
  const now = Date.now();
  const lastSent = _otpCooldowns.get(formattedPhone) || 0;
  if (now - lastSent < OTP_COOLDOWN_MS) {
    const remaining = Math.ceil((OTP_COOLDOWN_MS - (now - lastSent)) / 1000);
    return { success: false, error: `Please wait ${remaining}s before requesting another OTP.` };
  }
  const { error } = await supabase.auth.signInWithOtp({ phone: formattedPhone });
  if (error) return { success: false, error: error.message };
  _otpCooldowns.set(formattedPhone, now);
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
      is_admin: data.is_admin || false,
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

const RESERVED_HANDLES = [
  'monde', 'admin', 'support', 'help', 'system', 'official',
  'moderator', 'mod', 'staff', 'team', 'bot', 'api', 'app',
  'user', 'test', 'root', 'null', 'undefined', 'mondeuser',
  'monde.user', 'monde.app', 'mondeapp',
];

export async function checkHandleAvailable(handle: string): Promise<boolean> {
  if (!isSupabaseConfigured) return true;
  const clean = handle.replace(/^@/, '').toLowerCase();
  if (RESERVED_HANDLES.includes(clean)) return false;
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
    .eq('sender_id', userId)
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
      fee: t.fee != null ? parseFloat(t.fee) : undefined,
      reference: t.reference || undefined,
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

  const lipilaResult = await callLipila({
    action: 'collect',
    amount: params.amount,
    userId: params.userId,
    provider: params.provider,
    linkedAccountId: params.linkedAccountId,
    note: params.note,
  });
  if (!lipilaResult.success) {
    return { success: false, error: lipilaResult.error || 'Top-up provider request failed' };
  }

  const { data, error } = await supabase.rpc('process_topup', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_provider: params.provider,
    p_note: params.linkedAccountId
      ? `Top up from linked account ${params.linkedAccountId}`
      : (params.note || null),
  });

  if (error) return { success: false, error: error.message };

  // Store Lipila referenceId so the callback handler can match it
  if (lipilaResult.referenceId && data?.transaction_id) {
    await supabase
      .from('transactions')
      .update({ lipila_reference_id: lipilaResult.referenceId })
      .eq('id', data.transaction_id)
      .then(({ error: refErr }) => {
        if (refErr) console.warn('Failed to store Lipila referenceId:', refErr.message);
      });
  }

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

  const lipilaResult = await callLipila({
    action: 'disburse',
    amount: params.amount,
    userId: params.userId,
    provider: params.provider,
    linkedAccountId: params.linkedAccountId,
    destinationPhone: params.destinationPhone,
    note: params.note,
  });
  if (!lipilaResult.success) {
    return { success: false, error: lipilaResult.error || 'Withdrawal provider request failed' };
  }

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

  // Store Lipila referenceId so the callback handler can match it
  if (lipilaResult.referenceId && data?.transaction_id) {
    await supabase
      .from('transactions')
      .update({ lipila_reference_id: lipilaResult.referenceId })
      .eq('id', data.transaction_id)
      .then(({ error: refErr }) => {
        if (refErr) console.warn('Failed to store Lipila referenceId:', refErr.message);
      });
  }

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

function mapRealtimeTxn(raw: any): Transaction {
  return {
    id: raw.id,
    type: raw.type,
    amount: typeof raw.amount === 'number' ? raw.amount : parseFloat(raw.amount),
    currency: raw.currency,
    recipient_name: raw.recipient_name,
    recipient_phone: raw.recipient_phone,
    provider: raw.provider,
    status: raw.status,
    method: raw.method,
    note: raw.note,
    fee: raw.fee != null ? (typeof raw.fee === 'number' ? raw.fee : parseFloat(raw.fee)) : undefined,
    reference: raw.reference || undefined,
    created_at: raw.created_at,
  };
}

export function subscribeToTransactions(userId: string, callback: (txn: Transaction) => void) {
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
      (payload) => callback(mapRealtimeTxn(payload.new))
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

// ============================================
// Admin Functions (admin user only)
// ============================================

export async function getFeeSummary(): Promise<FeeSummary> {
  if (!isSupabaseConfigured) {
    return {
      success: true,
      total_fees_collected: 0,
      topup_fees: 0,
      withdraw_fees: 0,
      payment_fees: 0,
      admin_balance: 0,
      total_fee_transactions: 0,
    };
  }

  const { data, error } = await supabase.rpc('get_monde_fee_summary');
  if (error) return { success: false, error: error.message } as FeeSummary;
  return data as FeeSummary;
}

export async function getFloatSummary(): Promise<FloatSummary> {
  if (!isSupabaseConfigured) {
    return {
      success: true,
      total_float: 0,
      admin_balance: 0,
      system_total: 0,
      users_with_balance: 0,
      total_users: 0,
    };
  }

  const { data, error } = await supabase.rpc('get_monde_total_float');
  if (error) return { success: false, error: error.message } as FloatSummary;
  return data as FloatSummary;
}

export async function adminWithdrawRevenue(
  amount: number,
): Promise<{ success: boolean; error?: string; new_admin_balance?: number; new_user_balance?: number }> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase not configured' };
  }

  const { data, error } = await supabase.rpc('admin_withdraw_revenue', {
    p_amount: amount,
  });

  if (error) return { success: false, error: error.message };
  return data;
}

export async function getFeeDetails(
  limit = 50,
  offset = 0,
  feeType: string | null = null,
): Promise<FeeDetailsResponse> {
  if (!isSupabaseConfigured) {
    return { success: true, data: [], total: 0, limit, offset };
  }

  const { data, error } = await supabase.rpc('get_monde_fee_details', {
    p_limit: limit,
    p_offset: offset,
    p_fee_type: feeType,
  });
  if (error) return { success: false, error: error.message } as FeeDetailsResponse;
  return data as FeeDetailsResponse;
}
