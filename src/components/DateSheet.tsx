import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLanguage, useT, type Language } from '@/i18n';
import { isoDay } from '@/lib/format';
import { haptic } from '@/lib/haptics';
import { space, useColors } from '@/theme';
import { Sheet } from './Sheet';
import { Chip, Txt } from './ui';

const MONTHS: Record<Language, string[]> = {
  ro: [
    'ianuarie',
    'februarie',
    'martie',
    'aprilie',
    'mai',
    'iunie',
    'iulie',
    'august',
    'septembrie',
    'octombrie',
    'noiembrie',
    'decembrie',
  ],
  en: [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ],
};
const MONTHS_SHORT: Record<Language, string[]> = {
  ro: ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
/** Monday first, as Romanian calendars are. */
const WEEKDAYS: Record<Language, string[]> = {
  ro: ['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'],
  en: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
};

function parseIso(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** "2026-10-11" → "11 oct. 2026" / "11 Oct 2026". */
export function formatDay(iso: string, language: Language): string {
  const d = parseIso(iso);
  if (!d) return iso;
  return `${d.getDate()} ${MONTHS_SHORT[language][d.getMonth()]} ${d.getFullYear()}`;
}

/** A month calendar in a sheet: tap a day to pick it (iOS inline date picker). */
export function DateSheet({
  title,
  value,
  onChange,
  onClose,
  shortcuts,
}: {
  title: string;
  value: string;
  onChange: (iso: string) => void;
  onClose: () => void;
  /** Quick picks above the calendar (e.g. "Today", "30 days"). */
  shortcuts?: { label: string; value: string }[];
}) {
  const c = useColors();
  const t = useT();
  const { language } = useLanguage();
  const initial = parseIso(value) ?? new Date();
  const [month, setMonth] = useState({ y: initial.getFullYear(), m: initial.getMonth() });
  const today = isoDay();

  const first = new Date(month.y, month.m, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));

  const shift = (delta: number) => {
    haptic.selection();
    setMonth(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };
  const pick = (iso: string) => {
    haptic.selection();
    onChange(iso);
    onClose();
  };

  return (
    <Sheet visible onClose={onClose} title={title}>
      <View style={styles.body}>
        {shortcuts?.length ? (
          <View style={styles.shortcuts}>
            {shortcuts.map((s) => (
              <Chip key={s.label} size="sm" label={s.label} active={s.value === value} onPress={() => pick(s.value)} />
            ))}
          </View>
        ) : null}
        <View style={[styles.calendar, { backgroundColor: c.surface }]}>
          <View style={styles.head}>
            <Txt variant="title" style={{ flex: 1 }}>
              {`${MONTHS[language][month.m].replace(/^./, (ch) => ch.toUpperCase())} ${month.y}`}
            </Txt>
            <Pressable
              onPress={() => shift(-1)}
              hitSlop={8}
              accessibilityLabel={t('Luna anterioară', 'Previous month')}
              style={({ pressed }) => [styles.arrow, { backgroundColor: c.fill, opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="chevron-back" size={18} color={c.accentText} />
            </Pressable>
            <Pressable
              onPress={() => shift(1)}
              hitSlop={8}
              accessibilityLabel={t('Luna următoare', 'Next month')}
              style={({ pressed }) => [styles.arrow, { backgroundColor: c.fill, opacity: pressed ? 0.6 : 1 }]}>
              <Ionicons name="chevron-forward" size={18} color={c.accentText} />
            </Pressable>
          </View>
          <View style={styles.week}>
            {WEEKDAYS[language].map((d, i) => (
              <Txt key={i} variant="caption" tone="muted" weight="600" style={styles.weekday}>
                {d.toUpperCase()}
              </Txt>
            ))}
          </View>
          {weeks.map((week, w) => (
            <View key={w} style={styles.week}>
              {week.map((day, i) => {
                if (day == null) return <View key={i} style={styles.cell} />;
                const iso = isoDay(new Date(month.y, month.m, day));
                const selected = iso === value;
                const isToday = iso === today;
                return (
                  <Pressable
                    key={i}
                    onPress={() => pick(iso)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={formatDay(iso, language)}
                    style={styles.cell}>
                    <View style={[styles.day, selected && { backgroundColor: c.accent }]}>
                      <Txt
                        weight={selected || isToday ? '700' : '400'}
                        tone={selected ? 'onAccent' : isToday ? 'accent' : 'default'}
                        tabular>
                        {day}
                      </Txt>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.md },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  calendar: { borderRadius: 18, padding: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: 4, marginBottom: space.sm },
  arrow: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', paddingVertical: 6 },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 2 },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
