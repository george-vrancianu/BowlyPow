import type { PlayerId, Point } from '../sim/pitch'
import { PLAYER_COLORS } from '../sim/player'
import { BOARD, NET_DEPTH, GOAL_LEFT, GOAL_RIGHT, HALF_HEIGHT, PITCH_HEIGHT, PITCH_WIDTH } from '../sim/pitch'
import { blastDamage, blastPush, blastRadius } from '../sim/blast'
import { defaultConfig, type SimState } from '../sim/step'
import { CELL_SIZE, NO_BUILD_RADIUS } from '../sim/pitch'
import { viewOf, type Camera } from './camera'
import { DIM_FLASH_MS, FLASH_MS, GLOW_MS, PARTICLE_MS, TRAIL_MS, shakeOffset, type Fx } from './feedback'
import { canPlace, crackLines, wallCells, wallSegments, type Structure, type StructureSpec, type TowerSpec } from '../sim/wall'

const COLORS = { bg: '#0b0f1a', board: '#3a4258', pitch: '#121a2b', line: '#2c3a57', p1: PLAYER_COLORS[1], p2: PLAYER_COLORS[2], net: '#1d2740', outline: '#05070d', illegal: '#ef4444', ownTint: '#7f1d1d' }

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
  t.fillStyle = COLORS.p2
  t.fillRect(0, 0, 8, 8)
  t.strokeStyle = '#7c2d12'
  t.lineWidth = 2
  t.beginPath()
  t.moveTo(0, 8)
  t.lineTo(8, 0)
  t.stroke()
  const pattern = ctx.createPattern(tile, 'repeat')!
  pattern.setTransform(new DOMMatrix().scale(0.25))
  return pattern
}

const SHATTER_MS = 400
/** One cell-sized piece of a destroyed wall, flying away from the impact point. */
export type Fragment = { a: Point; b: Point; owner: StructureSpec['owner']; from: Point; born: number }

/** Splits a destroyed wall into one fragment per cell. */
export const shatter = (w: StructureSpec, from: Point, born: number): Fragment[] =>
  wallCells(w).map(({ a, b }) => ({ a: { x: a.gx * CELL_SIZE, y: a.gy * CELL_SIZE }, b: { x: b.gx * CELL_SIZE, y: b.gy * CELL_SIZE }, owner: w.owner, from, born }))

/** True while the fragment is still visible. */
export const fragmentAlive = (f: Fragment, now: number) => now - f.born < SHATTER_MS

function drawFragment(ctx: CanvasRenderingContext2D, f: Fragment, now: number): void {
  const t = (now - f.born) / SHATTER_MS
  const [cx, cy] = [(f.a.x + f.b.x) / 2, (f.a.y + f.b.y) / 2]
  const [dx, dy] = [cx - f.from.x, cy - f.from.y]
  const d = Math.hypot(dx, dy) || 1
  const fly = t * 6
  ctx.save()
  ctx.globalAlpha = 1 - t
  ctx.translate(cx + (dx / d) * fly, cy + (dy / d) * fly)
  ctx.rotate(t * 4 * (cx % 2 < 1 ? 1 : -1))
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
  ctx.strokeStyle = COLORS.outline
  ctx.lineWidth = 1
  ctx.stroke()
  ctx.strokeStyle = fill ?? (w.owner === 2 ? hatch(ctx) : COLORS.p1)
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
  ctx.strokeStyle = COLORS.outline
  ctx.lineWidth = 0.12
  ctx.stroke()
}

