import { useMemo, useState, type ReactNode } from 'react';
import { Animated, Platform, RefreshControl, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space, useColors } from '@/theme';
import { useTabBarSpace } from './TabBar';
import { Txt } from './ui';

const NATIVE_DRIVER = Platform.OS !== 'web';
export const NAV_BAR_HEIGHT = 44;
/** Height of the large title block; the small title fades in once it scrolls past. */
export const LARGE_TITLE_HEIGHT = 52;

export function useCollapsingTitle() {
  const [scrollY] = useState(() => new Animated.Value(0));
  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: NATIVE_DRIVER }),
    [scrollY],
  );
  return { scrollY, onScroll };
}

/**
 * The iOS navigation bar over a large-title screen: transparent at rest, then a bar
 * with the small title fades in as the large title scrolls under it. Buttons on the
 * right stay put (unless `fadeRight`).
 */
export function NavBar({
  title,
  scrollY,
  showAt = LARGE_TITLE_HEIGHT,
  right,
  center,
  fadeRight,
  solid,
}: {
  title?: string;
  scrollY?: Animated.Value;
  showAt?: number;
  right?: ReactNode;
  center?: ReactNode;
  fadeRight?: boolean;
  /** Always show the bar (no large title under it). */
  solid?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const opacity =
    solid || !scrollY
      ? 1
      : scrollY.interpolate({ inputRange: [showAt - 14, showAt], outputRange: [0, 1], extrapolate: 'clamp' });
  return (
    <View
      pointerEvents="box-none"
      style={[styles.bar, { paddingTop: insets.top, height: insets.top + NAV_BAR_HEIGHT }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: c.bar,
            borderBottomColor: c.separator,
            borderBottomWidth: StyleSheet.hairlineWidth,
            opacity,
          },
        ]}
      />
      <Animated.View pointerEvents="none" style={[styles.center, { top: insets.top, opacity }]}>
        {center ?? (
          <Txt variant="title" numberOfLines={1}>
            {title}
          </Txt>
        )}
      </Animated.View>
      <Animated.View style={[styles.right, fadeRight ? { opacity } : null]} pointerEvents="box-none">
        {right}
      </Animated.View>
    </View>
  );
}

export function LargeTitle({ title, eyebrow }: { title: string; eyebrow?: string | null }) {
  return (
    <View style={styles.largeTitle}>
      {eyebrow ? (
        <Txt variant="label" tone="muted" numberOfLines={1} style={styles.eyebrow}>
          {eyebrow}
        </Txt>
      ) : null}
      <Txt variant="largeTitle" numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Txt>
    </View>
  );
}

/**
 * A tab's page: large title that collapses into the nav bar, pull-to-refresh, and
 * room for the floating tab bar at the bottom.
 */
export function TabScreen({
  title,
  eyebrow,
  actions,
  children,
  refreshing,
  onRefresh,
  contentStyle,
}: {
  title: string;
  eyebrow?: string | null;
  actions?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const { scrollY, onScroll } = useCollapsingTitle();
  const titleBlock = (eyebrow ? 18 : 0) + LARGE_TITLE_HEIGHT;
  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      <Animated.ScrollView
        style={{ marginTop: insets.top }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[
          styles.content,
          { paddingTop: NAV_BAR_HEIGHT, paddingBottom: (tabSpace || insets.bottom) + space.xl },
          contentStyle,
        ]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={c.muted}
              colors={[c.accent]}
              progressViewOffset={NAV_BAR_HEIGHT}
            />
          ) : undefined
        }>
        <LargeTitle title={title} eyebrow={eyebrow} />
        {children}
      </Animated.ScrollView>
      <NavBar title={title} scrollY={scrollY} showAt={titleBlock} right={actions} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: space.lg, flexGrow: 1 },
  bar: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 },
  center: {
    position: 'absolute',
    left: 88,
    right: 88,
    height: NAV_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  right: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  largeTitle: {
    paddingHorizontal: 2,
    paddingBottom: space.sm,
    minHeight: LARGE_TITLE_HEIGHT,
    justifyContent: 'flex-end',
  },
  eyebrow: { marginBottom: 2 },
});
