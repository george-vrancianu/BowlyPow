import { describe, expect, it } from 'vitest'
import { wallCells, wallCost, wallSegments, type Wall } from './wall'

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
