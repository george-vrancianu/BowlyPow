import { rules } from '../../config/rules'
import { visual } from '../../config/visual'
import type { PlayerId, Point } from '../../sim/pitch'
import { Entity } from './Entity'
import { fogOf, viewOf, type Camera } from './Camera'

/** The edges of `camera`'s pane where more pitch lies beyond. */
export function fogEdges(camera: Camera, canvas: { width: number; height: number }) {
  const { visibleHeight } = viewOf(canvas, camera)
  return { top: camera.y - visibleHeight / 2 > -rules.board, bottom: camera.y + visibleHeight / 2 < rules.pitchHeight + rules.board }
}

/**
 * Top-level, above the world. Hides the opponent's half during a blind opening build, and softens the top and bottom edge of the pane where more pitch lies beyond.
 * The reveal is `blind` going back to undefined while the map camera shows the whole pitch.
 */
export class Fog extends Entity {
  /** The seat whose half is the only one shown; undefined = nothing hidden. */
  blind?: PlayerId

  /** `shake` is the offset the world is drawn with, so the fog moves with it. */
  constructor(private camera: () => Camera, private shake: () => Point) {
    super()
  }

  protected override render(ctx: CanvasRenderingContext2D): void {
    const cam = this.camera()
    if (this.blind) cam.through(ctx, this.shake(), () => this.cover(ctx, this.blind!))
    const { x, y, w, h } = viewOf(ctx.canvas, cam).pane
    const { top, bottom } = fogEdges(cam, ctx.canvas)
    const fade = h * visual.fog.fadeFraction
    for (const [on, y0, y1] of [[top, y, y + fade], [bottom, y + h, y + h - fade]] as const) {
      if (!on) continue
      const g = ctx.createLinearGradient(0, y0, 0, y1)
      g.addColorStop(0, visual.fog.color)
      g.addColorStop(1, visual.fog.clear)
      ctx.fillStyle = g
      ctx.fillRect(x, Math.min(y0, y1), w, fade)
    }
  }

  /** Over everything, so neither structures, grid, arc nor the ball betray the other half; the halfway line stays. */
  private cover(ctx: CanvasRenderingContext2D, seat: PlayerId): void {
    const { top, bottom } = fogOf(seat)
    const { bleed } = visual.fog
    ctx.fillStyle = visual.camera.bg
    ctx.fillRect(-bleed, top, rules.pitchWidth + 2 * bleed, bottom - top)
    ctx.fillStyle = visual.pitch.line
    ctx.fillRect(0, rules.halfHeight - visual.pitch.halfLineWidth / 2, rules.pitchWidth, visual.pitch.halfLineWidth)
  }
}
