import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { useColors } from '../constants/useColors';

type Props = {
  onPress: (key: string) => void;
  onDelete: () => void;
  onSubmit?: () => void;
  showDecimal?: boolean;
};

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
];

export default function NumPad({ onPress, onDelete, onSubmit, showDecimal = true }: Props) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      {KEYS.map((row, i) => (
        <View key={i} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity key={key} style={[styles.key, { backgroundColor: colors.surface }]} onPress={() => onPress(key)} activeOpacity={0.7}>
              <Text style={[styles.keyText, { color: colors.primary }]}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <View style={styles.row}>
        {showDecimal ? (
          <TouchableOpacity style={[styles.key, { backgroundColor: colors.surface }]} onPress={() => onPress('.')} activeOpacity={0.7}>
            <Text style={[styles.keyText, { color: colors.primary }]}>.</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.keyEmpty} />
        )}
        <TouchableOpacity style={[styles.key, { backgroundColor: colors.surface }]} onPress={() => onPress('0')} activeOpacity={0.7}>
          <Text style={[styles.keyText, { color: colors.primary }]}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.key, { backgroundColor: colors.surface }]} onPress={onDelete} activeOpacity={0.7}>
          <Ionicons name="backspace-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: Spacing.md,
  },
  key: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 36,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 3,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
    }),
  },
  keyEmpty: {
    width: 72,
    height: 72,
  },
  keyText: {
    fontSize: 28,
    fontWeight: '500',
  },
});
