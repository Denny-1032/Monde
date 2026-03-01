import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius, Providers } from '../constants/theme';
import { useStore } from '../store/useStore';
import { formatCurrency, formatPhone } from '../lib/helpers';
import Avatar from '../components/Avatar';

export default function TransactionDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string }>();
  const transactions = useStore((s) => s.transactions);
  const txn = transactions.find((t) => t.id === params.id);

  if (!txn) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Transaction</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="alert-circle-outline" size={48} color={Colors.textLight} />
          <Text style={styles.emptyText}>Transaction not found</Text>
        </View>
      </View>
    );
  }

  const isReceive = txn.type === 'receive';
  const isPayment = txn.type === 'payment';
  const provider = Providers.find((p) => p.id === txn.provider);

  const statusColor =
    txn.status === 'completed' ? Colors.success :
    txn.status === 'failed' ? Colors.error : Colors.warning;

  const typeLabel = isReceive ? 'Received' : isPayment ? 'Payment' : 'Sent';
  const amountPrefix = isReceive ? '+' : '-';
  const amountColor = isReceive ? Colors.success : Colors.text;

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

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Transaction Details</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Main Card */}
        <View style={styles.card}>
          <Avatar
            name={txn.recipient_name}
            size={64}
            color={isReceive ? Colors.success : isPayment ? Colors.secondary : Colors.primaryLight}
          />
          <Text style={styles.recipientName}>{txn.recipient_name}</Text>
          {txn.recipient_phone ? (
            <Text style={styles.recipientPhone}>{formatPhone(txn.recipient_phone)}</Text>
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
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          <DetailRow label="Type" value={typeLabel} />
          <DetailRow label="Method" value={txn.method === 'qr' ? 'QR Code' : txn.method === 'nfc' ? 'Tap to Pay' : 'Manual'} icon={txn.method === 'qr' ? 'qr-code-outline' : txn.method === 'nfc' ? 'wifi-outline' : 'send-outline'} />
          <DetailRow label="Provider" value={provider?.name || txn.provider} dotColor={provider?.color} />
          <DetailRow label="Date" value={formattedDate} />
          <DetailRow label="Time" value={formattedTime} />
          <DetailRow label="Transaction ID" value={txn.id} mono />
          {txn.note ? <DetailRow label="Note" value={txn.note} /> : null}
        </View>

        {/* Quick action: Send Again (1-tap resend) */}
        {txn.type === 'send' && txn.recipient_phone ? (
          <TouchableOpacity
            style={styles.sendAgainBtn}
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
            <Ionicons name="repeat-outline" size={20} color={Colors.white} />
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
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <View style={styles.detailValueRow}>
        {dotColor ? <View style={[styles.providerDot, { backgroundColor: dotColor }]} /> : null}
        {icon ? <Ionicons name={icon as any} size={14} color={Colors.textSecondary} /> : null}
        <Text style={[styles.detailValue, mono && styles.mono]} numberOfLines={1}>{value}</Text>
      </View>
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
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.surface,
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
    color: Colors.text,
    marginTop: Spacing.md,
  },
  recipientPhone: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
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
  detailsCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md - 2,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  detailLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
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
    color: Colors.text,
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
    color: Colors.textLight,
  },
  sendAgainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.lg,
  },
  sendAgainText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