/** A square in the owner's colour with an empty inset where a power-up glyph will go. */
function drawTower(ctx: CanvasRenderingContext2D, t: TowerSpec & { hp?: number; id?: number; spent?: boolean }, fill?: string): void {
  const [x, y] = [t.at.gx * CELL_SIZE, t.at.gy * CELL_SIZE]
  ctx.fillStyle = fill ?? (t.owner === 2 ? hatch(ctx) : COLORS.p1)
  ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE)
  ctx.strokeStyle = COLORS.outline
  ctx.lineWidth = 0.3
  ctx.strokeRect(x, y, CELL_SIZE, CELL_SIZE)
  ctx.lineWidth = 0.1
  ctx.strokeRect(x + 0.5, y + 0.5, CELL_SIZE - 1, CELL_SIZE - 1)
  if (t.power === 'repulsor') {
    // Two concentric rings; dimmed once spent for the shot.
    ctx.globalAlpha = t.spent ? 0.3 : 1
    for (const r of [0.7, 0.35]) {
      ctx.beginPath()
      ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
  if (t.hp !== undefined) drawCracks(ctx, t as Structure)
}

/** Fire effect: a glow over the tower and rings bursting outward from its centre. */
function drawPulse(ctx: CanvasRenderingContext2D, t: TowerSpec, age: number): void {
  const k = age / GLOW_MS
  if (k >= 1) return
  const [cx, cy] = [(t.at.gx + 0.5) * CELL_SIZE, (t.at.gy + 0.5) * CELL_SIZE]
  ctx.globalAlpha = 1 - k
  ctx.fillStyle = '#fff'
  ctx.fillRect(cx - CELL_SIZE / 2, cy - CELL_SIZE / 2, CELL_SIZE, CELL_SIZE)
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 0.2
  for (const r of [0.7, 0.35]) {
    ctx.beginPath()
    ctx.arc(cx, cy, r + k * 4, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/** Disc with a speed-scaled fading trail behind it and a dot that rolls with the distance travelled. */
function drawBall(ctx: CanvasRenderingContext2D, { pos, vel, rolled }: SimState['ball'], bright = false): void {
  const speed = Math.hypot(vel.x, vel.y)
  if (speed > 0) {
    const tail = { x: pos.x - vel.x * 0.08, y: pos.y - vel.y * 0.08 }
    const g = ctx.createLinearGradient(pos.x, pos.y, tail.x, tail.y)
    g.addColorStop(0, bright ? '#fff' : 'rgba(255,255,255,0.5)')
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
  ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2)
  ctx.fillStyle = '#f4f4f0'
  ctx.fill()
  ctx.strokeStyle = COLORS.outline
  ctx.lineWidth = 0.12
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(pos.x + Math.cos(rolled) * 0.55, pos.y + Math.sin(rolled) * 0.55, 0.2, 0, Math.PI * 2)
  ctx.fillStyle = COLORS.outline
  ctx.fill()
}

/** A blast being charged: `power` is 0 during the dwell. */
export type Charge = { origin: Point; power: number; player: PlayerId }
/** A fired blast's expanding ring. */
export type Wave = { origin: Point; radius: number; born: number }
export const WAVE_MS = 250
export const waveAlive = (w: Wave, now: number) => now - w.born < WAVE_MS

const lerpRed = (t: number) => `rgb(${Math.round(255 * t + 90 * (1 - t))},${Math.round(90 * (1 - t) + 40 * t)},${Math.round(90 * (1 - t) + 40 * t)})`

function drawCharge(ctx: CanvasRenderingContext2D, state: SimState, { origin, power, player }: Charge, now: number): void {
  ctx.lineWidth = 0.15
  if (power === 0) {
    ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now / 120)
    ctx.strokeStyle = COLORS[player === 1 ? 'p1' : 'p2']
    ctx.beginPath()
    ctx.arc(origin.x, origin.y, 1.2, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
    return
  }
  const r = blastRadius(power, defaultConfig)
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
  const push = blastPush(state.ball.pos, origin, power, player, defaultConfig)
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
    ctx.strokeStyle = '#f4f4f0'
    ctx.stroke()
    ctx.globalAlpha = 1
  }
}

/** Read-only: draws the state through the camera, which shows the full pitch width and at most 64 units of height. An optional ghost wall is drawn half-transparent. */
export function render(ctx: CanvasRenderingContext2D, state: SimState, cam: Camera, ghost?: StructureSpec, fragments: Fragment[] = [], now = 0, charge?: Charge, waves: Wave[] = [], fx?: Fx, ballGhost?: { at: Point; legal: boolean }): void {
  const { width, height } = ctx.canvas
  const { sx, sy, pane, visibleHeight } = viewOf(ctx.canvas, cam)
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, width, height)
  ctx.save()
  ctx.beginPath()
  ctx.rect(pane.x, pane.y, pane.w, pane.h)
  ctx.clip()
  const shake = fx ? shakeOffset(fx.shake.amp, fx.shake.born, now) : { x: 0, y: 0 }
  ctx.translate(pane.x + shake.x, pane.y + pane.h / 2 - cam.y * sy + shake.y)
  ctx.scale(sx, sy)

  ctx.fillStyle = COLORS.board
  ctx.fillRect(0, -BOARD, PITCH_WIDTH, PITCH_HEIGHT + 2 * BOARD)
  ctx.fillStyle = COLORS.pitch
  ctx.fillRect(0, 0, PITCH_WIDTH, PITCH_HEIGHT)
  // Faint owner tint per half.
  ctx.globalAlpha = 0.05
  ctx.fillStyle = COLORS.p2
  ctx.fillRect(0, 0, PITCH_WIDTH, HALF_HEIGHT)
  ctx.fillStyle = COLORS.p1
  ctx.fillRect(0, HALF_HEIGHT, PITCH_WIDTH, HALF_HEIGHT)
  ctx.globalAlpha = 1

  // Nets behind each goal, then the gap in the board.
  for (const [y, dir, color] of [[0, -1, COLORS.p2], [PITCH_HEIGHT, 1, COLORS.p1]] as const) {
    ctx.fillStyle = COLORS.net
    ctx.fillRect(GOAL_LEFT, dir < 0 ? y - NET_DEPTH - BOARD : y + BOARD, GOAL_RIGHT - GOAL_LEFT, NET_DEPTH)
    ctx.fillStyle = COLORS.pitch
    ctx.fillRect(GOAL_LEFT, dir < 0 ? y - BOARD : y, GOAL_RIGHT - GOAL_LEFT, BOARD)
    ctx.fillStyle = color
    ctx.fillRect(GOAL_LEFT, y - 0.25, GOAL_RIGHT - GOAL_LEFT, 0.5)
  }

  ctx.fillStyle = COLORS.line
  ctx.fillRect(0, HALF_HEIGHT - 0.15, PITCH_WIDTH, 0.3)

  const { builder } = state.match
  if (builder) {
    ctx.fillStyle = COLORS.line
    for (let x = 0; x <= PITCH_WIDTH; x += CELL_SIZE) for (let y = 0; y <= PITCH_HEIGHT; y += CELL_SIZE) ctx.fillRect(x - 0.08, y - 0.08, 0.16, 0.16)
    const [goalY, from] = builder === 1 ? [PITCH_HEIGHT, Math.PI] : [0, 0]
    ctx.beginPath()
    ctx.arc(PITCH_WIDTH / 2, goalY, NO_BUILD_RADIUS, from, from + Math.PI)
    ctx.setLineDash([0.8, 0.6])
    ctx.strokeStyle = COLORS[builder === 1 ? 'p1' : 'p2']
    ctx.lineWidth = 0.15
    ctx.stroke()
    ctx.setLineDash([])
  }

  const inRange = new Map(charge && charge.power > 0 ? blastDamage(state.objects, charge.origin, charge.power, charge.player, defaultConfig).map((h) => [h.wall.id, h.wall.owner === charge.player ? COLORS.ownTint : COLORS.illegal]) : [])
  for (const o of state.objects) {
    drawWall(ctx, o, inRange.get(o.id))
    const pulse = fx?.pulses.find((p) => p.tower === o.id)
    if (pulse && o.kind === 'tower') drawPulse(ctx, o, now - pulse.born)
    const flash = fx?.flashes.find((f) => f.wall === o.id)
    if (flash) {
      const t = (now - flash.born) / (flash.dim ? DIM_FLASH_MS : FLASH_MS)
      if (t < 1) {
        ctx.globalAlpha = (flash.dim ? 0.35 : 1) * (1 - t)
        drawWall(ctx, o, '#fff')
        ctx.globalAlpha = 1
      }
    }
  }
  drawBall(ctx, state.ball, !!fx?.pulses.some((p) => now - p.born < TRAIL_MS))
  if (charge) drawCharge(ctx, state, charge, now)
  for (const w of waves) {
    const t = (now - w.born) / WAVE_MS
    ctx.globalAlpha = 1 - t
    ctx.beginPath()
    ctx.arc(w.origin.x, w.origin.y, w.radius * t, 0, Math.PI * 2)
    ctx.strokeStyle = '#f4f4f0'
    ctx.lineWidth = 0.3
    ctx.stroke()
    ctx.globalAlpha = 1
  }
  for (const f of fragments) drawFragment(ctx, f, now)
  for (const p of fx?.particles ?? []) {
    const t = (now - p.born) / PARTICLE_MS
    if (t >= 1) continue
    ctx.globalAlpha = 1 - t
    ctx.fillStyle = p.color
    ctx.fillRect(p.at.x + p.vel.x * t - 0.15, p.at.y + p.vel.y * t - 0.15, 0.3, 0.3)
  }
  ctx.globalAlpha = 1
  if (ghost) {
    ctx.globalAlpha = 0.5
    drawWall(ctx, ghost, canPlace(state.objects, ghost) ? undefined : COLORS.illegal)
  }
  if (ballGhost) {
    ctx.globalAlpha = 0.5
    ctx.beginPath()
    ctx.arc(ballGhost.at.x, ballGhost.at.y, defaultConfig.ballRadius, 0, Math.PI * 2)
    ctx.fillStyle = ballGhost.legal ? '#f4f4f0' : COLORS.illegal
    ctx.fill()
    ctx.globalAlpha = 1
  }
  ctx.restore()
  edgeFade(ctx, pane, cam.y - visibleHeight / 2 > -BOARD, cam.y + visibleHeight / 2 < PITCH_HEIGHT + BOARD)
}

/** Soft gradient at the top/bottom edge of the pane where more pitch lies beyond. */
function edgeFade(ctx: CanvasRenderingContext2D, { x, y, w, h }: { x: number; y: number; w: number; h: number }, top: boolean, bottom: boolean): void {
  const fade = h * 0.06
  for (const [on, y0, y1] of [[top, y, y + fade], [bottom, y + h, y + h - fade]] as const) {
    if (!on) continue
    const g = ctx.createLinearGradient(0, y0, 0, y1)
    g.addColorStop(0, COLORS.bg)
    g.addColorStop(1, 'rgba(11,15,26,0)')
    ctx.fillStyle = g
    ctx.fillRect(x, Math.min(y0, y1), w, fade)
  }
}
