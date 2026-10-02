import { describe, expect, it } from 'vitest'
import { defaultConfig, initialState, step, type SimConfig, type SimState } from './step'
import { firstBuilder } from './match'

const c: SimConfig = { ...defaultConfig, buildTime: 2 }
const TICKS = 2 * c.tickHz
const run = (s: SimState, n: number, cfg = c) => {
  for (let i = 0; i < n; i++) s = step(s, {}, cfg).state
  return s
}

describe('build timer', () => {
  it('is off by default (hot-seat)', () => {
    const s = initialState(1)
    expect(run(s, 10_000, defaultConfig).match.builder).toBe(s.match.builder)
  })
  it('starts full and ends the first builder turn on expiry', () => {
    const s = initialState(1, c)
    const first = firstBuilder(1, 1)
    expect(s.match.builder).toBe(first)
    expect(s.clock.left).toBe(TICKS)
    expect(run(s, TICKS - 1).match.builder).toBe(first)
    const next = run(s, TICKS)
    expect(next.match.builder).toBe(first === 1 ? 2 : 1)
    expect(next.clock.left).toBe(TICKS)
  })
  it('expiry of the second builder starts play with a full shot clock', () => {
    const s = run(initialState(1, c), 2 * TICKS)
    expect(s.match.builder).toBeNull()
    expect(s.clock.left).toBe(c.shotClock * c.tickHz)
  })
  it('is deterministic: same seed and inputs give the same state', () => {
    expect(run(initialState(7, c), 3 * TICKS)).toEqual(run(initialState(7, c), 3 * TICKS))
  })
})
