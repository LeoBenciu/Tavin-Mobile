import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  Extrapolation,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import { radius, space, useColors, type Tone, toneColors } from '@/theme';
import { Divider, SearchField, Txt, type IconName } from './ui';

/** The iOS sheet curve: rises from the bottom edge and settles without overshoot. */
const EASE_SHEET = Easing.bezier(0.32, 0.72, 0, 1);
const OPEN_MS = 340;
const CLOSE_MS = 240;
const FADE_MS = 180;
// Reanimated skips every animation under the system's reduced motion by default. The fade is the
// gentle form reduced motion keeps, so it opts out of that.
const FADE = { duration: FADE_MS, reduceMotion: ReduceMotion.Never };

/** Where a flick would come to rest if it kept decelerating (Apple's decay form). */
function project(velocity: number, decelerationRate = 0.998) {
  'worklet';
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Past the top, the sheet follows the finger less and less instead of stopping dead. */
function rubberband(overshoot: number, dimension: number, constant = 0.55) {
  'worklet';
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}

/**
 * Bottom sheet over a dimmed backdrop, shaped like an iOS sheet. It rises from the bottom edge
 * while the backdrop fades in, and it goes back the way it came: closing slides it down before it
 * unmounts. The grabber and the title bar drag it, and a flick down is enough to dismiss it.
 * With reduced motion it only fades.
 */
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
  const reduced = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();

  // Mounted outlives `visible` by the length of the exit, so the sheet can leave on screen.
  const [mounted, setMounted] = useState(visible);
  // How far below its resting place the sheet sits (0 = open), and its measured height.
  const offset = useSharedValue(windowHeight);
  const height = useSharedValue(windowHeight);
  const drag = useSharedValue(0);
  // Reduced motion: the same open/close, as opacity only.
  const fade = useSharedValue(0);

  if (visible && !mounted) setMounted(true);

  // The gesture is built once, so a parent's inline onClose does not rebuild it (and drop a drag)
  // on every render: a flick only counts itself, and the effect below calls the latest onClose.
  const flickCount = useSharedValue(0);
  const [flicks, setFlicks] = useState(0);
  const handledFlicks = useRef(0);
  useEffect(() => {
    if (flicks === handledFlicks.current) return;
    handledFlicks.current = flicks;
    onClose();
  }, [flicks, onClose]);

  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      if (reduced) {
        offset.set(0);
        fade.set(withTiming(1, FADE));
      } else {
        fade.set(1);
        offset.set(withTiming(0, { duration: OPEN_MS, easing: EASE_SHEET }));
      }
      return;
    }
    const done = (finished?: boolean) => {
      'worklet';
      if (finished) scheduleOnRN(setMounted, false);
    };
    if (reduced) fade.set(withTiming(0, FADE, done));
    else offset.set(withTiming(height.get(), { duration: CLOSE_MS, easing: EASE_SHEET }, done));
  }, [visible, mounted, reduced, offset, fade, height]);

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(!reduced)
        .activeOffsetY([-10, 10])
        .failOffsetX([-20, 20])
        .onStart(() => {
          // Grabbed mid-flight: carry on from where the eye last saw it.
          cancelAnimation(offset);
          drag.set(offset.get());
        })
        .onUpdate((e) => {
          const next = drag.get() + e.translationY;
          offset.set(next >= 0 ? next : rubberband(next, height.get()));
        })
        .onEnd((e) => {
          const projected = offset.get() + project(e.velocityY);
          if (projected > height.get() * 0.4) {
            offset.set(
              withSpring(height.get(), {
                duration: 300,
                dampingRatio: 1,
                velocity: e.velocityY,
                overshootClamping: true,
              }),
            );
            const n = flickCount.get() + 1;
            flickCount.set(n);
            scheduleOnRN(setFlicks, n);
          } else {
            offset.set(withSpring(0, { duration: 300, dampingRatio: 0.8, velocity: e.velocityY }));
            if (offset.get() > 24) scheduleOnRN(haptic.light);
          }
        }),
    [reduced, offset, drag, height, flickCount],
  );

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: fade.get() * interpolate(offset.get(), [0, height.get()], [1, 0], Extrapolation.CLAMP),
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: fade.get(),
    transform: [{ translateY: offset.get() }],
  }));

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Inside a Modal, Android needs its own gesture root. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: c.overlay }, backdropStyle]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('Închide', 'Close')} />
          </Animated.View>
          <View style={styles.spacer} pointerEvents="box-none" />
          <Animated.View
            onLayout={(e) => height.set(e.nativeEvent.layout.height)}
            style={[
              styles.sheet,
              fullHeight && { height: '90%' },
              { backgroundColor: c.background, paddingBottom: insets.bottom + space.md },
              sheetStyle,
            ]}>
            <GestureDetector gesture={pan}>
              <View collapsable={false}>
                <View style={styles.grabberArea}>
                  <View style={[styles.grabber, { backgroundColor: c.faint }]} />
                </View>
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
              </View>
            </GestureDetector>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
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
                // Let the sheet finish leaving before the action opens anything else (iOS shows
                // one modal at a time).
                setTimeout(a.onPress, Platform.OS === 'ios' ? CLOSE_MS + 120 : 0);
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
  // The visible grabber is small; the area that catches the drag is not.
  grabberArea: { paddingTop: 6, paddingBottom: 2, alignItems: 'center' },
  grabber: { width: 36, height: 5, borderRadius: 3, opacity: 0.5 },
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
