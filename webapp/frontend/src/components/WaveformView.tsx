import { memo, useEffect, useRef, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'

const BODY_FONT_STYLE = { fontFamily: 'var(--font-body)' } as const

interface WaveformViewProps {
  sessionId: string
  source: 'original' | 'processed'
}

export const WaveformView = memo(function WaveformView({ sessionId, source }: WaveformViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurfer | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

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

    ws.load(`/api/session/${sessionId}/download?source=${source}`)
    wavesurferRef.current = ws

    return () => {
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
        className="absolute bottom-3 right-3 glass-card glass-card-hover rounded-lg px-4 py-1.5 text-xs text-zinc-400 opacity-0 transition-all duration-200 group-hover:opacity-100"
        style={BODY_FONT_STYLE}
      >
        Play / Pause
      </button>
    </div>
  )
})
