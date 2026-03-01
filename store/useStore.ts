import { create } from 'zustand';
import { Transaction, UserProfile, Provider } from '../constants/types';
import { Providers } from '../constants/theme';

type AppState = {
  user: UserProfile | null;
  transactions: Transaction[];
  isAuthenticated: boolean;
  isLoading: boolean;
  selectedProvider: Provider | null;

  setUser: (user: UserProfile | null) => void;
  setTransactions: (transactions: Transaction[]) => void;
  addTransaction: (transaction: Transaction) => void;
  setAuthenticated: (value: boolean) => void;
  setLoading: (value: boolean) => void;
  setSelectedProvider: (provider: Provider | null) => void;
  updateBalance: (amount: number) => void;
  logout: () => void;
};

const MOCK_USER: UserProfile = {
  id: '1',
  phone: '+260971234567',
  full_name: 'Monde User',
  provider: 'airtel',
  balance: 2450.0,
  currency: 'ZMW',
  created_at: new Date().toISOString(),
};

const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: '1',
    type: 'send',
    amount: 150.0,
    currency: 'ZMW',
    recipient_name: 'Chanda Mwila',
    recipient_phone: '+260976543210',
    provider: 'airtel',
    status: 'completed',
    method: 'qr',
    note: 'Lunch',
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: '2',
    type: 'receive',
    amount: 500.0,
    currency: 'ZMW',
    recipient_name: 'Bwalya Mutale',
    recipient_phone: '+260965432109',
    provider: 'mtn',
    status: 'completed',
    method: 'nfc',
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: '3',
    type: 'payment',
    amount: 85.0,
    currency: 'ZMW',
    recipient_name: 'Shoprite Levy',
    recipient_phone: '',
    provider: 'airtel',
    status: 'completed',
    method: 'qr',
    note: 'Groceries',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: '4',
    type: 'receive',
    amount: 1200.0,
    currency: 'ZMW',
    recipient_name: 'Mulenga Kapwepwe',
    recipient_phone: '+260951234567',
    provider: 'zamtel',
    status: 'completed',
    method: 'qr',
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: '5',
    type: 'send',
    amount: 300.0,
    currency: 'ZMW',
    recipient_name: 'Temwani Phiri',
    recipient_phone: '+260977654321',
    provider: 'airtel',
    status: 'completed',
    method: 'nfc',
    note: 'Rent share',
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
];

export const useStore = create<AppState>((set) => ({
  user: MOCK_USER,
  transactions: MOCK_TRANSACTIONS,
  isAuthenticated: false,
  isLoading: false,
  selectedProvider: Providers[0] as Provider,

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
  logout: () => set({ user: null, isAuthenticated: false, transactions: [] }),
}));
