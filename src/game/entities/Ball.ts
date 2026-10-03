import { visual } from '../../config/visual'
import type { Ball as BallState } from '../../sim/ball'
import type { PlayerId, Point } from '../../sim/pitch'
import { Entity } from './Entity'

/** Disc with a speed-scaled fading trail behind it and a dot that rolls with the distance travelled. */
export class Ball extends Entity {
  state: BallState = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, rolled: 0 }
  /** Ball-in-hand: where the ball would go, and whether that spot is legal. */
  placement?: { at: Point; legal: boolean; radius: number }
  /** The shooter whose ball gets the Breaker outline. */
  armed?: PlayerId
  /** Ms since a Repulsor fired (the trail runs bright for `visual.ball.trailMs`), and the steal sink in progress. */
  private pulseAge?: number
  private sinking?: { from: Point; to: Point; age: number }

  sync(state: BallState): void {
    this.state = state
  }

  /** A Repulsor fired: the trail brightens for `visual.ball.trailMs`. */
  pulse(): void {
    this.pulseAge = 0
  }

  get bright(): boolean {
    return this.pulseAge !== undefined && this.pulseAge < visual.ball.trailMs
  }

  /** A Steal tower caught the ball: it shrinks from `from` into `to` over `visual.ball.stealMs`. */
  steal(from: Point, to: Point): void {
    this.sinking = { from, to, age: 0 }
  }

  get stealing(): boolean {
    return !!this.sinking && this.sinking.age < visual.ball.stealMs
  }

  override update(dt: number): void {
    super.update(dt)
    if (this.pulseAge !== undefined) this.pulseAge += dt * 1000
    if (this.sinking) this.sinking.age += dt * 1000
  }

  protected override render(ctx: CanvasRenderingContext2D): void {
    if (this.sinking && this.stealing) {
      const { from, to, age } = this.sinking
      const k = Math.min(age / visual.ball.stealMs, 1)
      this.drawDisc(ctx, { pos: { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }, vel: { x: 0, y: 0 }, rolled: this.state.rolled }, false, 1 - k)
    } else this.drawDisc(ctx, this.state, this.bright, 1)
    if (this.armed) {
      const { radius, swing, periodMs, width } = visual.ball.armed
      ctx.beginPath()
      ctx.arc(this.state.pos.x, this.state.pos.y, radius + swing * Math.sin(this.clock / periodMs), 0, Math.PI * 2)
      ctx.strokeStyle = visual.player.colors[this.armed]
      ctx.lineWidth = width
      ctx.stroke()
    }
    if (this.placement) {
      ctx.globalAlpha = visual.ball.ghostAlpha
      ctx.beginPath()
      ctx.arc(this.placement.at.x, this.placement.at.y, this.placement.radius, 0, Math.PI * 2)
      ctx.fillStyle = this.placement.legal ? visual.ball.fill : visual.ball.illegal
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  private drawDisc(ctx: CanvasRenderingContext2D, { pos, vel, rolled }: BallState, bright: boolean, scale: number): void {
    const speed = Math.hypot(vel.x, vel.y)
    if (speed > 0) {
      const tail = { x: pos.x - vel.x * visual.ball.trailLength, y: pos.y - vel.y * visual.ball.trailLength }
      const g = ctx.createLinearGradient(pos.x, pos.y, tail.x, tail.y)
      g.addColorStop(0, bright ? visual.ball.trailBright : visual.ball.trail)
      g.addColorStop(1, visual.ball.trailClear)
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
      ctx.lineTo(tail.x, tail.y)
      ctx.lineCap = 'round'
      ctx.strokeStyle = g
      ctx.lineWidth = bright ? visual.ball.trailWidthBright : visual.ball.trailWidth
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, scale, 0, Math.PI * 2)
    ctx.fillStyle = visual.ball.fill
    ctx.fill()
    ctx.strokeStyle = visual.ball.outline
    ctx.lineWidth = visual.ball.outlineWidth
    ctx.stroke()
    const { offset, radius } = visual.ball.dot
    ctx.beginPath()
    ctx.arc(pos.x + Math.cos(rolled) * offset * scale, pos.y + Math.sin(rolled) * offset * scale, radius * scale, 0, Math.PI * 2)
    ctx.fillStyle = visual.ball.outline
    ctx.fill()
  }
}
