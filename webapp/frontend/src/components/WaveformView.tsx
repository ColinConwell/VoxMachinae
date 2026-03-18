import { memo, useEffect, useRef, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { apiUrl } from '../lib/api'

const BODY_FONT_STYLE = { fontFamily: 'var(--font-body)' } as const

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException
      ? error.name === 'AbortError'
      : typeof error === 'object' &&
          error !== null &&
          'name' in error &&
          error.name === 'AbortError'
  )
}

interface WaveformViewProps {
  sessionId: string
  source: 'original' | 'processed'
}

export const WaveformView = memo(function WaveformView({ sessionId, source }: WaveformViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const abortController = new AbortController()
    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: source === 'original' ? '#a1a1aa' : '#f59e0b',
      progressColor: source === 'original' ? '#71717a' : '#d97706',
      cursorColor: '#fbbf24',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 96,
      normalize: true,
      backend: 'WebAudio',
    })

    wavesurferRef.current = ws
    const unsubscribeError = ws.on('error', (error) => {
      if (abortController.signal.aborted || isAbortError(error)) {
        return
      }
      console.error(error)
    })

    void (async () => {
      try {
        const response = await fetch(apiUrl(`/api/session/${sessionId}/download?source=${source}`), {
          signal: abortController.signal,
        })
        if (!response.ok) {
          throw new Error(`Failed to load waveform audio: ${response.status}`)
        }

        const blob = await response.blob()
        if (abortController.signal.aborted) {
          return
        }

        await ws.loadBlob(blob)
      } catch (error) {
        if (abortController.signal.aborted || isAbortError(error)) {
          return
        }
        console.error(error)
      }
    })()

    return () => {
      abortController.abort()
      unsubscribeError()
      wavesurferRef.current = null
      ws.destroy()
    }
  }, [sessionId, source])

  const toggle = useCallback(() => {
    wavesurferRef.current?.playPause()
  }, [])

  return (
    <div className="group relative glass-card rounded-2xl p-5 transition-all duration-200 animate-fade-in">
      <div ref={containerRef} className="cursor-pointer" onClick={toggle} />
      <button
        onClick={toggle}
        aria-label={`Play or pause ${source} waveform`}
        className="absolute bottom-3 right-3 glass-card glass-card-hover rounded-lg px-4 py-1.5 text-xs text-zinc-400 opacity-100 transition-all duration-200 group-hover:text-zinc-200 group-focus-within:text-zinc-200"
        style={BODY_FONT_STYLE}
      >
        Play / Pause
      </button>
    </div>
  )
})
