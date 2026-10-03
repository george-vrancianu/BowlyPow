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

describe('Aim reset', () => {
  it('forgets the rings and the charge of the last match', () => {
    const a = new Aim()
    a.sync(placed(), defaultConfig)
    a.wave({ x: 20, y: 70 }, 0.5)
    a.charge = { origin: { x: 21, y: 81 }, power: 1, player: 1 }
    a.reset()
    expect([a.waveCount, a.charge]).toEqual([0, undefined])
  })
})
