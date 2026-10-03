import type { Tier } from '../../config/rules'
import { visual } from '../../config/visual'
import { predictPath } from '../../sim/predict'
import { splashRadius } from '../../sim/splash'
import type { Point } from '../../sim/pitch'
import type { SimConfig, SimState } from '../../sim/step'
import { Entity } from './Entity'

/** The aim in progress, as far as the Ghost needs it: `dir` and `power` once the shooter is dragging, and the ghost config in effect. */
export type AimLine = { tier: number; dir?: Point; power?: number; ghost: Tier['ghost'] }

/** The first `scale` of a polyline's length. */
function cut(points: Point[], scale: number): Point[] {
  const lengths = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y))
  let left = scale * lengths.reduce((a, b) => a + b, 0)
  const out = [points[0]]
  for (let i = 0; i < lengths.length; i++) {
    const [a, b] = [points[i], points[i + 1]]
    if (lengths[i] >= left) {
      const t = lengths[i] ? left / lengths[i] : 0
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
      break
    }
    left -= lengths[i]
    out.push(b)
  }
  return out
}

/** The aim's Ghost (the ball's predicted path) and the expanding ring of a fired shot. */
export class Aim extends Entity {
  aim?: AimLine
  private state?: SimState
  private config?: SimConfig
  private waves: { origin: Point; radius: number; born: number }[] = []
  // The last prediction, redone only when the aim or what it depends on changes, not every frame.
  private predicted?: { key: string; objects: SimState['objects']; points: Point[] }

  sync(state: SimState, config: SimConfig): void {
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
    this.aim = this.predicted = undefined
  }

  get waveCount(): number {
    return this.waves.length
  }

  /** The ball's predicted path from the ball, as the ghost config reaches and cut to its scale. None before the drag. */
  get ghost(): Point[] | undefined {
    const { aim, state, config } = this
    if (!aim?.dir || aim.power === undefined || !state || !config) return undefined
    const { tier, dir, power, ghost } = aim
    const key = JSON.stringify([tier, dir, power, ghost, state.ball.pos, state.possession.shooter])
    const p = this.predicted
    if (p?.key === key && p.objects === state.objects) return p.points
    const path = predictPath(state, { player: state.possession.shooter, tier, dir, power }, config, ghost.until)
    const points = cut(path.points, ghost.scale)
    this.predicted = { key, objects: state.objects, points }
    return points
  }

  override update(dt: number): void {
    super.update(dt)
    this.waves = this.waves.filter((w) => this.clock - w.born < visual.aim.waveMs)
  }

  protected override render(ctx: CanvasRenderingContext2D): void {
    const { ghost } = this
    if (ghost) {
      ctx.beginPath()
      ghost.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
      ctx.lineCap = ctx.lineJoin = 'round'
      ctx.strokeStyle = visual.aim.ghost.color
      ctx.lineWidth = visual.aim.ghost.width
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
