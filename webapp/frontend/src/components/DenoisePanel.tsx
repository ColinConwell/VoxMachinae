import { useState, useCallback } from 'react'
import { HelpTooltip, DSP_HELP } from './HelpTooltip'
import { apiUrl } from '../lib/api'
import { ACCENT_STYLES, type AccentColor } from '../lib/accent'
import { createDeterministicBars } from '../lib/animation'

interface DenoisePanelProps {
  sessionId: string
  onProcessed: () => void
}

type DenoiseMode = 'noise_reduce' | 'enhance_speech' | 'full'

const MODE_INFO: Record<DenoiseMode, { label: string; description: string }> = {
  noise_reduce: {
    label: 'Spectral Gate',
    description: 'Classic noise reduction via spectral gating',
  },
  enhance_speech: {
    label: 'DeepFilter',
    description: 'Neural speech enhancement (best quality)',
  },
  full: {
    label: 'Full Pipeline',
    description: 'DeepFilter + normalize + silence trim',
  },
}

const NOISE_BAR_VARIATION = createDeterministicBars(16, 1337)

export function DenoisePanel({ sessionId, onProcessed }: DenoisePanelProps) {
  const [mode, setMode] = useState<DenoiseMode>('noise_reduce')
  const [stationary, setStationary] = useState(true)
  const [propDecrease, setPropDecrease] = useState(0.8)
  const [normalize, setNormalize] = useState(true)
  const [targetLufs, setTargetLufs] = useState(-16)
  const [removeSilence, setRemoveSilence] = useState(false)
  const [silenceTopDb, setSilenceTopDb] = useState(30)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  const process = useCallback(async () => {
    setProcessing(true)
    setError(null)
    setProgress(mode === 'enhance_speech' || mode === 'full' ? 'Loading DeepFilterNet model...' : 'Processing...')
    try {
      const res = await fetch(apiUrl('/api/process/denoise'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          mode,
          stationary,
          prop_decrease: propDecrease,
          normalize,
          target_lufs: targetLufs,
          remove_silence_flag: removeSilence,
          silence_top_db: silenceTopDb,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail || `Processing failed (${res.status})`)
      }
      setProgress(null)
      onProcessed()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setProgress(null)
    } finally {
      setProcessing(false)
    }
  }, [sessionId, mode, stationary, propDecrease, normalize, targetLufs, removeSilence, silenceTopDb, onProcessed])

  return (
    <div className="glass-card rounded-2xl border border-lime-500/20 p-4 sm:p-6 space-y-5 sm:space-y-6 animate-fade-up">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="h-5 w-1 rounded-full bg-lime-500" />
        <h2
          className="text-lg font-semibold text-lime-400 tracking-wide"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Denoise &amp; Enhance
        </h2>
        <span className="ml-auto rounded-full bg-lime-500/10 border border-lime-500/20 px-3 py-0.5 text-[10px] font-medium text-lime-400/70">
          Cleanup
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-zinc-500 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
        Remove background noise and enhance speech clarity. Spectral gating for general noise,
        or neural DeepFilterNet for broadcast-quality voice.
      </p>

      {/* Mode Selection */}
      <div>
        <label
          className="mb-2.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Mode
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(Object.entries(MODE_INFO) as [DenoiseMode, typeof MODE_INFO[DenoiseMode]][]).map(
            ([key, info]) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`rounded-xl px-3 py-3 text-left transition-all duration-200 ${
                  mode === key
                    ? 'bg-lime-500/15 border border-lime-400/30 shadow-lg shadow-lime-500/5'
                    : 'glass-card glass-card-hover'
                }`}
              >
                <div
                  className={`text-sm font-semibold ${mode === key ? 'text-lime-300' : 'text-zinc-400'}`}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {info.label}
                </div>
                <div className="text-[11px] text-zinc-600 mt-0.5" style={{ fontFamily: 'var(--font-body)' }}>
                  {info.description}
                </div>
              </button>
            ),
          )}
        </div>
      </div>

      {/* Noise Visualization */}
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">
        <div className="flex items-center gap-3">
          {/* Before */}
          <div className="flex-1">
            <div className="flex items-end justify-center gap-px h-12">
              {Array.from({ length: 16 }, (_, i) => {
                const signalHeight = 30 + Math.sin(i * 0.8) * 25
                const noiseHeight = 8 + NOISE_BAR_VARIATION[i] * 15
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0">
                    <div
                      className="w-full rounded-sm bg-red-500/40 transition-all duration-300"
                      style={{ height: `${noiseHeight}%` }}
                    />
                    <div
                      className="w-full rounded-sm bg-zinc-400/50 transition-all duration-300"
                      style={{ height: `${signalHeight}%` }}
                    />
                  </div>
                )
              })}
            </div>
            <p className="mt-2 text-center text-[10px] text-zinc-600" style={{ fontFamily: 'var(--font-body)' }}>
              Noisy
            </p>
          </div>

          {/* Arrow */}
          <div className="text-lime-500/50 text-lg px-2">→</div>

          {/* After */}
          <div className="flex-1">
            <div className="flex items-end justify-center gap-px h-12">
              {Array.from({ length: 16 }, (_, i) => {
                const signalHeight = 30 + Math.sin(i * 0.8) * 25
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-sm bg-lime-500/50 transition-all duration-300"
                    style={{ height: `${signalHeight}%` }}
                  />
                )
              })}
            </div>
            <p className="mt-2 text-center text-[10px] text-zinc-600" style={{ fontFamily: 'var(--font-body)' }}>
              Clean
            </p>
          </div>
        </div>
      </div>

      {/* Spectral Gate Controls (only for noise_reduce mode) */}
      {mode === 'noise_reduce' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label
              className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Stationary Noise
            </label>
            <button
              onClick={() => setStationary(!stationary)}
              className={`relative h-5 w-9 rounded-full transition-all duration-200 ${
                stationary ? 'bg-lime-500/40' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200 ${
                  stationary ? 'left-4 bg-lime-400' : 'left-0.5 bg-zinc-500'
                }`}
              />
            </button>
          </div>
          <SliderControl
            label="Noise Reduction"
            value={propDecrease}
            min={0}
            max={1}
            step={0.01}
            unit=""
            displayValue={`${Math.round(propDecrease * 100)}%`}
            onChange={setPropDecrease}
            color="lime"
            help={DSP_HELP.denoiseReduction}
          />
        </div>
      )}

      {/* Normalization Controls */}
      {(mode === 'full' || mode === 'noise_reduce') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label
              className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Loudness Normalize
            </label>
            <button
              onClick={() => setNormalize(!normalize)}
              className={`relative h-5 w-9 rounded-full transition-all duration-200 ${
                normalize ? 'bg-lime-500/40' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200 ${
                  normalize ? 'left-4 bg-lime-400' : 'left-0.5 bg-zinc-500'
                }`}
              />
            </button>
          </div>
          {normalize && (
            <SliderControl
              label="Target LUFS"
              value={targetLufs}
              min={-24}
              max={-6}
              step={1}
              unit=""
              displayValue={`${targetLufs} LUFS`}
              onChange={setTargetLufs}
              color="lime"
            />
          )}
          <div className="flex items-center justify-between">
            <label
              className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Remove Silence
            </label>
            <button
              onClick={() => setRemoveSilence(!removeSilence)}
              className={`relative h-5 w-9 rounded-full transition-all duration-200 ${
                removeSilence ? 'bg-lime-500/40' : 'bg-zinc-700'
              }`}
            >
              <div
                className={`absolute top-0.5 h-4 w-4 rounded-full transition-all duration-200 ${
                  removeSilence ? 'left-4 bg-lime-400' : 'left-0.5 bg-zinc-500'
                }`}
              />
            </button>
          </div>
          {removeSilence && (
            <SliderControl
              label="Silence Threshold"
              value={silenceTopDb}
              min={10}
              max={60}
              step={1}
              unit=""
              displayValue={`${silenceTopDb} dB`}
              onChange={setSilenceTopDb}
              color="lime"
            />
          )}
        </div>
      )}

      {/* Progress / Error */}
      {progress && (
        <div className="flex items-center gap-3 rounded-xl bg-lime-500/5 border border-lime-500/10 px-4 py-2.5">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-lime-800 border-t-lime-400" />
          <span className="text-sm text-lime-300/80" style={{ fontFamily: 'var(--font-body)' }}>
            {progress}
          </span>
        </div>
      )}
      {error && (
        <p className="text-sm text-red-400" style={{ fontFamily: 'var(--font-body)' }}>
          {error}
        </p>
      )}

      {/* Process Button */}
      <button
        onClick={process}
        disabled={processing}
        className="w-full rounded-xl bg-lime-500/15 border border-lime-500/30 py-3 text-sm font-semibold text-lime-300 transition-all duration-200 hover:bg-lime-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {processing ? 'Processing...' : mode === 'full' ? 'Run Full Pipeline' : mode === 'enhance_speech' ? 'Enhance Speech' : 'Reduce Noise'}
      </button>
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
