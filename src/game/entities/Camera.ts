import { rules } from '../../config/rules'
import { visual } from '../../config/visual'
import type { Point } from '../../sim/pitch'
import { Entity } from './Entity'

type Pane = { x: number; y: number; w: number; h: number }
type Size = { width: number; height: number }
/** What the camera draws through: per-axis scale (they differ only in a stretched map), the pane on the canvas, and the world height shown. */
export type View = { sx: number; sy: number; pane: Pane; visibleHeight: number }
/** The part of a camera the layout maths needs. */
export type CameraView = { y: number; map?: { stretch: boolean } }

export function viewOf(canvas: Size, cam: CameraView): View {
  const { width, height } = canvas
  if (!cam.map) {
    const l = layout(canvas)
    return { sx: l.scale, sy: l.scale, pane: l.pane, visibleHeight: l.visibleHeight }
  }
  if (cam.map.stretch) return { sx: width / rules.pitchWidth, sy: height / rules.mapHeight, pane: { x: 0, y: 0, w: width, h: height }, visibleHeight: rules.mapHeight }
  const s = Math.min(width / rules.pitchWidth, height / rules.mapHeight)
  const [w, h] = [rules.pitchWidth * s, rules.mapHeight * s]
  return { sx: s, sy: s, pane: { x: (width - w) / 2, y: (height - h) / 2, w, h }, visibleHeight: rules.mapHeight }
}

/** Canvas rectangle where `cam`'s view lies, as seen through the map camera. */
export function viewOutline(canvas: Size, map: CameraView, cam: CameraView): Pane {
  const m = viewOf(canvas, map)
  const h = viewOf(canvas, cam).visibleHeight
  return { x: m.pane.x, y: m.pane.y + m.pane.h / 2 + (cam.y - h / 2 - map.y) * m.sy, w: rules.pitchWidth * m.sx, h: h * m.sy }
}

/** The pane is always 40 x 64 units: screens wider than 10:16 get side bands, taller ones get top and bottom bands. */
export function layout({ width, height }: Size) {
  const scale = Math.min(width / rules.pitchWidth, height / visual.camera.maxVisibleHeight)
  const w = rules.pitchWidth * scale
  const h = visual.camera.maxVisibleHeight * scale
  return { scale, visibleHeight: visual.camera.maxVisibleHeight, pane: { x: (width - w) / 2, y: (height - h) / 2, w, h } }
}

const clampY = (y: number, visible: number) => Math.min(Math.max(y, -rules.board + visible / 2), rules.pitchHeight + rules.board - visible / 2)

/** Screen offset in px at time `now` for a shake of `amp` px that started at `born`, decaying linearly to nothing. */
export function shakeOffset(amp: number, born: number, now: number): Point {
  const t = (now - born) / visual.camera.shake.ms
  if (t < 0 || t >= 1) return { x: 0, y: 0 }
  const a = amp * (1 - t)
  return { x: a * Math.sin(now * visual.camera.shake.freqX), y: a * Math.cos(now * visual.camera.shake.freqY) }
}

/**
 * The view onto the pitch: `y` is the world y at its centre, the width is always the pitch width. A `map` camera shows the whole pitch.
 * `held` keeps the view off the ball (manual pan or map jump) until `recenter()`. Its children are the world it draws.
 */
export class Camera extends Entity {
  held = false
  private shaking = { amp: 0, born: 0 }

  constructor(public y: number, public map?: { stretch: boolean }) {
    super()
  }

  /** Manual pan: moves the view and holds it off the ball until recenter() (sim events call it too). */
  pan(dy: number): void {
    this.y = clampY(this.y + dy, visual.camera.maxVisibleHeight)
    this.held = true
  }

  recenter(): void {
    this.held = false
  }

  /** Eases toward `target` over about 150 ms, clamped to the boards. */
  follow(target: number, dt: number): void {
    this.y = clampY(this.y + (target - this.y) * (1 - Math.exp(-dt / visual.camera.smoothingS)), visual.camera.maxVisibleHeight)
  }

  shake(amp: number): void {
    this.shaking = { amp, born: this.clock }
  }

  /** Current shake offset in px. */
  get shakeNow(): Point {
    return shakeOffset(this.shaking.amp, this.shaking.born, this.clock)
  }

  view(canvas: Size): View {
    return viewOf(canvas, this)
  }

  /** Canvas pixel position to world units through this camera. */
  toWorld(canvas: Size, px: number, py: number): Point {
    const { sx, sy, pane } = this.view(canvas)
    return { x: (px - pane.x) / sx, y: this.y + (py - (pane.y + pane.h / 2)) / sy }
  }

  /** Draws `content` through this camera, clipped to its pane. */
  override draw(ctx: CanvasRenderingContext2D, content: Entity[] = this.children): void {
    const { width, height } = ctx.canvas
    const { sx, sy, pane } = this.view(ctx.canvas)
    ctx.fillStyle = visual.camera.bg
    ctx.fillRect(0, 0, width, height)
    ctx.save()
    ctx.beginPath()
    ctx.rect(pane.x, pane.y, pane.w, pane.h)
    ctx.clip()
    const shake = this.shakeNow
    ctx.translate(pane.x + shake.x, pane.y + pane.h / 2 - this.y * sy + shake.y)
    ctx.scale(sx, sy)
    for (const c of content) c.draw(ctx)
    ctx.restore()
  }
}
