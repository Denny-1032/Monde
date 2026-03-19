import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { useColors } from '../../constants/useColors';
import Button from '../../components/Button';

export default function WelcomeScreen() {
  const colors = useColors();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.hero}>
        <View style={styles.logoCircle}>
          <Text style={[styles.logoText, { color: colors.white }]}>M</Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Monde</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>The simplest way to send & receive money in Zambia</Text>

        <View style={styles.features}>
          <View style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: colors.primary + '12' }]}>
              <Ionicons name="qr-code" size={22} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>Scan QR Code</Text>
              <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>Point, scan, pay — in seconds</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: colors.primary + '12' }]}>
              <Ionicons name="swap-horizontal" size={22} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>Send & Receive</Text>
              <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>Transfer money instantly to anyone</Text>
            </View>
          </View>

          <View style={styles.featureRow}>
            <View style={[styles.featureIcon, { backgroundColor: colors.primary + '12' }]}>
              <Ionicons name="globe-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.featureText}>
              <Text style={[styles.featureTitle, { color: colors.text }]}>All Providers</Text>
              <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>Airtel, MTN, Zamtel, FNB & more</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actions}>
        <Button title="Get Started" onPress={() => router.push('/(auth)/register')} size="lg" />
        <Button
          title="I already have an account"
          onPress={() => router.push('/(auth)/login')}
          variant="ghost"
          size="md"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'space-between',
  },
  hero: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  logoText: {
    fontSize: 38,
    fontWeight: '800',
  },
  title: {
    fontSize: FontSize.hero,
    fontWeight: '800',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: FontSize.md,
    textAlign: 'center',
    marginTop: Spacing.sm,
    maxWidth: 260,
    lineHeight: 22,
  },
  features: {
    marginTop: Spacing.xxl,
    gap: Spacing.lg,
    width: '100%',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  featureDesc: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  actions: {
    gap: Spacing.sm,
  },
});
