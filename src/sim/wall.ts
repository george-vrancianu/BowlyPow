import { CELL_SIZE, cellToWorld, GOAL_LEFT, GOAL_RIGHT, halfOf, inNoBuildZone, PITCH_HEIGHT, PITCH_WIDTH, type PlayerId, type Point } from './pitch'
import type { SimEvent } from './step'

/** A grid vertex: world position is (gx, gy) * CELL_SIZE. */
export type Vertex = { gx: number; gy: number }
export type Segment = { a: Point; b: Point }
export type WallShape = 'straight' | 'L'
export type Rotation = 0 | 1 | 2 | 3

/** `at` is the pivot vertex (the corner of an L, the start of a straight); rotation is in quarter turns clockwise on screen. */
export type WallSpec = { kind: 'wall'; owner: PlayerId; shape: WallShape; rotation: Rotation; at: Vertex }
/** A placed wall: one hit point pool (an L shares it) and a stable id assigned by the sim. */
export type Wall = WallSpec & { id: number; hp: number }

/** A one-cell obstacle; `at` is the cell's top-left grid vertex. Follows every wall rule. */
export type TowerSpec = { kind: 'tower'; owner: PlayerId; at: Vertex; /** The inventory power-up it spends; absent = plain tower. */ power?: 'repulsor' | 'steal' }
/** `spent`: a Repulsor that has fired this shot; cleared when the ball rests. */
export type Tower = TowerSpec & { id: number; hp: number; spent?: boolean }
/** Anything placeable, and its placed form; walls and towers share legality, reachability, collision and damage. */
export type StructureSpec = WallSpec | TowerSpec
export type Structure = Wall | Tower

export const WALL_HP = 3
export const TOWER_HP = 3
export const TOWER_COST = 0
export const maxHp = (s: StructureSpec): number => (s.kind === 'tower' ? (s.power === 'steal' ? 1 : TOWER_HP) : WALL_HP)

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
export function wallCells(w: StructureSpec): { a: Vertex; b: Vertex }[] {
  const { gx, gy } = w.at
  if (w.kind === 'tower') {
    const [p, q, r, s] = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([x, y]) => ({ gx: gx + x, gy: gy + y }))
    return [{ a: p, b: q }, { a: q, b: r }, { a: r, b: s }, { a: s, b: p }]
  }
  return arms(w).flatMap(([x, y]) => {
    const n = Math.abs(x + y)
    const [dx, dy] = [Math.sign(x), Math.sign(y)]
    return Array.from({ length: n }, (_, i) => ({
      a: { gx: gx + dx * i, gy: gy + dy * i },
      b: { gx: gx + dx * (i + 1), gy: gy + dy * (i + 1) },
    }))
  })
}

/** Legal when every cell lies inside the pitch, on the owner's half (a cell on the halfway line belongs to neither) and outside the owner's no-build zone. */
export function isLegal(w: StructureSpec): boolean {
  const goalY = w.owner === 2 ? 0 : PITCH_HEIGHT
  // A tower is judged as the whole square (a diagonal pair spans its box), so an edge resting on the halfway line is fine.
  const parts = w.kind === 'tower' ? [{ a: w.at, b: { gx: w.at.gx + 1, gy: w.at.gy + 1 } }] : wallCells(w)
  return parts.every(({ a, b }) => {
    const [x0, x1] = [a.gx, b.gx].map((g) => g * CELL_SIZE).sort((p, q) => p - q)
    const [y0, y1] = [a.gy, b.gy].map((g) => g * CELL_SIZE).sort((p, q) => p - q)
    const nearestToGoal = { x: Math.min(Math.max(PITCH_WIDTH / 2, x0), x1), y: Math.min(Math.max(goalY, y0), y1) }
    return x0 >= 0 && x1 <= PITCH_WIDTH && y0 >= 0 && y1 <= PITCH_HEIGHT && halfOf((y0 + y1) / 2) === w.owner && !inNoBuildZone(nearestToGoal)
  })
}

/**
 * Whether a ball-sized disc (one cell wide) can still go from the halfway line to the owner's goal mouth.
 * Flood fill over the owner's half in cells; a wall cell blocks the step across its edge, so a gap must be a full cell wide.
 */
