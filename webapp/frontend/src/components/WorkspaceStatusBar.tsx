interface WorkspaceStatusBarProps {
  name: string
  duration: number
  sampleRate: number
  channels?: number
  hasProcessedAudio: boolean
  onReset: () => void
  resetting: boolean
}

const DISPLAY_FONT = { fontFamily: 'var(--font-display)' } as const
const BODY_FONT = { fontFamily: 'var(--font-body)' } as const

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = Math.round(seconds % 60)
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

export function WorkspaceStatusBar({
  name,
  duration,
  sampleRate,
  channels,
  hasProcessedAudio,
  onReset,
  resetting,
}: WorkspaceStatusBarProps) {
  return (
    <section className="glass-card rounded-2xl border border-white/6 px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500"
              style={DISPLAY_FONT}
            >
              Workspace
            </span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.18em] ${
                hasProcessedAudio
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
                  : 'border-zinc-700/70 bg-zinc-800/80 text-zinc-400'
              }`}
            >
              {hasProcessedAudio ? 'Processed' : 'Original'}
            </span>
          </div>
          <p
            className="mt-1 truncate text-sm font-medium text-zinc-100 sm:text-base"
            style={BODY_FONT}
            title={name}
          >
            {name}
          </p>
          <p className="mt-1 text-xs text-zinc-500" style={BODY_FONT}>
            {formatDuration(duration)} · {sampleRate.toLocaleString()} Hz
            {channels ? ` · ${channels} ch` : ''}
          </p>
        </div>

        <button
          onClick={onReset}
          disabled={!hasProcessedAudio || resetting}
          className={`rounded-xl px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition-all ${
            hasProcessedAudio && !resetting
              ? 'border border-amber-500/25 bg-amber-500/12 text-amber-200 hover:bg-amber-500/18'
              : 'cursor-not-allowed border border-zinc-800 bg-zinc-900/80 text-zinc-600'
          }`}
          style={DISPLAY_FONT}
        >
          {resetting ? 'Resetting' : 'Reset To Original'}
        </button>
      </div>
    </section>
  )
}
