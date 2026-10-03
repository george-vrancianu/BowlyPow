import { rules } from '../../config/rules'
import { visual } from '../../config/visual'
import type { Point } from '../../sim/pitch'
import { crackLines, wallCells, wallSegments, type Structure, type StructureSpec } from '../../sim/wall'
import { Entity } from './Entity'

/** A structure as drawn: the sim's `Structure`, or a bare spec (a ghost) with no hp, id or spent flag yet. */
export type FixtureData = StructureSpec & { id?: number; hp?: number; spent?: boolean }

/** Player 2 walls: owner colour with diagonal stripes. */
function hatch(ctx: CanvasRenderingContext2D): CanvasPattern {
  const { tile: size, stripe, scale } = visual.wall.hatch
  const tile = document.createElement('canvas')
  tile.width = tile.height = size
  const t = tile.getContext('2d')!
  t.fillStyle = visual.player.colors[2]
  t.fillRect(0, 0, size, size)
  t.strokeStyle = visual.wall.hatchStripe
  t.lineWidth = stripe
  t.beginPath()
  t.moveTo(0, size)
  t.lineTo(size, 0)
  t.stroke()
  const pattern = ctx.createPattern(tile, 'repeat')!
  pattern.setTransform(new DOMMatrix().scale(scale))
  return pattern
}

export const ownerFill = (ctx: CanvasRenderingContext2D, owner: StructureSpec['owner']) => (owner === 2 ? hatch(ctx) : visual.player.colors[1])

/** Wall segments in the owner's colour (or `fill`) with a dark outline. */
export function drawSegments(ctx: CanvasRenderingContext2D, segments: { a: Point; b: Point }[], owner: StructureSpec['owner'], fill?: string): void {
  ctx.beginPath()
  for (const { a, b } of segments) {
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
  }
  ctx.lineCap = 'square'
  ctx.lineJoin = 'miter'
  ctx.strokeStyle = visual.wall.outline
  ctx.lineWidth = visual.wall.outlineWidth
  ctx.stroke()
  ctx.strokeStyle = fill ?? ownerFill(ctx, owner)
  ctx.lineWidth = 2 * rules.wallHalf
  ctx.stroke()
}

export function drawCracks(ctx: CanvasRenderingContext2D, s: Structure): void {
  ctx.beginPath()
  for (const [p, ...rest] of crackLines(s)) {
    ctx.moveTo(p.x, p.y)
    for (const q of rest) ctx.lineTo(q.x, q.y)
  }
  ctx.lineCap = 'butt'
  ctx.strokeStyle = visual.wall.outline
  ctx.lineWidth = visual.wall.crackWidth
  ctx.stroke()
}

/** One cell-sized piece of a destroyed structure, flying away from the impact point. */
type Fragment = { a: Point; b: Point }

/** What every structure shares: a flash on a hit, an outline when marked, and a shatter that outlives its sim object. */
export abstract class Fixture extends Entity {
  /** Placed this turn, so it can still be moved: drawn with a dashed outline. */
  movable = false
  /** The builder's selection: an outline that breathes. */
  selected = false
  /** Drawn by the ghost or landing piece instead. */
  hidden = false
  /** Overrides the owner colour (blast preview). */
  tint?: string
  /** Drawn half-transparent: ghosts. */
  alpha = 1
  private flash?: { dim: boolean; age: number }
  private shattering?: { from: Point; delay: number; age: number; fragments: Fragment[] }

  constructor(public data: FixtureData) {
    super()
  }

  get shattered(): boolean {
    return !!this.shattering && this.shattering.age >= this.shattering.delay + visual.wall.shatterMs
  }

  get isShattering(): boolean {
    return !!this.shattering
  }

  /** A ball hit: a bright flash after damage, a dim one otherwise. */
  hit(dim: boolean): void {
    this.flash = { dim, age: 0 }
  }

  /** Breaks into one fragment per cell flying from `from`, after `delay` ms (the structure stays whole until then). */
  shatter(from: Point, delay = 0): void {
    const fragments = wallCells(this.data).map(({ a, b }) => ({ a: { x: a.gx * rules.cellSize, y: a.gy * rules.cellSize }, b: { x: b.gx * rules.cellSize, y: b.gy * rules.cellSize } }))
    this.shattering = { from, delay, age: 0, fragments }
  }

