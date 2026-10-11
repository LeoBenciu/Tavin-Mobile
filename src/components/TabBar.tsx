import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { haptic } from '@/lib/haptics';
import { gradient, useColors } from '@/theme';
import { CountBadge } from './ui';

const NATIVE_DRIVER = Platform.OS !== 'web';
const PILL_HEIGHT = 62;
const GAP_ABOVE = 10;

/** Room the floating tab bar takes at the bottom; 0 outside the tabs. */
export const TabBarSpaceContext = createContext(0);

export function useTabBarSpace(): number {
  return useContext(TabBarSpaceContext);
}

function bottomPadding(insetBottom: number): number {
  return Math.max(insetBottom - 4, 12);
}

/** What the tabs layout provides to its screens through TabBarSpaceContext. */
export function useTabBarSpaceValue(): number {
  const insets = useSafeAreaInsets();
  return PILL_HEIGHT + bottomPadding(insets.bottom) + GAP_ABOVE;
}

export function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setVisible(true),
    );
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setVisible(false),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}

/**
 * A floating capsule tab bar, after the iOS 26 tab bar: content scrolls underneath,
 * and a soft indigo lens slides to the selected tab.
 */
export function FloatingTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const c = useColors();
  const keyboard = useKeyboardVisible();
  const [width, setWidth] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const count = state.routes.length;
  const item = width > 0 ? (width - 8) / count : 0;
  const last = useRef({ index: state.index, item });

  useEffect(() => {
    const target = state.index * item;
    if (last.current.item !== item) x.setValue(target);
    else Animated.spring(x, { toValue: target, useNativeDriver: NATIVE_DRIVER, speed: 20, bounciness: 5 }).start();
    last.current = { index: state.index, item };
  }, [state.index, item, x]);

  if (keyboard) return null;

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: bottomPadding(insets.bottom) }]}>
      {/* Content fades out under the bar instead of being cut by it (iOS scroll edge effect). */}
      <View
        pointerEvents="none"
        style={[styles.fade, gradient(`linear-gradient(180deg, ${c.backgroundClear} 0%, ${c.background} 70%)`)]}
      />
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={[styles.pill, { backgroundColor: c.tabBar, boxShadow: c.floatShadow, borderColor: c.separator }]}
        accessibilityRole="tablist">
        {item > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.lens, { width: item, backgroundColor: c.accentSoft, transform: [{ translateX: x }] }]}
          />
        ) : null}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const focused = state.index === index;
          const color = focused ? c.accentText : c.muted;
          const label = options.title ?? route.name;
          const badge = typeof options.tabBarBadge === 'number' ? options.tabBarBadge : 0;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              haptic.selection();
              navigation.navigate(route.name, route.params);
            }
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
              style={styles.item}>
              <View>
                {options.tabBarIcon?.({ focused, color, size: 24 })}
                {badge ? <CountBadge count={badge} style={styles.badge} /> : null}
              </View>
              <Text
                style={[styles.label, { color, fontWeight: focused ? '700' : '600' }]}
                numberOfLines={1}
                maxFontSizeMultiplier={1.2}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, top: -GAP_ABOVE - 8 },
  pill: {
    height: PILL_HEIGHT,
    borderRadius: PILL_HEIGHT / 2,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: StyleSheet.hairlineWidth,
  },
  lens: { position: 'absolute', left: 4, top: 4, bottom: 4, borderRadius: (PILL_HEIGHT - 8) / 2 },
  item: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { fontSize: 10.5, letterSpacing: 0.1 },
  badge: { position: 'absolute', top: -6, right: -12, minWidth: 18, height: 18, paddingHorizontal: 5 },
});
