import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Radii, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/* ---------- surfaces ---------- */

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.backgroundElement, borderColor: colors.border },
        style,
      ]}>
      {children}
    </View>
  );
}

export function SectionHeader({
  title,
  right,
  tone,
}: {
  title: string;
  right?: React.ReactNode;
  tone?: string;
}) {
  const colors = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <ThemedText
        type="smallBold"
        style={{ fontSize: 13, letterSpacing: 0.4, textTransform: 'uppercase', color: tone ?? colors.textSecondary }}>
        {title}
      </ThemedText>
      <View style={{ flex: 1 }} />
      {right}
    </View>
  );
}

export function ScreenHeader({
  title,
  onEdit,
}: {
  title: string;
  onEdit?: () => void;
}) {
  const colors = useTheme();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        hitSlop={12}
        accessibilityRole="button"
        style={[styles.headerBtn, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
      </Pressable>
      <ThemedText type="default" style={styles.headerTitle} numberOfLines={1}>
        {title}
      </ThemedText>
      {onEdit ? (
        <Pressable
          onPress={onEdit}
          hitSlop={12}
          accessibilityRole="button"
          style={[styles.headerBtn, { backgroundColor: colors.backgroundElement, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.headerBtn} />
      )}
    </View>
  );
}

/* ---------- type ---------- */

/** Big tabular figure — the hero of every screen. */
export function Money({
  value,
  size = 'lg',
  color,
  style,
}: {
  value: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  const colors = useTheme();
  const map = { sm: 16, md: 22, lg: 30, xl: 38 } as const;
  return (
    <ThemedText
      style={[
        {
          fontSize: map[size],
          lineHeight: map[size] * 1.22,
          fontWeight: '800',
          color: color ?? colors.text,
          fontVariant: ['tabular-nums'],
          letterSpacing: -0.4,
        },
        style,
      ]}>
      {value}
    </ThemedText>
  );
}

export function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <Card style={{ flex: 1, gap: 2 }}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.statLabel}>
        {label}
      </ThemedText>
      <ThemedText type="default" style={{ fontWeight: '800', color }} numberOfLines={1}>
        {value}
      </ThemedText>
    </Card>
  );
}

/* ---------- controls ---------- */

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'md' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useTheme();
  const palette = {
    primary: { bg: colors.accent, fg: colors.onAccent, border: colors.accent },
    secondary: { bg: colors.backgroundSelected, fg: colors.text, border: colors.backgroundSelected },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
    ghost: { bg: 'transparent', fg: colors.text, border: colors.border },
  } as const;
  const p = palette[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        { backgroundColor: p.bg, borderColor: p.border, opacity: disabled ? 0.4 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <ThemedText style={{ color: p.fg, fontWeight: '700', fontSize: size === 'sm' ? 14 : 16 }}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & TextInputProps) {
  const colors = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <ThemedText type="small" style={styles.fieldLabel}>
        {label}
      </ThemedText>
      <TextInput
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.input,
          {
            backgroundColor: colors.background,
            color: colors.text,
            borderColor: colors.border,
          },
        ]}
        {...props}
      />
      {hint ? (
        <ThemedText type="small" style={{ color: colors.textSecondary, fontSize: 12.5 }}>
          {hint}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
  values,
}: {
  options: { value: T; label: string }[];
  value?: T | undefined;
  onChange: (v: T) => void;
  label?: string;
  /** multi-select mode: `values` is the current selection, onChange receives the tapped chip */
  values?: T[] | undefined;
}) {
  const colors = useTheme();
  return (
    <View style={{ gap: 8 }}>
      {label ? (
        <ThemedText type="small" style={styles.fieldLabel}>
          {label}
        </ThemedText>
      ) : null}
      <View style={styles.chipRow}>
        {options.map((o) => {
          const selected = values ? values.includes(o.value) : value === o.value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              onPress={() => onChange(o.value)}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.accent : colors.background,
                  borderColor: selected ? colors.accent : colors.border,
                },
              ]}>
              <ThemedText
                type="small"
                style={{
                  color: selected ? colors.onAccent : colors.text,
                  fontWeight: selected ? '700' : '500',
                  fontSize: 14,
                }}>
                {o.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
}: {
  label?: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const colors = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <ThemedText type="small" style={styles.fieldLabel}>
          {label}
        </ThemedText>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={[
          styles.input,
          styles.selectRow,
          { backgroundColor: colors.background, borderColor: colors.border },
        ]}>
        <ThemedText style={{ flex: 1, color: selected ? colors.text : colors.textSecondary }} numberOfLines={1}>
          {selected ? selected.label : (placeholder ?? '')}
        </ThemedText>
        <MaterialCommunityIcons name="chevron-down" size={24} color={colors.textSecondary} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
          onPress={() => setOpen(false)}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.backgroundElement, borderColor: colors.border },
            ]}
            onStartShouldSetResponder={() => true}>
            <FlatList
              data={options}
              keyExtractor={(o) => o.value}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  style={[styles.modalOption, item.value === value && { backgroundColor: colors.accentSoft }]}>
                  <ThemedText type="default">{item.label}</ThemedText>
                  {item.value === value ? (
                    <MaterialCommunityIcons name="check-circle" size={22} color={colors.accent} />
                  ) : null}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ---------- indicators ---------- */

export function ProgressBar({
  pct,
  color,
  style,
}: {
  pct: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useTheme();
  const clamped = Math.max(0, Math.min(1, pct));
  return (
    <View style={[styles.track, { backgroundColor: colors.backgroundSelected }, style]}>
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: Radii.pill,
          backgroundColor: color ?? colors.accent,
        }}
      />
    </View>
  );
}

