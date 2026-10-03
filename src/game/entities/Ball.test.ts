import { describe, expect, it } from 'vitest'
import { visual } from '../../config/visual'
import { Ball } from './Ball'

const ms = (b: Ball, n: number) => b.update(n / 1000)

describe('Ball', () => {
  it('brightens its trail for trailMs after a pulse', () => {
    const b = new Ball()
    expect(b.bright).toBe(false)
    b.pulse()
    ms(b, visual.ball.trailMs - 1)
    expect(b.bright).toBe(true)
    ms(b, 2)
    expect(b.bright).toBe(false)
  })

  it('sinks into a Steal tower for stealMs, then is a normal ball again', () => {
    const b = new Ball()
    b.steal({ x: 0, y: 0 }, { x: 5, y: 5 })
    ms(b, visual.ball.stealMs - 1)
    expect(b.stealing).toBe(true)
    ms(b, 2)
    expect(b.stealing).toBe(false)
  })
})

describe('Ball control ring', () => {
  it('shows none without an aim', () => {
    expect(new Ball().controlRing).toBeUndefined()
  })
  it('rings the ball at the tier\'s control radius, converted from screen px to world units', () => {
    const b = new Ball()
    b.sync({ pos: { x: 20, y: 80 }, vel: { x: 0, y: 0 }, rolled: 0 })
    b.aim = { radiusPx: 220, pxPerUnit: 10 }
    expect(b.controlRing).toEqual({ at: { x: 20, y: 80 }, radius: 22 })
  })
})

describe('Ball reset', () => {
  it('forgets a pulse, a steal sink and an aim in progress', () => {
    const b = new Ball()
    b.pulse()
    b.steal({ x: 0, y: 0 }, { x: 5, y: 5 })
    b.aim = { radiusPx: 220, pxPerUnit: 10 }
    b.reset()
    expect([b.bright, b.stealing, b.controlRing]).toEqual([false, false, undefined])
  })
})
