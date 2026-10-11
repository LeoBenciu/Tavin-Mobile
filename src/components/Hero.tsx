import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { accentGlowStrong, gradient, navy, radius, space, tileGradient } from '@/theme';

/**
 * The landing page's hero ground (.lp-hero): navy deepening into night, with an
 * indigo glow from the top and a faint violet one from the corner.
 */
export function NavyBackdrop({ style, children }: { style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return (
    <View style={[styles.base, gradient(navy.hero), style]} pointerEvents={children ? 'box-none' : 'none'}>
      <View style={[StyleSheet.absoluteFill, gradient(navy.heroGlow)]} pointerEvents="none" />
      <View style={[StyleSheet.absoluteFill, gradient(navy.heroGlowSide)]} pointerEvents="none" />
      {children}
    </View>
  );
}

/** The Tavin "T" on an indigo tile with the call-to-action glow. */
export function LogoMark({ size = 64 }: { size?: number }) {
  return (
    <View
      style={[
        styles.logo,
        { width: size, height: size, borderRadius: Math.round(size * 0.28) },
        tileGradient('accent'),
        { boxShadow: accentGlowStrong },
      ]}>
      <Text style={[styles.logoText, { fontSize: size * 0.52 }]}>T</Text>
    </View>
  );
}

/** Glass chip on navy with a pulsing-style dot (.lp-hero-eyebrow). */
export function GlassChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <View style={styles.chipDot} />
      <Text style={styles.chipText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** A headline figure on a navy card with the hero glow (bank balance, what's owed). */
export function BalanceCard({
  label,
  amount,
  currency,
  tone = 'default',
  footer,
}: {
  label: string;
  /** Formatted number without the currency. */
  amount: string;
  currency: string;
  tone?: 'default' | 'warn' | 'good';
  footer?: ReactNode;
}) {
  const color = tone === 'warn' ? '#FCD34D' : tone === 'good' ? '#86EFAC' : '#FFFFFF';
  return (
    <NavyBackdrop style={styles.balance}>
      <Text style={styles.balanceLabel}>{label}</Text>
      <Text style={[styles.balanceAmount, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {amount}
        <Text style={styles.balanceCurrency}> {currency}</Text>
      </Text>
      {footer ? <View style={styles.balanceFooter}>{footer}</View> : null}
    </NavyBackdrop>
  );
}

const styles = StyleSheet.create({
  balance: {
    borderRadius: radius.lg + 4,
    padding: space.lg + 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    boxShadow: '0px 24px 48px -24px rgba(7, 15, 28, 0.7)',
  },
  balanceLabel: {
    color: navy.onNavyMuted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  balanceAmount: {
    marginTop: space.xs,
    fontSize: 36,
    lineHeight: 42,
    fontWeight: '700',
    letterSpacing: -1.2,
    fontVariant: ['tabular-nums'],
  },
  balanceCurrency: { fontSize: 17, fontWeight: '600', letterSpacing: 0, color: navy.onNavySoft },
  balanceFooter: { marginTop: space.md, flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  base: { backgroundColor: navy.deep, overflow: 'hidden' },
  logo: { alignItems: 'center', justifyContent: 'center' },
  logoText: { color: '#FFFFFF', fontWeight: '800', letterSpacing: -1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 5,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: navy.glassLine,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    maxWidth: '100%',
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: navy.indigoLight,
    boxShadow: '0px 0px 0px 4px rgba(168, 181, 255, 0.18)',
  },
  chipText: { color: navy.onNavySoft, fontSize: 13, fontWeight: '500', flexShrink: 1 },
});
