import { Platform, useColorScheme, type ViewStyle } from 'react-native';

/**
 * Tavin's palette, the same as the web app's (client/src/tavin-tokens.css): coral is the
 * one main action on a screen and what is urgent (the text on it is navy, never white);
 * indigo is links, selection and "in progress"; navy the dark grounds; green / amber / red
 * strictly semantic. Light mode is one white ground: blocks are set apart by space, not by
 * cards and shadows, and only the main figure on a screen gets a panel of its own.
 */
const light = {
  background: '#FFFFFF',
  /** The background at zero alpha, for fades into it. */
  backgroundClear: 'rgba(255, 255, 255, 0)',
  surface: '#FFFFFF',
  /** Highlighted (pressed) cell. */
  surfaceAlt: '#ECEEF4',
  /** Search fields, segmented track, secondary fills (iOS tertiary fill). */
  fill: 'rgba(118, 126, 145, 0.13)',
  /** Selected segment of a segmented control. */
  thumb: '#FFFFFF',
  line: '#E3E7EE',
  separator: 'rgba(16, 31, 50, 0.1)',
  text: '#101F32',
  textSoft: '#344054',
  muted: '#5F6B7E',
  /** Placeholders, chevrons, disabled glyphs. */
  faint: '#A3ACBA',
  chip: '#F1F3F7',
  /** The screen's main button, and what is urgent. Never text on a light ground (2.8:1). */
  action: '#FF6B5B',
  actionPressed: '#F25A4A',
  /** Text and glyphs on coral: navy, 5.9:1. */
  onAction: '#101F32',
  actionSoft: '#FFF0ED',
  onActionSoft: '#101F32',
  accent: '#465FE9',
  accentPressed: '#354BC7',
  accentText: '#465FE9',
  accentSoft: '#EEF0FD',
  accentLine: '#D9DEFB',
  anchor: '#F5F6FE',
  good: '#15803D',
  goodSoft: '#ECFDF5',
  warn: '#B45309',
  warnSoft: '#FFFBEB',
  danger: '#B91C1C',
  dangerSoft: '#FEF2F2',
  onAccent: '#FFFFFF',
  overlay: 'rgba(7, 15, 28, 0.42)',
  /** Navigation bar and pinned footers. Opaque: without a blur, see-through bars just look muddy. */
  bar: '#FFFFFF',
  /** The floating tab bar capsule. */
  tabBar: '#FFFFFF',
  /** Single-series chart fill (validated ≥3:1 on surface). */
  chart: '#465FE9',
  chartRest: '#D9DEFB',
  floatShadow: '0px 1px 2px rgba(16, 31, 50, 0.06), 0px 18px 40px -16px rgba(16, 31, 50, 0.32)',
};

const dark: typeof light = {
  background: '#060C17',
  backgroundClear: 'rgba(6, 12, 23, 0)',
  surface: '#0F1A2B',
  surfaceAlt: '#18253A',
  fill: 'rgba(255, 255, 255, 0.08)',
  thumb: '#2A3954',
  line: '#22304A',
  separator: 'rgba(255, 255, 255, 0.08)',
  text: '#F1F4F8',
  textSoft: '#C5CDD9',
  muted: '#8A97AB',
  faint: '#56647A',
  chip: '#1B283B',
  action: '#FF6B5B',
  actionPressed: '#FF8172',
  onAction: '#101F32',
  actionSoft: 'rgba(255, 107, 91, 0.16)',
  onActionSoft: '#FFB3A9',
  accent: '#465FE9',
  accentPressed: '#5A71F0',
  accentText: '#A8B5FF',
  accentSoft: 'rgba(70, 95, 233, 0.2)',
  accentLine: 'rgba(168, 181, 255, 0.3)',
  anchor: '#152039',
  good: '#4ADE80',
  goodSoft: 'rgba(34, 197, 94, 0.16)',
  warn: '#FBBF24',
  warnSoft: 'rgba(251, 191, 36, 0.14)',
  danger: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.14)',
  onAccent: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.6)',
  bar: '#0A1322',
  tabBar: '#132036',
  chart: '#6B80F0',
  chartRest: 'rgba(107, 128, 240, 0.28)',
  floatShadow: '0px 0px 0px 0.5px rgba(255, 255, 255, 0.08), 0px 18px 40px -12px rgba(0, 0, 0, 0.7)',
};

