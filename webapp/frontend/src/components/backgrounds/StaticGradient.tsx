/**
 * StaticGradient - A lightweight, CSS-only background with layered gradients
 * and subtle noise texture. No canvas, minimal compute. Uses a very slow
 * CSS animation (60s cycle) for gentle gradient position shifts.
 */
export function StaticGradient() {
  return (
    <div className="fixed inset-0 z-0">
      {/* Base dark gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, #0a0a12 0%, #0d0b1a 50%, #080810 100%)',
        }}
      />

      {/* Amber glow - top right area */}
      <div
        className="absolute inset-0 static-gradient-drift"
        style={{
          background: `
            radial-gradient(ellipse 60% 50% at 75% 20%, rgba(251,191,36,0.06) 0%, transparent 70%),
            radial-gradient(ellipse 40% 35% at 80% 15%, rgba(251,191,36,0.04) 0%, transparent 60%)
          `,
        }}
      />

      {/* Violet glow - bottom left area */}
      <div
        className="absolute inset-0 static-gradient-drift-reverse"
        style={{
          background: `
            radial-gradient(ellipse 55% 45% at 25% 75%, rgba(139,92,246,0.07) 0%, transparent 70%),
            radial-gradient(ellipse 35% 30% at 15% 80%, rgba(139,92,246,0.04) 0%, transparent 60%)
          `,
        }}
      />

      {/* Cross glow - center for depth */}
      <div
        className="absolute inset-0 static-gradient-breathe"
        style={{
          background: `
            radial-gradient(ellipse 80% 60% at 50% 50%, rgba(139,92,246,0.03) 0%, transparent 50%),
            radial-gradient(ellipse 50% 40% at 45% 55%, rgba(251,191,36,0.02) 0%, transparent 45%)
          `,
        }}
      />

      {/* Subtle warm accent - top left */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse 30% 25% at 10% 10%, rgba(251,191,36,0.03) 0%, transparent 70%)
          `,
        }}
      />

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />

      {/* Inline keyframe styles */}
      <style>{`
        @keyframes static-gradient-drift {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(15px, -10px) scale(1.02);
          }
          50% {
            transform: translate(-10px, 8px) scale(0.98);
          }
          75% {
            transform: translate(8px, 12px) scale(1.01);
          }
        }

        @keyframes static-gradient-drift-reverse {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(-12px, 8px) scale(1.01);
          }
          50% {
            transform: translate(10px, -12px) scale(1.03);
          }
          75% {
            transform: translate(-8px, -6px) scale(0.99);
          }
        }

        @keyframes static-gradient-breathe {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.6;
          }
        }

        .static-gradient-drift {
          animation: static-gradient-drift 60s ease-in-out infinite;
        }

        .static-gradient-drift-reverse {
          animation: static-gradient-drift-reverse 45s ease-in-out infinite;
        }

        .static-gradient-breathe {
          animation: static-gradient-breathe 30s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
