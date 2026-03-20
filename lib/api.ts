import { supabase, supabaseVerify, isSupabaseConfigured } from './supabase';
import { Transaction, UserProfile, LinkedAccount, FeeSummary, FloatSummary, FeeDetailsResponse } from '../constants/types';
import { pinToPassword, sanitizeText } from './validation';
import { calcTopUpFee, calcWithdrawFee } from './helpers';

const TEST_PROVIDERS = new Set(['test_deposit', 'test_withdraw']);
const LIPILA_ENABLED = process.env.EXPO_PUBLIC_LIPILA_ENABLED === 'true';

// Production-safe logger: only logs in development builds
const devLog = (...args: any[]) => { if (__DEV__) console.log(...args); };
const devWarn = (...args: any[]) => { if (__DEV__) console.warn(...args); };

/**
 * Refresh the main Supabase client session to ensure a valid JWT.
 * Call this before any RPC or edge-function call that may run after
 * the app was locked/backgrounded.  Returns the fresh access token
 * or null if the session is unrecoverable (user must re-login).
 */
export async function ensureFreshSession(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    // 1. Check current session — if token is still fresh, skip the refresh round-trip
    const { data: current } = await supabase.auth.getSession();
    if (current?.session) {
      const expiresAt = current.session.expires_at ?? 0;
      const now = Math.round(Date.now() / 1000);
      if (expiresAt > now + 60) {
        // Token valid for > 60 s — no need to refresh
        return current.session.access_token;
      }
    }

    // 2. Token missing or expiring soon — refresh it
    const { data, error } = await supabase.auth.refreshSession();
    if (data?.session?.access_token) {
      devLog('[ensureFreshSession] Refreshed OK');
      return data.session.access_token;
    }
    if (error) devWarn('[ensureFreshSession] refresh failed:', error.message);

    // 3. Refresh failed — validate the cached token with a real API call
    //    Do NOT blindly return a cached token that the gateway will reject.
    const { data: cached } = await supabase.auth.getSession();
    if (cached?.session?.access_token) {
      const { error: userErr } = await supabase.auth.getUser(cached.session.access_token);
      if (!userErr) {
        devLog('[ensureFreshSession] Cached token validated via getUser');
        return cached.session.access_token;
      }
      devWarn('[ensureFreshSession] Cached token rejected by server');
    }

    return null;
  } catch (e: any) {
    devWarn('[ensureFreshSession] error:', e?.message);
    return null;
  }
}

async function getLinkedAccountDetails(userId: string, linkedAccountId?: string): Promise<{
  account_phone?: string;
  account_name?: string;
  provider?: string;
  swift_code?: string;
} | undefined> {
  if (!linkedAccountId || !isSupabaseConfigured) return undefined;
  const { data } = await supabase
    .from('linked_accounts')
    .select('account_phone, account_name, provider, swift_code')
    .eq('id', linkedAccountId)
    .eq('user_id', userId)
    .maybeSingle();
  return data || undefined;
}

// SWIFT codes for supported Zambian banks (must match edge function)
const BANK_SWIFT_CODES: Record<string, string> = {
  fnb: 'FIRNZMLX',
  zanaco: 'ZNCOZMLU',
  absa: 'BARCZMLU',
};

