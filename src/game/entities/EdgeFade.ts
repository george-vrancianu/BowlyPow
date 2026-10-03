import { rules } from '../../config/rules'
import { visual } from '../../config/visual'
import { Entity } from './Entity'
import { viewOf, type Camera } from './Camera'

/** The edges of `camera`'s pane where more pitch lies beyond. */
export function fadeEdges(camera: Camera, canvas: { width: number; height: number }) {
  const { visibleHeight } = viewOf(canvas, camera)
  return { top: camera.y - visibleHeight / 2 > -rules.board, bottom: camera.y + visibleHeight / 2 < rules.pitchHeight + rules.board }
}

/** Top-level, above the world. Softens the top and bottom edge of the pane where more pitch lies beyond. */
export class EdgeFade extends Entity {
  constructor(private camera: () => Camera) {
    super()
  }

  protected override render(ctx: CanvasRenderingContext2D): void {
    const cam = this.camera()
    const { x, y, w, h } = viewOf(ctx.canvas, cam).pane
    const { top, bottom } = fadeEdges(cam, ctx.canvas)
    const fade = h * visual.edgeFade.fraction
    for (const [on, y0, y1] of [[top, y, y + fade], [bottom, y + h, y + h - fade]] as const) {
      if (!on) continue
      const g = ctx.createLinearGradient(0, y0, 0, y1)
      g.addColorStop(0, visual.edgeFade.color)
      g.addColorStop(1, visual.edgeFade.clear)
      ctx.fillStyle = g
      ctx.fillRect(x, Math.min(y0, y1), w, fade)
    }
  }
}
