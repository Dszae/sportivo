// Sportivo design tokens. Same system as the website: a graphite ramp with a
// faint turf tint, lime as the only accent, red only for things that are live.
import { Platform, TextStyle } from 'react-native';

export const colors = {
  // Surfaces
  ink950: '#0b0e0d', // deepest: tab bar, headers
  ink900: '#101312', // screen background
  ink800: '#161a19', // card
  ink700: '#1e2321', // raised: pressed row, input, selected chip
  ink600: '#2a302d', // hover on raised / avatar fallback
  // Text
  fg: '#edf0ee',
  fg2: '#a4aca8',
  fg3: '#7c847f',
  // Hairlines
  line: 'rgba(237, 240, 238, 0.08)',
  lineStrong: 'rgba(237, 240, 238, 0.14)',
  // Accent and states
  lime: '#c9f36b',
  limeInk: '#0f130c',
  live: '#e5484d',
  up: '#4cc38a',
  black: '#000000',
} as const;

export const fonts = {
  sans: 'Manrope_400Regular',
  sansMedium: 'Manrope_500Medium',
  sansSemibold: 'Manrope_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;

export const radius = {
  sm: 6, // tags, keycaps
  md: 8, // buttons, inputs, rows
  lg: 12, // small cards
  xl: 16, // cards
  panel: 20, // panels, sheets
  full: 999, // dots, avatars only
} as const;

// Row heights. Compact 36, default 44 (touch), tall 52.
export const row = { compact: 36, default: 44, tall: 52 } as const;

type T = TextStyle;

// Type roles. Weights are 400/500 only; 600 is reserved for one headline per screen.
export const type = {
  meta: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 16, color: colors.fg3 } as T,
  caption: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: colors.fg2 } as T,
  body: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.fg } as T,
  bodySecondary: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22, color: colors.fg2 } as T,
  label: { fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 20, color: colors.fg } as T,
  eyebrow: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, color: colors.fg3 } as T,
  sectionTitle: { fontFamily: fonts.sansMedium, fontSize: 20, lineHeight: 26, color: colors.fg } as T,
  screenTitle: { fontFamily: fonts.sansMedium, fontSize: 28, lineHeight: 32, letterSpacing: -0.3, color: colors.fg } as T,
  hero: { fontFamily: fonts.sansSemibold, fontSize: 36, lineHeight: 38, letterSpacing: -0.7, color: colors.fg } as T,
  // The stadium clock: every kickoff time, score, over count and numeric count.
  clock: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18, color: colors.fg2, fontVariant: ['tabular-nums'] } as T,
  clockStrong: { fontFamily: fonts.monoMedium, fontSize: 15, lineHeight: 20, color: colors.fg, fontVariant: ['tabular-nums'] } as T,
  clockLarge: { fontFamily: fonts.monoMedium, fontSize: 28, lineHeight: 32, color: colors.fg, fontVariant: ['tabular-nums'] } as T,
} as const;

// Reusable style fragments. Spread them into StyleSheet entries.
export const ui = {
  screen: { flex: 1, backgroundColor: colors.ink900 } as const,
  card: {
    backgroundColor: colors.ink800,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.line,
  } as const,
  panel: {
    backgroundColor: colors.ink800,
    borderRadius: radius.panel,
    borderWidth: 1,
    borderColor: colors.line,
  } as const,
  hairlineTop: { borderTopWidth: 1, borderTopColor: colors.line } as const,
  hairlineBottom: { borderBottomWidth: 1, borderBottomColor: colors.line } as const,
  // Buttons: 44 tall for touch, 36 small.
  btn: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  } as const,
  btnSm: { height: 36, paddingHorizontal: 14, borderRadius: radius.md } as const,
  btnPrimary: { backgroundColor: colors.lime } as const,
  btnPrimaryText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.limeInk } as T,
  btnSecondary: { backgroundColor: colors.ink700, borderWidth: 1, borderColor: colors.lineStrong } as const,
  btnSecondaryText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.fg } as T,
  btnLive: { backgroundColor: colors.fg } as const,
  btnLiveText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.ink900 } as T,
  btnGhostText: { fontFamily: fonts.sansMedium, fontSize: 15, color: colors.fg2 } as T,
  // Chips for filters and segmented controls.
  chip: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  } as const,
  chipActive: { backgroundColor: colors.ink700 } as const,
  chipText: { fontFamily: fonts.sansMedium, fontSize: 13, color: colors.fg2 } as T,
  chipTextActive: { color: colors.fg } as T,
  // Square icon button, 36.
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink800,
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  input: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink900,
    paddingHorizontal: 12,
    fontFamily: fonts.sans,
    fontSize: 15,
    color: colors.fg,
  } as const,
  // List row with a hairline under it.
  row: {
    minHeight: row.default,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  } as const,
  // The only pulsing element on the app is the live dot (via LiveDot component).
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.live } as const,
  liveText: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.live } as T,
  // Floating shadows only for things floating over content (sheets, toasts). Neutral, never colored.
  float: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
    android: { elevation: 8 },
    default: {},
  }) as object,
} as const;

export const placeholderTextColor = colors.fg3;
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;
