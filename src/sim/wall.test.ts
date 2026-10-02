import { describe, expect, it } from 'vitest'
import { canPlace, isLegal, wallCells, wallCost, wallSegments, type WallSpec } from './wall'

const wall = (shape: WallSpec['shape'], rotation: WallSpec['rotation']): WallSpec => ({
  kind: 'wall',
  owner: 1,
  shape,
  rotation,
  at: { gx: 5, gy: 7 },
})
// Direction along a cell is meaningless, so list each edge low end first.
const cells = (w: WallSpec) =>
  wallCells(w)
    .map(({ a, b }) => (a.gx + a.gy < b.gx + b.gy ? [a, b] : [b, a]))
    .map(([a, b]) => `${a.gx},${a.gy}-${b.gx},${b.gy}`)
    .sort()
const run = (...s: string[]) => s.sort()

describe('cost', () => {
  it('is 2 for straight and 3 for L', () => {
    expect(wallCost('straight')).toBe(2)
    expect(wallCost('L')).toBe(3)
  })
})

describe('straight wall cells', () => {
  it.each([
    [0, run('5,7-6,7', '6,7-7,7', '7,7-8,7', '8,7-9,7')],
    [1, run('5,7-5,8', '5,8-5,9', '5,9-5,10', '5,10-5,11')],
    [2, run('1,7-2,7', '2,7-3,7', '3,7-4,7', '4,7-5,7')],
    [3, run('5,3-5,4', '5,4-5,5', '5,5-5,6', '5,6-5,7')],
  ] as const)('rotation %i', (r, expected) => {
    expect(cells(wall('straight', r))).toEqual(expected)
  })
})

describe('L wall cells', () => {
  it.each([
    [0, run('5,7-6,7', '6,7-7,7', '7,7-8,7', '5,7-5,8', '5,8-5,9', '5,9-5,10')],
    [1, run('5,7-5,8', '5,8-5,9', '5,9-5,10', '2,7-3,7', '3,7-4,7', '4,7-5,7')],
    [2, run('2,7-3,7', '3,7-4,7', '4,7-5,7', '5,4-5,5', '5,5-5,6', '5,6-5,7')],
    [3, run('5,4-5,5', '5,5-5,6', '5,6-5,7', '5,7-6,7', '6,7-7,7', '7,7-8,7')],
  ] as const)('rotation %i is 3 + 3 cells meeting at the pivot', (r, expected) => {
    expect(cells(wall('L', r))).toEqual(expected)
  })
})

describe('collision segments', () => {
  it('straight is one segment in world units', () => {
    expect(wallSegments(wall('straight', 0))).toEqual([{ a: { x: 10, y: 14 }, b: { x: 18, y: 14 } }])
  })
  it('L is two segments sharing the pivot', () => {
    expect(wallSegments(wall('L', 1))).toEqual([
      { a: { x: 10, y: 14 }, b: { x: 10, y: 20 } },
      { a: { x: 10, y: 14 }, b: { x: 4, y: 14 } },
    ])
  })
})

describe('isLegal', () => {
  const at = (owner: WallSpec['owner'], shape: WallSpec['shape'], rotation: WallSpec['rotation'], gx: number, gy: number): WallSpec => ({ kind: 'wall', owner, shape, rotation, at: { gx, gy } })
  it('allows a wall on the owner half, and refuses the opponent half', () => {
    expect(isLegal(at(1, 'straight', 0, 2, 40))).toBe(true)
    expect(isLegal(at(2, 'straight', 0, 2, 10))).toBe(true)
    expect(isLegal(at(1, 'straight', 0, 2, 10))).toBe(false)
    expect(isLegal(at(2, 'straight', 0, 2, 40))).toBe(false)
  })
  it('refuses any wall crossing the halfway line (gy 27)', () => {
    expect(isLegal(at(1, 'straight', 1, 2, 25))).toBe(false)
    expect(isLegal(at(2, 'straight', 1, 2, 25))).toBe(false)
  })
  it('refuses a wall lying on the line, allows one touching it from the owner side', () => {
    expect(isLegal(at(1, 'straight', 0, 2, 27))).toBe(false)
    expect(isLegal(at(2, 'straight', 0, 2, 27))).toBe(false)
    expect(isLegal(at(1, 'straight', 1, 2, 27))).toBe(true)
    expect(isLegal(at(2, 'straight', 3, 2, 27))).toBe(true)
  })
  it('refuses a wall inside the own no-build semicircle', () => {
    expect(isLegal(at(2, 'straight', 0, 8, 2))).toBe(false)
    expect(isLegal(at(1, 'straight', 0, 8, 52))).toBe(false)
  })
  it('judges the semicircle edge inclusively at radius 15', () => {
    // Vertical wall on x=20 from y=14 is 14 from the goal centre; from y=16 it is 16.
    expect(isLegal(at(2, 'straight', 1, 10, 7))).toBe(false)
    expect(isLegal(at(2, 'straight', 1, 10, 8))).toBe(true)
    // Vertical on x=6 (dx 14) from y=0 is inside; on x=4 (dx 16) outside.
    expect(isLegal(at(2, 'straight', 1, 3, 0))).toBe(false)
    expect(isLegal(at(2, 'straight', 1, 2, 0))).toBe(true)
    // Horizontal y=14, x 14..22: both ends are outside only via the middle (nearest point (20,14)).
    expect(isLegal(at(2, 'straight', 0, 7, 7))).toBe(false)
    expect(isLegal(at(2, 'straight', 0, 1, 7))).toBe(true)
  })
})

describe('reachability', () => {
  const straight = (gx: number, gy: number, rotation: WallSpec['rotation'] = 0): WallSpec => ({ kind: 'wall', owner: 1, shape: 'straight', rotation, at: { gx, gy } })
  // A line across most of the half at gy=40 and a wall dropping down from its right end.
  const staircase = [0, 4, 8, 12].map((gx) => straight(gx, 40)).concat(straight(16, 40, 1))

  it('accepts a placement on an open pitch', () => {
    expect(canPlace([], straight(0, 40))).toBe(true)
  })
  it('refuses the placement that seals the half from edge to edge', () => {
    const row = [0, 4, 8, 12].map((gx) => straight(gx, 40))
    expect(canPlace(row, straight(16, 40))).toBe(false)
  })
  it('accepts a one-cell gap', () => {
    expect(canPlace(staircase, straight(17, 44))).toBe(true)
  })
  it('refuses a gap that is only diagonal, where two walls meet at a corner', () => {
    expect(canPlace(staircase, straight(16, 44))).toBe(false)
  })
  it('still refuses an illegal placement that would not seal anything', () => {
    expect(canPlace([], { ...straight(0, 10) })).toBe(false)
  })
})
