import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SectionList, RefreshControl, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { useStore } from '../../store/useStore';
import { Transaction } from '../../constants/types';
import TransactionItem from '../../components/TransactionItem';

type FilterType = 'all' | 'sent' | 'received' | 'topup' | 'withdraw';

function groupByDate(transactions: Transaction[]) {
  const groups: Record<string, Transaction[]> = {};
  transactions.forEach((txn) => {
    const date = new Date(txn.created_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
    let label: string;
    if (diffDays === 0) label = 'Today';
    else if (diffDays === 1) label = 'Yesterday';
    else if (diffDays < 7) label = 'This Week';
    else label = date.toLocaleDateString('en-ZM', { month: 'long', year: 'numeric' });

    if (!groups[label]) groups[label] = [];
    groups[label].push(txn);
  });
  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const transactions = useStore((s) => s.transactions);
  const fetchTransactions = useStore((s) => s.fetchTransactions);
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  }, []);

  const filtered = transactions.filter((txn) => {
    if (filter === 'sent') return txn.type === 'send';
    if (filter === 'received') return txn.type === 'receive';
    if (filter === 'topup') return txn.type === 'topup';
    if (filter === 'withdraw') return txn.type === 'withdraw';
    return true;
  });

  const sections = groupByDate(filtered);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'sent', label: 'Sent' },
    { key: 'received', label: 'Received' },
    { key: 'topup', label: 'Top Ups' },
    { key: 'withdraw', label: 'Withdrawals' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.screenTitle}>Activity</Text>

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TransactionItem
            transaction={item}
            onPress={() => router.push({ pathname: '/transaction', params: { id: item.id } })}
          />
        )}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={Colors.textLight} />
            <Text style={styles.emptyTitle}>No transactions</Text>
            <Text style={styles.emptyText}>Your transaction history will appear here</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  screenTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceAlt,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  filterTextActive: {
    color: Colors.white,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
});
