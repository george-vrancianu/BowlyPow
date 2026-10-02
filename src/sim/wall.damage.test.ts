import { describe, expect, it } from 'vitest'
import type { SimState } from './step'
import { place, playState } from './testkit'
import { crackLines, damageWall, type WallSpec } from './wall'

const spec = (shape: WallSpec['shape']): WallSpec => ({ kind: 'wall', owner: 1, shape, rotation: 0, at: { gx: 5, gy: 40 } })
const at = { x: 11, y: 80 }
const placed = (shape: WallSpec['shape'] = 'straight') => place(spec(shape)).state
/** Damages the first object through the shared damage path, as a ball hit or blast would. */
const hit = (s: SimState, id = s.objects[0].id) => {
  const r = damageWall(s.objects, id, at)
  return { state: { ...s, objects: r.objects }, events: r.events }
}

describe('wall damage', () => {
  it('placed walls start with 3 hp', () => {
    expect(placed().objects[0].hp).toBe(3)
  })
  it('goes 3 to 2 to 1 with a cracked event each time, then 0 removes it with destroyed', () => {
    let s = placed()
    const id = s.objects[0].id
    for (const hp of [2, 1]) {
      const r = hit(s)
      s = r.state
      expect(s.objects[0].hp).toBe(hp)
      expect(r.events).toEqual([{ type: 'wall-cracked', id, hp, at }])
    }
    const r = hit(s)
    expect(r.state.objects).toEqual([])
    expect(r.events).toEqual([{ type: 'wall-destroyed', wall: { ...s.objects[0], hp: 0 }, at }])
  })
  it('an L wall shares one pool', () => {
    const s = hit(placed('L')).state
    expect(s.objects).toHaveLength(1)
    expect(s.objects[0].hp).toBe(2)
  })
  it('refunds nothing on destruction', () => {
    let s = placed()
    const before = s.players
    for (let i = 0; i < 3; i++) s = hit(s).state
    expect(s.players).toEqual(before)
  })
  it('ignores damage to an unknown wall', () => {
    const r = hit(placed(), 99)
    expect(r.events).toEqual([])
    expect(r.state.objects[0].hp).toBe(3)
  })
})

describe('crackLines', () => {
  const wall = { ...spec('L'), id: 4, hp: 3 }
  it('draws one crack per lost hp, deterministically, keeping earlier cracks', () => {
    expect(crackLines(wall)).toEqual([])
    const one = crackLines({ ...wall, hp: 2 })
    expect(one).toHaveLength(1)
    expect(crackLines({ ...wall, hp: 2 })).toEqual(one)
    const two = crackLines({ ...wall, hp: 1 })
    expect(two).toHaveLength(2)
    expect(two[0]).toEqual(one[0])
  })
})
