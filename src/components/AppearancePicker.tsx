import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { useT, type Translate } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { gradient, navy, space, useColors, useThemePreference, type ThemePreference } from '@/theme';
import { Txt, type IconName } from './ui';

export const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

export function themeLabel(t: Translate, p: ThemePreference): string {
  return p === 'light' ? t('Luminos', 'Light') : p === 'dark' ? t('Întunecat', 'Dark') : t('Automat', 'Automatic');
}

export function themeIcon(p: ThemePreference): IconName {
  return p === 'light' ? 'sunny' : p === 'dark' ? 'moon' : 'phone-portrait-outline';
}

// The two palettes as the previews draw them (background, cards, text lines, tab bar).
const MOCK = {
  light: { bg: '#F2F3F8', card: '#FFFFFF', line: 'rgba(16, 31, 50, 0.16)', bar: '#FFFFFF' },
  dark: { bg: '#060C17', card: '#132036', line: 'rgba(255, 255, 255, 0.2)', bar: '#1A2942' },
};
const W = 78;
const H = 118;

/** A tiny phone screen in one palette: the navy hero, two cards and the floating tab bar. */
function MockScreen({ mode }: { mode: 'light' | 'dark' }) {
  const m = MOCK[mode];
  return (
    <View style={[styles.mock, { backgroundColor: m.bg }]}>
      <View style={[styles.mockHero, gradient(navy.hero), { backgroundColor: navy.deep }]}>
        <View style={[styles.mockText, { width: 30, backgroundColor: 'rgba(255, 255, 255, 0.85)' }]} />
        <View style={[styles.mockText, { width: 44, height: 7, marginTop: 4, backgroundColor: '#FFFFFF' }]} />
      </View>
      <View style={[styles.mockCard, { backgroundColor: m.card }]}>
        <View style={[styles.mockText, { width: 36, backgroundColor: m.line }]} />
        <View style={[styles.mockText, { width: 22, marginTop: 4, backgroundColor: m.line }]} />
      </View>
      <View style={[styles.mockCard, { backgroundColor: m.card }]}>
        <View style={[styles.mockText, { width: 40, backgroundColor: m.line }]} />
      </View>
      <View style={[styles.mockBar, { backgroundColor: m.bar }]}>
        <View style={styles.mockDot} />
      </View>
    </View>
  );
}

/** Automatic / Light / Dark, each with a preview and a radio mark under it. */
export function AppearancePicker() {
  const c = useColors();
  const t = useT();
  const { preference, setPreference } = useThemePreference();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {THEME_OPTIONS.map((p) => {
        const selected = p === preference;
        return (
          <Pressable
            key={p}
            onPress={() => {
              if (selected) return;
              haptic.selection();
              setPreference(p);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={themeLabel(t, p)}
            style={styles.option}>
            <View style={[styles.frame, { borderColor: selected ? c.accent : c.line, borderWidth: selected ? 2 : 1 }]}>
              {p === 'system' ? (
                <View style={styles.split}>
                  <View style={styles.half}>
                    <MockScreen mode="light" />
                  </View>
                  <View style={styles.half}>
                    <View style={{ marginLeft: -W / 2 }}>
                      <MockScreen mode="dark" />
                    </View>
                  </View>
                </View>
              ) : (
                <MockScreen mode={p} />
              )}
            </View>
            <Txt variant="small" weight={selected ? '700' : '500'} tone={selected ? 'default' : 'soft'}>
              {themeLabel(t, p)}
            </Txt>
            <View
              style={[
                styles.radio,
                selected ? { backgroundColor: c.accent, borderColor: c.accent } : { borderColor: c.faint },
              ]}>
              {selected ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: space.lg, paddingHorizontal: space.sm },
  option: { alignItems: 'center', gap: space.sm },
  frame: { borderRadius: 14, padding: 3 },
  split: { flexDirection: 'row', width: W, height: H, borderRadius: 11, overflow: 'hidden' },
  half: { width: W / 2, height: H, overflow: 'hidden' },
  mock: { width: W, height: H, borderRadius: 11, overflow: 'hidden', padding: 5, gap: 4 },
  mockHero: { height: 38, borderRadius: 7, padding: 6, justifyContent: 'flex-end' },
  mockText: { height: 4, borderRadius: 2 },
  mockCard: { borderRadius: 6, padding: 6 },
  mockBar: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 5,
    height: 12,
    borderRadius: 6,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingLeft: 6,
  },
  mockDot: { width: 10, height: 6, borderRadius: 3, backgroundColor: '#465FE9' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
