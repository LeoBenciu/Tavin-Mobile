import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { radius, space, useColors, type Tone, toneColors } from '@/theme';
import { Divider, Txt, type IconName } from './ui';

/** Bottom sheet over a dimmed backdrop. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  fullHeight,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  fullHeight?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]} onPress={onClose} />
        <View style={styles.spacer} pointerEvents="box-none" />
        <View
          style={[
            styles.sheet,
            fullHeight && { height: '88%' },
            { backgroundColor: c.surface, paddingBottom: insets.bottom + space.md },
          ]}>
          <View style={[styles.grabber, { backgroundColor: c.line }]} />
          {title ? (
            <View style={styles.header}>
              <Txt variant="title" style={{ flex: 1 }}>
                {title}
              </Txt>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button">
                <Ionicons name="close" size={24} color={c.muted} />
              </Pressable>
            </View>
          ) : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export type SheetAction = {
  label: string;
  icon?: IconName;
  tone?: Tone;
  onPress: () => void;
  hidden?: boolean;
};

/** A list of actions (the mobile equivalent of a row's "…" menu). */
export function ActionSheet({
  visible,
  onClose,
  title,
  actions,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  actions: SheetAction[];
}) {
  const c = useColors();
  const shown = actions.filter((a) => !a.hidden);
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {shown.map((a, i) => {
        const tc = toneColors(c, a.tone ?? 'neutral');
        return (
          <View key={a.label}>
            {i > 0 ? <Divider inset={space.lg} /> : null}
            <Pressable
              onPress={() => {
                onClose();
                // Let the sheet close before the action opens anything else.
                setTimeout(a.onPress, Platform.OS === 'ios' ? 350 : 0);
              }}
              style={({ pressed }) => [styles.action, pressed && { backgroundColor: c.surfaceAlt }]}>
              {a.icon ? <Ionicons name={a.icon} size={20} color={a.tone ? tc.fg : c.textSoft} /> : null}
              <Txt weight="500" style={a.tone && a.tone !== 'neutral' ? { color: tc.fg } : undefined}>
                {a.label}
              </Txt>
            </Pressable>
          </View>
        );
      })}
    </Sheet>
  );
}

/** Searchable single-choice list (clients, articles, gestiuni…). */
export function PickerSheet<T>({
  visible,
  onClose,
  title,
  items,
  keyOf,
  labelOf,
  sublabelOf,
  onSelect,
  selectedKey,
  footer,
  emptyText,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  items: T[];
  keyOf: (item: T) => string | number;
  labelOf: (item: T) => string;
  sublabelOf?: (item: T) => string | null | undefined;
  onSelect: (item: T) => void;
  selectedKey?: string | number | null;
  footer?: ReactNode;
  emptyText?: string;
}) {
  const c = useColors();
  const t = useT();
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((it) => `${labelOf(it)} ${sublabelOf?.(it) ?? ''}`.toLowerCase().includes(needle));
  }, [items, q, labelOf, sublabelOf]);

  return (
    <Sheet visible={visible} onClose={onClose} title={title} fullHeight>
      <View style={[styles.search, { backgroundColor: c.chip }]}>
        <Ionicons name="search" size={18} color={c.muted} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder={t('Caută…', 'Search…')}
          placeholderTextColor={c.muted}
          style={[styles.searchInput, { color: c.text }]}
          autoCorrect={false}
        />
      </View>
      {footer}
      <FlatList
        data={filtered}
        keyExtractor={(it) => String(keyOf(it))}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <Divider inset={space.lg} />}
        ListEmptyComponent={
          <Txt tone="muted" style={styles.empty}>
            {emptyText ?? t('Niciun rezultat.', 'No results.')}
          </Txt>
        }
        renderItem={({ item }) => {
          const selected = selectedKey != null && keyOf(item) === selectedKey;
          const sub = sublabelOf?.(item);
          return (
            <Pressable
              onPress={() => {
                onSelect(item);
                setQ('');
                onClose();
              }}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: c.surfaceAlt }]}>
              <View style={{ flex: 1 }}>
                <Txt weight="500" numberOfLines={1}>
                  {labelOf(item)}
                </Txt>
                {sub ? (
                  <Txt variant="small" tone="muted" numberOfLines={1}>
                    {sub}
                  </Txt>
                ) : null}
              </View>
              {selected ? <Ionicons name="checkmark" size={20} color={c.accentText} /> : null}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  spacer: { flex: 1 },
  sheet: { borderTopLeftRadius: radius.lg + 4, borderTopRightRadius: radius.lg + 4, maxHeight: '92%' },
  grabber: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.md },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
  },
  searchInput: { flex: 1, minHeight: 44, fontSize: 15 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 52,
  },
  empty: { textAlign: 'center', padding: space.xl },
});
