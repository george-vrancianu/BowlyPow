import { describe, expect, it } from 'vitest'
import { visual } from '../../config/visual'
import { defaultConfig, step, type SimState } from '../../sim/step'
import { buildState, playState } from '../../sim/testkit'
import type { WallSpec } from '../../sim/wall'
import { Aim, type AimLine } from './Aim'

const wall: WallSpec = { kind: 'wall', owner: 1, shape: 'straight', rotation: 0, at: { gx: 10, gy: 40 } }
const placed = () => step(buildState(1), { placeWall: wall }, defaultConfig).state

describe('Aim', () => {
  it('shows a fired shot\'s ring for waveMs', () => {
    const a = new Aim()
    a.sync(placed(), defaultConfig)
    a.wave({ x: 20, y: 70 }, 0.5)
    a.update((visual.aim.waveMs - 1) / 1000)
    expect(a.waveCount).toBe(1)
    a.update(0.002)
    expect(a.waveCount).toBe(0)
  })
})

describe('Aim Ghost', () => {
  // Straight up the left of the pitch, from 19 units below the end board: the ball (radius 1) first touches it at y = 1.
  const shooting = (): SimState => ({ ...playState(), possession: { shooter: 1, shots: 3, inHand: false, live: false }, ball: { pos: { x: 10, y: 20 }, vel: { x: 0, y: 0 }, rolled: 0 } })
  const touch = { until: { contacts: 1 }, scale: 1 } as const
  const ghostOf = (ghost: AimLine['ghost'], aim: Partial<AimLine> = { dir: { x: 0, y: -1 }, power: 0.5 }) => {
    const a = new Aim()
    a.sync(shooting(), defaultConfig)
    a.aim = { tier: 0, ghost, ...aim }
    return a.ghost
  }

  it('is the predicted path from the ball to its first contact', () => {
    const g = ghostOf(touch)!
    expect(g[0]).toEqual({ x: 10, y: 20 })
    expect(g.at(-1)!.x).toBeCloseTo(10)
    expect(g.at(-1)!.y).toBeCloseTo(1)
  })
  it('is cut to its scale of the path length', () => {
    // Half of the 19-unit path.
    const g = ghostOf({ ...touch, scale: 0.5 })!
    expect(g[0]).toEqual({ x: 10, y: 20 })
    expect(g.at(-1)!.x).toBeCloseTo(10)
    expect(g.at(-1)!.y).toBeCloseTo(10.5)
  })
  it('follows whatever ghost config is in effect', () => {
    // Off the left board first, then on to the end board.
    const g = ghostOf({ until: { contacts: 2 }, scale: 1 }, { dir: { x: -0.6, y: -0.8 }, power: 1 })!
    expect(g.some((p) => Math.abs(p.x - 1) < 1e-6)).toBe(true)
    expect(g.at(-1)!.y).toBeCloseTo(1)
  })
  it('shows no Ghost before the drag', () => {
    expect(ghostOf(touch, {})).toBeUndefined()
  })
})

describe('Aim cancel state', () => {
  const ball = { pos: { x: 20, y: 80 }, vel: { x: 0, y: 0 }, rolled: 0 }
  const ghost = { until: { contacts: 1 }, scale: 1 } as const

  it('greys the Ghost and marks an ✕ on the ball while cancel is armed', () => {
    const a = new Aim()
    a.sync({ ...playState(), ball }, defaultConfig)
    a.aim = { tier: 0, dir: { x: 0, y: -1 }, power: 0.3, ghost, cancel: true }
    expect(a.ghost).toBeDefined()
    expect(a.cancel).toEqual({ at: { x: 20, y: 80 }, color: visual.aim.cancel.color })
  })
  it('shows no ✕ for an armed aim', () => {
    const a = new Aim()
    a.sync({ ...playState(), ball }, defaultConfig)
    a.aim = { tier: 0, dir: { x: 0, y: -1 }, power: 0.3, ghost }
    expect(a.cancel).toBeUndefined()
  })
})

describe('Aim reset', () => {
  it('forgets the rings and the aim of the last match', () => {
    const a = new Aim()
    a.sync(placed(), defaultConfig)
    a.wave({ x: 20, y: 70 }, 0.5)
    a.aim = { tier: 0, dir: { x: 0, y: -1 }, power: 0.5, ghost: { until: { contacts: 1 }, scale: 1 } }
    a.reset()
    expect([a.waveCount, a.ghost]).toEqual([0, undefined])
  })
})
