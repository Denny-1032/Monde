import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing } from '../constants/theme';
import { useStore } from '../store/useStore';

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, initSession } = useStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
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
    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/welcome');
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [ready, isAuthenticated]);

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>M</Text>
        </View>
        <Text style={styles.appName}>Monde</Text>
        <Text style={styles.tagline}>Pay. Tap. Done.</Text>
      </View>
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
