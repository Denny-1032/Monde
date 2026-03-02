import { useMemo } from 'react';
import { useTheme } from './ThemeContext';
import type { ColorScheme } from './theme';

/**
 * Hook that returns the current theme colors.
 * Use this instead of importing Colors directly to support dark mode.
 */
export function useColors(): ColorScheme {
  const { colors } = useTheme();
  return colors;
}

/**
 * Create a StyleSheet that responds to theme changes.
 * Pass a factory function that receives the current colors and
 * calls StyleSheet.create() internally.
 */
export function useThemedStyles<T>(factory: (colors: ColorScheme) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [colors]);
}
