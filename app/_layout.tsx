import React, { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus, View, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/theme';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useStore } from '../store/useStore';
import LockScreen from '../components/LockScreen';
import OfflineBanner from '../components/OfflineBanner';

// Load Ionicons font for web
if (Platform.OS === 'web') {
  const link = document.createElement('link');
  link.href = 'https://unpkg.com/ionicons@7.1.0/dist/css/ionicons.min.css';
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}

const LOCK_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const clearSession = useStore((s) => s.clearSession);
  const initSession = useStore((s) => s.initSession);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Skip INITIAL_SESSION — splash screen handles boot via initSession()
      if (event === 'INITIAL_SESSION') return;

      // Use clearSession (not logout) to avoid calling signOut() again
      // which would fire another SIGNED_OUT event and create an infinite loop
      if (event === 'SIGNED_OUT' || !session) {
        clearSession();
        const inAuth = segments[0] === '(auth)';
        if (!inAuth) {
          router.replace('/(auth)/welcome');
        }
      } else if (event === 'SIGNED_IN' && session) {
        await initSession();
      }
    });

    return () => subscription.unsubscribe();
  }, []);
}

function useAutoLock() {
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const [locked, setLocked] = useState(false);
  const backgroundTime = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (!isAuthenticated) return;
      if (state === 'background' || state === 'inactive') {
        backgroundTime.current = Date.now();
      } else if (state === 'active' && backgroundTime.current) {
        const elapsed = Date.now() - backgroundTime.current;
        backgroundTime.current = null;
        if (elapsed >= LOCK_TIMEOUT_MS) {
          setLocked(true);
        }
      }
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  return { locked, unlock: () => setLocked(false) };
}

export default function RootLayout() {
  useProtectedRoute();
  const { locked, unlock } = useAutoLock();

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="payment" />
        <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="receive" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="tap" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="transaction" />
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="change-pin" />
        <Stack.Screen name="success" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
      <OfflineBanner />
      {locked ? <LockScreen onUnlock={unlock} /> : null}
    </View>
  );
}
