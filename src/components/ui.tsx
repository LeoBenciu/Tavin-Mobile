import { Ionicons } from '@expo/vector-icons';
import { Children, forwardRef, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type AccessibilityRole,
  type AccessibilityState,
  type Insets,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useT } from '@/i18n';
import { haptic } from '@/lib/haptics';
import {
  accentGlow,
  accentGlowStrong,
  font,
  navy,
  radius,
  space,
  tileGradient,
  toneColors,
  useColors,
  type TileTone,
  type Tone,
} from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

const NATIVE_DRIVER = Platform.OS !== 'web';
const HAIRLINE = StyleSheet.hairlineWidth;

// ── Text ──

type TxtVariant = 'largeTitle' | 'display' | 'heading' | 'title' | 'body' | 'small' | 'footnote' | 'caption' | 'label';
type TxtTone = 'default' | 'soft' | 'muted' | 'faint' | 'accent' | 'good' | 'warn' | 'danger' | 'onAccent';

/** iOS text styles, with the landing page's tight tracking on the big sizes. */
const variantStyle: Record<TxtVariant, TextStyle> = {
  largeTitle: { fontSize: font.largeTitle, lineHeight: 41, fontWeight: '700', letterSpacing: -0.6 },
  display: { fontSize: font.display, lineHeight: 36, fontWeight: '700', letterSpacing: -0.8 },
  heading: { fontSize: font.heading, lineHeight: 28, fontWeight: '700', letterSpacing: -0.4 },
  title: { fontSize: font.title, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: font.body, lineHeight: 21 },
  small: { fontSize: font.small, lineHeight: 19 },
  footnote: { fontSize: font.footnote, lineHeight: 18 },
  caption: { fontSize: font.caption, lineHeight: 16 },
  label: { fontSize: font.footnote, lineHeight: 18, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
};

export function Txt({
  variant = 'body',
  tone = 'default',
  weight,
  tabular,
  style,
  ...props
}: TextProps & { variant?: TxtVariant; tone?: TxtTone; weight?: TextStyle['fontWeight']; tabular?: boolean }) {
  const c = useColors();
  const color = {
    default: c.text,
    soft: c.textSoft,
    muted: c.muted,
    faint: c.faint,
    accent: c.accentText,
    good: c.good,
    warn: c.warn,
    danger: c.danger,
    onAccent: c.onAccent,
  }[tone];
  return (
    <Text
      {...props}
      style={[
        variantStyle[variant],
        { color },
        weight ? { fontWeight: weight } : null,
        tabular ? styles.tabular : null,
        style,
      ]}
    />
  );
}

/** An amount with the currency set smaller beside it: 46.210 RON. */
export function Amount({
  value,
  currency = 'RON',
  size = 'display',
  tone = 'default',
  color,
  style,
}: {
  /** Already formatted number ("46.210" or "1.234,50"). */
  value: string;
  currency?: string;
  size?: 'largeTitle' | 'display' | 'heading' | 'title';
  tone?: TxtTone;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const unit = { largeTitle: 17, display: 16, heading: 14, title: 13 }[size];
  return (
    <Txt
      variant={size}
      tone={tone}
      tabular
      numberOfLines={1}
      adjustsFontSizeToFit
      style={[color ? { color } : null, style]}>
      {value}
      <Text style={{ fontSize: unit, fontWeight: '600', letterSpacing: 0 }}> {currency}</Text>
    </Txt>
  );
}

// ── Press feedback ──

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Pressable that settles down a little while held, like iOS controls. */
export function Tap({
  children,
  onPress,
  onLongPress,
  disabled,
  style,
  pressedStyle,
  scaleTo = 0.97,
  hitSlop,
  accessibilityRole,
  accessibilityLabel,
  accessibilityState,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  hitSlop?: number | Insets;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityState?: AccessibilityState;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const [pressed, setPressed] = useState(false);
  const settle = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: NATIVE_DRIVER,
      speed: 48,
      bounciness: to === 1 ? 5 : 0,
    }).start();
  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      onPressIn={() => {
        setPressed(true);
        if (scaleTo !== 1) settle(scaleTo);
      }}
      onPressOut={() => {
        setPressed(false);
        if (scaleTo !== 1) settle(1);
      }}
      style={[style, pressed ? pressedStyle : null, { transform: [{ scale }] }]}>
      {children}
    </AnimatedPressable>
  );
}

