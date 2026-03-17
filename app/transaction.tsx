import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Share, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius, Providers } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { useStore } from '../store/useStore';
import { formatCurrency, formatPhone } from '../lib/helpers';
import Avatar from '../components/Avatar';

export default function TransactionDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const transactions = useStore((s) => s.transactions);
  const cancelPendingTopUp = useStore((s) => s.cancelPendingTopUp);
  const txn = transactions.find((t) => t.id === params.id);
  const [cancelling, setCancelling] = useState(false);

  if (!txn) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 10, backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Transaction</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.textLight} />
          <Text style={[styles.emptyText, { color: colors.textLight }]}>Transaction not found</Text>
        </View>
      </View>
    );
  }

  const isReceive = txn.type === 'receive';
  const isPayment = txn.type === 'payment';
  const isTopUp = txn.type === 'topup';
  const isWithdraw = txn.type === 'withdraw';
  const isCashOut = txn.type === 'cash_out';
  const isCashIn = txn.type === 'cash_in';
  const isAgentTransfer = txn.type === 'agent_transfer';
  const provider = Providers.find((p) => p.id === txn.provider);

  const statusColor =
    txn.status === 'completed' ? colors.success :
    txn.status === 'failed' ? colors.error : colors.warning;

  const typeLabel = isAgentTransfer ? 'Agent Transfer' : isCashIn ? 'Cash Deposit' : isCashOut ? 'Get Cash' : isTopUp ? 'Top Up' : isWithdraw ? 'Withdrawal' : isReceive ? 'Received' : isPayment ? 'Payment' : 'Sent';
  const amountPrefix = (isReceive || isTopUp || isCashIn) ? '+' : '-';
  const amountColor = txn.status === 'pending' ? colors.warning : (isReceive || isTopUp || isCashIn) ? colors.success : isAgentTransfer ? '#8b5cf6' : colors.text;

  const date = new Date(txn.created_at);
  const formattedDate = date.toLocaleDateString('en-ZM', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString('en-ZM', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const receiptText = [
    '━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '       MONDE RECEIPT',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `Type: ${typeLabel}`,
    `Amount: ${amountPrefix}${formatCurrency(txn.amount)}`,
    txn.fee && txn.fee > 0 ? `Fee: ${formatCurrency(txn.fee)}` : null,
    `To: ${txn.recipient_name}`,
    txn.recipient_phone ? `Phone: ${formatPhone(txn.recipient_phone)}` : null,
    `Provider: ${provider?.name || txn.provider}`,
    txn.note ? `Note: ${txn.note}` : null,
    '',
    `Date: ${formattedDate}`,
    `Time: ${formattedTime}`,
    `Status: ${txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}`,
    '',
    `Ref: ${txn.id}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '  Powered by Monde',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━',
  ].filter(Boolean).join('\n');

  const handleShareReceipt = () => {
    Share.share({ message: receiptText }).catch(() => {});
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10, backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Transaction Details</Text>
        <TouchableOpacity onPress={handleShareReceipt} accessibilityLabel="Share receipt" accessibilityRole="button">
          <Ionicons name="share-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Card */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Avatar
            name={txn.recipient_name}
            size={64}
            color={isAgentTransfer ? '#8b5cf6' : isCashIn ? '#3b82f6' : isCashOut ? '#22c55e' : isTopUp ? colors.success : isWithdraw ? colors.secondary : isReceive ? colors.success : isPayment ? colors.secondary : colors.primaryLight}
          />
          <Text style={[styles.recipientName, { color: colors.text }]}>{txn.recipient_name}</Text>
          {txn.recipient_phone ? (
            <Text style={[styles.recipientPhone, { color: colors.textSecondary }]}>{formatPhone(txn.recipient_phone)}</Text>
          ) : null}

          <View style={styles.amountRow}>
            <Text style={[styles.amount, { color: amountColor }]}>
              {amountPrefix}{formatCurrency(txn.amount)}
            </Text>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: statusColor + '18' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {txn.status.charAt(0).toUpperCase() + txn.status.slice(1)}
            </Text>
          </View>

          {/* Cancel button for pending top-ups */}
          {isTopUp && txn.status === 'pending' ? (
            <TouchableOpacity
              style={[styles.cancelBtn, { borderColor: colors.error }]}
              onPress={() => {
                Alert.alert('Cancel Top-Up', 'Are you sure you want to cancel this pending top-up?', [
                  { text: 'No', style: 'cancel' },
                  {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                      setCancelling(true);
                      const result = await cancelPendingTopUp(txn.id);
                      setCancelling(false);
                      if (result.success) {
                        Alert.alert('Cancelled', 'The pending top-up has been removed.', [
                          { text: 'OK', onPress: () => router.back() },
                        ]);
                      } else {
                        Alert.alert('Error', result.error || 'Failed to cancel.');
                      }
                    },
                  },
                ]);
              }}
              disabled={cancelling}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle-outline" size={18} color={colors.error} />
              <Text style={[styles.cancelBtnText, { color: colors.error }]}>
                {cancelling ? 'Cancelling...' : 'Cancel Top-Up'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Details */}
        <View style={[styles.detailsCard, { backgroundColor: colors.surface }]}>
          <DetailRow label="Type" value={typeLabel} />
          <DetailRow label="Method" value={txn.method === 'wallet' ? 'Wallet Transfer' : txn.method === 'qr' ? 'QR Code' : txn.method === 'nfc' ? 'Tap to Pay' : 'Manual'} icon={txn.method === 'wallet' ? 'wallet-outline' : txn.method === 'qr' ? 'qr-code-outline' : txn.method === 'nfc' ? 'wifi-outline' : 'send-outline'} />
          <DetailRow label="Provider" value={provider?.name || txn.provider} dotColor={provider?.color} />
          {txn.fee && txn.fee > 0 ? <DetailRow label="Fee" value={formatCurrency(txn.fee)} /> : null}
          <DetailRow label="Date" value={formattedDate} />
          <DetailRow label="Time" value={formattedTime} />
          <DetailRow label="Transaction ID" value={txn.id} mono />
          {txn.note ? <DetailRow label="Note" value={txn.note} /> : null}
        </View>

        {/* Share Receipt */}
        <TouchableOpacity
          style={[styles.receiptBtn, { borderColor: colors.primary }]}
          onPress={handleShareReceipt}
          activeOpacity={0.7}
          accessibilityLabel="Share transaction receipt"
          accessibilityRole="button"
        >
          <Ionicons name="document-text-outline" size={20} color={colors.primary} />
          <Text style={[styles.receiptBtnText, { color: colors.primary }]}>Share Receipt</Text>
        </TouchableOpacity>

        {/* Quick action: Send Again (1-tap resend) */}
        {txn.type === 'send' && txn.recipient_phone ? (
          <TouchableOpacity
            style={[styles.sendAgainBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push({
              pathname: '/payment',
              params: {
                recipientName: txn.recipient_name,
                recipientPhone: txn.recipient_phone,
                amount: txn.amount.toString(),
                method: txn.method,
              },
            })}
            activeOpacity={0.7}
          >
            <Ionicons name="repeat-outline" size={20} color={colors.white} />
            <Text style={styles.sendAgainText}>Send Again</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value, icon, dotColor, mono }: {
  label: string;
  value: string;
  icon?: string;
  dotColor?: string;
  mono?: boolean;
}) {
  const colors = useColors();
  return (
    <View style={[styles.detailRow, { borderBottomColor: colors.borderLight }]}>
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.detailValueRow}>
        {dotColor ? <View style={[styles.providerDot, { backgroundColor: dotColor }]} /> : null}
        {icon ? <Ionicons name={icon as any} size={14} color={colors.textSecondary} /> : null}
        <Text style={[styles.detailValue, { color: colors.text }, mono && styles.mono]} numberOfLines={1}>{value}</Text>
      </View>
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
  backBtn: { padding: 4 },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  recipientName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginTop: Spacing.md,
  },
  recipientPhone: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  amountRow: {
    marginTop: Spacing.lg,
  },
  amount: {
    fontSize: FontSize.hero + 4,
    fontWeight: '800',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  detailsCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md - 2,
    borderBottomWidth: 1,
  },
  detailLabel: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  detailValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    maxWidth: '60%',
  },
  detailValue: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: FontSize.xs,
  },
  providerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.md,
  },
  receiptBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
  },
  receiptBtnText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  sendAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
  },
  sendAgainText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
