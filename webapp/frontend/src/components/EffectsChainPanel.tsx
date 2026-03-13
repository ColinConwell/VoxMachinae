import { useState, useCallback, useEffect, useMemo, memo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { HelpTooltip, DSP_HELP } from './HelpTooltip'

interface EffectNode {
  id: string
  effect_type: string
  params: Record<string, unknown>
  enabled: boolean
  label: string
}

interface EffectsChainPanelProps {
  sessionId: string
  onProcessed: () => void
}

const EFFECT_COLORS: Record<string, { bg: string; border: string; text: string; dot: string; glow: string }> = {
  autotune: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/25',
    text: 'text-amber-300',
    dot: 'bg-amber-400',
    glow: 'shadow-[0_0_12px_rgba(251,191,36,0.12)]',
  },
  vocoder: {
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/25',
    text: 'text-violet-300',
    dot: 'bg-violet-400',
    glow: 'shadow-[0_0_12px_rgba(139,92,246,0.12)]',
  },
  reverb: {
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/25',
    text: 'text-rose-300',
    dot: 'bg-rose-400',
    glow: 'shadow-[0_0_12px_rgba(251,113,133,0.12)]',
  },
  delay: {
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/25',
    text: 'text-sky-300',
    dot: 'bg-sky-400',
    glow: 'shadow-[0_0_12px_rgba(56,189,248,0.12)]',
  },
  formant: {
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/25',
    text: 'text-teal-300',
    dot: 'bg-teal-400',
    glow: 'shadow-[0_0_12px_rgba(45,212,191,0.12)]',
  },
  denoise: {
    bg: 'bg-lime-500/10',
    border: 'border-lime-500/25',
    text: 'text-lime-300',
    dot: 'bg-lime-400',
    glow: 'shadow-[0_0_12px_rgba(163,230,53,0.12)]',
  },
}

const DEFAULT_PARAMS: Record<string, Record<string, unknown>> = {
  autotune: { key: 'C', scale_type: 'chromatic', retune_speed: 0, humanize: 0, formant_correction: true },
  vocoder: { vocoder_type: 'channel', n_bands: 16, carrier_type: 'saw', carrier_freq: 100, mix: 1.0 },
  reverb: { room_size: 0.5, damping: 0.5, wet: 0.3 },
  delay: { delay_time: 0.3, feedback: 0.4, wet: 0.3 },
  formant: { shift_semitones: 0.0 },
  denoise: { mode: 'noise_reduce', stationary: true, prop_decrease: 0.8 },
}

const EFFECT_ICONS: Record<string, string> = {
  autotune: '♪',
  vocoder: '◈',
  reverb: '◎',
  delay: '◇',
  formant: '△',
  denoise: '⊘',
}

/* ---------- Sortable Effect Card ---------- */

const DISPLAY_FONT = { fontFamily: 'var(--font-display)' } as const

const SortableEffectCard = memo(function SortableEffectCard({
  node,
  onToggle,
  onRemove,
}: {
  node: EffectNode
  onToggle: (id: string) => void
  onRemove: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }

  const colors = EFFECT_COLORS[node.effect_type] ?? EFFECT_COLORS.reverb
  const icon = EFFECT_ICONS[node.effect_type] ?? '●'

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative flex items-center gap-3 rounded-xl border px-4 py-3
        transition-all duration-200
        ${node.enabled ? `${colors.bg} ${colors.border} ${colors.glow}` : 'bg-zinc-800/40 border-zinc-700/40'}
        ${isDragging ? 'scale-[1.02] ring-2 ring-white/10' : ''}
      `}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex flex-col gap-[3px] cursor-grab active:cursor-grabbing p-1 -ml-1 opacity-40 group-hover:opacity-70 transition-opacity"
        aria-label="Drag to reorder"
      >
        <span className="block h-[2px] w-4 rounded-full bg-zinc-400" />
        <span className="block h-[2px] w-4 rounded-full bg-zinc-400" />
        <span className="block h-[2px] w-4 rounded-full bg-zinc-400" />
      </button>

      {/* Effect icon + type */}
      <div className={`text-lg ${node.enabled ? colors.text : 'text-zinc-600'} transition-colors select-none`}>
        {icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-semibold tracking-wide ${node.enabled ? colors.text : 'text-zinc-500'} transition-colors`}
            style={DISPLAY_FONT}
          >
            {node.label}
          </span>
          {node.enabled && (
            <div className={`h-1.5 w-1.5 rounded-full ${colors.dot} animate-pulse`} />
          )}
        </div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-600 mt-0.5">
          {_paramSummary(node)}
        </div>
      </div>

      {/* Enable/disable toggle */}
      <button
        onClick={() => onToggle(node.id)}
        className={`
          relative h-6 w-11 rounded-full border transition-all duration-300 flex-shrink-0
          ${node.enabled
            ? `${colors.border} bg-white/5`
            : 'border-zinc-700 bg-zinc-800'
          }
        `}
        aria-label={node.enabled ? 'Disable effect' : 'Enable effect'}
      >
        <span
          className={`
            absolute top-0.5 h-4 w-4 rounded-full transition-all duration-300
            ${node.enabled
              ? `left-[22px] ${colors.dot}`
              : 'left-1 bg-zinc-600'
            }
          `}
        />
      </button>

      {/* Remove button */}
      <button
        onClick={() => onRemove(node.id)}
        className="text-zinc-600 hover:text-red-400 transition-colors p-1 opacity-0 group-hover:opacity-100"
        aria-label="Remove effect"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
})

