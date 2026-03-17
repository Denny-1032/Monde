import { create } from 'zustand';
import { Transaction, UserProfile, LinkedAccount } from '../constants/types';
import { isSupabaseConfigured } from '../lib/supabase';
import { calcTopUpFee, calcWithdrawFee, calcPaymentFee } from '../lib/helpers';
import * as api from '../lib/api';

// Track realtime subscription cleanup
let realtimeCleanup: (() => void) | null = null;

type AppState = {
  user: UserProfile | null;
  transactions: Transaction[];
  linkedAccounts: LinkedAccount[];
  isAuthenticated: boolean;
  isLoading: boolean;
  sessionId: string | null;
  error: string | null;
  transactionCursor: string | null;
  hasMoreTransactions: boolean;

  setUser: (user: UserProfile | null) => void;
  setTransactions: (transactions: Transaction[]) => void;
  addTransaction: (transaction: Transaction) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  updateBalance: (amount: number) => void;
  setError: (error: string | null) => void;

  // Supabase-connected actions
  clearSession: () => void;
  initSession: () => Promise<void>;
  signUp: (phone: string, password: string, fullName: string, provider: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  fetchProfile: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  loadMoreTransactions: () => Promise<void>;
  sendPayment: (recipientPhone: string, recipientName: string, amount: number, method: 'qr' | 'nfc' | 'manual', note?: string) => Promise<{ success: boolean; error?: string }>;
  topUp: (amount: number, provider: string, note?: string, linkedAccountId?: string) => Promise<{ success: boolean; error?: string }>;
  withdraw: (amount: number, provider: string, destinationPhone?: string, note?: string, linkedAccountId?: string) => Promise<{ success: boolean; error?: string }>;
  fetchLinkedAccounts: () => Promise<void>;
  addLinkedAccount: (provider: string, accountName: string, accountPhone: string, isDefault?: boolean, swiftCode?: string) => Promise<{ success: boolean; error?: string }>;
  removeLinkedAccount: (accountId: string) => Promise<{ success: boolean; error?: string }>;
  setDefaultLinkedAccount: (accountId: string) => Promise<{ success: boolean; error?: string }>;
  cancelPendingTopUp: (transactionId: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
};

export const useStore = create<AppState>((set, get) => ({
  user: null,
  transactions: [],
  linkedAccounts: [],
  isAuthenticated: false,
  isLoading: false,
  sessionId: null,
  error: null,
  transactionCursor: null,
  hasMoreTransactions: true,

  setUser: (user) => set({ user }),
  setTransactions: (transactions) => set({ transactions }),
  addTransaction: (transaction) =>
    set((state) => ({ transactions: [transaction, ...state.transactions] })),
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setLoading: (value) => set({ isLoading: value }),
  updateBalance: (amount) =>
    set((state) => ({
      user: state.user ? { ...state.user, balance: state.user.balance + amount } : null,
    })),
  setError: (error) => set({ error }),

  clearSession: () => {
    if (realtimeCleanup) { realtimeCleanup(); realtimeCleanup = null; }
    set({
      user: null,
      isAuthenticated: false,
      transactions: [],
      linkedAccounts: [],
      sessionId: null,
      error: null,
    });
  },

  initSession: async () => {
    if (!isSupabaseConfigured) return;
    set({ isLoading: true });
    try {
      // Refresh session first to ensure JWT is valid (prevents stale token issues)
      const freshToken = await api.ensureFreshSession();
      if (!freshToken) {
        // No valid session — clear any stale state
        set({ user: null, isAuthenticated: false, sessionId: null });
        return;
      }
      const { session } = await api.getSession();
      if (!session?.user) {
        set({ user: null, isAuthenticated: false, sessionId: null });
        return;
      }

      const uid = session.user.id;
      set({ sessionId: uid, isAuthenticated: true });
      // Fetch profile, transactions, and linked accounts in parallel
      const [profileRes, txnRes, accountsRes] = await Promise.all([
        api.getProfile(uid),
        api.getTransactions(uid),
        api.getLinkedAccounts(uid),
      ]);

      // Handle missing profile: create one from auth metadata
      if (!profileRes.data) {
        const authPhone = session.user.phone || session.user.user_metadata?.phone || '';
        const authName = session.user.user_metadata?.full_name || '';
        const authProvider = session.user.user_metadata?.provider || 'airtel';
        if (authPhone) {
          await api.ensureProfileExists(uid, authPhone, authName || 'User', authProvider);
          // Small delay to allow replication
          await new Promise((r) => setTimeout(r, 500));
        }
        const { data: newProfile } = await api.getProfile(uid);
        if (newProfile) {
          set({ user: newProfile });
        } else {
          // Profile truly missing — sign out to prevent broken state
          console.warn('initSession: profile missing, signing out to reset');
          await api.signOut().catch(() => {});
          set({ user: null, isAuthenticated: false, sessionId: null });
          return;
        }
      } else {
        set({ user: profileRes.data });
      }
      set({ transactions: txnRes.data, linkedAccounts: accountsRes.data });

      // Subscribe to realtime updates
      if (realtimeCleanup) realtimeCleanup();
      const txnSub = api.subscribeToTransactions(uid, (txn) => {
        // Add incoming transaction if not already present
        const exists = get().transactions.some((t) => t.id === txn.id);
        if (!exists) {
          set((state) => ({ transactions: [txn, ...state.transactions] }));
        }
      });
      const balSub = api.subscribeToBalance(uid, (balance) => {
        const u = get().user;
        if (u) set({ user: { ...u, balance } });
      });
      realtimeCleanup = () => {
        txnSub.unsubscribe();
        balSub.unsubscribe();
      };
    } catch (e: any) {
      // Handle stale/invalid refresh tokens by clearing session
      const msg = e?.message || '';
      if (msg.includes('Refresh Token') || msg.includes('refresh_token') || msg.includes('Invalid')) {
        console.warn('Stale session detected, clearing...');
        await api.signOut().catch(() => {});
        set({ user: null, isAuthenticated: false, sessionId: null });
      } else {
        console.error('Session init error:', e);
      }
    } finally {
      set({ isLoading: false });
    }
  },

  signUp: async (phone, password, fullName, provider) => {
    if (!isSupabaseConfigured) {
      // Offline mock registration
      const mockUser: UserProfile = {
        id: Date.now().toString(),
        phone: phone.startsWith('+260') ? phone : `+260${phone.replace(/^0/, '')}`,
        full_name: fullName,
        provider,
        balance: 0.00,
        currency: 'ZMW',
        created_at: new Date().toISOString(),
      };
      set({ user: mockUser, isAuthenticated: true, sessionId: mockUser.id });
      return { success: true };
    }

    set({ isLoading: true, error: null });
    try {
      const formattedPhone = phone.startsWith('+260') ? phone : `+260${phone.replace(/^0/, '')}`;
      const { data, error } = await api.signUpWithPhone(formattedPhone, password, {
        full_name: fullName,
        provider,
      });
      if (error) {
        const errStr = error as string;
        // Handle orphaned auth user: auth entry exists but profile was deleted
        if (errStr.toLowerCase().includes('already registered') || errStr.toLowerCase().includes('already been registered')) {
          set({ error: 'This phone number is already registered. Please log in instead.' });
          return { success: false, error: 'This phone number is already registered. Please log in instead.' };
        }
        set({ error: errStr });
        return { success: false, error: errStr };
      }
      if (data?.user) {
        // Only set sessionId — user is NOT authenticated until OTP is verified.
        // Profile creation happens after OTP verification in register.tsx.
        set({ sessionId: data.user.id });
      }
      return { success: true };
    } catch (e: any) {
      const msg = e?.message || 'Registration failed';
      set({ error: msg });
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (phone, password) => {
    if (!isSupabaseConfigured) {
      // Offline mock login
      const mockUser: UserProfile = {
        id: '1',
        phone: phone.startsWith('+260') ? phone : `+260${phone.replace(/^0/, '')}`,
        full_name: 'Demo User',
        provider: 'airtel',
        balance: 2450.00,
        currency: 'ZMW',
        created_at: new Date().toISOString(),
      };
      set({ user: mockUser, isAuthenticated: true, sessionId: '1' });
      return { success: true };
    }

    set({ isLoading: true, error: null });
    try {
      const formattedPhone = phone.startsWith('+260') ? phone : `+260${phone.replace(/^0/, '')}`;
      const { data, error } = await api.signInWithPhone(formattedPhone, password);
      if (error) {
        set({ error: error as string });
        return { success: false, error: error as string };
      }
      if (data?.user) {
        const uid = data.user.id;
        set({ sessionId: uid, isAuthenticated: true });
        // Fetch profile, transactions, and linked accounts in parallel
        const [profileRes, txnRes, accountsRes] = await Promise.all([
          api.getProfile(uid),
          api.getTransactions(uid),
          api.getLinkedAccounts(uid),
        ]);

        // Handle missing profile: create one from auth metadata
        if (!profileRes.data) {
          const authPhone = data.user.phone || data.user.user_metadata?.phone || formattedPhone;
          const authName = data.user.user_metadata?.full_name || '';
          const authProvider = data.user.user_metadata?.provider || 'airtel';
          if (authPhone) {
            await api.ensureProfileExists(uid, authPhone, authName || 'User', authProvider);
            await new Promise((r) => setTimeout(r, 500));
          }
          const { data: newProfile } = await api.getProfile(uid);
          if (newProfile) {
            set({ user: newProfile });
          } else {
            // Profile truly missing — sign out to prevent broken state
            console.warn('signIn: profile missing after creation, signing out');
            await api.signOut().catch(() => {});
            set({ user: null, isAuthenticated: false, sessionId: null });
            return { success: false, error: 'Account setup incomplete. Please try signing up again.' };
          }
        } else {
          set({ user: profileRes.data });
        }
        set({ transactions: txnRes.data, linkedAccounts: accountsRes.data });

        // Subscribe to realtime updates
        if (realtimeCleanup) realtimeCleanup();
        const txnSub = api.subscribeToTransactions(uid, (txn) => {
          const exists = get().transactions.some((t) => t.id === txn.id);
          if (!exists) set((state) => ({ transactions: [txn, ...state.transactions] }));
        });
        const balSub = api.subscribeToBalance(uid, (balance) => {
          const u = get().user;
          if (u) set({ user: { ...u, balance } });
        });
        realtimeCleanup = () => { txnSub.unsubscribe(); balSub.unsubscribe(); };
      }
      return { success: true };
    } catch (e: any) {
      const msg = e?.message || 'Login failed';
      set({ error: msg });
      return { success: false, error: msg };
    } finally {
      set({ isLoading: false });
    }
  },

  fetchProfile: async () => {
    const sessionId = get().sessionId;
    if (!sessionId || !isSupabaseConfigured) return;
    try {
      const { data: profile } = await api.getProfile(sessionId);
      if (profile) {
        set({ user: profile });
      }
    } catch (e) {
      console.error('Fetch profile error:', e);
    }
  },

  fetchTransactions: async () => {
    const sessionId = get().sessionId;
    if (!sessionId || !isSupabaseConfigured) return;
    try {
      const { data, nextCursor } = await api.getTransactions(sessionId);
      set({ transactions: data, transactionCursor: nextCursor || null, hasMoreTransactions: !!nextCursor });
    } catch (e) {
      console.error('Fetch transactions error:', e);
    }
  },

  loadMoreTransactions: async () => {
    const { sessionId, transactionCursor, hasMoreTransactions } = get();
    if (!sessionId || !isSupabaseConfigured || !hasMoreTransactions || !transactionCursor) return;
    try {
      const { data, nextCursor } = await api.getTransactions(sessionId, 20, transactionCursor);
      set((state) => ({
        transactions: [...state.transactions, ...data],
        transactionCursor: nextCursor || null,
        hasMoreTransactions: !!nextCursor,
      }));
    } catch (e) {
      console.error('Load more transactions error:', e);
    }
  },

  sendPayment: async (recipientPhone, recipientName, amount, method, note) => {
    const { user, sessionId } = get();
    if (!user) return { success: false, error: 'Not authenticated' };

    // Block frozen accounts
    if (user.is_frozen) {
      return { success: false, error: 'Your account has been frozen. Contact support.' };
    }

    // Block agents from using regular send
    if (user.is_agent) {
      return { success: false, error: 'Agent accounts cannot send money directly. Use "Deposit" or "Agent Transfer".' };
    }

    const pFee = calcPaymentFee(amount);
    if ((amount + pFee) > user.balance) {
      return { success: false, error: 'Insufficient balance' };
    }

    if (!isSupabaseConfigured || !sessionId) {
      // Offline mock payment
      const txn: Transaction = {
        id: Date.now().toString(),
        type: 'send',
        amount,
        currency: 'ZMW',
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        provider: user.provider,
        status: 'completed',
        method,
        note,
        created_at: new Date().toISOString(),
        fee: pFee,
      };
      set((state) => ({
        transactions: [txn, ...state.transactions],
        user: state.user ? { ...state.user, balance: state.user.balance - amount - pFee } : null,
      }));
      return { success: true };
    }

    // Normalize phone to +260 format before sending to RPC
    let normalizedPhone = recipientPhone.replace(/[^0-9+]/g, '');
    if (normalizedPhone.startsWith('0')) normalizedPhone = '+260' + normalizedPhone.slice(1);
    else if (normalizedPhone.startsWith('260') && !normalizedPhone.startsWith('+')) normalizedPhone = '+' + normalizedPhone;
    else if (!normalizedPhone.startsWith('+') && normalizedPhone.length === 9) normalizedPhone = '+260' + normalizedPhone;

    set({ isLoading: true });
    try {
      const result = await api.processPayment({
        senderId: sessionId,
        recipientPhone: normalizedPhone,
        amount,
        method,
        note,
      });
      if (!result.success) {
        // Session errors → silent logout, no alert
        if (/session|expired|jwt|token/i.test(result.error || '')) {
          get().logout();
          return { success: false };
        }
        return { success: false, error: result.error || 'Payment failed' };
      }
      // Refresh data from server (parallel)
      await Promise.all([get().fetchProfile(), get().fetchTransactions()]);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Payment failed' };
    } finally {
      set({ isLoading: false });
    }
  },

  topUp: async (amount, provider, note, linkedAccountId) => {
    const { user, sessionId } = get();
    if (!user) return { success: false, error: 'Not authenticated' };
    if (user.is_frozen) return { success: false, error: 'Your account has been frozen. Contact support.' };

    // Test deposits go through Supabase when configured (so fees are recorded)
    if (!isSupabaseConfigured || !sessionId) {
      // Offline mock top-up
      const fee = calcTopUpFee(amount);
      const txn: Transaction = {
        id: Date.now().toString(),
        type: 'topup',
        amount,
        currency: 'ZMW',
        recipient_name: 'Monde Wallet',
        recipient_phone: user.phone,
        provider: provider === 'test_deposit' ? 'test' : provider,
        status: 'completed',
        method: 'wallet',
        note: note || (provider === 'test_deposit' ? 'Test deposit' : `Top up from ${provider}`),
        created_at: new Date().toISOString(),
        fee,
      };
      // Full amount credited to wallet; fee is charged from the external source
      set((state) => ({
        transactions: [txn, ...state.transactions],
        user: state.user ? { ...state.user, balance: state.user.balance + amount } : null,
      }));
      return { success: true };
    }

    set({ isLoading: true });
    try {
      const result = await api.processTopUp({
        userId: sessionId,
        amount,
        provider,
        note,
        linkedAccountId,
      });
      if (!result.success) {
        // Session errors → silent logout, no alert
        if (/session|expired|jwt|token/i.test(result.error || '')) {
          get().logout();
          return { success: false };
        }
        return { success: false, error: result.error || 'Top-up failed' };
      }
      // Top-up is now PENDING — balance updates via realtime when callback confirms.
      // Only refresh transactions to show the pending entry.
      await get().fetchTransactions();
      return { success: true, status: 'pending' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Top-up failed' };
    } finally {
      set({ isLoading: false });
    }
  },

  withdraw: async (amount, provider, destinationPhone, note, linkedAccountId) => {
    const { user, sessionId } = get();
    if (!user) return { success: false, error: 'Not authenticated' };
    if (user.is_frozen) return { success: false, error: 'Your account has been frozen. Contact support.' };

    const isTest = provider === 'test_withdraw';
    const wFee = calcWithdrawFee(amount);
    if ((amount + wFee) > user.balance) {
      return { success: false, error: `Insufficient balance. Need K${(amount + wFee).toFixed(2)} (K${amount} + K${wFee} fee)` };
    }

    if (!isSupabaseConfigured || !sessionId) {
      // Offline mock withdraw
      const txn: Transaction = {
        id: Date.now().toString(),
        type: 'withdraw',
        amount,
        currency: 'ZMW',
        recipient_name: isTest ? 'Test Withdrawal' : provider,
        recipient_phone: destinationPhone || user.phone,
        provider: isTest ? 'test' : provider,
        status: 'completed',
        method: 'wallet',
        note: note || (isTest ? 'Test withdrawal' : `Withdraw to ${provider}`),
        created_at: new Date().toISOString(),
        fee: wFee,
      };
      set((state) => ({
        transactions: [txn, ...state.transactions],
        user: state.user ? { ...state.user, balance: state.user.balance - amount - wFee } : null,
      }));
      return { success: true };
    }

    set({ isLoading: true });
    try {
      const result = await api.processWithdraw({
        userId: sessionId,
        amount,
        provider,
        destinationPhone,
        note,
        linkedAccountId,
      });
      if (!result.success) {
        // Session errors → silent logout, no alert
        if (/session|expired|jwt|token/i.test(result.error || '')) {
          get().logout();
          return { success: false };
        }
        return { success: false, error: result.error || 'Withdrawal failed' };
      }
      await Promise.all([get().fetchProfile(), get().fetchTransactions()]);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Withdrawal failed' };
    } finally {
      set({ isLoading: false });
    }
  },

  fetchLinkedAccounts: async () => {
    const { sessionId } = get();
    if (!sessionId || !isSupabaseConfigured) return;
    try {
      const { data } = await api.getLinkedAccounts(sessionId);
      set({ linkedAccounts: data });
    } catch (e) {
      // Silently fail — linked accounts are optional
    }
  },

  addLinkedAccount: async (provider, accountName, accountPhone, isDefault, swiftCode) => {
    const { sessionId } = get();
    if (!sessionId) return { success: false, error: 'Not authenticated' };

    if (!isSupabaseConfigured) {
      // Offline mock
      const mock: any = {
        id: Date.now().toString(),
        user_id: sessionId,
        provider,
        account_name: accountName,
        account_phone: accountPhone,
        is_default: isDefault || false,
        is_verified: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      set((state) => ({ linkedAccounts: [mock, ...state.linkedAccounts] }));
      return { success: true };
    }

    try {
      const result = await api.addLinkedAccount({
        userId: sessionId,
        provider,
        accountName,
        accountPhone,
        isDefault,
        swiftCode,
      });
      if (!result.success) return { success: false, error: result.error };
      await get().fetchLinkedAccounts();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to add account' };
    }
  },

  removeLinkedAccount: async (accountId) => {
    if (!isSupabaseConfigured) {
      set((state) => ({ linkedAccounts: state.linkedAccounts.filter((a) => a.id !== accountId) }));
      return { success: true };
    }
    try {
      const result = await api.deleteLinkedAccount(accountId);
      if (!result.success) return { success: false, error: result.error };
      set((state) => ({ linkedAccounts: state.linkedAccounts.filter((a) => a.id !== accountId) }));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to remove account' };
    }
  },

  setDefaultLinkedAccount: async (accountId) => {
    if (!isSupabaseConfigured) {
      set((state) => ({
        linkedAccounts: state.linkedAccounts.map((a) => ({ ...a, is_default: a.id === accountId })),
      }));
      return { success: true };
    }
    try {
      const result = await api.updateLinkedAccount(accountId, { is_default: true });
      if (!result.success) return { success: false, error: result.error };
      await get().fetchLinkedAccounts();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to set default' };
    }
  },

  cancelPendingTopUp: async (transactionId) => {
    try {
      const result = await api.cancelPendingTopUp(transactionId);
      if (!result.success) return { success: false, error: result.error };
      // Remove the cancelled transaction from local state
      set((state) => ({
        transactions: state.transactions.filter((t) => t.id !== transactionId),
      }));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to cancel' };
    }
  },

  logout: async () => {
    if (realtimeCleanup) { realtimeCleanup(); realtimeCleanup = null; }
    if (isSupabaseConfigured) {
      await api.signOut();
    }
    set({
      user: null,
      isAuthenticated: false,
      transactions: [],
      linkedAccounts: [],
      sessionId: null,
      error: null,
    });
  },
}));
