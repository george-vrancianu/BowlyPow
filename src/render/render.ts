import { GOAL_LEFT, GOAL_RIGHT, HALF_HEIGHT, PITCH_HEIGHT, PITCH_WIDTH } from '../sim/pitch'
import type { SimState } from '../sim/step'

const BOARD = 1
const NET_DEPTH = 3
const VIEW_WIDTH = PITCH_WIDTH + 2 * BOARD
const COLORS = { bg: '#0b0f1a', board: '#3a4258', pitch: '#121a2b', line: '#2c3a57', p1: '#22d3ee', p2: '#fb923c', net: '#1d2740' }

/** Read-only: draws the state through a fixed view that always fits the pitch width. */
export function render(ctx: CanvasRenderingContext2D, _state: SimState): void {
  const { width, height } = ctx.canvas
  const scale = width / VIEW_WIDTH
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
  ctx.restore()
}
