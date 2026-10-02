import { describe, expect, it } from 'vitest'
import { isLegal, wallCells,wallCost, wallSegments, type Wall } from './wall'

const wall = (shape: Wall['shape'], rotation: Wall['rotation']): Wall => ({
  kind: 'wall',
  owner: 1,
  shape,
  rotation,
  at: { gx: 5, gy: 7 },
})
// Direction along a cell is meaningless, so list each edge low end first.
const cells = (w: Wall) =>
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
  const at = (owner: Wall['owner'], shape: Wall['shape'], rotation: Wall['rotation'], gx: number, gy: number): Wall => ({ kind: 'wall', owner, shape, rotation, at: { gx, gy } })
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
