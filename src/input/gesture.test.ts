import { describe, expect, it } from 'vitest'
import { gestureMove, gesturePower, gestureStart } from './gesture'

const p = (x = 0, y = 0) => ({ x, y })

describe('blast gesture', () => {
  it('charges nothing during the 1 s dwell', () => {
    expect(gesturePower(gestureStart(p(), 0), 999)).toBe(0)
  })
  it('ramps with quadratic ease-in over 1.5 s then holds', () => {
    const g = gestureStart(p(), 0)
    expect(gesturePower(g, 1750)).toBeCloseTo(0.25)
    expect(gesturePower(g, 2500)).toBe(1)
    expect(gesturePower(g, 9000)).toBe(1)
  })
  it('moving over 12 px in the dwell becomes a pan', () => {
    const g = gestureMove(gestureStart(p(), 0), p(13, 0), 500)
    expect(g.mode).toBe('pan')
    expect(gesturePower(g, 2000)).toBe(0)
  })
  it('moving over 12 px in the ramp kills the gesture until lift', () => {
    const g = gestureMove(gestureStart(p(), 0), p(0, 13), 1500)
    expect(g.mode).toBe('dead')
    expect(gesturePower(gestureMove(g, p(), 2000), 3000)).toBe(0)
  })
  it('small jitter is tolerated', () => {
    const g = gestureMove(gestureStart(p(), 0), p(8, 8), 1500)
    expect(gesturePower(g, 2500)).toBe(1)
  })
})
