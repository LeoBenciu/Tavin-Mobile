import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { haptic } from '@/lib/haptics';
import { formatAmount, formatMoneyShort } from '@/lib/format';
import { gradient, space, useColors } from '@/theme';
import { Amount, Txt } from './ui';

/**
 * Single-series column chart (one value per month). Tap a column to read its
 * value; the selected column carries the indigo gradient, the others recede.
 */
export function MonthlyBars({
  data,
  height = 140,
  emptyLabel,
}: {
  data: { label: string; value: number }[];
  height?: number;
  emptyLabel: string;
}) {
  const c = useColors();
  const [selected, setSelected] = useState<number | null>(null);
  const max = Math.max(0, ...data.map((d) => d.value));
  const active = selected ?? data.length - 1;

  if (data.length === 0 || max <= 0) {
    return (
      <Txt tone="muted" style={styles.empty}>
        {emptyLabel}
      </Txt>
    );
  }

  const current = data[active]?.value ?? 0;
  const [amount, currency] = splitMoney(formatMoneyShort(current));

  return (
    <View>
      <View style={styles.readout}>
        <Txt variant="footnote" tone="muted" weight="500">
          {data[active]?.label}
        </Txt>
        <Amount value={amount} currency={currency} size="display" />
      </View>
      <View style={[styles.plot, { height }]}>
        {data.map((d, i) => {
          const h = Math.max(6, (Math.max(0, d.value) / max) * (height - 8));
          const on = i === active;
          return (
            <Pressable
              key={`${d.label}-${i}`}
              onPress={() => {
                if (!on) haptic.selection();
                setSelected(i);
              }}
              style={styles.hit}
              accessibilityLabel={`${d.label}: ${formatAmount(d.value)}`}>
              <View
                style={[
                  styles.column,
                  { height: h, backgroundColor: on ? c.chart : c.chartRest },
                  on ? [gradient('linear-gradient(180deg, #7C8CFF, #465FE9)'), styles.columnGlow] : null,
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {data.map((d, i) => (
          <Txt
            key={`${d.label}-${i}`}
            variant="caption"
            tone={i === active ? 'accent' : 'muted'}
            weight={i === active ? '700' : '500'}
            style={styles.axisLabel}
            numberOfLines={1}>
            {d.label.slice(0, 3)}
          </Txt>
        ))}
      </View>
    </View>
  );
}

/** Ranked horizontal bars with the label and value written out (top clients, expense classes…). */
export function RankedBars({
  items,
  currency = 'RON',
  limit = 8,
}: {
  items: { label: string; value: number; sub?: string }[];
  currency?: string;
  limit?: number;
}) {
  const c = useColors();
  const shown = items.slice(0, limit);
  const max = Math.max(0, ...shown.map((i) => i.value));
  return (
    <View style={{ gap: space.lg }}>
      {shown.map((it, idx) => (
        <View key={`${it.label}-${idx}`}>
          <View style={styles.rankHead}>
            <Txt variant="small" weight="500" style={{ flex: 1 }} numberOfLines={1}>
              {it.label}
            </Txt>
            <Txt variant="small" weight="700" tabular>
              {formatMoneyShort(it.value, currency)}
            </Txt>
          </View>
          <View style={[styles.track, { backgroundColor: c.fill }]}>
            <View
              style={[
                styles.fill,
                { width: `${max > 0 ? Math.max(3, (it.value / max) * 100) : 0}%`, backgroundColor: c.chart },
                gradient('linear-gradient(90deg, #465FE9, #7C8CFF)'),
              ]}
            />
          </View>
          {it.sub ? (
            <Txt variant="caption" tone="muted" style={{ marginTop: 4 }}>
              {it.sub}
            </Txt>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** "12.480 RON" → ["12.480", "RON"] */
export function splitMoney(formatted: string): [string, string] {
  const i = formatted.lastIndexOf(' ');
  return i > 0 ? [formatted.slice(0, i), formatted.slice(i + 1)] : [formatted, ''];
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', paddingVertical: space.xl },
  readout: { marginBottom: space.md, gap: 2 },
  plot: { flexDirection: 'row', alignItems: 'flex-end' },
  // 4px gap between adjacent columns; the hit target is the whole slot.
  hit: { flex: 1, height: '100%', justifyContent: 'flex-end', paddingHorizontal: 2 },
  column: { borderRadius: 6 },
  columnGlow: { boxShadow: '0px 8px 18px -8px rgba(70, 95, 233, 0.9)' },
  axis: { flexDirection: 'row', marginTop: 6 },
  axisLabel: { flex: 1, textAlign: 'center', fontSize: 10.5 },
  rankHead: { flexDirection: 'row', gap: space.sm, marginBottom: 6 },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
});
