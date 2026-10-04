import { visual } from '../../config/visual'

/**
 * The Attract loop: the Title screen's demo. Pieces circle the centre ring and the ball shoots at them.
 * A toy with its own rules in the hero's SVG units, not the match physics. Pure and seeded: `step` returns the next state and what happened.
 */

const cfg = visual.attract
const TAU = 2 * Math.PI
const rad = (deg: number) => (deg * Math.PI) / 180

export type Side = 1 | 2
export type Kind = 'wall' | 'repulsor' | 'steal'
export type Point = { x: number; y: number }

/** A piece on the ring: its angle in radians (y down, so positive turns clockwise) and signed angular speed. Once `gone` it only plays its exit. */
export type Piece = {
  id: number
  side: Side
  kind: Kind
  angle: number
  speed: number
  /** Seconds since it appeared, for the entrance. */
  age: number
  gone?: { at: number; by: 'shatter' | 'burst' | 'collapse'; from: Point }
}

export type Ball = Point & { vx: number; vy: number; scale: number }

export type Phase =
  | { kind: 'rest'; until: number }
  /** In flight toward `target` (none after an unsteered ricochet); `crossed` once past the ring without a hit. */
  | { kind: 'flight'; target?: number; bounces: number; crossed: boolean }
  | { kind: 'return'; from: Point; t: number }
  | { kind: 'swallowed'; at: Point; t: number; by: number }

export type Attract = {
  time: number
  rng: number
  nextId: number
  nextSide: Side
  nextDrip: number
  pieces: Piece[]
  ball: Ball
  phase: Phase
}

export type AttractEvent = { type: 'spawned' | 'hit' | 'deflected' | 'destroyed'; id: number; kind: Kind } | { type: 'shot' | 'returned' }

/** Where a piece sits on the ring. */
export const position = (p: Piece | { angle: number }): Point => ({ x: cfg.ring * Math.cos(p.angle), y: cfg.ring * Math.sin(p.angle) })

/** mulberry32: the next unit float and the next seed. */
function random(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0
  let r = Math.imul(t ^ (t >>> 15), 1 | t)
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t]
}

const rnd = (a: Attract): number => {
  const [v, seed] = random(a.rng)
  a.rng = seed
  return v
}
const between = (a: Attract, [lo, hi]: readonly [number, number]) => lo + rnd(a) * (hi - lo)

/** The smallest turn between two angles, in [0, π]. */
const turnBetween = (a: number, b: number) => Math.abs((((a - b) % TAU) + TAU * 1.5) % TAU - Math.PI)

const live = (a: Attract) => a.pieces.filter((p) => !p.gone)

/** A new piece at the angle farthest from the others among a handful of draws, alternating sides. */
function spawn(a: Attract, events: AttractEvent[]): void {
  let best = { angle: 0, gap: -1 }
  for (let i = 0; i < 20; i++) {
    const angle = rnd(a) * TAU
    const gap = Math.min(Infinity, ...a.pieces.map((p) => turnBetween(p.angle, angle)))
    if (gap > best.gap) best = { angle, gap }
    if (gap >= rad(cfg.gapDeg)) break
  }
  const k = rnd(a)
  const kind: Kind = k < cfg.kinds.wall ? 'wall' : k < cfg.kinds.repulsor ? 'repulsor' : 'steal'
  const side = a.nextSide
  const speed = ((TAU / cfg.lapSec) * (1 + (rnd(a) * 2 - 1) * cfg.jitter)) * (side === 1 ? 1 : -1)
  a.pieces.push({ id: a.nextId, side, kind, angle: best.angle, speed, age: 0 })
  events.push({ type: 'spawned', id: a.nextId, kind })
  a.nextId++
  a.nextSide = side === 1 ? 2 : 1
}