// ── Surfaces ──

export function Card({
  children,
  style,
  onPress,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  padded?: boolean;
}) {
  const c = useColors();
  const base = [
    styles.card,
    { backgroundColor: c.surface, boxShadow: c.cardShadow },
    padded && styles.cardPadded,
    style,
  ];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Tap onPress={onPress} style={base} scaleTo={0.98}>
      {children}
    </Tap>
  );
}

/**
 * Section heading. `large` is the bold, sentence-case header of iOS content screens
 * (Health, Fitness); `small` is the grey caps header of grouped settings lists.
 */
export function SectionTitle({
  title,
  action,
  size = 'large',
}: {
  title: string;
  action?: { label: string; onPress: () => void };
  size?: 'large' | 'small';
}) {
  const large = size === 'large';
  return (
    <View style={[styles.sectionTitle, large ? styles.sectionTitleLarge : styles.sectionTitleSmall]}>
      <Txt
        variant={large ? 'title' : 'label'}
        tone={large ? 'default' : 'muted'}
        style={large ? styles.sectionLarge : null}>
        {title}
      </Txt>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={10} style={styles.sectionAction}>
          <Txt variant="small" tone="accent" weight="600">
            {action.label}
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  const c = useColors();
  return <View style={{ height: HAIRLINE, backgroundColor: c.separator, marginLeft: inset }} />;
}

/** Rounded-square icon. Solid: white glyph on a gradient (iOS Settings, .lp-reason-icon); soft: tinted. */
export function IconTile({
  icon,
  tone = 'accent',
  solid,
  size = 32,
  glow,
}: {
  icon: IconName;
  tone?: TileTone;
  solid?: boolean;
  size?: number;
  glow?: boolean;
}) {
  const c = useColors();
  const tileRadius = Math.round(size * 0.28);
  if (solid) {
    return (
      <View
        style={[
          styles.tile,
          { width: size, height: size, borderRadius: tileRadius },
          tileGradient(tone),
          glow ? { boxShadow: accentGlow } : null,
        ]}>
        <Ionicons name={icon} size={Math.round(size * 0.56)} color="#FFFFFF" />
      </View>
    );
  }
  const tc = toneColors(c, isTone(tone) ? tone : 'accent');
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: tileRadius, backgroundColor: tc.bg }]}>
      <Ionicons name={icon} size={Math.round(size * 0.55)} color={tc.fg} />
    </View>
  );
}

function isTone(t: TileTone): t is Tone {
  return t === 'neutral' || t === 'accent' || t === 'good' || t === 'warn' || t === 'danger';
}

/** Red count bubble (tab bar, menu rows, tiles). */
export function CountBadge({ count, style }: { count: number; style?: StyleProp<ViewStyle> }) {
  if (!count) return null;
  return (
    <View style={[styles.badge, { backgroundColor: BADGE_RED }, style]}>
      <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

// ── Rows ──

export function ListRow({
  icon,
  leading,
  iconTone = 'accent',
  solid,
  title,
  subtitle,
  value,
  valueTone,
  right,
  onPress,
  chevron,
  numberOfLines = 1,
  badge,
  titleTone,
  bold,
  below,
}: {
  icon?: IconName;
  /** Custom element in the icon slot (e.g. an avatar). */
  leading?: ReactNode;
  iconTone?: TileTone;
  /** White glyph on a gradient tile, as in iOS Settings. */
  solid?: boolean;
  title: string;
  subtitle?: string | null;
  value?: string | null;
  valueTone?: TxtTone;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  numberOfLines?: number;
  badge?: number;
  titleTone?: TxtTone;
  bold?: boolean;
  /** Under the subtitle, e.g. a status pill (keeps long titles from being squeezed). */
  below?: ReactNode;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? { backgroundColor: c.surfaceAlt } : null]}>
      {leading ?? (icon ? <IconTile icon={icon} tone={iconTone} solid={solid} /> : null)}
      <View style={styles.rowBody}>
        <Txt weight={bold ? '600' : '500'} tone={titleTone} numberOfLines={numberOfLines}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="small" tone="muted" numberOfLines={numberOfLines}>
            {subtitle}
          </Txt>
        ) : null}
        {below ? <View style={styles.rowBelow}>{below}</View> : null}
      </View>
      {value ? (
        <Txt weight="600" tone={valueTone} tabular style={styles.rowValue}>
          {value}
        </Txt>
      ) : null}
      {right}
      {badge ? <CountBadge count={badge} /> : null}
      {(chevron ?? !!onPress) ? <Ionicons name="chevron-forward" size={17} color={c.faint} /> : null}
    </Pressable>
  );
}

