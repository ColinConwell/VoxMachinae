import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

export type BackgroundMode = 'wave-grid' | 'particle-field' | 'static-gradient'

const BACKGROUND_MODES: BackgroundMode[] = ['wave-grid', 'particle-field', 'static-gradient']
const STORAGE_KEY = 'voxmachinae-bg-mode'

interface BackgroundContextValue {
  mode: BackgroundMode
  setMode: (mode: BackgroundMode) => void
  cycleMode: () => void
}

const BackgroundContext = createContext<BackgroundContextValue | null>(null)

function getStoredMode(): BackgroundMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && BACKGROUND_MODES.includes(stored as BackgroundMode)) {
      return stored as BackgroundMode
    }
  } catch {
    // localStorage may be unavailable
  }
  return 'wave-grid'
}

export function BackgroundProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<BackgroundMode>(getStoredMode)

  const setMode = useCallback((newMode: BackgroundMode) => {
    setModeState(newMode)
    try {
      localStorage.setItem(STORAGE_KEY, newMode)
    } catch {
      // ignore storage errors
    }
  }, [])

  const cycleMode = useCallback(() => {
    setModeState((current) => {
      const idx = BACKGROUND_MODES.indexOf(current)
      const next = BACKGROUND_MODES[(idx + 1) % BACKGROUND_MODES.length]
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  // Sync across tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        const val = e.newValue as BackgroundMode
        if (BACKGROUND_MODES.includes(val)) {
          setModeState(val)
        }
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  return (
    <BackgroundContext.Provider value={{ mode, setMode, cycleMode }}>
      {children}
    </BackgroundContext.Provider>
  )
}

export function useBackground(): BackgroundContextValue {
  const ctx = useContext(BackgroundContext)
  if (!ctx) {
    throw new Error('useBackground must be used within a BackgroundProvider')
  }
  return ctx
}
