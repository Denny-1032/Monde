export type ColorScheme = typeof Colors;

export const Colors = {
  primary: '#0A6E3C',
  primaryLight: '#0E8C4D',
  primaryDark: '#065A30',
  secondary: '#F58220',
  secondaryLight: '#FFB366',
  accent: '#C5792A',
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F2F5',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.5)',
};

export const DarkColors: ColorScheme = {
  primary: '#10B865',
  primaryLight: '#15D477',
  primaryDark: '#0A8C4A',
  secondary: '#F58220',
  secondaryLight: '#FFB366',
  accent: '#D4923A',
  background: '#0F1117',
  surface: '#1A1D27',
  surfaceAlt: '#242832',
  text: '#F0F2F5',
  textSecondary: '#9CA3AF',
  textLight: '#6B7280',
  border: '#2D3140',
  borderLight: '#1F2230',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.7)',
};

export const Providers = [
  { id: 'monde', name: 'Monde Wallet', color: '#6C63FF', prefix: '' },
  { id: 'airtel', name: 'Airtel Money', color: '#ED1C24', prefix: '097' },
  { id: 'mtn', name: 'MTN MoMo', color: '#FFCB05', prefix: '096' },
  { id: 'zamtel', name: 'Zamtel Kwacha', color: '#00A650', prefix: '095' },
  { id: 'fnb', name: 'FNB Zambia', color: '#009FDA', prefix: '' },
  { id: 'zanaco', name: 'Zanaco', color: '#003B71', prefix: '' },
  { id: 'absa', name: 'Absa Bank', color: '#AF1832', prefix: '' },
];

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 22,
  xxl: 28,
  hero: 36,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};