function keepStocked(a: Attract, events: AttractEvent[]): void {
  const count = live(a).length
  if (count < cfg.min) {
    const want = cfg.min + Math.floor(rnd(a) * (cfg.max - cfg.min + 1))
    for (let i = count; i < want; i++) spawn(a, events)
    a.nextDrip = a.time + cfg.dripSec
  } else if (count < cfg.max && a.time >= a.nextDrip) {
    spawn(a, events)
    a.nextDrip = a.time + cfg.dripSec
  }
}

/** Fresh loop: a first set of pieces and the ball resting until the first shot. */
export function createAttract(seed: number): Attract {
  const a: Attract = { time: 0, rng: seed >>> 0, nextId: 1, nextSide: 1, nextDrip: 0, pieces: [], ball: { x: 0, y: 0, vx: 0, vy: 0, scale: 1 }, phase: { kind: 'rest', until: cfg.firstSec } }
  keepStocked(a, [])
  return a
}

const ballSpeed = cfg.ring / cfg.flightSec
const speedOf = (b: Ball) => Math.hypot(b.vx, b.vy)

/** Aims the ball at where `target` will be when the ball gets there. */
function aimAt(a: Attract, target: Piece, from: Point): void {
  const dist = Math.hypot(position(target).x - from.x, position(target).y - from.y)
  const ahead = position({ angle: target.angle + target.speed * (dist / ballSpeed) })
  const [dx, dy] = [ahead.x - from.x, ahead.y - from.y]
  const d = Math.hypot(dx, dy) || 1
  a.ball.vx = (dx / d) * ballSpeed
  a.ball.vy = (dy / d) * ballSpeed
}

function shoot(a: Attract, events: AttractEvent[]): void {
  const targets = live(a)
  const target = targets[Math.floor(rnd(a) * targets.length)]
  aimAt(a, target, a.ball)
  a.phase = { kind: 'flight', target: target.id, bounces: 0, crossed: false }
  events.push({ type: 'shot' })
}

const ease = (t: number) => 1 - (1 - t) ** 3

function startReturn(a: Attract): void {
  a.phase = { kind: 'return', from: { x: a.ball.x, y: a.ball.y }, t: 0 }
  a.ball.vx = a.ball.vy = 0
}

/** The piece under the ball where it meets the ring, if any. */
function pieceAt(a: Attract, at: Point): Piece | undefined {
  const angle = Math.atan2(at.y, at.x)
  const near = live(a).filter((p) => turnBetween(p.angle, angle) <= rad(cfg.hitDeg))
  return near.sort((p, q) => turnBetween(p.angle, angle) - turnBetween(q.angle, angle))[0]
}

/** A wall ricochet: the honest reflection, bent by up to bendDeg toward the nearest other piece while the bounce budget lasts. Counts the bounce. */
function ricochet(a: Attract, wall: Piece, phase: Extract<Phase, { kind: 'flight' }>): void {
  const b = a.ball
  const r = Math.hypot(b.x, b.y) || 1
  const [nx, ny] = [b.x / r, b.y / r]
  const dot = b.vx * nx + b.vy * ny
  const out = { x: b.vx - 2 * dot * nx, y: b.vy - 2 * dot * ny }
  const heading = Math.atan2(out.y, out.x)
  phase.target = undefined
  b.vx = out.x
  b.vy = out.y
  phase.bounces++
  // Budget spent: the ball leaves the ring untouched, so one shot never clears it.
  if (phase.bounces >= cfg.bounces) {
    phase.crossed = true
    return
  }
  let best: { piece: Piece; bend: number } | undefined
  for (const piece of live(a)) {
    if (piece === wall) continue
    const dist = Math.hypot(position(piece).x - b.x, position(piece).y - b.y)
    const ahead = position({ angle: piece.angle + piece.speed * (dist / ballSpeed) })
    const bend = turnBetween(Math.atan2(ahead.y - b.y, ahead.x - b.x), heading)
    if (bend <= rad(cfg.bendDeg) && (!best || bend < best.bend)) best = { piece, bend }
  }
  if (!best) return
  aimAt(a, best.piece, b)
  phase.target = best.piece.id
}

