import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useT } from '@/i18n';
import { radius, space, useColors, type Tone, toneColors } from '@/theme';
import { Divider, SearchField, Txt, type IconName } from './ui';

/** Bottom sheet over a dimmed backdrop, shaped like an iOS sheet. */
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
  const t = useT();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }]}
          onPress={onClose}
          accessibilityLabel={t('Închide', 'Close')}
        />
        <View style={styles.spacer} pointerEvents="box-none" />
        <View
          style={[
            styles.sheet,
            fullHeight && { height: '90%' },
            { backgroundColor: c.background, paddingBottom: insets.bottom + space.md },
          ]}>
          <View style={[styles.grabber, { backgroundColor: c.faint }]} />
          {title ? (
            <View style={styles.header}>
              <Txt variant="title" style={styles.headerTitle} numberOfLines={1}>
                {title}
              </Txt>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={t('Închide', 'Close')}
                style={({ pressed }) => [styles.close, { backgroundColor: c.fill, opacity: pressed ? 0.6 : 1 }]}>
                <Ionicons name="close" size={18} color={c.muted} />
              </Pressable>
            </View>
          ) : (
            <View style={{ height: space.md }} />
          )}
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

/** A list of actions (the mobile equivalent of a row's "…" menu), grouped like an iOS menu. */
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
  const regular = shown.filter((a) => a.tone !== 'danger');
  const destructive = shown.filter((a) => a.tone === 'danger');
  const group = (list: SheetAction[]) => (
    <View style={[styles.group, { backgroundColor: c.surface }]}>
      {list.map((a, i) => {
        const tc = toneColors(c, a.tone ?? 'neutral');
        const colored = a.tone && a.tone !== 'neutral';
        return (
          <View key={a.label}>
            {i > 0 ? <Divider inset={a.icon ? 52 : space.lg} /> : null}
            <Pressable
              onPress={() => {
                onClose();
                // Let the sheet close before the action opens anything else.
                setTimeout(a.onPress, Platform.OS === 'ios' ? 350 : 0);
              }}
              style={({ pressed }) => [styles.action, pressed && { backgroundColor: c.surfaceAlt }]}>
              {a.icon ? (
                <Ionicons name={a.icon} size={21} color={colored ? tc.fg : c.accentText} style={styles.actionIcon} />
              ) : null}
              <Txt weight="500" style={colored ? { color: tc.fg } : undefined}>
                {a.label}
              </Txt>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.groups}>
        {regular.length > 0 ? group(regular) : null}
        {destructive.length > 0 ? group(destructive) : null}
      </View>
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
      <SearchField value={q} onChangeText={setQ} placeholder={t('Caută', 'Search')} style={styles.search} />
      {footer ? <View style={[styles.footerGroup, { backgroundColor: c.surface }]}>{footer}</View> : null}
      <FlatList
        data={filtered}
        keyExtractor={(it) => String(keyOf(it))}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        style={[styles.list, { backgroundColor: c.surface }]}
        contentContainerStyle={{ flexGrow: 1 }}
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
                <Txt weight={selected ? '600' : '500'} numberOfLines={1}>
                  {labelOf(item)}
                </Txt>
                {sub ? (
                  <Txt variant="small" tone="muted" numberOfLines={1}>
                    {sub}
                  </Txt>
                ) : null}
              </View>
              {selected ? <Ionicons name="checkmark" size={21} color={c.accentText} /> : null}
            </Pressable>
          );
        }}
      />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  spacer: { flex: 1 },
  sheet: { borderTopLeftRadius: radius.xl + 6, borderTopRightRadius: radius.xl + 6, maxHeight: '94%' },
  grabber: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 6, opacity: 0.5 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 56,
    paddingTop: space.sm,
    paddingBottom: space.md,
    minHeight: 48,
  },
  headerTitle: { textAlign: 'center' },
  close: {
    position: 'absolute',
    right: space.lg,
    top: space.sm,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groups: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.sm },
  group: { borderRadius: radius.md + 2, overflow: 'hidden' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    minHeight: 52,
  },
  actionIcon: { width: 24, textAlign: 'center' },
  search: { marginHorizontal: space.lg, marginBottom: space.md },
  footerGroup: { marginHorizontal: space.lg, marginBottom: space.md, borderRadius: radius.md + 2, overflow: 'hidden' },
  list: { marginHorizontal: space.lg, borderRadius: radius.md + 2 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    minHeight: 54,
  },
  empty: { textAlign: 'center', padding: space.xl },
});