/** The landing page's hero and dark bands: the same in light and dark mode. */
export const navy = {
  ink: '#101F32',
  deep: '#0B1726',
  night: '#070F1C',
  indigoLight: '#A8B5FF',
  onNavy: '#FFFFFF',
  onNavySoft: '#C5CDD9',
  onNavyMuted: '#8A97AB',
  glass: 'rgba(255, 255, 255, 0.08)',
  glassStrong: 'rgba(255, 255, 255, 0.14)',
  glassLine: 'rgba(255, 255, 255, 0.14)',
  /** radial-gradient(120% 80% at 50% 0%, #142a4f, deep 45%, night) from .lp-hero */
  hero: 'radial-gradient(120% 90% at 50% 0%, #142A4F 0%, #0B1726 48%, #070F1C 100%)',
  heroGlow: 'radial-gradient(60% 55% at 50% 0%, rgba(70, 95, 233, 0.5) 0%, rgba(70, 95, 233, 0) 70%)',
  heroGlowSide: 'radial-gradient(45% 50% at 100% 100%, rgba(124, 92, 255, 0.22) 0%, rgba(124, 92, 255, 0) 70%)',
} as const;

export type Colors = typeof light;
/** 'urgent' is the coral tone: overdue, asked for by the accountant, needs you now. */
export type Tone = 'neutral' | 'accent' | 'good' | 'warn' | 'danger' | 'urgent';
/** Icon tile palettes: the semantic tones plus a few for menus, as in iOS Settings. */
export type TileTone = Tone | 'sky' | 'violet' | 'slate';

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

/**
 * Widest a column of content gets. On iPad (and resized iPad windows) pages stay a
 * readable column centred on screen instead of stretching edge to edge.
 */
export const CONTENT_MAX_WIDTH = 720;
export const column = { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' } as const;
export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;
export const font = {
  caption: 12,
  footnote: 13,
  small: 14,
  body: 16,
  title: 17,
  heading: 22,
  display: 30,
  largeTitle: 34,
} as const;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}

export function toneColors(c: Colors, tone: Tone): { fg: string; bg: string; dot?: string } {
  switch (tone) {
    case 'urgent':
      return { fg: c.onActionSoft, bg: c.actionSoft, dot: c.action };
    case 'accent':
      return { fg: c.accentText, bg: c.accentSoft };
    case 'good':
      return { fg: c.good, bg: c.goodSoft };
    case 'warn':
      return { fg: c.warn, bg: c.warnSoft };
    case 'danger':
      return { fg: c.danger, bg: c.dangerSoft };
    default:
      return { fg: c.textSoft, bg: c.fill };
  }
}

/** Two-stop gradients for solid icon tiles (white glyph on top), after .lp-reason-icon. */
const TILE: Record<TileTone, [string, string]> = {
  accent: ['#465FE9', '#7C8CFF'],
  good: ['#15803D', '#34C76F'],
  warn: ['#D97706', '#FBBF24'],
  danger: ['#DC2626', '#F87171'],
  urgent: ['#FF6B5B', '#FF8F7F'],
  neutral: ['#5F6B7E', '#97A3B6'],
  sky: ['#0284C7', '#5CC8F5'],
  violet: ['#6D4AE8', '#A48BFF'],
  slate: ['#334155', '#64748B'],
};

export function tileColors(tone: TileTone): [string, string] {
  return TILE[tone];
}

/**
 * A CSS gradient as a view background. Native reads `experimental_backgroundImage`
 * (new architecture); react-native-web passes `backgroundImage` straight to CSS.
 */
export function gradient(css: string): ViewStyle {
  return Platform.OS === 'web' ? ({ backgroundImage: css } as ViewStyle) : { experimental_backgroundImage: css };
}

export function tileGradient(tone: TileTone, angle = 145): ViewStyle {
  const [from, to] = TILE[tone];
  return { backgroundColor: from, ...gradient(`linear-gradient(${angle}deg, ${from}, ${to})`) };
}

/** The main button: coral with a soft glow underneath (--tv-coral-shadow on the web). */
export const actionGlow = 'inset 0px 1px 0px rgba(255, 255, 255, 0.28), 0px 14px 32px -12px rgba(255, 107, 91, 0.6)';
/** Indigo glow, for the logo tile and selected indigo controls. */
export const accentGlow = '0px 10px 24px -10px rgba(70, 95, 233, 0.85)';
export const accentGlowStrong =
  'inset 0px 1px 0px rgba(255, 255, 255, 0.22), 0px 0px 0px 1px rgba(168, 181, 255, 0.3), 0px 14px 32px -12px rgba(70, 95, 233, 0.95)';
