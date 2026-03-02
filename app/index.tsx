import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing } from '../constants/theme';
import { useStore } from '../store/useStore';
import * as SecureStore from 'expo-secure-store';

const ONBOARDING_KEY = 'monde_onboarding_complete';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, initSession } = useStore();
  const [ready, setReady] = useState(false);
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate splash
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();

    const bootstrap = async () => {
      try {
        await initSession();
      } catch (e) {
        console.error('Session init failed:', e);
      }
      setReady(true);
    };
    bootstrap();
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Ensure splash shows for at least 2 seconds total
    const timer = setTimeout(async () => {
      if (isAuthenticated) {
        router.replace('/(tabs)');
      } else {
        // Check if onboarding has been completed
        let onboarded = false;
        try {
          if (Platform.OS === 'web') {
            onboarded = localStorage.getItem(ONBOARDING_KEY) === 'true';
          } else {
            onboarded = (await SecureStore.getItemAsync(ONBOARDING_KEY)) === 'true';
          }
        } catch {}
        router.replace(onboarded ? '/(auth)/welcome' : ('/(auth)/onboarding' as any));
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [ready, isAuthenticated]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoContainer, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>M</Text>
        </View>
      </Animated.View>
      <Animated.View style={{ opacity: textOpacity, alignItems: 'center' }}>
        <Text style={styles.appName}>Monde</Text>
        <Text style={styles.tagline}>Pay. Tap. Done.</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.primary,
  },
  appName: {
    fontSize: FontSize.hero,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 2,
  },
  tagline: {
    fontSize: FontSize.md,
    color: Colors.white,
    opacity: 0.8,
    marginTop: Spacing.sm,
    letterSpacing: 1,
  },
});
