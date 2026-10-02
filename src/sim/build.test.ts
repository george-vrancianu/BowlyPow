import { describe, expect, it } from 'vitest'
import { coinFlip } from './match'
import { opponent } from './possession'
import { defaultConfig as c, initialState, step, type SimInput, type SimState } from './step'
import { buildState } from './testkit'
import type { TowerSpec, WallSpec } from './wall'

const wall = (owner: 1 | 2, shape: 'straight' | 'L' = 'straight'): WallSpec => ({ kind: 'wall', owner, shape, rotation: 0, at: { gx: 10, gy: owner === 1 ? 40 : 10 } })
const run = (s: SimState, ...inputs: SimInput[]) => inputs.reduce((st, i) => step(st, i, c).state, s)
const loser = opponent(coinFlip(1, 1))

describe('build order', () => {
  it('round 1 starts with the coin-flip loser, who has the configured points', () => {
    const s = initialState()
    expect(s.match.builder).toBe(loser)
    expect(s.points[loser]).toBe(c.wallPoints)
  })
  it('the second builder follows, then play begins', () => {
    let s = run(initialState(), { done: loser })
    expect(s.match.builder).toBe(opponent(loser))
    expect(s.points[opponent(loser)]).toBe(c.wallPoints)
    s = run(s, { done: opponent(loser) })
    expect(s.match.builder).toBeNull()
  })
  it('order alternates each round', () => {
    const base = initialState()
    const goal = { ...base, match: { ...base.match, builder: null }, ball: { pos: { x: 20, y: 0.5 }, vel: { x: 0, y: -60 }, rolled: 0 }, possession: { shooter: 1 as const, shots: 3, inHand: false, live: true } }
    const s = run(goal, {})
    expect(s.match.round).toBe(2)
    expect(s.match.builder).toBe(opponent(loser))
    expect(s.points[opponent(loser)]).toBe(c.wallPoints)
  })
  it('unspent points are lost: the next build starts from the full budget', () => {
    const s = run(initialState(), { placeWall: wall(loser) }, { done: loser })
    expect(s.points[loser]).toBe(c.wallPoints - 2)
    const next = run({ ...s, match: { ...s.match, builder: null, round: 1 } }, {})
    expect(next.points[loser]).toBe(c.wallPoints - 2)
    const again = run({ ...next, match: { ...next.match, builder: opponent(loser), round: 2 } }, { done: opponent(loser) })
    expect(again.match.builder).toBe(loser)
    expect(again.points[loser]).toBe(c.wallPoints)
  })
})

describe('build actions', () => {
  it('Done with nothing placed just ends the turn', () => {
    const r = step(initialState(), { done: loser }, c)
    expect(r.events).toEqual([])
    expect(r.state.objects).toEqual([])
  })
  it('Done from the player who is not building is refused', () => {
    expect(step(initialState(), { done: opponent(loser) }, c).events).toEqual([{ type: 'refused' }])
  })
  it('placement costs points; a shape that does not fit the budget is refused', () => {
    let s = run(initialState(), { placeWall: wall(loser, 'L') })
    expect(s.points[loser]).toBe(c.wallPoints - 3)
    s = { ...s, points: { ...s.points, [loser]: 1 } }
    const r = step(s, { placeWall: wall(loser) }, c)
    expect(r.events).toEqual([{ type: 'refused' }])
    expect(r.state.points[loser]).toBe(1)
  })
  it('only the builder may place or demolish', () => {
    const other = opponent(loser)
    expect(step(initialState(), { placeWall: wall(other) }, c).events).toEqual([{ type: 'refused' }])
    const s = run(initialState(), { placeWall: wall(loser) })
    expect(step({ ...s, match: { ...s.match, builder: other } }, { demolish: { player: loser, wall: 1 } }, c).events).toEqual([{ type: 'refused' }])
  })
  it('no placing once the play phase has begun, and the clock waits for it', () => {
    const play = run(initialState(), { done: loser }, { done: opponent(loser) })
    expect(step(play, { placeWall: wall(loser) }, c).events).toEqual([{ type: 'refused' }])
    expect(run(initialState(), {}).clock.left).toBe(c.shotClock * c.tickHz)
  })
})

describe('pitch bounds', () => {
  const placed = (spec: WallSpec | TowerSpec) => step(buildState(1), { placeWall: spec }, c).events.every((e) => e.type !== 'refused')
  it('refuses a wall or tower with any cell outside the pitch', () => {
    expect(placed({ kind: 'wall', owner: 1, shape: 'straight', rotation: 0, at: { gx: 19, gy: 40 } })).toBe(false)
    expect(placed({ kind: 'wall', owner: 1, shape: 'straight', rotation: 2, at: { gx: 1, gy: 40 } })).toBe(false)
    expect(placed({ kind: 'wall', owner: 1, shape: 'L', rotation: 1, at: { gx: 2, gy: 40 } })).toBe(false)
    expect(placed({ kind: 'tower', owner: 1, at: { gx: 20, gy: 40 } })).toBe(false)
  })
  it('accepts a wall flush against the boards', () => {
    expect(placed({ kind: 'wall', owner: 1, shape: 'straight', rotation: 0, at: { gx: 16, gy: 40 } })).toBe(true)
    expect(placed({ kind: 'wall', owner: 1, shape: 'straight', rotation: 2, at: { gx: 4, gy: 40 } })).toBe(true)
  })
})
