import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  RefreshControl, ActivityIndicator, Alert, TextInput, Share, Platform,
} from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { useStore } from '../store/useStore';
import { FeeSummary, FloatSummary, FeeDetail } from '../constants/types';
import { getFeeSummary, getFloatSummary, getFeeDetails, adminWithdrawRevenue, verifyPin, adminSearchUsers, adminGetUserTransactions } from '../lib/api';
import { Transaction } from '../constants/types';
import { formatCurrency, formatDate, formatPhone } from '../lib/helpers';
import PinConfirm from '../components/PinConfirm';

type TabId = 'overview' | 'fees' | 'float' | 'accounts';

type AdminUser = { id: string; phone: string; full_name: string; balance: number; handle?: string; is_admin?: boolean };

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AdminDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const user = useStore((s) => s.user);

  const fetchProfile = useStore((s) => s.fetchProfile);

  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);

  const [feeSummary, setFeeSummary] = useState<FeeSummary | null>(null);
  const [floatSummary, setFloatSummary] = useState<FloatSummary | null>(null);
  const [feeDetails, setFeeDetails] = useState<FeeDetail[]>([]);
  const [feeTotal, setFeeTotal] = useState(0);
  const [feeFilter, setFeeFilter] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Accounts tab state
  const [userSearch, setUserSearch] = useState('');
  const [searchResults, setSearchResults] = useState<AdminUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [userTxns, setUserTxns] = useState<Transaction[]>([]);
  const [userTxnTotal, setUserTxnTotal] = useState(0);
  const [txnLoading, setTxnLoading] = useState(false);
  const [dateMonth, setDateMonth] = useState(new Date().getMonth());
  const [dateYear, setDateYear] = useState(new Date().getFullYear());
  const [exporting, setExporting] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Guard: only admin can view (uses is_admin flag from profile)
  const isAdmin = user?.is_admin === true;

  const loadData = useCallback(async () => {
    setError('');
    try {
      const [fees, float] = await Promise.all([
        getFeeSummary(),
        getFloatSummary(),
      ]);

      if (fees.success) setFeeSummary(fees);
      else setError(fees.error || 'Failed to load fee summary');

      if (float.success) setFloatSummary(float);

      const details = await getFeeDetails(20, 0, feeFilter);
      if (details.success) {
        setFeeDetails(details.data || []);
        setFeeTotal(details.total);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  }, [feeFilter]);

  useEffect(() => {
    if (isAdmin && !pinVerified) {
      setShowPinPrompt(true);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (pinVerified) loadData();
  }, [pinVerified, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const handleWithdrawRevenue = async () => {
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid amount.');
      return;
    }
    if (feeSummary && amt > feeSummary.admin_balance) {
      Alert.alert('Insufficient Revenue', `Only ${formatCurrency(feeSummary.admin_balance)} available.`);
      return;
    }
    Alert.alert(
      'Confirm Revenue Withdrawal',
      `Transfer ${formatCurrency(amt)} from fee collection account to your personal balance?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setWithdrawing(true);
            try {
              const result = await adminWithdrawRevenue(amt);
              if (result.success) {
                Alert.alert('Success', `${formatCurrency(amt)} transferred to your wallet.`);
                setWithdrawAmount('');
                await fetchProfile();
                await loadData();
              } else {
                Alert.alert('Error', result.error || 'Withdrawal failed.');
              }
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Withdrawal failed.');
            } finally {
              setWithdrawing(false);
            }
          },
        },
      ],
    );
  };

  const loadMoreFees = async () => {
    if (feeDetails.length >= feeTotal) return;
    const details = await getFeeDetails(20, feeDetails.length, feeFilter);
    if (details.success && details.data) {
      setFeeDetails((prev) => [...prev, ...details.data]);
    }
  };

  // --- Accounts tab handlers ---
  const handleUserSearch = useCallback(async (q: string) => {
    setUserSearch(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    const { data } = await adminSearchUsers(q);
    setSearchResults(data);
    setSearchLoading(false);
  }, []);

  const loadUserTxns = useCallback(async (uid: string, month: number, year: number) => {
    setTxnLoading(true);
    const startDate = new Date(year, month, 1).toISOString();
    const endDate = new Date(year, month + 1, 0, 23, 59, 59).toISOString();
    const { data, total } = await adminGetUserTransactions(uid, startDate, endDate);
    setUserTxns(data);
    setUserTxnTotal(total);
    setTxnLoading(false);
  }, []);

  const selectUser = useCallback(async (u: AdminUser) => {
    setSelectedUser(u);
    setSearchResults([]);
    setUserSearch('');
    await loadUserTxns(u.id, dateMonth, dateYear);
  }, [dateMonth, dateYear, loadUserTxns]);

  const changeMonth = useCallback((delta: number) => {
    let m = dateMonth + delta;
    let y = dateYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setDateMonth(m);
    setDateYear(y);
    if (selectedUser) loadUserTxns(selectedUser.id, m, y);
  }, [dateMonth, dateYear, selectedUser, loadUserTxns]);

  const generateStatement = useCallback(async () => {
    if (!selectedUser || userTxns.length === 0) return;
    setExporting(true);
    try {
      const period = `${MONTH_NAMES[dateMonth]} ${dateYear}`;

      // Summary calculations
      let totalIn = 0, totalOut = 0, totalFees = 0;
      userTxns.forEach((t) => {
        const isIn = t.type === 'receive' || t.type === 'topup';
        if (isIn) totalIn += t.amount;
        else totalOut += t.amount;
        totalFees += t.fee ?? 0;
      });

      // Build transaction rows HTML
      const txnRows = userTxns.map((t, i) => {
        const date = new Date(t.created_at);
        const dateStr = `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
        const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        const isIn = t.type === 'receive' || t.type === 'topup';
        const sign = isIn ? '+' : '-';
        const amtColor = isIn ? '#16a34a' : '#dc2626';
        const feeStr = t.fee ? formatCurrency(t.fee) : '-';
        const bgColor = i % 2 === 0 ? '#f9fafb' : '#ffffff';
        return `<tr style="background:${bgColor}">
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${dateStr}<br/><span style="color:#6b7280;font-size:11px;">${timeStr}</span></td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-transform:capitalize;">${t.type}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${t.recipient_name || t.note || '-'}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:${amtColor};font-weight:600;text-align:right;">${sign}${formatCurrency(t.amount)}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:right;color:#6b7280;">${feeStr}</td>
          <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${t.reference ? t.reference.slice(0, 12) + '...' : '-'}</td>
        </tr>`;
      }).join('');

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 20px; color: #1f2937; }
  .header { background: #0A6E3C; color: white; padding: 24px 28px; border-radius: 8px; margin-bottom: 24px; }
  .header h1 { margin: 0 0 4px 0; font-size: 22px; font-weight: 700; }
  .header p { margin: 2px 0; font-size: 13px; opacity: 0.9; }
  .info-grid { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  .info-card { flex: 1; min-width: 140px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px; }
  .info-card .label { font-size: 11px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .info-card .value { font-size: 18px; font-weight: 700; color: #0A6E3C; }
  .summary { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
  .summary-card { flex: 1; min-width: 100px; padding: 12px 16px; border-radius: 8px; text-align: center; }
  .summary-card .label { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
  .summary-card .value { font-size: 16px; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
  th { background: #f3f4f6; padding: 10px; font-size: 11px; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; text-align: left; border-bottom: 2px solid #e5e7eb; }
  th:nth-child(4), th:nth-child(5) { text-align: right; }
  th:last-child { text-align: center; }
  .footer { margin-top: 24px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 16px; }
</style></head><body>
  <div class="header">
    <h1>Monde Wallet</h1>
    <p>Account Statement — ${period}</p>
  </div>
  <div class="info-grid">
    <div class="info-card"><div class="label">Account Holder</div><div class="value" style="font-size:15px;">${selectedUser.full_name}</div></div>
    <div class="info-card"><div class="label">Phone</div><div class="value" style="font-size:15px;">${formatPhone(selectedUser.phone)}</div></div>
    ${selectedUser.handle ? `<div class="info-card"><div class="label">Handle</div><div class="value" style="font-size:15px;">@${selectedUser.handle}</div></div>` : ''}
    <div class="info-card"><div class="label">Balance</div><div class="value">${formatCurrency(selectedUser.balance)}</div></div>
  </div>
  <div class="summary">
    <div class="summary-card" style="background:#f0fdf4;"><div class="label">Money In</div><div class="value" style="color:#16a34a;">+${formatCurrency(totalIn)}</div></div>
    <div class="summary-card" style="background:#fef2f2;"><div class="label">Money Out</div><div class="value" style="color:#dc2626;">-${formatCurrency(totalOut)}</div></div>
    <div class="summary-card" style="background:#fffbeb;"><div class="label">Fees Paid</div><div class="value" style="color:#d97706;">${formatCurrency(totalFees)}</div></div>
    <div class="summary-card" style="background:#f3f4f6;"><div class="label">Transactions</div><div class="value">${userTxnTotal}</div></div>
  </div>
  <table>
    <thead><tr><th>Date</th><th>Type</th><th>Details</th><th style="text-align:right;">Amount</th><th style="text-align:right;">Fee</th><th style="text-align:center;">Reference</th></tr></thead>
    <tbody>${txnRows}</tbody>
  </table>
  <div class="footer">
    <p>Generated on ${new Date().toLocaleString()}</p>
    <p><strong>Monde Wallet</strong> — Tap. Pay. Done.</p>
  </div>
</body></html>`;

      // Generate PDF and share
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Monde Statement - ${selectedUser.full_name} - ${period}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        // Fallback to text share on platforms without sharing
        await Share.share({
          title: `Statement generated`,
          message: `PDF saved at: ${uri}`,
        });
      }
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Export Failed', e?.message || 'Could not export statement.');
      }
    } finally {
      setExporting(false);
    }
  }, [selectedUser, userTxns, dateMonth, dateYear, userTxnTotal]);

  const handleAdminPinConfirm = async (pin: string) => {
    setPinLoading(true);
    const { success } = await verifyPin(user?.phone || '', pin);
    setPinLoading(false);
    if (!success) {
      setPinError('Incorrect PIN. Try again.');
      return;
    }
    setPinError('');
    setShowPinPrompt(false);
    setPinVerified(true);
  };

  if (!isAdmin) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Admin</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.errorState}>
          <Ionicons name="lock-closed" size={48} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Access Denied</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            This dashboard is restricted to the Monde admin account.
          </Text>
        </View>
      </View>
    );
  }

  if (!pinVerified) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Admin Dashboard</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.errorState}>
          <Ionicons name="shield-checkmark" size={48} color={colors.primary} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Verify Identity</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>
            Enter your PIN to access the admin dashboard.
          </Text>
        </View>
        <PinConfirm
          visible={showPinPrompt}
          title="Admin Access"
          subtitle="Enter your PIN to continue"
          onConfirm={handleAdminPinConfirm}
          onCancel={() => { setShowPinPrompt(false); setPinError(''); router.back(); }}
          loading={pinLoading}
          error={pinError}
        />
      </View>
    );
  }

  const feeTypeLabel = (type: string) => {
    switch (type) {
      case 'topup_fee': return 'Top-up';
      case 'withdraw_fee': return 'Withdrawal';
      case 'payment_fee': return 'Payment';
      default: return type;
    }
  };

  const feeTypeColor = (type: string) => {
    switch (type) {
      case 'topup_fee': return colors.success;
      case 'withdraw_fee': return colors.secondary;
      case 'payment_fee': return colors.primary;
      default: return colors.textSecondary;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Admin Dashboard</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.backBtn}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['overview', 'fees', 'float', 'accounts'] as TabId[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? colors.primary : colors.textSecondary }]}>
              {tab === 'overview' ? 'Overview' : tab === 'fees' ? 'Fees' : tab === 'float' ? 'Float' : 'Accounts'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading admin data...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorState}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={[styles.errorTitle, { color: colors.text }]}>Error</Text>
          <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
          <TouchableOpacity onPress={onRefresh} style={[styles.retryBtn, { backgroundColor: colors.primary }]}>
            <Text style={[styles.retryText, { color: colors.white }]}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          {/* ====== OVERVIEW TAB ====== */}
          {activeTab === 'overview' && feeSummary && (
            <>
              {/* Revenue Card */}
              <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
                <Text style={styles.heroLabel}>Total Revenue</Text>
                <Text style={styles.heroAmount}>
                  {formatCurrency(feeSummary.total_fees_collected)}
                </Text>
                <Text style={styles.heroSub}>
                  {feeSummary.total_fee_transactions} fee transactions
                </Text>
              </View>

              {/* Fee breakdown */}
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Fee Breakdown</Text>
              <View style={styles.cardRow}>
                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                  <View style={[styles.statDot, { backgroundColor: colors.success }]} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Top-up Fees</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {formatCurrency(feeSummary.topup_fees)}
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                  <View style={[styles.statDot, { backgroundColor: colors.secondary }]} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Withdraw Fees</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {formatCurrency(feeSummary.withdraw_fees)}
                  </Text>
                </View>
              </View>
              <View style={styles.cardRow}>
                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                  <View style={[styles.statDot, { backgroundColor: colors.primary }]} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Payment Fees</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {formatCurrency(feeSummary.payment_fees)}
                  </Text>
                </View>
                <View style={[styles.statCard, { backgroundColor: colors.surface }]}>
                  <View style={[styles.statDot, { backgroundColor: colors.warning }]} />
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Admin Balance</Text>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {formatCurrency(feeSummary.admin_balance)}
                  </Text>
                </View>
              </View>

              {/* Float summary (quick) */}
              {floatSummary && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: Spacing.lg }]}>
                    System Overview
                  </Text>
                  <View style={[styles.infoRow, { backgroundColor: colors.surface }]}>
                    <View style={styles.infoItem}>
                      <Ionicons name="people" size={20} color={colors.primary} />
                      <Text style={[styles.infoValue, { color: colors.text }]}>{floatSummary.total_users}</Text>
                      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Users</Text>
                    </View>
                    <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.infoItem}>
                      <Ionicons name="wallet" size={20} color={colors.success} />
                      <Text style={[styles.infoValue, { color: colors.text }]}>{floatSummary.users_with_balance}</Text>
                      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>With Balance</Text>
                    </View>
                    <View style={[styles.infoDivider, { backgroundColor: colors.border }]} />
                    <View style={styles.infoItem}>
                      <Ionicons name="cash" size={20} color={colors.secondary} />
                      <Text style={[styles.infoValue, { color: colors.text }]}>
                        {formatCurrency(floatSummary.system_total)}
                      </Text>
                      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>System Total</Text>
                    </View>
                  </View>
                </>
              )}

              {/* Integrity check */}
              {feeSummary && (() => {
                const withdrawn = feeSummary.total_fees_collected - feeSummary.admin_balance;
                const isHealthy = feeSummary.admin_balance <= feeSummary.total_fees_collected && feeSummary.admin_balance >= 0;
                const hasWithdrawn = withdrawn > 0 && isHealthy;
                return (
                  <View style={[styles.integrityCard, {
                    backgroundColor: isHealthy
                      ? (hasWithdrawn ? colors.primary + '12' : colors.success + '15')
                      : colors.error + '15',
                  }]}>
                    <Ionicons
                      name={isHealthy ? 'checkmark-circle' : 'warning'}
                      size={20}
                      color={isHealthy ? (hasWithdrawn ? colors.primary : colors.success) : colors.error}
                    />
                    <Text style={[styles.integrityText, {
                      color: isHealthy ? (hasWithdrawn ? colors.primary : colors.success) : colors.error,
                    }]}>
                      {!isHealthy
                        ? `Discrepancy: ledger ${formatCurrency(feeSummary.total_fees_collected)} vs balance ${formatCurrency(feeSummary.admin_balance)}`
                        : hasWithdrawn
                        ? `Ledger OK — ${formatCurrency(withdrawn)} withdrawn, ${formatCurrency(feeSummary.admin_balance)} remaining`
                        : 'Ledger matches admin balance — no discrepancy'}
                    </Text>
                  </View>
                );
              })()}

              {/* Withdraw Revenue */}
              {feeSummary && feeSummary.admin_balance > 0 && (
                <>
                  <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: Spacing.lg }]}>
                    Withdraw Revenue
                  </Text>
                  <View style={[styles.withdrawCard, { backgroundColor: colors.surface }]}>
                    <Text style={[styles.withdrawHint, { color: colors.textSecondary }]}>
                      Transfer revenue from the fee collection account to your personal wallet.
                    </Text>
                    <View style={styles.withdrawRow}>
                      <View style={[styles.withdrawInput, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <Text style={[styles.withdrawPrefix, { color: colors.textSecondary }]}>K</Text>
                        <TextInput
                          style={[styles.withdrawField, { color: colors.text }]}
                          value={withdrawAmount}
                          onChangeText={(t) => { if (/^\d*\.?\d{0,2}$/.test(t)) setWithdrawAmount(t); }}
                          placeholder="0.00"
                          placeholderTextColor={colors.textLight}
                          keyboardType="decimal-pad"
                          editable={!withdrawing}
                        />
                      </View>
                      <TouchableOpacity
                        style={[styles.withdrawBtn, { backgroundColor: colors.primary, opacity: withdrawing ? 0.6 : 1 }]}
                        onPress={handleWithdrawRevenue}
                        disabled={withdrawing}
                        activeOpacity={0.7}
                      >
                        {withdrawing ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <Text style={styles.withdrawBtnText}>Withdraw</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity
                      onPress={() => setWithdrawAmount(feeSummary.admin_balance.toString())}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.withdrawAll, { color: colors.primary }]}>
                        Withdraw all ({formatCurrency(feeSummary.admin_balance)})
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </>
          )}

          {/* ====== FEE LEDGER TAB ====== */}
          {activeTab === 'fees' && (
            <>
              {/* Filter chips */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
                {[
                  { id: null, label: 'All' },
                  { id: 'topup_fee', label: 'Top-up' },
                  { id: 'withdraw_fee', label: 'Withdraw' },
                  { id: 'payment_fee', label: 'Payment' },
                ].map((f) => (
                  <TouchableOpacity
                    key={f.label}
                    style={[
                      styles.filterChip,
                      { backgroundColor: feeFilter === f.id ? colors.primary : colors.surface },
                    ]}
                    onPress={() => {
                      setFeeFilter(f.id);
                      setFeeDetails([]);
                      setLoading(true);
                    }}
                  >
                    <Text style={[
                      styles.filterChipText,
                      { color: feeFilter === f.id ? colors.white : colors.text },
                    ]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
                {feeTotal} fee record{feeTotal !== 1 ? 's' : ''}
              </Text>

              {feeDetails.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="receipt-outline" size={48} color={colors.textLight} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No fee records found</Text>
                </View>
              ) : (
                feeDetails.map((fee) => (
                  <View key={fee.id} style={[styles.feeRow, { backgroundColor: colors.surface }]}>
                    <View style={styles.feeRowTop}>
                      <View style={[styles.feeTypeBadge, { backgroundColor: feeTypeColor(fee.fee_type) + '18' }]}>
                        <Text style={[styles.feeTypeBadgeText, { color: feeTypeColor(fee.fee_type) }]}>
                          {feeTypeLabel(fee.fee_type)}
                        </Text>
                      </View>
                      <Text style={[styles.feeAmount, { color: colors.success }]}>
                        +{formatCurrency(fee.fee_amount)}
                      </Text>
                    </View>
                    <View style={styles.feeRowBottom}>
                      <Text style={[styles.feeUser, { color: colors.text }]}>
                        {fee.user_name || 'Unknown'} • {formatPhone(fee.user_phone || '')}
                      </Text>
                      <Text style={[styles.feeDate, { color: colors.textLight }]}>
                        {formatDate(fee.created_at)}
                      </Text>
                    </View>
                    <Text style={[styles.feeGross, { color: colors.textSecondary }]}>
                      Gross: {formatCurrency(fee.gross_amount)}
                    </Text>
                  </View>
                ))
              )}

              {feeDetails.length < feeTotal && (
                <TouchableOpacity
                  style={[styles.loadMoreBtn, { borderColor: colors.primary }]}
                  onPress={loadMoreFees}
                >
                  <Text style={[styles.loadMoreText, { color: colors.primary }]}>Load More</Text>
                </TouchableOpacity>
              )}
            </>
          )}

          {/* ====== FLOAT TAB ====== */}
          {activeTab === 'float' && floatSummary && (
            <>
              <View style={[styles.heroCard, { backgroundColor: colors.success }]}>
                <Text style={styles.heroLabel}>Total User Float</Text>
                <Text style={styles.heroAmount}>
                  {formatCurrency(floatSummary.total_float)}
                </Text>
                <Text style={styles.heroSub}>
                  Must match trust account balance at the bank
                </Text>
              </View>

              <View style={[styles.floatCard, { backgroundColor: colors.surface }]}>
                <FloatRow
                  icon="people" iconColor={colors.primary}
                  label="Total Users" value={String(floatSummary.total_users)}
                  colors={colors}
                />
                <FloatRow
                  icon="wallet" iconColor={colors.success}
                  label="Users with Balance" value={String(floatSummary.users_with_balance)}
                  colors={colors}
                />
                <FloatRow
                  icon="cash" iconColor={colors.secondary}
                  label="User Float" value={formatCurrency(floatSummary.total_float)}
                  colors={colors}
                />
                <FloatRow
                  icon="business" iconColor={colors.primary}
                  label="Monde Revenue" value={formatCurrency(floatSummary.admin_balance)}
                  colors={colors}
                />
                <FloatRow
                  icon="globe" iconColor={colors.warning}
                  label="System Total" value={formatCurrency(floatSummary.system_total)}
                  colors={colors} last
                />
              </View>

              <View style={[styles.integrityCard, { backgroundColor: colors.primary + '12' }]}>
                <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                <Text style={[styles.integrityText, { color: colors.primary }]}>
                  The trust account at the bank must hold at least{' '}
                  {formatCurrency(floatSummary.total_float)} to cover all user balances.
                  Monde's revenue ({formatCurrency(floatSummary.admin_balance)}) is separate.
                </Text>
              </View>
            </>
          )}

          {/* ====== ACCOUNTS TAB ====== */}
          {activeTab === 'accounts' && (
            <>
              {/* User search */}
              <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="search" size={18} color={colors.textLight} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search by name, phone, or @handle"
                  placeholderTextColor={colors.textLight}
                  value={userSearch}
                  onChangeText={handleUserSearch}
                  autoCapitalize="none"
                />
                {userSearch.length > 0 && (
                  <TouchableOpacity onPress={() => { setUserSearch(''); setSearchResults([]); }}>
                    <Ionicons name="close-circle" size={18} color={colors.textLight} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Search results */}
              {searchLoading && <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: Spacing.sm }} />}
              {searchResults.length > 0 && (
                <View style={{ marginBottom: Spacing.md }}>
                  {searchResults.map((u) => (
                    <TouchableOpacity
                      key={u.id}
                      style={[styles.userResult, { backgroundColor: colors.surface }]}
                      onPress={() => selectUser(u)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.userName, { color: colors.text }]}>{u.full_name}</Text>
                        <Text style={[styles.userPhone, { color: colors.textSecondary }]}>
                          {formatPhone(u.phone)}{u.handle ? ` · @${u.handle}` : ''}
                        </Text>
                      </View>
                      <Text style={[styles.userBalance, { color: colors.primary }]}>{formatCurrency(u.balance)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Selected user header */}
              {selectedUser && (
                <>
                  <View style={[styles.selectedUserCard, { backgroundColor: colors.primary }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.selectedUserName}>{selectedUser.full_name}</Text>
                      <Text style={styles.selectedUserPhone}>
                        {formatPhone(selectedUser.phone)}{selectedUser.handle ? ` · @${selectedUser.handle}` : ''}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.selectedUserBalLabel}>Balance</Text>
                      <Text style={styles.selectedUserBal}>{formatCurrency(selectedUser.balance)}</Text>
                    </View>
                  </View>

                  {/* Month picker */}
                  <View style={styles.monthPicker}>
                    <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.monthArrow}>
                      <Ionicons name="chevron-back" size={22} color={colors.primary} />
                    </TouchableOpacity>
                    <Text style={[styles.monthLabel, { color: colors.text }]}>
                      {MONTH_NAMES[dateMonth]} {dateYear}
                    </Text>
                    <TouchableOpacity onPress={() => changeMonth(1)} style={styles.monthArrow}>
                      <Ionicons name="chevron-forward" size={22} color={colors.primary} />
                    </TouchableOpacity>
                  </View>

                  {/* Transaction list */}
                  {txnLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: Spacing.lg }} />
                  ) : userTxns.length === 0 ? (
                    <View style={styles.emptyState}>
                      <Ionicons name="document-text-outline" size={48} color={colors.textLight} />
                      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No transactions in {MONTH_NAMES[dateMonth]} {dateYear}
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
                        {userTxnTotal} transaction{userTxnTotal !== 1 ? 's' : ''}
                      </Text>

                      {userTxns.map((txn) => {
                        const isIn = txn.type === 'receive' || txn.type === 'topup';
                        const txnColor = isIn ? colors.success : colors.error;
                        const txnDate = new Date(txn.created_at);
                        return (
                          <View key={txn.id} style={[styles.txnRow, { backgroundColor: colors.surface }]}>
                            <View style={styles.txnRowTop}>
                              <View style={[styles.txnTypeBadge, { backgroundColor: txnColor + '18' }]}>
                                <Text style={[styles.txnTypeBadgeText, { color: txnColor }]}>
                                  {txn.type.charAt(0).toUpperCase() + txn.type.slice(1)}
                                </Text>
                              </View>
                              <Text style={[styles.txnAmount, { color: txnColor }]}>
                                {isIn ? '+' : '-'}{formatCurrency(txn.amount)}
                              </Text>
                            </View>
                            <View style={styles.txnRowBottom}>
                              <Text style={[styles.txnNote, { color: colors.text }]} numberOfLines={1}>
                                {txn.recipient_name || txn.note || '—'}
                              </Text>
                              <Text style={[styles.txnDate, { color: colors.textLight }]}>
                                {txnDate.getDate()} {MONTH_NAMES[txnDate.getMonth()]} {String(txnDate.getHours()).padStart(2, '0')}:{String(txnDate.getMinutes()).padStart(2, '0')}
                              </Text>
                            </View>
                            {txn.fee != null && txn.fee > 0 && (
                              <Text style={[styles.txnFee, { color: colors.textSecondary }]}>
                                Fee: {formatCurrency(txn.fee)}
                              </Text>
                            )}
                          </View>
                        );
                      })}

                      {/* Export button */}
                      <TouchableOpacity
                        style={[styles.exportBtn, { backgroundColor: colors.primary, opacity: exporting ? 0.6 : 1 }]}
                        onPress={generateStatement}
                        disabled={exporting}
                        activeOpacity={0.7}
                      >
                        {exporting ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Ionicons name="document-text-outline" size={20} color="#fff" />
                            <Text style={styles.exportBtnText}>Export PDF Statement</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </>
                  )}

                  {/* Clear selection */}
                  <TouchableOpacity
                    onPress={() => { setSelectedUser(null); setUserTxns([]); }}
                    style={{ alignItems: 'center', paddingVertical: Spacing.md }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: FontSize.sm }}>Clear selection</Text>
                  </TouchableOpacity>
                </>
              )}

              {!selectedUser && searchResults.length === 0 && !searchLoading && (
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={48} color={colors.textLight} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Search for a user to view their account history
                  </Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function FloatRow({ icon, iconColor, label, value, colors, last }: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  label: string;
  value: string;
  colors: any;
  last?: boolean;
}) {
  return (
    <View style={[styles.floatRow, !last && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
      <Ionicons name={icon} size={18} color={iconColor} />
      <Text style={[styles.floatLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.floatValue, { color: colors.text }]}>{value}</Text>
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
    paddingVertical: Spacing.md,
  },
  backBtn: { padding: 4 },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  tab: {
    paddingBottom: Spacing.sm,
  },
  tabText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingTop: 100,
  },
  loadingText: {
    fontSize: FontSize.md,
  },
  errorState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingTop: 100,
    paddingHorizontal: Spacing.lg,
  },
  errorTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  errorText: {
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  retryBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  retryText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },

  // Hero card
  heroCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  heroLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroAmount: {
    fontSize: FontSize.hero,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  heroSub: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 4,
  },

  // Section
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },

  // Stat cards
  cardRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontWeight: '500',
    marginBottom: 2,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
  },
  infoItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  infoValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  infoLabel: {
    fontSize: FontSize.xs,
  },
  infoDivider: {
    width: 1,
    height: 36,
  },

  // Integrity
  integrityCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.lg,
  },
  integrityText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontWeight: '500',
  },

  // Fee ledger
  filterRow: {
    flexGrow: 0,
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
  },
  filterChipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  resultCount: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.sm,
  },
  feeRow: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  feeRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  feeTypeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  feeTypeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  feeAmount: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  feeRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeUser: {
    fontSize: FontSize.sm,
    fontWeight: '500',
  },
  feeDate: {
    fontSize: FontSize.xs,
  },
  feeGross: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  loadMoreBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  loadMoreText: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.md,
  },

  // Withdraw revenue
  withdrawCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  withdrawHint: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  withdrawRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  withdrawInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
  },
  withdrawPrefix: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    marginRight: 4,
  },
  withdrawField: {
    flex: 1,
    fontSize: FontSize.lg,
    fontWeight: '600',
    paddingVertical: 0,
  },
  withdrawBtn: {
    height: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  withdrawBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  withdrawAll: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: Spacing.xs,
  },

  // Float tab
  floatCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  floatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  floatLabel: {
    flex: 1,
    fontSize: FontSize.md,
  },
  floatValue: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },

  // Accounts tab
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 48,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    paddingVertical: 0,
  },
  userResult: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  userName: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  userPhone: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  userBalance: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  selectedUserCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  selectedUserName: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: '#fff',
  },
  selectedUserPhone: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
  },
  selectedUserBalLabel: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.65)',
  },
  selectedUserBal: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    color: '#fff',
  },
  monthPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  monthArrow: {
    padding: Spacing.xs,
  },
  monthLabel: {
    fontSize: FontSize.md,
    fontWeight: '700',
    minWidth: 100,
    textAlign: 'center',
  },
  txnRow: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.xs,
  },
  txnRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  txnTypeBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  txnTypeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  txnAmount: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  txnRowBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txnNote: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    flex: 1,
    marginRight: Spacing.sm,
  },
  txnDate: {
    fontSize: FontSize.xs,
  },
  txnFee: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.md,
  },
  exportBtnText: {
    color: '#fff',
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
