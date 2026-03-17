import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { useStore } from '../store/useStore';
import { generateQRData, formatCurrency, calcGetCashFee } from '../lib/helpers';
import { createCashOutRequest, cancelCashOutRequest } from '../lib/api';
import { CashOutQRPayload } from '../constants/types';
import NumPad from '../components/NumPad';

type Step = 'amount' | 'code';

export default function GetCashScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useStore((s) => s.user);
  const fetchProfile = useStore((s) => s.fetchProfile);

  // Agents cannot use Get Cash — they ARE the cash point
  useEffect(() => {
    if (user?.is_agent) {
      Alert.alert('Agent Account', 'Agents cannot use Get Cash. You are the cash point — customers come to you.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }, [user?.is_agent]);

  // Frozen accounts cannot transact
  useEffect(() => {
    if (user?.is_frozen) {
      Alert.alert('Account Frozen', 'Your account has been frozen. Contact support.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }
  }, [user?.is_frozen]);

  const [step, setStep] = useState<Step>('amount');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cash-out request state
  const [requestId, setRequestId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [fee, setFee] = useState(0);
  const [total, setTotal] = useState(0);

  // Countdown timer
  const [secondsLeft, setSecondsLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const parsedAmount = parseFloat(amount) || 0;
  const feeInfo = calcGetCashFee(parsedAmount);
  const balance = user?.balance || 0;
  const canAfford = parsedAmount > 0 && parsedAmount + feeInfo.totalFee <= balance;
  const validAmount = parsedAmount >= 1 && parsedAmount <= 5000;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (secondsLeft <= 0 && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      if (step === 'code') {
        setStep('amount');
        setToken(null);
        setRequestId(null);
        setError('Request expired. Please try again.');
      }
    }
  }, [secondsLeft, step]);

  const handleKeyPress = (key: string) => {
    if (key === '.' && amount.includes('.')) return;
    if (amount.includes('.') && amount.split('.')[1]?.length >= 2) return;
    if (amount.length >= 7) return;
    setAmount((prev) => prev + key);
    setError(null);
  };

  const handleDelete = () => {
    setAmount((prev) => prev.slice(0, -1));
    setError(null);
  };

  const handleGenerate = async () => {
    if (!validAmount || !canAfford) return;
    setIsLoading(true);
    setError(null);

    const result = await createCashOutRequest(parsedAmount);

    if (!result.success) {
      setError(result.error || 'Failed to create request');
      setIsLoading(false);
      return;
    }

    setRequestId(result.request_id || null);
    setToken(result.token || null);
    setFee(result.fee || 0);
    setTotal(result.total || 0);
    setStep('code');
    setIsLoading(false);

    // Start 15 min countdown
    setSecondsLeft(15 * 60);
    timerRef.current = setInterval(() => {
      setSecondsLeft((prev) => Math.max(prev - 1, 0));
    }, 1000);
  };

  const handleCancel = async () => {
    if (requestId) {
      await cancelCashOutRequest(requestId);
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setStep('amount');
    setToken(null);
    setRequestId(null);
    setAmount('');
    setFee(0);
    setTotal(0);
    setSecondsLeft(0);
  };

  const handleBack = () => {
    if (step === 'code') {
      Alert.alert('Cancel Request?', 'This will cancel your Get Cash request.', [
        { text: 'Keep Waiting', style: 'cancel' },
        { text: 'Cancel', style: 'destructive', onPress: handleCancel },
      ]);
    } else {
      router.back();
    }
  };

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const qrPayload: CashOutQRPayload | null = token ? {
    app: 'monde',
    v: 1,
    type: 'cashout',
    token,
    phone: user?.phone || '',
    name: user?.full_name || '',
    amount: parsedAmount,
  } : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Get Cash</Text>
        <View style={{ width: 28 }} />
      </View>

      {step === 'amount' ? (
        <View style={styles.amountSection}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
            How much cash do you need?
          </Text>
          <Text style={[styles.amountDisplay, { color: colors.text }]}>
            K{amount || '0'}
          </Text>

          {/* Fee preview */}
          {parsedAmount > 0 && (
            <View style={[styles.feeRow, { backgroundColor: colors.surface }]}>
              <View style={styles.feeItem}>
                <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>Fee</Text>
                <Text style={[styles.feeValue, { color: colors.text }]}>
                  {formatCurrency(feeInfo.totalFee)}
                </Text>
              </View>
              <View style={[styles.feeDivider, { backgroundColor: colors.border }]} />
              <View style={styles.feeItem}>
                <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>Total</Text>
                <Text style={[styles.feeValue, { color: colors.text, fontWeight: '800' }]}>
                  {formatCurrency(parsedAmount + feeInfo.totalFee)}
                </Text>
              </View>
            </View>
          )}

          {/* Balance */}
          <Text style={[styles.balanceText, { color: parsedAmount > 0 && !canAfford ? colors.error : colors.textSecondary }]}>
            Balance: {formatCurrency(balance)}
          </Text>

          {error && (
            <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
          )}

          <NumPad onPress={handleKeyPress} onDelete={handleDelete} />

          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={[
                styles.generateBtn,
                { backgroundColor: validAmount && canAfford ? colors.primary : colors.border },
              ]}
              onPress={handleGenerate}
              disabled={!validAmount || !canAfford || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={[styles.generateBtnText, { color: colors.white }]}>
                  Generate Code
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.codeSection}>
          {/* QR Code */}
          <View style={[styles.qrCard, { backgroundColor: colors.surface }]}>
            {qrPayload && (
              <View style={styles.qrWrapper}>
                <QRCode
                  value={generateQRData(qrPayload)}
                  size={180}
                  color={Colors.text}
                  backgroundColor={Colors.white}
                />
              </View>
            )}

            {/* 6-digit code */}
            <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>
              Or give this code to the agent
            </Text>
            <View style={styles.codeRow}>
              {token?.split('').map((digit, i) => (
                <View key={i} style={[styles.codeDigit, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.codeDigitText, { color: colors.text }]}>{digit}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Amount and fee summary */}
          <View style={[styles.summaryCard, { backgroundColor: colors.surface }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Cash Amount</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCurrency(parsedAmount)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Fee</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{formatCurrency(fee)}</Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.text, fontWeight: '700' }]}>Total Deducted</Text>
              <Text style={[styles.summaryValue, { color: colors.text, fontWeight: '800' }]}>{formatCurrency(total)}</Text>
            </View>
          </View>

          {/* Timer */}
          <View style={styles.timerRow}>
            <Ionicons name="time-outline" size={16} color={secondsLeft < 120 ? colors.error : colors.textSecondary} />
            <Text style={[styles.timerText, { color: secondsLeft < 120 ? colors.error : colors.textSecondary }]}>
              Expires in {formatTimer(secondsLeft)}
            </Text>
          </View>

          <Text style={[styles.instruction, { color: colors.textSecondary }]}>
            Show this QR code or give the 6-digit code to a Monde Agent. They will give you cash.
          </Text>

          {/* Cancel */}
          <TouchableOpacity style={styles.cancelBtn} onPress={handleBack}>
            <Text style={[styles.cancelText, { color: colors.error }]}>Cancel Request</Text>
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
    marginBottom: Spacing.md,
  },
  backBtn: {
    padding: 4,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  // Amount step
  amountSection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  amountLabel: {
    fontSize: FontSize.md,
    marginBottom: Spacing.sm,
  },
  amountDisplay: {
    fontSize: 48,
    fontWeight: '800',
    marginBottom: Spacing.md,
  },
  feeRow: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  feeItem: {
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  feeLabel: {
    fontSize: FontSize.xs,
  },
  feeValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  feeDivider: {
    width: 1,
    height: 30,
  },
  balanceText: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  errorText: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  bottomActions: {
    width: '100%',
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  generateBtn: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  generateBtnText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  // Code step
  codeSection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  qrCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    width: '100%',
  },
  qrWrapper: {
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  codeLabel: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  codeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  codeDigit: {
    width: 44,
    height: 52,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeDigitText: {
    fontSize: 24,
    fontWeight: '800',
  },
  // Summary
  summaryCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: '100%',
    marginTop: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  summaryLabel: {
    fontSize: FontSize.sm,
  },
  summaryValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  summaryDivider: {
    height: 1,
    marginVertical: 6,
  },
  // Timer
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
  },
  timerText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  instruction: {
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  cancelBtn: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  cancelText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
