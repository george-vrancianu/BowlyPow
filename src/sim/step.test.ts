import { describe, expect, it } from 'vitest'
import { defaultConfig, step } from './step'
import { buildState, playState } from './testkit'

describe('step', () => {
  it('returns new state and an events list without mutating the input', () => {
    const s = playState()
    const { state, events } = step(s, {}, defaultConfig)
    expect(events).toEqual([])
    expect(state).not.toBe(s)
    expect(state.tick).toBe(1)
    expect(s.tick).toBe(0)
  })
  it('starts with an empty object container', () => {
    expect(playState().objects).toEqual([])
  })
  it('adds a placed wall to the state, overlapping walls allowed', () => {
    const wall = { kind: 'wall', owner: 2, shape: 'L', rotation: 1, at: { gx: 3, gy: 4 } } as const
    let s = step(buildState(2), { placeWall: wall }, defaultConfig).state
    s = step(s, { placeWall: wall }, defaultConfig).state
    expect(s.objects).toEqual([
      { ...wall, id: 1, hp: 3 },
      { ...wall, id: 2, hp: 3 },
    ])
  })
})

describe('placement and demolition rules', () => {
  it('refuses a placement that seals the owner\'s goal', () => {
    const row = (gx: number) => ({ kind: 'wall', owner: 1, shape: 'straight', rotation: 0, at: { gx, gy: 40 } }) as const
    let s = buildState(1)
    for (const gx of [0, 4, 8, 12]) s = step(s, { placeWall: row(gx) }, defaultConfig).state
    const r = step(s, { placeWall: row(16) }, defaultConfig)
    expect(r.state.objects).toHaveLength(4)
    expect(r.events).toEqual([{ type: 'refused' }])
  })
  const legal = { kind: 'wall', owner: 1, shape: 'straight', rotation: 0, at: { gx: 2, gy: 40 } } as const
  const illegal = { ...legal, at: { gx: 2, gy: 10 } }
  const placed = { ...legal, id: 1, hp: 3 }
  it('places a legal wall and refuses an illegal one', () => {
    expect(step(buildState(1), { placeWall: legal }, defaultConfig).state.objects).toEqual([placed])
    const bad = step(buildState(1), { placeWall: illegal }, defaultConfig)
    expect(bad.state.objects).toEqual([])
    expect(bad.events).toEqual([{ type: 'refused' }])
  })
  it('demolishes own wall for 1 point, no refund', () => {
    const s = { ...buildState(1), objects: [placed] }
    const { state } = step(s, { demolish: { player: 1, wall: 1 } }, defaultConfig)
    expect(state.objects).toEqual([])
    expect(state.credits[1]).toBe(s.credits[1] - 1)
    expect(state.credits[2]).toBe(s.credits[2])
  })
  it('refuses to demolish the opponent wall', () => {
    const s = { ...buildState(1), objects: [placed] }
    const { state, events } = step(s, { demolish: { player: 2, wall: 1 } }, defaultConfig)
    expect(state.objects).toEqual([placed])
    expect(state.credits).toEqual(s.credits)
    expect(events).toEqual([{ type: 'refused' }])
  })
  it('refuses to demolish with no points left, or a missing wall', () => {
    const s = { ...buildState(1), objects: [placed], credits: { 1: 0, 2: 0 } }
    expect(step(s, { demolish: { player: 1, wall: 1 } }, defaultConfig).state.objects).toEqual([placed])
    expect(step(buildState(1), { demolish: { player: 1, wall: 1 } }, defaultConfig).events).toEqual([{ type: 'refused' }])
  })
})
