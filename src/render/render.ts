import type { Point } from '../sim/pitch'
import { PLAYER_COLORS } from '../sim/player'
import { GOAL_LEFT, GOAL_RIGHT, HALF_HEIGHT, PITCH_HEIGHT, PITCH_WIDTH } from '../sim/pitch'
import type { SimState } from '../sim/step'
import { isLegal, wallSegments, type Wall } from '../sim/wall'

const BOARD = 1
const NET_DEPTH = 3
const VIEW_WIDTH = PITCH_WIDTH + 2 * BOARD
const COLORS = { bg: '#0b0f1a', board: '#3a4258', pitch: '#121a2b', line: '#2c3a57', p1: PLAYER_COLORS[1], p2: PLAYER_COLORS[2], net: '#1d2740', outline: '#05070d', illegal: '#ef4444' }

const view = ({ width, height }: { width: number; height: number }) => {
  const scale = width / VIEW_WIDTH
  return { scale, x0: BOARD * scale, y0: height / 2 - (PITCH_HEIGHT / 2) * scale }
}

/** Canvas pixel position to world units under the fixed view. */
export function screenToWorld(canvas: { width: number; height: number }, px: number, py: number): Point {
  const { scale, x0, y0 } = view(canvas)
  return { x: (px - x0) / scale, y: (py - y0) / scale }
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

function drawWall(ctx: CanvasRenderingContext2D, w: Wall, fill?: string): void {
  ctx.beginPath()
  for (const { a, b } of wallSegments(w)) {
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
}

/** Read-only: draws the state through a fixed view that always fits the pitch width. An optional ghost wall is drawn half-transparent. */
export function render(ctx: CanvasRenderingContext2D, state: SimState, ghost?: Wall): void {
  const { width, height } = ctx.canvas
  const { scale } = view(ctx.canvas)
  ctx.fillStyle = COLORS.bg
  ctx.fillRect(0, 0, width, height)
  ctx.save()
  // World (0,0) is the pitch corner; centre the pitch vertically.
  ctx.translate(BOARD * scale, height / 2 - (PITCH_HEIGHT / 2) * scale)
  ctx.scale(scale, scale)

  ctx.fillStyle = COLORS.board
  ctx.fillRect(-BOARD, -BOARD, VIEW_WIDTH, PITCH_HEIGHT + 2 * BOARD)
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

  for (const o of state.objects) drawWall(ctx, o)
  if (ghost) {
    ctx.globalAlpha = 0.5
    drawWall(ctx, ghost, isLegal(ghost) ? undefined : COLORS.illegal)
  }
  ctx.restore()
}
