import { describe, expect, it } from 'vitest'
import { configFrom, defaultSettings, SLIDERS, slidersFor } from './settings'
import { defaultConfig, initialState } from './step'

describe('settings', () => {
  it('defaults to Siege with the slider defaults', () => {
    expect(defaultSettings).toEqual({ mode: 'siege', shots: 3, rounds: 5, wallPoints: 10, expiry: 'fire' })
    expect(configFrom(defaultSettings)).toEqual({ ...defaultConfig, mode: 'siege' })
  })

  it('on time out defaults to Shoot and the choice reaches the sim', () => {
    expect(configFrom(defaultSettings).expiry).toBe('fire')
    expect(configFrom({ ...defaultSettings, expiry: 'burn' }).expiry).toBe('burn')
  })

  it('Rounds settings reproduce the default config', () => {
    expect(configFrom({ ...defaultSettings, mode: 'rounds' })).toEqual(defaultConfig)
  })

  it('shows the rounds slider only in Rounds', () => {
    expect(slidersFor('rounds')).toEqual(['shots', 'rounds', 'wallPoints'])
    expect(slidersFor('siege')).toEqual(['shots', 'wallPoints'])
  })

  it('chosen values reach the sim', () => {
    const config = configFrom({ ...defaultSettings, mode: 'rounds', shots: 5, rounds: 3, wallPoints: 7 })
    const s = initialState(1, config)
    expect(s.possession.shots).toBe(5)
    expect(s.points).toEqual({ 1: 7, 2: 7 })
    expect(config.rounds).toBe(3)
  })

  it('a chosen mode reaches the sim', () => {
    expect(initialState(1, configFrom({ ...defaultSettings, mode: 'siege' })).match.mode).toBe('siege')
  })

  it('values are clamped to the slider range', () => {
    expect(configFrom({ ...defaultSettings, mode: 'rounds', shots: 99, rounds: 0, wallPoints: 10 })).toMatchObject({ shots: SLIDERS.shots.max, rounds: SLIDERS.rounds.min })
  })
})
