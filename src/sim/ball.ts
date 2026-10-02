import { BOARD, GOAL_LEFT, GOAL_RIGHT, NET_DEPTH, PITCH_HEIGHT, PITCH_WIDTH, type Point } from './pitch'
import type { SimConfig, SimEvent } from './step'
import { damageWall, wallSegments, type Segment, type Structure } from './wall'

export type Ball = { pos: Point; vel: Point; /** Distance travelled, drives the rolling dot. */ rolled: number }

const seg = (x1: number, y1: number, x2: number, y2: number): Segment => ({ a: { x: x1, y: y1 }, b: { x: x2, y: y2 } })
const NET = NET_DEPTH + BOARD
/** Side boards, end boards with a goal-mouth gap, and the net box behind each goal. */
const boards: Segment[] = [
  seg(0, 0, 0, PITCH_HEIGHT),
  seg(PITCH_WIDTH, 0, PITCH_WIDTH, PITCH_HEIGHT),
  ...[0, PITCH_HEIGHT].flatMap((y) => {
    const back = y + (y === 0 ? -NET : NET)
    return [seg(0, y, GOAL_LEFT, y), seg(GOAL_RIGHT, y, PITCH_WIDTH, y), seg(GOAL_LEFT, y, GOAL_LEFT, back), seg(GOAL_RIGHT, y, GOAL_RIGHT, back), seg(GOAL_LEFT, back, GOAL_RIGHT, back)]
  }),
]

/** Earliest contact (fraction t of displacement d, surface normal) of a circle of radius r moving from p by d against a zero-thickness segment. */
function sweep(p: Point, d: Point, { a, b }: Segment, r: number): { t: number; n: Point } | null {
  const len = Math.hypot(b.x - a.x, b.y - a.y)
  const [ux, uy] = [(b.x - a.x) / len, (b.y - a.y) / len]
  let best: { t: number; n: Point } | null = null
  const s0 = (p.x - a.x) * -uy + (p.y - a.y) * ux
  const ds = d.x * -uy + d.y * ux
  const side = s0 < 0 ? -1 : 1
  if (ds * side < 0) {
    const t = Math.max(0, (side * r - s0) / ds)
    const u = (p.x + d.x * t - a.x) * ux + (p.y + d.y * t - a.y) * uy
    if (t <= 1 && u >= 0 && u <= len) best = { t, n: { x: -uy * side, y: ux * side } }
  }
  for (const e of [a, b]) {
    const [qx, qy] = [p.x - e.x, p.y - e.y]
    const A = d.x * d.x + d.y * d.y
    const B = qx * d.x + qy * d.y
    const disc = B * B - A * (qx * qx + qy * qy - r * r)
    if (B >= 0 || disc < 0) continue
    const t = Math.max(0, (-B - Math.sqrt(disc)) / A)
    if (t <= 1 && (!best || t < best.t)) {
      const [hx, hy] = [qx + d.x * t, qy + d.y * t]
      best = { t, n: { x: hx / Math.hypot(hx, hy), y: hy / Math.hypot(hx, hy) } }
    }
  }
  return best
}

/** One tick of ball motion: friction, then swept movement with bounces; walls hit hard enough lose hp. */
/** With `breaker`, the first structure touched is destroyed outright and the ball keeps its speed. */
export function rollBall(ball: Ball, objects: Structure[], c: SimConfig, breaker = false): { ball: Ball; objects: Structure[]; events: SimEvent[]; breaker: boolean } {
  const dt = 1 / c.tickHz
  const decay = 0.5 ** (dt / c.halfLife)
  let { pos, vel, rolled } = ball
  vel = { x: vel.x * decay, y: vel.y * decay }
  if (Math.hypot(vel.x, vel.y) < c.restSpeed) vel = { x: 0, y: 0 }
  const events: SimEvent[] = []
  let left = 1
  // The cap only matters when wedged in a corner; the rest of that tick's motion is dropped.
  for (let i = 0; i < 8 && left > 0 && (vel.x || vel.y); i++) {
    const d = { x: vel.x * dt * left, y: vel.y * dt * left }
    let best: { t: number; n: Point; wall?: Structure } | null = null
    const candidates: [Segment, Structure?][] = [...boards.map((s): [Segment] => [s]), ...objects.flatMap((w) => wallSegments(w).map((s): [Segment, Structure] => [s, w]))]
    for (const [s, wall] of candidates) {
      const h = sweep(pos, d, s, c.ballRadius)
      if (h && (!best || h.t < best.t)) best = { ...h, wall }
    }
    const len = Math.hypot(d.x, d.y)
    if (!best) {
      pos = { x: pos.x + d.x, y: pos.y + d.y }
      rolled += len
      break
    }
    pos = { x: pos.x + d.x * best.t, y: pos.y + d.y * best.t }
    rolled += len * best.t
    left *= 1 - best.t
    const speed = Math.hypot(vel.x, vel.y)
    if (best.wall) {
      events.push({ type: 'ball-hit-wall', wall: best.wall.id, speed, at: pos })
      if (breaker) {
        breaker = false
        const gone = { ...best.wall, hp: 0 }
        objects = objects.filter((w) => w.id !== gone.id)
        events.push({ type: 'wall-destroyed', wall: gone, at: pos, breaker: true })
        continue
      }
      if (speed > c.damageFraction * c.maxSpeed) {
        const r = damageWall(objects, best.wall.id, pos)
        objects = r.objects
        events.push(...r.events)
        if (r.events[0].type === 'wall-destroyed') {
          vel = { x: vel.x * c.destroyedSpeedFactor, y: vel.y * c.destroyedSpeedFactor }
          continue
        }
      }
    }
    const k = (1 + c.restitution) * (vel.x * best.n.x + vel.y * best.n.y)
    vel = { x: vel.x - k * best.n.x, y: vel.y - k * best.n.y }
  }
  return { ball: { pos, vel, rolled }, objects, events, breaker }
}
