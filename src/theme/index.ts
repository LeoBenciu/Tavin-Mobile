import { useColorScheme } from 'react-native';

/** Tavin's "calm" palette, shared with tavin.eu (client/src/index.css). */
const light = {
  background: '#EFF1F6',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F9FB',
  line: '#E3E7EE',
  text: '#101F32',
  textSoft: '#344054',
  muted: '#5F6B7E',
  chip: '#F1F3F7',
  accent: '#465FE9',
  accentPressed: '#354BC7',
  accentText: '#465FE9',
  accentSoft: '#EEF0FD',
  anchor: '#F5F6FE',
  good: '#15803D',
  goodSoft: '#ECFDF5',
  warn: '#B45309',
  warnSoft: '#FFFBEB',
  danger: '#B91C1C',
  dangerSoft: '#FEF2F2',
  onAccent: '#FFFFFF',
  overlay: 'rgba(16, 31, 50, 0.45)',
  /** Single-series chart fill (validated ≥3:1 on surface). */
  chart: '#465FE9',
};

const dark: typeof light = {
  background: '#0A111C',
  surface: '#111B2A',
  surfaceAlt: '#172335',
  line: '#243247',
  text: '#F1F4F8',
  textSoft: '#C5CDD9',
  muted: '#8A97AB',
  chip: '#1B283B',
  accent: '#465FE9',
  accentPressed: '#5A71F0',
  accentText: '#A8B5FF',
  accentSoft: 'rgba(70, 95, 233, 0.18)',
  anchor: '#152039',
  good: '#4ADE80',
  goodSoft: 'rgba(34, 197, 94, 0.16)',
  warn: '#FBBF24',
  warnSoft: 'rgba(251, 191, 36, 0.14)',
  danger: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.14)',
  onAccent: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.6)',
  chart: '#6B80F0',
};

export type Colors = typeof light;
export type Tone = 'neutral' | 'accent' | 'good' | 'warn' | 'danger';

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const font = {
  caption: 12,
  small: 13,
  body: 15,
  title: 17,
  heading: 22,
  display: 28,
} as const;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}

export function toneColors(c: Colors, tone: Tone): { fg: string; bg: string } {
  switch (tone) {
    case 'accent':
      return { fg: c.accentText, bg: c.accentSoft };
    case 'good':
      return { fg: c.good, bg: c.goodSoft };
    case 'warn':
      return { fg: c.warn, bg: c.warnSoft };
    case 'danger':
      return { fg: c.danger, bg: c.dangerSoft };
    default:
      return { fg: c.textSoft, bg: c.chip };
  }
}
