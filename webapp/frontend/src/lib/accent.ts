export const ACCENT_STYLES = {
  amber: { textColor: 'rgba(252, 211, 77, 0.85)', accentColor: '#fbbf24' },
  cyan: { textColor: 'rgba(103, 232, 249, 0.85)', accentColor: '#06b6d4' },
  lime: { textColor: 'rgba(190, 242, 100, 0.85)', accentColor: '#84cc16' },
  rose: { textColor: 'rgba(253, 164, 175, 0.85)', accentColor: '#f43f5e' },
  sky: { textColor: 'rgba(125, 211, 252, 0.85)', accentColor: '#0ea5e9' },
  teal: { textColor: 'rgba(94, 234, 212, 0.85)', accentColor: '#14b8a6' },
  violet: { textColor: 'rgba(196, 181, 253, 0.85)', accentColor: '#8b5cf6' },
} as const

export type AccentColor = keyof typeof ACCENT_STYLES
