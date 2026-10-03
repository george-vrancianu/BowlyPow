import { describe, expect, it } from 'vitest'
import { defaultConfig as c, step } from './step'
import { playState } from './testkit'

describe('mode dispatch', () => {
  it('step ends the match through the mode winner and emits match-ended once', () => {
    const s = playState()
    const ended = { ...s, match: { ...s.match, round: c.rounds, score: { 1: 2, 2: 0 } as Record<1 | 2, number> }, ball: { ...s.ball, pos: { x: 20, y: 0.5 }, vel: { x: 0, y: -60 } }, possession: { ...s.possession, shooter: 1 as const, inHand: false, live: true } }
    const r = step(ended, {}, c)
    expect(r.events.filter((e) => e.type === 'match-ended')).toEqual([{ type: 'match-ended', winner: 1 }])
    expect(r.state.match).toMatchObject({ winner: 1, builder: null })
  })
})
