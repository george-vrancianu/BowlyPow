import { rules } from '../config/rules'
import { visual } from '../config/visual'
import type { PlayerId, Point } from '../sim/pitch'
import { blastDamage, blastPush, blastRadius } from '../sim/blast'
import type { SimConfig, SimState } from '../sim/step'
import { viewOf, type Camera } from './camera'
import { shakeOffset, type Fx } from './feedback'
import { canPlace, crackLines, wallCells, wallSegments, type Structure, type StructureSpec, type TowerPower, type TowerSpec } from '../sim/wall'


/** Canvas pixel position to world units through the camera. */
export function screenToWorld(canvas: { width: number; height: number }, cam: Camera, px: number, py: number): Point {
  const { sx, sy, pane } = viewOf(canvas, cam)
  return { x: (px - pane.x) / sx, y: cam.y + (py - (pane.y + pane.h / 2)) / sy }
}

/** Player 2 walls: owner colour with diagonal stripes. */
function hatch(ctx: CanvasRenderingContext2D): CanvasPattern {
  const tile = document.createElement('canvas')
  tile.width = tile.height = 8
  const t = tile.getContext('2d')!
  t.fillStyle = visual.player.colors[2]
  t.fillRect(0, 0, 8, 8)
  t.strokeStyle = visual.wall.hatchStripe
  t.lineWidth = 2
  t.beginPath()
  t.moveTo(0, 8)
  t.lineTo(8, 0)
  t.stroke()
  const pattern = ctx.createPattern(tile, 'repeat')!
  pattern.setTransform(new DOMMatrix().scale(0.25))
  return pattern
}

/** One cell-sized piece of a destroyed wall, flying away from the impact point. */
export type Fragment = { a: Point; b: Point; owner: StructureSpec['owner']; from: Point; born: number }

/** Splits a destroyed wall into one fragment per cell. */
export const shatter = (w: StructureSpec, from: Point, born: number): Fragment[] =>
  wallCells(w).map(({ a, b }) => ({ a: { x: a.gx * rules.cellSize, y: a.gy * rules.cellSize }, b: { x: b.gx * rules.cellSize, y: b.gy * rules.cellSize }, owner: w.owner, from, born }))

/** True while the fragment is still visible. */
export const fragmentAlive = (f: Fragment, now: number) => now - f.born < visual.wall.shatterMs

function drawFragment(ctx: CanvasRenderingContext2D, f: Fragment, now: number): void {
  const t = (now - f.born) / visual.wall.shatterMs
  if (t < 0) return
  const [cx, cy] = [(f.a.x + f.b.x) / 2, (f.a.y + f.b.y) / 2]
  const [dx, dy] = [cx - f.from.x, cy - f.from.y]
  const d = Math.hypot(dx, dy) || 1
  const fly = t * visual.wall.shatterFly
  ctx.save()
  ctx.globalAlpha = 1 - t
  ctx.translate(cx + (dx / d) * fly, cy + (dy / d) * fly)
  ctx.rotate(t * visual.wall.shatterSpin * (cx % 2 < 1 ? 1 : -1))
  ctx.translate(-cx, -cy)
  drawWall(ctx, { a: f.a, b: f.b, owner: f.owner })
  ctx.restore()
}

