export function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}

export function clampFrameDelta(deltaMs: number, maxDeltaMs = 32): number {
  if (!Number.isFinite(deltaMs) || deltaMs < 0) {
    return 16
  }
  return Math.min(deltaMs, maxDeltaMs)
}

export function createDeterministicBars(count: number, seed: number): number[] {
  let state = seed >>> 0
  const values: number[] = []

  for (let index = 0; index < count; index += 1) {
    state = (1664525 * state + 1013904223) >>> 0
    values.push(state / 0xffffffff)
  }

  return values
}

export function preferredDevicePixelRatio(ratio: number, reducedMotion: boolean): number {
  const cap = reducedMotion ? 1 : 1.75
  return Math.min(Math.max(ratio || 1, 1), cap)
}