export function Badge({
  text,
  tone = 'neutral',
  icon,
}: {
  text: string;
  tone?: 'neutral' | 'danger' | 'warning' | 'success';
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}) {
  const colors = useTheme();
  const map = {
    neutral: { bg: colors.backgroundSelected, fg: colors.textSecondary },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    success: { bg: colors.successSoft, fg: colors.success },
  } as const;
  const c = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={13} color={c.fg} /> : null}
      <ThemedText style={{ color: c.fg, fontSize: 12, fontWeight: '700' }}>
        {text}
      </ThemedText>
    </View>
  );
}

export function EmptyState({
  title,
  subtitle,
  action,
  icon = 'inbox-arrow-up-outline',
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}) {
  const colors = useTheme();
  return (
    <Card style={{ alignItems: 'center', paddingVertical: Spacing.five, gap: Spacing.two }}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
        <MaterialCommunityIcons name={icon} size={26} color={colors.accent} />
      </View>
      <ThemedText type="default" style={{ fontWeight: '700', fontSize: 17, textAlign: 'center' }}>
        {title}
      </ThemedText>
      {subtitle ? (
        <ThemedText type="small" style={{ color: colors.textSecondary, textAlign: 'center' }}>
          {subtitle}
        </ThemedText>
      ) : null}
      {action ? <View style={{ marginTop: Spacing.two, alignSelf: 'stretch' }}>{action}</View> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radii.lg,
    padding: Spacing.three,
    borderWidth: 1,
    gap: Spacing.two,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.four,
    marginBottom: Spacing.half,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  headerTitle: { fontWeight: '800', fontSize: 18, flex: 1, textAlign: 'center' },
  headerBtn: {
    width: 40,
    height: 40,
    borderRadius: Radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    borderRadius: Radii.md,
    minHeight: 50,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  buttonSm: { minHeight: 40, paddingHorizontal: Spacing.three },
  fieldLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2, opacity: 0.75 },
  input: {
    borderRadius: Radii.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    minHeight: 50,
    fontSize: 16,
    fontWeight: '500',
  },
  statLabel: { fontSize: 12.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderRadius: Radii.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  selectRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  modalSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '65%',
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    borderWidth: 1,
    paddingBottom: Spacing.four,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  track: { height: 7, borderRadius: Radii.pill, overflow: 'hidden' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: Radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
