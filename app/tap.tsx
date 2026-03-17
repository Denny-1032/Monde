import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Alert, Platform, ActivityIndicator, TextInput, ScrollView } from 'react-native';
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
// TODO: NFC tap-to-pay API functions (WIP feature)
const createPaymentRequest = async (_a: any): Promise<any> => ({ success: false, error: 'Not implemented' });
const lookupPaymentRequest = async (_a: any): Promise<any> => ({ success: false, error: 'Not implemented' });
const completePaymentRequest = async (_a: any, _b?: any): Promise<{ success: boolean; error?: string }> => ({ success: false, error: 'Not implemented' });

type Role = 'choose' | 'receive' | 'send';
type ReceiveStep = 'amount' | 'waiting';
type SendStep = 'code' | 'confirm' | 'processing';

export default function TapScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useStore((s) => s.user);
  const sendPayment = useStore((s) => s.sendPayment);

  // Role selection
  const [role, setRole] = useState<Role>('choose');

  // ── Receiver state ──
  const [amount, setAmount] = useState('');
  const [receiveStep, setReceiveStep] = useState<ReceiveStep>('amount');
  const [payCode, setPayCode] = useState('');
  const [requestId, setRequestId] = useState('');
  const [creatingRequest, setCreatingRequest] = useState(false);

  // ── Sender state ──
  const [sendStep, setSendStep] = useState<SendStep>('code');
  const [codeInput, setCodeInput] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<{ request_id: string; amount: number; phone: string; name: string; handle?: string } | null>(null);
  const [payLoading, setPayLoading] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (receiveStep === 'waiting') {
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
      return () => { pulse.stop(); ring.stop(); };
    }
  }, [receiveStep]);

  // ── Receiver: create payment request ──
  const handleCreateRequest = async () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('Enter Amount', 'Please enter an amount to request.');
      return;
    }
    if (parsedAmount < 1) {
      Alert.alert('Too Small', 'Minimum request is K1.');
      return;
    }
    setCreatingRequest(true);
    const result = await createPaymentRequest(parsedAmount);
    setCreatingRequest(false);
    if (result.success && result.code) {
      setPayCode(result.code);
      setRequestId(result.request_id || '');
      setReceiveStep('waiting');
    } else {
      Alert.alert('Error', result.error || 'Could not create payment request.');
    }
  };

  // ── Sender: lookup code ──
  const handleLookupCode = async () => {
    const code = codeInput.trim();
    if (code.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter the 6-digit code from the receiver.');
      return;
    }
    setLookupLoading(true);
    const result = await lookupPaymentRequest(code);
    setLookupLoading(false);
    if (result.success && result.amount && result.phone && result.name) {
      setPaymentDetails({
        request_id: result.request_id || '',
        amount: result.amount,
        phone: result.phone,
        name: result.name,
        handle: result.handle,
      });
      setSendStep('confirm');
    } else {
      Alert.alert('Not Found', result.error || 'Invalid or expired code.');
    }
  };

  // ── Sender: confirm and pay ──
  const handleConfirmPay = async () => {
    if (!paymentDetails) return;
    const fee = calcPaymentFee(paymentDetails.amount);
    if ((paymentDetails.amount + fee) > (user?.balance || 0)) {
      Alert.alert('Insufficient Balance', `You need ${formatCurrency(paymentDetails.amount + fee)} (${formatCurrency(paymentDetails.amount)} + ${formatCurrency(fee)} fee) but your balance is ${formatCurrency(user?.balance || 0)}.`);
      return;
    }
    setPayLoading(true);
    setSendStep('processing');
    const result = await sendPayment(paymentDetails.phone, paymentDetails.name, paymentDetails.amount, 'nfc');
    if (result.success) {
      // Mark request as completed
      if (paymentDetails.request_id) {
        await completePaymentRequest(paymentDetails.request_id).catch(() => {});
      }
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace({
        pathname: '/success',
        params: {
          amount: paymentDetails.amount.toString(),
          recipientName: paymentDetails.name,
          type: 'send',
          method: 'nfc',
        },
      });
    } else {
      Alert.alert('Payment Failed', result.error || 'Transfer failed.');
      setSendStep('confirm');
      setPayLoading(false);
    }
  };

  // ── Numpad handlers ──
  const handleKeyPress = (key: string) => {
    if (key === '.' && amount.includes('.')) return;
    if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return;
    if (amount.length >= 10) return;
    setAmount((prev) => prev + key);
  };
  const handleDelete = () => setAmount((prev) => prev.slice(0, -1));

  const goBack = () => {
    if (role === 'choose') {
      router.back();
    } else if (role === 'receive' && receiveStep === 'waiting') {
      setReceiveStep('amount');
      setPayCode('');
    } else if (role === 'send' && sendStep === 'confirm') {
      setSendStep('code');
      setPaymentDetails(null);
    } else {
      setRole('choose');
      setAmount('');
      setCodeInput('');
      setReceiveStep('amount');
      setSendStep('code');
      setPayCode('');
      setPaymentDetails(null);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          {role === 'choose' ? 'Tap to Pay' : role === 'receive' ? 'Request Payment' : 'Send Payment'}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      {/* ══════════ ROLE CHOOSER ══════════ */}
      {role === 'choose' && (
        <View style={styles.chooseContainer}>
          <View style={[styles.chooseIcon, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="swap-vertical" size={56} color={colors.primary} />
          </View>
          <Text style={[styles.chooseTitle, { color: colors.text }]}>What would you like to do?</Text>
          <Text style={[styles.chooseHint, { color: colors.textSecondary }]}>
            The receiver enters the amount and shares a code with the sender.
          </Text>

          <TouchableOpacity
            style={[styles.roleCard, { backgroundColor: colors.success + '12', borderColor: colors.success + '30' }]}
            onPress={() => setRole('receive')}
            activeOpacity={0.7}
          >
            <View style={[styles.roleIconCircle, { backgroundColor: colors.success }]}>
              <Ionicons name="arrow-down-circle" size={28} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleTitle, { color: colors.text }]}>Receive Money</Text>
              <Text style={[styles.roleDesc, { color: colors.textSecondary }]}>Set an amount and get a pay code</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.roleCard, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}
            onPress={() => setRole('send')}
            activeOpacity={0.7}
          >
            <View style={[styles.roleIconCircle, { backgroundColor: colors.primary }]}>
              <Ionicons name="arrow-up-circle" size={28} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleTitle, { color: colors.text }]}>Send Money</Text>
              <Text style={[styles.roleDesc, { color: colors.textSecondary }]}>Enter the receiver's pay code</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textLight} />
          </TouchableOpacity>
        </View>
      )}

      {/* ══════════ RECEIVER: ENTER AMOUNT ══════════ */}
      {role === 'receive' && receiveStep === 'amount' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={[styles.amountDisplay, { color: colors.text }]}>K{amount || '0'}</Text>
          <Text style={[styles.receiveHint, { color: colors.textSecondary }]}>
            Enter the amount you want to receive
          </Text>
          <NumPad onPress={handleKeyPress} onDelete={handleDelete} showDecimal={true} />
          <View style={styles.startBtnContainer}>
            <Button
              title={creatingRequest ? 'Creating...' : 'Get Pay Code'}
              onPress={handleCreateRequest}
              size="lg"
              variant="secondary"
              disabled={creatingRequest || !(parseFloat(amount) > 0)}
            />
          </View>
        </ScrollView>
      )}

      {/* ══════════ RECEIVER: WAITING WITH CODE ══════════ */}
      {role === 'receive' && receiveStep === 'waiting' && (
        <View style={styles.waitingContainer}>
          <Animated.View style={[styles.tapCircle, { transform: [{ scale: pulseAnim }] }]}>
            <Animated.View
              style={[
                styles.ring,
                { borderColor: colors.success },
                {
                  opacity: ringAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.6, 0.2, 0] }),
                  transform: [{ scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2] }) }],
                },
              ]}
            />
            <View style={[styles.tapInner, { backgroundColor: colors.success }]}>
              <Ionicons name="arrow-down-circle" size={48} color={colors.white} />
            </View>
          </Animated.View>

          <Text style={[styles.waitingTitle, { color: colors.text }]}>Share this code</Text>
          <Text style={[styles.waitingAmount, { color: colors.success }]}>K{amount}</Text>

          {/* Big code display */}
          <View style={[styles.codeDisplay, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.codeText, { color: colors.primary }]}>
              {payCode.split('').join(' ')}
            </Text>
          </View>
          <Text style={[styles.codeHint, { color: colors.textSecondary }]}>
            Tell the sender to enter this code in their Monde app
          </Text>

          <TouchableOpacity style={styles.cancelBtn} onPress={goBack}>
            <Text style={[styles.cancelText, { color: colors.error }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ══════════ SENDER: ENTER CODE ══════════ */}
      {role === 'send' && sendStep === 'code' && (
        <View style={styles.sendCodeContainer}>
          <View style={[styles.sendIcon, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="keypad" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.sendTitle, { color: colors.text }]}>Enter Pay Code</Text>
          <Text style={[styles.sendHint, { color: colors.textSecondary }]}>
            Ask the receiver for their 6-digit pay code
          </Text>

          <TextInput
            style={[styles.codeInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            value={codeInput}
            onChangeText={(t) => setCodeInput(t.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={colors.textLight}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
            autoFocus
          />

          <View style={styles.startBtnContainer}>
            <Button
              title={lookupLoading ? 'Looking up...' : 'Continue'}
              onPress={handleLookupCode}
              size="lg"
              disabled={codeInput.length !== 6 || lookupLoading}
            />
          </View>
        </View>
      )}

      {/* ══════════ SENDER: CONFIRM PAYMENT ══════════ */}
      {role === 'send' && sendStep === 'confirm' && paymentDetails && (
        <View style={styles.confirmContainer}>
          <View style={[styles.confirmCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.confirmIconCircle, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="person" size={32} color={colors.primary} />
            </View>
            <Text style={[styles.confirmName, { color: colors.text }]}>{paymentDetails.name}</Text>
            {paymentDetails.handle && (
              <Text style={[styles.confirmHandle, { color: colors.textSecondary }]}>@{paymentDetails.handle}</Text>
            )}
            <View style={[styles.confirmDivider, { backgroundColor: colors.border }]} />
            <Text style={[styles.confirmAmountLabel, { color: colors.textSecondary }]}>Amount</Text>
            <Text style={[styles.confirmAmount, { color: colors.primary }]}>{formatCurrency(paymentDetails.amount)}</Text>
            <View style={styles.confirmFeeRow}>
              <Text style={[styles.confirmFeeLabel, { color: colors.textSecondary }]}>Fee (3%)</Text>
              <Text style={[styles.confirmFeeValue, { color: colors.textSecondary }]}>{formatCurrency(calcPaymentFee(paymentDetails.amount))}</Text>
            </View>
            <View style={styles.confirmFeeRow}>
              <Text style={[styles.confirmFeeLabel, { color: colors.text, fontWeight: '600' }]}>Total</Text>
              <Text style={[styles.confirmFeeValue, { color: colors.text, fontWeight: '700' }]}>{formatCurrency(paymentDetails.amount + calcPaymentFee(paymentDetails.amount))}</Text>
            </View>
          </View>

          <View style={styles.startBtnContainer}>
            <Button
              title={payLoading ? 'Sending...' : `Pay ${formatCurrency(paymentDetails.amount)}`}
              onPress={handleConfirmPay}
              size="lg"
              disabled={payLoading}
            />
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={goBack}>
            <Text style={[styles.cancelText, { color: colors.error }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ══════════ SENDER: PROCESSING ══════════ */}
      {role === 'send' && sendStep === 'processing' && (
        <View style={styles.waitingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.waitingTitle, { color: colors.text, marginTop: Spacing.lg }]}>
            Processing payment...
          </Text>
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

  // ── Role chooser ──
  chooseContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  chooseIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  chooseTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  chooseHint: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 20,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    width: '100%',
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  roleIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  roleDesc: {
    fontSize: FontSize.sm,
  },

  // ── Receiver ──
  amountDisplay: {
    fontSize: 48,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  receiveHint: {
    textAlign: 'center',
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  startBtnContainer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },

  // ── Waiting / Code display ──
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
  codeDisplay: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
  },
  codeText: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
  },
  codeHint: {
    fontSize: FontSize.sm,
    marginTop: Spacing.md,
    textAlign: 'center',
    lineHeight: 20,
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

  // ── Sender: code entry ──
  sendCodeContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  sendIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  sendTitle: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    marginBottom: Spacing.sm,
  },
  sendHint: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  codeInput: {
    width: '80%',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 10,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    marginBottom: Spacing.lg,
  },

  // ── Sender: confirm card ──
  confirmContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    alignItems: 'center',
  },
  confirmCard: {
    width: '100%',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  confirmIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  confirmName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  confirmHandle: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  confirmDivider: {
    width: '100%',
    height: 1,
    marginVertical: Spacing.lg,
  },
  confirmAmountLabel: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  confirmAmount: {
    fontSize: 36,
    fontWeight: '800',
    marginBottom: Spacing.md,
  },
  confirmFeeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: Spacing.xs,
  },
  confirmFeeLabel: {
    fontSize: FontSize.sm,
  },
  confirmFeeValue: {
    fontSize: FontSize.sm,
  },
});
