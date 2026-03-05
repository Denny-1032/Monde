import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Alert, Platform, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { useStore } from '../store/useStore';
import { validateAmount } from '../lib/validation';
import NumPad from '../components/NumPad';
import Button from '../components/Button';
import { formatCurrency, calcPaymentFee } from '../lib/helpers';
import * as Haptics from 'expo-haptics';
import {
  isNfcSupported,
  isNfcEnabled,
  initNfc,
  cleanupNfc,
  writeNfcTag,
  readNfcTag,
  openNfcSettings,
  NfcPayload,
} from '../lib/nfc';

type TapMode = 'setup' | 'waiting' | 'processing' | 'success';
type NfcStatus = 'checking' | 'supported' | 'disabled' | 'unsupported';

export default function TapScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useStore((s) => s.user);
  const sendPayment = useStore((s) => s.sendPayment);
  const [mode, setMode] = useState<TapMode>('setup');
  const [amount, setAmount] = useState('');
  const [isSending, setIsSending] = useState(true);
  const [nfcStatus, setNfcStatus] = useState<NfcStatus>('checking');
  const [statusMsg, setStatusMsg] = useState('');
  const nfcActive = useRef(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  // Check NFC on mount
  useEffect(() => {
    checkNfc();
    return () => { cleanupNfc(); };
  }, []);

  const checkNfc = async () => {
    if (Platform.OS === 'web') {
      setNfcStatus('unsupported');
      return;
    }
    const supported = await isNfcSupported();
    if (!supported) {
      setNfcStatus('unsupported');
      return;
    }
    const enabled = await isNfcEnabled();
    if (!enabled) {
      setNfcStatus('disabled');
      return;
    }
    const started = await initNfc();
    setNfcStatus(started ? 'supported' : 'unsupported');
  };

  // Animations for waiting mode
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

      // Start NFC operation
      if (nfcStatus === 'supported') {
        nfcActive.current = true;
        if (isSending) {
          startNfcSend();
        } else {
          startNfcReceive();
        }
      } else {
        // Fallback: simulate for web/unsupported (demo)
        const timeout = setTimeout(() => simulateFallback(), 4000);
        return () => { pulse.stop(); ring.stop(); clearTimeout(timeout); };
      }

      return () => {
        pulse.stop();
        ring.stop();
        nfcActive.current = false;
        cleanupNfc();
      };
    }
  }, [mode]);

  // NFC Send: write payment data as NDEF so receiver can read it
  const startNfcSend = async () => {
    const parsedAmount = parseFloat(amount) || 0;
    setStatusMsg('Writing payment data...\nHold near receiver\'s phone');

    const payload: NfcPayload = {
      phone: user?.phone || '',
      name: user?.full_name || 'Unknown',
      amount: parsedAmount,
    };

    const result = await writeNfcTag(payload);
    if (!nfcActive.current) return;

    if (result.success) {
      setStatusMsg('Payment data sent! Waiting for confirmation...');
      // After writing, the sender's job is done. Process the payment.
      await processNfcPaymentAsSender(parsedAmount);
    } else {
      setStatusMsg('');
      Alert.alert('NFC Error', result.error || 'Could not write to NFC. Try again.');
      setMode('setup');
    }
  };

  // NFC Receive: read NDEF from sender's device
  const startNfcReceive = async () => {
    setStatusMsg('Scanning for sender...\nHold near sender\'s phone');

    const result = await readNfcTag();
    if (!nfcActive.current) return;

    if (result.payload) {
      setStatusMsg('Payment received! Processing...');
      setMode('processing');
      await processNfcPaymentAsReceiver(result.payload);
    } else {
      setStatusMsg('');
      Alert.alert('NFC Error', result.error || 'Could not read payment data. Try again.');
      setMode('setup');
    }
  };

  // Process payment as the sender (debit from sender's wallet)
  const processNfcPaymentAsSender = async (parsedAmount: number) => {
    setMode('processing');
    // The sender initiates the payment via the normal payment RPC
    // In NFC flow, we send to a placeholder — the server deducts from sender
    const result = await sendPayment('', 'NFC Recipient', parsedAmount, 'nfc');

    if (result.success) {
      setMode('success');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: '/success',
        params: {
          amount: parsedAmount.toString(),
          recipientName: 'NFC Recipient',
          type: 'send',
          method: 'nfc',
        },
      });
    } else {
      Alert.alert('Payment Failed', result.error || 'Transfer failed.');
      setMode('setup');
    }
  };

  // Process payment as receiver — sender's data was read via NFC
  const processNfcPaymentAsReceiver = async (payload: NfcPayload) => {
    const receivedAmount = payload.amount || parseFloat(amount) || 0;
    if (receivedAmount <= 0) {
      Alert.alert('Invalid Amount', 'No valid amount in the NFC tag.');
      setMode('setup');
      return;
    }

    // Navigate to payment confirmation with pre-filled data from NFC
    // The sender's phone initiated the RPC, so receiver sees the credit in real-time
    setMode('success');
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace({
      pathname: '/success',
      params: {
        amount: receivedAmount.toString(),
        recipientName: payload.name || 'NFC Sender',
        type: 'receive',
        method: 'nfc',
      },
    });
  };

  // Fallback simulation for web / unsupported devices
  const simulateFallback = async () => {
    const parsedAmount = parseFloat(amount) || 0;
    if (isSending) {
      const result = await sendPayment('', 'Nearby Device', parsedAmount, 'nfc');
      if (!result.success) {
        Alert.alert('Payment Failed', result.error || 'Transfer failed.');
        setMode('setup');
        return;
      }
    }
    setMode('success');
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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

  const cancelNfc = () => {
    nfcActive.current = false;
    cleanupNfc();
    setMode('setup');
    setStatusMsg('');
  };

  const startTap = () => {
    const parsedAmount = parseFloat(amount);
    if (isSending) {
      const check = validateAmount(parsedAmount, user?.balance || 0);
      if (!check.valid) {
        Alert.alert('Invalid Amount', check.error);
        return;
      }
      const fee = calcPaymentFee(parsedAmount);
      if ((parsedAmount + fee) > (user?.balance || 0)) {
        Alert.alert('Insufficient Balance', `You need ${formatCurrency(parsedAmount + fee)} (${formatCurrency(parsedAmount)} + ${formatCurrency(fee)} fee) but your balance is ${formatCurrency(user?.balance || 0)}.`);
        return;
      }
      setMode('waiting');
    } else {
      if (!parsedAmount || parsedAmount <= 0) {
        Alert.alert('Enter Amount', 'Please enter an amount first.');
        return;
      }
      setMode('waiting');
    }
  };

  const isWeb = Platform.OS === 'web';
  const nfcReady = nfcStatus === 'supported';

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => { cancelNfc(); router.back(); }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          Tap to Pay{' '}
          {!nfcReady && <Text style={[styles.demoBadge, { backgroundColor: isWeb ? colors.textLight : colors.warning }]}>{nfcStatus === 'checking' ? '...' : 'DEMO'}</Text>}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* NFC status banner */}
      {nfcStatus === 'disabled' && (
        <TouchableOpacity
          style={[styles.nfcBanner, { backgroundColor: colors.warning + '18' }]}
          onPress={openNfcSettings}
          activeOpacity={0.7}
        >
          <Ionicons name="warning" size={18} color={colors.warning} />
          <Text style={[styles.nfcBannerText, { color: colors.warning }]}>
            NFC is disabled. Tap here to enable it in Settings.
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.warning} />
        </TouchableOpacity>
      )}
      {nfcStatus === 'unsupported' && !isWeb && (
        <View style={[styles.nfcBanner, { backgroundColor: colors.error + '12' }]}>
          <Ionicons name="close-circle" size={18} color={colors.error} />
          <Text style={[styles.nfcBannerText, { color: colors.error }]}>
            NFC not available on this device. Using demo mode.
          </Text>
        </View>
      )}
      {nfcReady && mode === 'setup' && (
        <View style={[styles.nfcBanner, { backgroundColor: colors.success + '12' }]}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={[styles.nfcBannerText, { color: colors.success }]}>
            NFC ready — real contactless payments enabled
          </Text>
        </View>
      )}

      {mode === 'setup' ? (
        <View style={styles.setupContainer}>
          {/* Send/Receive Toggle */}
          <View style={[styles.toggleRow, { backgroundColor: colors.surfaceAlt }]}>
            <TouchableOpacity
              style={[styles.toggleBtn, isSending && { backgroundColor: colors.primary }]}
              onPress={() => setIsSending(true)}
            >
              <Ionicons name="arrow-up-circle" size={20} color={isSending ? colors.white : colors.textSecondary} />
              <Text style={[styles.toggleText, { color: isSending ? colors.white : colors.textSecondary }]}>Send</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, !isSending && { backgroundColor: colors.success }]}
              onPress={() => setIsSending(false)}
            >
              <Ionicons name="arrow-down-circle" size={20} color={!isSending ? colors.white : colors.textSecondary} />
              <Text style={[styles.toggleText, { color: !isSending ? colors.white : colors.textSecondary }]}>Receive</Text>
            </TouchableOpacity>
          </View>

          {/* Amount Display */}
          <Text style={[styles.amountDisplay, { color: colors.text }]}>K{amount || '0'}</Text>

          {/* Fee hint for sending */}
          {isSending && parseFloat(amount) > 0 && (
            <Text style={[styles.feeHint, { color: colors.textSecondary }]}>
              Fee: {formatCurrency(calcPaymentFee(parseFloat(amount)))} · Total: {formatCurrency(parseFloat(amount) + calcPaymentFee(parseFloat(amount)))}
            </Text>
          )}

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
      ) : mode === 'processing' ? (
        <View style={styles.waitingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.waitingTitle, { color: colors.text, marginTop: Spacing.lg }]}>
            Processing payment...
          </Text>
        </View>
      ) : (
        <View style={styles.waitingContainer}>
          <Animated.View style={[styles.tapCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Animated.View
              style={[
                styles.ring,
                { borderColor: colors.primary },
                {
                  opacity: ringAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.2, 0] }),
                  transform: [{ scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
                },
              ]}
            />
            <View style={[styles.tapInner, { backgroundColor: colors.primary }]}>
              <Ionicons name="wifi" size={48} color={colors.white} />
            </View>
          </Animated.View>
          <Text style={[styles.waitingTitle, { color: colors.text }]}>
            {isSending ? 'Hold near receiver\'s phone' : 'Waiting for sender...'}
          </Text>
          <Text style={[styles.waitingAmount, { color: colors.primary }]}>K{amount}</Text>
          {statusMsg ? (
            <Text style={[styles.statusMsg, { color: colors.textSecondary }]}>{statusMsg}</Text>
          ) : (
            <Text style={[styles.waitingHint, { color: colors.textSecondary }]}>Keep devices close until transfer completes</Text>
          )}
          <TouchableOpacity style={styles.cancelBtn} onPress={cancelNfc}>
            <Text style={[styles.cancelText, { color: colors.error }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  backBtn: { padding: 4 },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  nfcBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  nfcBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  setupContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
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
  toggleText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  amountDisplay: {
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  feeHint: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
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
  },
  tapInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waitingTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  waitingAmount: {
    fontSize: FontSize.hero,
    fontWeight: '800',
    marginTop: Spacing.sm,
  },
  waitingHint: {
    fontSize: FontSize.sm,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  statusMsg: {
    fontSize: FontSize.sm,
    marginTop: Spacing.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  cancelBtn: {
    marginTop: Spacing.xxl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  cancelText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  demoBadge: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
    borderRadius: 4,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
});