function drawWall(ctx: CanvasRenderingContext2D, w: { owner: StructureSpec['owner'] } & ({ a: Point; b: Point } | StructureSpec), fill?: string): void {
  if ('kind' in w && w.kind === 'tower') return drawTower(ctx, w, fill)
  ctx.beginPath()
  for (const { a, b } of 'a' in w ? [w] : wallSegments(w)) {
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  ctx.lineCap = 'square'
  ctx.lineJoin = 'miter'
  ctx.strokeStyle = visual.wall.outline
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.strokeStyle = fill ?? (w.owner === 2 ? hatch(ctx) : visual.player.colors[1])
  ctx.lineWidth = 0.7
  ctx.stroke()
  if ('hp' in w) drawCracks(ctx, w as Structure)
}

function drawCracks(ctx: CanvasRenderingContext2D, w: Structure): void {
  ctx.beginPath()
  for (const [p, ...rest] of crackLines(w)) {
    ctx.moveTo(p.x, p.y)
    for (const q of rest) ctx.lineTo(q.x, q.y)
  }
  ctx.lineCap = 'butt'
  ctx.strokeStyle = visual.wall.outline
  ctx.lineWidth = 0.12
  ctx.stroke()
}

const GLYPHS: Record<TowerPower, (ctx: CanvasRenderingContext2D, x: number, y: number, spent: boolean) => void> = {
  // Two concentric rings; dimmed once spent for the shot.
  repulsor(ctx, x, y, spent) {
    ctx.globalAlpha = spent ? visual.tower.spentAlpha : 1
    for (const r of [0.7, 0.35]) {
      ctx.beginPath()
      ctx.arc(x + rules.cellSize / 2, y + rules.cellSize / 2, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  },
  // Vortex: a spiral of two turns.
  steal(ctx, x, y) {
    ctx.beginPath()
    for (let a = 0; a <= Math.PI * 4; a += 0.2) ctx.lineTo(x + rules.cellSize / 2 + Math.cos(a) * a * 0.1, y + rules.cellSize / 2 + Math.sin(a) * a * 0.1)
    ctx.stroke()
  },
}

/** A square in the owner's colour with its power-up glyph inset. */
function drawTower(ctx: CanvasRenderingContext2D, t: TowerSpec & { hp?: number; id?: number; spent?: boolean }, fill?: string): void {
  const [x, y] = [t.at.gx * rules.cellSize, t.at.gy * rules.cellSize]
  ctx.fillStyle = fill ?? (t.owner === 2 ? hatch(ctx) : visual.player.colors[1])
  ctx.fillRect(x, y, rules.cellSize, rules.cellSize)
  ctx.strokeStyle = visual.wall.outline
  ctx.lineWidth = 0.3
  ctx.strokeRect(x, y, rules.cellSize, rules.cellSize)
  ctx.lineWidth = 0.1
  ctx.strokeRect(x + 0.5, y + 0.5, rules.cellSize - 1, rules.cellSize - 1)
  GLYPHS[t.power](ctx, x, y, !!t.spent)
  if (t.hp !== undefined) drawCracks(ctx, t as Structure)
}

/** A thin outline around a structure's footprint, in its owner's colour. */
function drawOutline(ctx: CanvasRenderingContext2D, w: StructureSpec, dash: number[] = [], pad = 0.6): void {
  ctx.beginPath()
  if (w.kind === 'tower') ctx.rect(w.at.gx * rules.cellSize - pad, w.at.gy * rules.cellSize - pad, rules.cellSize + 2 * pad, rules.cellSize + 2 * pad)
  else for (const { a, b } of wallSegments(w)) ctx.rect(Math.min(a.x, b.x) - pad, Math.min(a.y, b.y) - pad, Math.abs(b.x - a.x) + 2 * pad, Math.abs(b.y - a.y) + 2 * pad)
  ctx.setLineDash(dash)
  ctx.strokeStyle = visual.player.colors[w.owner]
  ctx.lineWidth = 0.15
  ctx.stroke()
  ctx.setLineDash([])
}

/** The selection highlight: an outline that breathes. */
function drawPulseOutline(ctx: CanvasRenderingContext2D, w: StructureSpec, now: number): void {
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(now / 150)
  drawOutline(ctx, w, [], 0.8 + 0.15 * Math.sin(now / 150))
  ctx.globalAlpha = 1
}

/** Fire effect: a glow over the tower and rings bursting outward from its centre. */
function drawPulse(ctx: CanvasRenderingContext2D, t: TowerSpec, age: number): void {
  const k = age / visual.tower.glowMs
  if (k >= 1) return
  const [cx, cy] = [(t.at.gx + 0.5) * rules.cellSize, (t.at.gy + 0.5) * rules.cellSize]
  ctx.globalAlpha = 1 - k
  ctx.fillStyle = visual.tower.glow
  ctx.fillRect(cx - rules.cellSize / 2, cy - rules.cellSize / 2, rules.cellSize, rules.cellSize)
  ctx.strokeStyle = visual.tower.glow
  ctx.lineWidth = 0.2
  for (const r of [0.7, 0.35]) {
    ctx.beginPath()
    ctx.arc(cx, cy, r + k * 4, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/** Disc with a speed-scaled fading trail behind it and a dot that rolls with the distance travelled. */
function drawBall(ctx: CanvasRenderingContext2D, { pos, vel, rolled }: SimState['ball'], bright = false, scale = 1): void {
  const speed = Math.hypot(vel.x, vel.y)
  if (speed > 0) {
    const tail = { x: pos.x - vel.x * visual.ball.trailLength, y: pos.y - vel.y * visual.ball.trailLength }
    const g = ctx.createLinearGradient(pos.x, pos.y, tail.x, tail.y)
    g.addColorStop(0, bright ? visual.tower.glow : 'rgba(255,255,255,0.5)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    ctx.lineTo(tail.x, tail.y)
    ctx.lineCap = 'round'
    ctx.strokeStyle = g
    ctx.lineWidth = bright ? 3 : 2
    ctx.stroke()
  }
  ctx.beginPath()
  ctx.arc(pos.x, pos.y, scale, 0, Math.PI * 2)
  ctx.fillStyle = visual.ball.fill
  ctx.fill()
  ctx.strokeStyle = visual.wall.outline
  ctx.lineWidth = 0.12
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(pos.x + Math.cos(rolled) * 0.55 * scale, pos.y + Math.sin(rolled) * 0.55 * scale, 0.2 * scale, 0, Math.PI * 2)
  ctx.fillStyle = visual.wall.outline
  ctx.fill()
}

/** A blast being charged: `power` is 0 during the dwell. */
export type Charge = { origin: Point; power: number; player: PlayerId }
/** A fired blast's expanding ring. */
export type Wave = { origin: Point; radius: number; born: number }
export const waveAlive = (w: Wave, now: number) => now - w.born < visual.aim.waveMs

const lerpRed = (t: number) => `rgb(${Math.round(255 * t + 90 * (1 - t))},${Math.round(90 * (1 - t) + 40 * t)},${Math.round(90 * (1 - t) + 40 * t)})`

function drawCharge(ctx: CanvasRenderingContext2D, state: SimState, { origin, power, player }: Charge, now: number, config: SimConfig): void {
  ctx.lineWidth = 0.15
  if (power === 0) {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now / 120)
    ctx.strokeStyle = visual.player.colors[player]
    ctx.beginPath()
    ctx.arc(origin.x, origin.y, 1.2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    return
  }
  const r = blastRadius(power, config)
  const color = lerpRed(power)
  ctx.beginPath()
  ctx.arc(origin.x, origin.y, r, 0, Math.PI * 2)
  ctx.globalAlpha = 0.15
  ctx.fillStyle = color
  ctx.fill()
  ctx.globalAlpha = 1
  ctx.strokeStyle = color
  ctx.stroke()
  // Radar rings sweeping outward.
  for (const phase of [0, 0.5]) {
    const t = (now / 800 + phase) % 1
    ctx.globalAlpha = 1 - t
    ctx.beginPath()
    ctx.arc(origin.x, origin.y, r * t, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  const push = blastPush(state.ball.pos, origin, power, player, config)
  if (push) {
    const { pos } = state.ball
    const tip = { x: pos.x + push.x * 0.15, y: pos.y + push.y * 0.15 }
    const ang = Math.atan2(push.y, push.x)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    ctx.lineTo(tip.x, tip.y)
    for (const s of [-1, 1]) {
      ctx.moveTo(tip.x, tip.y)
      ctx.lineTo(tip.x - Math.cos(ang + s * 0.5) * 0.8, tip.y - Math.sin(ang + s * 0.5) * 0.8)
    }
    ctx.globalAlpha = 0.6
    ctx.strokeStyle = visual.ball.fill
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

/** Read-only: draws the state through the camera, which shows the full pitch width and at most 64 units of height. An optional ghost wall is drawn half-transparent. */
export type Overlays = {
  ghost?: StructureSpec
  /** A confirmed piece not yet in the sim, drawn as a still ghost. */
  landing?: StructureSpec
  /** Structures being moved: the ghost or the landing piece stands in for them. */
  hidden?: number[]
  /** An older structure picked to demolish; it pulses. */
  selected?: number
  /** Structures the builder placed this turn, outlined dashed. */
  movable?: number[]
  fragments?: Fragment[]
  now?: number
  charge?: Charge
  waves?: Wave[]
  fx?: Fx
  ballGhost?: { at: Point; legal: boolean }
  /** The shooter whose ball gets the Breaker outline. */
  armed?: PlayerId
}

export function render(ctx: CanvasRenderingContext2D, state: SimState, cam: Camera, config: SimConfig, { ghost, landing, hidden = [], selected, movable = [], fragments = [], now = 0, charge, waves = [], fx, ballGhost, armed }: Overlays = {}): void {
  const { width, height } = ctx.canvas
  const { sx, sy, pane, visibleHeight } = viewOf(ctx.canvas, cam)
  ctx.fillStyle = visual.pitch.bg
  ctx.fillRect(0, 0, width, height)
  ctx.save()
  ctx.beginPath()
  ctx.rect(pane.x, pane.y, pane.w, pane.h)
  ctx.clip()
  const shake = fx ? shakeOffset(fx.shake.amp, fx.shake.born, now) : { x: 0, y: 0 }
  ctx.translate(pane.x + shake.x, pane.y + pane.h / 2 - cam.y * sy + shake.y)
  ctx.scale(sx, sy)

  ctx.fillStyle = visual.pitch.board
  ctx.fillRect(0, -rules.board, rules.pitchWidth, rules.pitchHeight + 2 * rules.board)
  ctx.fillStyle = visual.pitch.pitch
  ctx.fillRect(0, 0, rules.pitchWidth, rules.pitchHeight)
  // Faint owner tint per half.
  ctx.globalAlpha = visual.pitch.halfTint
  ctx.fillStyle = visual.player.colors[2]
  ctx.fillRect(0, 0, rules.pitchWidth, rules.halfHeight)
  ctx.fillStyle = visual.player.colors[1]
  ctx.fillRect(0, rules.halfHeight, rules.pitchWidth, rules.halfHeight)
  ctx.globalAlpha = 1

  // Nets behind each goal, then the gap in the board.
  for (const [y, dir, color] of [[0, -1, visual.player.colors[2]], [rules.pitchHeight, 1, visual.player.colors[1]]] as const) {
    ctx.fillStyle = visual.pitch.net
    ctx.fillRect(rules.goalLeft, dir < 0 ? y - rules.netDepth - rules.board : y + rules.board, rules.goalRight - rules.goalLeft, rules.netDepth)
    ctx.fillStyle = visual.pitch.pitch
    ctx.fillRect(rules.goalLeft, dir < 0 ? y - rules.board : y, rules.goalRight - rules.goalLeft, rules.board)
    ctx.fillStyle = color
    ctx.fillRect(rules.goalLeft, y - 0.25, rules.goalRight - rules.goalLeft, 0.5)
  }

  ctx.fillStyle = visual.pitch.line
  ctx.fillRect(0, rules.halfHeight - 0.15, rules.pitchWidth, 0.3)

  const { builder } = state.match
  if (builder) {
    ctx.fillStyle = visual.pitch.line
    for (let x = 0; x <= rules.pitchWidth; x += rules.cellSize) for (let y = 0; y <= rules.pitchHeight; y += rules.cellSize) ctx.fillRect(x - 0.08, y - 0.08, 0.16, 0.16)
    const [goalY, from] = builder === 1 ? [rules.pitchHeight, Math.PI] : [0, 0]
    ctx.beginPath()
    ctx.arc(rules.pitchWidth / 2, goalY, rules.noBuildRadius, from, from + Math.PI)
    ctx.setLineDash([0.8, 0.6])
    ctx.strokeStyle = visual.player.colors[builder]
    ctx.lineWidth = 0.15
    ctx.stroke()
    ctx.setLineDash([])
  }

  const inRange = new Map(charge && charge.power > 0 ? blastDamage(state.objects, charge.origin, charge.power, charge.player, config).map((h) => [h.wall.id, h.wall.owner === charge.player ? visual.wall.ownTint : visual.wall.illegal]) : [])
  for (const o of state.objects) {
    if (hidden.includes(o.id)) continue
    drawWall(ctx, o, inRange.get(o.id))
    if (movable.includes(o.id)) drawOutline(ctx, o, [0.4, 0.4])
    if (selected === o.id) drawPulseOutline(ctx, o, now)
    const pulse = fx?.pulses.find((p) => p.tower === o.id)
    if (pulse && o.kind === 'tower') drawPulse(ctx, o, now - pulse.born)
    const flash = fx?.flashes.find((f) => f.wall === o.id)
    if (flash) {
      const t = (now - flash.born) / (flash.dim ? visual.wall.dimFlashMs : visual.wall.flashMs)
      if (t < 1) {
        ctx.globalAlpha = (flash.dim ? visual.wall.dimFlashAlpha : 1) * (1 - t)
        drawWall(ctx, o, visual.tower.glow)
        ctx.globalAlpha = 1
      }
    }
  }
  const steals = fx?.steals ?? []
  for (const s of steals) {
    // The tower is already gone from the sim: draw it until the collapse, with the ball sinking into its centre.
    const k = Math.min((now - s.born) / visual.ball.stealMs, 1)
    const c = { x: (s.tower.at.gx + 0.5) * rules.cellSize, y: (s.tower.at.gy + 0.5) * rules.cellSize }
    drawWall(ctx, s.tower)
    drawBall(ctx, { pos: { x: s.at.x + (c.x - s.at.x) * k, y: s.at.y + (c.y - s.at.y) * k }, vel: { x: 0, y: 0 }, rolled: state.ball.rolled }, false, 1 - k)
  }
  if (!steals.length) drawBall(ctx, state.ball, !!fx?.pulses.some((p) => now - p.born < visual.ball.trailMs))
  if (armed) {
    ctx.beginPath()
    ctx.arc(state.ball.pos.x, state.ball.pos.y, 1.5 + 0.25 * Math.sin(now / 120), 0, Math.PI * 2)
    ctx.strokeStyle = visual.player.colors[armed]
    ctx.lineWidth = 0.3
    ctx.stroke()
  }
  if (charge) drawCharge(ctx, state, charge, now, config)
  for (const w of waves) {
    const t = (now - w.born) / visual.aim.waveMs
    ctx.globalAlpha = 1 - t
    ctx.beginPath()
    ctx.arc(w.origin.x, w.origin.y, w.radius * t, 0, Math.PI * 2)
    ctx.strokeStyle = visual.aim.wave
    ctx.lineWidth = 0.3
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  for (const f of fragments) drawFragment(ctx, f, now)
  for (const p of fx?.particles ?? []) {
    const t = (now - p.born) / visual.fx.particleMs
    if (t >= 1) continue
    ctx.globalAlpha = 1 - t
    ctx.fillStyle = p.color
    ctx.fillRect(p.at.x + p.vel.x * t - 0.15, p.at.y + p.vel.y * t - 0.15, 0.3, 0.3)
  }
  ctx.globalAlpha = 1
  if (landing) {
    ctx.globalAlpha = 0.5
    drawWall(ctx, landing)
    ctx.globalAlpha = 1
  }
  if (ghost) {
    ctx.globalAlpha = 0.5
    drawWall(ctx, ghost, canPlace(state.objects.filter((o) => !hidden.includes(o.id)), ghost) ? undefined : visual.wall.illegal)
    ctx.globalAlpha = 1
    drawPulseOutline(ctx, ghost, now)
  }
  if (ballGhost) {
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.arc(ballGhost.at.x, ballGhost.at.y, config.ballRadius, 0, Math.PI * 2)
    ctx.fillStyle = ballGhost.legal ? visual.ball.fill : visual.wall.illegal
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.restore()
  edgeFade(ctx, pane, cam.y - visibleHeight / 2 > -rules.board, cam.y + visibleHeight / 2 < rules.pitchHeight + rules.board)
}

/** Soft gradient at the top/bottom edge of the pane where more pitch lies beyond. */
function edgeFade(ctx: CanvasRenderingContext2D, { x, y, w, h }: { x: number; y: number; w: number; h: number }, top: boolean, bottom: boolean): void {
  const fade = h * visual.camera.edgeFadeFraction
  for (const [on, y0, y1] of [[top, y, y + fade], [bottom, y + h, y + h - fade]] as const) {
    if (!on) continue
    const g = ctx.createLinearGradient(0, y0, 0, y1)
    g.addColorStop(0, visual.pitch.bg)
    g.addColorStop(1, visual.pitch.bgClear)
    ctx.fillStyle = g
    ctx.fillRect(x, Math.min(y0, y1), w, fade)
  }
}
