import { describe, expect, it } from 'vitest'
import { defaultConfig, step, type SimConfig, type SimInput, type SimState } from './step'
import { emptied, playState } from './testkit'

/** No friction, so the velocity after one tick is the launch velocity. */
const c: SimConfig = { ...defaultConfig, halfLife: Infinity }
const ready = (over: Partial<SimState['possession']> = {}): SimState => ({ ...playState(), possession: { shooter: 1, shots: 3, inHand: false, live: false, ...over }, ball: { pos: { x: 20, y: 80 }, vel: { x: 0, y: 0 }, rolled: 0 } })
const shoot = (s: SimState, shot: SimInput['shot']) => step(s, { shot }, c)
const up = { x: 0.6, y: -0.8 }

describe('shot', () => {
  it('launches the ball at dir * power * maxSpeed', () => {
    const r = shoot(ready(), { player: 1, dir: up, tier: 0, power: 0.5 })
    // 0.5 of 60 is 30: (0.6, -0.8) * 30.
    expect(r.state.ball.vel.x).toBeCloseTo(18)
    expect(r.state.ball.vel.y).toBeCloseTo(-24)
    expect(r.state.possession.live).toBe(true)
  })

  it('accepts both ends of a tier\'s range', () => {
    expect(shoot(ready(), { player: 1, dir: up, tier: 1, power: 0.5 }).state.possession.live).toBe(true)
    expect(shoot(ready(), { player: 1, dir: up, tier: 1, power: 1 }).state.possession.live).toBe(true)
  })

  it('announces the shot with where it left from', () => {
    const r = shoot(ready(), { player: 1, dir: up, tier: 0, power: 0.5, breaker: true })
    expect(r.events).toContainEqual({ type: 'shot-fired', player: 1, from: { x: 20, y: 80 }, dir: up, tier: 0, power: 0.5, breaker: true })
  })

  describe('is refused, leaving the ball still', () => {
    const refused = (s: SimState, shot: SimInput['shot']) => {
      const r = shoot(s, shot)
      expect(r.events).toEqual([{ type: 'refused' }])
      expect(r.state.ball.vel).toEqual({ x: 0, y: 0 })
      expect(r.state.possession.live).toBe(false)
    }
    it('when it is not the shooter\'s turn', () => refused(ready(), { player: 2, dir: up, tier: 0, power: 0.5 }))
    it('while the ball is in hand', () => refused(ready({ inHand: true }), { player: 1, dir: up, tier: 0, power: 0.5 }))
    it('with a shot in flight', () => {
      const r = shoot(ready({ live: true }), { player: 1, dir: up, tier: 0, power: 0.5 })
      expect(r.events).toEqual([{ type: 'refused' }])
    })
    it('for an unknown tier', () => refused(ready(), { player: 1, dir: up, tier: 7, power: 0.5 }))
    // Touch is [0.15, 0.5], Power [0.5, 1].
    it('with a power below its tier\'s range', () => refused(ready(), { player: 1, dir: up, tier: 0, power: 0.1 }))
    it('with a power above its tier\'s range', () => refused(ready(), { player: 1, dir: up, tier: 0, power: 0.9 }))
    it('with a Touch power on the Power tier', () => refused(ready(), { player: 1, dir: up, tier: 1, power: 0.3 }))
    it('with Breaker armed and none left', () => refused(emptied(ready(), 1, 'breaker'), { player: 1, dir: up, tier: 0, power: 0.5, breaker: true }))
  })
})
