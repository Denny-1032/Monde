import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { formatCurrency } from '../lib/helpers';
import Button from '../components/Button';

export default function SuccessScreen() {
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
  const isNfc = params.method === 'nfc';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Animated.View style={[styles.checkCircle, { transform: [{ scale: scaleAnim }] }]}>
          <Ionicons name="checkmark" size={48} color={Colors.white} />
        </Animated.View>

        <Animated.View style={[styles.details, { opacity: fadeAnim }]}>
          <Text style={styles.title}>
            {isSend ? 'Money Sent!' : 'Money Received!'}
          </Text>
          <Text style={styles.amount}>
            {formatCurrency(parseFloat(params.amount || '0'))}
          </Text>
          <Text style={styles.recipient}>
            {isSend ? `to ${params.recipientName}` : `from ${params.recipientName}`}
          </Text>
          <View style={styles.methodBadge}>
            <Ionicons
              name={isNfc ? 'wifi-outline' : 'qr-code-outline'}
              size={14}
              color={Colors.primary}
            />
            <Text style={styles.methodText}>
              via {isNfc ? 'Tap to Pay' : 'QR Code'}
            </Text>
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
    backgroundColor: Colors.background,
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
    backgroundColor: Colors.success,
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
    color: Colors.text,
  },
  amount: {
    fontSize: FontSize.hero + 8,
    fontWeight: '800',
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  recipient: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  methodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary + '12',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.lg,
  },
  methodText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  actions: {
    gap: Spacing.md,
  },
});
