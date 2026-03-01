import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors, Spacing, BorderRadius } from '../constants/theme';

function SkeletonBlock({ width, height, style }: { width: number | string; height: number; style?: any }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: BorderRadius.md, backgroundColor: Colors.border, opacity },
        style,
      ]}
    />
  );
}

export function HomeSkeleton() {
  return (
    <View style={styles.container}>
      {/* Header skeleton */}
      <View style={styles.row}>
        <View>
          <SkeletonBlock width={160} height={20} />
          <SkeletonBlock width={200} height={14} style={{ marginTop: 8 }} />
        </View>
        <SkeletonBlock width={36} height={36} style={{ borderRadius: 18 }} />
      </View>

      {/* Balance card skeleton */}
      <SkeletonBlock width="100%" height={140} style={{ marginTop: Spacing.lg, borderRadius: BorderRadius.xl }} />

      {/* Quick actions skeleton */}
      <View style={[styles.row, { marginTop: Spacing.xl, gap: Spacing.md }]}>
        <SkeletonBlock width="48%" height={120} style={{ borderRadius: BorderRadius.xl }} />
        <SkeletonBlock width="48%" height={120} style={{ borderRadius: BorderRadius.xl }} />
      </View>

      {/* Transactions skeleton */}
      <SkeletonBlock width={140} height={16} style={{ marginTop: Spacing.xl }} />
      {[1, 2, 3].map((i) => (
        <View key={i} style={[styles.row, { marginTop: Spacing.md }]}>
          <SkeletonBlock width={44} height={44} style={{ borderRadius: 22 }} />
          <View style={{ flex: 1, marginLeft: Spacing.md }}>
            <SkeletonBlock width="60%" height={14} />
            <SkeletonBlock width="40%" height={12} style={{ marginTop: 6 }} />
          </View>
          <SkeletonBlock width={60} height={14} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
