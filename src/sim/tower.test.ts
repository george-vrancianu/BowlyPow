import { describe, expect, it } from 'vitest'
import { rules } from '../config/rules'
import { defaultConfig, step, type SimInput, type SimState } from './step'
import { buildState, place, playState } from './testkit'
import { canPlaceBall } from './possession'
import { canPlace, damageWall, isLegal, wallCells, wallSegments, type TowerSpec, type WallSpec } from './wall'

const tower = (gx: number, gy: number, owner: TowerSpec['owner'] = 1): TowerSpec => ({ kind: 'tower', owner, power: 'repulsor', at: { gx, gy } })
const straight = (gx: number, gy: number, rotation: WallSpec['rotation'] = 0): WallSpec => ({ kind: 'wall', owner: 1, shape: 'straight', rotation, at: { gx, gy } })
const run = (s: SimState, input: SimInput) => step(s, input, defaultConfig)

describe('tower shape', () => {
  it('is one cell: four unit edges and a 2x2 square of collision segments', () => {
    expect(wallCells(tower(5, 40))).toHaveLength(4)
    expect(wallSegments(tower(5, 40))).toEqual([
      { a: { x: 10, y: 80 }, b: { x: 12, y: 80 } },
      { a: { x: 12, y: 80 }, b: { x: 12, y: 82 } },
      { a: { x: 12, y: 82 }, b: { x: 10, y: 82 } },
      { a: { x: 10, y: 82 }, b: { x: 10, y: 80 } },
    ])
  })
  it('costs 0 wall points and has configurable hp', () => {
    expect(rules.towerCost).toBe(0)
    expect(rules.towerHp).toBe(3)
  })
})

describe('tower placement', () => {
  it('follows the half rule', () => {
    expect(isLegal(tower(5, 40))).toBe(true)
    expect(isLegal(tower(5, 10))).toBe(false)
    expect(isLegal(tower(5, 10, 2))).toBe(true)
  })
  it('refuses a cell straddling the halfway line', () => {
    expect(isLegal(tower(5, 26))).toBe(false)
    expect(isLegal(tower(5, 27))).toBe(true)
  })
  it('refuses the own no-build zone', () => {
    expect(isLegal(tower(10, 52))).toBe(false)
  })
  it('places through step with rules.towerHp and no point cost, refuses illegal ones', () => {
    const r = run(buildState(1), { placeWall: tower(5, 40) })
    expect(r.state.objects).toMatchObject([{ kind: 'tower', id: 1, hp: rules.towerHp }])
    expect(r.state.points).toEqual(playState().points)
    expect(run(buildState(1), { placeWall: tower(5, 10) }).events).toEqual([{ type: 'refused' }])
  })
})

describe('tower as obstacle', () => {
  // Walls cover gx 0..15 on gy=40; towers fill 16..19 of the 20-cell row, the last one seals the half.
  const base = [0, 4, 8, 12].map((gx) => straight(gx, 40))
  it('counts as an obstacle for a later placement', () => {
    const towers = [16, 17, 18].map((gx) => tower(gx, 40))
    expect(canPlace([...base, ...towers], tower(19, 40))).toBe(false)
    expect(canPlace([...base, ...towers.slice(0, 2)], tower(19, 40))).toBe(true)
  })
})

describe('tower damage', () => {
  it('goes through the wall damage rule and events', () => {
    const at = { x: 11, y: 81 }
    const hit = (s: SimState) => {
      const r = damageWall(s.objects, 1, at)
      return { state: { ...s, objects: r.objects }, events: r.events }
    }
    const s0 = place(tower(5, 40)).state
    const first = hit(s0)
    expect(first.events).toEqual([{ type: 'wall-cracked', id: 1, hp: 2, at }])
    const last = hit(hit(first.state).state)
    expect(last.state.objects).toEqual([])
    expect(last.events).toMatchObject([{ type: 'wall-destroyed', wall: { kind: 'tower', hp: 0 }, at }])
  })
})

describe('tower and ball placement', () => {
  it('the ball cannot be placed inside or on a tower, but can be beside it', () => {
    const objects = [{ ...tower(5, 40), id: 1, hp: rules.towerHp }]
    // Tower square x 10..12, y 80..82; the ball needs its radius plus half a wall of clearance.
    expect(canPlaceBall(1, { x: 11, y: 81 }, objects, defaultConfig)).toBe(false)
    expect(canPlaceBall(1, { x: 10, y: 81 }, objects, defaultConfig)).toBe(false)
    expect(canPlaceBall(1, { x: 14, y: 81 }, objects, defaultConfig)).toBe(true)
  })
})
