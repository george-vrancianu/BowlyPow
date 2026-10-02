import { CELL_SIZE, halfOf, type PlayerId, type Point } from './pitch'
import type { SimConfig, SimState } from './step'
import { wallSegments, type Segment, type Structure, type StructureSpec } from './wall'

/** Half the drawn wall thickness; a blast cannot start on it. */
export const WALL_HALF = 0.35

export const blastRadius = (power: number, c: SimConfig): number => 2 * c.ballRadius * (1 + 4 * power)

function nearestOn({ a, b }: Segment, p: Point): Point {
  const [vx, vy] = [b.x - a.x, b.y - a.y]
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy)))
  return { x: a.x + t * vx, y: a.y + t * vy }
}

export function nearestOnWall(w: StructureSpec, p: Point): { at: Point; dist: number } {
  return wallSegments(w)
    .map((s) => nearestOn(s, p))
    .map((at) => ({ at, dist: Math.hypot(at.x - p.x, at.y - p.y) }))
    .reduce((m, h) => (h.dist < m.dist ? h : m))
}

/** A tower is solid, so its interior counts as on it too. */
export const insideTower = (w: Structure, p: Point): boolean =>
  w.kind === 'tower' && Math.abs(p.x - (w.at.gx + 0.5) * CELL_SIZE) < CELL_SIZE / 2 && Math.abs(p.y - (w.at.gy + 0.5) * CELL_SIZE) < CELL_SIZE / 2

/** On the player's own half (not the line), not on a wall, not on the ball. */
export function canBlastFrom(player: PlayerId, origin: Point, s: Pick<SimState, 'objects' | 'ball'>, c: SimConfig): boolean {
  return (
    halfOf(origin.y) === player &&
    Math.hypot(origin.x - s.ball.pos.x, origin.y - s.ball.pos.y) > c.ballRadius &&
    s.objects.every((w) => nearestOnWall(w, origin).dist > WALL_HALF && !insideTower(w, origin))
  )
}

/** New ball velocity: away from the centre, full at the centre (maxSpeed x power) down to zero at the edge; null outside. Dead centre pushes toward the opponent's goal. */
export function blastPush(ball: Point, origin: Point, power: number, player: PlayerId, c: SimConfig): Point | null {
  const [dx, dy] = [ball.x - origin.x, ball.y - origin.y]
  const d = Math.hypot(dx, dy)
  const r = blastRadius(power, c)
  if (d >= r) return null
  const v = c.maxSpeed * power * (1 - d / r)
  return d === 0 ? { x: 0, y: player === 1 ? -v : v } : { x: (dx / d) * v, y: (dy / d) * v }
}

/** Every wall within the radius, with the hit points it loses (possibly 0) and its nearest point to the origin. The halfway line is not considered. */
export function blastDamage(objects: Structure[], origin: Point, power: number, player: PlayerId, c: SimConfig): { wall: Structure; loss: number; at: Point }[] {
  const r = blastRadius(power, c)
  return objects.flatMap((wall) => {
    const { at, dist } = nearestOnWall(wall, origin)
    if (dist >= r) return []
    const pressure = power * (1 - dist / r)
    const loss = wall.owner === player ? (pressure > 0.8 ? 1 : 0) : pressure > 0.8 ? 2 : pressure > 0.4 ? 1 : 0
    return [{ wall, loss, at }]
  })
}
