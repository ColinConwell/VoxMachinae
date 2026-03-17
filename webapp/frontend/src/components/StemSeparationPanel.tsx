import { useState, useCallback } from 'react'
import { apiUrl } from '../lib/api'
import { createDeterministicBars } from '../lib/animation'

interface StemSeparationPanelProps {
  sessionId: string
  onProcessed: () => void
}

type ModelType = 'htdemucs' | 'htdemucs_ft'
type StemType = 'vocals' | 'drums' | 'bass' | 'other'

const MODEL_INFO: Record<ModelType, { label: string; description: string }> = {
  htdemucs: {
    label: 'Hybrid Transformer',
    description: 'Fast, good quality',
  },
  htdemucs_ft: {
    label: 'Fine-tuned HT',
    description: 'Best quality, slower',
  },
}

const STEM_BAR_VARIATION = createDeterministicBars(32, 4242)

export function StemSeparationPanel({ sessionId, onProcessed }: StemSeparationPanelProps) {
  const [model, setModel] = useState<ModelType>('htdemucs')
  const [stem, setStem] = useState<StemType>('vocals')
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  const process = useCallback(async () => {
    setProcessing(true)
    setError(null)
    setProgress('Loading Demucs model...')
    try {
      const res = await fetch(apiUrl('/api/process/separate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          engine: 'demucs_legacy',
          model,
          stem,
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
  }, [sessionId, model, onProcessed, stem])

  return (
    <div className="glass-card rounded-2xl border border-cyan-500/20 p-4 sm:p-6 space-y-5 sm:space-y-6 animate-fade-up">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="h-5 w-1 rounded-full bg-cyan-500" />
        <h2
          className="text-lg font-semibold text-cyan-400 tracking-wide"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Stem Separation
        </h2>
        <span className="ml-auto rounded-full bg-cyan-500/10 border border-cyan-500/20 px-3 py-0.5 text-[10px] font-medium text-cyan-400/70">
          Demucs Legacy
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-zinc-500 leading-relaxed" style={{ fontFamily: 'var(--font-body)' }}>
        Isolate a specific stem using the current legacy Demucs backend while keeping the
        API ready for newer separator engines. The extracted stem replaces the processed output.
      </p>

      {/* Model Selection */}
      <div>
        <label
          className="mb-2.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Model
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(MODEL_INFO) as [ModelType, typeof MODEL_INFO[ModelType]][]).map(
            ([key, info]) => (
              <button
                key={key}
                onClick={() => setModel(key)}
                className={`rounded-xl px-4 py-3 text-left transition-all duration-200 ${
                  model === key
                    ? 'bg-cyan-500/15 border border-cyan-400/30 shadow-lg shadow-cyan-500/5'
                    : 'glass-card glass-card-hover'
                }`}
              >
                <div
                  className={`text-sm font-semibold ${model === key ? 'text-cyan-300' : 'text-zinc-400'}`}
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

      <div>
        <label
          className="mb-2.5 block text-[11px] font-semibold uppercase tracking-widest text-zinc-500"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Target Stem
        </label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(['vocals', 'drums', 'bass', 'other'] as const).map((stemName) => (
            <button
              key={stemName}
              onClick={() => setStem(stemName)}
              className={`rounded-xl px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.18em] transition-all ${
                stem === stemName
                  ? 'border border-cyan-400/30 bg-cyan-500/15 text-cyan-200'
                  : 'glass-card glass-card-hover text-zinc-500'
              }`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {stemName}
            </button>
          ))}
        </div>
      </div>

      {/* Stem visualization */}
      <div className="rounded-xl bg-white/[0.02] border border-white/[0.04] p-4">
        <div className="grid grid-cols-4 gap-3">
          {(['vocals', 'drums', 'bass', 'other'] as const).map((stemName, stemIndex) => {
            const colors: Record<string, string> = {
              vocals: 'bg-amber-500/60',
              drums: 'bg-rose-500/60',
              bass: 'bg-indigo-500/60',
              other: 'bg-zinc-500/60',
            }
            return (
              <div key={stemName} className="flex flex-col items-center gap-2">
                <div
                  className={`h-12 w-full rounded-lg ${colors[stemName]} ${
                    stem === stemName ? 'ring-2 ring-cyan-400/30 ring-offset-1 ring-offset-transparent' : 'opacity-30'
                  } transition-all duration-300`}
                >
                  <div className="flex h-full items-end justify-center gap-px p-1.5">
                    {Array.from({ length: 8 }, (_, i) => (
                      <div
                        key={i}
                        className={`w-1 rounded-full ${stem === stemName ? 'bg-white/70' : 'bg-white/30'}`}
                        style={{
                          height: `${20 + STEM_BAR_VARIATION[stemIndex * 8 + i] * 80}%`,
                          transition: 'height 0.3s',
                        }}
                      />
                    ))}
                  </div>
                </div>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    stem === stemName ? 'text-cyan-400' : 'text-zinc-600'
                  }`}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {stemName}
                </span>
              </div>
            )
          })}
        </div>
        <p
          className="mt-3 text-center text-[10px] text-zinc-600"
          style={{ fontFamily: 'var(--font-body)' }}
        >
          Extracts the selected stem from the mix
        </p>
      </div>

      {/* Progress / Error */}
      {progress && (
        <div className="flex items-center gap-3 rounded-xl bg-cyan-500/5 border border-cyan-500/10 px-4 py-2.5">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-800 border-t-cyan-400" />
          <span className="text-sm text-cyan-300/80" style={{ fontFamily: 'var(--font-body)' }}>
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
        className="w-full rounded-xl bg-cyan-500/15 border border-cyan-500/30 py-3 text-sm font-semibold text-cyan-300 transition-all duration-200 hover:bg-cyan-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {processing ? 'Separating Stems...' : `Extract ${stem.charAt(0).toUpperCase()}${stem.slice(1)}`}
      </button>
    </div>
  )
}
