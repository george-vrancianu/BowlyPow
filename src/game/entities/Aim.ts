import { visual } from '../../config/visual'
import { blastDamage, blastPush, blastRadius } from '../../sim/blast'
import type { PlayerId, Point } from '../../sim/pitch'
import type { SimConfig, SimState } from '../../sim/step'
import { Entity } from './Entity'

/** A blast being charged: `power` is 0 during the dwell. */
export type Charge = { origin: Point; power: number; player: PlayerId }

const chargeColor = (t: number) => `rgb(${visual.aim.chargeFrom.map((from, i) => Math.round(from * (1 - t) + visual.aim.chargeTo[i] * t)).join(',')})`

/** The charge ring with its radar and push preview, and the expanding ring of a fired blast. */
export class Aim extends Entity {
  charge?: Charge
  private state?: Pick<SimState, 'ball' | 'objects'>
  private config?: SimConfig
  private waves: { origin: Point; radius: number; born: number }[] = []

  sync(state: Pick<SimState, 'ball' | 'objects'>, config: SimConfig): void {
    this.state = state
    this.config = config
  }

  /** A blast fired: a ring expands from `origin` to its radius over `visual.aim.waveMs`. */
  wave(origin: Point, power: number): void {
    if (this.config) this.waves.push({ origin, radius: blastRadius(power, this.config), born: this.clock })
  }

  get waveCount(): number {
    return this.waves.length
  }

  /** The structures the charge would damage, and whether each is the shooter's own. */
  preview(): { id: number; own: boolean }[] {
    const c = this.charge
    if (!c || c.power <= 0 || !this.state || !this.config) return []
    return blastDamage(this.state.objects, c.origin, c.power, c.player, this.config).map((h) => ({ id: h.wall.id, own: h.wall.owner === c.player }))
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
    const r = blastRadius(power, this.config)
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
    const push = blastPush(pos, origin, power, player, this.config)
    if (push) {
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
