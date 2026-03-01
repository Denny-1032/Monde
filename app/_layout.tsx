import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Colors } from '../constants/theme';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useStore } from '../store/useStore';

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const isAuthenticated = useStore((s) => s.isAuthenticated);
  const { initSession, setAuthenticated, logout: storeLogout } = useStore();

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        storeLogout();
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

export default function RootLayout() {
  useProtectedRoute();

  return (
    <>
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
        <Stack.Screen name="success" options={{ animation: 'fade', gestureEnabled: false }} />
      </Stack>
    </>
  );
}
