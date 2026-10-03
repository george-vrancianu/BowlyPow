import { wallSegments, type Structure } from '../../sim/wall'
import { drawCracks, drawSegments, Fixture } from './Fixture'

export class Wall extends Fixture {
  protected drawBody(ctx: CanvasRenderingContext2D, fill?: string): void {
    const d = this.data
    if (d.kind !== 'wall') return
    drawSegments(ctx, wallSegments(d), d.owner, fill)
    if (d.hp !== undefined) drawCracks(ctx, d as Structure)
  }
}