// Bank providers supported by Lipila
const LIPILA_BANK_PROVIDERS = new Set(['fnb', 'zanaco', 'absa']);

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
}): Promise<{ success: boolean; referenceId?: string; cardRedirectionUrl?: string; error?: string }> {
  devLog(`[callLipila] provider=${params.provider}`);

  // Skip Lipila for test providers or when Supabase isn't configured
  if (TEST_PROVIDERS.has(params.provider) || !isSupabaseConfigured) {
    devLog('[callLipila] Skipping: test provider');
    return { success: true };
  }

  // Skip Lipila when not enabled (development/testing mode)
  if (!LIPILA_ENABLED) {
    devLog('[callLipila] Skipping: Lipila not enabled');
    return { success: true };
  }

  // Determine payment method from provider
  const isMoMo = LIPILA_MOMO_PROVIDERS.has(params.provider);
  const isBank = LIPILA_BANK_PROVIDERS.has(params.provider);
  if (!isMoMo && !isBank) {
    devLog(`[callLipila] Skipping: unsupported provider`);
    return { success: true };
  }

  // For bank providers: collect = card collection, disburse = bank disbursement
  // For MoMo providers: collect = momo collection, disburse = momo disbursement
  let paymentMethod: 'momo' | 'card' | 'bank' = 'momo';
  if (isBank) {
    paymentMethod = params.action === 'collect' ? 'card' : 'bank';
  }

  devLog(`[callLipila] ${params.action} ${params.amount} via ${paymentMethod}`);

  // Resolve account details from linked account or user profile
  const linkedAccount = await getLinkedAccountDetails(params.userId, params.linkedAccountId);
  const userPhone = await getUserPhone(params.userId);
  const accountNumber = params.destinationPhone || linkedAccount?.account_phone || userPhone;
  if (!accountNumber) {
    return { success: false, error: 'No phone/account number available for provider transaction.' };
  }

  const narration =
    params.note ||
    (params.action === 'collect' ? `Monde top-up via ${params.provider}` : `Monde withdrawal via ${params.provider}`);

  // Ensure fresh session
  const accessToken = await ensureFreshSession();
  if (!accessToken) {
    return { success: false, error: 'Not authenticated. Please sign in again.' };
  }

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
  const fnUrl = `${supabaseUrl}/functions/v1/lipila-payments`;

  // Build request body — add bank-specific fields when needed
  const bodyObj: Record<string, unknown> = {
    action: params.action,
    paymentMethod,
    amount: params.amount,
    accountNumber,
    currency: 'ZMW',
    narration,
  };

  if (isBank) {
    bodyObj.swiftCode = linkedAccount?.swift_code || BANK_SWIFT_CODES[params.provider] || '';
    bodyObj.accountHolderName = linkedAccount?.account_name || '';
    bodyObj.phoneNumber = userPhone || '';
  }

  const requestBody = JSON.stringify(bodyObj);

  // Inner fetch — called up to 2× (retry on 401)
  const doFetch = async (token: string): Promise<{ success: boolean; referenceId?: string; cardRedirectionUrl?: string; error?: string; is401?: boolean }> => {
    try {
      devLog('[callLipila] POST request');
      const response = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'apikey': anonKey,
        },
        body: requestBody,
      });

      const rawText = await response.text().catch(() => '');
      let data: any = null;
      try { data = rawText ? JSON.parse(rawText) : null; } catch {}

      devLog(`[callLipila] HTTP ${response.status}`);

      // Gateway 401 — flag for retry
      if (response.status === 401) {
        const msg401 = data?.msg || data?.message || 'Session expired';
        return { success: false, error: msg401, is401: true };
      }

      // Non-JSON or unexpected status
      if (!data && !response.ok) {
        return { success: false, error: `Payment service error (HTTP ${response.status}). ${rawText.substring(0, 200)}` };
      }

      // Edge function returned JSON (should be HTTP 200 with success flag)
      if (!data?.success) {
        const errorMsg = data?.error || data?.message || data?.msg || '';
        const lipilaMsg = data?.lipilaResponse?.message || data?.lipilaResponse?.error || '';
        const httpInfo = data?.lipilaStatusCode ? ` (HTTP ${data.lipilaStatusCode})` : '';
        let detail = '';
        if (errorMsg && lipilaMsg && lipilaMsg !== errorMsg) {
          detail = `${errorMsg} — ${lipilaMsg}${httpInfo}`;
        } else if (errorMsg) {
          detail = `${errorMsg}${httpInfo}`;
        } else if (lipilaMsg) {
          detail = `${lipilaMsg}${httpInfo}`;
        }
        if (data?.lipilaResponse) {
          devWarn('[callLipila] Lipila detail:', JSON.stringify(data.lipilaResponse));
        }
        return { success: false, error: detail || `Unexpected response (HTTP ${response.status}): ${rawText.substring(0, 200)}` };
      }
      return { success: true, referenceId: data?.referenceId, cardRedirectionUrl: data?.cardRedirectionUrl || undefined };
    } catch (err: any) {
      devWarn('[callLipila] Fetch error:', err?.message);
      return { success: false, error: err?.message || 'Failed to connect to payment service' };
    }
  };

  // Attempt 1
  const first = await doFetch(accessToken);
  if (first.success) return first;

  // Attempt 2 — on 401, force a full session refresh and retry once
  if (first.is401) {
    devWarn('[callLipila] Got 401 — retrying after refresh');
    const { data: refreshed } = await supabase.auth.refreshSession();
    const retryToken = refreshed?.session?.access_token;
    if (retryToken) {
      const second = await doFetch(retryToken);
      if (second.success) return second;
      return { success: false, error: second.error || 'Payment service rejected session after retry' };
    }
    return { success: false, error: 'Session expired. Please log out and log back in.' };
  }

  return { success: false, error: first.error || 'Payment service error' };
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
  devLog('[signInWithPhone] attempting login');
  const { data, error } = await supabase.auth.signInWithPassword({
    phone: formattedPhone,
    password: securePassword,
  });
  if (error) devWarn('[signInWithPhone] auth error:', error.message);
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
    if (error) devWarn('ensureProfileExists RPC error:', error.message);
    if (data && typeof data === 'object' && !data.success) {
      devWarn('ensureProfileExists RPC returned failure:', data.error);
    }
  } catch (e: any) {
    devWarn('ensureProfileExists RPC exception:', e?.message);
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
    devWarn('ensureProfileExists upsert error:', upsertErr.message);
  } catch (e: any) {
    devWarn('ensureProfileExists upsert exception:', e?.message);
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
    devWarn('ensureProfileExists insert error:', insertErr.message);
    return { success: false, error: insertErr.message };
  } catch (e: any) {
    devWarn('ensureProfileExists insert exception:', e?.message);
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
      is_agent: data.is_agent || false,
      is_frozen: data.is_frozen || false,
      agent_code: data.agent_code || undefined,
      account_tier: data.account_tier || 'copper',
      daily_deposit_limit: data.daily_deposit_limit ?? 3,
      daily_withdraw_limit: data.daily_withdraw_limit ?? 3,
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
// Get Cash (Agent Cash-Out) Functions
// ============================================

export async function createCashOutRequest(
  amount: number,
): Promise<{ success: boolean; request_id?: string; token?: string; amount?: number; fee?: number; total?: number; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  const token = await ensureFreshSession();
  if (!token) return { success: false, error: 'Session expired' };

  const { data, error } = await supabase.rpc('create_cash_out_request', { p_amount: amount });
  if (error) return { success: false, error: error.message };
  return data as any;
}

export async function lookupCashOutRequest(
  cashOutToken: string,
): Promise<{ success: boolean; request_id?: string; amount?: number; fee?: number; agent_commission?: number; monde_fee?: number; customer_name?: string; customer_phone?: string; volume_bonus?: boolean; daily_count?: number; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  const token = await ensureFreshSession();
  if (!token) return { success: false, error: 'Session expired' };

  const { data, error } = await supabase.rpc('lookup_cash_out_request', { p_token: cashOutToken });
  if (error) return { success: false, error: error.message };
  return data as any;
}

export async function processCashOut(
  requestId: string,
): Promise<{ success: boolean; reference?: string; amount?: number; fee?: number; agent_commission?: number; monde_fee?: number; customer_name?: string; volume_bonus?: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  const token = await ensureFreshSession();
  if (!token) return { success: false, error: 'Session expired' };

  const { data, error } = await supabase.rpc('process_cash_out', { p_request_id: requestId });
  if (error) return { success: false, error: error.message };
  return data as any;
}

export async function cancelCashOutRequest(
  requestId: string,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  const token = await ensureFreshSession();
  if (!token) return { success: false, error: 'Session expired' };

  const { data, error } = await supabase.rpc('cancel_cash_out_request', { p_request_id: requestId });
  if (error) return { success: false, error: error.message };
  return data as any;
}

export async function agentToAgentTransfer(
  recipientPhone: string,
  amount: number,
  note?: string,
): Promise<{ success: boolean; transaction_id?: string; reference?: string; amount?: number; recipient_name?: string; new_balance?: number; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  const token = await ensureFreshSession();
  if (!token) return { success: false, error: 'Session expired' };

  const { data, error } = await supabase.rpc('agent_to_agent_transfer', { p_recipient_phone: recipientPhone, p_amount: amount, p_note: note || null });
  if (error) return { success: false, error: error.message };
  return data as any;
}

export async function processAgentCashIn(
  customerPhone: string,
  amount: number,
): Promise<{ success: boolean; reference?: string; amount?: number; commission?: number; customer_name?: string; customer_phone?: string; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  const token = await ensureFreshSession();
  if (!token) return { success: false, error: 'Session expired' };

  const { data, error } = await supabase.rpc('process_agent_cash_in', { p_customer_phone: customerPhone, p_amount: amount });
  if (error) return { success: false, error: error.message };
  return data as any;
}

export async function adminToggleAgent(
  userId: string,
  isAgent: boolean,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  const token = await ensureFreshSession();
  if (!token) return { success: false, error: 'Session expired' };

  const { data, error } = await supabase.rpc('admin_toggle_agent', { p_user_id: userId, p_is_agent: isAgent });
  if (error) return { success: false, error: error.message };
  return data as any;
}

export async function adminFreezeAccount(
  userId: string,
  freeze: boolean,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  const token = await ensureFreshSession();
  if (!token) return { success: false, error: 'Session expired' };

  const { data, error } = await supabase.rpc('admin_freeze_account', { p_user_id: userId, p_freeze: freeze });
  if (error) return { success: false, error: error.message };
  return data as any;
}

export async function adminListAgents(): Promise<{ success: boolean; data: any[]; error?: string }> {
  if (!isSupabaseConfigured) return { success: true, data: [] };
  const token = await ensureFreshSession();
  if (!token) return { success: false, data: [], error: 'Session expired' };

  const { data, error } = await supabase.rpc('admin_list_agents');
  if (error) {
    devWarn('[adminListAgents] RPC error:', error.message);
    return { success: false, data: [], error: error.message };
  }
  // RPC returns { success, agents: [...] } — extract the agents array
  const rpcResult = data as any;
  if (rpcResult?.success === false) return { success: false, data: [], error: rpcResult.error };
  const agents = rpcResult?.agents || [];
  return { success: true, data: Array.isArray(agents) ? agents : [] };
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

  // Each transaction creates mirror records (sender=A for A's view, sender=B for B's view)
  // So querying by sender_id correctly shows each user's own transaction records
  let query = supabase
    .from('transactions')
    .select('*')
    .eq('sender_id', userId)
    .neq('status', 'failed')
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

  // Ensure fresh JWT before RPC call
  const token = await ensureFreshSession();
  if (!token) return { success: false, error: 'Session expired. Please sign in again.' };

  let rpcResult = await supabase.rpc('process_payment', {
    p_sender_id: params.senderId,
    p_recipient_phone: params.recipientPhone,
    p_amount: params.amount,
    p_method: params.method,
    p_note: params.note || null,
  });

  // Retry once on JWT/auth errors — force a fresh refresh before retrying
  if (rpcResult.error && /jwt|token|auth/i.test(rpcResult.error.message)) {
    devWarn('[processPayment] RPC auth error, retrying');
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session) {
      rpcResult = await supabase.rpc('process_payment', {
        p_sender_id: params.senderId,
        p_recipient_phone: params.recipientPhone,
        p_amount: params.amount,
        p_method: params.method,
        p_note: params.note || null,
      });
    }
  }

  const { data, error } = rpcResult;
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
}): Promise<{ success: boolean; data?: any; error?: string; status?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

  // Ensure fresh JWT before any API calls — prevents "Invalid JWT" after lock/unlock
  const token = await ensureFreshSession();
  if (!token) return { success: false, error: 'Session expired. Please sign in again.' };

  // Collect amount + 3% fee from MoMo via Lipila.
  // Wallet is NOT credited here — only after Lipila callback confirms payment.
  const totalFee = calcTopUpFee(params.amount);
  const lipilaCollectAmount = Math.round((params.amount + totalFee) * 100) / 100;

  const lipilaResult = await callLipila({
    action: 'collect',
    amount: lipilaCollectAmount,
    userId: params.userId,
    provider: params.provider,
    linkedAccountId: params.linkedAccountId,
    note: params.note,
  });
  if (!lipilaResult.success) {
    return { success: false, error: lipilaResult.error || 'Top-up provider request failed' };
  }

  // Create a PENDING transaction — balance is credited later by the callback handler
  let rpcResult = await supabase.rpc('create_pending_topup', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_provider: params.provider,
    p_note: params.linkedAccountId
      ? `Top up from linked account ${params.linkedAccountId}`
      : (params.note || null),
    p_lipila_reference: lipilaResult.referenceId || null,
  });

  // Retry once on JWT/auth errors
  if (rpcResult.error && /jwt|token|auth/i.test(rpcResult.error.message)) {
    devWarn('[processTopUp] RPC auth error, retrying');
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session) {
      rpcResult = await supabase.rpc('create_pending_topup', {
        p_user_id: params.userId,
        p_amount: params.amount,
        p_provider: params.provider,
        p_note: params.linkedAccountId
          ? `Top up from linked account ${params.linkedAccountId}`
          : (params.note || null),
        p_lipila_reference: lipilaResult.referenceId || null,
      });
    }
  }

  const { data, error } = rpcResult;
  if (error) return { success: false, error: error.message };

  return { ...data, status: 'pending' };
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

  // Ensure fresh JWT before any API calls — prevents "Invalid JWT" after lock/unlock
  const token = await ensureFreshSession();
  if (!token) return { success: false, error: 'Session expired. Please sign in again.' };

  // Disburse the net amount to user's MoMo.
  // The DB RPC deducts (amount + 3% fee) from user's Monde balance.
  // Lipila takes ~1.5% from Monde's Lipila wallet; Monde keeps ~1.5%.
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

  let rpcResult = await supabase.rpc('process_withdraw', {
    p_user_id: params.userId,
    p_amount: params.amount,
    p_provider: params.provider,
    p_destination_phone: params.destinationPhone || null,
    p_note: params.linkedAccountId
      ? `Withdraw to linked account ${params.linkedAccountId}`
      : (params.note || null),
  });

  // Retry once on JWT/auth errors — force a fresh refresh before retrying
  if (rpcResult.error && /jwt|token|auth/i.test(rpcResult.error.message)) {
    devWarn('[processWithdraw] RPC auth error, retrying');
    const { data: refreshed } = await supabase.auth.refreshSession();
    if (refreshed?.session) {
      rpcResult = await supabase.rpc('process_withdraw', {
        p_user_id: params.userId,
        p_amount: params.amount,
        p_provider: params.provider,
        p_destination_phone: params.destinationPhone || null,
        p_note: params.linkedAccountId
          ? `Withdraw to linked account ${params.linkedAccountId}`
          : (params.note || null),
      });
    }
  }

  const { data, error } = rpcResult;
  if (error) return { success: false, error: error.message };

  // Store Lipila referenceId so the callback handler can match it
  if (lipilaResult.referenceId && data?.transaction_id) {
    await supabase
      .from('transactions')
      .update({ lipila_reference_id: lipilaResult.referenceId })
      .eq('id', data.transaction_id)
      .then(({ error: refErr }) => {
        if (refErr) devWarn('Failed to store Lipila referenceId:', refErr.message);
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

export async function cancelPendingTopUp(transactionId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

  const { data, error } = await supabase.rpc('cancel_pending_topup', {
    p_transaction_id: transactionId,
  });

  if (error) return { success: false, error: error.message };
  return data;
}

export async function addLinkedAccount(params: {
  userId: string;
  provider: string;
  accountName: string;
  accountPhone: string;
  isDefault?: boolean;
  swiftCode?: string;
}): Promise<{ success: boolean; data?: LinkedAccount; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

  const insertObj: Record<string, unknown> = {
    user_id: params.userId,
    provider: params.provider,
    account_name: params.accountName,
    account_phone: params.accountPhone,
    is_default: params.isDefault || false,
    is_verified: true, // Auto-verify for now (real verification would involve OTP)
  };
  if (params.swiftCode) {
    insertObj.swift_code = params.swiftCode;
  }

  const { data, error } = await supabase
    .from('linked_accounts')
    .insert(insertObj)
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

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('linked_accounts')
    .update(updates)
    .eq('id', accountId)
    .eq('user_id', user.id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteLinkedAccount(accountId: string): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Supabase not configured' };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  const { error } = await supabase
    .from('linked_accounts')
    .delete()
    .eq('id', accountId)
    .eq('user_id', user.id);

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
      cashout_fees: 0,
      cashin_fees: 0,
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

// ============================================
// Admin: User Account Lookup & History
// ============================================

export async function adminGetAllAccounts(): Promise<{ data: { id: string; phone: string; full_name: string; balance: number; handle?: string; is_admin?: boolean; is_agent?: boolean; is_frozen?: boolean }[]; error?: string }> {
  if (!isSupabaseConfigured) return { data: [] };
  const token = await ensureFreshSession();
  if (!token) return { data: [], error: 'Session expired' };

  const { data, error } = await supabase
    .from('profiles')
    .select('id, phone, full_name, balance, handle, is_admin, is_agent, is_frozen, account_tier, daily_deposit_limit, daily_withdraw_limit')
    .order('handle', { ascending: true, nullsFirst: false })
    .order('full_name', { ascending: true });

  if (error) return { data: [], error: error.message };
  // Sort: accounts with handles first (alphabetically), then accounts without handles (alphabetically by name)
  const withHandle = (data || []).filter((u: any) => u.handle);
  const withoutHandle = (data || []).filter((u: any) => !u.handle);
  return { data: [...withHandle, ...withoutHandle] as any[] };
}

// Escape ILIKE special characters to prevent unexpected pattern matching
function escapeIlike(input: string): string {
  return input.replace(/[%_\\]/g, '\\$&');
}

export async function adminSearchUsers(
  query: string,
): Promise<{ data: { id: string; phone: string; full_name: string; balance: number; handle?: string; is_admin?: boolean; is_agent?: boolean; is_frozen?: boolean }[]; error?: string }> {
  if (!isSupabaseConfigured) return { data: [] };

  const trimmed = query.trim();
  if (trimmed.length < 2) return { data: [] };

  // Search across name, phone, handle, and agent_code simultaneously
  const digitsOnly = trimmed.replace(/[^0-9]/g, '');
  const safeDigits = escapeIlike(digitsOnly);
  const safeTrimmed = escapeIlike(trimmed);
  let dbQuery;

  if (trimmed.startsWith('@')) {
    // Handle search
    const safeHandle = escapeIlike(trimmed.slice(1));
    dbQuery = supabase
      .from('profiles')
      .select('id, phone, full_name, balance, handle, is_admin, is_agent, is_frozen, agent_code')
      .ilike('handle', `%${safeHandle}%`)
      .limit(20);
  } else if (/^\d+$/.test(trimmed) && trimmed.length <= 6) {
    // Could be agent code or phone fragment — search both
    dbQuery = supabase
      .from('profiles')
      .select('id, phone, full_name, balance, handle, is_admin, is_agent, is_frozen, agent_code')
      .or(`phone.ilike.%${safeDigits}%,agent_code.ilike.%${safeTrimmed}%`)
      .limit(20);
  } else if (/^\+?\d+$/.test(trimmed)) {
    // Phone number search
    dbQuery = supabase
      .from('profiles')
      .select('id, phone, full_name, balance, handle, is_admin, is_agent, is_frozen, agent_code')
      .ilike('phone', `%${safeDigits}%`)
      .limit(20);
  } else {
    // Name search
    dbQuery = supabase
      .from('profiles')
      .select('id, phone, full_name, balance, handle, is_admin, is_agent, is_frozen, agent_code')
      .ilike('full_name', `%${safeTrimmed}%`)
      .limit(20);
  }

  const { data, error } = await dbQuery;
  if (error) return { data: [], error: error.message };
  return { data: (data || []) as any[] };
}

export async function adminGetUserTransactions(
  userId: string,
  startDate?: string,
  endDate?: string,
  limit = 100,
  offset = 0,
): Promise<{ data: Transaction[]; total: number; error?: string }> {
  if (!isSupabaseConfigured) return { data: [], total: 0 };

  let countQuery = supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`);

  let dataQuery = supabase
    .from('transactions')
    .select('*')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (startDate) {
    countQuery = countQuery.gte('created_at', startDate);
    dataQuery = dataQuery.gte('created_at', startDate);
  }
  if (endDate) {
    countQuery = countQuery.lte('created_at', endDate);
    dataQuery = dataQuery.lte('created_at', endDate);
  }

  const [{ count, error: countErr }, { data, error }] = await Promise.all([countQuery, dataQuery]);

  if (error) return { data: [], total: 0, error: error.message };

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
      fee: t.fee != null ? parseFloat(t.fee) : undefined,
      reference: t.reference || undefined,
      created_at: t.created_at,
    })),
    total: count ?? 0,
  };
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

// ============================================
// Admin: Tier & Limit Management
// ============================================

export async function adminSetUserTier(
  userId: string,
  tier: 'copper' | 'gold' | 'platinum',
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  const token = await ensureFreshSession();
  if (!token) return { success: false, error: 'Session expired' };

  const { data, error } = await supabase.rpc('admin_set_user_tier', {
    p_user_id: userId,
    p_tier: tier,
  });
  if (error) return { success: false, error: error.message };
  return data as any;
}

export async function adminSetUserLimits(
  userId: string,
  depositLimit?: number,
  withdrawLimit?: number,
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { success: false, error: 'Not configured' };
  const token = await ensureFreshSession();
  if (!token) return { success: false, error: 'Session expired' };

  const { data, error } = await supabase.rpc('admin_set_user_limits', {
    p_user_id: userId,
    p_deposit_limit: depositLimit ?? null,
    p_withdraw_limit: withdrawLimit ?? null,
  });
  if (error) return { success: false, error: error.message };
  return data as any;
}
