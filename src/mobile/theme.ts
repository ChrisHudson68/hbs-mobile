export const Colors = {
  navy: '#1E3A5F',
  navyDark: '#0F1F35',
  yellow: '#F59E0B',
  yellowDark: '#D97706',
  bg: '#F0F2F7',
  card: '#FFFFFF',
  border: '#E2E8F2',
  text: '#0F172A',
  muted: '#64748B',
  mutedLight: '#94A3B8',
  success: '#16A34A',
  successBg: '#F0FDF4',
  successBorder: '#BBF7D0',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  dangerBorder: '#FECACA',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  warningBorder: '#FDE68A',
  infoBg: '#EFF6FF',
  infoBorder: '#BFDBFE',
  infoText: '#1D4ED8',
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 18,
} as const;

export const Typography = {
  heading: { fontSize: 22, fontWeight: '800' as const, color: Colors.text, letterSpacing: -0.5 },
  subheading: { fontSize: 16, fontWeight: '700' as const, color: Colors.text },
  body: { fontSize: 14, color: Colors.text, lineHeight: 20 },
  caption: { fontSize: 12, color: Colors.muted },
  label: { fontSize: 13, fontWeight: '600' as const, color: Colors.muted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
} as const;
