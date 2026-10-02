import { describe, expect, it } from 'vitest'
import { follow, layout } from './camera'

describe('layout', () => {
  it('phone portrait: 40 units across, height capped at 64, letterboxed when taller', () => {
    const l = layout({ width: 400, height: 1200 })
    expect(l.scale).toBe(10)
    expect(l.visibleHeight).toBe(64)
    expect(l.pane).toEqual({ x: 0, y: 280, w: 400, h: 640 })
  })
  it('short portrait screen shows less than 64 units', () => {
    expect(layout({ width: 400, height: 500 }).visibleHeight).toBe(50)
  })
  it('wide screen gets a 10:16 pane with side bands', () => {
    const l = layout({ width: 1600, height: 800 })
    expect(l.scale).toBe(12.5)
    expect(l.pane).toEqual({ x: 550, y: 0, w: 500, h: 800 })
  })
})

describe('follow', () => {
  it('moves about 63% of the way in 150 ms and settles at rest', () => {
    const t = { y: 40 }
    follow(t, 70, 0.15, 64)
    expect(t.y).toBeCloseTo(40 + 30 * 0.632, 1)
    for (let i = 0; i < 100; i++) follow(t, 70, 1 / 60, 64)
    expect(t.y).toBeCloseTo(70, 0)
  })
  it('never shows beyond the boards', () => {
    const t = { y: 50 }
    follow(t, -500, 10, 64)
    expect(t.y).toBe(31)
    follow(t, 900, 10, 64)
    expect(t.y).toBe(77)
  })
})
