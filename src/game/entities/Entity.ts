/** A node in the scene graph: a local transform, children, and a clock that `update(dt)` advances. Entities own visual state only. */
export abstract class Entity {
  parent?: Entity
  children: Entity[] = []
  x = 0
  y = 0
  /** Milliseconds this entity has been updated for; animations key off it, not the wall clock. */
  clock = 0

  add<T extends Entity>(child: T): T {
    child.parent = this
    this.children.push(child)
    return child
  }

  remove(child: Entity): void {
    this.children = this.children.filter((c) => c !== child)
    child.parent = undefined
  }

  /** `dt` in seconds. */
  update(dt: number): void {
    this.clock += dt * 1000
    for (const c of this.children) c.update(dt)
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save()
    ctx.translate(this.x, this.y)
    this.render(ctx)
    for (const c of this.children) c.draw(ctx)
    ctx.restore()
  }

  /** Draws this entity itself, under its children. */
  protected render(_ctx: CanvasRenderingContext2D): void {}
}
