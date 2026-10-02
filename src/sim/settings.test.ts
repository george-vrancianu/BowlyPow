import { describe, expect, it } from 'vitest'
import { configFrom, SLIDERS } from './settings'
import { defaultConfig, initialState } from './step'

describe('settings', () => {
  it('slider defaults reproduce the default config', () => {
    const defaults = { shots: SLIDERS.shots.def, rounds: SLIDERS.rounds.def, wallPoints: SLIDERS.wallPoints.def }
    expect(configFrom(defaults)).toEqual(defaultConfig)
    expect(defaults).toEqual({ shots: 3, rounds: 5, wallPoints: 10 })
  })

  it('chosen values reach the sim', () => {
    const config = configFrom({ shots: 5, rounds: 3, wallPoints: 7 })
    const s = initialState(1, config)
    expect(s.possession.shots).toBe(5)
    expect(s.points).toEqual({ 1: 7, 2: 7 })
    expect(config.rounds).toBe(3)
  })

  it('values are clamped to the slider range', () => {
    expect(configFrom({ shots: 99, rounds: 0, wallPoints: 10 })).toMatchObject({ shots: SLIDERS.shots.max, rounds: SLIDERS.rounds.min })
  })
})
