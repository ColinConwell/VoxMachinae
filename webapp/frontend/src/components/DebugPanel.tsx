import { useState, useEffect, useCallback } from 'react'
import { apiUrl } from '../lib/api'

interface LogEntry {
  id: number
  timestamp: string
  level: 'info' | 'warn' | 'error' | 'debug'
  source: string
  message: string
}

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [healthStatus, setHealthStatus] = useState<'ok' | 'error' | 'checking'>('checking')
  const [backendInfo, setBackendInfo] = useState<Record<string, unknown> | null>(null)
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all')
  const [, setNextId] = useState(0)

  const addLog = useCallback(
    (level: LogEntry['level'], source: string, message: string) => {
      setNextId((prev) => {
        const id = prev
        setLogs((logs) => [
          {
            id,
            timestamp: new Date().toISOString().split('T')[1].slice(0, 12),
            level,
            source,
            message,
          },
          ...logs.slice(0, 199), // Keep last 200
        ])
        return prev + 1
      })
    },
    []
  )

  // Check backend health
  const checkHealth = useCallback(async () => {
    setHealthStatus('checking')
    try {
      const res = await fetch(apiUrl('/api/health'))
      if (res.ok) {
        const data = await res.json()
        setHealthStatus('ok')
        setBackendInfo(data)
        addLog('info', 'health', `Backend OK: v${data.version}`)
      } else {
        setHealthStatus('error')
        addLog('error', 'health', `Backend returned ${res.status}`)
      }
    } catch (err) {
      setHealthStatus('error')
      addLog('error', 'health', `Backend unreachable: ${err}`)
    }
  }, [addLog])

  // Check on mount & periodically
  useEffect(() => {
    const initialCheck = window.setTimeout(() => {
      void checkHealth()
    }, 0)
    const interval = setInterval(checkHealth, 30000)
    return () => {
      clearTimeout(initialCheck)
      clearInterval(interval)
    }
  }, [checkHealth])

  // Intercept console.error and fetch errors
  useEffect(() => {
    const origError = console.error
    const origWarn = console.warn
    console.error = (...args: unknown[]) => {
      addLog('error', 'console', args.map(String).join(' '))
      origError.apply(console, args)
    }
    console.warn = (...args: unknown[]) => {
      addLog('warn', 'console', args.map(String).join(' '))
      origWarn.apply(console, args)
    }

    // Monitor fetch errors
    const origFetch = window.fetch
    window.fetch = async (...args) => {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
      try {
        const res = await origFetch(...args)
        if (!res.ok && url.startsWith('/api')) {
          addLog('error', 'fetch', `${res.status} ${res.statusText}: ${url}`)
        } else if (url.startsWith('/api')) {
          addLog('debug', 'fetch', `${res.status}: ${url}`)
        }
        return res
      } catch (err) {
        addLog('error', 'fetch', `Failed: ${url} - ${err}`)
        throw err
      }
    }

    return () => {
      console.error = origError
      console.warn = origWarn
      window.fetch = origFetch
    }
  }, [addLog])

  const filteredLogs = logs.filter((l) => {
    if (filter === 'all') return true
    if (filter === 'error') return l.level === 'error'
    if (filter === 'warn') return l.level === 'warn' || l.level === 'error'
    return l.level === 'info' || l.level === 'warn' || l.level === 'error'
  })

  const levelColors: Record<string, string> = {
    error: 'text-red-400',
    warn: 'text-yellow-400',
    info: 'text-blue-400',
    debug: 'text-zinc-600',
  }

  const statusDot = {
    ok: 'bg-emerald-500 shadow-lg shadow-emerald-500/50',
    error: 'bg-red-500 shadow-lg shadow-red-500/50',
    checking: 'bg-yellow-500 shadow-lg shadow-yellow-500/50 animate-pulse',
  }

  const errorCount = logs.filter((l) => l.level === 'error').length

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-28 z-50 flex items-center gap-2.5 glass-card glass-card-hover rounded-full px-4 py-2 text-xs font-medium text-zinc-400 transition-all duration-200"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <span className={`h-2 w-2 rounded-full ${statusDot[healthStatus]}`} />
        Debug
        {errorCount > 0 && (
          <span className="rounded-full bg-red-500/20 border border-red-500/30 px-1.5 py-0.5 text-[10px] text-red-400">
            {errorCount}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-14 right-28 z-50 w-[520px] max-h-[60vh] glass-card rounded-2xl shadow-2xl shadow-black/40 flex flex-col overflow-hidden animate-slide-down">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
            <div className="flex items-center gap-3">
              <span
                className="text-xs font-semibold text-zinc-300 tracking-wide"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Debug Console
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                  healthStatus === 'ok'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : healthStatus === 'error'
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                      : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                }`}
              >
                Backend: {healthStatus}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-2.5 py-1 text-[10px] text-zinc-400 focus:outline-none"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                <option value="all">All</option>
                <option value="error">Errors</option>
                <option value="warn">Warnings+</option>
                <option value="info">Info+</option>
              </select>
              <button
                onClick={() => setLogs([])}
                className="glass-card rounded-lg px-2.5 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Clear
              </button>
              <button
                onClick={checkHealth}
                className="glass-card rounded-lg px-2.5 py-1 text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>

          {/* Backend info */}
          {backendInfo && (
            <div className="border-b border-white/[0.04] px-5 py-2 text-[10px] text-zinc-600 flex gap-4">
              {Object.entries(backendInfo).map(([k, v]) => (
                <span key={k}>
                  {k}: <span className="text-zinc-400">{String(v)}</span>
                </span>
              ))}
            </div>
          )}

          {/* Logs */}
          <div className="flex-1 overflow-y-auto px-5 py-3 font-mono text-[11px] space-y-0.5">
            {filteredLogs.length === 0 ? (
              <p className="py-8 text-center text-zinc-700" style={{ fontFamily: 'var(--font-body)' }}>
                No logs yet
              </p>
            ) : (
              filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex gap-2.5 py-1 hover:bg-white/[0.02] rounded-lg px-2 transition-colors"
                >
                  <span className="text-zinc-700 shrink-0">{log.timestamp}</span>
                  <span className={`shrink-0 w-10 font-semibold ${levelColors[log.level]}`}>
                    [{log.level.toUpperCase().slice(0, 4)}]
                  </span>
                  <span className="text-zinc-600 shrink-0">{log.source}</span>
                  <span className="text-zinc-400 break-all">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
