import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
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
            <TouchableOpacity key={key} style={styles.key} onPress={() => onPress(key)} activeOpacity={0.6}>
              <Text style={[styles.keyText, { color: colors.text }]}>{key}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ))}
      <View style={styles.row}>
        {showDecimal ? (
          <TouchableOpacity style={styles.key} onPress={() => onPress('.')} activeOpacity={0.6}>
            <Text style={[styles.keyText, { color: colors.text }]}>.</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.key} />
        )}
        <TouchableOpacity style={styles.key} onPress={() => onPress('0')} activeOpacity={0.6}>
          <Text style={[styles.keyText, { color: colors.text }]}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.key} onPress={onDelete} activeOpacity={0.6}>
          <Ionicons name="backspace-outline" size={26} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  key: {
    width: 75,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  keyText: {
    fontSize: FontSize.xl + 4,
    fontWeight: '500',
  },
});
