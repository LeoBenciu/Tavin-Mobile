import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space, useColors } from '@/theme';
import { useTabBarSpace } from './TabBar';

/**
 * Scrollable page body with pull-to-refresh, on the grouped background. Headers come
 * from the navigator; on iOS the scroll view adjusts its insets itself so large titles
 * collapse into the bar as it scrolls.
 */
export function Screen({
  children,
  refreshing,
  onRefresh,
  footer,
  contentStyle,
  keyboard,
  scroll = true,
  insetAdjust = true,
}: {
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Pinned under the scroll area (e.g. a primary action). */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  /** Lift content above the keyboard (forms). */
  keyboard?: boolean;
  scroll?: boolean;
  /** iOS automatic content insets (off inside sheets). */
  insetAdjust?: boolean;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const tabSpace = useTabBarSpace();
  const autoInsets = Platform.OS === 'ios' && insetAdjust;
  // With automatic insets iOS already keeps content clear of the home indicator.
  const bottom = footer ? space.lg : tabSpace ? tabSpace + space.lg : (autoInsets ? 0 : insets.bottom) + space.xl;
  const body = scroll ? (
    <ScrollView
      style={{ flex: 1 }}
      contentInsetAdjustmentBehavior={autoInsets ? 'automatic' : 'never'}
      contentContainerStyle={[styles.content, { paddingBottom: bottom }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.muted} colors={[c.accent]} />
        ) : undefined
      }>
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  );

  const inner = (
    <>
      {body}
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: insets.bottom + space.sm, backgroundColor: c.bar, borderTopColor: c.separator },
          ]}>
          {footer}
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {keyboard ? (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}>
          {inner}
        </KeyboardAvoidingView>
      ) : (
        inner
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.sm, flexGrow: 1 },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
});
