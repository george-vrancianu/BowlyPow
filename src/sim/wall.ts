import { CELL_SIZE, halfOf, inNoBuildZone, PITCH_HEIGHT, PITCH_WIDTH, type PlayerId, type Point } from './pitch'

/** A grid vertex: world position is (gx, gy) * CELL_SIZE. */
export type Vertex = { gx: number; gy: number }
export type Segment = { a: Point; b: Point }
export type WallShape = 'straight' | 'L'
export type Rotation = 0 | 1 | 2 | 3

/** `at` is the pivot vertex (the corner of an L, the start of a straight); rotation is in quarter turns clockwise on screen. */
export type Wall = { kind: 'wall'; owner: PlayerId; shape: WallShape; rotation: Rotation; at: Vertex }

/** Each arm is a run of cells from the pivot, in grid units, before rotation. */
const ARMS: Record<WallShape, [number, number][]> = {
  straight: [[4, 0]],
  L: [[3, 0], [0, 3]],
}
const COST: Record<WallShape, number> = { straight: 2, L: 3 }

export const wallCost = (shape: WallShape): number => COST[shape]

function arms({ shape, rotation }: Wall): [number, number][] {
  return ARMS[shape].map(([x, y]) => {
    for (let i = 0; i < rotation; i++) [x, y] = [-y, x]
    return [x, y]
  })
}

/** The wall as unit cells (one cell = one grid edge), in grid vertices. */
export function wallCells(w: Wall): { a: Vertex; b: Vertex }[] {
  const { gx, gy } = w.at
  return arms(w).flatMap(([x, y]) => {
    const n = Math.abs(x + y)
    const [dx, dy] = [Math.sign(x), Math.sign(y)]
    return Array.from({ length: n }, (_, i) => ({
      a: { gx: gx + dx * i, gy: gy + dy * i },
      b: { gx: gx + dx * (i + 1), gy: gy + dy * (i + 1) },
    }))
  })
}

/** Legal when every cell lies on the owner's half (a cell on the halfway line belongs to neither) and outside the owner's no-build zone. */
export function isLegal(w: Wall): boolean {
  const goalY = w.owner === 2 ? 0 : PITCH_HEIGHT
  return wallCells(w).every(({ a, b }) => {
    const [x0, x1] = [a.gx, b.gx].map((g) => g * CELL_SIZE).sort((p, q) => p - q)
    const [y0, y1] = [a.gy, b.gy].map((g) => g * CELL_SIZE).sort((p, q) => p - q)
    const nearestToGoal = { x: Math.min(Math.max(PITCH_WIDTH / 2, x0), x1), y: Math.min(Math.max(goalY, y0), y1) }
    return halfOf((y0 + y1) / 2) === w.owner && !inNoBuildZone(nearestToGoal)
  })
}

/** Zero-thickness collision segments in world units, one per arm. */
export function wallSegments(w: Wall): Segment[] {
  const a = { x: w.at.gx * CELL_SIZE, y: w.at.gy * CELL_SIZE }
  return arms(w).map(([x, y]) => ({ a, b: { x: a.x + x * CELL_SIZE, y: a.y + y * CELL_SIZE } }))
}