/* Helper: summarize params */
function _paramSummary(node: EffectNode): string {
  const p = node.params
  switch (node.effect_type) {
    case 'autotune':
      return `${p.key ?? 'C'} ${p.scale_type ?? 'chromatic'} · speed ${p.retune_speed ?? 0}ms`
    case 'vocoder':
      return `${p.vocoder_type ?? 'channel'} · ${p.n_bands ?? 16} bands`
    case 'reverb':
      return `room ${((p.room_size as number) ?? 0.5).toFixed(1)} · wet ${((p.wet as number) ?? 0.3).toFixed(1)}`
    case 'delay':
      return `${((p.delay_time as number) ?? 0.3).toFixed(2)}s · fb ${((p.feedback as number) ?? 0.4).toFixed(1)}`
    case 'formant':
      return `shift ${((p.shift_semitones as number) ?? 0).toFixed(1)} st`
    case 'denoise':
      return `${p.mode ?? 'noise_reduce'}`
    default:
      return ''
  }
}

/* ---------- Main Panel ---------- */

export function EffectsChainPanel({ sessionId, onProcessed }: EffectsChainPanelProps) {
  const [chain, setChain] = useState<EffectNode[]>([])
  const [running, setRunning] = useState(false)
  const [addMenuOpen, setAddMenuOpen] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Load chain on mount
  useEffect(() => {
    fetch(`/api/chain/${sessionId}`)
      .then((r) => r.json())
      .then((data) => setChain(data.chain ?? []))
      .catch(() => {})
  }, [sessionId])

  // Add effect
  const handleAdd = useCallback(async (effectType: string) => {
    setAddMenuOpen(false)
    try {
      const resp = await fetch('/api/chain/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          effect_type: effectType,
          params: DEFAULT_PARAMS[effectType] ?? {},
        }),
      })
      const data = await resp.json()
      setChain(data.chain)
    } catch (err) {
      console.error('Add effect failed:', err)
    }
  }, [sessionId])

  // Toggle enable/disable
  const handleToggle = useCallback(async (nodeId: string) => {
    const node = chain.find((n) => n.id === nodeId)
    if (!node) return
    try {
      const resp = await fetch('/api/chain/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          node_id: nodeId,
          enabled: !node.enabled,
        }),
      })
      const data = await resp.json()
      setChain(data.chain)
    } catch (err) {
      console.error('Toggle failed:', err)
    }
  }, [chain, sessionId])

  // Remove
  const handleRemove = useCallback(async (nodeId: string) => {
    try {
      const resp = await fetch(`/api/chain/${sessionId}/${nodeId}`, { method: 'DELETE' })
      const data = await resp.json()
      setChain(data.chain)
    } catch (err) {
      console.error('Remove failed:', err)
    }
  }, [sessionId])

  // Reorder on drag end
  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = chain.findIndex((n) => n.id === active.id)
    const newIndex = chain.findIndex((n) => n.id === over.id)
    const reordered = arrayMove(chain, oldIndex, newIndex)
    setChain(reordered)

    try {
      await fetch('/api/chain/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          ordered_ids: reordered.map((n) => n.id),
        }),
      })
    } catch (err) {
      console.error('Reorder failed:', err)
    }
  }, [chain, sessionId])

  // Run the full chain
  const handleRun = useCallback(async () => {
    setRunning(true)
    try {
      const resp = await fetch(`/api/chain/run/${sessionId}`, { method: 'POST' })
      if (resp.ok) {
        onProcessed()
      }
    } catch (err) {
      console.error('Chain run failed:', err)
    } finally {
      setRunning(false)
    }
  }, [sessionId, onProcessed])

  const enabledCount = useMemo(() => chain.filter((n) => n.enabled).length, [chain])

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
            <h3
              className="text-sm font-bold uppercase tracking-[0.15em] text-zinc-300"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <HelpTooltip {...DSP_HELP.effectsChain}>Effects Chain</HelpTooltip>
            </h3>
          </div>
          {chain.length > 0 && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600 bg-zinc-800/60 rounded-full px-2 py-0.5">
              {enabledCount}/{chain.length} active
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Add button */}
          <div className="relative">
            <button
              onClick={() => setAddMenuOpen(!addMenuOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700/60 bg-zinc-800/50 px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-all"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add
            </button>

            {addMenuOpen && (
              <div className="absolute right-0 top-full mt-2 z-40 w-48 rounded-xl border border-zinc-700/60 bg-zinc-900/95 backdrop-blur-xl p-1.5 shadow-2xl animate-slide-down">
                {Object.keys(EFFECT_COLORS).map((type) => {
                  const c = EFFECT_COLORS[type]
                  return (
                    <button
                      key={type}
                      onClick={() => handleAdd(type)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:${c.bg}`}
                    >
                      <span className={`${c.text} text-base`}>{EFFECT_ICONS[type]}</span>
                      <span className="text-zinc-300 capitalize" style={{ fontFamily: 'var(--font-display)' }}>
                        {type === 'autotune' ? 'Auto-Tune' : type.replace('_', ' ')}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Run chain */}
          {chain.length > 0 && (
            <button
              onClick={handleRun}
              disabled={running || enabledCount === 0}
              className={`
                flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all
                ${running
                  ? 'bg-emerald-500/10 text-emerald-400/50 border border-emerald-500/20 cursor-wait'
                  : enabledCount > 0
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25 glow-emerald'
                    : 'bg-zinc-800 text-zinc-600 border border-zinc-700/40 cursor-not-allowed'
                }
              `}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {running ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Running
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  Run Chain
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Chain list */}
      <div className="px-6 pb-5">
        {chain.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="text-3xl text-zinc-700 mb-3">◇</div>
            <p className="text-sm text-zinc-500" style={{ fontFamily: 'var(--font-body)' }}>
              No effects in chain
            </p>
            <p className="text-xs text-zinc-600 mt-1">
              Add effects and drag to reorder the processing pipeline
            </p>
          </div>
        ) : (
          <>
            {/* Signal flow indicator */}
            <div className="flex items-center gap-2 mb-3 text-[10px] uppercase tracking-[0.15em] text-zinc-600">
              <span>Input</span>
              <div className="h-px flex-1 bg-gradient-to-r from-zinc-700 via-zinc-600 to-zinc-700" />
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
              <div className="h-px flex-1 bg-gradient-to-r from-zinc-700 via-zinc-600 to-zinc-700" />
              <span>Output</span>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={chain.map((n) => n.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {chain.map((node, i) => (
                    <div key={node.id}>
                      <SortableEffectCard
                        node={node}
                        onToggle={handleToggle}
                        onRemove={handleRemove}
                      />
                      {/* Connector line between items */}
                      {i < chain.length - 1 && (
                        <div className="flex justify-center py-0.5">
                          <div className="h-3 w-px bg-zinc-700/50" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>

      {/* Close add menu on outside click */}
      {addMenuOpen && (
        <div className="fixed inset-0 z-30" onClick={() => setAddMenuOpen(false)} />
      )}
    </div>
  )
}
