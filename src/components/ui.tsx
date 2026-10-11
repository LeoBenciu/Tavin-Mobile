import { Ionicons } from '@expo/vector-icons';
import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { useT } from '@/i18n';
import { font, radius, space, toneColors, useColors, type Tone } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// ── Text ──

type TxtVariant = 'display' | 'heading' | 'title' | 'body' | 'small' | 'caption' | 'label';
type TxtTone = 'default' | 'soft' | 'muted' | 'accent' | 'good' | 'warn' | 'danger' | 'onAccent';

const variantStyle: Record<TxtVariant, TextStyle> = {
  display: { fontSize: font.display, fontWeight: '700', letterSpacing: -0.5 },
  heading: { fontSize: font.heading, fontWeight: '700', letterSpacing: -0.3 },
  title: { fontSize: font.title, fontWeight: '600' },
  body: { fontSize: font.body },
  small: { fontSize: font.small },
  caption: { fontSize: font.caption },
  label: { fontSize: font.caption, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6 },
};

export function Txt({
  variant = 'body',
  tone = 'default',
  weight,
  style,
  ...props
}: TextProps & { variant?: TxtVariant; tone?: TxtTone; weight?: TextStyle['fontWeight'] }) {
  const c = useColors();
  const color = {
    default: c.text,
    soft: c.textSoft,
    muted: c.muted,
    accent: c.accentText,
    good: c.good,
    warn: c.warn,
    danger: c.danger,
    onAccent: c.onAccent,
  }[tone];
  return <Text {...props} style={[variantStyle[variant], { color }, weight ? { fontWeight: weight } : null, style]} />;
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
  const base = [styles.card, { backgroundColor: c.surface, borderColor: c.line }, padded && styles.cardPadded, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  return (
    <View style={styles.sectionTitle}>
      <Txt variant="label" tone="muted">
        {title}
      </Txt>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={8}>
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
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.line, marginLeft: inset }} />;
}

// ── Rows ──

export function ListRow({
  icon,
  leading,
  iconTone = 'accent',
  title,
  subtitle,
  value,
  valueTone,
  right,
  onPress,
  chevron,
  numberOfLines = 1,
}: {
  icon?: IconName;
  /** Custom element in the icon slot (e.g. an avatar). */
  leading?: ReactNode;
  iconTone?: Tone;
  title: string;
  subtitle?: string | null;
  value?: string | null;
  valueTone?: TxtTone;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  numberOfLines?: number;
}) {
  const c = useColors();
  const tc = toneColors(c, iconTone);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? { backgroundColor: c.surfaceAlt } : null]}>
      {leading ??
        (icon ? (
          <View style={[styles.rowIcon, { backgroundColor: tc.bg }]}>
            <Ionicons name={icon} size={18} color={tc.fg} />
          </View>
        ) : null)}
      <View style={styles.rowBody}>
        <Txt weight="500" numberOfLines={numberOfLines}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="small" tone="muted" numberOfLines={numberOfLines}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {value ? (
        <Txt weight="600" tone={valueTone} style={styles.rowValue}>
          {value}
        </Txt>
      ) : null}
      {right}
      {(chevron ?? !!onPress) ? <Ionicons name="chevron-forward" size={18} color={c.muted} /> : null}
    </Pressable>
  );
}

export function ToggleRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  icon?: IconName;
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
      title={title}
      subtitle={subtitle}
      numberOfLines={2}
      right={
        <Switch
          value={value}
          onValueChange={onValueChange}
          disabled={disabled}
          trackColor={{ true: c.accent, false: c.line }}
          thumbColor="#FFFFFF"
        />
      }
      chevron={false}
    />
  );
}

// ── Buttons ──

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

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
    primary: { bg: c.accent, fg: c.onAccent, border: c.accent },
    secondary: { bg: c.surface, fg: c.text, border: c.line },
    ghost: { bg: 'transparent', fg: c.accentText, border: 'transparent' },
    danger: { bg: c.dangerSoft, fg: c.danger, border: c.dangerSoft },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && !inactive && { opacity: 0.8 },
        disabled && { opacity: 0.45 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={palette.fg} /> : null}
          <Text style={[styles.buttonText, size === 'sm' && { fontSize: font.small }, { color: palette.fg }]}>
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

/** Round icon action used in quick-action grids. */
export function ActionTile({
  icon,
  label,
  onPress,
  badge,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  badge?: number;
}) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.actionTile, pressed && { opacity: 0.7 }]}>
      <View style={[styles.actionIcon, { backgroundColor: c.accentSoft }]}>
        <Ionicons name={icon} size={22} color={c.accentText} />
        {badge ? (
          <View style={[styles.badge, { backgroundColor: c.danger }]}>
            <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <Txt variant="caption" tone="soft" style={styles.actionLabel} numberOfLines={2}>
        {label}
      </Txt>
    </Pressable>
  );
}

/** Floating primary action, bottom-right above the tab bar. */
export function Fab({ icon, label, onPress }: { icon: IconName; label?: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: pressed ? c.accentPressed : c.accent },
        label ? styles.fabWide : null,
      ]}>
      <Ionicons name={icon} size={22} color={c.onAccent} />
      {label ? <Text style={[styles.buttonText, { color: c.onAccent }]}>{label}</Text> : null}
    </Pressable>
  );
}

// ── Inputs ──

export const Field = forwardRef<
  TextInput,
  TextInputProps & { label?: string; error?: string | null; hint?: string; right?: ReactNode }
