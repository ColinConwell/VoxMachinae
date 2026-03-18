import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Tour Step Definitions ───────────────────────────────────────────────────

interface TourStep {
  /** CSS selector for the element to spotlight (null = centered modal) */
  target: string | null
  /** Title of this step */
  title: string
  /** Body text explaining the feature */
  body: string
  /** Position of the card relative to the spotlighted element */
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center'
  /** Optional accent color for the step */
  accent?: string
  /** Optional icon/emoji for the step */
  icon?: string
}

const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: 'Welcome to Vox Machina',
    body: 'A playground for vocal effects, synthesis, and AI-powered audio processing. This quick tour will walk you through the key features.',
    placement: 'center',
    accent: 'amber',
    icon: '.',
  },
  {
    target: '[data-tour="audio-input"]',
    title: 'Record or Upload',
    body: 'Start by recording from your microphone or uploading an audio file. Drag and drop works too \u2014 WAV, MP3, FLAC, and OGG are all supported.',
    placement: 'bottom',
    accent: 'amber',
    icon: '.',
  },
  {
    target: '[data-tour="sample-browser"]',
    title: 'Sample Library',
    body: 'Browse built-in voice samples to experiment with effects without needing your own recordings. Great for quick demos.',
    placement: 'bottom',
    accent: 'emerald',
    icon: '.',
  },
  {
    target: '[data-tour="waveform"]',
    title: 'Waveform Display',
    body: 'Visualize your audio with interactive waveforms. The original appears on the left, and processed audio appears on the right after applying effects.',
    placement: 'bottom',
    accent: 'zinc',
    icon: '.',
  },
  {
    target: '[data-tour="effect-selector"]',
    title: 'Choose an Effect',
    body: 'Select from Auto-Tune, Vocoder, Reverb, Delay, Formant Shift, Denoising, and more. Each effect has its own panel with presets and fine-grained controls.',
    placement: 'bottom',
    accent: 'violet',
    icon: '.',
  },
  {
    target: '[data-tour="effects-chain"]',
    title: 'Effects Chain',
    body: 'Drag and drop effects into a processing chain to stack multiple effects in sequence. Reorder by dragging, remove with the X button.',
    placement: 'top',
    accent: 'fuchsia',
    icon: '.',
  },
  {
    target: null,
    title: 'Export Your Audio',
    body: 'After processing, download your creation as a WAV file. The export button appears once you\'ve applied at least one effect.',
    placement: 'center',
    accent: 'emerald',
    icon: '.',
  },
  {
    target: null,
    title: 'Hover for Help',
    body: 'Look for the \u24D8 icons next to parameter labels \u2014 hover or tap them for detailed explanations of what each control does. Happy experimenting!',
    placement: 'center',
    accent: 'amber',
    icon: '.',
  },
]

// ─── Local Storage Key ───────────────────────────────────────────────────────

const TOUR_COMPLETED_KEY = 'voxmachina-tour-completed'
const TOUR_VERSION = '1' // bump to re-show tour after major UI changes

// ─── Component ───────────────────────────────────────────────────────────────

interface GuidedTourProps {
  /** Force-show the tour even if completed before */
  forceShow?: boolean
  /** Called when tour finishes or is skipped */
  onComplete?: () => void
}

