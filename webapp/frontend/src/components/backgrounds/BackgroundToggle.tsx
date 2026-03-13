import { useBackground, type BackgroundMode } from '../../contexts/BackgroundContext'

const MODE_LABELS: Record<BackgroundMode, string> = {
  'wave-grid': 'Wave Grid',
  'particle-field': 'Particles',
  'static-gradient': 'Gradient',
}

/**
 * SVG icons for each background mode.
 * Small, simple, and visually distinct.
 */
function ModeIcon({ mode }: { mode: BackgroundMode }) {
  const size = 16
  const shared = { width: size, height: size, viewBox: '0 0 16 16', fill: 'none', xmlns: 'http://www.w3.org/2000/svg' }

  switch (mode) {
    case 'wave-grid':
      // Grid/mesh icon
      return (
        <svg {...shared}>
          <path d="M2 4c2 2 4-2 6 0s4-2 6 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <path d="M2 8c2 2 4-2 6 0s4-2 6 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
          <path d="M2 12c2 2 4-2 6 0s4-2 6 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
        </svg>
      )
    case 'particle-field':
      // Scattered dots icon
      return (
        <svg {...shared}>
          <circle cx="4" cy="4" r="1.3" fill="currentColor" opacity="0.8" />
          <circle cx="11" cy="3" r="1" fill="currentColor" opacity="0.5" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" opacity="0.9" />
          <circle cx="3" cy="11" r="1" fill="currentColor" opacity="0.6" />
          <circle cx="13" cy="10" r="1.2" fill="currentColor" opacity="0.7" />
          <circle cx="7" cy="13" r="0.8" fill="currentColor" opacity="0.4" />
          <line x1="4" y1="4" x2="8" y2="8" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
          <line x1="8" y1="8" x2="13" y2="10" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
        </svg>
      )
    case 'static-gradient':
      // Gradient/layers icon
      return (
        <svg {...shared}>
          <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
          <rect x="3" y="6" width="10" height="7" rx="1.5" fill="currentColor" opacity="0.15" />
          <rect x="3" y="9" width="10" height="4" rx="1.5" fill="currentColor" opacity="0.25" />
        </svg>
      )
  }
}

export function BackgroundToggle() {
  const { mode, cycleMode } = useBackground()

  return (
    <button
      onClick={cycleMode}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all duration-300 hover:scale-105 active:scale-95 group"
      style={{
        background: 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.45)',
        fontFamily: 'var(--font-body)',
        letterSpacing: '0.05em',
      }}
      title={`Background: ${MODE_LABELS[mode]} (click to switch)`}
      aria-label={`Current background: ${MODE_LABELS[mode]}. Click to cycle.`}
    >
      <span className="transition-colors duration-300 group-hover:text-amber-400/70">
        <ModeIcon mode={mode} />
      </span>
      <span className="hidden sm:inline transition-colors duration-300 group-hover:text-zinc-300">
        {MODE_LABELS[mode]}
      </span>
    </button>
  )
}
