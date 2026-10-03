import { visual } from '../../config/visual'
import type { Ball as BallState } from '../../sim/ball'
import type { PlayerId, Point } from '../../sim/pitch'
import { tierColor } from './Aim'
import { Entity } from './Entity'

/** Disc with a speed-scaled fading trail behind it and a dot that rolls with the distance travelled. */
export class Ball extends Entity {
  state: BallState = { pos: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, rolled: 0 }
  /** Ball-in-hand: where the ball would go, and whether that spot is legal. */
  placement?: { at: Point; legal: boolean; radius: number }
  /** The shooter whose ball gets the Breaker outline. */
  armed?: PlayerId
  /** The aim in progress: its phase and tier, the hold's climb to the next tier, its control radius in screen px, and how many screen px a world unit spans. */
  aim?: { phase: 'holding' | 'aiming'; tier: number; holdProgress: number; radiusPx: number; pxPerUnit: number }
  /** Reduced motion: reaching a tier changes the hold ring's colour without the pulse. */
  reduced = false
  /** The clock when a Repulsor fired (the trail runs bright for `visual.ball.trailMs`), and the steal sink in progress. */
  private pulsedAt?: number
  private sinking?: { from: Point; to: Point; age: number }
  // The tier last seen, and the clock when the hold reached a higher one.
  private lastTier?: number
  private reachedAt?: number

  sync(state: BallState): void {
    this.state = state
  }

  /** A Repulsor fired: the trail brightens for `visual.ball.trailMs`. */
  pulse(): void {
    this.pulsedAt = this.clock
  }

  get bright(): boolean {
    return this.pulsedAt !== undefined && this.clock - this.pulsedAt < visual.ball.trailMs
  }

  /** A Steal tower caught the ball: it shrinks from `from` into `to` over `visual.ball.stealMs`. */
  steal(from: Point, to: Point): void {
    this.sinking = { from, to, age: 0 }
  }

  get stealing(): boolean {
    return !!this.sinking && this.sinking.age < visual.ball.stealMs
  }

  /** The faint ring around the ball showing how far the aim can drag, in world units. */
  get controlRing(): { at: Point; radius: number } | undefined {
    return this.aim && { at: this.state.pos, radius: this.aim.radiusPx / this.aim.pxPerUnit }
  }

  /** While holding still on the ball: the ring filling towards the next tier, in the tier's colour, pulsing (`scale` > 1) just after reaching one. */
  get holdRing(): { at: Point; radius: number; progress: number; color: string; scale: number } | undefined {
    const { aim } = this
    if (aim?.phase !== 'holding') return undefined
    const { radiusPx, pulseMs, grow } = visual.ball.hold
    const k = this.reachedAt === undefined ? 1 : (this.clock - this.reachedAt) / pulseMs
    const scale = !this.reduced && k < 1 ? 1 + grow * Math.sin(Math.PI * k) : 1
    return { at: this.state.pos, radius: radiusPx / aim.pxPerUnit, progress: aim.holdProgress, color: tierColor(aim.tier), scale }
  }

  /** A new match: no pulse, no steal sink, no ghost, no aim. */
  reset(): void {
    this.pulsedAt = this.sinking = this.placement = this.armed = this.aim = this.lastTier = this.reachedAt = undefined
  }

  override update(dt: number): void {
    const tier = this.aim?.phase === 'holding' ? this.aim.tier : undefined
    if (tier !== undefined && this.lastTier !== undefined && tier > this.lastTier) this.reachedAt = this.clock
    this.lastTier = tier
    super.update(dt)
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
    const ring = this.controlRing
    if (ring) {
      const { color, alpha, width } = visual.ball.control
      ctx.globalAlpha = alpha
      ctx.beginPath()
      ctx.arc(ring.at.x, ring.at.y, ring.radius, 0, Math.PI * 2)
      ctx.strokeStyle = color
      ctx.lineWidth = width
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    const hold = this.holdRing
    if (hold) {
      const { width, trackAlpha } = visual.ball.hold
      const r = hold.radius * hold.scale
      ctx.lineWidth = width
      ctx.strokeStyle = hold.color
      ctx.globalAlpha = trackAlpha
      ctx.beginPath()
      ctx.arc(hold.at.x, hold.at.y, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.beginPath()
      ctx.arc(hold.at.x, hold.at.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * hold.progress)
      ctx.lineCap = 'round'
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
