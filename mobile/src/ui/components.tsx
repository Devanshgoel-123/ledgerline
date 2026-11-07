import { Children, type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type StyleProp,
  type SwitchProps,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Backdrop, Glass } from "./Glass";
import { Enter } from "./motion";
import { Icon, type IconName } from "./Icon";
import { fonts, radius, space, tabular, useTheme } from "./theme";

/**
 * A scrolling page over the backdrop's soft light. Its blocks rise in one
 * after another on first show, a few dozen milliseconds apart.
 */
export function Screen({
  children,
  scroll = true,
  padTop = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  padTop?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const style = {
    paddingTop: padTop ? insets.top + space[3] : space[3],
    paddingBottom: insets.bottom + 96,
    paddingHorizontal: space[4],
    gap: space[4],
  };
  const blocks = Children.toArray(children).map((child, index) => (
    <Enter key={(child as { key?: string }).key ?? index} index={index}>
      {child}
    </Enter>
  ));
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      {scroll ? (
        <ScrollView
          style={{ flex: 1, backgroundColor: "transparent" }}
          contentContainerStyle={style}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never">
          {blocks}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, style]}>{blocks}</View>
      )}
    </View>
  );
}

/** A label above a field or group, the same as a Field's own label. */
export function Eyebrow({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  return <Text style={[styles.label, { color: c.foreground }, style]}>{children}</Text>;
}

/** A tab's title, with an optional line under it and a control on the right. */
export function PageHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={styles.pageHeader}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.pageTitle, { color: c.foreground }]} accessibilityRole="header">
          {title}
        </Text>
        {sub ? <Text style={[styles.body, { color: c.muted }]}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

/** A titled group: the label sits on the page, the content in a card below it. */
export function Section({
  title,
  action,
  onAction,
  right,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  /** A control beside the title, such as a month switcher. */
  right?: ReactNode;
  children: ReactNode;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: space[2] }}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: c.foreground }]} accessibilityRole="header">
          {title}
        </Text>
        {action && onAction ? (
          <Pressable onPress={onAction} accessibilityRole="button" hitSlop={10} style={{ minHeight: 32, justifyContent: "center" }}>
            <Text style={[styles.link, { color: c.primary }]}>{action}</Text>
          </Pressable>
        ) : (
          right
        )}
      </View>
      {children}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Glass style={[styles.card, style]}>{children}</Glass>;
}

export function CardTitle({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3] }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.cardTitle, { color: c.foreground }]} accessibilityRole="header">
          {title}
        </Text>
        {sub ? <Text style={[styles.small, { color: c.muted }]}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

type Tone = "default" | "muted" | "accent" | "credit" | "debit" | "danger";

export function T({
  children,
  variant = "body",
  tone = "default",
  style,
  numberOfLines,
}: {
  children: ReactNode;
  variant?: "body" | "small" | "strong" | "title" | "mono" | "monoSmall";
  tone?: Tone;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  const { c } = useTheme();
  const color = {
    default: c.foreground,
    muted: c.muted,
    accent: c.accent,
    credit: c.credit,
    debit: c.debit,
    danger: c.danger,
  }[tone];
  const base = {
    body: styles.body,
    small: styles.small,
    strong: styles.strong,
    title: styles.cardTitle,
    mono: styles.mono,
    monoSmall: styles.monoSmall,
  }[variant];
  return (
    <Text style={[base, { color }, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

/** A rounded label like the web's "17 payments" chips. */
export function Pill({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "accent" | "primary" | "warning" | "success" }) {
  const { c } = useTheme();
  const bg = { muted: c.bgMuted, accent: c.accentSoft, primary: c.primarySoft, warning: c.warningSoft, success: c.successSoft }[tone];
  const fg = { muted: c.foreground, accent: c.accent, primary: c.primary, warning: c.parchmentInk, success: c.success }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg, borderColor: c.border }]}>
      <Text style={[styles.pillText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = "primary",
  icon,
  disabled,
  busy,
  style,
  accessibilityHint,
}: {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  icon?: IconName;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}) {
  const { c } = useTheme();
  const look = {
    primary: { bg: c.primary, fg: c.primaryForeground, border: c.primary },
    secondary: { bg: c.surface, fg: c.foreground, border: c.borderStrong },
    ghost: { bg: "transparent", fg: c.foreground, border: "transparent" },
    danger: { bg: c.dangerSoft, fg: c.danger, border: c.danger },
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: look.bg,
          borderColor: look.border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
        },
        style,
      ]}>
      {busy ? <ActivityIndicator color={look.fg} size="small" /> : icon ? <Icon name={icon} size={18} color={look.fg} /> : null}
      <Text style={[styles.buttonText, { color: look.fg }]}>{label}</Text>
    </Pressable>
  );
}

/** A choice chip. Selected chips are filled. */
export function Chip({
  label,
  selected,
  onPress,
  color,
  fillWithColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** A category colour shown as a dot. */
  color?: string;
  /** Fill the selected chip with `color` instead of the primary colour. */
  fillWithColor?: boolean;
}) {
  const { c, onCategory } = useTheme();
  const fill = selected ? (fillWithColor && color ? color : c.primary) : c.surface;
  const ink = selected ? (fillWithColor && color ? onCategory : c.primaryForeground) : c.foreground;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: fill,
          borderColor: selected ? fill : c.borderStrong,
          opacity: pressed ? 0.8 : 1,
        },
      ]}>
      {color ? <View style={[styles.dot, { backgroundColor: selected && fillWithColor ? ink : color }]} /> : null}
      <Text style={[styles.chipText, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

/** Two to four options in a row, like the web's Spending / Invested toggle. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const { c } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.segmented, { backgroundColor: c.bgMuted, borderColor: c.border }]}>
      {options.map((option) => {
        const on = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[styles.segment, on && { backgroundColor: c.surface, borderColor: c.borderStrong }]}>
            <Text style={[styles.segmentText, { color: on ? c.foreground : c.muted }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Field({
  label,
  hint,
  error,
  style,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  const { c } = useTheme();
  return (
    <View style={[{ gap: 6 }, style as StyleProp<ViewStyle>]}>
      <Text style={[styles.label, { color: c.foreground }]}>{label}</Text>
      <TextInput
        placeholderTextColor={c.muted2}
        accessibilityLabel={label}
        accessibilityHint={hint}
        {...input}
        style={[
          styles.input,
          { color: c.foreground, backgroundColor: c.surface, borderColor: error ? c.danger : c.borderStrong },
        ]}
      />
      {error ? (
        <Text style={[styles.small, { color: c.danger }]} accessibilityLiveRegion="polite" accessibilityRole="alert">
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.small, { color: c.muted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

/** The web app's "You are looking at sample data" strip, and other notices. */
export function Notice({
  title,
  body,
  action,
  tone = "warning",
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  tone?: "warning" | "info" | "danger";
}) {
  const { c } = useTheme();
  const bg = { warning: c.warningSoft, info: c.primarySoft, danger: c.dangerSoft }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: bg, borderColor: c.border }]} accessibilityRole="summary">
      <Text style={[styles.body, { color: c.foreground }]}>
        <Text style={{ fontFamily: fonts.sansSemi }}>{title}</Text>
        {body ? ` ${body}` : ""}
      </Text>
      {action}
    </View>
  );
}