  override update(dt: number): void {
    super.update(dt)
    const ms = dt * 1000
    if (this.flash) {
      this.flash.age += ms
      if (this.flash.age >= (this.flash.dim ? visual.wall.dimFlashMs : visual.wall.flashMs)) this.flash = undefined
    }
    if (this.shattering) this.shattering.age += ms
  }

  protected override render(ctx: CanvasRenderingContext2D): void {
    if (this.hidden) return
    ctx.globalAlpha = this.alpha
    const s = this.shattering
    if (s && s.age >= s.delay) {
      this.drawFragments(ctx, s)
    } else {
      this.drawBody(ctx, this.tint)
      if (!s) this.drawMarks(ctx)
    }
    ctx.globalAlpha = 1
  }

  /** The structure itself, filled with `fill` or the owner colour. */
  protected abstract drawBody(ctx: CanvasRenderingContext2D, fill?: string): void

  /** Pulse outline, tower glow and the hit flash, over the body. */
  protected drawMarks(ctx: CanvasRenderingContext2D): void {
    if (this.movable) this.outline(ctx, visual.wall.mark.pad, [...visual.wall.mark.movableDash])
    if (this.selected) this.drawSelected(ctx)
    this.drawEffect(ctx)
    if (this.flash) {
      const { dim, age } = this.flash
      const t = age / (dim ? visual.wall.dimFlashMs : visual.wall.flashMs)
      ctx.globalAlpha = (dim ? visual.wall.dimFlashAlpha : 1) * (1 - t)
      this.drawBody(ctx, visual.wall.flash)
      ctx.globalAlpha = 1
    }
  }

  /** Extra effect drawn over the body (the Repulsor glow). */
  protected drawEffect(_ctx: CanvasRenderingContext2D): void {}

  /** A thin outline around the footprint, in the owner's colour. */
  protected outline(ctx: CanvasRenderingContext2D, pad: number, dash: number[] = []): void {
    const d = this.data
    ctx.beginPath()
    if (d.kind === 'tower') ctx.rect(d.at.gx * rules.cellSize - pad, d.at.gy * rules.cellSize - pad, rules.cellSize + 2 * pad, rules.cellSize + 2 * pad)
    else for (const { a, b } of wallSegments(d)) ctx.rect(Math.min(a.x, b.x) - pad, Math.min(a.y, b.y) - pad, Math.abs(b.x - a.x) + 2 * pad, Math.abs(b.y - a.y) + 2 * pad)
    ctx.setLineDash(dash)
    ctx.strokeStyle = visual.player.colors[d.owner]
    ctx.lineWidth = visual.wall.mark.width
    ctx.stroke()
    ctx.setLineDash([])
  }

  private drawSelected(ctx: CanvasRenderingContext2D): void {
    const k = Math.sin(this.clock / visual.wall.selected.periodMs)
    const { alpha, alphaSwing, pad, padSwing } = visual.wall.selected
    ctx.globalAlpha = alpha + alphaSwing * k
    this.outline(ctx, pad + padSwing * k)
    ctx.globalAlpha = 1
  }

  private drawFragments(ctx: CanvasRenderingContext2D, { from, delay, age, fragments }: NonNullable<Fixture['shattering']>): void {
    const t = (age - delay) / visual.wall.shatterMs
    if (t >= 1) return
    for (const { a, b } of fragments) {
      const [cx, cy] = [(a.x + b.x) / 2, (a.y + b.y) / 2]
      const [dx, dy] = [cx - from.x, cy - from.y]
      const d = Math.hypot(dx, dy) || 1
      const fly = t * visual.wall.shatterFly
      ctx.save()
      ctx.globalAlpha = 1 - t
      ctx.translate(cx + (dx / d) * fly, cy + (dy / d) * fly)
      ctx.rotate(t * visual.wall.shatterSpin * (cx % 2 < 1 ? 1 : -1))
      ctx.translate(-cx, -cy)
      drawSegments(ctx, [{ a, b }], this.data.owner)
      ctx.restore()
    }
  }
}
