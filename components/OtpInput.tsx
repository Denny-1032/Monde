import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, FontSize, Spacing, BorderRadius } from '../constants/theme';

interface OtpInputProps {
  length?: number;
  onComplete: (code: string) => void;
  error?: string;
  loading?: boolean;
  onResend?: () => void;
  resendCooldown?: number;
}

export default function OtpInput({
  length = 6,
  onComplete,
  error,
  loading,
  onResend,
  resendCooldown = 60,
}: OtpInputProps) {
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(resendCooldown);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown > 0]);

  useEffect(() => {
    if (code.length === length) {
      onComplete(code);
    }
  }, [code]);

  const handleChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, length);
    setCode(cleaned);
  };

  const handleResend = () => {
    if (cooldown > 0 || !onResend) return;
    onResend();
    setCooldown(resendCooldown);
    setCode('');
  };

  const boxes = Array.from({ length }, (_, i) => code[i] || '');

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.boxRow}
        activeOpacity={1}
        onPress={() => inputRef.current?.focus()}
      >
        {boxes.map((digit, i) => (
          <View
            key={i}
            style={[
              styles.box,
              i === code.length && styles.boxActive,
              error && styles.boxError,
            ]}
          >
            <Text style={styles.boxText}>{digit}</Text>
          </View>
        ))}
      </TouchableOpacity>

      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={code}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        autoFocus
        caretHidden
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {onResend ? (
        <TouchableOpacity
          style={styles.resendBtn}
          onPress={handleResend}
          disabled={cooldown > 0}
        >
          <Text style={[styles.resendText, cooldown > 0 && styles.resendDisabled]}>
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  boxRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  box: {
    width: 44,
    height: 52,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: {
    borderColor: Colors.primary,
  },
  boxError: {
    borderColor: Colors.error,
  },
  boxText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
  error: {
    color: Colors.error,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  resendBtn: {
    paddingVertical: Spacing.sm,
  },
  resendText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  resendDisabled: {
    color: Colors.textLight,
  },
});
