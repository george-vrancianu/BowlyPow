import { describe, expect, it } from 'vitest'
import { defaultConfig, initialState, step, type SimState } from '../sim/step'
import { hudModel } from './model'

const view = { active: 1 as const, viewer: 1 as const, armed: false, tappable: false }

describe('hudModel', () => {
  it('Rounds shows the score digit and the round label', () => {
    const m = hudModel(initialState(1), defaultConfig, view)
    expect(m.players[1].digit).toBe('0')
    expect(m.round).toBe(1)
  })
  it('Siege shows no round label', () => {
    const c = { ...defaultConfig, mode: 'siege' as const }
    const m = hudModel(initialState(1, c), c, view)
    expect(m.round).toBeNull()
  })
  describe('blind opening build', () => {
    const c = { ...defaultConfig, mode: 'siege' as const }
    const wall = (id: number, owner: 1 | 2) => ({ id, hp: 3, kind: 'wall' as const, owner, shape: 'straight' as const, rotation: 0 as const, at: { gx: 2, gy: id } })
    const built = (): SimState => ({ ...initialState(1, c), objects: [wall(1, 1), wall(2, 1), wall(3, 2)] })
    it('shows "?" for the opponent of the viewer while a build is on, and the viewer\'s own count', () => {
      const s = built()
      expect(s.match.builder).not.toBeNull()
      const m1 = hudModel(s, c, { ...view, viewer: 1 })
      expect([m1.players[1].digit, m1.players[2].digit]).toEqual(['2', '?'])
      const m2 = hudModel(s, c, { ...view, viewer: 2 })
      expect([m2.players[1].digit, m2.players[2].digit]).toEqual(['?', '1'])
    })
    it('is decided by the viewer, not by whose strip is shown', () => {
      const m = hudModel(built(), c, { ...view, active: 2, viewer: 1 })
      expect([m.players[1].digit, m.players[2].digit]).toEqual(['2', '?'])
    })
    it('shows the number once play starts', () => {
      const s = { ...built(), match: { ...built().match, builder: null } }
      const m = hudModel(s, c, view)
      expect([m.players[1].digit, m.players[2].digit]).toEqual(['2', '1'])
    })
    it('Rounds build phases keep showing the score', () => {
      const s = initialState(1)
      expect(s.match.builder).not.toBeNull()
      const m = hudModel(s, defaultConfig, view)
      expect([m.players[1].digit, m.players[2].digit]).toEqual(['0', '0'])
    })
  })
  it('Siege exposes each owner\'s structure count, towers included', () => {
    const c = { ...defaultConfig, mode: 'siege' as const }
    let s = initialState(1, c)
    expect(hudModel(s, c, view).players[1].digit).toBe('0')
    const wall = (id: number, owner: 1 | 2) => ({ id, hp: 3, kind: 'wall' as const, owner, shape: 'straight' as const, rotation: 0 as const, at: { gx: 2, gy: id } })
    const tower = { id: 3, hp: 1, kind: 'tower' as const, owner: 1 as const, at: { gx: 8, gy: 22 }, power: 'repulsor' as const }
    s = { ...s, objects: [wall(1, 1), tower, wall(2, 2)], match: { ...s.match, builder: null } }
    const m = hudModel(s, c, view)
    expect([m.players[1].digit, m.players[2].digit]).toEqual(['2', '1'])
    s = { ...s, objects: s.objects.filter((o) => o.kind !== 'tower') }
    expect(hudModel(s, c, view).players[1].digit).toBe('1')
    expect(hudModel(initialState(1), defaultConfig, view).players[1].digit).toBe('0')
  })
  it('Siege count falls when the opponent\'s ball triggers a Steal tower', () => {
    const c = { ...defaultConfig, mode: 'siege' as const }
    const s0 = initialState(1, c)
    const tower = { id: 1, hp: 1, kind: 'tower' as const, owner: 1 as const, power: 'steal' as const, at: { gx: 10, gy: 40 } }
    // The tower spans x 20..22, y 80..82; P2's ball rolls in from the left.
    let s: SimState = { ...s0, nextId: 2, objects: [tower], match: { ...s0.match, builder: null }, ball: { ...s0.ball, pos: { x: 15, y: 81 }, vel: { x: 30, y: 0 } }, possession: { shooter: 2 as const, shots: 2, inHand: false, live: true } }
    expect(hudModel(s, c, view).players[1].digit).toBe('1')
    for (let i = 0; i < 30; i++) s = step(s, {}, c).state
    expect(hudModel(s, c, view).players[1].digit).toBe('0')
  })
})
