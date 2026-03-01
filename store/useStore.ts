import { create } from 'zustand';
import { Transaction, UserProfile, Provider } from '../constants/types';
import { Providers } from '../constants/theme';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import * as api from '../lib/api';

type AppState = {
  user: UserProfile | null;
  transactions: Transaction[];
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
  initSession: () => Promise<void>;
  signUp: (phone: string, password: string, fullName: string, provider: string) => Promise<{ success: boolean; error?: string }>;
  signIn: (phone: string, password: string) => Promise<{ success: boolean; error?: string }>;
  fetchProfile: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  sendPayment: (recipientPhone: string, recipientName: string, amount: number, method: 'qr' | 'nfc' | 'manual', note?: string) => Promise<{ success: boolean; error?: string }>;
  updateProvider: (providerId: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
};

export const useStore = create<AppState>((set, get) => ({
  user: null,
  transactions: [],
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
        if (txns.length > 0) set({ transactions: txns });
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
      if (data.length > 0) set({ transactions: data });
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

  logout: async () => {
    if (isSupabaseConfigured) {
      await api.signOut();
    }
    set({
      user: null,
      isAuthenticated: false,
      transactions: [],
      sessionId: null,
      error: null,
    });
  },
}));
