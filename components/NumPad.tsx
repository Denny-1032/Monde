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
const COL_GAP = 20;
const ROW_GAP = 16;
const PAD_H = 32;
const KEY_SIZE = Math.min((SCREEN_W - PAD_H * 2 - COL_GAP * 2) / 3, 80);

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

export default function NumPad({ onPress, onDelete, onSubmit, showDecimal = true }: Props) {
  const colors = useColors();

  const keyBg = colors.surface;
  const keyText = colors.primary;

  return (
    <View style={[styles.container, { paddingHorizontal: PAD_H }]}>
      {KEYS.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key}
              style={[styles.key, { backgroundColor: keyBg }]}
              onPress={() => onPress(key)}
              activeOpacity={0.6}
            >
              <Text style={[styles.keyText, { color: keyText }]}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <View style={styles.row}>
        {showDecimal ? (
          <TouchableOpacity
            style={[styles.key, { backgroundColor: keyBg }]}
            onPress={() => onPress('.')}
            activeOpacity={0.6}
          >
            <Text style={[styles.keyText, { color: keyText }]}>.</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.key} />
        )}
        <TouchableOpacity
          style={[styles.key, { backgroundColor: keyBg }]}
          onPress={() => onPress('0')}
          activeOpacity={0.6}
        >
          <Text style={[styles.keyText, { color: keyText }]}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.key, { backgroundColor: keyBg }]}
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
    gap: COL_GAP,
    marginBottom: ROW_GAP,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: KEY_SIZE / 2,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '500',
  },
});
