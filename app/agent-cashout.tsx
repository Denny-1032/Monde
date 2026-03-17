import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, TextInput } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { useStore } from '../store/useStore';
import { formatCurrency, formatPhone } from '../lib/helpers';
import { lookupCashOutRequest, processCashOut } from '../lib/api';

type Step = 'enter' | 'confirm' | 'success';

export default function AgentCashOutScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ token?: string }>();
  const user = useStore((s) => s.user);
  const fetchProfile = useStore((s) => s.fetchProfile);
  const fetchTransactions = useStore((s) => s.fetchTransactions);

  const [step, setStep] = useState<Step>('enter');
  const [code, setCode] = useState(params.token || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [requestId, setRequestId] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [fee, setFee] = useState(0);
  const [agentCommission, setAgentCommission] = useState(0);
  const [mondeFee, setMondeFee] = useState(0);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [volumeBonus, setVolumeBonus] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const [reference, setReference] = useState('');

  useEffect(() => {
    if (params.token && params.token.length === 6) {
      handleLookup(params.token);
    }
  }, [params.token]);

  const handleLookup = async (tokenToLookup?: string) => {
    const lookupCode = tokenToLookup || code;
    if (lookupCode.length !== 6) {
      setError('Enter a 6-digit code');
      return;
    }
    setIsLoading(true);
    setError(null);
    const result = await lookupCashOutRequest(lookupCode);
    if (!result.success) {
      setError(result.error || 'Request not found');
      setIsLoading(false);
      return;
    }
    setRequestId(result.request_id || null);
    setAmount(result.amount || 0);
    setFee(result.fee || 0);
    setAgentCommission(result.agent_commission || 0);
    setMondeFee(result.monde_fee || 0);
    setCustomerName(result.customer_name || 'Customer');
    setCustomerPhone(result.customer_phone || '');
    setVolumeBonus(result.volume_bonus || false);
    setDailyCount(result.daily_count || 0);
    setStep('confirm');
    setIsLoading(false);
  };

  const handleProcess = async () => {
    if (!requestId) return;
    Alert.alert(
      'Confirm Cash Given',
      'Have you given ' + formatCurrency(amount) + ' cash to ' + customerName + '?',
      [
        { text: 'Not Yet', style: 'cancel' },
        {
          text: 'Yes, Cash Given',
          onPress: async () => {
            setIsProcessing(true);
            setError(null);
            const result = await processCashOut(requestId);
            if (!result.success) {
              setError(result.error || 'Failed to process');
              setIsProcessing(false);
              return;
            }
            setReference(result.reference || '');
            setAgentCommission(result.agent_commission || agentCommission);
            setStep('success');
            setIsProcessing(false);
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
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Agent Cash-Out</Text>
        <View style={{ width: 28 }} />
      </View>

      {step === 'enter' && (
        <View style={styles.enterSection}>
          <View style={[styles.agentBadge, { backgroundColor: colors.primary + '15' }]}>
            <Ionicons name="storefront" size={32} color={colors.primary} />
            <Text style={[styles.agentBadgeText, { color: colors.primary }]}>Monde Agent</Text>
          </View>
          <Text style={[styles.enterLabel, { color: colors.textSecondary }]}>
            Enter the customer's 6-digit code
          </Text>
          <View style={styles.codeInputRow}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <View
                key={i}
                style={[
                  styles.codeInputBox,
                  {
                    backgroundColor: colors.surface,
                    borderColor: code.length === i ? colors.primary : colors.border,
                    borderWidth: code.length === i ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.codeInputText, { color: colors.text }]}>{code[i] || ''}</Text>
              </View>
            ))}
          </View>
          <TextInput
            style={styles.hiddenInput}
            value={code}
            onChangeText={(text) => {
              const digits = text.replace(/[^0-9]/g, '').slice(0, 6);
              setCode(digits);
              setError(null);
            }}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />
          {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: code.length === 6 ? colors.primary : colors.border }]}
            onPress={() => handleLookup()}
            disabled={code.length !== 6 || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={[styles.actionBtnText, { color: colors.white }]}>Look Up</Text>
            )}
          </TouchableOpacity>
          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            You can also scan the customer's QR code from the Scan QR screen
          </Text>
        </View>
      )}

      {step === 'confirm' && (
        <View style={styles.confirmSection}>
          <View style={[styles.customerCard, { backgroundColor: colors.surface }]}>
            <View style={[styles.customerAvatar, { backgroundColor: colors.primary + '20' }]}>
              <Ionicons name="person" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.customerName, { color: colors.text }]}>{customerName}</Text>
            <Text style={[styles.customerPhone, { color: colors.textSecondary }]}>{formatPhone(customerPhone)}</Text>
          </View>
          <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Cash to Give</Text>
              <Text style={[styles.detailAmount, { color: colors.text }]}>{formatCurrency(amount)}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>You Receive (wallet)</Text>
              <Text style={[styles.detailValue, { color: colors.primary }]}>{formatCurrency(amount)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Your Commission</Text>
              <Text style={[styles.detailValue, { color: '#22c55e' }]}>+{formatCurrency(agentCommission)}</Text>
            </View>
            {volumeBonus && (
              <View style={[styles.bonusBadge, { backgroundColor: '#22c55e15' }]}>
                <Ionicons name="trophy" size={14} color="#22c55e" />
                <Text style={[styles.bonusText, { color: '#22c55e' }]}>
                  Volume bonus! 75/25 split ({dailyCount}+ txns today)
                </Text>
              </View>
            )}
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.text, fontWeight: '700' }]}>Total to Wallet</Text>
              <Text style={[styles.detailAmount, { color: colors.primary, fontWeight: '800' }]}>
                {formatCurrency(amount + agentCommission)}
              </Text>
            </View>
          </View>
          {error && <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>}
          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: colors.primary }]}
            onPress={handleProcess}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="cash-outline" size={22} color={colors.white} />
                <Text style={[styles.actionBtnText, { color: colors.white }]}>Confirm \u2014 Cash Given</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => { setStep('enter'); setCode(''); }}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'success' && (
        <View style={styles.successSection}>
          <View style={[styles.successIcon, { backgroundColor: '#22c55e15' }]}>
            <Ionicons name="checkmark-circle" size={64} color="#22c55e" />
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>Cash-Out Complete!</Text>
          <Text style={[styles.successRef, { color: colors.textSecondary }]}>Ref: {reference}</Text>
          <View style={[styles.successCard, { backgroundColor: colors.surface }]}>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Customer</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{customerName}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Cash Given</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{formatCurrency(amount)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Your Commission</Text>
              <Text style={[styles.detailValue, { color: '#22c55e', fontWeight: '700' }]}>+{formatCurrency(agentCommission)}</Text>
            </View>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: colors.text, fontWeight: '700' }]}>Added to Wallet</Text>
              <Text style={[styles.detailAmount, { color: colors.primary, fontWeight: '800' }]}>
                {formatCurrency(amount + agentCommission)}
              </Text>
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
  enterSection: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  agentBadge: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.xl,
  },
  agentBadgeText: { fontSize: FontSize.md, fontWeight: '700', marginTop: Spacing.sm },
  enterLabel: { fontSize: FontSize.md, marginBottom: Spacing.lg },
  codeInputRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg },
  codeInputBox: {
    width: 48,
    height: 56,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  codeInputText: { fontSize: 24, fontWeight: '800' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },
  errorText: { fontSize: FontSize.sm, marginBottom: Spacing.md, textAlign: 'center' },
  actionBtn: {
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    width: '100%',
  },
  actionBtnText: { fontSize: FontSize.md, fontWeight: '700' },
  hint: { fontSize: FontSize.xs, marginTop: Spacing.lg, textAlign: 'center' },
  confirmSection: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.lg },
  customerCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: 'center',
    width: '100%',
    marginBottom: Spacing.md,
  },
  customerAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  customerName: { fontSize: FontSize.lg, fontWeight: '700' },
  customerPhone: { fontSize: FontSize.sm, marginTop: 2 },
  detailsCard: { borderRadius: BorderRadius.lg, padding: Spacing.md, width: '100%' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  detailLabel: { fontSize: FontSize.sm },
  detailValue: { fontSize: FontSize.sm, fontWeight: '600' },
  detailAmount: { fontSize: FontSize.lg, fontWeight: '700' },
  divider: { height: 1, marginVertical: 6 },
  bonusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: 4,
  },
  bonusText: { fontSize: FontSize.xs, fontWeight: '600' },
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
  successSection: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  successTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  successRef: { fontSize: FontSize.sm, marginBottom: Spacing.lg },
  successCard: { borderRadius: BorderRadius.lg, padding: Spacing.md, width: '100%' },
});
