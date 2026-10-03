import { describe, expect, it } from 'vitest'
import { coinFlip, firstBuilder } from './match'
import { opponent } from './possession'
import { defaultConfig, initialState, step, type SimConfig, type SimEvent, type SimState } from './step'
import type { PlayerId } from './pitch'
import type { Structure } from './wall'

const siege: SimConfig = { ...defaultConfig, mode: 'siege' }
const wall = (id: number, owner: PlayerId, hp = 3, gy = owner === 1 ? 40 : 26): Structure => ({ id, kind: 'wall', owner, shape: 'straight', rotation: 0, at: { gx: 5, gy }, hp })
const steal = (id: number, owner: PlayerId): Structure => ({ id, kind: 'tower', owner, power: 'steal', at: { gx: 10, gy: 40 }, hp: 1 })
/** Play phase with `objects` on the pitch (default: one wall each, so nobody is wiped out). */
const playing = (seed = 1, objects: Structure[] = [wall(1, 1), wall(2, 2)]): SimState => {
  const s = initialState(seed, siege)
  return { ...s, objects, match: { ...s.match, builder: null } }
}
/** `s` with `shooter` holding a ball at rest at `pos`, ready to blast. */
const ready = (s: SimState, shooter: PlayerId, pos: { x: number; y: number }): SimState => ({ ...s, ball: { ...s.ball, pos, vel: { x: 0, y: 0 } }, possession: { shooter, shots: 2, inHand: false, live: false } })
/** Steps until the ball rests, returning the events of every tick. */
const settle = (s: SimState) => {
  const events: SimEvent[][] = []
  for (let t = 0; t < 3000 && (s.possession.live || t === 0); t++) {
    const r = step(s, {}, siege)
    s = r.state
    events.push(r.events)
  }
  return { s, events }
}
const ended = (events: SimEvent[][]) => events.flat().filter((e) => e.type === 'match-ended')
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

describe('Siege wipe-out', () => {
  it('destroying the opponent\'s last structure ends the match for the shooter once the ball rests', () => {
    const s = ready(playing(1, [wall(1, 1), wall(2, 2, 1)]), 1, { x: 30, y: 90 })
    const r = step(s, { blast: { player: 1, origin: { x: 11, y: 56 }, power: 1 } }, siege)
    expect(r.events.some((e) => e.type === 'wall-destroyed')).toBe(true)
    expect(r.events).toContainEqual({ type: 'match-ended', winner: 1 })
    expect(r.state.match.winner).toBe(1)
  })

  it('destroying your own last structure with your blast loses the match', () => {
    const s = ready(playing(1, [wall(1, 1, 1), wall(2, 2)]), 1, { x: 30, y: 90 })
    const r = step(s, { blast: { player: 1, origin: { x: 14, y: 81.5 }, power: 1 } }, siege)
    expect(r.events.some((e) => e.type === 'wall-destroyed')).toBe(true)
    expect(r.state.match.winner).toBe(2)
  })

  it('both players at zero on the same shot: the shooter loses', () => {
    const s = playing(1, [wall(1, 1, 1, 28), wall(2, 2, 1)])
    const r = step(ready(s, 1, { x: 30, y: 90 }), { blast: { player: 1, origin: { x: 14, y: 57.5 }, power: 1 } }, siege)
    expect(r.state.objects).toHaveLength(0)
    expect(r.state.match.winner).toBe(2)
    const t = playing(1, [wall(1, 1, 1, 28), wall(2, 2, 1)])
    const q = step(ready(t, 2, { x: 30, y: 20 }), { blast: { player: 2, origin: { x: 14, y: 50.5 }, power: 1 } }, siege)
    expect(q.state.objects).toHaveLength(0)
    expect(q.state.match.winner).toBe(1)
  })

  it('a Steal tower that triggers as its owner\'s last structure ends the match against its owner', () => {
    const s = playing(1, [steal(1, 1), wall(2, 2)])
    const r = settle({ ...s, ball: { ...s.ball, pos: { x: 15, y: 81 }, vel: { x: 30, y: 0 } }, possession: { shooter: 2, shots: 2, inHand: false, live: true } })
    expect(r.s.objects.map((o) => o.id)).toEqual([2])
    expect(ended(r.events)).toEqual([{ type: 'match-ended', winner: 2 }])
  })

  it('does not end while the ball is still moving, even with a count at zero', () => {
    const s = playing(1, [wall(2, 2)])
    const r = settle({ ...s, ball: { ...s.ball, pos: { x: 20, y: 80 }, vel: { x: 5, y: 0 } }, possession: { shooter: 1, shots: 2, inHand: false, live: true } })
    const last = r.events.length - 1
    expect(r.events.length).toBeGreaterThan(2)
    expect(r.events.slice(0, last).flat().some((e) => e.type === 'match-ended')).toBe(false)
    expect(r.events[last]).toContainEqual({ type: 'match-ended', winner: 2 })
  })

  it('a goal on the shot that wipes a player out still ends the match on the wipe-out rule', () => {
    // Player 1 scores but owns nothing; player 2 still has a wall.
    const r = step(shot(playing(1, [wall(2, 2)]), 1, 0.5, -60), {}, siege)
    expect(r.events).toContainEqual({ type: 'goal', scorer: 1, at: expect.anything() })
    expect(r.events).toContainEqual({ type: 'match-ended', winner: 2 })
  })

  it('ignores further input once the match has ended', () => {
    const over = step(shot(playing(1, [wall(2, 2)]), 1, 0.5, -60), {}, siege).state
    const r = step(over, { blast: { player: 1, origin: { x: 11, y: 90 }, power: 1 }, done: 1 }, siege)
    expect(r.state).toBe(over)
    expect(r.events).toEqual([])
  })
})
