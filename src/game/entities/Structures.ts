import { visual } from '../../config/visual'
import type { Point } from '../../sim/pitch'
import { canPlace, type Structure, type StructureSpec } from '../../sim/wall'
import { Entity } from './Entity'
import { Fixture, type FixtureData } from './Fixture'
import { Tower } from './Tower'
import { Wall } from './Wall'

type Particle = { at: Point; vel: Point; color: string; born: number }

const make = (d: FixtureData): Fixture => (d.kind === 'tower' ? new Tower(d) : new Wall(d))

/**
 * Every wall and tower, keyed by sim id. `sync` creates a child as an object appears; one that leaves the sim is dropped at once,
 * unless it was told to `shatter`, in which case it stays until the shatter ends. Also draws the build overlays (ghost, landing) and hit particles.
 */
export class Structures extends Entity {
  /** The piece being dragged and a confirmed piece not yet in the sim, drawn half-transparent. */
  ghost?: StructureSpec
  landing?: StructureSpec
  /** Ids stood in for by the ghost or landing piece. */
  hidden: number[] = []
  /** An older structure picked to demolish. */
  selected?: number
  /** Ids placed this turn. */
  movable: number[] = []
  /** Blast preview: ids in range, and whether each is the shooter's own. */
  preview = new Map<number, boolean>()
  private fixtures = new Map<number, Fixture>()
  private particles: Particle[] = []

  get(id: number): Fixture | undefined {
    return this.fixtures.get(id)
  }

  get count(): number {
    return this.fixtures.size
  }

  sync(objects: Structure[]): void {
    const present = new Set(objects.map((o) => o.id))
    for (const [id, f] of this.fixtures) if (!present.has(id) && !f.isShattering) this.drop(id, f)
    for (const o of objects) {
      const f = this.fixtures.get(o.id)
      if (f) f.data = o
      else {
        const made = this.add(make(o))
        this.fixtures.set(o.id, made)
      }
    }
  }

  hit(id: number, dim: boolean): void {
    this.fixtures.get(id)?.hit(dim)
  }

  pulse(id: number): void {
    const f = this.fixtures.get(id)
    if (f instanceof Tower) f.pulse()
  }

  /** The structure left the sim in a break at `from`: it stays, shattering, after `delay` ms. */
  shatter(id: number, from: Point, delay = 0): void {
    this.fixtures.get(id)?.shatter(from, delay)
  }

  burst(at: Point, color: string, count: number): void {
    const p = visual.wall.particles
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2
      const s = p.minSpeed + Math.random() * p.speedRange
      this.particles.push({ at, vel: { x: Math.cos(a) * s, y: Math.sin(a) * s }, color, born: this.clock })
    }
  }

  override update(dt: number): void {
    for (const [id, f] of this.fixtures) {
      f.hidden = this.hidden.includes(id)
      f.movable = this.movable.includes(id)
      f.selected = this.selected === id
      const hit = this.preview.get(id)
      f.tint = hit === undefined ? undefined : hit ? visual.wall.ownTint : visual.wall.illegal
    }
    super.update(dt)
    for (const [id, f] of this.fixtures) if (f.shattered) this.drop(id, f)
    this.particles = this.particles.filter((p) => this.clock - p.born < visual.wall.particles.ms)
  }

  private drop(id: number, f: Fixture): void {
    this.fixtures.delete(id)
    this.remove(f)
  }

  protected override render(): void {}

  override draw(ctx: CanvasRenderingContext2D): void {
    super.draw(ctx)
    ctx.save()
    const { ms, size } = visual.wall.particles
    for (const p of this.particles) {
      const t = (this.clock - p.born) / ms
      ctx.globalAlpha = 1 - t
      ctx.fillStyle = p.color
      ctx.fillRect(p.at.x + p.vel.x * t - size / 2, p.at.y + p.vel.y * t - size / 2, size, size)
    }
    ctx.restore()
    if (this.landing) this.drawGhost(ctx, this.landing, false)
    if (this.ghost) this.drawGhost(ctx, this.ghost, true)
  }

  private drawGhost(ctx: CanvasRenderingContext2D, spec: StructureSpec, selected: boolean): void {
    const f = make(spec)
    f.clock = this.clock
    f.alpha = visual.wall.ghostAlpha
    f.selected = selected
    if (selected && !canPlace(this.standing(), spec)) f.tint = visual.wall.illegal
    f.draw(ctx)
  }

  /** The structures a ghost has to fit among: everything in the sim except what it stands in for. */
  private standing(): StructureSpec[] {
    return [...this.fixtures].filter(([id, f]) => !this.hidden.includes(id) && !f.isShattering).map(([, f]) => f.data)
  }
}
