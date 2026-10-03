import { rules } from '../../config/rules'
import { visual } from '../../config/visual'
import type { Structure, TowerPower } from '../../sim/wall'
import { drawCracks, Fixture, ownerFill } from './Fixture'

const GLYPHS: Record<TowerPower, (ctx: CanvasRenderingContext2D, x: number, y: number, spent: boolean) => void> = {
  // Concentric rings; dimmed once spent for the shot.
  repulsor(ctx, x, y, spent) {
    ctx.globalAlpha = spent ? visual.tower.spentAlpha : 1
    for (const r of visual.tower.rings) {
      ctx.beginPath()
      ctx.arc(x + rules.cellSize / 2, y + rules.cellSize / 2, r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  },
  // Vortex: a spiral of two turns.
  steal(ctx, x, y) {
    const { turns, step, grow } = visual.tower.spiral
    ctx.beginPath()
    for (let a = 0; a <= turns; a += step) ctx.lineTo(x + rules.cellSize / 2 + Math.cos(a) * a * grow, y + rules.cellSize / 2 + Math.sin(a) * a * grow)
    ctx.stroke()
  },
}

/** A square in the owner's colour with its power-up glyph inset. */
export class Tower extends Fixture {
  /** Ms since the Repulsor fired; undefined when not glowing. */
  private pulseAge?: number

  /** Repulsor fire effect: a glow over the tower and rings bursting outward for `visual.tower.glowMs`. */
  pulse(): void {
    this.pulseAge = 0
  }

  get glowing(): boolean {
    return this.pulseAge !== undefined && this.pulseAge < visual.tower.glowMs
  }

  override update(dt: number): void {
    super.update(dt)
    if (this.pulseAge !== undefined) this.pulseAge += dt * 1000
  }

  protected drawBody(ctx: CanvasRenderingContext2D, fill?: string): void {
    const d = this.data
    if (d.kind !== 'tower') return
    const { cellSize } = rules
    const [x, y] = [d.at.gx * cellSize, d.at.gy * cellSize]
    ctx.fillStyle = fill ?? ownerFill(ctx, d.owner)
    ctx.fillRect(x, y, cellSize, cellSize)
    ctx.strokeStyle = visual.tower.outline
    ctx.lineWidth = visual.tower.outlineWidth
    ctx.strokeRect(x, y, cellSize, cellSize)
    ctx.lineWidth = visual.tower.innerWidth
    const inset = visual.tower.innerInset
    ctx.strokeRect(x + inset, y + inset, cellSize - 2 * inset, cellSize - 2 * inset)
    GLYPHS[d.power](ctx, x, y, !!d.spent)
    if (d.hp !== undefined) drawCracks(ctx, d as Structure)
  }

  protected override drawEffect(ctx: CanvasRenderingContext2D): void {
    const d = this.data
    if (d.kind !== 'tower' || !this.glowing) return
    const k = this.pulseAge! / visual.tower.glowMs
    const [cx, cy] = [(d.at.gx + 0.5) * rules.cellSize, (d.at.gy + 0.5) * rules.cellSize]
    ctx.globalAlpha = 1 - k
    ctx.fillStyle = visual.tower.glow
    ctx.fillRect(cx - rules.cellSize / 2, cy - rules.cellSize / 2, rules.cellSize, rules.cellSize)
    ctx.strokeStyle = visual.tower.glow
    ctx.lineWidth = visual.tower.pulse.lineWidth
    for (const r of visual.tower.rings) {
      ctx.beginPath()
      ctx.arc(cx, cy, r + k * visual.tower.pulse.grow, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}
