import { describe, expect, it } from 'vitest'
import { defaultConfig, initialState } from '../sim/step'
import { hudModel } from './model'

const view = { active: 1 as const, armed: false, tappable: false }

describe('hudModel', () => {
  it('Rounds shows the score digit and the round label', () => {
    const m = hudModel(initialState(1), defaultConfig, view)
    expect(m.players[1].score).toBe(0)
    expect(m.round).toBe(1)
  })
  it('Siege shows no score digit and no round label', () => {
    const c = { ...defaultConfig, mode: 'siege' as const }
    const m = hudModel(initialState(1, c), c, view)
    expect(m.players[1].score).toBeNull()
    expect(m.players[2].score).toBeNull()
    expect(m.round).toBeNull()
  })
})
