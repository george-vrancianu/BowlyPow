import { visual } from '../../config/visual'
import { splashRadius } from '../../sim/splash'
import { chargeDir } from '../input/gesture'
import type { PlayerId, Point } from '../../sim/pitch'
import type { SimConfig, SimState } from '../../sim/step'
import { Entity } from './Entity'

/** A shot being charged (temporary hold-to-charge adapter): `power` is 0 during the dwell. */
export type Charge = { origin: Point; power: number; player: PlayerId }

const chargeColor = (t: number) => `rgb(${visual.aim.chargeFrom.map((from, i) => Math.round(from * (1 - t) + visual.aim.chargeTo[i] * t)).join(',')})`

/** The charge ring with its radar and launch preview, and the expanding ring of a fired shot. */
export class Aim extends Entity {
  charge?: Charge
  private state?: Pick<SimState, 'ball'>
  private config?: SimConfig
  private waves: { origin: Point; radius: number; born: number }[] = []

  sync(state: Pick<SimState, 'ball'>, config: SimConfig): void {
    this.state = state
    this.config = config
  }

  /** A shot fired: a ring expands from `origin` to its radius over `visual.aim.waveMs`. */
  wave(origin: Point, power: number): void {
    if (this.config) this.waves.push({ origin, radius: splashRadius(power, this.config), born: this.clock })
  }

  /** A new match: no rings, no charge. */
  reset(): void {
    this.waves = []
    this.charge = undefined
  }

  get waveCount(): number {
    return this.waves.length
  }

  override update(dt: number): void {
    super.update(dt)
    this.waves = this.waves.filter((w) => this.clock - w.born < visual.aim.waveMs)
  }

  protected override render(ctx: CanvasRenderingContext2D): void {
    if (this.charge) this.drawCharge(ctx, this.charge)
    for (const w of this.waves) {
      const t = (this.clock - w.born) / visual.aim.waveMs
      ctx.globalAlpha = 1 - t
      ctx.beginPath()
      ctx.arc(w.origin.x, w.origin.y, w.radius * t, 0, Math.PI * 2)
      ctx.strokeStyle = visual.aim.wave
      ctx.lineWidth = visual.aim.waveWidth
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }

  private drawCharge(ctx: CanvasRenderingContext2D, { origin, power, player }: Charge): void {
    const a = visual.aim
    ctx.lineWidth = a.lineWidth
    if (power === 0) {
      ctx.globalAlpha = a.dwell.alpha + a.dwell.swing * Math.sin(this.clock / a.dwell.periodMs)
      ctx.strokeStyle = visual.player.colors[player]
      ctx.beginPath()
      ctx.arc(origin.x, origin.y, a.dwell.radius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
      return
    }
    if (!this.config || !this.state) return
    const r = splashRadius(power, this.config)
    const color = chargeColor(power)
    ctx.beginPath()
    ctx.arc(origin.x, origin.y, r, 0, Math.PI * 2)
    ctx.globalAlpha = a.fillAlpha
    ctx.fillStyle = color
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.strokeStyle = color
    ctx.stroke()
    // Radar rings sweeping outward.
    for (const phase of a.radar.phases) {
      const t = (this.clock / a.radar.periodMs + phase) % 1
      ctx.globalAlpha = 1 - t
      ctx.beginPath()
      ctx.arc(origin.x, origin.y, r * t, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    const { pos } = this.state.ball
    const dir = chargeDir(pos, origin)
    if (dir) {
      const push = { x: dir.x * power * this.config.maxSpeed, y: dir.y * power * this.config.maxSpeed }
      const { scale, head, spread, alpha } = a.arrowShape
      const tip = { x: pos.x + push.x * scale, y: pos.y + push.y * scale }
      const ang = Math.atan2(push.y, push.x)
      ctx.beginPath()
      ctx.moveTo(pos.x, pos.y)
      ctx.lineTo(tip.x, tip.y)
      for (const s of [-1, 1]) {
        ctx.moveTo(tip.x, tip.y)
        ctx.lineTo(tip.x - Math.cos(ang + s * spread) * head, tip.y - Math.sin(ang + s * spread) * head)
      }
      ctx.globalAlpha = alpha
      ctx.strokeStyle = a.arrow
      ctx.stroke()
      ctx.globalAlpha = 1
    }
  }
}
