import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius, ColorScheme } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { Transaction } from '../constants/types';
import { formatCurrency, formatDate } from '../lib/helpers';
import Avatar from './Avatar';

type Props = {
  transaction: Transaction;
  onPress?: () => void;
};

function TransactionItem({ transaction, onPress }: Props) {
  const colors = useColors();
  const isReceive = transaction.type === 'receive';
  const isPayment = transaction.type === 'payment';
  const isTopUp = transaction.type === 'topup';
  const isWithdraw = transaction.type === 'withdraw';

  const iconName = isTopUp ? 'wallet' : isWithdraw ? 'arrow-up-circle' : isReceive ? 'arrow-down-circle' : isPayment ? 'cart' : 'arrow-up-circle';
  const amountColor = (isReceive || isTopUp) ? colors.success : colors.text;
  const amountPrefix = (isReceive || isTopUp) ? '+' : '-';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.6}
      accessibilityLabel={`${transaction.type === 'receive' || transaction.type === 'topup' ? 'Received' : 'Sent'} ${formatCurrency(transaction.amount)} ${transaction.type === 'topup' ? 'top up' : transaction.type === 'withdraw' ? 'withdrawal' : (transaction.recipient_name ? 'to ' + transaction.recipient_name : '')}`}
      accessibilityRole="button"
    >
      <Avatar
        name={transaction.recipient_name}
        size={42}
        color={isTopUp ? colors.success : isWithdraw ? colors.secondary : isReceive ? colors.success : isPayment ? colors.secondary : colors.primaryLight}
      />
      <View style={styles.details}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {transaction.recipient_name}
        </Text>
        <View style={styles.meta}>
          <Ionicons
            name={transaction.method === 'wallet' ? 'wallet-outline' : transaction.method === 'qr' ? 'qr-code-outline' : transaction.method === 'nfc' ? 'wifi-outline' : 'send-outline'}
            size={12}
            color={colors.textLight}
          />
          <Text style={[styles.metaText, { color: colors.textLight }]}>{formatDate(transaction.created_at)}</Text>
        </View>
      </View>
      <View style={styles.amountCol}>
        <Text style={[styles.amount, { color: amountColor }]}>
          {amountPrefix}{formatCurrency(transaction.amount)}
        </Text>
        {transaction.balance_after != null && (
          <Text style={[styles.balanceAfter, { color: colors.textLight }]}>
            Bal: {formatCurrency(transaction.balance_after)}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md - 2,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  details: {
    flex: 1,
  },
  name: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: FontSize.xs,
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  balanceAfter: {
    fontSize: FontSize.xs - 1,
    marginTop: 2,
  },
});

export default React.memo(TransactionItem);
