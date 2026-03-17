import { useState, useCallback, useMemo } from 'react'
import { HelpTooltip, DSP_HELP } from './HelpTooltip'
import { apiUrl } from '../lib/api'
import { ACCENT_STYLES, type AccentColor } from '../lib/accent'

interface ReverbPanelProps {
  sessionId: string
  onProcessed: () => void
}

const ROOM_PRESETS = [
  { name: 'Closet', roomSize: 0.15, damping: 0.8, wet: 0.15 },
  { name: 'Room', roomSize: 0.4, damping: 0.5, wet: 0.25 },
  { name: 'Hall', roomSize: 0.7, damping: 0.4, wet: 0.35 },
  { name: 'Cathedral', roomSize: 0.95, damping: 0.2, wet: 0.5 },
]

export function ReverbPanel({ sessionId, onProcessed }: ReverbPanelProps) {
  const [roomSize, setRoomSize] = useState(0.5)
  const [damping, setDamping] = useState(0.5)
  const [wet, setWet] = useState(0.3)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [activePreset, setActivePreset] = useState<string | null>(null)

  const applyPreset = useCallback((p: typeof ROOM_PRESETS[0]) => {
    setActivePreset(p.name)
    setRoomSize(p.roomSize)
    setDamping(p.damping)
    setWet(p.wet)
  }, [])

  const process = useCallback(async () => {
    setProcessing(true)
    setError(null)
    try {
      const res = await fetch(apiUrl('/api/process/effect'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          effect_type: 'reverb',
          room_size: roomSize,
          damping,
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
  }, [sessionId, roomSize, damping, wet, onProcessed])

  return (
    <div className="glass-card rounded-2xl border border-rose-500/20 p-4 sm:p-6 space-y-5 sm:space-y-6 animate-fade-up">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="h-5 w-1 rounded-full bg-rose-500" />
        <h2
          className="text-lg font-semibold text-rose-400 tracking-wide"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Reverb
        </h2>
        <span className="ml-auto rounded-full bg-rose-500/10 border border-rose-500/20 px-3 py-0.5 text-[10px] font-medium text-rose-400/70">
          Schroeder
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-zinc-500 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
        Algorithmic reverb using comb and allpass filters. Simulates acoustic spaces
        from tight closets to vast cathedrals.
      </p>

      {/* Room Presets */}
      <div>
        <label
          className="mb-2.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Space
        </label>
        <div className="grid grid-cols-4 gap-2">
          {ROOM_PRESETS.map((p) => (
            <button
              key={p.name}
              onClick={() => applyPreset(p)}
              className={`rounded-xl px-3 py-2.5 text-center transition-all duration-200 ${
                activePreset === p.name
                  ? 'bg-rose-500/15 border border-rose-400/30 shadow-lg shadow-rose-500/5'
                  : 'glass-card glass-card-hover'
              }`}
            >
              <div
                className={`text-xs font-semibold ${activePreset === p.name ? 'text-rose-300' : 'text-zinc-400'}`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {p.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Room Visualization */}
      <ReverbVisualization roomSize={roomSize} damping={damping} />
      {/* Sliders */}
      <div className="space-y-4">
        <SliderControl
          label="Room Size"
          value={roomSize}
          min={0.05}
          max={1}
          step={0.01}
          unit=""
          displayValue={`${Math.round(roomSize * 100)}%`}
          onChange={(v) => { setRoomSize(v); setActivePreset(null) }}
          color="rose"
          help={DSP_HELP.roomSize}
        />
        <SliderControl
          label="Damping"
          value={damping}
          min={0}
          max={1}
          step={0.01}
          unit=""
          displayValue={`${Math.round(damping * 100)}%`}
          onChange={(v) => { setDamping(v); setActivePreset(null) }}
          color="rose"
          help={DSP_HELP.damping}
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
          color="rose"
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
        className="w-full rounded-xl bg-rose-500/15 border border-rose-500/30 py-3 text-sm font-semibold text-rose-300 transition-all duration-200 hover:bg-rose-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {processing ? 'Applying Reverb...' : 'Apply Reverb'}
      </button>
    </div>
  )
}

function ReverbVisualization({ roomSize, damping }: { roomSize: number; damping: number }) {
  const bars = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => {
        const decay = Math.exp(-i * (1 - roomSize) * 0.3) * (1 - damping * 0.5)
        return { height: `${Math.max(4, decay * 100)}%`, opacity: Math.max(0.15, decay) }
      }),
    [roomSize, damping]
  )

  return (
    <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">
      <div className="relative h-16 flex items-end justify-center gap-1">
        {bars.map((style, i) => (
          <div
            key={i}
            className="w-1.5 rounded-full bg-rose-500/60 transition-all duration-500"
            style={style}
          />
        ))}
      </div>
      <p
        className="mt-3 text-center text-[10px] text-zinc-600"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        Impulse response decay
      </p>
    </div>
  )
}

function SliderControl({
  label, value, min, max, step = 0.01, unit, displayValue, onChange, color, help,
}: {
  label: string; value: number; min: number; max: number; step?: number
  unit: string; displayValue?: string; onChange: (v: number) => void; color: AccentColor
  help?: { label: string; description: string; learnMoreUrl?: string }
}) {
  const accent = ACCENT_STYLES[color]

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
          className="text-xs tabular-nums"
          style={{ fontFamily: 'var(--font-body)', color: accent.textColor }}
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
        className="w-full"
        style={{ accentColor: accent.accentColor }}
      />
    </div>
  )
}
