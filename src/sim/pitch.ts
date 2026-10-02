// World coordinates: x 0..WIDTH left to right, y 0..HEIGHT top to bottom.
// Player 2 owns the top half and defends the goal at y=0; player 1 owns the bottom half and defends y=HEIGHT.
export type PlayerId = 1 | 2
export type Point = { x: number; y: number }
export type Cell = { cx: number; cy: number }

export const PITCH_WIDTH = 40
export const PITCH_HEIGHT = 108
export const HALF_HEIGHT = PITCH_HEIGHT / 2
export const CELL_SIZE = 2
export const GOAL_WIDTH = 10
export const GOAL_LEFT = (PITCH_WIDTH - GOAL_WIDTH) / 2
export const GOAL_RIGHT = GOAL_LEFT + GOAL_WIDTH
export const NO_BUILD_RADIUS = 15
export const BOARD = 1
export const NET_DEPTH = 3

/** The player whose half contains y, or null exactly on the halfway line. */
export function halfOf(y: number): PlayerId | null {
  if (y === HALF_HEIGHT) return null
  return y < HALF_HEIGHT ? 2 : 1
}

/** World centre of a grid cell. */
export function cellToWorld({ cx, cy }: Cell): Point {
  return { x: (cx + 0.5) * CELL_SIZE, y: (cy + 0.5) * CELL_SIZE }
}

export function worldToCell({ x, y }: Point): Cell {
  return { cx: Math.floor(x / CELL_SIZE), cy: Math.floor(y / CELL_SIZE) }
}

/** Inside the semicircle of radius 15 around either goal mouth. */
export function inNoBuildZone({ x, y }: Point): boolean {
  const dy = Math.min(y, PITCH_HEIGHT - y)
  return (x - PITCH_WIDTH / 2) ** 2 + dy ** 2 <= NO_BUILD_RADIUS ** 2
}

/** The owner of the goal whose line the segment from -> to crosses inside the mouth, else null. */
export function goalCrossed(from: Point, to: Point): PlayerId | null {
  const top = from.y > 0 && to.y <= 0
  if (!top && !(from.y < PITCH_HEIGHT && to.y >= PITCH_HEIGHT)) return null
  const lineY = top ? 0 : PITCH_HEIGHT
  const x = from.x + ((lineY - from.y) / (to.y - from.y)) * (to.x - from.x)
  if (x < GOAL_LEFT || x > GOAL_RIGHT) return null
  return top ? 2 : 1
}
