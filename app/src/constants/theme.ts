/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // Genspark Palette
    background: '#F5F3FA',
    backgroundSecondary: '#EDEAF6',
    card: '#FFFFFF',
    cardSecondary: '#FAF8FE',
    text: '#1F1B2E',
    textSecondary: '#5B5673',
    textMuted: '#8E89A6',
    primary: '#7C6BE0',
    primaryDeep: '#5F4FC7',
    primarySoft: '#EAE5FA',
    primaryTint: '#F3F0FB',
    success: '#5FA971',
    warning: '#D89652',
    // Fallbacks for older components
    backgroundElement: '#EDEAF6',
    backgroundSelected: '#EAE5FA',
  },
  dark: {
    background: '#1F1B2E',
    backgroundSecondary: '#29253B',
    card: '#29253B',
    cardSecondary: '#312C45',
    text: '#FFFFFF',
    textSecondary: '#A09CB3',
    textMuted: '#6C6785',
    primary: '#8F81E6',
    primaryDeep: '#A59AEC',
    primarySoft: '#3A3266',
    primaryTint: '#2C264D',
    success: '#75C088',
    warning: '#E2AB70',
    // Fallbacks
    backgroundElement: '#29253B',
    backgroundSelected: '#3A3266',
  },
} as const;

export const Radius = {
  card: 24,
  button: 16,
  chip: 999,
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

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
