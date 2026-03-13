import { useState, useCallback } from 'react'
import { HelpTooltip, DSP_HELP } from './HelpTooltip'

interface FormantPanelProps {
  sessionId: string
  onProcessed: () => void
}

export function FormantPanel({ sessionId, onProcessed }: FormantPanelProps) {
  const [shiftSemitones, setShiftSemitones] = useState(0)
  const [wet, setWet] = useState(1.0)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const FORMANT_PRESETS = [
    { name: 'Chipmunk', shift: 6, wet: 1.0 },
    { name: 'Bright', shift: 3, wet: 0.8 },
    { name: 'Natural', shift: 0, wet: 1.0 },
    { name: 'Deep', shift: -4, wet: 0.9 },
    { name: 'Giant', shift: -8, wet: 1.0 },
  ]

  const [activePreset, setActivePreset] = useState<string | null>(null)

  const applyPreset = useCallback((p: typeof FORMANT_PRESETS[0]) => {
    setActivePreset(p.name)
    setShiftSemitones(p.shift)
    setWet(p.wet)
  }, [])

  const process = useCallback(async () => {
    setProcessing(true)
    setError(null)
    try {
      const res = await fetch('/api/process/effect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          effect_type: 'formant_shift',
          shift_semitones: shiftSemitones,
          wet,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `Processing failed (${res.status})`)
      }
      onProcessed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setProcessing(false)
    }
  }, [sessionId, shiftSemitones, wet, onProcessed])

  // Generate a simple formant envelope visualization
  const formantFreqs = [500, 1500, 2500, 3500, 4500]
  const shiftFactor = Math.pow(2, shiftSemitones / 12)

  return (
    <div className="glass-card rounded-2xl border border-teal-500/20 p-4 sm:p-6 space-y-5 sm:space-y-6 animate-fade-up">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="h-5 w-1 rounded-full bg-teal-500" />
        <h2
          className="text-lg font-semibold text-teal-400 tracking-wide"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Formant Shift
        </h2>
        <span className="ml-auto rounded-full bg-teal-500/10 border border-teal-500/20 px-3 py-0.5 text-[10px] font-medium text-teal-400/70">
          WORLD
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-zinc-500 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
        Shift vocal formant frequencies using the WORLD vocoder. Changes the character
        of a voice without altering its pitch — from chipmunk highs to deep bass.
      </p>

      {/* Formant Presets */}
      <div>
        <label
          className="mb-2.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Voice Character
        </label>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {FORMANT_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className={`rounded-xl px-2 py-2.5 text-center transition-all duration-200 ${
                activePreset === p.name
                  ? 'bg-teal-500/15 border border-teal-400/30 shadow-lg shadow-teal-500/5'
                  : 'glass-card glass-card-hover'
              }`}
            >
              <div
                className={`text-xs font-semibold ${activePreset === p.name ? 'text-teal-300' : 'text-zinc-400'}`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {p.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Formant Visualization */}
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">
        <div className="relative h-20 flex items-end gap-1">
          {/* Spectral envelope — original (dim) */}
          {Array.from({ length: 32 }, (_, i) => {
            const freq = (i / 32) * 5000
            let amp = 0
            for (const f of formantFreqs) {
              amp += Math.exp(-Math.pow((freq - f) / 300, 2))
            }
            return (
              <div
                key={`orig-${i}`}
                className="flex-1 rounded-full bg-zinc-600/30 transition-all duration-500"
                style={{ height: `${Math.max(4, amp * 30)}%` }}
              />
            )
          })}
          {/* Spectral envelope — shifted (bright) */}
          <div className="absolute inset-0 flex items-end gap-1">
            {Array.from({ length: 32 }, (_, i) => {
              const freq = (i / 32) * 5000
              let amp = 0
              for (const f of formantFreqs) {
                amp += Math.exp(-Math.pow((freq - f * shiftFactor) / 300, 2))
              }
              return (
                <div
                  key={`shift-${i}`}
                  className="flex-1 rounded-full bg-teal-500/50 transition-all duration-500"
                  style={{ height: `${Math.max(4, amp * 30)}%` }}
                />
              )
            })}
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-zinc-600" style={{ fontFamily: 'var(--font-body)' }}>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-zinc-600/30" /> Original
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-teal-500/50" /> Shifted
          </span>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-4">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <HelpTooltip {...DSP_HELP.formantShift}>Shift</HelpTooltip>
            </label>
            <span
              className="text-xs tabular-nums text-teal-400/70"
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {shiftSemitones > 0 ? '+' : ''}{shiftSemitones} st
            </span>
          </div>
          <input
            type="range"
            min={-12}
            max={12}
            step={1}
            value={shiftSemitones}
            onChange={(e) => { setShiftSemitones(Number(e.target.value)); setActivePreset(null) }}
            className="w-full accent-teal-500"
          />
          <div className="mt-1 flex justify-between text-[9px] text-zinc-600" style={{ fontFamily: 'var(--font-body)' }}>
            <span>−12 st</span>
            <span>0</span>
            <span>+12 st</span>
          </div>
        </div>
        <SliderControl
          label="Wet / Dry"
          value={wet}
          min={0}
          max={1}
          step={0.01}
          unit=""
          displayValue={`${Math.round(wet * 100)}%`}
          onChange={(v) => { setWet(v); setActivePreset(null) }}
          color="teal"
          help={DSP_HELP.wetDry}
        />
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-400" style={{ fontFamily: 'var(--font-body)' }}>
          {error}
        </p>
      )}

      {/* Process Button */}
      <button
        onClick={process}
        disabled={processing}
        className="w-full rounded-xl bg-teal-500/15 border border-teal-500/30 py-3 text-sm font-semibold text-teal-300 transition-all duration-200 hover:bg-teal-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {processing ? 'Shifting Formants...' : 'Apply Formant Shift'}
      </button>
    </div>
  )
}

function SliderControl({
  label, value, min, max, step = 0.01, unit, displayValue, onChange, color, help,
}: {
  label: string; value: number; min: number; max: number; step?: number
  unit: string; displayValue?: string; onChange: (v: number) => void; color: string
  help?: { label: string; description: string; learnMoreUrl?: string }
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label
          className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {help ? <HelpTooltip {...help}>{label}</HelpTooltip> : label}
        </label>
        <span
          className={`text-xs tabular-nums text-${color}-400/70`}
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {displayValue ?? `${value}${unit}`}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full accent-${color}-500`}
      />
    </div>
  )
}
