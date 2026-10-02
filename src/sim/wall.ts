import { CELL_SIZE, type PlayerId, type Point } from './pitch'

/** A grid vertex: world position is (gx, gy) * CELL_SIZE. */
export type Vertex = { gx: number; gy: number }
export type Segment = { a: Point; b: Point }
export type WallShape = 'straight' | 'L'
export type Rotation = 0 | 1 | 2 | 3

/** `at` is the pivot vertex (the corner of an L, the start of a straight); rotation is in quarter turns clockwise on screen. */
export type WallSpec = { kind: 'wall'; owner: PlayerId; shape: WallShape; rotation: Rotation; at: Vertex }
/** A placed wall: one hit point pool (an L shares it) and a stable id assigned by the sim. */
export type Wall = WallSpec & { id: number; hp: number }

export const WALL_HP = 3

/** Each arm is a run of cells from the pivot, in grid units, before rotation. */
const ARMS: Record<WallShape, [number, number][]> = {
  straight: [[4, 0]],
  L: [[3, 0], [0, 3]],
}
const COST: Record<WallShape, number> = { straight: 2, L: 3 }

export const wallCost = (shape: WallShape): number => COST[shape]

function arms({ shape, rotation }: WallSpec): [number, number][] {
  return ARMS[shape].map(([x, y]) => {
    for (let i = 0; i < rotation; i++) [x, y] = [-y, x]
    return [x, y]
  })
}

/** The wall as unit cells (one cell = one grid edge), in grid vertices. */
export function wallCells(w: WallSpec): { a: Vertex; b: Vertex }[] {
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

/** Zero-thickness collision segments in world units, one per arm. */
export function wallSegments(w: WallSpec): Segment[] {
  const a = { x: w.at.gx * CELL_SIZE, y: w.at.gy * CELL_SIZE }
  return arms(w).map(([x, y]) => ({ a, b: { x: a.x + x * CELL_SIZE, y: a.y + y * CELL_SIZE } }))
}

/** One jagged crack per lost hit point, as world-space polylines. Deterministic in (id, hp) so peers draw the same cracks. */
export function crackLines(w: Wall): Point[][] {
  const cells = wallCells(w)
  return Array.from({ length: WALL_HP - w.hp }, (_, k) => {
    // Seeded from id and the hp remaining after this crack, so earlier cracks never move.
    let seed = (w.id * 31 + (WALL_HP - 1 - k)) * 2654435761
    const rnd = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822519) >>> 0) / 2 ** 32)
    const { a, b } = cells[Math.floor(rnd() * cells.length)]
    const [cx, cy] = [((a.gx + b.gx) / 2) * CELL_SIZE, ((a.gy + b.gy) / 2) * CELL_SIZE]
    // Across the wall: perpendicular to the cell's direction.
    const [nx, ny] = [Math.abs(b.gy - a.gy), Math.abs(b.gx - a.gx)]
    const along = (rnd() - 0.5) * CELL_SIZE * 0.6
    return [-0.4, -0.13, 0.13, 0.4].map((t) => {
      const j = (rnd() - 0.5) * 0.5
      return { x: cx + nx * t + ny * (along + j), y: cy + ny * t + nx * (along + j) }
    })
  })
}