export function ToggleRow({
  icon,
  iconTone,
  solid,
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  icon?: IconName;
  iconTone?: TileTone;
  solid?: boolean;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <ListRow
      icon={icon}
      iconTone={iconTone}
      solid={solid}
      title={title}
      subtitle={subtitle}
      numberOfLines={2}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ true: c.accent, false: Platform.OS === 'ios' ? undefined : c.line }}
          thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
          ios_backgroundColor={c.fill}
        />
      }
      chevron={false}
    />
  );
}

// ── Buttons ──

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

/** Capsule buttons; the primary one carries the landing page's indigo glow. */
export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  size = 'md',
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const palette = {
    primary: { bg: c.accent, fg: c.onAccent },
    secondary: { bg: c.accentSoft, fg: c.accentText },
    ghost: { bg: 'transparent', fg: c.accentText },
    danger: { bg: c.dangerSoft, fg: c.danger },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Tap
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      style={[
        styles.button,
        size === 'sm' && styles.buttonSm,
        { backgroundColor: palette.bg },
        variant === 'primary' && !disabled ? { boxShadow: accentGlowStrong } : null,
        disabled && { opacity: 0.45 },
        style,
      ]}
      pressedStyle={variant === 'primary' ? { backgroundColor: c.accentPressed } : { opacity: 0.75 }}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 19} color={palette.fg} /> : null}
          <Text
            style={[styles.buttonText, size === 'sm' && { fontSize: font.small }, { color: palette.fg }]}
            numberOfLines={1}>
            {title}
          </Text>
        </>
      )}
    </Tap>
  );
}

/** Round icon button for headers: plain (grey fill), accent (indigo + glow) or glass (on navy). */
export function HeaderButton({
  icon,
  onPress,
  label,
  tone = 'plain',
  dot,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  tone?: 'plain' | 'accent' | 'glass';
  dot?: boolean;
}) {
  const c = useColors();
  const look = {
    plain: { bg: c.fill, fg: c.text, border: 'transparent' },
    accent: { bg: c.accent, fg: '#FFFFFF', border: 'transparent' },
    glass: { bg: navy.glass, fg: '#FFFFFF', border: navy.glassLine },
  }[tone];
  return (
    <Tap
      onPress={onPress}
      hitSlop={6}
      scaleTo={0.9}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.headerButton,
        { backgroundColor: look.bg, borderColor: look.border },
        tone === 'accent' ? { boxShadow: accentGlow } : null,
      ]}>
      <Ionicons name={icon} size={20} color={look.fg} />
      {dot ? <View style={[styles.headerDot, { borderColor: tone === 'glass' ? navy.deep : c.surface }]} /> : null}
    </Tap>
  );
}

/** Round action with a label under it (home hero, invoice actions). */
export function ActionTile({
  icon,
  label,
  onPress,
  badge,
  variant = 'solid',
  loading,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: number;
  variant?: 'solid' | 'glass' | 'plain';
  loading?: boolean;
}) {
  const c = useColors();
  const glass = variant === 'glass';
  return (
    <Tap
      onPress={onPress}
      disabled={loading}
      style={styles.actionTile}
      scaleTo={0.92}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy: !!loading }}>
      <View
        style={[
          styles.actionIcon,
          variant === 'solid' && [tileGradient('accent'), { boxShadow: accentGlow }],
          glass && { backgroundColor: navy.glassStrong, borderColor: navy.glassLine, borderWidth: 1 },
          variant === 'plain' && { backgroundColor: c.surface, boxShadow: c.cardShadow },
        ]}>
        {loading ? (
          <ActivityIndicator color={variant === 'plain' ? c.accentText : '#FFFFFF'} />
        ) : (
          <Ionicons name={icon} size={23} color={variant === 'plain' ? c.accentText : '#FFFFFF'} />
        )}
        {badge ? <CountBadge count={badge} style={styles.actionBadge} /> : null}
      </View>
      <Text
        style={[styles.actionLabel, { color: glass ? navy.onNavySoft : c.textSoft }]}
        numberOfLines={2}
        maxFontSizeMultiplier={1.3}>
        {label}
      </Text>
    </Tap>
  );
}