export function GuidedTour({ forceShow, onComplete }: GuidedTourProps) {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [spotlightRect, setSpotlightRect] = useState<DOMRect | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  // Auto-show on first visit
  useEffect(() => {
    if (forceShow) {
      const timer = setTimeout(() => {
        setActive(true)
        setStep(0)
      }, 0)
      return () => clearTimeout(timer)
    }
    const completed = localStorage.getItem(TOUR_COMPLETED_KEY)
    if (completed !== TOUR_VERSION) {
      // Small delay so the page renders first
      const timer = setTimeout(() => setActive(true), 1200)
      return () => clearTimeout(timer)
    }
  }, [forceShow])

  // Position the spotlight on the current step's target
  useEffect(() => {
    if (!active) return
    const currentStep = TOUR_STEPS[step]
    if (!currentStep?.target) {
      const timer = setTimeout(() => setSpotlightRect(null), 0)
      return () => clearTimeout(timer)
    }

    const el = document.querySelector(currentStep.target)
    if (!el) {
      const timer = setTimeout(() => setSpotlightRect(null), 0)
      return () => clearTimeout(timer)
    }

    const updateRect = () => {
      const rect = el.getBoundingClientRect()
      setSpotlightRect(rect)
    }

    // Scroll element into view, then measure
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const timer = setTimeout(updateRect, 400)

    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [active, step])

  const finish = useCallback(() => {
    setTransitioning(true)
    setTimeout(() => {
      setActive(false)
      setTransitioning(false)
      localStorage.setItem(TOUR_COMPLETED_KEY, TOUR_VERSION)
      onComplete?.()
    }, 300)
  }, [onComplete])

  const goNext = useCallback(() => {
    if (step >= TOUR_STEPS.length - 1) {
      finish()
    } else {
      setTransitioning(true)
      setTimeout(() => {
        setStep((s) => s + 1)
        setTransitioning(false)
      }, 250)
    }
  }, [step, finish])

  const goPrev = useCallback(() => {
    if (step > 0) {
      setTransitioning(true)
      setTimeout(() => {
        setStep((s) => s - 1)
        setTransitioning(false)
      }, 250)
    }
  }, [step])

  if (!active) return null

  const currentStep = TOUR_STEPS[step]
  const isCentered = currentStep.placement === 'center' || !spotlightRect
  const accent = currentStep.accent || 'amber'

  // Compute card position
  const cardStyle = isCentered
    ? {}
    : getCardPosition(spotlightRect!, currentStep.placement)

  return (
    <div
      ref={overlayRef}
      className={`fixed inset-0 z-9999 transition-opacity duration-300 ${
        transitioning ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ pointerEvents: 'auto' }}
    >
      {/* Backdrop with spotlight cutout */}
      <svg className="absolute inset-0 w-full h-full" style={{ pointerEvents: 'none' }}>
        <defs>
          <mask id="tour-spotlight-mask">
            <rect width="100%" height="100%" fill="white" />
            {spotlightRect && !isCentered && (
              <rect
                x={spotlightRect.left - 8}
                y={spotlightRect.top - 8}
                width={spotlightRect.width + 16}
                height={spotlightRect.height + 16}
                rx="12"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0, 0, 0, 0.75)"
          mask="url(#tour-spotlight-mask)"
          style={{ pointerEvents: 'auto' }}
          onClick={finish}
        />
      </svg>

      {/* Spotlight border glow */}
      {spotlightRect && !isCentered && (
        <div
          className={`absolute rounded-xl border-2 transition-all duration-500 pointer-events-none`}
          style={{
            left: spotlightRect.left - 8,
            top: spotlightRect.top - 8,
            width: spotlightRect.width + 16,
            height: spotlightRect.height + 16,
            borderColor: `var(--spotlight-color, rgba(251, 191, 36, 0.5))`,
            boxShadow: `0 0 30px var(--spotlight-glow, rgba(251, 191, 36, 0.2)), inset 0 0 30px var(--spotlight-glow, rgba(251, 191, 36, 0.05))`,
            ...getAccentVars(accent),
          }}
        />
      )}

      {/* Card */}
      <div
        className={`absolute transition-all duration-500 ease-out ${
          isCentered
            ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
            : ''
        }`}
        style={!isCentered ? cardStyle : undefined}
      >
        <div
          className="w-[calc(100vw-32px)] sm:w-[380px] max-w-[380px] rounded-2xl border border-white/10 p-5 sm:p-6 space-y-4"
          style={{
            background: 'rgba(12, 12, 16, 0.92)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            boxShadow: `
              0 0 0 1px rgba(255,255,255,0.04),
              0 8px 40px rgba(0,0,0,0.6),
              0 0 80px ${getAccentRgba(accent, 0.08)}
            `,
          }}
        >
          {/* Step indicator */}
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === step
                      ? `w-6 bg-${accent}-400`
                      : i < step
                      ? `w-1.5 bg-${accent}-400/40`
                      : 'w-1.5 bg-zinc-700'
                  }`}
                  style={
                    i === step
                      ? { backgroundColor: getAccentHex(accent) }
                      : i < step
                      ? { backgroundColor: getAccentRgba(accent, 0.4) }
                      : undefined
                  }
                />
              ))}
            </div>
            <span
              className="ml-auto text-[10px] font-medium tracking-wider text-zinc-600"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {step + 1} / {TOUR_STEPS.length}
            </span>
          </div>

          {/* Title */}
          <h3
            className="text-lg font-bold tracking-tight"
            style={{
              fontFamily: 'var(--font-display)',
              color: getAccentHex(accent),
            }}
          >
            {currentStep.title}
          </h3>

          {/* Body */}
          <p
            className="text-sm leading-relaxed text-zinc-400"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {currentStep.body}
          </p>

          {/* Navigation */}
          <div className="flex items-center gap-3 pt-1">
            {step > 0 && (
              <button
                onClick={goPrev}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-zinc-400 transition-colors hover:text-zinc-200 hover:bg-white/5"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Back
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={finish}
              className="rounded-lg px-4 py-2 text-xs font-semibold text-zinc-600 transition-colors hover:text-zinc-400"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Skip
            </button>
            <button
              onClick={goNext}
              className="rounded-xl px-5 py-2.5 text-xs font-bold transition-all duration-200 hover:brightness-110"
              style={{
                fontFamily: 'var(--font-display)',
                backgroundColor: getAccentRgba(accent, 0.2),
                color: getAccentHex(accent),
                border: `1px solid ${getAccentRgba(accent, 0.3)}`,
              }}
            >
              {step >= TOUR_STEPS.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Re-trigger Button ───────────────────────────────────────────────────────

interface TourTriggerProps {
  onClick: () => void
  className?: string
}

export function TourTrigger({ onClick, className = 'bottom-6 right-6' }: TourTriggerProps) {
  return (
    <button
      onClick={onClick}
      className={`fixed ${className} z-50 h-10 w-10 rounded-full glass-card border border-amber-500/20 text-amber-400/70 text-sm font-bold transition-all duration-200 hover:border-amber-500/40 hover:text-amber-400 hover:scale-110 hover:shadow-lg hover:shadow-amber-500/10`}
      style={{ fontFamily: 'var(--font-display)' }}
      title="Replay guided tour"
    >
      ?
    </button>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ACCENT_MAP: Record<string, { hex: string; rgb: string }> = {
  amber: { hex: '#FBBF24', rgb: '251, 191, 36' },
  violet: { hex: '#8B5CF6', rgb: '139, 92, 246' },
  emerald: { hex: '#34D399', rgb: '52, 211, 153' },
  rose: { hex: '#FB7185', rgb: '251, 113, 133' },
  sky: { hex: '#38BDF8', rgb: '56, 189, 248' },
  teal: { hex: '#2DD4BF', rgb: '45, 212, 191' },
  lime: { hex: '#A3E635', rgb: '163, 230, 53' },
  fuchsia: { hex: '#E879F9', rgb: '232, 121, 249' },
  indigo: { hex: '#818CF8', rgb: '129, 140, 248' },
  zinc: { hex: '#A1A1AA', rgb: '161, 161, 170' },
}

function getAccentHex(accent: string) {
  return ACCENT_MAP[accent]?.hex ?? ACCENT_MAP.amber.hex
}

function getAccentRgba(accent: string, alpha: number) {
  const rgb = ACCENT_MAP[accent]?.rgb ?? ACCENT_MAP.amber.rgb
  return `rgba(${rgb}, ${alpha})`
}

function getAccentVars(accent: string): React.CSSProperties {
  return {
    '--spotlight-color': getAccentRgba(accent, 0.5),
    '--spotlight-glow': getAccentRgba(accent, 0.2),
  } as React.CSSProperties
}

function getCardPosition(
  rect: DOMRect,
  placement: 'top' | 'bottom' | 'left' | 'right' | 'center',
): React.CSSProperties {
  if (placement === 'center') {
    return {}
  }

  const gap = 16
  const cardW = Math.min(380, window.innerWidth - 32)

  switch (placement) {
    case 'bottom':
      return {
        top: rect.bottom + gap,
        left: Math.max(16, Math.min(rect.left + rect.width / 2 - cardW / 2, window.innerWidth - cardW - 16)),
      }
    case 'top':
      return {
        bottom: window.innerHeight - rect.top + gap,
        left: Math.max(16, Math.min(rect.left + rect.width / 2 - cardW / 2, window.innerWidth - cardW - 16)),
      }
    case 'left':
      return {
        top: rect.top + rect.height / 2 - 80,
        right: window.innerWidth - rect.left + gap,
      }
    case 'right':
      return {
        top: rect.top + rect.height / 2 - 80,
        left: rect.right + gap,
      }
  }
}
