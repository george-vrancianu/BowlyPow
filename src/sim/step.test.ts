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
})
