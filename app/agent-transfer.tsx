import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { useStore } from '../store/useStore';
import { formatCurrency, formatPhone } from '../lib/helpers';
import { agentToAgentTransfer } from '../lib/api';
import NumPad from '../components/NumPad';

type Step = 'phone' | 'amount' | 'success';

export default function AgentTransferScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ phone?: string }>();
  const insets = useSafeAreaInsets();
  const user = useStore((s) => s.user);
  const fetchProfile = useStore((s) => s.fetchProfile);
  const fetchTransactions = useStore((s) => s.fetchTransactions);

  const [step, setStep] = useState<Step>(params.phone ? 'amount' : 'phone');
  const [phone, setPhone] = useState(params.phone || '');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reference, setReference] = useState('');
  const [recipientName, setRecipientName] = useState('');

  const parsedAmount = parseFloat(amount) || 0;
  const agentBalance = user?.balance || 0;
  const canAfford = parsedAmount > 0 && parsedAmount <= agentBalance;
  const validAmount = parsedAmount >= 1 && parsedAmount <= 50000;

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
      'Confirm Agent Transfer',
      `Transfer ${formatCurrency(parsedAmount)} to another agent?\n\nNo fee charged.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Transfer',
          onPress: async () => {
            setIsLoading(true);
            setError(null);
            const result = await agentToAgentTransfer(normalized, parsedAmount, note || undefined);
            if (!result.success) {
              setError(result.error || 'Transfer failed');
              setIsLoading(false);
              return;
            }
            setReference(result.reference || '');
            setRecipientName(result.recipient_name || 'Agent');
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
        <Text style={[styles.title, { color: colors.text }]}>Agent Transfer</Text>
        <View style={{ width: 28 }} />
      </View>

      {step === 'phone' && (
        <View style={styles.section}>
          <View style={[styles.badge, { backgroundColor: '#8b5cf615' }]}>
            <Ionicons name="swap-horizontal" size={32} color="#8b5cf6" />
            <Text style={[styles.badgeText, { color: '#8b5cf6' }]}>Float Transfer</Text>
          </View>

          {/* QR-first: primary action */}
          <TouchableOpacity
            style={[styles.scanBtn, { backgroundColor: '#8b5cf6' }]}
            onPress={() => router.push('/scan')}
            activeOpacity={0.7}
          >
            <Ionicons name="qr-code-outline" size={22} color="#fff" />
            <Text style={styles.scanBtnText}>Scan Agent QR</Text>
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
            style={[styles.actionBtn, { backgroundColor: phone.replace(/[^0-9]/g, '').length >= 9 ? '#8b5cf6' : colors.border }]}
            onPress={handlePhoneNext}
            disabled={phone.replace(/[^0-9]/g, '').length < 9}
          >
            <Text style={[styles.actionBtnText, { color: colors.white }]}>Next</Text>
          </TouchableOpacity>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            Both parties must be Monde agents. No fee charged.
          </Text>
        </View>
      )}

      {step === 'amount' && (
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>How much to transfer?</Text>
          <Text style={[styles.amountDisplay, { color: colors.text }]}>K{amount || '0'}</Text>

          <View style={styles.freeRow}>
            <Ionicons name="checkmark-circle" size={16} color="#22c55e" />
            <Text style={[styles.freeText, { color: '#22c55e' }]}>No fee — free agent transfer</Text>
          </View>

          <Text style={[styles.balanceText, { color: parsedAmount > 0 && !canAfford ? colors.error : colors.textSecondary }]}>
            Your balance: {formatCurrency(agentBalance)}
          </Text>

          {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}

          <NumPad onPress={handleKeyPress} onDelete={handleDelete} />

          <View style={styles.bottomActions}>
            <TouchableOpacity
              style={[styles.confirmBtn, { backgroundColor: validAmount && canAfford ? '#8b5cf6' : colors.border }]}
              onPress={handleProcess}
              disabled={!validAmount || !canAfford || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <>
                  <Ionicons name="swap-horizontal" size={20} color={colors.white} />
                  <Text style={[styles.actionBtnText, { color: colors.white }]}>Transfer</Text>
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
          <Text style={[styles.successTitle, { color: colors.text }]}>Transfer Complete!</Text>
          <Text style={[styles.successRef, { color: colors.textSecondary }]}>Ref: {reference}</Text>

          <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>To</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{recipientName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Amount</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{formatCurrency(parsedAmount)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Fee</Text>
              <Text style={[styles.detailValue, { color: '#22c55e' }]}>FREE</Text>
            </View>
          </View>

          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#8b5cf6', marginTop: Spacing.xl }]} onPress={() => router.back()}>
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
  badge: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.xl,
  },
  badgeText: { fontSize: FontSize.md, fontWeight: '700', marginTop: Spacing.sm },
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
  freeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  freeText: { fontSize: FontSize.sm, fontWeight: '700' },
  balanceText: { fontSize: FontSize.sm, marginBottom: Spacing.md },
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
  scanBtnText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
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
