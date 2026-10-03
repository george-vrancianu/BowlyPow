import { describe, expect, it } from 'vitest'
import { firstBuilder } from './match'
import { modeFor, rounds } from './mode'
import { opponent } from './possession'
import { defaultConfig as c, initialState, step } from './step'
import { playState } from './testkit'

const ctx = (s = playState()) => ({ objects: s.objects, possession: s.possession })

describe('Rounds hooks', () => {
  it('opens each build turn with the configured wall points and nothing built yet', () => {
    const s = playState()
    expect(rounds.onBuildStart(s.match as never, ctx(s), { ...c, wallPoints: 7 })).toEqual({ points: 7, built: [] })
  })
  it('the first builder hands over to the other, whose Done starts play', () => {
    const s = initialState(1, c)
    const first = firstBuilder(1, 1)
    const r = rounds.onBuildDone(s.match as never, first, ctx(s), c)
    expect(r?.match.builder).toBe(opponent(first))
    expect(rounds.onBuildDone(r!.match, opponent(first), ctx(s), c)?.match.builder).toBeNull()
  })
  it('reads a winner off the state: a leader after the last round, nobody on a tie', () => {
    const m = { ...playState().match, round: c.rounds + 1 }
    expect(rounds.winner({ ...m, score: { 1: 3, 2: 2 } }, ctx(), c)).toBe(1)
    expect(rounds.winner({ ...m, score: { 1: 2, 2: 2 } }, ctx(), c)).toBeNull()
  })
})

describe('mode dispatch', () => {
  it('step picks the mode from the match it is stepping', () => {
    expect(modeFor(playState().match)).toBe(rounds)
  })
  it('step ends the match through the mode winner and emits match-ended once', () => {
    const s = playState()
    const ended = { ...s, match: { ...s.match, round: c.rounds, score: { 1: 2, 2: 0 } as Record<1 | 2, number> }, ball: { ...s.ball, pos: { x: 20, y: 0.5 }, vel: { x: 0, y: -60 } }, possession: { ...s.possession, shooter: 1 as const, inHand: false, live: true } }
    const r = step(ended, {}, c)
    expect(r.events.filter((e) => e.type === 'match-ended')).toEqual([{ type: 'match-ended', winner: 1 }])
    expect(r.state.match).toMatchObject({ winner: 1, builder: null })
  })
})
