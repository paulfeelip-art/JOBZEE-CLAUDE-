import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Icon, LogoPin, type IconName } from './Icon';
import { font, radius, TIER_COLORS, usePalette } from '@/lib/theme';
import { TIERS } from '@jobzee/shared';

type Variant = 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'xs' | 'label' | 'big';

export function T({ v = 'body', mute, color, style, ...rest }: TextProps & { v?: Variant; mute?: boolean; color?: string }) {
  const p = usePalette();
  return <Text {...rest} style={[styles[v], { color: color ?? (mute ? p.mute : p.ink) }, style]} />;
}

export function Button({ title, onPress, variant = 'primary', icon, disabled, loading, style, accessibilityLabel }: {
  title: string; onPress?: () => void; variant?: 'primary' | 'line' | 'ghost' | 'danger'; icon?: IconName; disabled?: boolean;
  loading?: boolean; style?: StyleProp<ViewStyle>; accessibilityLabel?: string;
}) {
  const p = usePalette();
  const bg = disabled ? p.fill : variant === 'primary' ? p.or : variant === 'ghost' ? p.fill : p.surface;
  const fg = disabled ? p.mute : variant === 'primary' ? p.orInk : variant === 'danger' ? p.bad : p.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, opacity: pressed ? 0.85 : 1 },
        (variant === 'line' || variant === 'danger') && { borderWidth: 1.5, borderColor: variant === 'danger' ? p.badSoft : p.fill2 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
          {icon ? <Icon name={icon} size={19} color={fg} strokeWidth={2.3} /> : null}
        </>
      )}
    </Pressable>
  );
}

export function Card({ children, style, onPress }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: PressableProps['onPress'] }) {
  const p = usePalette();
  const s = [styles.card, { backgroundColor: p.surface, borderColor: p.line }, style];
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={s}>{children}</Pressable> : <View style={s}>{children}</View>;
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? p.orSoft : p.surface, borderColor: selected ? p.or : p.line }]}
    >
      {icon ? <Icon name={icon} size={17} color={selected ? p.orText : p.ink} /> : null}
      <Text style={[styles.chipText, { color: selected ? p.orText : p.ink, fontFamily: selected ? font.bold : font.semibold }]}>{label}</Text>
    </Pressable>
  );
}

export function Row({ children, gap = 12, style }: { children: React.ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function BackButton({ onPress }: { onPress?: () => void }) {
  const p = usePalette();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Înapoi" onPress={onPress ?? (() => router.back())} style={[styles.round, { backgroundColor: p.fill }]}>
      <Icon name="back" size={20} color={p.ink} strokeWidth={2.3} />
    </Pressable>
  );
}

/** Step header used across the request flow: back, title, n/4 and an orange progress bar. */
export function FlowHead({ title, step, of = 4 }: { title: string; step: number; of?: number }) {
  const p = usePalette();
  return (
    <View style={{ gap: 10 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <BackButton />
        <T v="h3">{title}</T>
        <T v="small" mute style={{ width: 44, textAlign: 'right' }}>{step}/{of}</T>
      </Row>
      <Row gap={6}>
        {Array.from({ length: of }, (_, i) => (
          <View key={i} style={{ flex: 1, height: 5, borderRadius: 5, backgroundColor: i < step ? p.or : p.fill2 }} />
        ))}
      </Row>
    </View>
  );
}

export function Logo({ size = 30, stacked }: { size?: number; stacked?: boolean }) {
  const p = usePalette();
  const word = (
    <Text style={{ fontFamily: font.bold, fontSize: size * 1.05, letterSpacing: -1, color: p.gray, lineHeight: size * 1.1 }}>
      job<Text style={{ color: p.orWord }}>zee</Text>
    </Text>
  );
  return (
    <View accessible accessibilityLabel="Jobzee" style={{ flexDirection: stacked ? 'column' : 'row', alignItems: stacked ? 'center' : 'flex-end', gap: stacked ? 4 : 4 }}>
      <LogoPin height={stacked ? size * 2 : size} />
      {word}
    </View>
  );
}

export function Avatar({ photo, initials, size = 48 }: { photo?: string | number | null; initials: string; size?: number }) {
  const p = usePalette();
  if (photo) return <Image source={typeof photo === 'string' ? { uri: photo } : photo} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" accessibilityIgnoresInvertColors />;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.fill2, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: font.bold, fontSize: size * 0.36, color: p.ink }}>{initials}</Text>
    </View>
  );
}

export function TierBadge({ tier, big }: { tier: number; big?: boolean }) {
  const t = TIERS[tier] ?? TIERS[0]!;
  const c = TIER_COLORS[t.id]!;
  return (
    <View style={[styles.tier, { backgroundColor: c.bg, height: big ? 30 : 24 }]}>
      <Icon name="star" size={big ? 14 : 12} color={c.fg} />
      <Text style={{ color: c.fg, fontFamily: font.bold, fontSize: big ? 13.5 : 12 }}>Jobzer {t.name}</Text>
    </View>
  );
}

export function Tag({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'ok' | 'bad' | 'or'; icon?: IconName }) {
  const p = usePalette();
  const map = { neutral: [p.fill, p.ink], ok: [p.okSoft, p.ok], bad: [p.badSoft, p.bad], or: [p.or, p.orInk] } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.tag, { backgroundColor: bg }]}>
      {icon ? <Icon name={icon} size={13} color={fg} strokeWidth={2.4} /> : null}
      <Text style={{ color: fg, fontFamily: font.semibold, fontSize: 12.5 }}>{label}</Text>
    </View>
  );
}

export function MoneyRows({ rows }: { rows: Array<[string, string, boolean?]> }) {
  const p = usePalette();
  return (
    <View>
      {rows.map(([a, b, strong], i) => (
        <Row key={a} style={{ justifyContent: 'space-between', paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: p.line }}>
          <T v={strong ? 'h3' : 'small'} mute={!strong}>{a}</T>
          <T v={strong ? 'h3' : 'small'}>{b}</T>
        </Row>
      ))}
    </View>
  );
}

export function Notice({ text, tone = 'neutral' }: { text: string; tone?: 'neutral' | 'bad' }) {
  const p = usePalette();
  return (
    <View style={{ backgroundColor: tone === 'bad' ? p.badSoft : p.fill, borderRadius: radius.md, padding: 14 }}>
      <T v="small" color={tone === 'bad' ? p.bad : undefined}>{text}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  h1: { fontFamily: font.extrabold, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  h2: { fontFamily: font.extrabold, fontSize: 23, lineHeight: 28, letterSpacing: -0.3 },
  h3: { fontFamily: font.bold, fontSize: 16.5, lineHeight: 22 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: font.regular, fontSize: 14.5, lineHeight: 20 },
  xs: { fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: font.semibold, fontSize: 13, lineHeight: 18 },
  big: { fontFamily: font.extrabold, fontSize: 30, letterSpacing: -0.6 },
  btn: { minHeight: 54, borderRadius: radius.pill, paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { fontFamily: font.bold, fontSize: 16.5 },
  card: { borderRadius: radius.lg, borderWidth: 1, padding: 16, shadowColor: '#28190A', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  chip: { minHeight: 42, paddingHorizontal: 15, borderRadius: radius.pill, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: 14.5 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, borderRadius: radius.pill, alignSelf: 'flex-start' },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 28, paddingHorizontal: 10, borderRadius: 8, alignSelf: 'flex-start' },
});
