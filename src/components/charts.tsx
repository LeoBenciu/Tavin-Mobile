import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatAmount, formatMoneyShort } from '@/lib/format';
import { space, useColors } from '@/theme';
import { Txt } from './ui';

/**
 * Single-series column chart (one value per month). Tap a column to read its
 * value; the selected column stays the same hue, the others recede.
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

  return (
    <View>
      <View style={styles.readout}>
        <Txt variant="caption" tone="muted">
          {data[active]?.label}
        </Txt>
        <Txt variant="title" weight="700">
          {formatMoneyShort(data[active]?.value ?? 0)}
        </Txt>
      </View>
      <View style={[styles.plot, { height, borderBottomColor: c.line }]}>
        {data.map((d, i) => {
          const h = Math.max(2, (Math.max(0, d.value) / max) * (height - 8));
          return (
            <Pressable
              key={`${d.label}-${i}`}
              onPress={() => setSelected(i)}
              style={styles.hit}
              accessibilityLabel={`${d.label}: ${formatAmount(d.value)}`}>
              <View
                style={[styles.column, { height: h, backgroundColor: c.chart, opacity: i === active ? 1 : 0.45 }]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.axis}>
        {data.map((d, i) => (
          <Txt key={`${d.label}-${i}`} variant="caption" tone="muted" style={styles.axisLabel} numberOfLines={1}>
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
    <View style={{ gap: space.md }}>
      {shown.map((it, idx) => (
        <View key={`${it.label}-${idx}`}>
          <View style={styles.rankHead}>
            <Txt variant="small" style={{ flex: 1 }} numberOfLines={1}>
              {it.label}
            </Txt>
            <Txt variant="small" weight="600">
              {formatMoneyShort(it.value, currency)}
            </Txt>
          </View>
          <View style={[styles.track, { backgroundColor: c.chip }]}>
            <View
              style={[
                styles.fill,
                { width: `${max > 0 ? Math.max(2, (it.value / max) * 100) : 0}%`, backgroundColor: c.chart },
              ]}
            />
          </View>
          {it.sub ? (
            <Txt variant="caption" tone="muted" style={{ marginTop: 2 }}>
              {it.sub}
            </Txt>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: 'center', paddingVertical: space.xl },
  readout: { marginBottom: space.sm },
  plot: { flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: StyleSheet.hairlineWidth },
  // 2px gap between adjacent columns; the hit target is the whole slot.
  hit: { flex: 1, height: '100%', justifyContent: 'flex-end', paddingHorizontal: 1 },
  column: { borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { flexDirection: 'row', marginTop: 4 },
  axisLabel: { flex: 1, textAlign: 'center', fontSize: 10 },
  rankHead: { flexDirection: 'row', gap: space.sm, marginBottom: 4 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4 },
});
