/**
 * SampleBrowser — browse and load samples from the server-side sample library.
 *
 * Fetches the catalog from /api/samples, displays them grouped by category,
 * and loads a selected sample into a new session via /api/samples/load.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { apiUrl } from '../lib/api'

interface SampleEntry {
  name: string
  filename: string
  description: string
  category: string
  duration: number
  sample_rate: number
  tags: string[]
}

interface Props {
  onSampleLoaded: (info: {
    session_id: string
    duration: number
    sample_rate: number
    name: string
    channels?: number
  }) => void
}

const categoryColors: Record<string, string> = {
  synthetic: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
  vocal: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  speech: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  singing: 'bg-purple-500/10 text-purple-400 border border-purple-500/20',
  downloaded: 'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  user: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  unknown: 'glass-card text-zinc-400',
  uncategorized: 'glass-card text-zinc-400',
}

export function SampleBrowser({ onSampleLoaded }: Props) {
  const [samples, setSamples] = useState<SampleEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingSample, setLoadingSample] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  // Fetch sample catalog
  const fetchSamples = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(apiUrl('/api/samples'))
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      setSamples(data.samples ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch samples')
    } finally {
      setLoading(false)
    }
  }, [])

  // Generate test samples if none exist
  const generateTestSamples = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch(apiUrl('/api/samples/generate-test'), {
        method: 'POST',
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      // Re-fetch catalog
      await fetchSamples()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate test samples')
      setLoading(false)
    }
  }, [fetchSamples])

  // Load a sample into a session
  const loadSample = useCallback(
    async (name: string) => {
      setLoadingSample(name)
      setError(null)
      try {
        const resp = await fetch(apiUrl(`/api/samples/load?name=${encodeURIComponent(name)}`), {
          method: 'POST',
        })
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const data = await resp.json()
        onSampleLoaded({
          session_id: data.session_id,
          duration: data.duration,
          sample_rate: data.sample_rate,
          name: data.name,
          channels: data.channels,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load sample')
      } finally {
        setLoadingSample(null)
      }
    },
    [onSampleLoaded],
  )

  useEffect(() => {
    if (expanded && samples.length === 0) {
      fetchSamples()
    }
  }, [expanded, samples.length, fetchSamples])

  // Group samples by category
  const grouped = useMemo(
    () =>
      samples.reduce<Record<string, SampleEntry[]>>((acc, s) => {
        const cat = s.category || 'uncategorized'
        ;(acc[cat] ??= []).push(s)
        return acc
      }, {}),
    [samples],
  )

  return (
    <div className="glass-card rounded-2xl overflow-hidden animate-fade-up">
      {/* Toggle Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        aria-controls="sample-library-content"
        className="flex w-full items-center justify-between px-6 py-4 text-left transition-all duration-200 hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          <span className="text-base opacity-70">&#9835;</span>
          <span
            className="text-sm font-semibold text-zinc-300 tracking-wide"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Sample Library
          </span>
          {samples.length > 0 && (
            <span className="glass-card rounded-full px-2.5 py-0.5 text-[10px] text-zinc-500">
              {samples.length}
            </span>
          )}
        </div>
        <svg
          className={`h-4 w-4 text-zinc-600 transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div id="sample-library-content" className="border-t border-white/[0.06] px-6 py-5 space-y-5 animate-fade-up">
          {error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-300">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-400" />
              <span style={{ fontFamily: 'var(--font-body)' }}>Loading samples...</span>
            </div>
          ) : samples.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500" style={{ fontFamily: 'var(--font-body)' }}>
                No samples found. Generate some test samples to get started.
              </p>
              <button
                onClick={generateTestSamples}
                className="glass-card glass-card-hover rounded-xl px-5 py-2.5 text-sm font-medium text-cyan-300 transition-all duration-200"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                Generate Test Samples
              </button>
            </div>
          ) : (
            Object.entries(grouped).map(([category, items]) => (
              <div key={category}>
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-medium ${categoryColors[category] ?? categoryColors.uncategorized}`}
                  >
                    {category}
                  </span>
                  <div className="h-px flex-1 bg-white/[0.04]" />
                  <span className="text-[11px] text-zinc-600">
                    {items.length} sample{items.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => loadSample(s.name)}
                      disabled={loadingSample !== null}
                      className="group glass-card glass-card-hover flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-200 disabled:opacity-50"
                    >
                      {loadingSample === s.name ? (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-700 border-t-amber-400" />
                      ) : (
                        <svg
                          className="h-4 w-4 text-zinc-600 group-hover:text-amber-400 transition-colors duration-200"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                      <div className="min-w-0 flex-1">
                        <div
                          className="truncate text-sm font-medium text-zinc-300"
                          style={{ fontFamily: 'var(--font-body)' }}
                        >
                          {s.name.replace(/_/g, ' ')}
                        </div>
                        {s.description && (
                          <div className="truncate text-[11px] text-zinc-600">
                            {s.description}
                          </div>
                        )}
                      </div>
                      {s.tags.length > 0 && (
                        <div className="hidden gap-1.5 sm:flex">
                          {s.tags.slice(0, 2).map((t) => (
                            <span
                              key={t}
                              className="rounded-full bg-white/[0.04] border border-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-500"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
