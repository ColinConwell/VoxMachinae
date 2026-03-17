import { useState, useCallback } from 'react'
import { HelpTooltip, DSP_HELP } from './HelpTooltip'
import { apiUrl } from '../lib/api'

interface AutoTunePanelProps {
  sessionId: string
  onProcessed: () => void
}

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const SCALE_TYPES = [
  'chromatic', 'major', 'natural_minor', 'harmonic_minor',
  'dorian', 'mixolydian', 'pentatonic_major', 'pentatonic_minor', 'blues',
]
const PRESETS = ['natural', 'pop', 't_pain', 'cher', 'robotic', 'subtle']

export function AutoTunePanel({ sessionId, onProcessed }: AutoTunePanelProps) {
  const [key, setKey] = useState('C')
  const [scaleType, setScaleType] = useState('chromatic')
  const [retuneSpeed, setRetuneSpeed] = useState(50)
  const [humanize, setHumanize] = useState(30)
  const [transpose, setTranspose] = useState(0)
  const [formantCorrection, setFormantCorrection] = useState(true)
  const [preset, setPreset] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const applyPreset = useCallback((name: string) => {
    setPreset(name)
    switch (name) {
      case 'natural':   setRetuneSpeed(200); setHumanize(80); break
      case 'pop':       setRetuneSpeed(50);  setHumanize(40); break
      case 't_pain':    setRetuneSpeed(0);   setHumanize(0);  break
      case 'cher':      setRetuneSpeed(0);   setHumanize(0);  break
      case 'robotic':   setRetuneSpeed(0);   setHumanize(0);  break
      case 'subtle':    setRetuneSpeed(150); setHumanize(60); break
    }
  }, [])

  const process = useCallback(async () => {
    setProcessing(true)
    setError(null)
    try {
      const res = await fetch(apiUrl('/api/process/autotune'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          key,
          scale_type: scaleType,
          retune_speed: retuneSpeed,
          humanize,
          transpose,
          formant_correction: formantCorrection,
          preset: preset ?? undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || 'Processing failed')
      }
      onProcessed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setProcessing(false)
    }
  }, [sessionId, key, scaleType, retuneSpeed, humanize, transpose, formantCorrection, preset, onProcessed])

  return (
    <div className="glass-card rounded-2xl border border-amber-500/20 p-4 sm:p-6 space-y-5 sm:space-y-6 animate-fade-up">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="h-5 w-1 rounded-full bg-amber-500" />
        <h2
          className="text-lg font-semibold text-gradient-amber tracking-wide"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Auto-Tune
        </h2>
      </div>

      {/* Presets */}
      <div>
        <label
          className="mb-2.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Presets
        </label>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => applyPreset(p)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                preset === p
                  ? 'bg-amber-500/20 border border-amber-400/40 text-amber-300 glow-amber'
                  : 'glass-card glass-card-hover text-zinc-400'
              }`}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {p.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Key & Scale */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <HelpTooltip {...DSP_HELP.key}>Key</HelpTooltip>
          </label>
          <select
            value={key}
            onChange={(e) => setKey(e.target.value)}
            className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-sm text-zinc-200 backdrop-blur-sm focus:border-amber-500/30 focus:outline-none transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {KEYS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
        <div>
          <label
            className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            <HelpTooltip {...DSP_HELP.scaleType}>Scale</HelpTooltip>
          </label>
          <select
            value={scaleType}
            onChange={(e) => setScaleType(e.target.value)}
            className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-sm text-zinc-200 backdrop-blur-sm focus:border-amber-500/30 focus:outline-none transition-colors"
            style={{ fontFamily: 'var(--font-body)' }}
          >
            {SCALE_TYPES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-4">
        <SliderControl
          label="Retune Speed"
          value={retuneSpeed}
          min={0}
          max={400}
          unit="ms"
          onChange={setRetuneSpeed}
          help={DSP_HELP.retuneSpeed}
        />
        <SliderControl
          label="Humanize"
          value={humanize}
          min={0}
          max={100}
          unit="%"
          onChange={setHumanize}
          help={DSP_HELP.humanize}
        />
        <SliderControl
          label="Transpose"
          value={transpose}
          min={-24}
          max={24}
          unit="st"
          onChange={setTranspose}
          help={DSP_HELP.transpose}
        />
      </div>

      {/* Formant Correction Toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <div
          onClick={() => setFormantCorrection(!formantCorrection)}
          className={`relative h-6 w-11 rounded-full transition-all duration-200 ${
            formantCorrection ? 'bg-amber-500/80' : 'bg-white/[0.06]'
          }`}
        >
          <div
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-200 ${
              formantCorrection ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </div>
        <span className="text-sm text-zinc-300" style={{ fontFamily: 'var(--font-body)' }}>
          <HelpTooltip {...DSP_HELP.formantCorrection}>Formant Correction</HelpTooltip>
        </span>
      </label>

      {/* Process Button */}
      {error && (
        <p className="text-sm text-red-400" style={{ fontFamily: 'var(--font-body)' }}>{error}</p>
      )}
      <button
        onClick={process}
        disabled={processing}
        className="w-full rounded-xl bg-amber-500/15 border border-amber-500/30 py-3 text-sm font-semibold text-amber-300 transition-all duration-200 hover:bg-amber-500/25 hover:glow-amber disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {processing ? 'Processing...' : 'Apply Auto-Tune'}
      </button>
    </div>
  )
}

function SliderControl({
  label, value, min, max, unit, onChange, help,
}: {
  label: string; value: number; min: number; max: number; unit: string
  onChange: (v: number) => void
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
          className="text-xs tabular-nums text-amber-400/70"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-amber-500"
      />
    </div>
  )
}