>(function Field({ label, error, hint, right, style, ...props }, ref) {
  const c = useColors();
  return (
    <View style={styles.field}>
      {label ? (
        <Txt variant="small" tone="soft" weight="500" style={styles.fieldLabel}>
          {label}
        </Txt>
      ) : null}
      <View style={[styles.inputWrap, { backgroundColor: c.surface, borderColor: error ? c.danger : c.line }]}>
        <TextInput
          ref={ref}
          placeholderTextColor={c.muted}
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
        <Txt variant="small" tone="soft" weight="500" style={styles.fieldLabel}>
          {label}
        </Txt>
      ) : null}
      <Pressable
        onPress={onPress}
        style={[
          styles.inputWrap,
          styles.select,
          { backgroundColor: c.surface, borderColor: error ? c.danger : c.line },
        ]}>
        <Txt style={{ flex: 1 }} tone={value ? 'default' : 'muted'} numberOfLines={1}>
          {value || placeholder}
        </Txt>
        <Ionicons name="chevron-down" size={18} color={c.muted} />
      </Pressable>
      {error ? (
        <Txt variant="caption" tone="danger" style={styles.fieldNote}>
          {error}
        </Txt>
      ) : null}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const c = useColors();
  return (
    <View style={[styles.segmented, { backgroundColor: c.chip }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && { backgroundColor: c.surface, shadowOpacity: 0.08 }]}>
            <Txt variant="small" weight={active ? '600' : '500'} tone={active ? 'default' : 'muted'} numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? c.accent : c.surface, borderColor: active ? c.accent : c.line },
      ]}>
      <Txt variant="small" weight="500" tone={active ? 'onAccent' : 'soft'}>
        {label}
      </Txt>
    </Pressable>
  );
}

// ── Status ──

export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: Tone; icon?: IconName }) {
  const c = useColors();
  const tc = toneColors(c, tone);
  return (
    <View style={[styles.pill, { backgroundColor: tc.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={tc.fg} /> : null}
      <Text style={[styles.pillText, { color: tc.fg }]}>{label}</Text>
    </View>
  );
}

export function Kpi({
  label,
  value,
  hint,
  tone,
  onPress,
  style,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: TxtTone;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card onPress={onPress} style={[styles.kpi, style]}>
      <Txt variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Txt>
      <Txt variant="title" weight="700" tone={tone} numberOfLines={1} adjustsFontSizeToFit>
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

export function Avatar({ text, size = 40 }: { text: string; size?: number }) {
  const c = useColors();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: c.accentSoft }]}>
      <Txt weight="700" tone="accent" style={{ fontSize: size * 0.38 }}>
        {text}
      </Txt>
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
  const c = useColors();
  return (
    <View style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: c.accentSoft }]}>
        <Ionicons name={icon} size={28} color={c.accentText} />
      </View>
      <Txt variant="title" style={styles.stateTitle}>
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
  const c = useColors();
  return (
    <View style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: c.dangerSoft }]}>
        <Ionicons name="cloud-offline-outline" size={28} color={c.danger} />
      </View>
      <Txt variant="title" style={styles.stateTitle}>
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
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.banner, { backgroundColor: tc.bg }]}>
      <Ionicons name={icon} size={20} color={tc.fg} />
      <View style={{ flex: 1 }}>
        <Txt weight="600" style={{ color: tc.fg }}>
          {title}
        </Txt>
        {message ? (
          <Txt variant="small" tone="soft">
            {message}
          </Txt>
        ) : null}
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={18} color={tc.fg} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardPadded: { padding: space.lg },
  sectionTitle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.xl,
    marginBottom: space.sm,
    paddingHorizontal: space.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.md,
    minHeight: 56,
  },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowValue: { textAlign: 'right' },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: 1,
  },
  buttonSm: { minHeight: 36, paddingHorizontal: space.md },
  buttonText: { fontSize: font.body, fontWeight: '600' },
  actionTile: { alignItems: 'center', width: '25%', paddingVertical: space.sm },
  actionIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { marginTop: space.xs, textAlign: 'center', paddingHorizontal: 2 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -6,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  field: { marginBottom: space.md },
  fieldLabel: { marginBottom: 6 },
  fieldNote: { marginTop: 4 },
  inputWrap: { borderWidth: 1, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center' },
  // minWidth 0 lets the input shrink next to a trailing action instead of pushing it out.
  input: { flex: 1, minWidth: 0, minHeight: 48, paddingHorizontal: space.md, fontSize: font.body },
  inputMultiline: { minHeight: 96, paddingTop: space.md, textAlignVertical: 'top' },
  select: { minHeight: 48, paddingHorizontal: space.md, gap: space.sm },
  segmented: { flexDirection: 'row', borderRadius: radius.md, padding: 3 },
  segment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.sm + 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    shadowOpacity: 0,
  },
  chip: { paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 12, fontWeight: '600' },
  kpi: { flex: 1, gap: 4, padding: space.md },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  state: { alignItems: 'center', justifyContent: 'center', padding: space.xxl, flexGrow: 1 },
  stateIcon: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { marginTop: space.lg, textAlign: 'center' },
  stateMessage: { marginTop: space.sm, textAlign: 'center', maxWidth: 320 },
  stateButton: { marginTop: space.xl, minWidth: 180 },
  fab: {
    position: 'absolute',
    right: space.lg,
    bottom: space.lg,
    height: 56,
    minWidth: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: space.sm,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabWide: { paddingHorizontal: space.xl },
  banner: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.lg },
});
