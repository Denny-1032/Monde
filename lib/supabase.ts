import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      try { return localStorage.getItem(key); } catch { return null; }
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.warn('SecureStore getItem error:', e);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try { localStorage.setItem(key, value); } catch {}
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.warn('SecureStore setItem error:', e);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      try { localStorage.removeItem(key); } catch {}
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn('SecureStore removeItem error:', e);
    }
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

let supabase: SupabaseClient;

try {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: ExpoSecureStoreAdapter as any,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
} catch {
  supabase = null as any;
}

// Separate client for PIN verification — no persistent session, won't rotate main session
let supabaseVerify: SupabaseClient;
try {
  supabaseVerify = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      } as any,
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
} catch {
  supabaseVerify = null as any;
}

// Prevent "Invalid Refresh Token" crashes during auto-refresh.
// The GoTrueClient may throw unhandled rejections when the stored
// refresh token is stale. Catch them early and clear the session.
if (supabase) {
  // 1. Catch internal initialization errors (stale tokens in SecureStore)
  const authAny = supabase.auth as any;
  if (authAny.initializePromise) {
    authAny.initializePromise.catch?.((err: any) => {
      console.warn('[supabase] Auth init error (stale token cleared):', err?.message);
      supabase.auth.signOut().catch(() => {});
    });
  }

  // 2. Eagerly validate stored session — clear if refresh token is dead
  supabase.auth.getSession().then(({ error }) => {
    if (error) {
      console.warn('[supabase] Stale session detected, clearing:', error.message);
      supabase.auth.signOut().catch(() => {});
    }
  }).catch((err: any) => {
    console.warn('[supabase] getSession exception, clearing:', err?.message);
    supabase.auth.signOut().catch(() => {});
  });

  // 3. Listen for auth state changes
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'TOKEN_REFRESHED') {
      // Session refreshed successfully — no action needed
    } else if (event === 'SIGNED_OUT') {
      // Session was invalidated (possibly stale refresh token)
      // App will handle this via initSession catch block
    }
  });
}

export { supabase, supabaseVerify };
export const isSupabaseConfigured = supabaseUrl !== 'https://placeholder.supabase.co';
