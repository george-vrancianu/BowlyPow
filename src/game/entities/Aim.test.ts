import { describe, expect, it } from 'vitest'
import { visual } from '../../config/visual'
import { defaultConfig, step } from '../../sim/step'
import { buildState } from '../../sim/testkit'
import type { WallSpec } from '../../sim/wall'
import { Aim } from './Aim'

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

describe('Aim direction line', () => {
  const ball = { pos: { x: 20, y: 80 }, vel: { x: 0, y: 0 }, rolled: 0 }

  it('runs from the ball the way the ball will go', () => {
    const a = new Aim()
    a.sync({ ball }, defaultConfig)
    a.aim = { tier: 0, dir: { x: 0.6, y: -0.8 }, power: 0.3 }
    const { from, to } = a.line!
    const len = Math.hypot(to.x - from.x, to.y - from.y)
    expect(from).toEqual({ x: 20, y: 80 })
    expect((to.x - from.x) / len).toBeCloseTo(0.6)
    expect((to.y - from.y) / len).toBeCloseTo(-0.8)
  })
  it('is longer for a stronger aim', () => {
    const a = new Aim()
    a.sync({ ball }, defaultConfig)
    const length = (power: number) => {
      a.aim = { tier: 0, dir: { x: 0, y: -1 }, power }
      return a.line!.from.y - a.line!.to.y
    }
    expect(length(0.5)).toBeGreaterThan(length(0.15))
  })
  it('shows no line before the drag', () => {
    const a = new Aim()
    a.sync({ ball }, defaultConfig)
    a.aim = { tier: 0 }
    expect(a.line).toBeUndefined()
  })
})

describe('Aim reset', () => {
  it('forgets the rings and the aim of the last match', () => {
    const a = new Aim()
    a.sync(placed(), defaultConfig)
    a.wave({ x: 20, y: 70 }, 0.5)
    a.aim = { tier: 0, dir: { x: 0, y: -1 }, power: 0.5 }
    a.reset()
    expect([a.waveCount, a.line]).toEqual([0, undefined])
  })
})
