import { describe, expect, it } from 'vitest'

import {
  clampFrameDelta,
  createDeterministicBars,
  lerp,
  preferredDevicePixelRatio,
} from './animation'

describe('animation utilities', () => {
  it('clamps erratic frame deltas to a stable range', () => {
    expect(clampFrameDelta(12)).toBe(12)
    expect(clampFrameDelta(120)).toBe(32)
    expect(clampFrameDelta(Number.NaN)).toBe(16)
    expect(clampFrameDelta(-10)).toBe(16)
  })

  it('creates deterministic bar patterns for the same seed', () => {
    expect(createDeterministicBars(6, 42)).toEqual(createDeterministicBars(6, 42))
    expect(createDeterministicBars(6, 42)).not.toEqual(createDeterministicBars(6, 43))
  })

  it('caps device pixel ratio more aggressively for reduced motion', () => {
    expect(preferredDevicePixelRatio(3, false)).toBe(1.75)
    expect(preferredDevicePixelRatio(3, true)).toBe(1)
    expect(preferredDevicePixelRatio(0.5, false)).toBe(1)
  })

  it('lerps between values predictably', () => {
    expect(lerp(0, 10, 0.25)).toBe(2.5)
    expect(lerp(10, 0, 0.5)).toBe(5)
  })
})
