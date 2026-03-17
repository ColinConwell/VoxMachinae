import { useState, useCallback } from 'react'
import { apiUrl } from '../lib/api'
import { createDeterministicBars } from '../lib/animation'

interface GenerativeProps {
  sessionId?: string
  onTrackLoaded?: (info: { session_id: string; duration: number; sample_rate: number; name: string }) => void
}

type Engine = 'suno' | 'elevenlabs' | 'stable_audio'
type GenStatus = 'idle' | 'submitting' | 'polling' | 'downloading' | 'done' | 'error'

interface TrackInfo {
  track_id: string
  title: string
  duration: number
  model: string
}

const ENGINE_INFO: Record<Engine, { label: string; badge: string; models: string[]; desc: string }> = {
  suno: {
    label: 'Suno',
    badge: 'Kie AI',
    models: ['v4', 'v4.5', 'v4.5+', 'v5'],
    desc: 'Full song generation with vocals, lyrics, and custom styles',
  },
  elevenlabs: {
    label: 'ElevenLabs',
    badge: 'Music',
    models: ['default'],
    desc: 'High-quality music composition and sound effects',
  },
  stable_audio: {
    label: 'Stable Audio',
    badge: 'Stability',
    models: ['stable-audio-open-1.0'],
    desc: 'Text-to-music generation up to 47s, 44.1kHz stereo',
  },
}

const STYLE_PRESETS = [
  { label: 'Acapella', tags: 'acapella, vocal, clean, no instruments' },
  { label: 'Lo-Fi', tags: 'lo-fi, chill, ambient, mellow' },
  { label: 'Synthwave', tags: 'synthwave, retro, electronic, 80s' },
  { label: 'R&B', tags: 'r&b, soul, smooth, vocal' },
  { label: 'Pop', tags: 'pop, catchy, upbeat, modern' },
  { label: 'Jazz', tags: 'jazz, smooth, saxophone, swing' },
]

const GENERATIVE_BARS = createDeterministicBars(48, 9001)

