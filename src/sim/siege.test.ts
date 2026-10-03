import { describe, expect, it } from 'vitest'
import { coinFlip, firstBuilder } from './match'
import { opponent } from './possession'
import { defaultConfig, initialState, step, type SimConfig, type SimState } from './step'

const siege: SimConfig = { ...defaultConfig, mode: 'siege' }
const playing = (seed = 1): SimState => {
  const s = initialState(seed, siege)
  return { ...s, match: { ...s.match, builder: null } }
}
const shot = (s: SimState, shooter: 1 | 2, y: number, vy: number): SimState => ({ ...s, ball: { ...s.ball, pos: { x: 20, y }, vel: { x: 0, y: vy } }, possession: { ...s.possession, shooter, inHand: false, live: true } })

describe('Siege', () => {
  it('opens with one build per player in the Rounds order, then never builds again', () => {
    let s = initialState(1, siege)
    const first = firstBuilder(1, 1)
    expect(s.match).toMatchObject({ mode: 'siege', builder: first })
    expect(s.possession).toMatchObject({ shooter: coinFlip(1, 1), inHand: true })
    s = step(s, { done: first }, siege).state
    expect(s.match.builder).toBe(opponent(first))
    expect(s.points[opponent(first)]).toBe(siege.wallPoints)
    s = step(s, { done: opponent(first) }, siege).state
    expect(s.match.builder).toBeNull()
  })

  it('a goal scores nothing and hands the conceder ball-in-hand at the center with a fresh counter', () => {
    const before = shot(playing(), 1, 0.5, -60)
    const r = step({ ...before, possession: { ...before.possession, shots: 1 } }, {}, siege)
    expect(r.events).toContainEqual({ type: 'goal', scorer: 1, at: expect.anything() })
    expect(r.events.some((e) => e.type === 'round-ended')).toBe(false)
    expect(r.state.match).toMatchObject({ mode: 'siege', builder: null, winner: null })
    expect(r.state.possession).toEqual({ shooter: 2, shots: siege.shots, inHand: true, live: false })
    expect(r.state.ball.pos).toEqual({ x: 20, y: 54 })
    expect(r.state.ball.vel).toEqual({ x: 0, y: 0 })
  })

  it('an own goal counts for the opponent', () => {
    const r = step(shot(playing(), 1, 107.5, 60), {}, siege)
    expect(r.events).toContainEqual({ type: 'goal', scorer: 2, at: expect.anything() })
    expect(r.state.possession).toMatchObject({ shooter: 1, inHand: true })
  })

  it('shots never end anything: no shot cap, no round-ended, no build', () => {
    let s = playing()
    for (let i = 0; i < siege.shotCap + 5; i++) {
      s = { ...s, possession: { ...s.possession, shooter: 1, shots: siege.shots, inHand: false, live: false }, ball: { ...s.ball, pos: { x: 20, y: 80 }, vel: { x: 0, y: 0 } } }
      s = step(s, { blast: { player: 1, origin: { x: 20, y: 85 }, power: 0.2 } }, siege).state
      for (let t = 0; t < 2000 && s.possession.live; t++) {
        const r = step(s, {}, siege)
        expect(r.events.some((e) => e.type === 'round-ended')).toBe(false)
        s = r.state
      }
      expect(s.match.builder).toBeNull()
    }
    expect(s.match.winner).toBeNull()
  })
})
