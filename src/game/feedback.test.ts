import { describe, expect, it } from 'vitest'
import { feedbackFor, vibration } from './feedback'

describe('vibration', () => {
  it('pulses longer for a stronger blast', () => {
    expect(vibration({ type: 'blast-fired', player: 1, origin: { x: 0, y: 0 }, power: 1 }) as number).toBeGreaterThan(vibration({ type: 'blast-fired', player: 1, origin: { x: 0, y: 0 }, power: 0.2 }) as number)
  })
  it('double pulse on goal, tick at full charge, silent otherwise', () => {
    expect(vibration({ type: 'goal' })).toHaveLength(3)
    expect(vibration({ type: 'charge-full' })).toBeTypeOf('number')
    expect(vibration({ type: 'refused' })).toBeUndefined()
  })
})

describe('feedbackFor', () => {
  const walls = [{ id: 1, owner: 2 as const }]
  const at = { x: 1, y: 1 }
  const destroyed = { type: 'wall-destroyed', wall: { id: 1, owner: 2, hp: 0 }, at } as never
  it('damaging hit flashes bright and emits particles; destruction emits more', () => {
    const hit = feedbackFor([{ type: 'ball-hit-wall', wall: 1, speed: 9, at }, { type: 'wall-cracked', id: 1, hp: 2, at }], walls, false)
    expect(hit.flashes).toEqual([{ wall: 1, dim: false }])
    expect(feedbackFor([destroyed], walls, false).bursts[0].count).toBeGreaterThan(hit.bursts[0].count)
  })
  it('a Breaker break doubles the particles', () => {
    const broke = { ...(destroyed as object), breaker: true } as never
    expect(feedbackFor([broke], walls, false).bursts[0].count).toBe(2 * feedbackFor([destroyed], walls, false).bursts[0].count)
  })
  it('a repaired structure flashes bright, also under reduced motion', () => {
    expect(feedbackFor([{ type: 'repaired', id: 1, player: 1 }], walls, false).flashes).toEqual([{ wall: 1, dim: false }])
    expect(feedbackFor([{ type: 'repaired', id: 1, player: 1 }], walls, true).flashes).toEqual([{ wall: 1, dim: false }])
  })
  it('non-damaging hit flashes dim with no particles', () => {
    const r = feedbackFor([{ type: 'ball-hit-wall', wall: 1, speed: 1, at }], walls, false)
    expect(r.flashes).toEqual([{ wall: 1, dim: true }])
    expect(r.bursts).toEqual([])
  })
  it('reduced motion drops shake, particles and haptics but keeps flashes', () => {
    const r = feedbackFor([{ type: 'wall-cracked', id: 1, hp: 2, at }, { type: 'blast-fired', player: 1, origin: { x: 0, y: 0 }, power: 1 }, { type: 'goal' }], walls, true)
    expect(r.flashes).toHaveLength(1)
    expect([r.bursts, r.shakes, r.vibrations]).toEqual([[], [], []])
  })
  it('blast shakes in proportion to power, none below 30%', () => {
    expect(feedbackFor([{ type: 'blast-fired', player: 1, origin: { x: 0, y: 0 }, power: 0.2 }], [], false).shakes).toEqual([])
    expect(feedbackFor([{ type: 'blast-fired', player: 1, origin: { x: 0, y: 0 }, power: 1 }], [], false).shakes).toEqual([4])
  })
})
