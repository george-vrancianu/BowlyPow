import { wallSegments } from '../../sim/wall'
import { drawSegments, Fixture, type WallData } from './Fixture'

export class Wall extends Fixture<WallData> {
  protected drawBody(ctx: CanvasRenderingContext2D, fill?: string): void {
    drawSegments(ctx, wallSegments(this.data), this.data.owner, fill)
    this.drawCracks(ctx)
  }

  protected footprint() {
    return wallSegments(this.data)
  }
}
