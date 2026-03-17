import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { useStore } from '../store/useStore';
import { formatCurrency, formatPhone, calcCashInCommission } from '../lib/helpers';
import { processAgentCashIn } from '../lib/api';
import NumPad from '../components/NumPad';

type Step = 'phone' | 'amount' | 'success';

export default function AgentCashInScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string; name?: string }>();
  const insets = useSafeAreaInsets();
  const user = useStore((s) => s.user);
  const fetchProfile = useStore((s) => s.fetchProfile);
  const fetchTransactions = useStore((s) => s.fetchTransactions);

  const [step, setStep] = useState<Step>(params.phone ? 'amount' : 'phone');
  const [phone, setPhone] = useState(params.phone || '');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Result state
  const [reference, setReference] = useState('');
  const [commission, setCommission] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const parsedAmount = parseFloat(amount) || 0;
  const agentBalance = user?.balance || 0;
  const canAfford = parsedAmount > 0 && parsedAmount <= agentBalance;
  const validAmount = parsedAmount >= 1 && parsedAmount <= 5000;
  const estimatedCommission = calcCashInCommission(parsedAmount);

  // Normalize phone to +260 format
  const normalizePhone = (raw: string): string => {
    const digits = raw.replace(/[^0-9]/g, '');
    if (digits.startsWith('260') && digits.length >= 12) return '+' + digits;
    if (digits.startsWith('0') && digits.length >= 10) return '+260' + digits.slice(1);
    if (digits.length === 9) return '+260' + digits;
    return '+' + digits;
  };

  const handlePhoneNext = () => {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length < 9) {
      setError('Enter a valid phone number');
      return;
    }
    setError(null);
    setStep('amount');
  };

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

  const handleProcess = () => {
    if (!validAmount || !canAfford) return;
    const normalized = normalizePhone(phone);
    Alert.alert(
      'Confirm Cash-In',
      `Deposit ${formatCurrency(parsedAmount)} to customer's Monde wallet?\n\nYour wallet will be debited ${formatCurrency(parsedAmount)}.\nYou earn ${formatCurrency(estimatedCommission)} commission.\n\nMake sure you have collected the cash!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm Deposit',
          onPress: async () => {
            setIsLoading(true);
            setError(null);
            const result = await processAgentCashIn(normalized, parsedAmount);
            if (!result.success) {
              setError(result.error || 'Failed to process');
              setIsLoading(false);
              return;
            }
            setReference(result.reference || '');
            setCommission(result.commission || 0);
            setCustomerName(result.customer_name || 'Customer');
            setCustomerPhone(result.customer_phone || normalized);
            setStep('success');
            setIsLoading(false);
            fetchProfile();
            fetchTransactions();
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10, backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => {
          if (step === 'amount') setStep('phone');
          else router.back();
        }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Agent Cash-In</Text>
        <View style={{ width: 28 }} />
      </View>

      {step === 'phone' && (
        <View style={styles.section}>
          <View style={[styles.agentBadge, { backgroundColor: '#3b82f615' }]}>
            <Ionicons name="arrow-down-circle" size={32} color="#3b82f6" />
            <Text style={[styles.agentBadgeText, { color: '#3b82f6' }]}>Cash Deposit</Text>
          </View>

          {/* QR-first: primary action */}
          <TouchableOpacity
            style={[styles.scanBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/scan')}
            activeOpacity={0.7}
          >
            <Ionicons name="qr-code-outline" size={22} color={colors.white} />
            <Text style={[styles.scanBtnText, { color: colors.white }]}>Scan Customer QR</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textLight }]}>or enter manually</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <TextInput
            style={[styles.phoneInput, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={phone}
            onChangeText={(text) => { setPhone(text); setError(null); }}
            placeholder="e.g. 0977123456"
            placeholderTextColor={colors.textLight}
            keyboardType="phone-pad"
            maxLength={15}
          />
          {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: phone.replace(/[^0-9]/g, '').length >= 9 ? colors.primary : colors.border }]}
            onPress={handlePhoneNext}
            disabled={phone.replace(/[^0-9]/g, '').length < 9}
          >
            <Text style={[styles.actionBtnText, { color: colors.white }]}>Next</Text>
          </TouchableOpacity>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            The customer must have a Monde account
          </Text>
        </View>
      )}

      {step === 'amount' && (
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            How much cash is the customer depositing?
          </Text>
          <Text style={[styles.amountDisplay, { color: colors.text }]}>
            K{amount || '0'}
          </Text>

          {parsedAmount > 0 && (
            <View style={[styles.infoRow, { backgroundColor: colors.surface }]}>
              <View style={styles.infoItem}>
                <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Your Commission (0.5%)</Text>
                <Text style={[styles.infoValue, { color: '#22c55e' }]}>+{formatCurrency(estimatedCommission)}</Text>
              </View>
            </View>
          )}

          <Text style={[styles.balanceText, { color: parsedAmount > 0 && !canAfford ? colors.error : colors.textSecondary }]}>
            Your balance: {formatCurrency(agentBalance)}
          </Text>
          <Text style={[styles.freeNote, { color: colors.textSecondary }]}>
            Customer pays nothing for deposits
          </Text>

          {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}

          <NumPad onPress={handleKeyPress} onDelete={handleDelete} />

          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: validAmount && canAfford ? colors.primary : colors.border }]}
              onPress={handleProcess}
              disabled={!validAmount || !canAfford || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="arrow-down-circle" size={20} color={colors.white} />
                  <Text style={[styles.actionBtnText, { color: colors.white }]}>Confirm Deposit</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {step === 'success' && (
        <View style={styles.section}>
          <View style={[styles.successIcon, { backgroundColor: '#22c55e15' }]}>
            <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>Deposit Complete!</Text>
          <Text style={[styles.successRef, { color: colors.textSecondary }]}>Ref: {reference}</Text>

          <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Customer</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{customerName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Deposited</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{formatCurrency(parsedAmount)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Your Commission</Text>
              <Text style={[styles.detailValue, { color: '#22c55e', fontWeight: '700' }]}>+{formatCurrency(commission)}</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.primary, marginTop: Spacing.xl }]} onPress={() => router.back()}>
            <Text style={[styles.actionBtnText, { color: colors.white }]}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  backBtn: { padding: 4 },
  title: { fontSize: FontSize.lg, fontWeight: '700' },
  section: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.lg },
  agentBadge: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.xl,
  },
  agentBadgeText: { fontSize: FontSize.md, fontWeight: '700', marginTop: Spacing.sm },
  label: { fontSize: FontSize.md, marginBottom: Spacing.lg, textAlign: 'center' },
  phoneInput: {
    width: '100%',
    fontSize: FontSize.lg,
    fontWeight: '700',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  amountDisplay: { fontSize: 48, fontWeight: '800', marginBottom: Spacing.md },
  infoRow: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  infoItem: { alignItems: 'center', paddingHorizontal: Spacing.md },
  infoLabel: { fontSize: FontSize.xs },
  infoValue: { fontSize: FontSize.md, fontWeight: '700' },
  balanceText: { fontSize: FontSize.sm, marginBottom: 4 },
  freeNote: { fontSize: FontSize.xs, fontStyle: 'italic', marginBottom: Spacing.md },
  errorText: { fontSize: FontSize.sm, marginBottom: Spacing.md, textAlign: 'center' },
  actionBtn: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  actionBtnText: { fontSize: FontSize.md, fontWeight: '700' },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    width: '100%',
    marginBottom: Spacing.lg,
  },
  scanBtnText: { fontSize: FontSize.md, fontWeight: '700' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: FontSize.xs },
  hint: { fontSize: FontSize.xs, marginTop: Spacing.lg, textAlign: 'center' },
  bottomActions: { width: '100%', paddingHorizontal: Spacing.md, marginTop: Spacing.md },
  detailsCard: { borderRadius: BorderRadius.lg, padding: Spacing.md, width: '100%' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  detailLabel: { fontSize: FontSize.sm },
  detailValue: { fontSize: FontSize.sm, fontWeight: '600' },
  detailAmount: { fontSize: FontSize.lg, fontWeight: '700' },
  divider: { height: 1, marginVertical: 6 },
  reminderBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginTop: Spacing.md,
    width: '100%',
  },
  reminderText: { flex: 1, fontSize: FontSize.xs, fontWeight: '600' },
  confirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    width: '100%',
    marginTop: Spacing.lg,
  },
  cancelBtn: { paddingVertical: Spacing.md },
  cancelText: { fontSize: FontSize.md, fontWeight: '600' },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.xl,
  },
  successTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  successRef: { fontSize: FontSize.sm, marginBottom: Spacing.lg },
});
