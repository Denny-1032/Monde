/**
 * Error Tracking Module (Sentry)
 *
 * Setup:
 * 1. npx expo install @sentry/react-native
 * 2. Create a project at https://sentry.io
 * 3. Set EXPO_PUBLIC_SENTRY_DSN in your .env
 * 4. Uncomment the Sentry imports and init below
 */

// import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN || '';

let isInitialized = false;

export function initErrorTracking() {
  if (!SENTRY_DSN || isInitialized) return;

  // Sentry.init({
  //   dsn: SENTRY_DSN,
  //   tracesSampleRate: 0.2,
  //   environment: __DEV__ ? 'development' : 'production',
  //   enableAutoSessionTracking: true,
  //   debug: __DEV__,
  // });

  isInitialized = true;
  if (__DEV__) console.log('[ErrorTracking] Sentry initialized (placeholder)');
}

export function captureException(error: Error, context?: Record<string, any>) {
  if (__DEV__) {
    console.error('[ErrorTracking]', error, context);
  }

  // if (isInitialized) {
  //   Sentry.captureException(error, { extra: context });
  // }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (__DEV__) {
    console.log(`[ErrorTracking] [${level}]`, message);
  }

  // if (isInitialized) {
  //   Sentry.captureMessage(message, level);
  // }
}

export function setUser(userId: string, phone?: string) {
  // if (isInitialized) {
  //   Sentry.setUser({ id: userId, phone });
  // }
}

export function clearUser() {
  // if (isInitialized) {
  //   Sentry.setUser(null);
  // }
}
