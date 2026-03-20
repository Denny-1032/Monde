/**
 * Analytics Module (Mixpanel/Amplitude)
 *
 * Setup:
 * 1. npx expo install expo-application
 * 2. npm install mixpanel-react-native (or @amplitude/analytics-react-native)
 * 3. Set EXPO_PUBLIC_MIXPANEL_TOKEN in your .env
 * 4. Uncomment the imports and init below
 */

// import { Mixpanel } from 'mixpanel-react-native';

const MIXPANEL_TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN || '';

let isInitialized = false;
// let mixpanel: Mixpanel;

export function initAnalytics() {
  if (!MIXPANEL_TOKEN || isInitialized) return;

  // mixpanel = new Mixpanel(MIXPANEL_TOKEN, true);
  // mixpanel.init();

  isInitialized = true;
  if (__DEV__) console.log('[Analytics] Initialized (placeholder)');
}

export function trackEvent(event: string, properties?: Record<string, any>) {
  if (__DEV__) {
    console.log('[Analytics]', event, properties);
  }

  // if (isInitialized) {
  //   mixpanel.track(event, properties);
  // }
}

export function identifyUser(userId: string, traits?: Record<string, any>) {
  // if (isInitialized) {
  //   mixpanel.identify(userId);
  //   if (traits) {
  //     mixpanel.getPeople().set(traits);
  //   }
  // }
}

export function resetAnalytics() {
  // if (isInitialized) {
  //   mixpanel.reset();
  // }
}

// Pre-defined event names for consistency
export const AnalyticsEvents = {
  SIGN_UP: 'sign_up',
  LOGIN: 'login',
  LOGOUT: 'logout',
  SEND_PAYMENT: 'send_payment',
  RECEIVE_PAYMENT: 'receive_payment',
  TOP_UP: 'top_up',
  WITHDRAW: 'withdraw',
  SCAN_QR: 'scan_qr',
  TAP_TO_PAY: 'tap_to_pay',
  LINK_ACCOUNT: 'link_account',
  VERIFY_ACCOUNT: 'verify_account',
  CHANGE_PIN: 'change_pin',
  ENABLE_BIOMETRIC: 'enable_biometric',
  VIEW_TRANSACTION: 'view_transaction',
  SHARE_RECEIPT: 'share_receipt',
} as const;
