import { BOARD, NET_DEPTH, PITCH_HEIGHT, PITCH_WIDTH } from '../sim/pitch'

const MAX_VISIBLE_HEIGHT = 64
const SMOOTHING_S = 0.15

/** Renderer state: the world y at the centre of the view. The width is always the pitch width. `map` makes it the whole-pitch map camera. `held` keeps the view off the ball (manual pan or map jump) until recenter(). */
export type Camera = { y: number; map?: { stretch: boolean }; held?: boolean }

type Pane = { x: number; y: number; w: number; h: number }
/** What the renderer draws through: per-axis scale (they differ only in a stretched map), the pane on the canvas, and the world height shown. */
export type View = { sx: number; sy: number; pane: Pane; visibleHeight: number }

/** World y range of everything drawn: boards and nets included. */
const MAP_TOP = -BOARD - NET_DEPTH
const MAP_HEIGHT = PITCH_HEIGHT + 2 * (BOARD + NET_DEPTH)
/** Centre of the map camera. */
export const MAP_Y = MAP_TOP + MAP_HEIGHT / 2

export function viewOf(canvas: { width: number; height: number }, cam: Camera): View {
  const { width, height } = canvas
  if (!cam.map) {
    const l = layout(canvas)
    return { sx: l.scale, sy: l.scale, pane: l.pane, visibleHeight: l.visibleHeight }
  }
  if (cam.map.stretch) return { sx: width / PITCH_WIDTH, sy: height / MAP_HEIGHT, pane: { x: 0, y: 0, w: width, h: height }, visibleHeight: MAP_HEIGHT }
  const s = Math.min(width / PITCH_WIDTH, height / MAP_HEIGHT)
  const [w, h] = [PITCH_WIDTH * s, MAP_HEIGHT * s]
  return { sx: s, sy: s, pane: { x: (width - w) / 2, y: (height - h) / 2, w, h }, visibleHeight: MAP_HEIGHT }
}

/** Canvas rectangle where `cam`'s view lies, as seen through the map camera. */
export function viewOutline(canvas: { width: number; height: number }, map: Camera, cam: Camera): Pane {
  const m = viewOf(canvas, map)
  const v = viewOf(canvas, cam)
  const h = v.visibleHeight
  return { x: m.pane.x, y: m.pane.y + m.pane.h / 2 + (cam.y - h / 2 - map.y) * m.sy, w: PITCH_WIDTH * m.sx, h: h * m.sy }
}

/** Manual pan: moves the view and holds it off the ball until recenter() (sim events call it too). */
export function pan(cam: Camera, dy: number, visible: number): void {
  cam.y = clampY(cam.y + dy, visible)
  cam.held = true
}

export const recenter = (cam: Camera): void => void (cam.held = false)

/** The pane is always 40 x 64 units: screens wider than 10:16 get side bands, taller ones get top and bottom bands. */
export function layout({ width, height }: { width: number; height: number }) {
  const scale = Math.min(width / PITCH_WIDTH, height / MAX_VISIBLE_HEIGHT)
  const w = PITCH_WIDTH * scale
  const h = MAX_VISIBLE_HEIGHT * scale
  return { scale, visibleHeight: MAX_VISIBLE_HEIGHT, pane: { x: (width - w) / 2, y: (height - h) / 2, w, h } }
}

export const clampY = (y: number, visible: number) => Math.min(Math.max(y, -BOARD + visible / 2), PITCH_HEIGHT + BOARD - visible / 2)

/** Eases the camera toward the target over about 150 ms, clamped to the boards. */
export function follow(cam: Camera, target: number, dt: number, visible: number): void {
  cam.y = clampY(cam.y + (target - cam.y) * (1 - Math.exp(-dt / SMOOTHING_S)), visible)
}
