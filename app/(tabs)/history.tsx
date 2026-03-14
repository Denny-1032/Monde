import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SectionList, RefreshControl, ScrollView, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../../constants/theme';
import { useColors } from '../../constants/useColors';
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
  const colors = useColors();
  const transactions = useStore((s) => s.transactions);
  const fetchTransactions = useStore((s) => s.fetchTransactions);
  const loadMoreTransactions = useStore((s) => s.loadMoreTransactions);
  const hasMore = useStore((s) => s.hasMoreTransactions);
  const [filter, setFilter] = useState<FilterType>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadMoreTransactions();
    setLoadingMore(false);
  }, [loadingMore, hasMore]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTransactions();
    setRefreshing(false);
  }, []);

  const balance = useStore((s) => s.user?.balance ?? 0);

  const sections = useMemo(() => {
    // Compute balance_after for each transaction by working backwards from
    // the current balance. Transactions are sorted newest-first.
    let runningBalance = balance;
    const withBalance = transactions.map((txn) => {
      const bal = runningBalance;
      // Reverse the effect of this transaction to get prior balance
      const isInflow = txn.type === 'receive' || txn.type === 'topup';
      const fee = txn.fee ?? 0;
      if (isInflow) {
        runningBalance = runningBalance - txn.amount;
      } else {
        runningBalance = runningBalance + txn.amount + fee;
      }
      return { ...txn, balance_after: Math.round(bal * 100) / 100 };
    });

    const filtered = withBalance.filter((txn) => {
      if (filter === 'sent') return txn.type === 'send';
      if (filter === 'received') return txn.type === 'receive';
      if (filter === 'topup') return txn.type === 'topup';
      if (filter === 'withdraw') return txn.type === 'withdraw';
      return true;
    });
    return groupByDate(filtered);
  }, [transactions, filter, balance]);

  const renderItem = useCallback(({ item }: { item: Transaction }) => (
    <TransactionItem
      transaction={item}
      onPress={() => router.push({ pathname: '/transaction', params: { id: item.id } })}
    />
  ), [router]);

  const renderSectionHeader = useCallback(({ section: { title } }: { section: { title: string } }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
    </View>
  ), [colors.background, colors.textSecondary]);

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'sent', label: 'Sent' },
    { key: 'received', label: 'Received' },
    { key: 'topup', label: 'Top Ups' },
    { key: 'withdraw', label: 'Withdrawals' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top + 10, backgroundColor: colors.background }]}>
      <Text style={[styles.screenTitle, { color: colors.text }]}>Activity</Text>

      {/* Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, { backgroundColor: filter === f.key ? colors.primary : colors.surfaceAlt }]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, { color: filter === f.key ? colors.white : colors.textSecondary }]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color={colors.textLight} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No transactions</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Your transaction history will appear here</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  screenTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    paddingHorizontal: Spacing.lg,
    marginBottom: 2,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    alignItems: 'center',
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
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
  },
  emptyText: {
    fontSize: FontSize.sm,
  },
  loadingMore: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
});
