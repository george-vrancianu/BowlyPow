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
  it('Siege exposes each owner\'s structure count, towers included, and Rounds exposes none', () => {
    const c = { ...defaultConfig, mode: 'siege' as const }
    let s = initialState(1, c)
    expect(hudModel(s, c, view).players[1].structures).toBe(0)
    const wall = (id: number, owner: 1 | 2) => ({ id, hp: 3, kind: 'wall' as const, owner, shape: 'straight' as const, rotation: 0 as const, at: { gx: 2, gy: id } })
    const tower = { id: 3, hp: 1, kind: 'tower' as const, owner: 1 as const, at: { gx: 8, gy: 22 }, power: 'repulsor' as const }
    s = { ...s, objects: [wall(1, 1), tower, wall(2, 2)] }
    const m = hudModel(s, c, view)
    expect([m.players[1].structures, m.players[2].structures]).toEqual([2, 1])
    s = { ...s, objects: s.objects.filter((o) => o.kind !== 'tower') }
    expect(hudModel(s, c, view).players[1].structures).toBe(1)
    expect(hudModel(initialState(1), defaultConfig, view).players[1].structures).toBeNull()
  })
})
