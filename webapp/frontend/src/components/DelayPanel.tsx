import { useState, useCallback, useMemo } from 'react'
import { HelpTooltip, DSP_HELP } from './HelpTooltip'

interface DelayPanelProps {
  sessionId: string
  onProcessed: () => void
}

const DELAY_PRESETS = [
  { name: 'Slapback', delayTime: 0.08, feedback: 0.15, wet: 0.35 },
  { name: 'Echo', delayTime: 0.25, feedback: 0.45, wet: 0.3 },
  { name: 'Tape', delayTime: 0.375, feedback: 0.55, wet: 0.25 },
  { name: 'Ambient', delayTime: 0.5, feedback: 0.7, wet: 0.4 },
]

export function DelayPanel({ sessionId, onProcessed }: DelayPanelProps) {
  const [delayTime, setDelayTime] = useState(0.3)
  const [feedback, setFeedback] = useState(0.4)
  const [wet, setWet] = useState(0.3)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [activePreset, setActivePreset] = useState<string | null>(null)

  const applyPreset = useCallback((p: typeof DELAY_PRESETS[0]) => {
    setActivePreset(p.name)
    setDelayTime(p.delayTime)
    setFeedback(p.feedback)
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
          effect_type: 'delay',
          delay_time: delayTime,
          feedback,
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
  }, [sessionId, delayTime, feedback, wet, onProcessed])

  return (
    <div className="glass-card rounded-2xl border border-sky-500/20 p-4 sm:p-6 space-y-5 sm:space-y-6 animate-fade-up">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="h-5 w-1 rounded-full bg-sky-500" />
        <h2
          className="text-lg font-semibold text-sky-400 tracking-wide"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Delay
        </h2>
        <span className="ml-auto rounded-full bg-sky-500/10 border border-sky-500/20 px-3 py-0.5 text-[10px] font-medium text-sky-400/70">
          Feedback
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-zinc-500 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
        Digital delay with adjustable feedback loop. Creates rhythmic echoes from tight
        slapback to sprawling ambient washes.
      </p>

      {/* Delay Presets */}
      <div>
        <label
          className="mb-2.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Character
        </label>
        <div className="grid grid-cols-4 gap-2">
          {DELAY_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className={`rounded-xl px-3 py-2.5 text-center transition-all duration-200 ${
                activePreset === p.name
                  ? 'bg-sky-500/15 border border-sky-400/30 shadow-lg shadow-sky-500/5'
                  : 'glass-card glass-card-hover'
              }`}
            >
              <div
                className={`text-xs font-semibold ${activePreset === p.name ? 'text-sky-300' : 'text-zinc-400'}`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {p.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Echo Visualization */}
      <EchoVisualization feedback={feedback} delayTime={delayTime} />

      {/* Sliders */}
      <div className="space-y-4">
        <SliderControl
          label="Delay Time"
          value={delayTime}
          min={0.01}
          max={1.0}
          step={0.01}
          unit=""
          displayValue={`${Math.round(delayTime * 1000)} ms`}
          onChange={(v) => { setDelayTime(v); setActivePreset(null) }}
          color="sky"
          help={DSP_HELP.delayTime}
        />
        <SliderControl
          label="Feedback"
          value={feedback}
          min={0}
          max={0.95}
          step={0.01}
          unit=""
          displayValue={`${Math.round(feedback * 100)}%`}
          onChange={(v) => { setFeedback(v); setActivePreset(null) }}
          color="sky"
          help={DSP_HELP.feedback}
        />
        <SliderControl
          label="Wet / Dry"
          value={wet}
          min={0}
          max={1}
          step={0.01}
          unit=""
          displayValue={`${Math.round(wet * 100)}%`}
          onChange={(v) => { setWet(v); setActivePreset(null) }}
          color="sky"
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
        className="w-full rounded-xl bg-sky-500/15 border border-sky-500/30 py-3 text-sm font-semibold text-sky-300 transition-all duration-200 hover:bg-sky-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {processing ? 'Applying Delay...' : 'Apply Delay'}
      </button>
    </div>
  )
}

function EchoVisualization({ feedback, delayTime }: { feedback: number; delayTime: number }) {
  const bars = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const amplitude = Math.pow(feedback, i)
        const offset = (delayTime * i) / (delayTime * 8)
        return {
          opacity: Math.max(0.12, amplitude),
          height: `${Math.max(8, amplitude * 100)}%`,
          marginTop: `${offset * 30}%`,
        }
      }),
    [feedback, delayTime]
  )

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">
      <div className="relative h-16 flex items-center gap-2">
        {bars.map((bar, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center justify-end h-full"
            style={{ opacity: bar.opacity }}
          >
            <div
              className="w-full rounded-md bg-sky-500/60 transition-all duration-500"
              style={{ height: bar.height, marginTop: bar.marginTop }}
            />
          </div>
        ))}
      </div>
      <p
        className="mt-3 text-center text-[10px] text-zinc-600"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        Echo decay pattern · {Math.round(delayTime * 1000)}ms intervals
      </p>
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
