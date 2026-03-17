import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '../constants/theme';
import { useColors } from '../constants/useColors';

type Props = {
  onPress: (key: string) => void;
  onDelete: () => void;
  onSubmit?: () => void;
  showDecimal?: boolean;
};

const { width: SCREEN_W } = Dimensions.get('window');
const PAD_H_PADDING = Spacing.lg;
const GAP = 12;
const KEY_W = (SCREEN_W - PAD_H_PADDING * 2 - GAP * 2) / 3;
const KEY_H = Math.min(KEY_W * 0.62, 56);

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

export default function NumPad({ onPress, onDelete, onSubmit, showDecimal = true }: Props) {
  const colors = useColors();
  return (
    <View style={[styles.container, { paddingHorizontal: PAD_H_PADDING }]}>
      {KEYS.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.key, { backgroundColor: colors.surface }]}
              onPress={() => onPress(key)}
              activeOpacity={0.6}
            >
              <Text style={[styles.keyText, { color: colors.text }]}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <View style={styles.row}>
        {showDecimal ? (
          <TouchableOpacity
            style={[styles.key, { backgroundColor: colors.surface }]}
            onPress={() => onPress('.')}
            activeOpacity={0.6}
          >
            <Text style={[styles.keyText, { color: colors.text }]}>.</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.key} />
        )}
        <TouchableOpacity
          style={[styles.key, { backgroundColor: colors.surface }]}
          onPress={() => onPress('0')}
          activeOpacity={0.6}
        >
          <Text style={[styles.keyText, { color: colors.text }]}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.key, { backgroundColor: 'transparent' }]}
          onPress={onDelete}
          activeOpacity={0.6}
        >
          <Ionicons name="backspace-outline" size={26} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: GAP,
    marginBottom: GAP,
  },
  key: {
    width: KEY_W,
    height: KEY_H,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  keyText: {
    fontSize: 24,
    fontWeight: '500',
  },
});
