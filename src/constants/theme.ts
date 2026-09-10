/**
 * Design system — "Warm Paper Fintech"
 * Off-white paper background, raised white surfaces, deep emerald accent.
 * Red is reserved exclusively for overdue / loss. Never decorative.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#141412',
    textSecondary: '#6E6E66',
    background: '#F6F5F1',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EDECE6',
    border: '#E3E2DB',
    accent: '#0B6E4F',
    accentSoft: '#E1EFE9',
    onAccent: '#FFFFFF',
    danger: '#B3352C',
    dangerSoft: '#F9E8E5',
    warning: '#9A5B00',
    warningSoft: '#F8EEDA',
    success: '#0B6E4F',
    successSoft: '#E1EFE9',
  },
  dark: {
    text: '#F2F1EC',
    textSecondary: '#A3A399',
    background: '#0C0D0F',
    backgroundElement: '#17181B',
    backgroundSelected: '#242629',
    border: '#2C2E32',
    accent: '#3ED9A2',
    accentSoft: '#13281F',
    onAccent: '#07130E',
    danger: '#FF7C6E',
    dangerSoft: '#2C1613',
    warning: '#F2B75C',
    warningSoft: '#2A2012',
    success: '#3ED9A2',
    successSoft: '#13281F',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Radii = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  pill: 999,
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
