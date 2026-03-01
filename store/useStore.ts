import { create } from 'zustand';
import { Transaction, UserProfile, Provider, LinkedAccount } from '../constants/types';
import { Providers } from '../constants/theme';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import * as api from '../lib/api';

type AppState = {
  user: UserProfile | null;
  transactions: Transaction[];
  linkedAccounts: LinkedAccount[];
  isAuthenticated: boolean;
  isLoading: boolean;
  selectedProvider: Provider | null;
  sessionId: string | null;
  error: string | null;

  setUser: (user: UserProfile | null) => void;
  setTransactions: (transactions: Transaction[]) => void;
  addTransaction: (transaction: Transaction) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setSelectedProvider: (provider: Provider | null) => void;
  updateBalance: (amount: number) => void;
  setError: (error: string | null) => void;

  // Supabase-connected actions
  clearSession: () => void;
  initSession: () => Promise<void>;
  signUp: (phone: string, password: string, fullName: string, provider: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  fetchProfile: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  sendPayment: (recipientPhone: string, recipientName: string, amount: number, method: 'qr' | 'nfc' | 'manual', note?: string) => Promise<{ success: boolean; error?: string }>;
  topUp: (amount: number, provider: string, note?: string) => Promise<{ success: boolean; error?: string }>;
  withdraw: (amount: number, provider: string, destinationPhone?: string, note?: string) => Promise<{ success: boolean; error?: string }>;
  updateProvider: (providerId: string) => Promise<{ success: boolean; error?: string }>;
  fetchLinkedAccounts: () => Promise<void>;
  addLinkedAccount: (provider: string, accountName: string, accountPhone: string, isDefault?: boolean) => Promise<{ success: boolean; error?: string }>;
  removeLinkedAccount: (accountId: string) => Promise<{ success: boolean; error?: string }>;
  setDefaultLinkedAccount: (accountId: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
};

export const useStore = create<AppState>((set, get) => ({
  user: null,
  transactions: [],
  linkedAccounts: [],
  isAuthenticated: false,
  isLoading: false,
  selectedProvider: Providers[0] as Provider,
  sessionId: null,
  error: null,

  setUser: (user) => set({ user }),
  setTransactions: (transactions) => set({ transactions }),
  addTransaction: (transaction) =>
    set((state) => ({ transactions: [transaction, ...state.transactions] })),
  setAuthenticated: (value) => set({ isAuthenticated: value }),
  setLoading: (value) => set({ isLoading: value }),
  setSelectedProvider: (provider) => set({ selectedProvider: provider }),
  updateBalance: (amount) =>
    set((state) => ({
      user: state.user ? { ...state.user, balance: state.user.balance + amount } : null,
    })),
  setError: (error) => set({ error }),

  clearSession: () => set({
    user: null,
    isAuthenticated: false,
    transactions: [],
    linkedAccounts: [],
    sessionId: null,
    error: null,
  }),

  initSession: async () => {
    if (!isSupabaseConfigured) return;
    set({ isLoading: true });
    try {
      const { session } = await api.getSession();
      if (session?.user) {
        set({ sessionId: session.user.id, isAuthenticated: true });
        const { data: profile } = await api.getProfile(session.user.id);
        if (profile) {
          set({ user: profile });
          const provider = Providers.find((p) => p.id === profile.provider);
          if (provider) set({ selectedProvider: provider as Provider });
        }
        const { data: txns } = await api.getTransactions(session.user.id);
        set({ transactions: txns });
        // Fetch linked accounts
        const { data: accounts } = await api.getLinkedAccounts(session.user.id);
        set({ linkedAccounts: accounts });
      }
    } catch (e: any) {
      console.error('Session init error:', e);
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
        set({ error: error as string });
        return { success: false, error: error as string };
      }
      if (data?.user) {
        set({ sessionId: data.user.id, isAuthenticated: true });
        // Profile is auto-created by the database trigger
        await get().fetchProfile();
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
        full_name: 'Monde User',
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
        set({ sessionId: data.user.id, isAuthenticated: true });
        await get().fetchProfile();
        await get().fetchTransactions();
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
        const provider = Providers.find((p) => p.id === profile.provider);
        if (provider) set({ selectedProvider: provider as Provider });
      }
    } catch (e) {
      console.error('Fetch profile error:', e);
    }
  },

  fetchTransactions: async () => {
    const sessionId = get().sessionId;
    if (!sessionId || !isSupabaseConfigured) return;
    try {
      const { data } = await api.getTransactions(sessionId);
      set({ transactions: data });
    } catch (e) {
      console.error('Fetch transactions error:', e);
    }
  },

  sendPayment: async (recipientPhone, recipientName, amount, method, note) => {
    const { user, sessionId } = get();
    if (!user) return { success: false, error: 'Not authenticated' };

    if (amount > user.balance) {
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
      };
      set((state) => ({
        transactions: [txn, ...state.transactions],
        user: state.user ? { ...state.user, balance: state.user.balance - amount } : null,
      }));
      return { success: true };
    }

    set({ isLoading: true });
    try {
      const result = await api.processPayment({
        senderId: sessionId,
        recipientPhone,
        amount,
        method,
        note,
      });
      if (!result.success) {
        return { success: false, error: result.error || 'Payment failed' };
      }
      // Refresh data from server
      await get().fetchProfile();
      await get().fetchTransactions();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Payment failed' };
    } finally {
      set({ isLoading: false });
    }
  },

  topUp: async (amount, provider, note) => {
    const { user, sessionId } = get();
    if (!user) return { success: false, error: 'Not authenticated' };

    if (!isSupabaseConfigured || !sessionId) {
      // Offline mock top-up
      const txn: Transaction = {
        id: Date.now().toString(),
        type: 'topup',
        amount,
        currency: 'ZMW',
        recipient_name: 'Monde Wallet',
        recipient_phone: user.phone,
        provider,
        status: 'completed',
        method: 'wallet',
        note: note || `Top up from ${provider}`,
        created_at: new Date().toISOString(),
      };
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
      });
      if (!result.success) {
        return { success: false, error: result.error || 'Top-up failed' };
      }
      await get().fetchProfile();
      await get().fetchTransactions();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Top-up failed' };
    } finally {
      set({ isLoading: false });
    }
  },

  withdraw: async (amount, provider, destinationPhone, note) => {
    const { user, sessionId } = get();
    if (!user) return { success: false, error: 'Not authenticated' };

    if (amount > user.balance) {
      return { success: false, error: 'Insufficient balance' };
    }

    if (!isSupabaseConfigured || !sessionId) {
      // Offline mock withdraw
      const txn: Transaction = {
        id: Date.now().toString(),
        type: 'withdraw',
        amount,
        currency: 'ZMW',
        recipient_name: provider,
        recipient_phone: destinationPhone || user.phone,
        provider,
        status: 'completed',
        method: 'wallet',
        note: note || `Withdraw to ${provider}`,
        created_at: new Date().toISOString(),
      };
      set((state) => ({
        transactions: [txn, ...state.transactions],
        user: state.user ? { ...state.user, balance: state.user.balance - amount } : null,
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
      });
      if (!result.success) {
        return { success: false, error: result.error || 'Withdrawal failed' };
      }
      await get().fetchProfile();
      await get().fetchTransactions();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Withdrawal failed' };
    } finally {
      set({ isLoading: false });
    }
  },

  updateProvider: async (providerId) => {
    const { user, sessionId } = get();
    if (!user) return { success: false, error: 'Not authenticated' };

    if (isSupabaseConfigured && sessionId) {
      try {
        const { error } = await api.updateProfile(sessionId, { provider: providerId });
        if (error) return { success: false, error: error as string };
      } catch (e: any) {
        return { success: false, error: e?.message || 'Update failed' };
      }
    }

    set({
      user: { ...user, provider: providerId },
      selectedProvider: Providers.find((p) => p.id === providerId) as Provider || get().selectedProvider,
    });
    return { success: true };
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

  addLinkedAccount: async (provider, accountName, accountPhone, isDefault) => {
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

  logout: async () => {
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
