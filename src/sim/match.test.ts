import { describe, expect, it } from 'vitest'
import { coinFlip } from './match'
import { defaultConfig as c, step, type SimState } from './step'
import { playState } from './testkit'

const mid = { x: 20, y: 54 }
const shotAt = (y: number, vy: number, over: Partial<SimState> = {}): SimState => ({
  ...playState(),
  ball: { pos: { x: 20, y }, vel: { x: 0, y: vy }, rolled: 0 },
  possession: { shooter: 1, shots: 3, inHand: false, live: true },
  ...over,
})
const matchAt = (round: number, score: { 1: number; 2: number }, roundShots = 0) => ({ ...playState().match, round, score, roundShots })

describe('goals', () => {
  it('credits the shooter when the ball centre crosses the opponent goal line', () => {
    const r = step(shotAt(0.5, -60), {}, c)
    expect(r.state.match.score).toEqual({ 1: 1, 2: 0 })
    expect(r.events).toContainEqual({ type: 'goal', scorer: 1, at: expect.any(Object) })
  })
  it('credits the opponent for an own goal', () => {
    const r = step(shotAt(107.5, 60), {}, c)
    expect(r.state.match.score).toEqual({ 1: 0, 2: 1 })
    expect(r.events).toContainEqual(expect.objectContaining({ type: 'goal', scorer: 2 }))
  })
  it('does not score outside the goal mouth', () => {
    const r = step(shotAt(0.5, -60, { ball: { pos: { x: 3, y: 2 }, vel: { x: 0, y: -60 }, rolled: 0 } }), {}, c)
    expect(r.state.match.score).toEqual({ 1: 0, 2: 0 })
  })
  it('hands the conceder ball-in-hand, a fresh counter and the next round', () => {
    const r = step(shotAt(0.5, -60), {}, c)
    expect(r.state.match.round).toBe(2)
    expect(r.state.possession).toEqual({ shooter: 2, shots: 3, inHand: true, live: false })
    expect(r.state.ball.pos).toEqual(mid)
    expect(r.state.ball.vel).toEqual({ x: 0, y: 0 })
    expect(r.events).toContainEqual({ type: 'round-ended', round: 1, scorer: 1 })
  })
})

describe('shot cap', () => {
  const resting = (round: number, shots: number) => shotAt(80, 0, { match: matchAt(round, { 1: 0, 2: 0 }, shots) })
  it('counts every blast', () => {
    const s = shotAt(80, 0, { match: matchAt(1, { 1: 0, 2: 0 }, 4), possession: { shooter: 1, shots: 3, inHand: false, live: false } })
    expect(step(s, { blast: { player: 1, origin: { x: 5, y: 90 }, power: 0.1 } }, c).state.match.roundShots).toBe(5)
  })
  it('ends a scoreless round once the 30th shot has come to rest', () => {
    const r = step(resting(1, 30), {}, c)
    expect(r.state.match).toMatchObject({ round: 2, score: { 1: 0, 2: 0 }, roundShots: 0 })
    expect(r.state.possession).toMatchObject({ shooter: coinFlip(1, 2), inHand: true, live: false })
    expect(r.events).toContainEqual({ type: 'round-ended', round: 1, scorer: null })
  })
  it('does not end the round before the 30th shot', () => {
    expect(step(resting(1, 29), {}, c).state.match.round).toBe(1)
  })
  it('has no cap in sudden death', () => {
    expect(step(resting(6, 30), {}, c).state.match.round).toBe(6)
  })
})

describe('coin flip', () => {
  it('is deterministic per seed and round, and varies', () => {
    expect(coinFlip(7, 3)).toBe(coinFlip(7, 3))
    expect(new Set(Array.from({ length: 20 }, (_, i) => coinFlip(i, 1)))).toEqual(new Set([1, 2]))
  })
  it('decides round 1 ball-in-hand from the seed', () => {
    expect(playState(5).possession).toMatchObject({ shooter: coinFlip(5, 1), inHand: true })
  })
})

describe('match end', () => {
  it('goes on through the configured rounds', () => {
    expect(step(shotAt(0.5, -60, { match: matchAt(4, { 1: 0, 2: 0 }) }), {}, c).state.match.winner).toBeNull()
  })
  it('the leader wins after the last round', () => {
    const r = step(shotAt(0.5, -60, { match: matchAt(5, { 1: 2, 2: 2 }) }), {}, c)
    expect(r.state.match.winner).toBe(1)
    expect(r.events).toContainEqual({ type: 'match-ended', winner: 1 })
  })
  it('a tie after the last round goes to sudden death', () => {
    const r = step(shotAt(0.5, -60, { match: matchAt(5, { 1: 1, 2: 2 }) }), {}, c)
    expect(r.state.match).toMatchObject({ score: { 1: 2, 2: 2 }, round: 6, winner: null })
  })
  it('sudden death ends on the first goal', () => {
    expect(step(shotAt(107.5, 60, { match: matchAt(6, { 1: 2, 2: 2 }) }), {}, c).state.match.winner).toBe(2)
  })
  it('a scoreless last round with a leader ends the match', () => {
    expect(step(shotAt(80, 0, { match: matchAt(5, { 1: 1, 2: 0 }, 30) }), {}, c).state.match.winner).toBe(1)
  })
  it('a finished match no longer steps', () => {
    const s = shotAt(0.5, -60, { match: { ...matchAt(5, { 1: 2, 2: 0 }), winner: 1 } })
    expect(step(s, {}, c).state).toBe(s)
  })
})