// ── Inputs ──

export const Field = forwardRef<
  TextInput,
  TextInputProps & { label?: string; error?: string | null; hint?: string; right?: ReactNode }
>(function Field({ label, error, hint, right, style, onFocus, onBlur, ...props }, ref) {
  const c = useColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      {label ? (
        <Txt variant="footnote" tone="muted" weight="600" style={styles.fieldLabel}>
          {label}
        </Txt>
      ) : null}
      <View
        style={[
          styles.inputWrap,
          { backgroundColor: c.surface, borderColor: error ? c.danger : focused ? c.accent : c.line },
          focused && !error ? styles.inputFocused : null,
        ]}>
        <TextInput
          ref={ref}
          placeholderTextColor={c.faint}
          selectionColor={c.accent}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...props}
          style={[styles.input, { color: c.text }, props.multiline && styles.inputMultiline, style]}
        />
        {right}
      </View>
      {error ? (
        <Txt variant="caption" tone="danger" style={styles.fieldNote}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt variant="caption" tone="muted" style={styles.fieldNote}>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
});

/** A field that opens a picker instead of a keyboard. */
export function SelectField({
  label,
  value,
  placeholder,
  onPress,
  error,
}: {
  label?: string;
  value?: string | null;
  placeholder: string;
  onPress: () => void;
  error?: string | null;
}) {
  const c = useColors();
  return (
    <View style={styles.field}>
      {label ? (
        <Txt variant="footnote" tone="muted" weight="600" style={styles.fieldLabel}>
          {label}
        </Txt>
      ) : null}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.inputWrap,
          styles.select,
          { backgroundColor: pressed ? c.surfaceAlt : c.surface, borderColor: error ? c.danger : c.line },
        ]}>
        <Txt style={{ flex: 1 }} tone={value ? 'default' : 'faint'} numberOfLines={1}>
          {value || placeholder}
        </Txt>
        <Ionicons name="chevron-expand" size={17} color={c.faint} />
      </Pressable>
      {error ? (
        <Txt variant="caption" tone="danger" style={styles.fieldNote}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

/** iOS search field: grey fill, magnifier, clear button while editing. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  style,
  returnKeyType = 'search',
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  style?: StyleProp<ViewStyle>;
  returnKeyType?: TextInputProps['returnKeyType'];
}) {
  const c = useColors();
  return (
    <View style={[styles.search, { backgroundColor: c.fill }, style]}>
      <Ionicons name="search" size={17} color={c.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.muted}
        selectionColor={c.accent}
        style={[styles.searchInput, { color: c.text }]}
        returnKeyType={returnKeyType}
        clearButtonMode="while-editing"
        autoCorrect={false}
      />
      {value && Platform.OS !== 'ios' ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityLabel="Clear">
          <Ionicons name="close-circle" size={17} color={c.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** iOS segmented control with a sliding thumb. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useColors();
  const [width, setWidth] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const segment = width > 0 ? (width - SEG_PAD * 2) / options.length : 0;
  const last = useRef({ index, segment });

  useEffect(() => {
    const target = index * segment;
    // First layout (or a resize): jump. A new selection: slide.
    if (last.current.segment !== segment) x.setValue(target);
    else Animated.spring(x, { toValue: target, useNativeDriver: NATIVE_DRIVER, speed: 22, bounciness: 3 }).start();
    last.current = { index, segment };
  }, [index, segment, x]);

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.segmented, { backgroundColor: c.fill }, style]}
      accessibilityRole="tablist">
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.thumb, { width: segment, backgroundColor: c.thumb, transform: [{ translateX: x }] }]}
        />
      ) : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (active) return;
              haptic.selection();
              onChange(o.value);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={styles.segment}>
            <Txt variant="small" weight={active ? '600' : '500'} tone={active ? 'default' : 'soft'} numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({
  label,
  active,
  onPress,
  size = 'md',
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  size?: 'sm' | 'md';
}) {
  const c = useColors();
  return (
    <Tap
      onPress={() => {
        if (!active) haptic.selection();
        onPress?.();
      }}
      scaleTo={0.95}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={[
        styles.chip,
        size === 'sm' && styles.chipSm,
        active
          ? { backgroundColor: c.accent, borderColor: c.accent, boxShadow: accentGlow }
          : { backgroundColor: c.surface, borderColor: c.line },
      ]}>
      <Txt
        variant={size === 'sm' ? 'footnote' : 'small'}
        weight="600"
        tone={active ? 'onAccent' : 'soft'}
        numberOfLines={1}>
        {label}
      </Txt>
    </Tap>
  );
}

// ── Grouped forms (iOS Settings / Contacts style) ──

/** A rounded group of form rows with hairlines between them. */
export function FormGroup({
  children,
  style,
  inset = space.lg,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Where the hairlines start (60 lines them up with text next to icon tiles). */
  inset?: number;
}) {
  const rows = Children.toArray(children).filter(Boolean);
  return (
    <Card padded={false} style={style}>
      {rows.map((row, i) => (
        <View key={i}>
          {i > 0 ? <Divider inset={inset} /> : null}
          {row}
        </View>
      ))}
    </Card>
  );
}

/**
 * One row of a grouped form: the label on the left, the control on the right. With
 * `onPress` it is a picker row (value + chevron); `stacked` puts the control under the label.
 */
export function FormRow({
  label,
  children,
  value,
  placeholder,
  onPress,
  stacked,
  error,
  labelWidth,
}: {
  label: string;
  children?: ReactNode;
  /** For picker rows: the current value, shown on the right. */
  value?: string | null;
  placeholder?: string;
  onPress?: () => void;
  stacked?: boolean;
  error?: string | null;
  /** Fixed label column, for forms whose values are left-aligned (Contacts style). */
  labelWidth?: number;
}) {
  const c = useColors();
  const body = (
    <>
      <View style={[styles.formRow, stacked && styles.formRowStacked]}>
        <Txt
          style={stacked ? null : [styles.formLabel, labelWidth ? { width: labelWidth } : null]}
          tone={stacked ? 'muted' : 'default'}
          variant={stacked ? 'footnote' : 'body'}
          weight={stacked ? '600' : '400'}
          numberOfLines={1}>
          {label}
        </Txt>
        {onPress ? (
          <>
            <Txt tone={value ? 'soft' : 'faint'} numberOfLines={1} style={styles.formValue}>
              {value || placeholder}
            </Txt>
            <Ionicons name="chevron-forward" size={17} color={c.faint} />
          </>
        ) : (
          children
        )}
      </View>
      {error ? (
        <Txt variant="caption" tone="danger" style={styles.formError}>
          {error}
        </Txt>
      ) : null}
    </>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { backgroundColor: c.surfaceAlt } : null)}>
      {body}
    </Pressable>
  );
}

/** Borderless input for a FormRow, right-aligned like iOS form values. */
export const FormInput = forwardRef<TextInput, TextInputProps & { align?: 'left' | 'right' }>(function FormInput(
  { align = 'right', style, ...props },
  ref,
) {
  const c = useColors();
  return (
    <TextInput
      ref={ref}
      placeholderTextColor={c.faint}
      selectionColor={c.accent}
      {...props}
      style={[
        styles.formInput,
        { color: c.text, textAlign: align },
        props.multiline && styles.formInputMultiline,
        style,
      ]}
    />
  );
});

// ── Status ──

/** Status pill with a dot, as on the landing page (.lp-pill). */
export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = useColors();
  const tc = toneColors(c, tone);
  return (
    <View style={[styles.pill, { backgroundColor: tc.bg }]}>
      {icon ? (
        <Ionicons name={icon} size={12} color={tc.fg} />
      ) : (
        <View style={[styles.pillDot, { backgroundColor: tc.fg }]} />
      )}
      <Text style={[styles.pillText, { color: tc.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone,
  icon,
  iconTone = 'accent',
  onPress,
  style,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: TxtTone;
  icon?: IconName;
  iconTone?: TileTone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card onPress={onPress} style={[styles.kpi, style]}>
      <View style={styles.kpiHead}>
        {icon ? <IconTile icon={icon} tone={iconTone} solid size={24} /> : null}
        <Txt variant="footnote" tone="muted" weight="500" numberOfLines={1} style={{ flex: 1 }}>
          {label}
        </Txt>
      </View>
      <Txt variant="heading" tone={tone} tabular numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Txt>
      {hint ? (
        <Txt variant="caption" tone="muted" numberOfLines={1}>
          {hint}
        </Txt>
      ) : null}
    </Card>
  );
}

/** A row of figures in one card, split by hairlines (summary strip). */
export function StatStrip({ items }: { items: { label: string; value: string; tone?: TxtTone }[] }) {
  const c = useColors();
  return (
    <Card padded={false} style={styles.strip}>
      {items.map((it, i) => (
        <View
          key={it.label}
          style={[styles.stripItem, i > 0 ? { borderLeftWidth: HAIRLINE, borderLeftColor: c.separator } : null]}>
          <Txt variant="caption" tone="muted" weight="500" numberOfLines={1}>
            {it.label}
          </Txt>
          <StripValue value={it.value} tone={it.tone} />
        </View>
      ))}
    </Card>
  );
}

/** "14.380 RON" with the currency set small, so three figures fit side by side. */
function StripValue({ value, tone }: { value: string; tone?: TxtTone }) {
  const i = value.lastIndexOf(' ');
  const [amount, unit] = i > 0 ? [value.slice(0, i), value.slice(i + 1)] : [value, ''];
  return (
    <Txt variant="title" weight="700" tone={tone} tabular numberOfLines={1} adjustsFontSizeToFit>
      {amount}
      {unit ? <Text style={styles.stripUnit}> {unit}</Text> : null}
    </Txt>
  );
}

export function Avatar({ text, size = 40 }: { text: string; size?: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }, tileGradient('accent', 160)]}>
      <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: size * 0.38, letterSpacing: -0.2 }}>{text}</Text>
    </View>
  );
}

