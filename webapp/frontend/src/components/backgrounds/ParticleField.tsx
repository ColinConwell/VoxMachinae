import { useEffect, useRef } from 'react'

// Color palette matching the app theme
const AMBER = { r: 251, g: 191, b: 36 }
const VIOLET = { r: 139, g: 92, b: 246 }

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: { r: number; g: number; b: number }
  alpha: number
  /** Base drift speed multiplier */
  drift: number
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function createParticle(width: number, height: number): Particle {
  const t = Math.random()
  const color = {
    r: Math.round(lerp(AMBER.r, VIOLET.r, t)),
    g: Math.round(lerp(AMBER.g, VIOLET.g, t)),
    b: Math.round(lerp(AMBER.b, VIOLET.b, t)),
  }

  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: randomBetween(-0.15, 0.15),
    vy: randomBetween(-0.15, 0.15),
    radius: randomBetween(1.2, 3),
    color,
    alpha: randomBetween(0.15, 0.55),
    drift: randomBetween(0.6, 1.4),
  }
}

const PARTICLE_COUNT = 100
const CONNECTION_DISTANCE = 120
const MOUSE_RADIUS = 150
const MOUSE_PUSH_STRENGTH = 0.8

export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -9999, y: -9999 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationId: number
    let width = 0
    let height = 0
    let dpr = 1
    let particles: Particle[] = []

    const resize = () => {
      dpr = window.devicePixelRatio || 1
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Reinitialize particles on resize if needed
      if (particles.length === 0) {
        particles = Array.from({ length: PARTICLE_COUNT }, () =>
          createParticle(width, height),
        )
      } else {
        // Clamp existing particles to new bounds
        for (const p of particles) {
          if (p.x > width) p.x = width - 10
          if (p.y > height) p.y = height - 10
        }
      }
    }

    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX
      mouseRef.current.y = e.clientY
    }

    const onMouseLeave = () => {
      mouseRef.current.x = -9999
      mouseRef.current.y = -9999
    }

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height)

      // Dark background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height)
      bgGrad.addColorStop(0, '#0a0a12')
      bgGrad.addColorStop(0.5, '#0d0b1a')
      bgGrad.addColorStop(1, '#080810')
      ctx.fillStyle = bgGrad
      ctx.fillRect(0, 0, width, height)

      const mx = mouseRef.current.x
      const my = mouseRef.current.y

      // Update particles
      for (const p of particles) {
        // Gentle brownian motion: add small random impulse each frame
        p.vx += randomBetween(-0.008, 0.008)
        p.vy += randomBetween(-0.008, 0.008)

        // Very gentle sine drift for organic floating feel
        const drift = Math.sin(time * 0.0003 * p.drift) * 0.02
        p.vx += drift
        p.vy += Math.cos(time * 0.00025 * p.drift) * 0.015

        // Damping to keep things calm
        p.vx *= 0.985
        p.vy *= 0.985

        // Clamp velocity
        const maxV = 0.6
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy)
        if (speed > maxV) {
          p.vx = (p.vx / speed) * maxV
          p.vy = (p.vy / speed) * maxV
        }

        // Mouse repulsion
        const dx = p.x - mx
        const dy = p.y - my
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < MOUSE_RADIUS && dist > 0) {
          const force = (1 - dist / MOUSE_RADIUS) * MOUSE_PUSH_STRENGTH
          p.vx += (dx / dist) * force
          p.vy += (dy / dist) * force
        }

        p.x += p.vx
        p.y += p.vy

        // Wrap around edges with a soft margin
        const margin = 20
        if (p.x < -margin) p.x = width + margin
        if (p.x > width + margin) p.x = -margin
        if (p.y < -margin) p.y = height + margin
        if (p.y > height + margin) p.y = -margin
      }

      // Draw connections between nearby particles
      ctx.lineWidth = 1
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i]
          const b = particles[j]
          const dx = a.x - b.x
          const dy = a.y - b.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < CONNECTION_DISTANCE) {
            const t = 1 - dist / CONNECTION_DISTANCE
            const lineAlpha = t * 0.12 * Math.min(a.alpha, b.alpha) * 2

            // Blend color between the two particles
            const cr = Math.round((a.color.r + b.color.r) * 0.5)
            const cg = Math.round((a.color.g + b.color.g) * 0.5)
            const cb = Math.round((a.color.b + b.color.b) * 0.5)

            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.strokeStyle = `rgba(${cr},${cg},${cb},${lineAlpha})`
            ctx.stroke()
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        // Subtle breathing effect on alpha
        const breathe = 1 + Math.sin(time * 0.001 * p.drift + p.x * 0.01) * 0.2
        const finalAlpha = p.alpha * breathe

        // Glow
        const glowRadius = p.radius * 4
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowRadius)
        grad.addColorStop(0, `rgba(${p.color.r},${p.color.g},${p.color.b},${finalAlpha * 0.3})`)
        grad.addColorStop(0.4, `rgba(${p.color.r},${p.color.g},${p.color.b},${finalAlpha * 0.08})`)
        grad.addColorStop(1, 'rgba(0,0,0,0)')

        ctx.beginPath()
        ctx.arc(p.x, p.y, glowRadius, 0, Math.PI * 2)
        ctx.fillStyle = grad
        ctx.fill()

        // Core dot
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${p.color.r},${p.color.g},${p.color.b},${finalAlpha})`
        ctx.fill()
      }

      animationId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)
    animationId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
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