function goalReachable(walls: StructureSpec[], owner: PlayerId): boolean {
  const [cols, rows] = [PITCH_WIDTH / CELL_SIZE, PITCH_HEIGHT / CELL_SIZE]
  const edge = (ax: number, ay: number, bx: number, by: number) => `${ax},${ay},${bx},${by}`
  const blocked = new Set(walls.flatMap(wallCells).map(({ a, b }) => (a.gx + a.gy < b.gx + b.gy ? edge(a.gx, a.gy, b.gx, b.gy) : edge(b.gx, b.gy, a.gx, a.gy))))
  const [first, last] = owner === 1 ? [rows / 2, rows - 1] : [rows / 2 - 1, 0]
  const goalMouth = (cx: number) => { const { x } = cellToWorld({ cx, cy: 0 }); return x >= GOAL_LEFT && x <= GOAL_RIGHT }
  const key = (cx: number, cy: number) => cx * rows + cy
  const seen = new Set<number>()
  const stack: [number, number][] = Array.from({ length: cols }, (_, cx) => [cx, first])
  stack.forEach(([cx, cy]) => seen.add(key(cx, cy)))
  for (let c = stack.pop(); c; c = stack.pop()) {
    const [cx, cy] = c
    if (cy === last && goalMouth(cx)) return true
    // Neighbour, and the unit edge between the two cells.
    const steps: [number, number, string][] = [
      [cx + 1, cy, edge(cx + 1, cy, cx + 1, cy + 1)],
      [cx - 1, cy, edge(cx, cy, cx, cy + 1)],
      [cx, cy + 1, edge(cx, cy + 1, cx + 1, cy + 1)],
      [cx, cy - 1, edge(cx, cy, cx + 1, cy)],
    ]
    for (const [nx, ny, e] of steps) {
      const onHalf = halfOf(cellToWorld({ cx: nx, cy: ny }).y) === owner
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows || !onHalf || blocked.has(e) || seen.has(key(nx, ny))) continue
      seen.add(key(nx, ny))
      stack.push([nx, ny])
    }
  }
  return false
}

/** Legal, and the owner's goal stays reachable with it in place. Runs on placement only; destroying a wall only opens paths. */
export function canPlace(existing: StructureSpec[], w: StructureSpec): boolean {
  return isLegal(w) && goalReachable([...existing, w], w.owner)
}

/** Zero-thickness collision segments in world units, one per arm. */
export function wallSegments(w: StructureSpec): Segment[] {
  if (w.kind === 'tower') return wallCells(w).map(({ a, b }) => ({ a: { x: a.gx * CELL_SIZE, y: a.gy * CELL_SIZE }, b: { x: b.gx * CELL_SIZE, y: b.gy * CELL_SIZE } }))
  const a = { x: w.at.gx * CELL_SIZE, y: w.at.gy * CELL_SIZE }
  return arms(w).map(([x, y]) => ({ a, b: { x: a.x + x * CELL_SIZE, y: a.y + y * CELL_SIZE } }))
}

/** One jagged crack per lost hit point, as world-space polylines. Deterministic in (id, hp) so peers draw the same cracks. */
export function crackLines(w: Structure): Point[][] {
  const cells = wallCells(w)
  return Array.from({ length: maxHp(w) - w.hp }, (_, k) => {
    // Seeded from id and the hp remaining after this crack, so earlier cracks never move.
    let seed = (w.id * 31 + (maxHp(w) - 1 - k)) * 2654435761
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

/** Removes 1 hp from the wall (one pool per wall); the shared damage path for every source. Unknown ids are ignored. */
export function damageWall(objects: Structure[], id: number, at: Point): { objects: Structure[]; events: SimEvent[] } {
  const target = objects.find((w) => w.id === id)
  if (!target) return { objects, events: [] }
  const hp = target.hp - 1
  return hp > 0
    ? { objects: objects.map((w) => (w === target ? { ...w, hp } : w)), events: [{ type: 'wall-cracked', id, hp, at }] }
    : { objects: objects.filter((w) => w !== target), events: [{ type: 'wall-destroyed', wall: { ...target, hp }, at }] }
}
