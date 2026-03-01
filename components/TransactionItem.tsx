import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { Transaction } from '../constants/types';
import { formatCurrency, formatDate } from '../lib/helpers';
import Avatar from './Avatar';

type Props = {
  transaction: Transaction;
  onPress?: () => void;
};

export default function TransactionItem({ transaction, onPress }: Props) {
  const isReceive = transaction.type === 'receive';
  const isPayment = transaction.type === 'payment';

  const iconName = isReceive ? 'arrow-down-circle' : isPayment ? 'cart' : 'arrow-up-circle';
  const amountColor = isReceive ? Colors.success : Colors.text;
  const amountPrefix = isReceive ? '+' : '-';

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.6}>
      <Avatar
        name={transaction.recipient_name}
        size={42}
        color={isReceive ? Colors.success : isPayment ? Colors.secondary : Colors.primaryLight}
      />
      <View style={styles.details}>
        <Text style={styles.name} numberOfLines={1}>
          {transaction.recipient_name}
        </Text>
        <View style={styles.meta}>
          <Ionicons
            name={transaction.method === 'qr' ? 'qr-code-outline' : transaction.method === 'nfc' ? 'wifi-outline' : 'send-outline'}
            size={12}
            color={Colors.textLight}
          />
          <Text style={styles.metaText}>{formatDate(transaction.created_at)}</Text>
        </View>
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>
        {amountPrefix}{formatCurrency(transaction.amount)}
      </Text>
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
    color: Colors.text,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  amount: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
