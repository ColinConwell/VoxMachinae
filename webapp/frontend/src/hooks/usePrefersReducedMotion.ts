import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function getInitialPreference(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false
  }
  return window.matchMedia(QUERY).matches
}

export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getInitialPreference)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mediaQuery = window.matchMedia(QUERY)
    const update = () => {
      setPrefersReducedMotion(mediaQuery.matches)
    }

    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  return prefersReducedMotion
}
