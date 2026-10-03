import { describe, expect, it, vi } from 'vitest'
import { visual } from '../../config/visual'
import type { Structure } from '../../sim/wall'
import { Structures } from './Structures'
import { Tower } from './Tower'
import { Wall } from './Wall'

const wall = (id: number): Structure => ({ id, kind: 'wall', owner: 1, shape: 'straight', rotation: 0, at: { gx: 10, gy: 40 }, hp: 3 })
const tower = (id: number): Structure => ({ id, kind: 'tower', owner: 2, power: 'repulsor', at: { gx: 5, gy: 10 }, hp: 3 })
const from = { x: 20, y: 80 }
const run = (s: Structures, ms: number) => s.update(ms / 1000)

describe('Structures', () => {
  it('creates a Wall or a Tower child as each sim object appears, and keeps them across syncs', () => {
    const s = new Structures()
    s.sync([wall(1), tower(2)])
    expect(s.count).toBe(2)
    expect(s.get(1)).toBeInstanceOf(Wall)
    expect(s.get(2)).toBeInstanceOf(Tower)
    const first = s.get(1)
    s.sync([wall(1), tower(2), wall(3)])
    expect(s.count).toBe(3)
    expect(s.get(1)).toBe(first)
  })

  it('drops a child at once when its object leaves the sim without a shatter (a demolition)', () => {
    const s = new Structures()
    s.sync([wall(1)])
    s.sync([])
    expect(s.count).toBe(0)
    expect(s.children).toHaveLength(0)
  })

  it('keeps a shattered child until the shatter ends, then removes it', () => {
    const s = new Structures()
    s.sync([wall(1)])
    s.shatter(1, from)
    s.sync([])
    expect(s.count).toBe(1)
    run(s, visual.wall.shatterMs - 1)
    expect(s.count).toBe(1)
    run(s, 2)
    expect(s.count).toBe(0)
    expect(s.children).toHaveLength(0)
  })

  it('holds a delayed shatter (a Steal tower) whole for the delay, then for the shatter', () => {
    const s = new Structures()
    s.sync([tower(2)])
    s.shatter(2, from, visual.ball.stealMs)
    s.sync([])
    run(s, visual.ball.stealMs + visual.wall.shatterMs - 1)
    expect(s.count).toBe(1)
    run(s, 2)
    expect(s.count).toBe(0)
  })

  it('applies the build overlays to the children it owns', () => {
    const s = new Structures()
    s.sync([wall(1), wall(2)])
    s.hidden = [1]
    s.movable = [2]
    s.mark()
    expect([s.get(1)?.hidden, s.get(2)?.hidden, s.get(1)?.movable, s.get(2)?.movable]).toEqual([true, false, false, true])
  })

  it('tints the walls a blast preview reaches: own ones differently from the enemy\'s', () => {
    const s = new Structures()
    s.sync([wall(1), wall(2)])
    s.preview = new Map([[1, true], [2, false]])
    s.mark()
    expect(s.get(1)?.tint).toBe(visual.wall.ownTint)
    expect(s.get(2)?.tint).toBe(visual.wall.illegal)
  })
})

/** A context that swallows every call: only the draw methods are under test. */
const ctx = new Proxy({}, { get: () => () => {}, set: () => true }) as unknown as CanvasRenderingContext2D
const spyDraws = (s: Structures) => ({ shatter: vi.spyOn(s, 'drawShatter'), particles: vi.spyOn(s, 'drawParticles'), pieces: vi.spyOn(s, 'drawPieces') })

describe('draw order', () => {
  it('fragments, particles, the landing piece and the build ghost are drawn by `fx`, not by the structures', () => {
    const s = new Structures()
    const spies = spyDraws(s)
    s.draw(ctx)
    for (const spy of Object.values(spies)) expect(spy).not.toHaveBeenCalled()
    s.fx.draw(ctx)
    for (const spy of Object.values(spies)) expect(spy).toHaveBeenCalledTimes(1)
  })
})

describe('Tower pulse', () => {
  it('glows for glowMs after the Repulsor fires, then stops', () => {
    const s = new Structures()
    s.sync([tower(2)])
    const t = s.get(2) as Tower
    s.pulse(2)
    run(s, visual.tower.glowMs - 1)
    expect(t.glowing).toBe(true)
    run(s, 2)
    expect(t.glowing).toBe(false)
  })
})

describe('Structures reset', () => {
  it('drops every child, shattering ones too, so a new match\'s ids start clean', () => {
    const s = new Structures()
    s.sync([wall(1), wall(2)])
    s.shatter(1, from)
    s.burst(from, 'red', 3)
    expect(s.particleCount).toBe(3)
    s.ghost = wall(3)
    s.reset()
    expect([s.count, s.children.length, s.ghost]).toEqual([0, 0, undefined])
    s.sync([tower(1)])
    expect(s.get(1)).toBeInstanceOf(Tower)
    expect(s.particleCount).toBe(0)
  })
})
