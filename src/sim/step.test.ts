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
    expect(s.objects).toEqual([wall, wall])
  })
})
