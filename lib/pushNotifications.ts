/**
 * Push Notifications Module (Expo Notifications)
 *
 * Setup:
 * 1. npx expo install expo-notifications expo-device expo-constants
 * 2. Configure push notification credentials in app.json/app.config.js
 * 3. For iOS: Enable push notifications in Apple Developer Portal
 * 4. For Android: Set up FCM in Firebase Console
 * 5. Store push tokens server-side for sending notifications
 */

import { Platform } from 'react-native';
// import * as Notifications from 'expo-notifications';
// import * as Device from 'expo-device';
// import Constants from 'expo-constants';

let expoPushToken: string | null = null;

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  // if (!Device.isDevice) {
  //   console.log('[Push] Must use physical device for push notifications');
  //   return null;
  // }

  // const { status: existingStatus } = await Notifications.getPermissionsAsync();
  // let finalStatus = existingStatus;

  // if (existingStatus !== 'granted') {
  //   const { status } = await Notifications.requestPermissionsAsync();
  //   finalStatus = status;
  // }

  // if (finalStatus !== 'granted') {
  //   console.log('[Push] Permission not granted');
  //   return null;
  // }

  // const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  // const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  // expoPushToken = token;

  // // Configure notification handler
  // Notifications.setNotificationHandler({
  //   handleNotification: async () => ({
  //     shouldShowAlert: true,
  //     shouldPlaySound: true,
  //     shouldSetBadge: true,
  //   }),
  // });

  // // Android channel
  // if (Platform.OS === 'android') {
  //   Notifications.setNotificationChannelAsync('default', {
  //     name: 'default',
  //     importance: Notifications.AndroidImportance.MAX,
  //     vibrationPattern: [0, 250, 250, 250],
  //     lightColor: '#0A6E3C',
  //   });
  // }

  if (__DEV__) console.log('[Push] Registered (placeholder)');
  return expoPushToken;
}

export function getExpoPushToken(): string | null {
  return expoPushToken;
}

export function addNotificationListener(
  _callback: (notification: any) => void
): () => void {
  // const subscription = Notifications.addNotificationReceivedListener(callback);
  // return () => subscription.remove();
  return () => {};
}

export function addNotificationResponseListener(
  _callback: (response: any) => void
): () => void {
  // const subscription = Notifications.addNotificationResponseReceivedListener(callback);
  // return () => subscription.remove();
  return () => {};
}