// ── States ──

export function Loading({ label }: { label?: string }) {
  const c = useColors();
  return (
    <View style={styles.state}>
      <ActivityIndicator color={c.accent} />
      {label ? (
        <Txt tone="muted" style={{ marginTop: space.md }}>
          {label}
        </Txt>
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: IconName;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
}) {
  return (
    <View style={styles.state}>
      <IconTile icon={icon} tone="accent" solid size={68} glow />
      <Txt variant="heading" style={styles.stateTitle}>
        {title}
      </Txt>
      {message ? (
        <Txt tone="muted" style={styles.stateMessage}>
          {message}
        </Txt>
      ) : null}
      {action ? (
        <Button title={action.label} icon={action.icon} onPress={action.onPress} style={styles.stateButton} />
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const t = useT();
  return (
    <View style={styles.state}>
      <IconTile icon="cloud-offline" tone="danger" solid size={68} />
      <Txt variant="heading" style={styles.stateTitle}>
        {t('Nu am putut încărca datele', 'Couldn’t load this')}
      </Txt>
      <Txt tone="muted" style={styles.stateMessage}>
        {message}
      </Txt>
      {onRetry ? (
        <Button
          title={t('Reîncearcă', 'Try again')}
          variant="secondary"
          icon="refresh"
          onPress={onRetry}
          style={styles.stateButton}
        />
      ) : null}
    </View>
  );
}

export function Banner({
  tone,
  icon,
  title,
  message,
  onPress,
}: {
  tone: Tone;
  icon: IconName;
  title: string;
  message?: string;
  onPress?: () => void;
}) {
  const c = useColors();
  const tc = toneColors(c, tone);
  return (
    <Tap
      onPress={onPress}
      disabled={!onPress}
      scaleTo={onPress ? 0.98 : 1}
      style={[styles.banner, { backgroundColor: tc.bg }]}>
      <View style={[styles.bannerIcon, tileGradient(tone)]}>
        <Ionicons name={icon} size={17} color="#FFFFFF" />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Txt weight="600" style={{ color: tone === 'neutral' ? c.text : tc.fg }}>
          {title}
        </Txt>
        {message ? (
          <Txt variant="small" tone="soft">
            {message}
          </Txt>
        ) : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={17} color={tc.fg} /> : null}
    </Tap>
  );
}

const SEG_PAD = 3;
/** iOS badge red, the same in light and dark. */
const BADGE_RED = '#F04438';

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  cardPadded: { padding: space.lg },
  sectionTitle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  sectionTitleLarge: { marginTop: space.xl + 4, marginBottom: space.sm + 2, paddingHorizontal: 2 },
  sectionTitleSmall: { marginTop: space.xl, marginBottom: 7, paddingHorizontal: space.lg },
  sectionLarge: { fontSize: 20, lineHeight: 25, fontWeight: '700', letterSpacing: -0.4 },
  sectionAction: { paddingBottom: 1 },
  tile: { alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: 11,
    gap: space.md,
    minHeight: 54,
  },
  rowBody: { flex: 1, gap: 1 },
  rowBelow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 },
  rowValue: { textAlign: 'right' },
  button: {
    minHeight: 50,
    borderRadius: radius.pill,
    paddingHorizontal: space.xl - 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonSm: { minHeight: 38, paddingHorizontal: space.lg },
  buttonText: { fontSize: font.title - 0.5, fontWeight: '600', letterSpacing: -0.2 },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  headerDot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    backgroundColor: BADGE_RED,
  },
  actionTile: { alignItems: 'center', flex: 1, paddingVertical: space.xs, gap: 7 },
  actionIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  actionBadge: { position: 'absolute', top: -3, right: -5 },
  actionLabel: { fontSize: 12, lineHeight: 15, fontWeight: '500', textAlign: 'center', paddingHorizontal: 2 },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  field: { marginBottom: space.md + 2 },
  fieldLabel: { marginBottom: 6, marginLeft: 4 },
  fieldNote: { marginTop: 5, marginLeft: 4 },
  inputWrap: { borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center' },
  inputFocused: { boxShadow: '0px 0px 0px 4px rgba(70, 95, 233, 0.16)' },
  // minWidth 0 lets the input shrink next to a trailing action instead of pushing it out.
  input: { flex: 1, minWidth: 0, minHeight: 50, paddingHorizontal: 14, fontSize: 17 },
  inputMultiline: { minHeight: 100, paddingTop: 14, textAlignVertical: 'top' },
  select: { minHeight: 50, paddingHorizontal: 14, gap: space.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderRadius: 12,
    paddingHorizontal: 10,
  },
  searchInput: { flex: 1, minHeight: 40, fontSize: 17, paddingVertical: 0 },
  segmented: { flexDirection: 'row', borderRadius: radius.pill, padding: SEG_PAD },
  thumb: {
    position: 'absolute',
    top: SEG_PAD,
    bottom: SEG_PAD,
    left: SEG_PAD,
    borderRadius: radius.pill,
    boxShadow: '0px 3px 8px rgba(0, 0, 0, 0.12), 0px 1px 1px rgba(0, 0, 0, 0.04)',
  },
  segment: { flex: 1, minHeight: 34, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  chip: {
    minHeight: 34,
    paddingHorizontal: 14,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipSm: { minHeight: 30, paddingHorizontal: 12 },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    minHeight: 50,
  },
  formRowStacked: { flexDirection: 'column', alignItems: 'stretch', gap: 2, paddingTop: 10, paddingBottom: 4 },
  formLabel: { flexShrink: 0, maxWidth: '55%' },
  formValue: { flex: 1, textAlign: 'right' },
  formError: { paddingHorizontal: space.lg, marginTop: -6, paddingBottom: 8, textAlign: 'right' },
  formInput: { flex: 1, minWidth: 0, minHeight: 48, fontSize: 17, paddingVertical: 0 },
  formInputMultiline: { minHeight: 72, paddingTop: 4, paddingBottom: 10, textAlignVertical: 'top' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 12, fontWeight: '600' },
  kpi: { flex: 1, gap: 6, padding: 14 },
  kpiHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  strip: { flexDirection: 'row' },
  stripItem: { flex: 1, paddingVertical: 12, paddingHorizontal: 12, gap: 3 },
  stripUnit: { fontSize: 11, fontWeight: '600', letterSpacing: 0 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  state: { alignItems: 'center', justifyContent: 'center', padding: space.xxl, flexGrow: 1 },
  stateTitle: { marginTop: space.xl, textAlign: 'center' },
  stateMessage: { marginTop: space.sm, textAlign: 'center', maxWidth: 320 },
  stateButton: { marginTop: space.xl, minWidth: 200 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: 14,
    borderRadius: radius.lg,
  },
  bannerIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
