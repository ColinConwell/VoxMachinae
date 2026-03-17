import { useBackground } from '../contexts/BackgroundContext'
import { WaveGrid } from './backgrounds/WaveGrid'
import { ParticleField } from './backgrounds/ParticleField'
import { StaticGradient } from './backgrounds/StaticGradient'
import { BackgroundToggle } from './backgrounds/BackgroundToggle'
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion'

/**
 * WaveBackground - Wrapper component that renders the currently selected
 * background mode and includes the toggle button and noise overlay.
 */
export function WaveBackground() {
  const { mode } = useBackground()
  const prefersReducedMotion = usePrefersReducedMotion()
  const effectiveMode = prefersReducedMotion ? 'static-gradient' : mode

  return (
    <>
      {effectiveMode === 'wave-grid' && <WaveGrid />}
      {effectiveMode === 'particle-field' && <ParticleField />}
      {effectiveMode === 'static-gradient' && <StaticGradient />}

      {/* Grain/noise overlay for texture (shared across all modes) */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      <BackgroundToggle />
    </>
  )
}