function resolveHit(a: Attract, piece: Piece, phase: Extract<Phase, { kind: 'flight' }>, events: AttractEvent[]): void {
  const from = { x: a.ball.x, y: a.ball.y }
  if (piece.kind === 'wall') {
    events.push({ type: 'deflected', id: piece.id, kind: piece.kind })
    piece.gone = { at: a.time, by: 'shatter', from }
    events.push({ type: 'destroyed', id: piece.id, kind: piece.kind })
    ricochet(a, piece, phase)
    return
  }
  events.push({ type: 'hit', id: piece.id, kind: piece.kind })
  if (piece.kind === 'repulsor') {
    piece.gone = { at: a.time, by: 'burst', from }
    events.push({ type: 'destroyed', id: piece.id, kind: piece.kind })
    startReturn(a)
  } else {
    a.phase = { kind: 'swallowed', at: position(piece), t: 0, by: piece.id }
    a.ball.vx = a.ball.vy = 0
  }
}

function fly(a: Attract, dt: number, phase: Extract<Phase, { kind: 'flight' }>, events: AttractEvent[]): void {
  const b = a.ball
  b.x += b.vx * dt
  b.y += b.vy * dt
  const r = Math.hypot(b.x, b.y)
  const outward = b.x * b.vx + b.y * b.vy > 0
  if (!phase.crossed && outward && r >= cfg.ring - cfg.ballR) {
    const piece = pieceAt(a, b)
    if (piece) {
      // Snap onto the ring edge so the ricochet leaves from where the piece sits.
      const k = (cfg.ring - cfg.ballR) / (r || 1)
      b.x *= k
      b.y *= k
      resolveHit(a, piece, phase, events)
      return
    }
    phase.crossed = true
  }
  if (r > cfg.ring + cfg.exitPad) startReturn(a)
}

const longestExit = Math.max(cfg.shatterSec, cfg.burstSec, cfg.swallowSec)

/** Advances the loop by `dt` seconds. */
export function step(prev: Attract, dt: number): { state: Attract; events: AttractEvent[] } {
  const a: Attract = structuredClone(prev)
  const events: AttractEvent[] = []
  a.time += dt
  for (const p of a.pieces) {
    p.age += dt
    if (!p.gone) p.angle = (p.angle + p.speed * dt + TAU) % TAU
  }
  a.pieces = a.pieces.filter((p) => !p.gone || a.time - p.gone.at < longestExit)

  const phase = a.phase
  switch (phase.kind) {
    case 'rest':
      if (a.time >= phase.until && live(a).length > 0) shoot(a, events)
      break
    case 'flight':
      fly(a, dt, phase, events)
      break
    case 'return': {
      phase.t += dt
      const k = 1 - ease(Math.min(phase.t / cfg.returnSec, 1))
      a.ball.x = phase.from.x * k
      a.ball.y = phase.from.y * k
      if (phase.t >= cfg.returnSec) {
        a.ball.x = a.ball.y = 0
        a.phase = { kind: 'rest', until: a.time + between(a, cfg.shotSec) }
        events.push({ type: 'returned' })
      }
      break
    }
    case 'swallowed': {
      phase.t += dt
      const k = Math.min(phase.t / cfg.swallowSec, 1)
      a.ball.x = a.ball.x + (phase.at.x - a.ball.x) * k
      a.ball.y = a.ball.y + (phase.at.y - a.ball.y) * k
      a.ball.scale = 1 - k
      if (phase.t >= cfg.swallowSec) {
        const tower = a.pieces.find((p) => p.id === phase.by)
        if (tower && !tower.gone) {
          tower.gone = { at: a.time, by: 'collapse', from: phase.at }
          events.push({ type: 'destroyed', id: tower.id, kind: tower.kind })
        }
        a.ball = { x: 0, y: 0, vx: 0, vy: 0, scale: 1 }
        a.phase = { kind: 'rest', until: a.time + between(a, cfg.shotSec) }
        events.push({ type: 'returned' })
      }
      break
    }
  }
  keepStocked(a, events)
  return { state: a, events }
}
