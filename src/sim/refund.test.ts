import { describe, expect, it } from 'vitest'
import { opponent } from './possession'
import { defaultConfig as c, step } from './step'
import { playState, roundsMatch } from './testkit'
import type { SimState } from './step'

/** Play with the ball placed: the shooter may shoot (or refund). */
const ready = (): SimState => {
  const s = playState()
  return { ...s, possession: { ...s.possession, inHand: false } }
}

describe('refund', () => {
  it('trades the shooter\'s unspent Move points for Credits at the refund rate', () => {
    const s = ready()
    const p = s.possession.shooter
    const r = step(s, { refund: { player: p, count: 2 } }, c)
    expect(r.state.possession.shots).toBe(1)
    expect(r.state.credits[p]).toBe(s.credits[p] + 4)
    expect(r.state.possession.shooter).toBe(p)
    expect(r.events).toContainEqual({ type: 'refunded', player: p, count: 2 })
  })
  it('refunding the last Move point hands the opponent ball-in-hand with a fresh counter', () => {
    const s = ready()
    const p = s.possession.shooter
    const r = step(s, { refund: { player: p, count: 3 } }, c)
    expect(r.state.possession).toEqual({ shooter: opponent(p), shots: c.shots, inHand: true, live: false })
    expect(r.events).toContainEqual({ type: 'possession-changed', shooter: opponent(p), inHand: true })
    expect(r.state.credits[p]).toBe(s.credits[p] + 6)
    expect(r.state.clock).toEqual({ left: c.shotClock * c.tickHz, expiries: 0 })
  })
  it('works in sudden death', () => {
    const s = ready()
    const p = s.possession.shooter
    const tied = { ...s, match: { ...roundsMatch(s), round: c.rounds + 1, score: { 1: 2, 2: 2 } } }
    const r = step(tied, { refund: { player: p, count: 1 } }, c)
    expect(r.state.credits[p]).toBe(s.credits[p] + 2)
  })
  it('never counts toward the round\'s shot cap', () => {
    const s = ready()
    const r = step(s, { refund: { player: s.possession.shooter, count: 3 } }, c)
    expect(roundsMatch(r.state).roundShots).toBe(roundsMatch(s).roundShots)
  })

  const base = ready()
  const shooter = base.possession.shooter
  const refusals: [string, SimState, { player: 1 | 2; count: number }][] = [
    ['from anyone but the shooter', base, { player: opponent(shooter), count: 1 }],
    ['with a shot in flight', { ...base, possession: { ...base.possession, live: true }, ball: { ...base.ball, vel: { x: 0, y: -30 } } }, { player: shooter, count: 1 }],
    ['during ball-in-hand placement', { ...base, possession: { ...base.possession, inHand: true } }, { player: shooter, count: 1 }],
    ['during a build turn', { ...base, match: { ...base.match, builder: shooter } }, { player: shooter, count: 1 }],
    ['while a defence choice is owed', { ...base, match: { ...base.match, choosing: opponent(shooter) } }, { player: shooter, count: 1 }],
    ['for more Move points than are left', base, { player: shooter, count: 4 }],
    ['for none', base, { player: shooter, count: 0 }],
    ['for a fraction of a Move point', base, { player: shooter, count: 1.5 }],
    ['in Siege', { ...base, match: { mode: 'siege', seed: 1, winner: null, builder: null, choosing: null, opening: false } }, { player: shooter, count: 1 }],
  ]
  it.each(refusals)('is refused %s', (_, s, refund) => {
    const r = step(s, { refund }, c)
    expect(r.events).toContainEqual({ type: 'refused' })
    expect(r.state.credits).toEqual(s.credits)
    expect(r.state.possession.shots).toBe(s.possession.shots)
  })
})
