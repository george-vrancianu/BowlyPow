import { describe, expect, it } from 'vitest'
import { blastRadius, canBlastFrom } from './blast'
import { defaultConfig as c, initialState, step, type SimInput, type SimState } from './step'
import { WALL_HP, type Wall } from './wall'

const wall = (id: number, owner: 1 | 2, gy: number): Wall => ({ kind: 'wall', owner, shape: 'straight', rotation: 0, at: { gx: 8, gy }, id, hp: WALL_HP })
const setup = (objects: Wall[] = [], ball = { x: 5, y: 100 }): SimState => ({ ...initialState(), objects, ball: { pos: ball, vel: { x: 0, y: 0 }, rolled: 0 } })
const fire = (s: SimState, blast: SimInput['blast']) => step(s, { blast }, c)
const hpOf = (s: SimState, id: number) => s.objects.find((o) => o.id === id)?.hp

describe('blast radius', () => {
  it('grows linearly from 1 to 5 ball diameters', () => {
    expect(blastRadius(0, c)).toBe(2)
    expect(blastRadius(0.5, c)).toBe(6)
    expect(blastRadius(1, c)).toBe(10)
  })
})

describe('ball push', () => {
  const origin = { x: 20, y: 79.5 }
  const velAt = (y: number) => fire(setup([], { x: 20, y }), { player: 1, origin, power: 1 }).state.ball.vel
  it('pushes the ball away from the centre, weaker further out', () => {
    const near = velAt(77.5)
    const far = velAt(74)
    expect(near.y).toBeLessThan(0)
    expect(near.x).toBeCloseTo(0)
    expect(Math.abs(near.y)).toBeGreaterThan(Math.abs(far.y))
    // d = 5.5 of 10 at full power: 60 * 0.45 = 27, minus one tick of friction.
    expect(Math.abs(far.y)).toBeGreaterThan(26)
    expect(Math.abs(far.y)).toBeLessThan(27)
  })
  it('leaves a ball outside the radius alone but still fires', () => {
    const r = fire(setup(), { player: 1, origin, power: 1 })
    expect(r.state.ball.vel).toEqual({ x: 0, y: 0 })
    expect(r.events).toContainEqual({ type: 'blast-fired', player: 1, origin, power: 1 })
  })
})

describe('structure damage', () => {
  const origin = { x: 20, y: 79.5 }
  const after = (objects: Wall[], player: 1 | 2 = 1, o = origin) => fire(setup(objects), { player, origin: o, power: 1 }).state
  it('enemy loses 1 hp above 0.4 and 2 above 0.8', () => {
    // distances 5.5, 3.5, 1.5 -> pressure 0.45, 0.65, 0.85; 7.5 -> 0.25
    const s = after([wall(1, 2, 37), wall(2, 2, 38), wall(3, 2, 39), wall(4, 2, 36)])
    expect([1, 2, 3, 4].map((id) => hpOf(s, id))).toEqual([2, 2, 1, 3])
  })
  it('own wall loses 1 hp above 0.8 only', () => {
    const s = after([wall(1, 1, 37), wall(2, 1, 38), wall(3, 1, 39)])
    expect([1, 2, 3].map((id) => hpOf(s, id))).toEqual([3, 3, 2])
  })
  it('the halfway line shields nothing', () => {
    const s = after([wall(1, 2, 25), wall(2, 1, 28)], 2, { x: 20, y: 52.5 })
    expect(hpOf(s, 1)).toBe(3)
    expect(hpOf(s, 2)).toBe(2)
  })
  it('a wall at 2 damage dies with a destroyed event', () => {
    const w = { ...wall(1, 2, 39), hp: 2 }
    const r = fire(setup([w]), { player: 1, origin, power: 1 })
    expect(r.state.objects).toEqual([])
    expect(r.events.map((e) => e.type)).toContain('wall-destroyed')
  })
})

describe('origin legality', () => {
  const s = setup([wall(1, 1, 40)], { x: 30, y: 90 })
  it('is allowed on the shooter half in the open', () => expect(canBlastFrom(1, { x: 10, y: 70 }, s, c)).toBe(true))
  it('is refused on the opponent half and on the line', () => {
    expect(canBlastFrom(1, { x: 10, y: 40 }, s, c)).toBe(false)
    expect(canBlastFrom(1, { x: 10, y: 54 }, s, c)).toBe(false)
    expect(canBlastFrom(2, { x: 10, y: 70 }, s, c)).toBe(false)
  })
  it('is refused on a wall or the ball', () => {
    expect(canBlastFrom(1, { x: 20, y: 80.2 }, s, c)).toBe(false)
    expect(canBlastFrom(1, { x: 30.5, y: 90 }, s, c)).toBe(false)
  })
  it('an illegal blast is refused and does not fire', () => {
    const r = fire(s, { player: 1, origin: { x: 10, y: 40 }, power: 1 })
    expect(r.events).toEqual([{ type: 'refused' }])
  })
})
