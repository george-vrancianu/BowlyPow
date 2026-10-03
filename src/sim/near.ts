import { rules } from '../config/rules'
import type { Point } from './pitch'
import { wallSegments, type Segment, type Structure, type StructureSpec } from './wall'

function nearestOn({ a, b }: Segment, p: Point): Point {
  const [vx, vy] = [b.x - a.x, b.y - a.y]
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy)))
  return { x: a.x + t * vx, y: a.y + t * vy }
}

/** The point of a structure's drawn segments nearest to `p`, and its distance. */
export function nearestOnWall(w: StructureSpec, p: Point): { at: Point; dist: number } {
  return wallSegments(w)
    .map((s) => nearestOn(s, p))
    .map((at) => ({ at, dist: Math.hypot(at.x - p.x, at.y - p.y) }))
    .reduce((m, h) => (h.dist < m.dist ? h : m))
}

/** A tower is solid, so its interior counts as on it too. */
export const insideTower = (w: Structure, p: Point): boolean =>
  w.kind === 'tower' && Math.abs(p.x - (w.at.gx + 0.5) * rules.cellSize) < rules.cellSize / 2 && Math.abs(p.y - (w.at.gy + 0.5) * rules.cellSize) < rules.cellSize / 2
