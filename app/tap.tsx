import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useStore } from '../store/useStore';
import { validateAmount } from '../lib/validation';
import NumPad from '../components/NumPad';
import Button from '../components/Button';
import PinConfirm from '../components/PinConfirm';
import { formatCurrency } from '../lib/helpers';
import * as Haptics from 'expo-haptics';

type TapMode = 'setup' | 'waiting' | 'success';

export default function TapScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useStore((s) => s.user);
  const sendPayment = useStore((s) => s.sendPayment);
  const addTransaction = useStore((s) => s.addTransaction);
  const updateBalance = useStore((s) => s.updateBalance);
  const [mode, setMode] = useState<TapMode>('setup');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(true);
  const [showPinConfirm, setShowPinConfirm] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mode === 'waiting') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      );
      const ring = Animated.loop(
        Animated.sequence([
          Animated.timing(ringAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
          Animated.timing(ringAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      );
      pulse.start();
      ring.start();

      const timeout = setTimeout(() => {
        simulatePayment();
      }, 4000);

      return () => {
        pulse.stop();
        ring.stop();
        clearTimeout(timeout);
      };
    }
  }, [mode]);

  const simulatePayment = async () => {
    const parsedAmount = parseFloat(amount) || 100;

    if (isSending) {
      const result = await sendPayment('', 'Nearby Device', parsedAmount, 'nfc');
      if (!result.success) {
        Alert.alert('Payment Failed', result.error || 'Transfer failed.');
        setMode('setup');
        return;
      }
    } else {
      // Receive mode — local only (simulated incoming)
      addTransaction({
        id: Date.now().toString(),
        type: 'receive',
        amount: parsedAmount,
        currency: 'ZMW',
        recipient_name: 'Nearby Device',
        recipient_phone: '',
        provider: user?.provider || 'airtel',
        status: 'completed',
        method: 'nfc',
        created_at: new Date().toISOString(),
      });
      updateBalance(parsedAmount);
    }

    setMode('success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({
      pathname: '/success',
      params: {
        amount: parsedAmount.toString(),
        recipientName: 'Nearby Device',
        type: isSending ? 'send' : 'receive',
        method: 'nfc',
      },
    });
  };

  const handleKeyPress = (key: string) => {
    if (key === '.' && amount.includes('.')) return;
    if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return;
    if (amount.length >= 10) return;
    setAmount((prev) => prev + key);
  };

  const handleDelete = () => setAmount((prev) => prev.slice(0, -1));

  const startTap = () => {
    const parsedAmount = parseFloat(amount);
    if (isSending) {
      const check = validateAmount(parsedAmount, user?.balance || 0);
      if (!check.valid) {
        Alert.alert('Invalid Amount', check.error);
        return;
      }
      // Require PIN for sending
      setPinError('');
      setShowPinConfirm(true);
    } else {
      if (!parsedAmount || parsedAmount <= 0) {
        Alert.alert('Enter Amount', 'Please enter an amount first.');
        return;
      }
      setMode('waiting');
    }
  };

  const handlePinConfirmTap = async (pin: string) => {
    const signIn = useStore.getState().signIn;
    setPinLoading(true);
    const authResult = await signIn(user?.phone || '', pin);
    setPinLoading(false);
    if (!authResult.success) {
      setPinError('Incorrect PIN. Try again.');
      return;
    }
    setShowPinConfirm(false);
    setMode('waiting');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Tap to Pay</Text>
        <View style={{ width: 32 }} />
      </View>

      {mode === 'setup' ? (
        <View style={styles.setupContainer}>
          {/* Send/Receive Toggle */}
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, isSending && styles.toggleActive]}
              onPress={() => setIsSending(true)}
            >
              <Ionicons name="arrow-up-circle" size={20} color={isSending ? Colors.white : Colors.textSecondary} />
              <Text style={[styles.toggleText, isSending && styles.toggleTextActive]}>Send</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, !isSending && styles.toggleActiveReceive]}
              onPress={() => setIsSending(false)}
            >
              <Ionicons name="arrow-down-circle" size={20} color={!isSending ? Colors.white : Colors.textSecondary} />
              <Text style={[styles.toggleText, !isSending && styles.toggleTextActive]}>Receive</Text>
            </TouchableOpacity>
          </View>

          {/* Amount Display */}
          <Text style={styles.amountDisplay}>K{amount || '0'}</Text>

          {/* NumPad */}
          <NumPad onPress={handleKeyPress} onDelete={handleDelete} />

          {/* Start Button */}
          <View style={styles.startBtnContainer}>
            <Button
              title={isSending ? 'Ready to Send' : 'Ready to Receive'}
              onPress={startTap}
              size="lg"
              variant={isSending ? 'primary' : 'secondary'}
            />
          </View>
        </View>
      ) : (
        <View style={styles.waitingContainer}>
          <Animated.View style={[styles.tapCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Animated.View
              style={[
                styles.ring,
                {
                  opacity: ringAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.2, 0] }),
                  transform: [{ scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
                },
              ]}
            />
            <View style={styles.tapInner}>
              <Ionicons name="wifi" size={48} color={Colors.white} />
            </View>
          </Animated.View>
          <Text style={styles.waitingTitle}>
            {isSending ? 'Hold near receiver\'s phone' : 'Waiting for sender...'}
          </Text>
          <Text style={styles.waitingAmount}>K{amount}</Text>
          <Text style={styles.waitingHint}>Keep devices close until transfer completes</Text>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setMode('setup')}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <PinConfirm
        visible={showPinConfirm}
        title="Authorize Payment"
        subtitle={`Send ${formatCurrency(parseFloat(amount) || 0)} via Tap to Pay`}
        onConfirm={handlePinConfirmTap}
        onCancel={() => { setShowPinConfirm(false); setPinError(''); }}
        loading={pinLoading}
        error={pinError}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  backBtn: { padding: 4 },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: BorderRadius.full,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md - 4,
    borderRadius: BorderRadius.full,
    gap: Spacing.sm,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleActiveReceive: {
    backgroundColor: Colors.success,
  },
  toggleText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  toggleTextActive: {
    color: Colors.white,
  },
  amountDisplay: {
    fontSize: 48,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  startBtnContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  waitingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  tapCircle: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  ring: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  tapInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  waitingAmount: {
    fontSize: FontSize.hero,
    fontWeight: '800',
    color: Colors.primary,
    marginTop: Spacing.sm,
  },
  waitingHint: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: Spacing.xxl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  cancelText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.error,
  },
});
