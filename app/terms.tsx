import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';

export default function TermsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Terms & Privacy</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.heading, { color: colors.text }]}>Terms of Service</Text>
        <Text style={[styles.updated, { color: colors.textLight }]}>Last updated: March 2026</Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Acceptance of Terms</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          By creating an account or using the Monde mobile wallet application ("App"), you agree to be bound by these Terms of Service. If you do not agree, do not use the App.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>2. Eligibility</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          You must be at least 18 years old and a resident of Zambia to use this service. You must provide accurate personal information during registration.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>3. Account Security</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          You are responsible for maintaining the confidentiality of your PIN and any activity under your account. Notify us immediately if you suspect unauthorized access.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>4. Transactions</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          All transactions are subject to applicable fees displayed before confirmation. Completed transactions cannot be reversed except in cases of verified fraud or system error.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>5. Prohibited Activities</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          You may not use the App for money laundering, fraud, financing of terrorism, or any other illegal activity. We reserve the right to suspend accounts engaged in prohibited activities.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>6. Limitation of Liability</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Monde is not liable for losses resulting from unauthorized access to your account, network failures, or third-party payment provider issues beyond our control.
        </Text>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <Text style={[styles.heading, { color: colors.text }]}>Privacy Policy</Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Information We Collect</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          We collect your name, phone number, transaction history, and device information to provide and improve our services.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>How We Use Your Information</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Your information is used to process transactions, verify your identity, prevent fraud, and communicate service updates. We do not sell your personal data to third parties.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Security</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          We use industry-standard encryption and security measures to protect your data. PINs are hashed and never stored in plain text.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Data Retention</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          Transaction records are retained as required by Zambian financial regulations. You may request account deletion by contacting support.
        </Text>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Contact</Text>
        <Text style={[styles.body, { color: colors.textSecondary }]}>
          For questions about these terms or our privacy practices, contact us at support@monde.co.zm.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
  heading: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    marginBottom: Spacing.xs,
  },
  updated: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  body: {
    fontSize: FontSize.sm,
    lineHeight: 22,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.xl,
  },
});
