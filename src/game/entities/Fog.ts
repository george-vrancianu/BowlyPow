import { rules } from '../../config/rules'
import { visual } from '../../config/visual'
import { Entity } from './Entity'
import { viewOf, type Camera } from './Camera'

/** The edges of `camera`'s pane where more pitch lies beyond. */
export function fogEdges(camera: Camera, canvas: { width: number; height: number }) {
  const { visibleHeight } = viewOf(canvas, camera)
  return { top: camera.y - visibleHeight / 2 > -rules.board, bottom: camera.y + visibleHeight / 2 < rules.pitchHeight + rules.board }
}

/** A soft gradient over the top and bottom edge of the pane where more pitch lies beyond. Top-level: drawn in screen space, above the world. */
export class Fog extends Entity {
  constructor(private camera: () => Camera) {
    super()
  }

  protected override render(ctx: CanvasRenderingContext2D): void {
    const cam = this.camera()
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
}
