/* eslint-disable react-refresh/only-export-components */
import { useState, useRef, useEffect } from 'react'

interface HelpTooltipProps {
  /** Short label for the control */
  label: string
  /** Longer explanation of the DSP concept */
  description: string
  /** Optional "Learn more" link */
  learnMoreUrl?: string
  /** Position relative to the trigger */
  position?: 'top' | 'bottom' | 'left' | 'right'
  /** Children to wrap */
  children?: React.ReactNode
  /** Inline mode — renders a small "?" icon next to children */
  inline?: boolean
}

export function HelpTooltip({
  label,
  description,
  learnMoreUrl,
  position = 'top',
  children,
  inline = true,
}: HelpTooltipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setOpen(true)
  }

  const hide = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen((prev) => !prev)
    }
    if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  const arrowClasses: Record<string, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-zinc-800 border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-zinc-800 border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-zinc-800 border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-zinc-800 border-y-transparent border-l-transparent',
  }

  const tooltip = open && (
    <div
      className={`absolute z-50 ${positionClasses[position]} pointer-events-auto`}
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <div className="w-64 rounded-xl bg-zinc-800/95 backdrop-blur-md border border-zinc-700/50 p-3 shadow-xl shadow-black/30">
        <div className="flex items-start gap-2 mb-1">
          <span className="text-amber-400 text-xs">✦</span>
          <span
            className="text-xs font-semibold uppercase tracking-wider text-zinc-200"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {label}
          </span>
        </div>
        <p className="text-xs leading-relaxed text-zinc-400" style={{ fontFamily: 'var(--font-body)' }}>
          {description}
        </p>
        {learnMoreUrl && (
          <a
            href={learnMoreUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-[10px] font-medium uppercase tracking-wider text-amber-400/70 hover:text-amber-300 transition-colors"
          >
            Learn more →
          </a>
        )}
      </div>
      {/* Arrow */}
      <div className={`absolute w-0 h-0 border-[5px] ${arrowClasses[position]}`} />
    </div>
  )

  if (inline) {
    return (
      <span className="inline-flex items-center gap-1.5" ref={ref}>
        {children}
        <span
          className="relative inline-flex items-center justify-center w-3.5 h-3.5 rounded-full
                     bg-zinc-700/50 text-zinc-500 text-[9px] font-bold cursor-help
                     hover:bg-amber-500/20 hover:text-amber-400 transition-all duration-200
                     select-none"
          onMouseEnter={show}
          onMouseLeave={hide}
          onFocus={show}
          onBlur={hide}
          onClick={() => setOpen(!open)}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={`Help: ${label}`}
          aria-expanded={open}
        >
          ?
          {tooltip}
        </span>
      </span>
    )
  }

  return (
    <div className="relative inline-block" ref={ref} onMouseEnter={show} onMouseLeave={hide}>
      {children}
      {tooltip}
    </div>
  )
}

// ─── DSP Help Content Database ───────────────────────────────────────────────

export const DSP_HELP = {
  // Auto-Tune
  retuneSpeed: {
    label: 'Retune Speed',
    description:
      'How quickly pitch snaps to the target note. 0ms = instant (robotic effect). 50-100ms = natural pop vocal. 200ms+ = barely noticeable correction. The iconic "T-Pain effect" uses 0ms.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Auto-Tune',
  },
  humanize: {
    label: 'Humanize',
    description:
      'Preserves natural vibrato and micro-pitch variations on sustained notes. At 0% every pitch deviation is corrected. At 100% sustained notes are left almost untouched — only transitions snap.',
  },
  key: {
    label: 'Key',
    description:
      'The root note of the musical scale. Auto-tune will only correct pitch to notes within this key. Choose the key your song is in for musical results.',
  },
  scaleType: {
    label: 'Scale Type',
    description:
      'The collection of allowed notes. Chromatic = all 12 notes. Major/Minor = 7-note scales. Pentatonic = 5-note scales common in pop/blues. The scale determines which notes are "correct".',
  },
  transpose: {
    label: 'Transpose',
    description:
      'Shifts the entire pitch up or down by semitones. +12 = one octave up. -12 = one octave down. Useful for harmonization or gender-shifting effects.',
  },
  formantCorrection: {
    label: 'Formant Correction',
    description:
      'Preserves the vocal character (timbre) when pitch is shifted. Without it, large pitch shifts create "chipmunk" (up) or "monster" (down) effects. Uses WORLD vocoder spectral envelope.',
  },

  // Vocoder
  vocoderBands: {
    label: 'Band Count',
    description:
      'Number of frequency bands the vocoder uses to analyze the voice. More bands = more intelligible speech but heavier processing. 16-32 is typical. Daft Punk used ~20 bands.',
  },
  carrierType: {
    label: 'Carrier Signal',
    description:
      'The sound the vocoder imposes your voice onto. Sawtooth = bright, buzzy (classic robot). Square = hollow, nasal. Noise = whisper/wind. External = use any audio as carrier.',
  },
  vocoderAttack: {
    label: 'Envelope Attack',
    description:
      'How quickly each band responds to changes in your voice. Fast attack = crisp consonants, responsive. Slow attack = smoother, more legato, loses transients.',
  },
  vocoderRelease: {
    label: 'Envelope Release',
    description:
      'How quickly bands decay after the voice drops. Short release = tight, staccato. Long release = bands ring out, vowels sustain, dreamier effect.',
  },

  // Reverb
  roomSize: {
    label: 'Room Size',
    description:
      'Simulates the size of the acoustic space. Small values = tight room or closet. Large values = concert hall or cathedral. Affects the length and density of reflections.',
  },
  damping: {
    label: 'Damping',
    description:
      'How quickly high frequencies are absorbed by the virtual room. High damping = warm, muffled reverb (carpet/curtains). Low damping = bright, shimmery reverb (tile/glass).',
  },
  wetDry: {
    label: 'Wet / Dry Mix',
    description:
      'Balance between original (dry) and reverb (wet) signal. 0% = no reverb. 100% = reverb only. 20-35% is typical for vocals. Higher values create ambient/shoegaze effects.',
  },

  // Delay
  delayTime: {
    label: 'Delay Time',
    description:
      'Time between the original sound and its echo. Short (10-50ms) = doubling/thickening. Medium (100-500ms) = distinct echo. Sync to BPM for rhythmic patterns.',
  },
  feedback: {
    label: 'Feedback',
    description:
      'How much of the delayed signal feeds back in, creating repeating echoes. 0% = single echo. 50% = several fading repeats. 90%+ = near-infinite echo cascade.',
  },

  // Formant
  formantShift: {
    label: 'Formant Shift',
    description:
      'Moves the vocal formant frequencies (resonances that define vowel sounds) without changing pitch. Positive = smaller vocal tract (child-like). Negative = larger vocal tract (deeper).',
  },

  // Denoise
  denoiseReduction: {
    label: 'Noise Reduction',
    description:
      'Amount of noise to remove via spectral gating. Gentle values preserve naturalness. Aggressive values remove more noise but may introduce artifacts (musical noise / underwater effect).',
  },

  // General
  effectsChain: {
    label: 'Effects Chain',
    description:
      'Audio flows through effects in order from top to bottom. The order matters — reverb before distortion sounds very different from distortion before reverb. Drag to reorder.',
  },
} as const
