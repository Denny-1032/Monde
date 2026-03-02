import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { formatCurrency } from '../lib/helpers';
import Button from '../components/Button';

export default function SuccessScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{
    amount: string;
    recipientName: string;
    type: string;
    method: string;
  }>();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 6, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();

    // Auto-return to home after 4 seconds
    const autoReturn = setTimeout(() => {
      router.replace('/(tabs)');
    }, 4000);
    return () => clearTimeout(autoReturn);
  }, []);

  const isSend = params.type === 'send';
  const isTopUp = params.type === 'topup';
  const isWithdraw = params.type === 'withdraw';
  const isNfc = params.method === 'nfc';
  const isWallet = params.method === 'wallet';

  const getTitle = () => {
    if (isTopUp) return 'Wallet Topped Up!';
    if (isWithdraw) return 'Withdrawal Complete!';
    if (isSend) return 'Money Sent!';
    return 'Money Received!';
  };

  const getSubtitle = () => {
    if (isTopUp) return `from ${params.recipientName}`;
    if (isWithdraw) return `to ${params.recipientName}`;
    if (isSend) return `to ${params.recipientName}`;
    return `from ${params.recipientName}`;
  };

  const getMethodLabel = () => {
    if (isWallet) return 'Wallet Transfer';
    if (isNfc) return 'Tap to Pay';
    return 'QR Code';
  };

  const getMethodIcon = (): any => {
    if (isWallet) return 'wallet-outline';
    if (isNfc) return 'wifi-outline';
    return 'qr-code-outline';
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }], backgroundColor: colors.success }]}>
          <Ionicons name="checkmark" size={48} color={colors.white} />
        </Animated.View>

        <Animated.View style={[styles.details, { opacity: fadeAnim }]}>
          <Text style={[styles.title, { color: colors.text }]}>{getTitle()}</Text>
          <Text style={[styles.amount, { color: colors.text }]}>
            {formatCurrency(parseFloat(params.amount || '0'))}
          </Text>
          <Text style={[styles.recipient, { color: colors.textSecondary }]}>{getSubtitle()}</Text>
          <View style={[styles.methodBadge, { backgroundColor: colors.primary + '12' }]}>
            <Ionicons name={getMethodIcon()} size={14} color={colors.primary} />
            <Text style={[styles.methodText, { color: colors.primary }]}>via {getMethodLabel()}</Text>
          </View>
        </Animated.View>
      </View>

      <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
        <Button title="Back to Home" onPress={() => router.replace('/(tabs)')} size="lg" />
        <Button title="New Transaction" onPress={() => router.replace('/payment')} variant="outline" size="md" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 120,
    paddingBottom: 50,
    paddingHorizontal: Spacing.lg,
  },
  content: {
    alignItems: 'center',
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  details: {
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  amount: {
    fontSize: FontSize.hero + 8,
    fontWeight: '800',
    marginTop: Spacing.sm,
  },
  recipient: {
    fontSize: FontSize.md,
    marginTop: Spacing.sm,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
  },
  methodText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  actions: {
    gap: Spacing.md,
  },
});
