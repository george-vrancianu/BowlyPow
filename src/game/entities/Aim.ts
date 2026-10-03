import { visual } from '../../config/visual'
import { splashRadius } from '../../sim/splash'
import type { Point } from '../../sim/pitch'
import type { SimConfig, SimState } from '../../sim/step'
import { Entity } from './Entity'

/** The aim in progress, as far as the line needs it: `dir` and `power` once the shooter is dragging; `cancel` while cancel-armed. */
export type AimLine = { tier: number; dir?: Point; power?: number; cancel?: true }

/** The aim's direction line from the ball, and the expanding ring of a fired shot. */
export class Aim extends Entity {
  aim?: AimLine
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

  /** A new match: no rings, no aim. */
  reset(): void {
    this.waves = []
    this.aim = undefined
  }

  get waveCount(): number {
    return this.waves.length
  }

  /** The straight line the ball will start along, from the ball; longer for more power. None before the drag. */
  get line(): { from: Point; to: Point } | undefined {
    const { aim, state, config } = this
    if (!aim?.dir || aim.power === undefined || !state || !config) return undefined
    const from = state.ball.pos
    const len = aim.power * config.maxSpeed * visual.aim.line.scale
    return { from, to: { x: from.x + aim.dir.x * len, y: from.y + aim.dir.y * len } }
  }

  /** While cancel is armed: an ✕ on the ball, and the line drawn in the same grey. */
  get cancel(): { at: Point; color: string } | undefined {
    const { aim, state } = this
    return aim?.cancel && state ? { at: state.ball.pos, color: visual.aim.cancel.color } : undefined
  }

  override update(dt: number): void {
    super.update(dt)
    this.waves = this.waves.filter((w) => this.clock - w.born < visual.aim.waveMs)
  }

  protected override render(ctx: CanvasRenderingContext2D): void {
    const { line, cancel } = this
    if (line) {
      ctx.beginPath()
      ctx.moveTo(line.from.x, line.from.y)
      ctx.lineTo(line.to.x, line.to.y)
      ctx.lineCap = 'round'
      ctx.strokeStyle = cancel?.color ?? visual.aim.line.color
      ctx.lineWidth = visual.aim.line.width
      ctx.stroke()
    }
    if (cancel) {
      const { size, width } = visual.aim.cancel
      const { x, y } = cancel.at
      ctx.beginPath()
      ctx.moveTo(x - size, y - size)
      ctx.lineTo(x + size, y + size)
      ctx.moveTo(x + size, y - size)
      ctx.lineTo(x - size, y + size)
      ctx.lineCap = 'round'
      ctx.strokeStyle = cancel.color
      ctx.lineWidth = width
      ctx.stroke()
    }
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
}
