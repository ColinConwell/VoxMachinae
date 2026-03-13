import { useState, useCallback } from 'react'
import { HelpTooltip, DSP_HELP } from './HelpTooltip'

interface VocoderPanelProps {
  sessionId: string
  onProcessed: () => void
}

type VocoderType = 'channel' | 'phase' | 'lpc'

const VOCODER_PRESETS: Record<VocoderType, string[]> = {
  channel: ['daft_punk', 'kraftwerk', 'talkbox', 'warm_pad', 'bright_lead'],
  phase: ['robotize', 'whisper', 'frozen'],
  lpc: ['classic_robot', 'radio', 'alien'],
}

const CARRIER_TYPES = ['saw', 'square', 'sine', 'pulse', 'noise']

export function VocoderPanel({ sessionId, onProcessed }: VocoderPanelProps) {
  const [vocoderType, setVocoderType] = useState<VocoderType>('channel')
  const [preset, setPreset] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Channel vocoder params
  const [numBands, setNumBands] = useState(24)
  const [carrierType, setCarrierType] = useState('saw')
  const [carrierFreq, setCarrierFreq] = useState(130.81)
  const [envelopeAttack, setEnvelopeAttack] = useState(5)
  const [envelopeRelease, setEnvelopeRelease] = useState(20)
  const [sibilanceAmount, setSibilanceAmount] = useState(0.3)

  // Phase vocoder params
  const [phaseMode, setPhaseMode] = useState<'robotize' | 'whisper' | 'freeze' | 'cross_synthesis'>('robotize')

  // LPC params
  const [lpcOrder, setLpcOrder] = useState(24)

  const process = useCallback(async () => {
    setProcessing(true)
    setError(null)
    try {
      const params: Record<string, unknown> = {
        session_id: sessionId,
        vocoder_type: vocoderType,
        preset: preset ?? undefined,
      }

      if (vocoderType === 'channel') {
        params.num_bands = numBands
        params.carrier_type = carrierType
        params.carrier_freq = carrierFreq
        params.envelope_attack = envelopeAttack
        params.envelope_release = envelopeRelease
        params.sibilance_amount = sibilanceAmount
      } else if (vocoderType === 'phase') {
        params.mode = phaseMode
      } else if (vocoderType === 'lpc') {
        params.order = lpcOrder
      }

      const res = await fetch('/api/process/vocoder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
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
  }, [sessionId, vocoderType, preset, numBands, carrierType, carrierFreq, envelopeAttack, envelopeRelease, sibilanceAmount, phaseMode, lpcOrder, onProcessed])

  const presets = VOCODER_PRESETS[vocoderType]

  return (
    <div className="glass-card rounded-2xl border border-purple-500/20 p-4 sm:p-6 space-y-5 sm:space-y-6 animate-fade-up">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="h-5 w-1 rounded-full bg-purple-500" />
        <h2
          className="text-lg font-semibold text-purple-400 tracking-wide"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Vocoder
        </h2>
      </div>

      {/* Vocoder Type Tabs */}
      <div className="flex gap-1 rounded-xl bg-white/[0.03] border border-white/[0.06] p-1">
        {(['channel', 'phase', 'lpc'] as VocoderType[]).map((t) => (
          <button
            key={t}
            onClick={() => { setVocoderType(t); setPreset(null) }}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-wider transition-all duration-200 ${
              vocoderType === t
                ? 'bg-purple-500/20 border border-purple-400/30 text-purple-300 shadow-lg shadow-purple-500/10'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {t === 'lpc' ? 'LPC' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
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
          {presets.map((p) => (
            <button
              key={p}
              onClick={() => setPreset(p)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                preset === p
                  ? 'bg-purple-500/20 border border-purple-400/40 text-purple-300 glow-violet'
                  : 'glass-card glass-card-hover text-zinc-400'
              }`}
              style={{ fontFamily: 'var(--font-body)' }}
            >
              {p.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Channel Vocoder Controls */}
      {vocoderType === 'channel' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <HelpTooltip {...DSP_HELP.carrierType}>Carrier</HelpTooltip>
              </label>
              <select
                value={carrierType}
                onChange={(e) => setCarrierType(e.target.value)}
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-sm text-zinc-200 backdrop-blur-sm focus:border-purple-500/30 focus:outline-none transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {CARRIER_TYPES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="mb-2 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Carrier Freq
              </label>
              <input
                type="number"
                value={carrierFreq}
                onChange={(e) => setCarrierFreq(Number(e.target.value))}
                min={20}
                max={2000}
                step={0.01}
                className="w-full rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 text-sm text-zinc-200 backdrop-blur-sm focus:border-purple-500/30 focus:outline-none transition-colors"
                style={{ fontFamily: 'var(--font-body)' }}
              />
            </div>
          </div>

          <RangeControl label="Bands" value={numBands} min={8} max={64} unit="" onChange={setNumBands} help={DSP_HELP.vocoderBands} />
          <RangeControl label="Envelope Attack" value={envelopeAttack} min={0.1} max={50} unit="ms" onChange={setEnvelopeAttack} step={0.1} help={DSP_HELP.vocoderAttack} />
          <RangeControl label="Envelope Release" value={envelopeRelease} min={1} max={200} unit="ms" onChange={setEnvelopeRelease} help={DSP_HELP.vocoderRelease} />
          <RangeControl label="Sibilance" value={sibilanceAmount} min={0} max={1} unit="" onChange={setSibilanceAmount} step={0.01} />
        </div>
      )}

      {/* Phase Vocoder Controls */}
      {vocoderType === 'phase' && (
        <div>
          <label
            className="mb-2.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Mode
          </label>
          <div className="flex gap-2">
            {(['robotize', 'whisper', 'freeze', 'cross_synthesis'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPhaseMode(m)}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all duration-200 ${
                  phaseMode === m
                    ? 'bg-purple-500/20 border border-purple-400/40 text-purple-300'
                    : 'glass-card glass-card-hover text-zinc-400'
                }`}
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {m.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* LPC Controls */}
      {vocoderType === 'lpc' && (
        <RangeControl label="LPC Order" value={lpcOrder} min={8} max={48} unit="" onChange={setLpcOrder} />
      )}

      {/* Process */}
      {error && (
        <p className="text-sm text-red-400" style={{ fontFamily: 'var(--font-body)' }}>{error}</p>
      )}
      <button
        onClick={process}
        disabled={processing}
        className="w-full rounded-xl bg-purple-500/15 border border-purple-500/30 py-3 text-sm font-semibold text-purple-300 transition-all duration-200 hover:bg-purple-500/25 hover:glow-violet disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {processing ? 'Processing...' : 'Apply Vocoder'}
      </button>
    </div>
  )
}

function RangeControl({
  label, value, min, max, unit, onChange, step = 1, help,
}: {
  label: string; value: number; min: number; max: number; unit: string
  onChange: (v: number) => void; step?: number
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
          className="text-xs tabular-nums text-purple-400/70"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          {value}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-purple-500"
      />
    </div>
  )
}