export function GenerativePanel({ onTrackLoaded }: GenerativeProps) {
  const [engine, setEngine] = useState<Engine>('suno')
  const [prompt, setPrompt] = useState('')
  const [title, setTitle] = useState('')
  const [style, setStyle] = useState('')
  const [model, setModel] = useState('v4')
  const [instrumental, setInstrumental] = useState(false)
  const [status, setStatus] = useState<GenStatus>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [tracks, setTracks] = useState<TrackInfo[]>([])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) return
    setStatus('submitting')
    setStatusMessage('Submitting generation request…')
    setError('')
    setTracks([])
    setProgress(10)

    try {
      const resp = await fetch(apiUrl('/api/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engine,
          prompt: prompt.trim(),
          title: title.trim() || undefined,
          style: style.trim() || undefined,
          model,
          instrumental,
        }),
      })

      if (!resp.ok) {
        const data = await resp.json().catch(() => ({}))
        throw new Error(data.detail || `Generation failed (${resp.status})`)
      }

      const data = await resp.json()
      const taskId = data.task_id

      if (!taskId) throw new Error('No task ID returned')

      // Poll for completion
      setStatus('polling')
      setStatusMessage('Generating audio — this may take 30–90 seconds…')
      setProgress(25)

      let attempts = 0
      const maxAttempts = 60 // 5 minutes at 5s intervals

      const poll = async (): Promise<void> => {
        attempts++
        if (attempts > maxAttempts) {
          throw new Error('Generation timed out after 5 minutes')
        }

        const pollResp = await fetch(apiUrl(`/api/generate/status/${taskId}`))
        if (!pollResp.ok) throw new Error('Failed to check status')

        const pollData = await pollResp.json()
        setProgress(Math.min(25 + (attempts / maxAttempts) * 65, 90))

        if (pollData.status === 'success') {
          setTracks(pollData.tracks || [])
          setStatus('done')
          setStatusMessage(`Generated ${pollData.tracks?.length || 0} track(s)`)
          setProgress(100)
          return
        }

        if (pollData.status === 'failed') {
          throw new Error(pollData.error_message || 'Generation failed')
        }

        setStatusMessage(
          `Generating… (${pollData.status}) — attempt ${attempts}/${maxAttempts}`
        )
        await new Promise((r) => setTimeout(r, 5000))
        return poll()
      }

      await poll()
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Unknown error')
      setProgress(0)
    }
  }, [engine, prompt, title, style, model, instrumental])

  const handleLoadTrack = useCallback(
    async (trackId: string) => {
      setStatus('downloading')
      setStatusMessage('Loading track into workspace…')

      try {
        const resp = await fetch(apiUrl(`/api/generate/load/${trackId}`), {
          method: 'POST',
        })
        if (!resp.ok) throw new Error('Failed to load track')

        const data = await resp.json()
        onTrackLoaded?.({
          session_id: data.session_id,
          duration: data.duration,
          sample_rate: data.sample_rate,
          name: data.name || 'Generated Track',
        })
        setStatus('done')
        setStatusMessage('Track loaded into workspace')
      } catch (e) {
        setStatus('error')
        setError(e instanceof Error ? e.message : 'Failed to load')
      }
    },
    [onTrackLoaded]
  )

  const info = ENGINE_INFO[engine]
  const isProcessing = status === 'submitting' || status === 'polling' || status === 'downloading'

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-fuchsia-500/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3
              className="text-lg font-bold text-fuchsia-300"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Generate Music
            </h3>
            <span className="rounded-full bg-fuchsia-500/10 border border-fuchsia-500/20 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-fuchsia-400">
              {info.badge}
            </span>
          </div>
          {/* Engine selector */}
          <div className="flex gap-1.5">
            {(Object.keys(ENGINE_INFO) as Engine[]).map((e) => (
              <button
                key={e}
                onClick={() => { setEngine(e); setModel(ENGINE_INFO[e].models[0]) }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                  engine === e
                    ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                }`}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {ENGINE_INFO[e].label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">{info.desc}</p>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        {/* Prompt */}
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the music you want to create…"
            rows={3}
            className="w-full rounded-xl bg-black/30 border border-white/5 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-fuchsia-500/30 focus:outline-none focus:ring-1 focus:ring-fuchsia-500/20 transition-colors resize-none"
            style={{ fontFamily: 'var(--font-body)' }}
            disabled={isProcessing}
          />
        </div>

        {/* Style presets */}
        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
            Style Presets
          </label>
          <div className="flex flex-wrap gap-2">
            {STYLE_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => setStyle(preset.tags)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  style === preset.tags
                    ? 'bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/25'
                    : 'bg-white/3 text-zinc-500 hover:text-zinc-300 border border-white/5 hover:border-white/10'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Title + Model row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional track title"
              className="w-full rounded-xl bg-black/30 border border-white/5 px-4 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 focus:border-fuchsia-500/30 focus:outline-none transition-colors"
              disabled={isProcessing}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-xl bg-black/30 border border-white/5 px-4 py-2.5 text-sm text-zinc-200 focus:border-fuchsia-500/30 focus:outline-none transition-colors appearance-none"
              disabled={isProcessing}
            >
              {info.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 cursor-pointer group">
            <div
              className={`w-4 h-4 rounded border transition-all flex items-center justify-center ${
                instrumental
                  ? 'bg-fuchsia-500/30 border-fuchsia-500/50'
                  : 'border-zinc-600 group-hover:border-zinc-400'
              }`}
              onClick={() => setInstrumental(!instrumental)}
            >
              {instrumental && (
                <svg className="w-3 h-3 text-fuchsia-300" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>
            <span className="text-xs text-zinc-400">Instrumental only</span>
          </label>

          {style && (
            <button
              onClick={() => setStyle('')}
              className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
            >
              Clear style
            </button>
          )}
        </div>

        {/* Style tag display */}
        {style && (
          <div className="rounded-lg bg-fuchsia-500/5 border border-fuchsia-500/10 px-4 py-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-fuchsia-400/60">
              Style:
            </span>
            <span className="ml-2 text-xs text-fuchsia-300/80">{style}</span>
          </div>
        )}

        {/* Progress / Status */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="h-1.5 w-full rounded-full bg-black/40 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-600 to-fuchsia-400 transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-fuchsia-400 animate-pulse" />
              <p className="text-xs text-fuchsia-300/70">{statusMessage}</p>
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {/* Generated tracks */}
        {tracks.length > 0 && (
          <div className="space-y-2">
            <label className="block text-xs font-medium uppercase tracking-wider text-zinc-500">
              Generated Tracks
            </label>
            {tracks.map((track) => (
              <div
                key={track.track_id}
                className="flex items-center justify-between rounded-xl bg-fuchsia-500/5 border border-fuchsia-500/10 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-fuchsia-200">
                    {track.title || 'Untitled'}
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {track.duration > 0 ? `${track.duration.toFixed(1)}s` : '—'} ·{' '}
                    {track.model || engine}
                  </p>
                </div>
                <button
                  onClick={() => handleLoadTrack(track.track_id)}
                  className="rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/30 px-4 py-2 text-xs font-semibold text-fuchsia-300 hover:bg-fuchsia-500/30 transition-all"
                  disabled={isProcessing}
                >
                  Load into Workspace
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Visualization: audio wave pattern */}
        <div className="flex items-end justify-center gap-[2px] h-12 opacity-60">
          {Array.from({ length: 48 }, (_, i) => {
            const h = isProcessing
              ? 8 + Math.sin(Date.now() / 300 + i * 0.5) * 16 + GENERATIVE_BARS[i] * 6
              : 4 + Math.sin(i * 0.3) * 12 + Math.cos(i * 0.7) * 6
            return (
              <div
                key={i}
                className={`w-[3px] rounded-full transition-all duration-300 ${
                  isProcessing
                    ? 'bg-fuchsia-400/50 animate-pulse'
                    : status === 'done'
                      ? 'bg-fuchsia-400/30'
                      : 'bg-zinc-700/40'
                }`}
                style={{ height: `${Math.max(3, h)}px` }}
              />
            )
          })}
        </div>

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={!prompt.trim() || isProcessing}
          className={`w-full rounded-xl py-3.5 text-sm font-bold uppercase tracking-wider transition-all ${
            isProcessing
              ? 'bg-fuchsia-500/10 text-fuchsia-400/50 border border-fuchsia-500/10 cursor-wait'
              : !prompt.trim()
                ? 'bg-white/3 text-zinc-600 border border-white/5 cursor-not-allowed'
                : 'bg-fuchsia-500/20 text-fuchsia-200 border border-fuchsia-500/30 hover:bg-fuchsia-500/30 hover:shadow-lg hover:shadow-fuchsia-500/10'
          }`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {isProcessing ? 'Generating…' : 'Generate'}
        </button>
      </div>
    </div>
  )
}