/** A tappable list row with a chevron. */
export function Row({
  title,
  sub,
  right,
  onPress,
  leading,
}: {
  title: string;
  sub?: string;
  right?: ReactNode;
  onPress?: () => void;
  leading?: ReactNode;
}) {
  const { c } = useTheme();
  const content = (
    <>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.strong, { color: c.foreground }]} numberOfLines={1}>
          {title}
        </Text>
        {sub ? (
          <Text style={[styles.small, { color: c.muted }]} numberOfLines={2}>
            {sub}
          </Text>
        ) : null}
      </View>
      {right}
      {onPress ? <Icon name="chevron" size={14} color={c.muted2} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${title}, ${sub}` : title}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      {content}
    </Pressable>
  );
}

/** A switch in the brand colour; Android otherwise uses the system teal. */
export function Toggle(props: SwitchProps) {
  const { c } = useTheme();
  return (
    <Switch
      trackColor={{ true: c.primary, false: c.borderStrong }}
      thumbColor={Platform.OS === "ios" ? undefined : "#ffffff"}
      ios_backgroundColor={c.borderStrong}
      // react-native-web draws the "on" thumb in its own teal unless told otherwise.
      {...(Platform.OS === "web" ? ({ activeThumbColor: "#ffffff" } as object) : null)}
      {...props}
    />
  );
}

export function Divider() {
  const { c } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.borderStrong }} />;
}

export function Empty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "flex-start", gap: space[1], paddingVertical: space[2] }}>
      <Text style={[styles.strong, { color: c.foreground }]}>{title}</Text>
      <Text style={[styles.small, { color: c.muted }]}>{body}</Text>
      {action ? <View style={{ marginTop: space[2] }}>{action}</View> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  pageHeader: { flexDirection: "row", alignItems: "flex-end", gap: space[3] },
  pageTitle: { fontFamily: fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2, minHeight: 32 },
  sectionTitle: { fontFamily: fonts.sansSemi, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  link: { fontFamily: fonts.sansMedium, fontSize: 15 },
  card: { padding: space[4], gap: space[3] },
  cardTitle: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, letterSpacing: -0.2 },
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 21 },
  small: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18 },
  strong: { fontFamily: fonts.sansSemi, fontSize: 15, lineHeight: 20 },
  mono: { fontFamily: fonts.monoMedium, fontSize: 15, lineHeight: 20, ...tabular },
  monoSmall: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, ...tabular },
  label: { fontFamily: fonts.sansMedium, fontSize: 14 },
  pill: { borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontFamily: fonts.sansSemi, fontSize: 12.5 },
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: space[4],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
  },
  buttonText: { fontFamily: fonts.sansSemi, fontSize: 15 },
  chip: {
    minHeight: 40,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chipText: { fontFamily: fonts.sansMedium, fontSize: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  segmented: { flexDirection: "row", borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 3, gap: 3 },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space[2],
  },
  segmentText: { fontFamily: fonts.sansMedium, fontSize: 14 },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontFamily: fonts.sans,
    fontSize: 16,
  },
  notice: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space[4], gap: space[3] },
  row: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 52, paddingVertical: space[2] },
});
