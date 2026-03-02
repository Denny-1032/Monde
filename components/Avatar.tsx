import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors, BorderRadius, FontSize } from '../constants/theme';
import { useColors } from '../constants/useColors';
import { getInitials } from '../lib/helpers';

type AvatarProps = {
  name: string;
  size?: number;
  color?: string;
  imageUrl?: string | null;
};

export default function Avatar({ name, size = 44, color, imageUrl }: AvatarProps) {
  const themeColors = useColors();
  const bgColor = color || themeColors.primary;
  const fontSize = size * 0.38;

  if (imageUrl) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: themeColors.surfaceAlt }}
      />
    );
  }

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: bgColor }]}>
      <Text style={[styles.text, { fontSize }]}>{getInitials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: Colors.white,
    fontWeight: '700',
  },
});
