import { BOARD, PITCH_HEIGHT, PITCH_WIDTH } from '../sim/pitch'

const MAX_VISIBLE_HEIGHT = 64
const SMOOTHING_S = 0.15

/** Renderer state: the world y at the centre of the view. The width is always the pitch width. */
export type Camera = { y: number }

/** The pane is always 40 x 64 units: screens wider than 10:16 get side bands, taller ones get top and bottom bands. */
export function layout({ width, height }: { width: number; height: number }) {
  const scale = Math.min(width / PITCH_WIDTH, height / MAX_VISIBLE_HEIGHT)
  const w = PITCH_WIDTH * scale
  const h = MAX_VISIBLE_HEIGHT * scale
  return { scale, visibleHeight: MAX_VISIBLE_HEIGHT, pane: { x: (width - w) / 2, y: (height - h) / 2, w, h } }
}

const clampY = (y: number, visible: number) => Math.min(Math.max(y, -BOARD + visible / 2), PITCH_HEIGHT + BOARD - visible / 2)

/** Eases the camera toward the target over about 150 ms, clamped to the boards. */
export function follow(cam: Camera, target: number, dt: number, visible: number): void {
  cam.y = clampY(cam.y + (target - cam.y) * (1 - Math.exp(-dt / SMOOTHING_S)), visible)
}
