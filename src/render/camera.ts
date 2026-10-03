import { BOARD, HALF_HEIGHT, NET_DEPTH, PITCH_HEIGHT, PITCH_WIDTH, type PlayerId } from '../sim/pitch'

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
export function pan(cam: Camera, dy: number, visible: number, blind?: PlayerId): void {
  cam.y = clampY(cam.y + dy, visible, blind)
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

/** World y range of the opponent's half left out for a blind viewer sitting at `seat`: boards and net included, up to the halfway line. */
export const fogOf = (seat: PlayerId): { top: number; bottom: number } => (seat === 1 ? { top: MAP_TOP, bottom: HALF_HEIGHT } : { top: HALF_HEIGHT, bottom: MAP_TOP + MAP_HEIGHT })

/**
 * Keeps the view on the boards; for a `blind` seat, on its half plus the halfway line. The view (64) is taller than a half (54 + board), so it rests on the far board and the strip it still shows above the halfway line is what the fog covers.
 */
export function clampY(y: number, visible: number, blind?: PlayerId): number {
  const top = blind === 1 ? HALF_HEIGHT : -BOARD
  const bottom = blind === 2 ? HALF_HEIGHT : PITCH_HEIGHT + BOARD
  const [lo, hi] = [top + visible / 2, bottom - visible / 2]
  return blind === 2 ? Math.max(Math.min(y, hi), lo) : Math.min(Math.max(y, lo), hi)
}

/** Eases the camera toward the target over about 150 ms, clamped to the boards. */
export function follow(cam: Camera, target: number, dt: number, visible: number, blind?: PlayerId): void {
  cam.y = clampY(cam.y + (target - cam.y) * (1 - Math.exp(-dt / SMOOTHING_S)), visible, blind)
}
