import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius, Providers } from '../constants/theme';
import { Provider } from '../constants/types';

type Props = {
  selected: Provider | null;
  onSelect: (provider: Provider) => void;
};

export default function ProviderPicker({ selected, onSelect }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.container}>
      {Providers.map((p) => {
        const isSelected = selected?.id === p.id;
        return (
          <TouchableOpacity
            key={p.id}
            style={[styles.chip, isSelected && { borderColor: p.color, backgroundColor: p.color + '15' }]}
            onPress={() => onSelect(p as unknown as Provider)}
            activeOpacity={0.7}
          >
            <View style={[styles.dot, { backgroundColor: p.color }]} />
            <Text style={[styles.label, isSelected && { color: p.color, fontWeight: '700' }]}>{p.name}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    gap: Spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  label: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
});
