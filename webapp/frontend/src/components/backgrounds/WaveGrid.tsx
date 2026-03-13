import { useEffect, useRef } from 'react'

// Color constants
const AMBER = { r: 251, g: 191, b: 36 }   // #FBBF24
const VIOLET = { r: 139, g: 92, b: 246 }  // #8B5CF6

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function lerpColor(
  c1: typeof AMBER,
  c2: typeof AMBER,
  t: number,
  alpha: number,
): string {
  const r = Math.round(lerp(c1.r, c2.r, t))
  const g = Math.round(lerp(c1.g, c2.g, t))
  const b = Math.round(lerp(c1.b, c2.b, t))
  return `rgba(${r},${g},${b},${alpha})`
}

export function WaveGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let width = 0
    let height = 0
    let dpr = 1

    const resize = () => {
      dpr = window.devicePixelRatio || 1
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    // Grid parameters
    const COLS = 44
    const ROWS = 28
    const SPACING = 32

    // Camera / perspective
    const FOV = 600
    const TILT_X = -0.55  // ~30 degrees forward tilt
    const TILT_Z = 0.15

    // Wave parameters - multiple overlapping waves for organic motion
    // Speed values are already tuned to be slow when multiplied by raw timestamp ms
    const waves = [
      { freqX: 0.08, freqZ: 0.06, speed: 0.0008, amp: 28, phaseX: 0, phaseZ: 0 },
      { freqX: 0.12, freqZ: 0.10, speed: 0.0012, amp: 18, phaseX: 2.0, phaseZ: 1.5 },
      { freqX: 0.05, freqZ: 0.15, speed: 0.0006, amp: 22, phaseX: 4.0, phaseZ: 3.0 },
      { freqX: 0.18, freqZ: 0.04, speed: 0.0015, amp: 10, phaseX: 1.0, phaseZ: 5.0 },
      { freqX: 0.03, freqZ: 0.03, speed: 0.0004, amp: 35, phaseX: 0.5, phaseZ: 0.8 },
    ]

    function getWaveHeight(gx: number, gz: number, time: number): number {
      let y = 0
      for (const w of waves) {
        // Fixed: removed the * 1000 and * 700 multipliers that caused seizure-speed animation.
        // time is already in ms from requestAnimationFrame, so time * 0.0008 gives a slow sweep.
        y += w.amp * Math.sin(gx * w.freqX + w.phaseX + time * w.speed)
                    * Math.cos(gz * w.freqZ + w.phaseZ + time * w.speed * 0.7)
      }
      // Subtle radial ripple - also fixed from time * 0.0006 * 1000 to just time * 0.0006
      const dist = Math.sqrt(gx * gx + gz * gz)
      y += 12 * Math.sin(dist * 0.04 - time * 0.0006)
      return y
    }

    // Normalized wave amplitude for color mapping (0..1)
    function getWaveNorm(gx: number, gz: number, time: number): number {
      const y = getWaveHeight(gx, gz, time)
      // Total max theoretical amp ~ sum of all amps + radial
      const maxAmp = 28 + 18 + 22 + 10 + 35 + 12
      return (y / maxAmp) * 0.5 + 0.5 // map to 0..1
    }

    // 3D rotation helpers
    function rotateX(
      _x: number, y: number, z: number, angle: number,
    ): [number, number, number] {
      const c = Math.cos(angle)
      const s = Math.sin(angle)
      return [_x, y * c - z * s, y * s + z * c]
    }

    function rotateY(
      x: number, _y: number, z: number, angle: number,
    ): [number, number, number] {
      const c = Math.cos(angle)
      const s = Math.sin(angle)
      return [x * c + z * s, _y, -x * s + z * c]
    }

    function rotateZ(
      x: number, y: number, _z: number, angle: number,
    ): [number, number, number] {
      const c = Math.cos(angle)
      const s = Math.sin(angle)
      return [x * c - y * s, x * s + y * c, _z]
    }

    // Project a 3D point to 2D screen coords
    function project(
      x3d: number, y3d: number, z3d: number, time: number,
    ): { x: number; y: number; depth: number } | null {
      // Slow drift rotation
      const driftY = time * 0.00004
      const driftZ = Math.sin(time * 0.00003) * 0.08

      // Apply rotations: tilt forward, slow Y rotation, slight Z wobble
      let [x, y, z] = rotateX(x3d, y3d, z3d, TILT_X)
      ;[x, y, z] = rotateY(x, y, z, driftY)
      ;[x, y, z] = rotateZ(x, y, z, TILT_Z + driftZ)

      // Push the grid back in Z so it's visible
      z += 450

      // Perspective divide
      if (z <= 10) return null
      const scale = FOV / z
      const screenX = width / 2 + x * scale
      const screenY = height / 2 + y * scale

      return { x: screenX, y: screenY, depth: z }
    }

    // Preallocate grid buffer
    const projected: (({ x: number; y: number; depth: number; colorT: number } | null)[])[] =
      Array.from({ length: ROWS }, () =>
        Array.from({ length: COLS }, () => null),
      )

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height)

      // Dark background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height)
      bgGrad.addColorStop(0, '#0a0a12')
      bgGrad.addColorStop(0.5, '#0d0b1a')
      bgGrad.addColorStop(1, '#080810')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, width, height)

      // Center the grid
      const gridOffsetX = -(COLS - 1) * SPACING * 0.5
      const gridOffsetZ = -(ROWS - 1) * SPACING * 0.5

      // Compute all projected points
      let minDepth = Infinity
      let maxDepth = -Infinity

      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const gx = col * SPACING + gridOffsetX
          const gz = row * SPACING + gridOffsetZ

          const waveY = getWaveHeight(gx, gz, time)
          const colorT = getWaveNorm(gx, gz, time)

          const p = project(gx, waveY, gz, time)
          if (p) {
            projected[row][col] = { ...p, colorT }
            if (p.depth < minDepth) minDepth = p.depth
            if (p.depth > maxDepth) maxDepth = p.depth
          } else {
            projected[row][col] = null
          }
        }
      }

      const depthRange = maxDepth - minDepth || 1

      // Draw grid lines - rows first (horizontal), then columns (vertical)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // Draw horizontal lines (along columns for each row)
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS - 1; col++) {
          const p1 = projected[row][col]
          const p2 = projected[row][col + 1]
          if (!p1 || !p2) continue

          // Skip lines entirely offscreen
          if (
            (p1.x < -50 && p2.x < -50) ||
            (p1.x > width + 50 && p2.x > width + 50) ||
            (p1.y < -50 && p2.y < -50) ||
            (p1.y > height + 50 && p2.y > height + 50)
          ) continue

          const avgDepth = (p1.depth + p2.depth) * 0.5
          const depthNorm = (avgDepth - minDepth) / depthRange // 0 = near, 1 = far

          // Opacity: near lines brighter, far lines fade
          const baseOpacity = lerp(0.7, 0.04, depthNorm)
          // Line width: near lines thicker
          const lineWidth = lerp(2.0, 0.4, depthNorm)

          const avgColorT = (p1.colorT + p2.colorT) * 0.5
          const color = lerpColor(AMBER, VIOLET, avgColorT, baseOpacity)

          ctx.beginPath()
          ctx.moveTo(p1.x, p1.y)
          ctx.lineTo(p2.x, p2.y)
          ctx.strokeStyle = color
          ctx.lineWidth = lineWidth
          ctx.stroke()
        }
      }

      // Draw vertical lines (along rows for each column)
      for (let col = 0; col < COLS; col++) {
        for (let row = 0; row < ROWS - 1; row++) {
          const p1 = projected[row][col]
          const p2 = projected[row + 1][col]
          if (!p1 || !p2) continue

          if (
            (p1.x < -50 && p2.x < -50) ||
            (p1.x > width + 50 && p2.x > width + 50) ||
            (p1.y < -50 && p2.y < -50) ||
            (p1.y > height + 50 && p2.y > height + 50)
          ) continue

          const avgDepth = (p1.depth + p2.depth) * 0.5
          const depthNorm = (avgDepth - minDepth) / depthRange

          const baseOpacity = lerp(0.5, 0.03, depthNorm)
          const lineWidth = lerp(1.5, 0.3, depthNorm)

          const avgColorT = (p1.colorT + p2.colorT) * 0.5
          const color = lerpColor(AMBER, VIOLET, avgColorT, baseOpacity)

          ctx.beginPath()
          ctx.moveTo(p1.x, p1.y)
          ctx.lineTo(p2.x, p2.y)
          ctx.strokeStyle = color
          ctx.lineWidth = lineWidth
          ctx.stroke()
        }
      }

      // Subtle glow on the brightest near points
      for (let row = 0; row < ROWS; row += 2) {
        for (let col = 0; col < COLS; col += 2) {
          const p = projected[row][col]
          if (!p) continue
          const depthNorm = (p.depth - minDepth) / depthRange
          if (depthNorm > 0.35) continue // only glow near points

          const glowAlpha = lerp(0.12, 0, depthNorm / 0.35)
          const glowRadius = lerp(6, 2, depthNorm / 0.35)

          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius)
          const glowColor = p.colorT > 0.5
            ? `rgba(139,92,246,${glowAlpha})`
            : `rgba(251,191,36,${glowAlpha})`
          grad.addColorStop(0, glowColor)
          grad.addColorStop(1, 'rgba(0,0,0,0)')

          ctx.beginPath()
          ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2)
          ctx.fillStyle = grad
          ctx.fill()
        }
      }

      animationId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    animationId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0"
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
