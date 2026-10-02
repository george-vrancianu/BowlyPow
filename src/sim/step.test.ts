import { describe, expect, it } from 'vitest'
import { defaultConfig, initialState, step } from './step'

describe('step', () => {
  it('returns new state and an events list without mutating the input', () => {
    const s = initialState()
    const { state, events } = step(s, {}, defaultConfig)
    expect(events).toEqual([])
    expect(state).not.toBe(s)
    expect(state.tick).toBe(1)
    expect(s.tick).toBe(0)
  })
  it('starts with an empty object container', () => {
    expect(initialState().objects).toEqual([])
  })
  it('adds a placed wall to the state, overlapping walls allowed', () => {
    const wall = { kind: 'wall', owner: 2, shape: 'L', rotation: 1, at: { gx: 3, gy: 4 } } as const
    let s = step(initialState(), { placeWall: wall }, defaultConfig).state
    s = step(s, { placeWall: wall }, defaultConfig).state
    expect(s.objects).toEqual([
      { ...wall, id: 1, hp: 3 },
      { ...wall, id: 2, hp: 3 },
    ])
  })
})

describe('placement and demolition rules', () => {
  const legal = { kind: 'wall', owner: 1, shape: 'straight', rotation: 0, at: { gx: 2, gy: 40 } } as const
  const illegal = { ...legal, at: { gx: 2, gy: 10 } }
  const placed = { ...legal, id: 1, hp: 3 }
  it('places a legal wall and refuses an illegal one', () => {
    expect(step(initialState(), { placeWall: legal }, defaultConfig).state.objects).toEqual([placed])
    const bad = step(initialState(), { placeWall: illegal }, defaultConfig)
    expect(bad.state.objects).toEqual([])
    expect(bad.events).toEqual([{ type: 'refused' }])
  })
  it('demolishes own wall for 1 point, no refund', () => {
    const s = { ...initialState(), objects: [placed] }
    const { state } = step(s, { demolish: { player: 1, wall: 1 } }, defaultConfig)
    expect(state.objects).toEqual([])
    expect(state.points[1]).toBe(s.points[1] - 1)
    expect(state.points[2]).toBe(s.points[2])
  })
  it('refuses to demolish the opponent wall', () => {
    const s = { ...initialState(), objects: [placed] }
    const { state, events } = step(s, { demolish: { player: 2, wall: 1 } }, defaultConfig)
    expect(state.objects).toEqual([placed])
    expect(state.points).toEqual(s.points)
    expect(events).toEqual([{ type: 'refused' }])
  })
  it('refuses to demolish with no points left, or a missing wall', () => {
    const s = { ...initialState(), objects: [placed], points: { 1: 0, 2: 0 } }
    expect(step(s, { demolish: { player: 1, wall: 1 } }, defaultConfig).state.objects).toEqual([placed])
    expect(step(initialState(), { demolish: { player: 1, wall: 1 } }, defaultConfig).events).toEqual([{ type: 'refused' }])
  })
})
